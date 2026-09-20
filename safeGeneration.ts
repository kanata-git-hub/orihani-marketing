// Keep all models/options used by the existing UI; never accept SDK transport settings.
const MODELS = new Set(['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-image']);
const OPTIONS = new Set(['systemInstruction', 'temperature', 'tools', 'imageConfig']);
export function safeGeneration(body: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !MODELS.has(body.model) || body.contents == null ||
      Object.keys(body).some(key => !['model', 'contents', 'config'].includes(key))) throw Error('INVALID_GENERATION_REQUEST');
  const config = body.config;
  if (config !== undefined && (!config || typeof config !== 'object' || Array.isArray(config) ||
      Object.keys(config).some(key => !OPTIONS.has(key)))) throw Error('INVALID_GENERATION_CONFIG');
  if (config?.tools !== undefined && (!Array.isArray(config.tools) || config.tools.length > 1 || config.tools.some((tool: any) =>
      !tool || typeof tool !== 'object' || Object.keys(tool).some(key => key !== 'googleSearch') || !tool.googleSearch))) throw Error('INVALID_GENERATION_TOOLS');
  // The request object is reconstructed, so apiKey/baseUrl/httpOptions can never reach the SDK.
  return { model: body.model, contents: body.contents, ...(config === undefined ? {} : { config }) };
}
