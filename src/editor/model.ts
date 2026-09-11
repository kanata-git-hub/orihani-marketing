import type { VoiceSegment } from './speech';
export type Caption = { start: number; end: number; text: string; source?: 'narration' | 'dialogue' | 'screen'; review?: string };
export type EditPlan = { duration: 5; title: string; narration: string; thumbnail: string; captions: Caption[]; originalVolume: number; voiceVolume: number; voiceSpeed: number; voiceSegments?: VoiceSegment[]; dialogueRanges?: {start:number;end:number}[]; importWarning?: string };
export const defaultPlan = (): EditPlan => ({ duration: 5, title: '', narration: '', thumbnail: '', captions: [], originalVolume: 0.2, voiceVolume: 1, voiceSpeed: 1 });
export function validatePlan(p: EditPlan) {
  if (!p || p.duration !== 5) throw Error('영상 길이를 확인해주세요.');
  if (typeof p.thumbnail !== 'string' || p.thumbnail.length > 100 || typeof p.title !== 'string' || p.title.length > 300) throw Error('제목 문구가 너무 깁니다.');
  if (!Array.isArray(p.captions) || p.captions.length > 30) throw Error('자막은 30개까지 가능합니다.');
  let last = 0;
  for (const c of p.captions) {
    if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < last || c.end <= c.start || c.end > p.duration || typeof c.text !== 'string' || !c.text.trim() || c.text.length > 160) throw Error('자막의 시작·끝 시간과 문구를 확인해주세요. 자막 시간은 겹칠 수 없습니다.');
    last = c.end;
  }
  for (const k of ['originalVolume', 'voiceVolume'] as const) if (!Number.isFinite(p[k]) || p[k] < 0 || p[k] > 1) throw Error('음량은 0~100%로 설정해주세요.');
  if (!Number.isFinite(p.voiceSpeed) || p.voiceSpeed < 0.8 || p.voiceSpeed > 1.25) throw Error('음성 속도는 0.8~1.25배로 설정해주세요.');
  if(typeof p.narration!=='string'||p.narration.length>1200)throw Error('해설 대본은 1,200자까지 가능합니다.');
  if((p.voiceSegments!==undefined&&!Array.isArray(p.voiceSegments))||(p.dialogueRanges!==undefined&&!Array.isArray(p.dialogueRanges)))throw Error('음성 구간 형식을 확인해주세요.');
  for(const s of p.voiceSegments || []) if(!Number.isFinite(s.sourceStart)||!Number.isFinite(s.sourceEnd)||!Number.isFinite(s.start)||s.sourceStart<0||s.sourceEnd<=s.sourceStart||s.sourceEnd>60||s.start<0||s.start+(s.sourceEnd-s.sourceStart)/p.voiceSpeed>p.duration+0.05) throw Error('해설 배치 시간을 확인해주세요.');
  if((p.voiceSegments?.length||0)>60||(p.dialogueRanges?.length||0)>100)throw Error('음성 구간이 너무 많습니다.');
  for(const s of p.dialogueRanges||[])if(!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end<=s.start||s.end>p.duration+0.05)throw Error('대사 시간을 확인해주세요.');
  let sourceEnd=0,timelineEnd=0;
  for(const s of p.voiceSegments||[]) {
    const end=s.start+(s.sourceEnd-s.sourceStart)/p.voiceSpeed;
    if(s.sourceStart<sourceEnd-0.001||s.start<timelineEnd-0.001||(p.dialogueRanges||[]).some(r=>s.start<r.end-0.001&&end>r.start+0.001))throw Error('해설이 다른 해설 또는 등장인물 대사와 겹칩니다. 자동 싱크를 다시 확인해주세요.');
    sourceEnd=s.sourceEnd;timelineEnd=end;
  }
}
// Read explicit narration sections only; character dialogue never becomes TTS input.
export function importEpisode(e: any): EditPlan {
  if (!e || e.duration !== 5 || typeof e.korean !== 'string' || e.korean.length > 20000) throw Error('에피소드 자료의 형식을 확인해주세요.');
  const p=defaultPlan();p.duration=e.duration;p.title=String(e.title||'').slice(0,300);
  const lines=e.korean.split('\n').map((s:string)=>s.replace(/\*\*|__/g,'').replace(/^[\s*#-]+/,'').trim()).filter(Boolean);
  const narration:string[]=[], pending:{text:string;start?:number;end?:number;source?:Caption['source']}[]=[], dialogue:string[]=[];
  let mode:''|'narration'|'caption'|'dialogue'|'screen'='', uncertain=false, noNarration=false;
  const unquote=(text:string)=>text.replace(/^["“']|["”']$/g,'').trim();
  const timing=(text:string)=>text.match(/^\[?\s*(\d+(?:\.\d+)?)\s*(?:초|s(?:ec(?:onds?)?)?)?\s*[~～–—-]\s*(\d+(?:\.\d+)?)\s*(?:초|s(?:ec(?:onds?)?)?)?\s*\]?\s*[:：]?\s*(.*)$/i);
  for(const line of lines) {
    let text=line, time=timing(text);if(time)text=time[3];
    const label=text.match(/^\[?((?:한글\s*)?(?:나레이션|내레이션|해설)|화면\s*자막|자막|화면\s*문구|대사|Dialog(?:ue)?|오원장|소미|덕이)\]?\s*(?:[:：]\s*|$)(.*)$/i);
    if(label) {
      mode=/나레이션|내레이션|해설/.test(label[1])?'narration':/문구/.test(label[1])?'screen':/자막/.test(label[1])?'caption':'dialogue';
      text=label[2];if(!time){time=timing(text);if(time)text=time[3];}
    }
    // Unknown speaker/section labels end the preceding narration block.
    if(!label&&/^[^:：]{1,25}[:：]/.test(text)){if(mode==='narration')uncertain=true;mode='';}
    if(!text.trim())continue;
    if(mode==='narration') {
      if(/^[([（]?\s*(?:없음|없습니다|해당 없음|사용 안 함|none)(?:\s*[)）\]]|\s*\(|\s*$)/i.test(text)){noNarration=true;mode='';continue;}
      if(/(?:Dialog(?:ue)?|오원장|소미|덕이)\s*[:：]/i.test(text)){uncertain=true;mode='';continue;}
      narration.push(unquote(text));if(label)mode='';continue;
    }
    if(mode==='dialogue')text=text.replace(/^[^:"“']{1,30}\s*[:：]\s*(?=["“'])/,'');
    if(time||mode==='caption'||mode==='dialogue'||mode==='screen')pending.push({text:unquote(text),...(time?{start:Number(time[1]),end:Number(time[2])}:{}),source:mode==='dialogue'?'dialogue':mode==='screen'?'screen':undefined});
    if(label)mode='';
  }
  p.narration=narration.join(' ');
  const bounds=[0,2,5];
  p.captions=pending.map((c,i)=>({text:c.text,source:c.source||(p.narration?'narration':'dialogue'),start:c.start??(pending.length===bounds.length-1?bounds[i]:0),end:c.end??(pending.length===bounds.length-1?bounds[i+1]:p.duration),...(!c.start&&!c.end&&pending.length!==bounds.length-1?{review:'발화 시간을 자동으로 찾습니다.'}:{})}));
  const scenario=String(e.scenario||'');
  for(const m of scenario.matchAll(/(?:Dialog(?:ue)?\s*[:：]\s*[^:"“'\n]{1,30}|오원장|소미|덕이)\s*[:：]\s*["“']([^"”'\n]+)["”']/gi))dialogue.push(m[1]);
  const comparison=(text:string)=>text.replace(/[^가-힣a-z0-9]/gi,'').toLowerCase();
  for(const text of dialogue)if(!p.captions.some(c=>comparison(c.text)===comparison(text)))p.captions.push({text,start:0,end:p.duration,source:'dialogue',review:'원본 영상에서 대사 시간을 자동으로 찾습니다.'});
  p.thumbnail=String(e.thumbnail||'').split('\n').filter(s=>/[가-힣]/.test(s)).map(s=>s.replace(/^[\s*#-]+/,'').replace(/\*\*/g,'')).join('\n').slice(0,100);
  if(uncertain||(!p.narration&&!noNarration&&lines.some((s:string)=>/나레이션|내레이션|해설/.test(s))))p.importWarning='해설 표기를 확실히 구분하지 못한 부분이 있습니다. 읽을 대본에는 해설만 있는지 확인해주세요.';
  return p;
}
