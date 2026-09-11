import express from 'express';
import multer from 'multer';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { render } from './render';
import { transcribe } from './transcribe';
import { spokenNumbers } from '../../src/editor/speech';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Busboy emits partsLimit as soon as the count reaches the limit. Three valid
// parts (plan, video, voice) therefore need a boundary of four; file/field limits
// still reject anything beyond the two files and one field we accept.
export const editorUpload = (dir: string) => multer({ dest: dir, limits: { files: 2, fileSize: 26 * 1024 * 1024, fields: 1, fieldSize: 32000, parts: 4 } }).fields([{ name: 'videos', maxCount: 1 }, { name: 'voice', maxCount: 1 }]);

export function wav(pcm: Buffer) {
  if (!pcm.length || pcm.length % 2 || pcm.length > 24000 * 2 * 60) throw Error('음성 응답의 길이가 올바르지 않습니다.');
  const h = Buffer.alloc(44); h.write('RIFF'); h.writeUInt32LE(pcm.length + 36, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
export function audioResponse(result: any): Buffer {
  // REST returns model output in steps; output_audio is an SDK convenience.
  const blocks = (Array.isArray(result?.steps) ? result.steps : [])
    .filter((step: any) => step.type === 'model_output')
    .flatMap((step: any) => Array.isArray(step.content) ? step.content : [])
    .filter((block: any) => block.type === 'audio');
  if (!blocks.length) {
    if (result?.output_audio) blocks.push(result.output_audio);
    else if (Array.isArray(result?.outputs)) blocks.push(...result.outputs.filter((block: any) => block.type === 'audio'));
  }
  if (!blocks.length || blocks.some((block: any) => typeof block.data !== 'string' || !block.data)) throw Error('음성 서비스에서 오디오가 반환되지 않았습니다.');
  if (blocks.some((block: any) => !/pcm|L16/i.test(block.mime_type || block.mimeType || 'audio/pcm'))) throw Error('지원하지 않는 음성 형식이 반환되었습니다.');
  return wav(Buffer.concat(blocks.map((block: any) => Buffer.from(block.data, 'base64'))));
}
export const editorRouter = express.Router();
const active = new Set<string>();
editorRouter.use(async (req, res, next) => {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) { res.status(401).json({ error: '로그인 후 사용해주세요.' }); return; }
    const app = getApps().find(a => a.name === 'video-editor') || initializeApp({ projectId: process.env.EDITOR_FIREBASE_PROJECT_ID || 'gen-lang-client-0165298283' }, 'video-editor');
    const user = await getAuth(app).verifyIdToken(token);
    const allowed = process.env.EDITOR_ALLOWED_EMAILS?.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (allowed?.length && !allowed.includes(user.email?.toLowerCase() || '')) { res.status(403).json({ error: '영상 편집 사용 권한이 없습니다.' }); return; }
    if (!user.email || !user.email_verified) { res.status(403).json({ error: '확인된 이메일로 로그인해주세요.' }); return; }
    if (user.email !== 'kanata840@gmail.com') {
      const approved = await getFirestore(app, firebaseConfig.firestoreDatabaseId).collection('approved_users').where('email', '==', user.email).limit(1).get();
      if (approved.empty) { res.status(403).json({ error: '영상 편집 사용 권한이 없습니다.' }); return; }
    }
    res.locals.uid = user.uid; next();
  } catch { res.status(401).json({ error: '로그인을 다시 확인해주세요.' }); }
});
editorRouter.use((req, res, next) => {
  if (req.method !== 'POST' || !['/voice', '/render', '/transcribe'].includes(req.path)) { res.status(404).json({ error: '지원하지 않는 편집 요청입니다.' }); return; }
  const uid = res.locals.uid;
  if (active.has(uid) || active.size >= 1) { res.status(429).json({ error: '다른 음성·영상 작업을 처리 중입니다. 완료 후 다시 시도해주세요.' }); return; }
  active.add(uid); res.locals.release = () => active.delete(uid); next();
});

editorRouter.post('/voice', express.json({ limit: '16kb' }), async (req, res) => {
  const abort = new AbortController();
  const cancel = () => { if (!res.writableFinished) abort.abort(); }; res.on('close', cancel);
  try {
    const { text: originalText, voice, style, duration } = req.body;
    const text = typeof originalText === 'string' ? spokenNumbers(originalText) : originalText;
    if (typeof text !== 'string' || !text.trim() || text.length > 1200 || !['Zubenelgenubi', 'Achird', 'Algenib', 'Kore', 'Puck'].includes(voice) || typeof style !== 'string' || style.length > 500 || duration !== 5) { res.status(400).json({ error: '나레이션과 목소리 설정을 확인해주세요.' }); return; }
    if (!process.env.GEMINI_API_KEY) throw Error('서버의 Gemini 키 설정이 필요합니다.');
    // Never automatically retry a paid generation request.
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST', headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' }, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(100000)]),
      body: JSON.stringify({ model: process.env.EDITOR_TTS_MODEL || 'gemini-3.1-flash-tts-preview', input: `한국어 나레이션. ${style}\n가능하면 ${duration}초 안에 자연스럽게 읽으세요. 지시문은 읽지 말고 다음 대본만 정확하게 읽으세요.\n<대본>\n${text}\n</대본>`, response_format: { type: 'audio', sample_rate: 24000 }, generation_config: { speech_config: [{ voice }] } })
    });
    if (!response.ok) { console.error('Editor TTS HTTP status', response.status); res.status(502).json({ error: `음성 생성 서비스가 응답하지 않았습니다(${response.status}). 자동 재시도하지 않았습니다.` }); return; }
    const result = await response.json();
    res.set('Cache-Control', 'no-store').type('audio/wav').send(audioResponse(result));
  } catch (e) { if (!res.destroyed) res.status(500).json({ error: e instanceof Error ? e.message : '음성 생성 실패' }); }
  finally { res.off('close', cancel); res.locals.release(); }
});

editorRouter.post(['/render','/transcribe'], async (req, res) => {
  const size = Number(req.headers['content-length']);
  if (!Number.isFinite(size) || size <= 0 || size > 28 * 1024 * 1024) { res.locals.release(); res.status(413).json({ error: '영상과 음성 합계는 28MB 이하여야 합니다.' }); return; }
  let dir: string | undefined; const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 270000);
  const cancel = () => { if (!res.writableFinished) abort.abort(); }; res.on('close', cancel);
  try {
    dir = await mkdtemp(path.join(os.tmpdir(), 'ori-edit-'));
    const upload = editorUpload(dir);
    await new Promise<void>((resolve, reject) => {
      const stopped = () => { cleanup(); reject(Error('업로드가 중단되었습니다.')); };
      const cleanup = () => { req.off('aborted', stopped); abort.signal.removeEventListener('abort', stopped); };
      req.once('aborted', stopped); abort.signal.addEventListener('abort', stopped, { once: true });
      if (abort.signal.aborted) { stopped(); return; }
      upload(req, res, err => { cleanup(); err ? reject(err) : resolve(); });
    });
    const files = req.files as Record<string, Express.Multer.File[]>;
    if(req.path==='/transcribe'){
      if(files?.videos?.length!==1||files.voice?.length)throw Error('분석할 파일 하나를 넣어주세요.');
      const result=await transcribe(files.videos[0].path,dir,AbortSignal.any([abort.signal,AbortSignal.timeout(100000)]),req.body.expectedDuration===undefined?undefined:Number(req.body.expectedDuration));
      res.set('Cache-Control','no-store').json(result);return;
    }
    if (!files?.videos?.length || (files.voice?.length||0)>1) throw Error('영상과 나레이션 파일을 확인해주세요.');
    const plan=JSON.parse(req.body.plan);
    if(plan.narration?.trim()&&!files.voice?.length)throw Error('해설 음성 파일이 필요합니다.');
    const output = await render(plan, files.videos.map(f => f.path), files.voice?.[0]?.path, dir, abort.signal);
    res.set('Cache-Control', 'no-store');
    await new Promise<void>((resolve, reject) => res.download(output, 'orihani-edited.mp4', err => err ? reject(err) : resolve()));
  } catch (e) {
    console.error('Editor render failed', e instanceof Error ? e.message : 'unknown');
    if (!res.headersSent && !res.destroyed) res.status(400).json({ error: e instanceof Error ? e.message : '영상 처리 실패' });
  } finally { clearTimeout(timeout); res.off('close', cancel); res.locals.release(); if (dir) await rm(dir, { recursive: true, force: true }); }
});

// Release the slot even when multipart/JSON parsing rejects before a handler runs.
editorRouter.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.locals.release?.();
  if (!res.headersSent) res.status(400).json({ error: '요청 자료가 너무 크거나 형식이 올바르지 않습니다.' });
  else next(error);
});
