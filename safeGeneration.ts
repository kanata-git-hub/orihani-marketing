// Keep all models/options used by the existing UI; never accept SDK transport settings.
const MODELS = new Set(['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-nano-banana-2.1']);
const OPTIONS = new Set(['systemInstruction', 'temperature', 'tools', 'imageConfig']);
export function safeGeneration(body: any) {
  // Migrate requests from already-open tabs before they reach the provider.
  const model = body?.model === 'gemini-3.1-flash-image' ? 'gemini-nano-banana-2.1' : body?.model;
  if (!body || typeof body !== 'object' || Array.isArray(body) || !MODELS.has(model) || body.contents == null ||
      Object.keys(body).some(key => !['model', 'contents', 'config'].includes(key))) throw Error('INVALID_GENERATION_REQUEST');
  let config = body.config;
  if (config !== undefined && (!config || typeof config !== 'object' || Array.isArray(config) ||
      Object.keys(config).some(key => !OPTIONS.has(key)))) throw Error('INVALID_GENERATION_CONFIG');
  if (config?.tools !== undefined && (!Array.isArray(config.tools) || config.tools.length > 1 || config.tools.some((tool: any) =>
      !tool || typeof tool !== 'object' || Object.keys(tool).some(key => key !== 'googleSearch') || !tool.googleSearch))) throw Error('INVALID_GENERATION_TOOLS');
  // Nano Banana 2.1 starts at 1K; preserve old tabs using the removed 512px option.
  if (model === 'gemini-nano-banana-2.1' && ['512', '512px'].includes(config?.imageConfig?.imageSize)) {
    config = { ...config, imageConfig: { ...config.imageConfig, imageSize: '1K' } };
  }
  // The request object is reconstructed, so apiKey/baseUrl/httpOptions can never reach the SDK.
  return { model, contents: body.contents, ...(config === undefined ? {} : { config }) };
}
