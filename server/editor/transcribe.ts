import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {command,inspect} from './render';
import {parseWords} from '../../src/editor/speech';
import {validateMediaDuration} from '../../src/editor/media';

export async function transcribe(file:string,dir:string,signal:AbortSignal,expectedDuration?:number){
  const meta=await inspect(file,dir,signal);
  if(expectedDuration!==undefined){if(expectedDuration!==5)throw Error('분석할 영상 길이를 확인해주세요.');validateMediaDuration(meta.duration,expectedDuration,0);if(!meta.video)throw Error('영상 파일을 넣어주세요.');}
  if(meta.duration>16)throw Error('분석할 파일은 16초 이하여야 합니다.');
  if(!meta.audio)return {words:[],model:'no-audio'};
  await command(process.env.FFMPEG_PATH||'ffmpeg',['-y','-nostdin','-i',file,'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le','analysis.wav'],dir,signal);
  if(!process.env.GEMINI_API_KEY)throw Error('서버의 Gemini 키 설정이 필요합니다.');
  const model=process.env.EDITOR_TRANSCRIBE_MODEL||'gemini-3.5-transcribe';
  const data=(await readFile(path.join(dir,'analysis.wav'))).toString('base64');
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,'Content-Type':'application/json'},signal,
    body:JSON.stringify({model,input:[{type:'audio',data,mime_type:'audio/wav'}],generation_config:{transcription_config:{language_codes:['ko-KR'],mode:{type:'verbatim',timestamp_granularities:['word']}}}})
  });
  if(!response.ok)throw Error(`음성 분석 서비스 오류 (${response.status}). 자동으로 재요청하지 않았습니다.`);
  const result=await response.json();const words=parseWords(result);
  const text=(result.steps||[]).filter((s:any)=>s.type==='model_output').flatMap((s:any)=>s.content||[]).map((c:any)=>c.text||'').join('');
  if(!words.length&&text.trim())throw Error('분석 결과에 단어 시간이 없습니다. 자동 싱크를 적용하지 않았습니다.');
  if(words.some(w=>w.end>meta.duration+0.15))throw Error('분석 결과가 실제 파일 길이를 벗어납니다.');
  return {words,model};
}
