import { useEffect, useRef, useState } from 'react';
import { auth } from '../firebase';
import { defaultPlan, EditPlan, importEpisode, validatePlan } from './model';
import { editorStore, draftWriter } from './storage';
import { spokenNumbers, alignCaptions, scheduleNarration, placedWords, speechRanges, Word } from './speech';
import { clipLengths, validateMediaSizes, validateMediaDuration, mediaDuration } from './media';
import './editor.css';
import { shareFile } from './share';
import { loadScenarioHistory } from '../hooks/useScenarioHistory';
import { marketingSource, type MarketingSource } from './source';
import { LegacyVideos } from './LegacyVideos';

type Draft = { source?: MarketingSource; id: string; plan: EditPlan; original: string; voice: string; style: string; voiceBlob?: Blob; voiceKey?: string; videos: (File | null)[]; result?: Blob; resultKey?: string; syncKey?: string };
const fresh = (): Draft => ({ id: crypto.randomUUID(), plan: defaultPlan(), original: '', voice: 'Zubenelgenubi', style: '털털하고 편안한 남성 말투. 과장하지 않고 짧은 농담을 담백하게 말한다.', videos: [] });
const voiceKey = (d: Draft) => JSON.stringify([spokenNumbers(d.plan.narration), d.voice, d.style, d.plan.duration]);
const syncKey = (d: Draft) => JSON.stringify([2,voiceKey(d),d.plan.voiceSpeed,d.plan.captions.map(c=>[c.text,c.source]),d.videos.map(f=>f&&[f.name,f.size,f.lastModified])]);
const resultKey = (d: Draft) => JSON.stringify([2,d.plan, d.voiceKey, d.videos.map(f => f && [f.name, f.size, f.lastModified])]);
function useURL(blob?: Blob) {
  const [url, setURL] = useState('');
  useEffect(() => { if (!blob) { setURL(''); return; } const value = URL.createObjectURL(blob); setURL(value); return () => URL.revokeObjectURL(value); }, [blob]); return url;
}
async function request(url: string, body: FormData | object) {
  const user = auth.currentUser; if (!user) throw Error('먼저 로그인해주세요.');
  const headers: Record<string, string> = { Authorization: `Bearer ${await user.getIdToken()}` };
  if (!(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch('/api/editor/' + url, { method: 'POST', headers, body: body instanceof FormData ? body : JSON.stringify(body) });
  if (!res.ok) { const error = await res.json().catch(() => ({})); throw Error(error.error || `서버 응답 오류 (${res.status})`); }
  return res.blob();
}
async function analyze(blob:Blob,expectedDuration?:number):Promise<Word[]>{
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const key='transcribe-v1-'+hash,cached=await editorStore<Word[]>(key);if(cached)return cached;
  const form=new FormData();form.append('videos',blob,'audio-input');
  if(expectedDuration!==undefined)form.append('expectedDuration',String(expectedDuration));
  const result=JSON.parse(await (await request('transcribe',form)).text());
  if(!Array.isArray(result.words))throw Error('음성 분석 결과를 읽지 못했습니다.');
  await editorStore(key,result.words);return result.words;
}

export function VideoEditor({ visible, sourceId }: { visible: boolean; sourceId?: string }) {
  const [d, setD] = useState<Draft>(fresh); const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState<{ id: string; title: string }[]>([]);
  const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const [message, setMessage] = useState('Kling에서 받은 영상을 넣고, 나레이션을 확인해주세요.');
  const [consent, setConsent] = useState(false); const [raw, setRaw] = useState('');
  const [audioLength, setAudioLength] = useState(0);const audioRef=useRef<HTMLAudioElement>(null);
  useEffect(()=>{setAudioLength(0);},[d.voiceBlob]);
  useEffect(()=>{if(audioRef.current)audioRef.current.playbackRate=d.plan.voiceSpeed;},[d.plan.voiceSpeed]);
  const audioURL = useURL(d.voiceBlob); const resultURL = useURL(d.result);
  const currentRef = useRef(d); currentRef.current = d;
  const [sources, setSources] = useState<MarketingSource[]>([]);
  const lastSource = useRef('');
  const saver = useRef<ReturnType<typeof draftWriter<Draft>> | null>(null);
  if(!saver.current)saver.current=draftWriter<Draft>(async snapshot=>{
    try {
      await editorStore(snapshot.id,snapshot);
      const list=await editorStore<{id:string;title:string}[]>('list')||[];
      const next=[{id:snapshot.id,title:snapshot.plan.title||'제목 없는 편집'},...list.filter(x=>x.id!==snapshot.id)];
      await editorStore('list',next);await editorStore('current',snapshot.id);setSaved(next);
    } catch {setMessage('자동 저장에 실패했습니다. 완성 파일을 다운로드하고 브라우저 저장 공간을 확인해주세요.');}
  });
  useEffect(() => {
    let mounted = true;
    (async () => { const list = await editorStore<{ id: string; title: string }[]>('list') || []; const id = await editorStore<string>('current'); const draft = id ? await editorStore<Draft>(id) : undefined; if (mounted) { setSaved(list); if (draft) setD(draft); setReady(true); } })().catch(() => { if (mounted) { setMessage('저장된 편집을 읽지 못했습니다. 브라우저 저장 공간을 확인해주세요.'); setReady(true); } });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!ready || (!d.source && !d.plan.title && !d.plan.narration && !d.plan.thumbnail && !d.plan.captions.length && !d.videos.some(Boolean))) return;
    void saver.current!.write(d.id,d);
  }, [d, ready]);
  useEffect(() => { setConsent(false); }, [d.plan.narration, d.voice, d.style, d.plan.duration]);
  const loadSource = async (source: MarketingSource) => {
    await saver.current!.flush();
    const id = 'scenario-' + source.id;
    const existing = await editorStore<Draft>(id);
    setD(existing || { ...fresh(), id, source, plan: source.plan, original: source.rawPlan });
    setMessage(existing ? '저장해 둔 편집을 이어서 엽니다.' : '시나리오의 나레이션·자막·제목을 가져왔습니다. Kling에서 받은 5초 영상을 넣어주세요.');
  };
  useEffect(() => {
    if (!visible || !ready || busyRef.current) return;
    let cancelled = false;
    loadScenarioHistory().then(items => {
      if (cancelled) return;
      const records = items.map(marketingSource); setSources(records);
      const matching = records.find(s => s.id === sourceId);
      const auto = matching && lastSource.current !== sourceId ? matching :
        (!currentRef.current.source && !currentRef.current.plan.title && !saved.length ? records[0] : undefined);
      if (auto) { lastSource.current = sourceId || ''; void run(() => loadSource(auto)); }
    }).catch(() => { if (!cancelled) setMessage('시나리오 기록을 읽지 못했습니다. 이 브라우저에서 시나리오가 저장되어 있는지 확인해주세요.'); });
    return () => { cancelled = true; };
  }, [visible, ready, sourceId, busy]);
  const selectContent = (id: string) => run(async () => {
    await saver.current!.flush();
    const existing = await editorStore<Draft>(id);
    if (existing) { setD(existing); setMessage('선택한 콘텐츠의 편집을 불러왔습니다.'); return; }
    const source = sources.find(s => 'scenario-' + s.id === id);
    if (source) await loadSource(source);
  });
  const copy = async (text: string, label: string) => {
    if (!text.trim()) { setMessage(label + ' 내용이 없습니다. 선택한 시나리오를 확인해주세요.'); return; }
    try { await navigator.clipboard.writeText(text); setMessage(label + ' 복사 완료. 연결된 휴대폰에서 붙여넣으세요.'); }
    catch { setMessage('복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해주세요.'); }
  };
  const change = (patch: Partial<EditPlan>) => setD(v => ({ ...v, plan: { ...v.plan, ...patch } }));
  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return; busyRef.current = true; setBusy(true);
    try { await fn(); } catch (e) { setMessage(e instanceof Error ? e.message : '작업 실패'); } finally { busyRef.current = false; setBusy(false); }
  };
  const voiceCurrent = !d.plan.narration.trim() || (!!d.voiceBlob && d.voiceKey === voiceKey(d));
  const syncCurrent = d.syncKey === syncKey(d);
  const finishedCurrent = !!d.result && d.resultKey === resultKey(d) && voiceCurrent;
  const lengths = clipLengths(d.plan.duration);
  const createVoice = () => run(async () => {
    if (!consent) throw Error('음성 생성·분석 비용 확인란을 체크해주세요.');
    validateMediaSizes(d.videos,d.plan.duration,d.plan.narration.trim()?(d.voiceBlob?.size||0):0);
    setMessage('영상 길이와 파일을 확인 중입니다. 아직 유료 분석은 시작하지 않았습니다.');
    for(let i=0;i<lengths.length;i++)validateMediaDuration(await mediaDuration(d.videos[i]!,'video'),lengths[i],i);
    if(d.plan.importWarning)throw Error(d.plan.importWarning);
    if(/(?:Dialog(?:ue)?|오원장|소미|덕이)\s*[:：]/i.test(d.plan.narration))throw Error('읽을 대본에 등장인물 대사가 있습니다. 해설만 남겨주세요.');
    let working={...d};let originalWords:Word[]=[];let offset=0;
    for(let i=0;i<lengths.length;i++){setMessage(`Kling 대사 시간 확인 중 · ${i+1}/${lengths.length}`);const words=await analyze(d.videos[i]!,lengths[i]);originalWords.push(...words.map(w=>({...w,start:Math.min(offset+lengths[i],w.start+offset),end:Math.min(offset+lengths[i],w.end+offset)})).filter(w=>w.end>w.start));offset+=lengths[i];}
    let dialogue=d.plan.captions.filter(c=>c.source==='dialogue');
    const alignedDialogue=alignCaptions(dialogue,originalWords);
    const dialogueRanges=speechRanges(originalWords,d.plan.duration);
    // Preserve all speech, including unexpected Kling dialogue, instead of ducking it.
    if(d.plan.narration.trim()&&!voiceCurrent){setMessage('해설 나레이션 생성 중입니다. 등장인물 대사는 읽지 않습니다.');const blob=await request('voice',{text:spokenNumbers(d.plan.narration),voice:d.voice,style:d.style,duration:d.plan.duration});working={...working,voiceBlob:blob,voiceKey:voiceKey(d)};setD(working);}
    let narrationWords:Word[]=[];let voiceDuration:number|undefined;
    if(d.plan.narration.trim()){setMessage('해설 음성과 자막 시간을 연결하고 있습니다.');voiceDuration=await mediaDuration(working.voiceBlob!,'audio');narrationWords=await analyze(working.voiceBlob!);if(!narrationWords.length)throw Error('해설 음성에서 발화를 찾지 못했습니다.');}
    const segments=scheduleNarration(narrationWords,d.plan.duration,dialogueRanges,d.plan.voiceSpeed,voiceDuration);
    const onTimeline=placedWords(narrationWords,segments,d.plan.voiceSpeed);
    let narratorCaptions=d.plan.captions.filter(c=>!c.source||c.source==='narration');
    if(!d.plan.captions.length&&d.plan.narration.trim())narratorCaptions=d.plan.narration.split(/(?<=[.!?。])\s+|\n+/).filter(Boolean).map(text=>({text,start:0,end:d.plan.duration,source:'narration' as const}));
    const captions=[...alignCaptions(narratorCaptions,onTimeline),...alignedDialogue,...d.plan.captions.filter(c=>c.source==='screen')].sort((a,b)=>a.start-b.start);
    for(let i=1;i<captions.length;i++)if(captions[i].start<captions[i-1].end)captions[i].review='앞 자막과 겹칩니다. 시간을 확인해주세요.';
    working={...working,plan:{...working.plan,captions,voiceSegments:segments,dialogueRanges}};working.syncKey=syncKey(working);setD(working);
    setMessage(captions.some(c=>c.review)?'음성 준비 완료. 확인 표시가 있는 자막만 검토해주세요.':'음성과 자동 싱크가 준비되었습니다. 미리듣기 후 영상을 완성하세요.');
  });
  const makeVideo = () => run(async () => {
    validatePlan(d.plan);
    if(!syncCurrent)throw Error('음성·자동 싱크 준비를 먼저 실행해주세요.');
    if(d.plan.captions.some(c=>c.review))throw Error('확인 표시가 있는 자막을 검토해주세요.');
    if (!voiceCurrent) throw Error('현재 대본에 맞는 음성을 먼저 만들어주세요.');
    if (d.videos.filter(Boolean).length !== lengths.length) throw Error('각 칸에 Kling 영상 파일을 넣어주세요.');
    if (d.plan.narration.trim() && !d.plan.voiceSegments?.length && audioLength / d.plan.voiceSpeed > d.plan.duration + 0.05) throw Error('음성이 영상보다 깁니다. 대본이나 속도를 조절해주세요.');
    validateMediaSizes(d.videos,d.plan.duration,d.plan.narration.trim()?(d.voiceBlob?.size||0):0);
    const body = new FormData(); body.append('plan', JSON.stringify(d.plan));
    d.videos.forEach(f => body.append('videos', f)); if(d.plan.narration.trim())body.append('voice', d.voiceBlob, 'narration.wav');
    setMessage('영상·음성·자막을 합치는 중입니다. 완료될 때까지 이 창을 열어두세요.');
    const blob = await request('render', body); setD(v => ({ ...v, result: blob, resultKey: resultKey(v) }));
    setMessage('완성되었습니다. 아래 영상에서 소리와 자막을 확인하고 다운로드해주세요.');
  });
  return <section className="ori-editor" hidden={!visible}>
    <div className="ori-editor-inner">
      <header><div><p className="ori-eyebrow">마지막 편집, 한 곳에서</p><h1 className="ori-editor-title">영상 편집</h1><p>영상 넣기 → 음성·싱크 준비 → 자막과 함께 완성</p></div></header>
      <p role="status" aria-live="polite" className="ori-status">{message}</p>
      <fieldset disabled={busy || !ready}>
        <div className="ori-row"><label>편집할 콘텐츠<select value={d.id} onChange={e => void selectContent(e.target.value)}>
          <option value={d.id}>{d.plan.title || '시나리오를 선택해주세요'}</option>
          {saved.filter(x => x.id !== d.id).map(x => <option key={x.id} value={x.id}>{x.title} · 편집 보관됨</option>)}
          {sources.filter(x => 'scenario-' + x.id !== d.id && !saved.some(v => v.id === 'scenario-' + x.id)).map(x => <option key={x.id} value={'scenario-' + x.id}>{x.title}</option>)}
        </select></label><button onClick={() => { setD(fresh()); setMessage('새 영상과 대본을 넣어주세요.'); }}>직접 편집</button></div>
        {d.source && <details><summary>휴대폰에 복사 / Kling 프롬프트</summary>
          <div className="ori-row">
            <button onClick={() => void copy(d.plan.narration || d.plan.captions.map(c => c.text).join('\n'), '대본(자막)')}>대본(자막) 복사</button>
            <button onClick={() => void copy([d.source!.title,d.source!.tags].filter(Boolean).join('\n\n'), '제목/태그')}>제목/태그 복사</button>
            <button onClick={() => void copy(d.plan.thumbnail, '썸네일 텍스트')}>썸네일 텍스트 복사</button>
            <button onClick={() => void copy(d.source!.comment, '고정 댓글')}>고정댓글 복사</button>
          </div>
          <label>Kling 프롬프트<textarea readOnly rows={5} value={d.source.videoPrompt} placeholder="Generating optimized video prompt..." /></label>
          <button onClick={() => void copy(d.source!.videoPrompt, 'Kling 프롬프트')}>프롬프트 복사</button>
        </details>}
        <label>콘텐츠 이름<input value={d.plan.title} maxLength={300} onChange={e => change({ title: e.target.value })} placeholder="이번 영상 제목" /></label>
        <article><h3>1. Kling 영상 넣기</h3><p>5초 영상 한 개를 넣으세요. 영상 속 장면은 처음 2초와 다음 3초로 구성됩니다.</p>
          <div className="ori-files">{lengths.map((length, i) => <label key={`${d.id}-${d.plan.duration}-${i}`} className="ori-file">{i + 1}번 영상 · {length}초<input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={e => { const f = e.target.files?.[0]; if (f) setD(v => ({ ...v, syncKey: undefined, resultKey: undefined, videos: Array.from({ length: lengths.length }, (_, n) => n === i ? f : v.videos[n] || null) })); }} /><span>{d.videos[i]?.name || '파일을 선택해주세요'}</span></label>)}</div>
        </article>
        <article><h3>2. 해설 음성과 자동 싱크</h3><p>등장인물 대사는 Kling 원본 소리를 사용합니다. 아래에는 해설만 적으세요. 해설이 없는 영상은 비워두면 됩니다.</p>
          {d.plan.importWarning&&<p className="ori-note">{d.plan.importWarning}<button onClick={()=>change({importWarning:undefined})}>해설 구분 확인했음</button></p>}
          <label>읽을 대본<textarea rows={3} maxLength={1200} value={d.plan.narration} onChange={e => change({ narration: e.target.value })} /></label>
          {/\d/.test(d.plan.narration) && <p className="ori-note">자동으로 읽을 발음: {spokenNumbers(d.plan.narration)} · 자막 숫자는 유지됩니다.</p>}
          <div className="ori-row"><label>목소리<select value={d.voice} onChange={e => setD(v => ({ ...v, voice: e.target.value }))}><option value="Zubenelgenubi">편안한 말투 · Zubenelgenubi</option><option value="Achird">친근한 말투 · Achird</option><option value="Algenib">거친 음색 · Algenib</option><option value="Kore">단단한 말투 · Kore</option><option value="Puck">발랄한 말투 · Puck</option></select></label></div>
          <details><summary>읽는 느낌 조절</summary><textarea value={d.style} maxLength={500} onChange={e => setD(v => ({ ...v, style: e.target.value }))} /><p>VLLO의 ‘털털한 정국’과 동일한 목소리는 아닙니다. 미리듣기로 골라주세요.</p></details>
          <label className="ori-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />해설과 대사를 확인했습니다. 음성 생성·분석 시 Gemini 비용이 발생합니다. 저장된 분석은 재사용합니다.</label>
          <button className="ori-primary" disabled={!consent || (voiceCurrent&&syncCurrent)} onClick={createVoice}>{voiceCurrent&&syncCurrent ? '음성·자동 싱크 준비 완료' : '음성·자동 싱크 준비'}</button>
          {audioURL && d.plan.narration.trim() && <div className="ori-audio"><audio ref={audioRef} controls src={audioURL} onLoadedMetadata={e => {setAudioLength(e.currentTarget.duration);e.currentTarget.playbackRate=d.plan.voiceSpeed;}} /><a href={audioURL} download="나레이션.wav">음성 다운로드</a>{!voiceCurrent && <p>대본 또는 목소리가 바뀌었습니다. 음성을 다시 만들어주세요.</p>}</div>}
          <div className="ori-row"><label>음성 속도<input type="range" min="0.8" max="1.25" step="0.05" value={d.plan.voiceSpeed} onChange={e => change({ voiceSpeed: +e.target.value })} />{d.plan.voiceSpeed}배 · 적용 길이 {audioLength ? (audioLength / d.plan.voiceSpeed).toFixed(1) : '—'}초</label><label>Kling 원래 소리<select value={d.plan.originalVolume} onChange={e => change({ originalVolume: +e.target.value })}><option value={0.2}>작게 유지 · 20%</option><option value={1}>그대로 유지 · 100%</option><option value={0}>끄기</option></select></label></div>
        </article>
        <article><h3>3. 자막과 첫 화면 문구</h3><p>해설·등장인물 자막은 발화에 맞춥니다. 시나리오의 장면 문구는 0~2초, 2~5초로 유지합니다. 제목은 위에서 25%, 자막은 아래에서 25%에 교보 손글씨로 표시됩니다.</p>
          {d.plan.captions.map((c, i) => <div className="ori-caption" key={i}><label className="ori-caption-source">자막 종류<select value={c.source||'narration'} onChange={e=>change({captions:d.plan.captions.map((r,n)=>n===i?{...r,source:e.target.value as any}:r)})}><option value="narration">해설</option><option value="dialogue">등장인물 대사</option><option value="screen">화면 문구 · 시간 유지</option></select></label>{c.review&&<p className="ori-note">{c.review}<button onClick={()=>change({captions:d.plan.captions.map((r,n)=>n===i?{...r,review:undefined}:r)})}>이 자막 확인했음</button></p>}<label className="ori-caption-start">시작(초)<input type="number" min="0" max={d.plan.duration} step="0.1" value={Number(c.start.toFixed(2))} onChange={e => change({ captions: d.plan.captions.map((r, n) => n === i ? { ...r, start: +e.target.value } : r) })} /></label><label className="ori-caption-end">끝(초)<input type="number" min="0" max={d.plan.duration} step="0.1" value={Number(c.end.toFixed(2))} onChange={e => change({ captions: d.plan.captions.map((r, n) => n === i ? { ...r, end: +e.target.value } : r) })} /></label><label className="ori-caption-text">자막<textarea rows={2} maxLength={160} value={c.text} onChange={e => change({ captions: d.plan.captions.map((r, n) => n === i ? { ...r, text: e.target.value } : r) })} /></label><button className="ori-caption-delete" onClick={() => change({ captions: d.plan.captions.filter((_, n) => n !== i) })}>삭제</button></div>)}
          <button disabled={d.plan.captions.length >= 30} onClick={() => { const start = d.plan.captions.at(-1)?.end || 0; if (start < d.plan.duration) change({ captions: [...d.plan.captions, { start, end: d.plan.duration, text: '' }] }); }}>자막 추가</button>
          <label>처음 0~1초에 표시할 문구<textarea rows={2} maxLength={100} value={d.plan.thumbnail} onChange={e => change({ thumbnail: e.target.value })} placeholder="화면 위쪽 25% 위치에 표시합니다" /></label>
          <details><summary>원본 대본 확인 / 직접 가져오기</summary>{d.original && <pre>{d.original}</pre>}<textarea rows={6} value={raw} onChange={e => setRaw(e.target.value)} placeholder="한글 나레이션 및 자막 부분을 붙여넣으세요" /><button onClick={() => { try { const p = importEpisode({ duration: d.plan.duration, korean: raw, title: d.plan.title, thumbnail: d.plan.thumbnail }); setD(v => ({ ...v, plan: { ...v.plan, narration: p.narration, captions: p.captions, importWarning:p.importWarning }, original: raw })); setMessage('대본을 가져왔습니다. 나레이션과 자막 시각을 확인해주세요.'); } catch (e) { setMessage(e.message); } }}>대본에서 나레이션·자막 가져오기</button></details>
        </article>
        <p className="ori-next">{lengths.some((_,i)=>!d.videos[i])?'다음: 위의 영상 칸에 Kling 파일을 모두 넣어주세요.':!syncCurrent?'다음: 2번에서 음성·자동 싱크를 준비해주세요.':d.plan.captions.some(c=>c.review)?'다음: 확인 표시가 있는 자막을 검토해주세요.':'준비 완료: 아래 버튼으로 음성·자막을 넣은 MP4를 만듭니다.'}</p>
        <button className="ori-primary ori-finish" disabled={!voiceCurrent || !syncCurrent || d.plan.captions.some(c=>c.review) || lengths.some((_,i)=>!d.videos[i])} onClick={makeVideo}>{busy ? '처리 중…' : '음성·자막 넣고 영상 완성'}</button>
      </fieldset>
      {resultURL && <article><h3>{finishedCurrent ? '완성 영상' : '이전 설정의 완성 영상'}</h3>{!finishedCurrent && <p>설정이 바뀌었습니다. 현재 설정으로 다시 완성해주세요.</p>}<video className="ori-result" controls playsInline src={resultURL} /><a className="ori-download" href={resultURL} download={`${d.plan.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || '오리마케팅'}.mp4`}>완성 MP4 다운로드</a><button className="ori-download" onClick={()=>run(async()=>{const name=(d.plan.title||'오리마케팅').replace(/[\\/:*?"<>|]/g,'').slice(0,80);await shareFile(new File([d.result!],name+'.mp4',{type:'video/mp4'}));})}>완성 영상 공유·저장</button></article>}
      <LegacyVideos visible={visible} />
      <p>편집 내용과 영상은 현재 기기의 브라우저에 보관됩니다. 다른 기기에서는 파일을 다시 선택해주세요.</p>
    </div>
  </section>;
}
