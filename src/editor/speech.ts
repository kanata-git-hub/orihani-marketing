export type Word = { text: string; start: number; end: number };
export type VoiceSegment = { sourceStart: number; sourceEnd: number; start: number };

function sino(value: string): string {
  const digits = '영일이삼사오육칠팔구';
  if (/^0\d/.test(value)) return [...value].map(x => digits[+x]).join(' ');
  const n = Number(value); if (!n) return '영';
  if (!Number.isSafeInteger(n) || n >= 1e16) return [...value].map(x => digits[+x]).join(' ');
  const parts: string[] = []; let left = n;
  for (const big of ['', '만', '억', '조']) {
    let small = left % 10000, text = ''; left = Math.floor(left / 10000);
    for (const unit of ['', '십', '백', '천']) { const digit = small % 10; small = Math.floor(small / 10); if (digit) text = (digit === 1 && unit ? '' : digits[digit]) + unit + text; }
    if (text) parts.unshift(text + big); if (!left) break;
  }
  return parts.join(' ');
}
function native(n: number) {
  if (n < 1 || n >= 100) return sino(String(n));
  return ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'][Math.floor(n / 10)] + ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'][n % 10];
}
export function spokenNumbers(input: string): string {
  let text = input.replace(/\b\d{1,3}(?:,\d{3})+\b/g, n => n.replace(/,/g, ''));
  // Decimals must be read before counters so 1.5개 never becomes 일.다섯 개.
  text = text.replace(/(\d+\.\d+)(?:\s*(%|퍼센트|시간|개월|마리|명|개|살|시|번|잔|초|분|원|년|kg|km|cm|mm|m|도|층|회))?/g, (_, n, unit) => n.split('.').map((v:string,i:number) => i ? [...v].map(d => '영일이삼사오육칠팔구'[+d]).join(' ') : sino(v)).join(' 점 ') + (unit ? ' ' + ({'%':'퍼센트',kg:'킬로그램',km:'킬로미터',cm:'센티미터',mm:'밀리미터',m:'미터'}[unit] || unit) : ''));
  text = text.replace(/(\d{1,2}):(\d{2})(?::(\d{2}))?/g, (_, h, m, s) => `${native(+h)} 시${+m ? ' ' + sino(m.replace(/^0+/, '') || '0') + ' 분' : ''}${s && +s ? ' ' + sino(s.replace(/^0+/, '') || '0') + ' 초' : ''}`);
  text = text.replace(/(\d+)\s*(시간|명|개(?!월)|마리|살|시|번|잔)/g, (_, n, unit) => `${+n === 20 ? '스무' : native(+n)} ${unit}`);
  text = text.replace(/(\d+(?:\.\d+)?)\s*(%|퍼센트|초|분|원|년|개월|kg|km|cm|mm|m|도|층|회)/g, (_, n, unit) => `${n.split('.').map((v: string,i: number) => i ? [...v].map(d => '영일이삼사오육칠팔구'[+d]).join(' ') : sino(v)).join(' 점 ')} ${{'%':'퍼센트',kg:'킬로그램',km:'킬로미터',cm:'센티미터',mm:'밀리미터',m:'미터'}[unit] || unit}`);
  return text.replace(/\d+(?:\.\d+)?/g, n => n.split('.').map((v,i) => i ? [...v].map(d => '영일이삼사오육칠팔구'[+d]).join(' ') : sino(v)).join(' 점 '));
}
export const normalizeSpeech = (s: string) => spokenNumbers(s).replace(/[^가-힣a-z]/gi, '').toLowerCase();
export function parseWords(result: any): Word[] {
  const seconds = (x: unknown) => typeof x === 'number' ? x : typeof x === 'string' && /^\d+(?:\.\d+)?s?$/.test(x) ? parseFloat(x) : NaN;
  const words: Word[] = [];
  for (const step of result?.steps || []) if (step.type === 'model_output') for (const content of step.content || []) for (const a of content.annotations || []) if (a.type === 'word_info') {
    const start = seconds(a.start_offset), end = seconds(a.end_offset);
    if (typeof a.text !== 'string' || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > 60) throw Error('음성 분석의 시간 정보가 올바르지 않습니다.');
    words.push({ text: a.text, start, end });
  }
  return words.sort((a,b) => a.start-b.start);
}

// Character-level monotonic alignment tolerates Korean spacing differences.
// Never claim a reliable match when the source caption is a paraphrase.
export function alignCaptions<T extends {text:string;start:number;end:number}>(captions: T[], words: Word[]): (T & {review?:string})[] {
  const target = captions.map(c => normalizeSpeech(c.text));
  const observed = words.flatMap((w,i) => [...normalizeSpeech(w.text)].map(ch => ({ch,i})));
  const expected = target.join('');
  if (expected.length > 5000 || observed.length > 5000) throw Error('정렬할 대본이 너무 깁니다.');
  const cols=observed.length+1, matrix=new Uint16Array((expected.length+1)*cols);
  for(let i=1;i<=expected.length;i++) for(let j=1;j<cols;j++) matrix[i*cols+j]=expected[i-1]===observed[j-1].ch?matrix[(i-1)*cols+j-1]+1:Math.max(matrix[(i-1)*cols+j],matrix[i*cols+j-1]);
  const matches=new Map<number,number>();let i=expected.length,j=observed.length;
  while(i&&j){if(expected[i-1]===observed[j-1].ch){matches.set(--i,observed[--j].i);}else if(matrix[(i-1)*cols+j]>=matrix[i*cols+j-1])i--;else j--;}
  let offset=0,previous=-1;
  return captions.map((c,index)=>{
    const text=target[index], ids=[...text].map((_,n)=>matches.get(offset+n)).filter((x):x is number=>x!==undefined);offset+=text.length;
    if(!text.length||ids.length/text.length<0.85||!ids.length) return {...c,review:'발화와 문장이 충분히 일치하지 않습니다. 시간을 확인해주세요.'};
    const start=words[ids[0]].start,end=words[ids.at(-1)!].end;
    if(start<previous) return {...c,review:'다른 자막과 시간이 겹칩니다. 문장 분할을 확인해주세요.'};
    previous=end; return {...c,start,end,review:undefined};
  });
}

export function speechRanges(words: Word[], duration: number): {start:number;end:number}[] {
  const result:{start:number;end:number}[]=[];
  for(const w of [...words].sort((a,b)=>a.start-b.start)) {
    const range={start:Math.max(0,w.start-0.04),end:Math.min(duration,w.end+0.04)};
    if(range.end<=range.start)continue;
    const last=result.at(-1);
    if(last&&range.start-last.end<=0.3)last.end=Math.max(last.end,range.end);
    else result.push(range);
  }
  return result;
}
export function scheduleNarration(words: Word[], duration: number, dialogue: {start:number;end:number}[], speed: number, audioDuration?: number): VoiceSegment[] {
  if(!words.length)return [];
  if(!dialogue.length&&audioDuration!==undefined) {
    if(!Number.isFinite(audioDuration)||audioDuration<=0||audioDuration/speed>duration+0.05)throw Error('해설 음성이 영상보다 깁니다. 해설을 줄이거나 음성 속도를 높여주세요.');
    return [{sourceStart:0,sourceEnd:audioDuration,start:0}];
  }
  const spans=dialogue.slice().sort((a,b)=>a.start-b.start), slots:{start:number;end:number}[]=[];let cursor=0;
  for(const d of spans){if(d.start>cursor)slots.push({start:cursor,end:Math.max(cursor,d.start-0.08)});cursor=Math.max(cursor,d.end+0.08);}
  if(cursor<duration)slots.push({start:cursor,end:duration});
  const result:VoiceSegment[]=[];let index=0;
  for(const slot of slots){if(index>=words.length)break;const first=index,sourceStart=Math.max(0,words[index].start-0.03);while(index<words.length&&(words[index].end-sourceStart+0.03)/speed<=slot.end-slot.start)index++;
    if(index>first)result.push({sourceStart,sourceEnd:words[index-1].end+0.03,start:slot.start});
  }
  if(index<words.length)throw Error('등장인물 대사를 피해서 해설을 넣을 시간이 부족합니다. 해설을 줄이거나 음성 속도를 높여주세요.');
  return result;
}
export function placedWords(words:Word[],segments:VoiceSegment[],speed:number):Word[]{return words.map(w=>{const s=segments.find(s=>w.start>=s.sourceStart-0.001&&w.end<=s.sourceEnd+0.001);if(!s)throw Error('해설 시간 연결을 확인해주세요.');return {...w,start:s.start+(w.start-s.sourceStart)/speed,end:s.start+(w.end-s.sourceStart)/speed};});}
