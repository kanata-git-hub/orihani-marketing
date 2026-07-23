import { GenerateContentResponse } from "@google/genai";
import { getGeminiClient } from '../geminiClient';

export type ImageModel = 'gemini-3.1-flash-image';
export type ImageSize = '512px' | '1K' | '2K' | '4K';
export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface RefImage {
  url: string;
  label?: string;
}

interface GenerationOptions {
  model: ImageModel;
  prompt: string;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
  useSearch?: boolean;
  referenceImages?: (string | RefImage)[]; 
}

export const generateImage = async (options: GenerationOptions): Promise<string | null> => {
  const { model, prompt, aspectRatio = '1:1', useSearch = false, referenceImages = [] } = options;

  const ai = getGeminiClient();

  // 이미지 파트들을 먼저 넣고 텍스트 지시사항을 마지막에 배치 (모델 인식률 향상)
  const parts: any[] = [];
  
  referenceImages.forEach((imgItem, index) => {
    let img = '';
    let label = '';
    
    if (typeof imgItem === 'string') {
      img = imgItem;
    } else {
      img = imgItem.url;
      label = imgItem.label || '';
    }

    if (label) {
      parts.push({ text: `Reference image for subject/character: ${label}` });
    } else {
      parts.push({ text: `Reference image ${index + 1}:` });
    }

    const mimeTypeMatch = img.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/png";
    const base64Data = img.includes(',') ? img.split(',')[1] : img;

    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    });
  });

  parts.push({ text: prompt });

  const config: any = {
    imageConfig: {
      aspectRatio,
      imageSize: options.imageSize || '1K',
    }
  };

  if (useSearch) {
    config.tools = [{ googleSearch: { searchTypes: { webSearch: {}, imageSearch: {} } } }];
  }

  try {
    let response: GenerateContentResponse | null = null;
    let retries = 0;
    const maxRetries = 2;
    const baseDelay = 3000;

    while (retries <= maxRetries) {
      try {
        console.log(`API Request Attempt ${retries + 1}... (Model: ${model})`);
        
        // 180초 타임아웃 적용
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("API request timed out (180s)")), 180000)
        );

        const generatePromise = ai.models.generateContent({
          model,
          contents: { parts },
          config,
        });

        response = await Promise.race([generatePromise, timeoutPromise]) as GenerateContentResponse;
        console.log("API Request Successful");
        break;
      } catch (error: any) {
        const isTimeout = error.message?.includes('timed out');
        const isUnavailable = error.status === 'UNAVAILABLE' || error.code === 503 || error.message?.includes('503');
        
        if (isTimeout || isUnavailable) {
          if (retries === maxRetries) throw error;
          retries++;
          const delay = baseDelay * Math.pow(2, retries - 1);
          console.warn(`Request failed (${isTimeout ? 'Timeout' : 'Unavailable'}), retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }

    if (!response) return null;

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};

export const editImage = async (baseImage: string, prompt: string, model: ImageModel = 'gemini-3.1-flash-image'): Promise<string | null> => {
  try {
    const ai = getGeminiClient();

    let response: GenerateContentResponse | null = null;
    let retries = 0;
    const maxRetries = 3;
    const baseDelay = 2000;

    // 에디트 기능에서도 동적 MIME 타입 추출 적용
    const mimeTypeMatch = baseImage.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/png";
    const base64Data = baseImage.includes(',') ? baseImage.split(',')[1] : baseImage;

    const contents = [
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      },
      {
        text: prompt,
      },
    ];

    while (retries <= maxRetries) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: { parts: contents },
        });
        break;
      } catch (error: any) {
        if (error.status === 'UNAVAILABLE' || (error.code === 503) || error.message?.includes('503')) {
          if (retries === maxRetries) throw error;
          retries++;
          const delay = baseDelay * Math.pow(2, retries - 1);
          console.warn(`Model unavailable, retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }

    if (!response) return null;

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error editing image:", error);
    throw error;
  }
};
