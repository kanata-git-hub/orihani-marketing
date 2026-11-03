import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeGeneration } from '../safeGeneration.ts';

test('all existing text, search, reference-image and edit request shapes are preserved', () => {
  for (const request of [
    { model: 'gemini-3.6-flash', contents: 'original prompt', config: { systemInstruction: 'unchanged', temperature: 0.7, tools: [{ googleSearch: {} }] } },
    { model: 'gemini-3.5-flash-lite', contents: [{ role: 'user', parts: [{ text: 'original' }] }] },
    { model: 'gemini-nano-banana-2.1', contents: { parts: [{ inlineData: { data: 'AA==', mimeType: 'image/png' } }, { text: 'edit instructions' }] }, config: { imageConfig: { aspectRatio: '9:16', imageSize: '4K' }, tools: [{ googleSearch: { searchTypes: { webSearch: {}, imageSearch: {} } } }] } },
  ]) assert.deepEqual(safeGeneration(request), request);
});

test('rejects key-exfiltration transport overrides before SDK execution', () => {
  for (const extra of [
    { config: { httpOptions: { baseUrl: 'https://attacker.invalid', headers: { 'x-goog-api-key': 'replace' } } } },
    { httpOptions: { baseUrl: 'https://attacker.invalid' } },
    { config: { apiKey: 'replace' } }, { config: { tools: [{ urlContext: {} }] } },
    { model: 'https://attacker.invalid/model' }, { model: '../operations/anything' }, { config: [] },
  ]) assert.throws(() => safeGeneration({ model: 'gemini-3.6-flash', contents: 'test', ...extra }), /INVALID_GENERATION/);
});

test('legacy image requests migrate without mutating inputs or accepting transport overrides', () => {
  for (const size of ['512', '512px', '1K', '2K', '4K']) {
    const request = { model: 'gemini-3.1-flash-image', contents: { parts: [{ text: 'edit' }, { inlineData: { mimeType: 'image/png', data: 'AA==' } }] }, config: { imageConfig: { aspectRatio: '9:16', imageSize: size }, tools: [{ googleSearch: { searchTypes: { webSearch: {}, imageSearch: {} } } }] } };
    const result = safeGeneration(request);
    assert.equal(result.model, 'gemini-nano-banana-2.1');
    assert.equal(result.config.imageConfig.imageSize, size.startsWith('512') ? '1K' : size);
    assert.deepEqual(result.contents, request.contents);
    assert.deepEqual(result.config.tools, request.config.tools);
    assert.equal(request.config.imageConfig.imageSize, size);
    assert.throws(() => safeGeneration({ ...request, config: { ...request.config, httpOptions: { baseUrl: 'https://attacker.invalid' } } }), /INVALID_GENERATION/);
  }
  assert.throws(() => safeGeneration({ model: 'gemini-3.1-flash-image-preview', contents: 'test' }), /INVALID_GENERATION/);
});

test('only inline text and image inputs are accepted from the browser', () => {
  const base = { model: 'gemini-3.6-flash', contents: 'example' };
  for (const part of [{ fileData: { fileUri: 'files/example' } }, { functionResponse: {} }, { inlineData: { data: 'AA==', mimeType: 'text/plain' } }]) {
    assert.throws(() => safeGeneration({ ...base, contents: { parts: [part] } }), /INVALID_GENERATION/);
    assert.throws(() => safeGeneration({ ...base, config: { systemInstruction: { parts: [part] } } }), /INVALID_GENERATION/);
  }
});
