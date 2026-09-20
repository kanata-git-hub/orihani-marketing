import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeGeneration } from '../safeGeneration.ts';

test('all existing text, search, reference-image and edit request shapes are preserved', () => {
  for (const request of [
    { model: 'gemini-3.6-flash', contents: 'original prompt', config: { systemInstruction: 'unchanged', temperature: 0.7, tools: [{ googleSearch: {} }] } },
    { model: 'gemini-3.5-flash-lite', contents: [{ role: 'user', parts: [{ text: 'original' }] }] },
    { model: 'gemini-3.1-flash-image', contents: { parts: [{ inlineData: { data: 'AA==', mimeType: 'image/png' } }, { text: 'edit instructions' }] }, config: { imageConfig: { aspectRatio: '9:16', imageSize: '4K' }, tools: [{ googleSearch: { searchTypes: { webSearch: {}, imageSearch: {} } } }] } },
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
