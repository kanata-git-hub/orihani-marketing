const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, imports = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => name in imports ? imports[name] : require(name), module, module.exports);
  return module.exports;
}
const parsing = load('src/utils/pipelineParsing.ts');
const { parseBlogResponse, restoreBlogResult, parseScenarioResponse, canSaveScenario } = parsing;
const chars = [{ id: 'owonjang', name: 'O-wonjang (Korean Medicine)' }, { id: 'deoki', name: 'Deok-i' }];
const plain = `[Part 0: Image Suggestion]
Deok-i sitting at a table.

[Part 1: Naver Blog Post]
# 식사 후 속이 불편하다면
<b>식후 답답함</b>이 반복되나요?

### 식사 기록
먹은 양과 불편한 시간을 기록하세요.

[Part 2: Instagram Thumbnail Text]
Insta Title: 식사만 하면 답답해
Insta Content: 식후 불편함이 반복되나요?
언제 불편한지 살펴봅니다.

[Part 3: 5-Second Video Script]
Video Script:
1. 식사만 하면 답답해
2. After every meal
3. 식사 기록을 살펴봐요
4. Check your meal diary

[Part 4: YouTube TTS Script]
[쇼츠 썸네일 문구] 식사만 하면 답답해
[시각적 연출 지시문] Deok-i checks a diary.

[Part 5: YouTube Metadata]
YouTube Title: 식후 답답함이 반복되나요?
YouTube Hashtags: #소화불량 #오리한의원
YouTube Narration: "언제 불편한지 기록해보세요."`;
const bold = plain.replace(/^(\[Part[^\n]+\])$/gm, '### **$1**')
  .replace(/^(Insta Title|Insta Content|YouTube Title|YouTube Hashtags|YouTube Narration): (.*)$/gm, '**$1:**\n$2')
  .replace('Video Script:', '**Video Script:**');
const scenario = `### 0. Planning & Narrative (Korean)
- **출연 캐릭터:** owonjang, deoki
🎬 제목: 식사 기록 / Meal diary
### 1. Image Generation Prompts for Gemini Image (English)
- **Scene 1 Prompt (First Frame):** Deok-i at a table.
- **Scene 2 Prompt (Last Frame):** O-wonjang checks the diary.
### 2. Video Generation Prompts (English)
OUTPUT SPECS: 2s
ACTION: Deok-i looks at the diary.
OUTPUT SPECS: 3s
ACTION: O-wonjang points at the page.`;

test('reproduces the screenshot failure and parses bold, multiline labels without losing the title', () => {
  assert.equal(bold.match(/Insta Title:\s*(.*)/)[1], '**');
  assert.equal(bold.match(/Video Script:\n([\s\S]*?)(?=\n(?:---|###|\s)*\[Part 4:|$)/), null);
  const expected = parseBlogResponse(plain);
  for (const text of [bold, bold.replace(/\n/g, '\r\n'), bold.replace(/\*\*/g, '__')]) {
    const actual = parseBlogResponse(text);
    for (const key of ['blog', 'imageSuggestion', 'instaTitle', 'instaContent', 'videoScript', 'youtubeTtsScript', 'youtubeTitle', 'youtubeHashtags', 'youtubeNarration']) {
      assert.deepEqual(actual[key], expected[key], key);
    }
  }
  assert.match(expected.blog, /<b>식후 답답함<\/b>/);
  assert.match(expected.blog, /### 식사 기록/);
  assert.doesNotMatch(expected.instaContent, /Part|Video|\*\*/);
});

test('same-line bold values, CRLF, separators and numbered captions remain separate', () => {
  const text = plain.replace(/^(Insta Title|Insta Content): (.*)$/gm, '**$1:** **$2**')
    .replace(/\n\n\[Part/g, '\n\n---\n\n[Part').replace(/^(\d)\. /gm, '  $1) ');
  const actual = parseBlogResponse(text);
  assert.equal(actual.instaTitle, '식사만 하면 답답해');
  assert.deepEqual(actual.videoScript, parseBlogResponse(plain).videoScript);
  assert.equal(actual.blog, parseBlogResponse(plain).blog);
  assert.equal(actual.youtubeHashtags, '#소화불량 #오리한의원');
});

test('empty labels cannot consume the next field; incomplete output reports an actionable error', () => {
  const noTitle = plain.replace('Insta Title: 식사만 하면 답답해', '**Insta Title:**');
  assert.equal(parseBlogResponse(noTitle, '기획한 주제').instaTitle, '기획한 주제');
  for (const text of ['', '형식이 없는 응답', plain.split('[Part 3:')[0], plain.replace('Insta Content:', 'Missing:')]) {
    assert.throws(() => parseBlogResponse(text), /포스팅 생성하기/);
  }
});

test('legacy history recovers from retained full response and never overwrites the original', () => {
  const legacy = { ...parseBlogResponse(plain), rawResponse: undefined, blog: bold, instaTitle: '**', instaContent: '**\n기존 요약', videoScript: [] };
  const restored = restoreBlogResult(legacy, '기획한 주제');
  assert.equal(restored.instaTitle, '식사만 하면 답답해');
  assert.equal(restored.videoScript.length, 4);
  assert.equal(restored.blog, parseBlogResponse(plain).blog);
  assert.equal(legacy.instaTitle, '**');
  const partial = restoreBlogResult({ ...legacy, blog: '기존 본문' }, '기획한 주제');
  assert.equal(partial.instaTitle, '기획한 주제');
  assert.equal(partial.blog, '기존 본문');
  assert.equal(partial.instaContent, '기존 요약');
});

test('the actual blog generation service returns parsed fields and retains search sources', async () => {
  const calls = [];
  const service = load('src/services/blog/geminiService.ts', {
    '../../data/data1.md?raw': '', '../../data/data2.md?raw': '', '../../data/data3.md?raw': '',
    '../../utils/pipelineParsing': parsing,
    '../geminiClient': { getGeminiClient: () => ({ models: { generateContent: async request => {
      calls.push(request);
      return { text: bold, candidates: [{ groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.com', title: 'source' } }] } }] };
    } } }) }
  });
  const actual = await service.generateBlogPost('info', '기획한 주제', '한약', '식후');
  assert.equal(actual.instaTitle, '식사만 하면 답답해');
  assert.equal(actual.videoScript.length, 4);
  assert.deepEqual(actual.sources, [{ uri: 'https://example.com', title: 'source' }]);
  assert.ok(calls[0].config.tools[0].googleSearch);
});

test('scenario headings are fully consumed and cast survives formatting variations', () => {
  for (const text of [scenario, scenario.replace(/^### (.+)$/gm, '**$1**').replace('owonjang, deoki', 'O-wonjang and Deok-i'), scenario.replace(/\n/g, '\r\n')]) {
    const parsed = parseScenarioResponse(text, chars);
    assert.deepEqual(parsed.characters, ['owonjang', 'deoki']);
    assert.ok(parsed.imagePrompt.startsWith('- **Scene 1'));
    assert.ok(parsed.videoPrompt.startsWith('OUTPUT SPECS: 2s'));
    assert.doesNotMatch(parsed.imagePrompt, /Generation Prompts|OUTPUT SPECS/);
    assert.equal(canSaveScenario(parsed.imagePrompt, parsed.videoPrompt), true);
  }
  const incomplete = parseScenarioResponse('### 1. Image Generation Prompts\n', chars);
  assert.equal(canSaveScenario(incomplete.imagePrompt, incomplete.videoPrompt), false);
});

test('actual UI restores the broken draft, generates a scenario and saves prompts to the thumbnail step', async () => {
  const { JSDOM } = require('jsdom');
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = React;
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const previous = new Map(['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT'].map(k => [k, global[k]]));
  Object.assign(global, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
  dom.window.scrollTo = () => {};
  const context = load('src/context/PipelineContext.tsx');
  const saved = [], requests = [];
  let snapshot, answer = scenario;
  const history = [{ id: 'old', title: '별개 이전 시나리오', rawPlan: scenario, imagePrompt: 'old image', videoPrompt: 'old video', createdAt: 1 }];
  const common = { '../context/PipelineContext': context, '../utils/pipelineParsing': parsing, 'framer-motion': { motion: { div: 'div' }, AnimatePresence: React.Fragment } };
  const Blog = load('src/pages/BlogPost.tsx', {
    ...common, '../utils/blogHtml': { convertToBlogHtml: text => text }, 'react-markdown': () => null,
    '../services/blog/geminiService': {}, 'firebase/firestore': {}, '../firebase': { db: {} }
  }).default;
  const Scenario = load('src/pages/ScenarioPlanner.tsx', {
    ...common, '../hooks/useApiKey': { useApiKey: () => ({ hasApiKey: true }) },
    '../constants': { CHARACTERS: chars.map(c => ({ ...c, img: '/duck.png' })), SYSTEM_PROMPT: 'test instructions' },
    '../services/geminiClient': { getGeminiClient: () => ({ models: { generateContent: async params => { requests.push(params); return { text: answer }; } } }) },
    '../hooks/useScenarioHistory': { loadScenarioHistory: async () => history, saveScenarioHistory: async items => saved.push(items) }
  }).default;
  localStorage.setItem('content_history', JSON.stringify([{ id: 'draft', timestamp: 1, mode: 'treatment', topic: '기획한 주제', treatment: '한약', result: { ...parseBlogResponse(plain), rawResponse: undefined, blog: bold, instaTitle: '**', instaContent: '**\n요약', videoScript: [] } }]));
  function Harness() {
    snapshot = context.usePipeline();
    return React.createElement(React.Fragment, null,
      React.createElement('button', { onClick: () => snapshot.setActiveTab('scenario') }, '시나리오로 이동'),
      snapshot.activeTab === 'topic' ? React.createElement(Blog) : snapshot.activeTab === 'scenario' ? React.createElement(Scenario) : React.createElement('p', null, '썸네일 단계'));
  }
  const root = createRoot(document.getElementById('root'));
  const button = name => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === name);
  try {
    await act(async () => root.render(React.createElement(context.PipelineProvider, null, React.createElement(Harness))));
    await act(async () => button('히스토리').click());
    const draft = [...document.querySelectorAll('p')].find(p => p.textContent === '기획한 주제');
    await act(async () => draft.click());
    await act(async () => button('시나리오로 이동').click());
    assert.ok(document.body.textContent.includes('식사만 하면 답답해'));
    assert.equal(snapshot.sharedScript.length, 4);
    // Unrelated history must not enable saving an empty current scenario.
    assert.equal(button('저장').disabled, true);
    answer = '시나리오 형식 누락';
    await act(async () => button('생성').click());
    assert.ok(document.body.textContent.includes('프롬프트를 읽지 못했습니다'));
    assert.equal(saved.length, 0);
    assert.equal(button('저장').disabled, true);
    answer = scenario;
    await act(async () => button('생성').click());
    assert.equal(button('저장').disabled, false);
    assert.equal(saved.length, 1);
    assert.match(requests.at(-1).contents, /Title: 식사만 하면 답답해/);
    await act(async () => button('저장').click());
    assert.equal(snapshot.activeTab, 'thumbnail');
    assert.ok(snapshot.sharedImagePrompt.startsWith('- **Scene 1'));
    assert.ok(snapshot.sharedVideoPrompt.startsWith('OUTPUT SPECS'));
    assert.deepEqual(snapshot.sharedCharacters, ['owonjang', 'deoki']);
  } finally {
    await act(async () => root.unmount());
    for (const [key, value] of previous) value === undefined ? delete global[key] : global[key] = value;
    dom.window.close();
  }
});
