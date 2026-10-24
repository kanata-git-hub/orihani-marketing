import { mentionsNooni, NOONI_VISUAL } from './nooni';
export interface CharacterReference {
  url: string;
  label?: string;
  role?: 'character' | 'scene';
}

export const MAX_REFERENCE_IMAGES = 14;

export function characterIdsInText(text: string): string[] {
  const normalized = text.normalize('NFC').replace(/[‐‑‒–—]/g, '-');
  const aliases = {
    owonjang: /오\s*원장|\b(?:o[-\s]?wonjang|dr\.?\s*o|doctor\s+o)\b/i,
    somi: /소미|간호사|\b(?:somi|nurse)\b/i,
    deoki: /덕이|\bdeok[-\s]?i\b/i,
  };
  const ids = Object.entries(aliases).filter(([,pattern]) => pattern.test(normalized)).map(([id]) => id);
  if (mentionsNooni(normalized)) ids.push('nooni');
  return ids;
}

export function characterReferencePolicy(labels: string[] = ['owonjang', 'somi', 'deoki', 'nooni']) {
  const names = labels.join(' ').toLowerCase();
  const colors = [
    mentionsNooni(labels.join(' ')) && NOONI_VISUAL,
    /오원장|o[- ]?wonjang/.test(names) && 'O-wonjang: pale warm cream arm/wing tips matching his head in the ORIGINAL sheets; never saturated yellow or orange hands.',
    /소미|간호사|somi|nurse/.test(names) && 'Somi: pale cream arms/wing tips matching her ORIGINAL sheets; never borrow Deok-i\'s yellow hands.',
    /덕이|deok[- ]?i/.test(names) && 'Deok-i: keep his own ORIGINAL yellow arms/wing tips; do not recolor him cream.',
  ].filter(Boolean).join('\n');
  return `[ORIGINAL CHARACTER DESIGN — HIGHEST VISUAL PRIORITY]
Draw only the characters required by this scene. The ORIGINAL front/side/back character sheets control the ENTIRE design: face, glasses, silhouette, costume, exact colors and limb surface.
Keep the duck mascots' arms as simple smooth rounded/tapered single-piece wing tips, exactly as in their own sheets. No added fingers, thumbs, knuckles, nails, feather grooves, layered feathers or fuzzy plumage. Preserve the original subtle surface texture. These single-piece duck-wing restrictions apply to O-wonjang, Somi and Deok-i only. For Nooni, preserve the sculpted wing layers, markings and long tail in the original sheets.
${colors}
For holding or pressing a prop, bend the existing rounded wing tip or brace the object between the tips; adapt the pose rather than inventing fingers. This rule overrides conflicting action descriptions and examples.
Previous generated scenes are for background, lighting and prop continuity ONLY. Correct their accidental anatomy/color changes using the ORIGINAL character sheets, even if the scene text requests identical appearance. Never transfer one character's colors to another.
Carry these identity rules into each image/video prompt. Before output, check both visible wing tips against that character's original sheets.`;
}

export function referenceData(url: string) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/]+={0,2})$/i.exec(url);
  if (!match) throw Error('캐릭터 참조 사진을 읽지 못했습니다. 사진을 다시 불러와주세요.');
  return { mimeType: match[1], data: match[2] };
}

export async function loadReferenceImage(url: string): Promise<string> {
  if (url.startsWith('data:')) { referenceData(url); return url; }
  const response = await fetch(url);
  if (!response.ok) throw Error('캐릭터 원본 사진을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
  const blob = await response.blob();
  if (!blob.size || !blob.type.startsWith('image/')) throw Error('캐릭터 원본 파일이 올바른 사진이 아닙니다. 생성을 중단했습니다.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:${blob.type};base64,${btoa(binary)}`;
}

export function buildReferenceParts(references: (CharacterReference | string)[], prompt: string) {
  if (references.length > MAX_REFERENCE_IMAGES) throw Error('참조 사진은 이전 장면을 포함해 14장까지 사용할 수 있습니다.');
  const originals = references.map(ref => typeof ref === 'string' ? {url: ref} : ref).filter(ref => ref.role !== 'scene');
  if (references.length && !originals.length) throw Error('이전 장면만으로 생성할 수 없습니다. 캐릭터 원본 사진을 먼저 불러와주세요.');
  const parts: any[] = [];
  for (const [i, refItem] of references.entries()) {
    const ref = typeof refItem === 'string' ? {url: refItem} : refItem;
    parts.push({text: ref.role === 'scene'
      ? '[PREVIOUS GENERATED SCENE: background/lighting/props only. NOT a character design reference.]'
      : `[ORIGINAL CHARACTER DESIGN SHEET: ${ref.label || `reference ${i + 1}`}. Highest priority for identity, limb shape and colors.]`});
    parts.push({inlineData: referenceData(ref.url)});
  }
  parts.push({text: originals.length ? `${prompt}\n\n${characterReferencePolicy(originals.map(ref => ref.label || ''))}` : prompt});
  return parts;
}
