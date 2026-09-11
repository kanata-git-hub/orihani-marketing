import { importEpisode, type EditPlan } from './model';
import type { ScenarioHistoryItem } from '../hooks/useScenarioHistory';

export type MarketingSource = { id: string; title: string; rawPlan: string; videoPrompt: string; narration: string; thumbnail: string; tags: string; comment: string; plan: EditPlan };
const clean = (s: string) => s.replace(/\*\*|__/g, '').trim();
export function koreanOnly(value: string) {
  return clean(value).split(/\s*\/\s*(?=["“'\[]*[A-Za-z])/)[0].replace(/^["“']|["”']$/g, '').trim();
}
// Only explicit scenario metadata becomes speech, never blog paragraphs or video directions.
export function marketingSource(item: ScenarioHistoryItem): MarketingSource {
  const raw = clean(item.rawPlan || '');
  const field = (label: string) => {
    const m = raw.match(new RegExp('(?:^|\\n)[^\\n]*?' + label + '[ \\t]*[:：][ \\t]*([^\\n]*)', 'i'));
    return m ? m[1].trim() : '';
  };
  const title = koreanOnly(field('(?:🎬\\s*)?제목')) || item.title;
  const thumbnail = koreanOnly(field('썸네일\\s*텍스트'));
  const ttsMatch = raw.match(/(?:^|\n)[^\n]*?(?:나레이션|내레이션)\s*(?:\(TTS\))?[ \t]*[:：][ \t]*([^\n]*(?:\n(?!(?:[ \t]*(?:[-*]\s*)?(?:[🎬🖼📱💬🏷#]|장면|자막|화면|Dialog|오원장|소미|덕이)))[^\n]+)*)/i);
  const tts = ttsMatch ? ttsMatch[1].trim() : '';
  const narration = koreanOnly(tts);
  const noNarration = /^(?:없음|없습니다|사용 안 함|none)(?:[.!\s]*(?:\(|$))/i.test(narration);
  const captions: {text: string; start: number; end: number}[] = [];
  for (const m of raw.matchAll(/(?:^|\n)[^\n]*?장면\s*([12])\s*\([^\n)]*\)\s*[:：]\s*([^\n]+)/g)) {
    const n = Number(m[1]);
    if (captions.some(c => c.start === (n === 1 ? 0 : 2))) continue;
    captions.push({text: koreanOnly(m[2]), start: n === 1 ? 0 : 2, end: n === 1 ? 2 : 5});
  }
  const plan = importEpisode({ duration: 5, title, thumbnail,
    korean: '나레이션: ' + (noNarration ? '없음' : narration), scenario: item.videoPrompt });
  // Scene captions describe a visual gag and may differ from the spoken narration.
  plan.captions = [...captions.map(c => ({...c, source: 'screen' as const})), ...plan.captions];
  if (!tts) plan.importWarning = '이 시나리오에서 해설 대본을 찾지 못했습니다. 읽을 대본을 넣거나 해설 없는 영상인지 확인해주세요.';
  const commentMatch = raw.match(/고정\s*댓글\s*[:：]\s*([\s\S]*?)(?=\n[^\n]*(?:해시태그|###|Image Generation)|$)/i);
  return {id: item.id, title, rawPlan: item.rawPlan || '', videoPrompt: item.videoPrompt || '', narration: noNarration ? '' : narration,
    thumbnail, tags: field('해시태그(?:\\s*5개)?'), comment: commentMatch ? clean(commentMatch[1]) : '', plan};
}
