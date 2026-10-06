import type { FinalOutput } from '../../types/agent';

export type TopicMode = 'dyspepsia' | 'fatigue' | 'all';

export const DYSPEPSIA_CATEGORY = '만성 소화불량 집중';
export const FATIGUE_CATEGORY = '만성 피로 집중';

export function restoreTopicMode(saved: string | null): TopicMode {
  return saved === 'fatigue' || saved === 'all' ? saved : 'dyspepsia';
}

export function focusedDisease(mode: TopicMode): string | undefined {
  return mode === 'dyspepsia' ? '만성 소화불량' : mode === 'fatigue' ? '만성 피로' : undefined;
}

const categories = [
  '근골격계 및 통증 (목, 허리, 무릎, 관절염 등)',
  '내과 및 소화기 (소화불량, 과민성 대장 증후군, 위염 등)',
  '만성피로 및 보약 (경옥고, 공진단, 수험생 보약 등)',
  '여성질환 (갱년기, 월경불순, 다낭성 난소증후군, 난임, 생리통 등)',
  '피부질환 (여드름, 아토피, 다한증 등)',
  '다이어트 및 비만 관리',
  '교통사고 후유증 및 재활',
  '건강상식 (수면, 식습관, 스트레스 관리, 면역력 등)'
];

export function selectTopicCategory(mode: TopicMode, previousCategory?: string): string {
  if (mode === 'dyspepsia') return DYSPEPSIA_CATEGORY;
  if (mode === 'fatigue') return FATIGUE_CATEGORY;
  return previousCategory || categories[Math.floor(Math.random() * categories.length)];
}

export const DUPLICATE_POLICY = `같은 질환을 반복해서 다루는 것은 허용합니다. 중복 금지는 같은 환자 상황과 핵심 질문, 설명을 표현만 바꾸어 재사용하는 경우입니다. 직업·나이·커피 종류만 바꾸는 것은 새로운 기획이 아닙니다. 과거 글과 무엇을 다르게 답하는지 기획안에 명시하세요.`;

export const DYSPEPSIA_FOCUS = `[만성 소화불량 집중 기획]
- 질환은 '만성 소화불량'으로 고정합니다. 피부·여성·다이어트·피로·과민성 대장 증후군으로 주제를 바꾸지 마세요. 내시경 결과만으로 기능성 소화불량을 확진하지 마세요.
- 하루 체한 사람보다, 몇 달·몇 년째 식후 불편이 반복되어 식사량을 줄이거나 외식·업무를 피하는 사람을 다룹니다.
- 매번 다른 핵심 질문 하나에 답하세요. 예: 조금만 먹어도 배가 차 식사를 남김 / 식후 몇 시간씩 답답해 업무가 어려움 / 검사를 받고 약을 먹어도 불편이 반복됨 / 음식 제한이 늘어 외식이 부담됨 / 더부룩함과 화끈거림이 함께 있음 / 한약 치료를 시작할지, 무엇이 달라지면 효과로 볼지 고민함.
- 단순 증상·직업만 바꾸지 말고, 해당 질문에 필요한 진찰 내용, 한약 치료를 고려할 조건, 식사량·불편 지속시간·발생 빈도 등 확인할 변화를 구체적으로 다르게 설명하세요. 치료 효과·기간을 보장하거나 다른 치료를 무용하다고 단정하지 마세요.
- 한약을 주 치료로 검토하는 내용으로 기획하되, 특정 처방을 모든 환자의 정답으로 고정하지 마세요. 침을 먼저 소개하는 구성이나 지압 몇 초로 해결한다는 결론은 피하세요.
- 질환 메타데이터 disease는 반드시 '만성 소화불량'으로, situation은 환자의 생활 제약과 핵심 질문이 드러나는 한 문장으로 작성하세요.
- ${DUPLICATE_POLICY}`;

export const FATIGUE_FOCUS = `[만성 피로 집중 기획]
- 주제는 '만성 피로'로 고정합니다. 오래 반복되는 피로 때문에 업무·집안일·퇴근 후 생활에 지장이 있는 사람을 다룹니다. 한 번의 야근이나 일시적인 졸림을 과장하지 마세요.
- 소화불량 집중 기획과 분리합니다. 한 글의 주된 불편과 치료 목표는 피로로 유지하고, 식사·수면·배뇨는 필요한 경우 진찰에서 살필 동반 증상으로만 다루세요. 두 질환을 묶은 종합 홍보글을 만들지 마세요.
- 체력이 좋고 피로를 호소하지 않으면서 입면장애가 주된 사람은 이번 피로 홍보 대상에 넣지 마세요. 모든 불면을 피로로 바꾸거나, 반대로 피로와 수면 문제가 함께 있는 환자를 전부 제외하지 마세요.
- 매번 다른 핵심 질문 하나에 답하세요. 예: 쉬어도 다음 날 일을 시작하기 어려움 / 퇴근하면 집안일을 미루고 누워 지냄 / 주말을 회복에 쓰느라 약속을 포기함 / 영양제를 먹으며 버텨도 일상에 지장이 지속됨 / 한약 치료 후 피로가 줄었는지 무엇으로 확인할지 고민함.
- 해당 질문에 필요한 진찰 내용과 한약 치료를 검토할 조건, 피로 때문에 쉬는 시간·해낼 수 있는 일상 활동·피로의 빈도 등 확인할 변화를 구체적으로 설명하세요. 생활의 제약이 줄어드는 것이 치료 목표이며 회복 정도나 기간을 보장하지 마세요.
- 맞춤 한약 상담을 중심으로 기획합니다. 경옥고·공진단 소개나 지압 몇 초로 해결한다는 결론으로 대체하지 마세요. 특정 처방·합방을 모든 피로 환자에게 고정하거나, 배뇨 이상만으로 병기나 처방을 확정하지 마세요.
- '만성 피로'를 '만성피로증후군(ME/CFS)'의 확진명으로 바꾸지 마세요. 증상과 기존 검사·치료를 검토하는 진료 과정을 설명하고 확인되지 않은 병리·효과를 만들지 마세요.
- 질환 메타데이터 disease는 반드시 '만성 피로'로, situation은 환자의 생활 제약과 핵심 질문이 드러나는 한 문장으로 작성하세요.
- ${DUPLICATE_POLICY}`;

export function topicInstructions(mode: TopicMode): string {
  return mode === 'dyspepsia' ? DYSPEPSIA_FOCUS : mode === 'fatigue' ? FATIGUE_FOCUS : DUPLICATE_POLICY;
}

type TopicPlan = { score?: number; disease?: string; situation?: string };

const normalize = (value: string) => value.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();

function diseaseKey(value: string): string {
  const key = normalize(value);
  if (['피로', '만성피로', '지속성피로'].includes(key)) return '만성피로';
  return ['소화불량', '만성소화불량', '기능성소화불량', '기능성소화불량증', '만성기능성소화불량'].includes(key)
    ? '소화불량' : key;
}

export function isDuplicatePlan(plan: TopicPlan, history: TopicPlan[]): boolean {
  if (!(plan.score >= 90 && plan.disease?.trim() && plan.situation?.trim())) return false;
  return history.some(item => item.disease && item.situation &&
    diseaseKey(item.disease) === diseaseKey(plan.disease!) &&
    normalize(item.situation) === normalize(plan.situation!));
}

export function isWithinTopicFocus(plan: TopicPlan, mode: TopicMode): boolean {
  const disease = focusedDisease(mode);
  return !disease || (typeof plan.disease === 'string' && diseaseKey(plan.disease) === diseaseKey(disease));
}

export function buildBlogTreatmentBrief(result: Pick<FinalOutput, 'finalTopic' | 'finalTreatment' | 'treatments'>): string {
  return [
    result.finalTopic,
    result.finalTreatment && `기획에서 정한 치료 방향:\n${result.finalTreatment}`,
    result.treatments?.length && `치료법: ${result.treatments.join(', ')}`
  ].filter(Boolean).join('\n\n');
}
