import { spawn } from 'node:child_process';
import { writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import type { EditPlan } from '../../src/editor/model';
import { validatePlan } from '../../src/editor/model';

export function command(binary: string, args: string[], cwd: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd, windowsHide: true, signal });
    let log = ''; const collect = (b: Buffer) => { log = (log + b.toString()).slice(-24000); };
    child.stderr.on('data', collect); child.stdout.on('data', collect);
    const timer = setTimeout(() => child.kill('SIGKILL'), 240000);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(log) : reject(Error('영상 처리에 실패했습니다. 파일 형식과 서버 로그를 확인해주세요.', { cause: log })); });
  });
}
const ff = () => process.env.FFMPEG_PATH || 'ffmpeg';
export async function inspect(file: string, cwd: string, signal?: AbortSignal) {
  // ffmpeg can inspect and decode without a separate ffprobe installation.
  const log = await command(ff(), ['-hide_banner', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm,wav', '-i', file, '-t', '0.05', '-f', 'null', '-'], cwd, signal);
  const m = log.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) throw Error('영상 또는 음성 길이를 읽을 수 없습니다.');
  return { duration: +m[1] * 3600 + +m[2] * 60 + +m[3], audio: /Audio:/.test(log), video: /Video:/.test(log) };
}
const escapeASS = (s: string) => s.replace(/\\/g, '＼').replace(/{/g, '｛').replace(/}/g, '｝').replace(/\r/g, '').replace(/\n/g, '\\N');
const clock = (s: number) => `0:00:${s.toFixed(2).padStart(5, '0')}`;
function wrap(text: string, width = 22) {
  return text.split('\n').flatMap(line => {
    const result: string[] = []; let row = ''; let units = 0;
    for (const char of line) {
      const size = /[ -~]/.test(char) ? 0.55 : 1;
      if (units + size > width) { result.push(row.trim()); row = ''; units = 0; }
      row += char; units += size;
    }
    if (row.trim()) result.push(row.trim()); return result;
  }).join('\n');
}
export function subtitles(p: EditPlan) {
  const captions = p.captions.map(c => ({ ...c, text: wrap(c.text) }));
  const maxLines = Math.max(1, ...captions.map(c => c.text.split('\n').length));
  const units = (text: string) => Math.max(1, ...text.split('\n').map(line => Array.from(line).reduce((n, ch) => n + (/[a-z0-9 ]/.test(ch) ? 0.65 : 1), 0)));
  const size = Math.min(90, Math.floor(790 / Math.max(1, ...captions.map(c => units(c.text)))), Math.floor(210 / maxLines));
  const title = wrap(p.thumbnail, 17);
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,Kyobo Handwriting 2024 psw,${size},&H00FFFFFF,&H00FFFFFF,&H00111111,&H80000000,0,0,0,0,100,100,0,0,1,3,0,5,135,135,0,1\nStyle: Title,Kyobo Handwriting 2024 psw,${Math.min(100, Math.floor(790 / units(title)), Math.floor(220 / Math.max(1, title.split('\n').length)))},&H0000DFFF,&H00FFFFFF,&H00111111,&H80000000,0,0,0,0,100,100,0,0,1,3,0,5,135,135,0,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n` +
    (title ? `Dialogue: 0,${clock(0)},${clock(1)},Title,,0,0,0,,{\\pos(540,480)}${escapeASS(title)}\n` : '') +
    captions.map(c => `Dialogue: 0,${clock(c.start)},${clock(c.end)},Caption,,0,0,0,,{\\pos(540,1440)}${escapeASS(c.text)}`).join('\n');
}
export async function render(p: EditPlan, videos: string[], voice: string | undefined, dir: string, signal?: AbortSignal) {
  validatePlan(p); const lengths = [5];
  if (videos.length !== lengths.length) throw Error(`영상 ${lengths.length}개를 순서대로 넣어주세요.`);
  const narration = voice ? await inspect(voice, dir, signal) : undefined;
  if (narration && (!narration.audio || (!p.voiceSegments?.length && narration.duration / p.voiceSpeed > p.duration + 0.05))) throw Error('나레이션이 영상보다 깁니다. 속도를 조절하거나 대본을 줄여 음성을 다시 만들어주세요. 음성을 잘라내지는 않습니다.');
  const segments=voice?(p.voiceSegments?.length?p.voiceSegments:[{sourceStart:0,sourceEnd:narration!.duration,start:0}]):[];
  for(const s of segments){if(s.sourceEnd>narration!.duration+0.05)throw Error('해설 구간이 음성 길이를 벗어납니다.');if(p.dialogueRanges?.some(d=>s.start<d.end&&s.start+(s.sourceEnd-s.sourceStart)/p.voiceSpeed>d.start))throw Error('해설과 등장인물 대사가 겹칩니다. 자동 싱크를 다시 실행해주세요.');}
  for (let i = 0; i < videos.length; i++) {
    const meta = await inspect(videos[i], dir, signal);
    if (!meta.video || meta.duration < lengths[i] - 0.15 || meta.duration > lengths[i] + 0.5) throw Error(`${i + 1}번 영상은 ${lengths[i]}초 영상이어야 합니다. 현재 ${meta.duration.toFixed(2)}초입니다.`);
    await command(ff(), ['-y', '-nostdin', '-i', videos[i], ...(!meta.audio ? ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo'] : []), '-map', '0:v:0', '-map', meta.audio ? '0:a:0' : '1:a:0', '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=0.15', '-af', 'apad', '-t', String(lengths[i]), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-threads', '2', `clip${i}.mp4`], dir, signal);
  }
  await writeFile(path.join(dir, 'clips.txt'), videos.map((_, i) => `file 'clip${i}.mp4'`).join('\n'));
  await command(ff(), ['-y', '-nostdin', '-f', 'concat', '-safe', '1', '-i', 'clips.txt', '-c', 'copy', 'joined.mp4'], dir, signal);
  await writeFile(path.join(dir, 'captions.ass'), subtitles(p));
  // libass reads the same bundled font on local previews and Cloud Run.
  await mkdir(path.join(dir, 'fonts'), { recursive: true });
  await copyFile(path.resolve('src/assets/KyoboHandwriting2024psw.ttf'), path.join(dir, 'fonts', 'KyoboHandwriting2024psw.ttf'));
  const speaking=(p.dialogueRanges||[]).map(d=>`between(t,${d.start},${d.end})`).join('+');
  const gain=speaking?`'if(${speaking},1,${p.originalVolume})':eval=frame`:String(p.originalVolume);
  let filters=`[0:v]ass=captions.ass:fontsdir=fonts[v];[0:a]volume=${gain}[original];`;
  if(segments.length){
    filters+=`[1:a]asplit=${segments.length}${segments.map((_,i)=>`[src${i}]`).join('')};`;
    filters+=segments.map((s,i)=>`[src${i}]atrim=start=${s.sourceStart}:end=${s.sourceEnd},asetpts=PTS-STARTPTS,atempo=${p.voiceSpeed},volume=${p.voiceVolume},adelay=${Math.round(s.start*1000)}:all=1[voice${i}];`).join('');
    filters+=`[original]${segments.map((_,i)=>`[voice${i}]`).join('')}amix=inputs=${segments.length+1}:duration=first:normalize=0,alimiter=limit=0.95:level=0[a]`;
  }else filters+='[original]alimiter=limit=0.95:level=0[a]';
  await command(ff(), ['-y', '-nostdin', '-i', 'joined.mp4', ...(voice?['-i',voice]:[]), '-filter_complex', filters, '-map', '[v]', '-map', '[a]', '-t', String(p.duration), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', '-threads', '2', 'finished.mp4'], dir, signal);
  const out = await inspect('finished.mp4', dir, signal);
  if (!out.video || !out.audio || Math.abs(out.duration - p.duration) > 0.15) throw Error('완성 파일의 영상·음성 검증에 실패했습니다.');
  return path.join(dir, 'finished.mp4');
}
