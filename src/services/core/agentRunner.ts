import { getGeminiClient } from '../geminiClient';
import { AgentLog, AgentResponse } from '../../types/agent';

const MODEL_NAME = "gemini-3.6-flash";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const callAgent = async (
  systemInstruction: string, 
  prompt: string, 
  modelOverride?: string, 
  imageB64?: string, 
  imageMime?: string,
  useSearch: boolean = false,
  maxRetries: number = 12,
  fallbackModels?: string[]
): Promise<string> => {
  const ai = getGeminiClient();
  const contents: any[] = [];
  if (imageB64 && imageMime) {
    contents.push({ inlineData: { data: imageB64, mimeType: imageMime } });
  }
  contents.push({ text: prompt });

  const config: any = {
    systemInstruction,
    temperature: 0.7,
  };

  if (useSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  let attempt = 0;
  let modelAttempt = 0;

  const modelChain = fallbackModels && fallbackModels.length > 0 
    ? fallbackModels 
    : [
        modelOverride || MODEL_NAME,
        "gemini-3.6-flash",
        "gemini-3.6-flash"
      ];

  let currentModelIndex = 0;
  let currentModel = modelChain[currentModelIndex];

  while (attempt < maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: contents,
        config: config,
      }) as any;
      return response.text || "";
    } catch (e: any) {
      attempt++;
      modelAttempt++;
      
      const errorString = JSON.stringify(e, Object.getOwnPropertyNames(e));
      const isOverloaded = e?.message?.includes('503') || e?.message?.includes('429') || 
                           e?.status === 503 || e?.status === 429 || 
                           e?.error?.code === 503 || e?.error?.code === 429 ||
                           e?.error?.status === 'UNAVAILABLE' ||
                           String(e).includes('503') || String(e).includes('429') ||
                           String(e).includes('UNAVAILABLE') || String(e).includes('TIMEOUT') ||
                           errorString.includes('503') || errorString.includes('429') ||
                           errorString.includes('UNAVAILABLE');
      const isNotFound = e?.message?.includes('404') || e?.status === 404 || e?.error?.code === 404 || String(e).includes('404') || errorString.includes('404');
      const isInternalError = e?.message?.includes('500') || e?.status === 500 || e?.error?.code === 500;
      
      if ((isOverloaded || isNotFound || isInternalError) && attempt < maxRetries) {
        // Immediately switch to the next model in the chain to save time
        const oldModel = currentModel;
        if (currentModelIndex < modelChain.length - 1) {
          currentModelIndex++;
          currentModel = modelChain[currentModelIndex];
        } else {
          currentModel = "gemini-3.6-flash"; // Ultimate Fallback if unknown model
        }

        console.warn(`[Model Fetch Failed] ${oldModel} failed. Escalating to ${currentModel} (attempt ${attempt}/${maxRetries})...`);
        
        // Reduced wait time for faster retries
        const waitTime = 500 + Math.random() * 500;
        await delay(waitTime);
      } else {
        console.error(`Agent call failed (attempt ${attempt}/${maxRetries}) with model ${currentModel}:`, e);
        if (attempt >= maxRetries) {
          return "오류 발생: " + (e instanceof Error ? e.message : String(e));
        } else {
          const waitTime = 500;
          await delay(waitTime);
        }
      }
    }
  }
  return "오류 발생: 최대 재시도 횟수 초과";
};
