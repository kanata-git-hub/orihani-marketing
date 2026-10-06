const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function load(relativePath, imports = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const code = transformSync(source, { loader: 'ts', format: 'cjs', target: 'node22' }).code;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, console,
    require(name) {
      if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
      return imports[name];
    }, ...globals
  });
  return module.exports;
}

const policy = load('src/services/topic/topicPolicy.ts');
const plan = (situation = '조금만 먹어도 배가 차 식사를 남긴다') => ({
  score: 95, content: '승인 기획', finalTopic: '반 공기도 못 먹는 오래된 소화불량',
  finalTreatment: '한약 치료를 검토하고 식사량과 식후 답답함의 지속시간을 확인한다.',
  disease: '만성 소화불량', situation, treatments: ['한약', '침']
});

const fatiguePlan = (situation = '퇴근 후 피로 때문에 집안일을 미룬다') => ({
  ...plan(situation), disease: '만성 피로', finalTopic: '퇴근 후 생활을 포기할 만큼 피곤할 때',
  finalTreatment: '맞춤 한약 상담에서 피로의 경과를 살피고 일상 활동의 변화를 확인한다.'
});

function pipeline(reviewers, history = []) {
  const calls = [];
  let round = 0;
  const prompts = Object.fromEntries(['CRAWLER', 'JSON_PROCESSOR', 'PLANNER', 'REVIEWER']
    .map(stage => [`TOPIC_${stage}_PROMPT`, stage]));
  const app = load('src/services/topic/multiAgent.ts', {
    'firebase/firestore': {
      collection: () => null, query: () => null, where: () => null,
      getDocs: async () => ({ empty: !history.length, docs: history.map(item => ({ data: () => item })) })
    },
    '../../firebase': { db: {} },
    '../core/agentRunner': { callAgent: async (system, input) => {
      calls.push({ system, input });
      if (system !== 'REVIEWER') return `${system} result`;
      const result = reviewers[Math.min(round++, reviewers.length - 1)];
      return typeof result === 'string' ? result : JSON.stringify(result);
    } },
    './topicPolicy': policy,
    '../../config/pipelinePrompts': prompts
  }, {
    setTimeout: callback => callback(),
    fetch: async () => ({ ok: true, json: async () => ({ datetime: '2026-10-07T09:00:00+09:00' }) })
  });
  return { run: (...args) => app.runMultiAgentSystem(() => {}, ...args), calls };
}

test('focus stays on dyspepsia; broad mode retains the previous category', () => {
  assert.equal(policy.selectTopicCategory('dyspepsia', '피부질환'), '만성 소화불량 집중');
  assert.equal(policy.selectTopicCategory('all', '피부질환'), '피부질환');
  assert.equal(policy.isWithinTopicFocus({ disease: '위염' }, 'dyspepsia'), false);
});

test('same disease with a different patient question is allowed', () => {
  assert.equal(policy.isDuplicatePlan(plan('식후 답답함이 몇 시간씩 지속된다'), [plan()]), false);
});

test('disease aliases, spacing and punctuation cannot bypass duplicate protection', () => {
  assert.equal(policy.isDuplicatePlan(plan(), [{
    disease: '기능성 소화불량증', situation: '조금만 먹어도 배가 차, 식사를 남긴다.'
  }]), true);
});

test('treatment names do not discard the approved clinical rationale', () => {
  const brief = policy.buildBlogTreatmentBrief(plan());
  assert.ok(brief.includes(plan().finalTreatment));
  assert.ok(brief.includes('한약, 침'));
  assert.equal(policy.buildBlogTreatmentBrief({ finalTopic: '기존 글', treatments: ['한약'] }), '기존 글\n\n치료법: 한약');
});

test('an existing dyspepsia post permits a new angle and passes history to the reviewer', async () => {
  const app = pipeline([plan('외식 때 먹을 수 있는 음식이 줄었다')], [plan()]);
  const result = await app.run();
  assert.equal(result.disease, '만성 소화불량');
  assert.equal(result.topicMode, 'dyspepsia');
  assert.ok(app.calls.find(call => call.system === 'REVIEWER').input.includes(plan().situation));
});

test('a duplicate retries within dyspepsia and retains the treatment explanation', async () => {
  const app = pipeline([plan(), plan('식후 불편 때문에 오후 일을 못 한다')], [plan()]);
  const result = await app.run();
  assert.equal(result.situation, '식후 불편 때문에 오후 일을 못 한다');
  assert.equal(app.calls.length, 8);
  assert.ok(app.calls[4].input.includes('현재 질환을 유지'));
  assert.equal(result.finalTreatment, plan().finalTreatment);
});

test('malformed output and unrelated disease are retried, not auto-approved', async () => {
  const app = pipeline(['not JSON', { ...plan(), disease: '만성 피로' }, plan()]);
  const result = await app.run();
  assert.equal(result.disease, '만성 소화불량');
  assert.equal(app.calls.length, 12);
});

test('exhausted duplicate retries fail instead of returning the duplicate as approved', async () => {
  const app = pipeline([plan()], [plan()]);
  await assert.rejects(app.run(), /기존 글과 다른 기획/);
  assert.equal(app.calls.filter(call => call.system === 'REVIEWER').length, 6);
});

test('exhausted low-score or malformed reviews do not yield an approved plan', async () => {
  await assert.rejects(pipeline([{ ...plan(), score: 60 }]).run(), /검수를 통과하지/);
  await assert.rejects(pipeline(['invalid JSON']).run(), /기획 결과를 확인할 수 없습니다/);
});

test('fatigue mode persists and remains distinct from dyspepsia, insomnia and ME/CFS', () => {
  assert.equal(policy.restoreTopicMode('fatigue'), 'fatigue');
  assert.equal(policy.restoreTopicMode(null), 'dyspepsia');
  assert.equal(policy.selectTopicCategory('fatigue', '만성 소화불량 집중'), '만성 피로 집중');
  for (const disease of ['만성 소화불량', '입면장애', '만성피로증후군']) {
    assert.equal(policy.isWithinTopicFocus({ disease }, 'fatigue'), false);
  }
  assert.equal(policy.isWithinTopicFocus({ disease: '만성피로' }, 'fatigue'), true);
});

test('fatigue retries an insomnia topic without switching to the dyspepsia campaign', async () => {
  const app = pipeline([{ ...fatiguePlan(), disease: '입면장애' }, fatiguePlan()]);
  const result = await app.run(undefined, '만성 소화불량 집중', 'fatigue');
  assert.equal(result.disease, '만성 피로');
  assert.equal(result.category, '만성 피로 집중');
  assert.equal(result.topicMode, 'fatigue');
  assert.equal(app.calls.length, 8);
});

test('fatigue allows new questions but retries an existing fatigue angle', async () => {
  const old = { ...fatiguePlan(), disease: '만성피로' };
  const next = fatiguePlan('주말마다 쉬기만 하느라 약속을 포기한다');
  const app = pipeline([fatiguePlan(), next], [old]);
  const result = await app.run(undefined, undefined, 'fatigue');
  assert.equal(result.situation, next.situation);
  assert.equal(result.disease, '만성 피로');
  assert.equal(app.calls.length, 8);
});
