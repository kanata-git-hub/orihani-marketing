const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),compiled=path.join(root,'.editor-test');
fs.mkdirSync(compiled,{recursive:true});fs.writeFileSync(path.join(compiled,'package.json'),'{"type":"commonjs"}');
for(const f of ['src/editor/model.ts','src/editor/source.ts','src/editor/speech.ts','src/editor/storage.ts','src/editor/media.ts','server/editor/render.ts','server/editor/transcribe.ts','server/editor/routes.ts']){
 const dest=path.join(compiled,f.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,ts.transpileModule(fs.readFileSync(path.join(root,f),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText);
}
fs.copyFileSync(path.join(root,'firebase-applet-config.json'),path.join(compiled,'firebase-applet-config.json'));
const {marketingSource,koreanOnly}=require(path.join(compiled,'src/editor/source.js'));
const {defaultPlan,validatePlan,importEpisode}=require(path.join(compiled,'src/editor/model.js'));
const {spokenNumbers,parseWords,alignCaptions,scheduleNarration,placedWords}=require(path.join(compiled,'src/editor/speech.js'));
const {validateMediaSizes,validateMediaDuration,clipLengths}=require(path.join(compiled,'src/editor/media.js'));
const {draftWriter}=require(path.join(compiled,'src/editor/storage.js'));
const {subtitles,render,command,inspect}=require(path.join(compiled,'server/editor/render.js'));
const {audioResponse,editorRouter,editorUpload}=require(path.join(compiled,'server/editor/routes.js'));
const record=(rawPlan,id='one')=>({id,title:'블로그 제목',rawPlan,videoPrompt:'OUTPUT SPECS: 2s\nOUTPUT SPECS: 3s',createdAt:1,imagePrompt:''});
const raw=`🎬 제목: 피곤한 아침 / Tired morning
🖼️ 썸네일 텍스트: 배터리 1% / Battery one percent
📱 화면 자막 & TTS (약 4~5초)
- 장면 1 (0~2초): 배터리가 방전됐네 / Battery low
- 장면 2 (2~4초): 이제 좀 살겠네 / Alive again
- 🎙️ 나레이션 (TTS): "들이쉬기 4초, 내쉬기 6초! / Inhale and exhale!"
💬 오원장 고정 댓글: 저도 그렇더라고요.
자세한 내용은 블로그에서!
🏷️ 해시태그 5개: #피로 #오리한의원
### 1. Image Generation Prompts
Do not read these directions.`;
test('marketing metadata stays Korean, uses 2+3 scene timings and retains multiline comments',()=>{
 const s=marketingSource(record(raw));assert.equal(s.title,'피곤한 아침');assert.equal(s.plan.duration,5);assert.equal(s.plan.narration,'들이쉬기 4초, 내쉬기 6초!');assert.equal(s.thumbnail,'배터리 1%');assert.equal(s.comment,'저도 그렇더라고요.\n자세한 내용은 블로그에서!');assert.equal(s.tags,'#피로 #오리한의원');assert.deepEqual(s.plan.captions.map(c=>[c.start,c.end,c.source]),[[0,2,'screen'],[2,5,'screen']]);validatePlan(s.plan);
 assert.equal(koreanOnly('공진단/경옥고 비교 / Comparison'),'공진단/경옥고 비교');
});
test('missing narration, empty labels, multiline speech and explicit no speech are distinguished',()=>{
 for(const text of ['### Part 4: YouTube TTS Script\nVISUAL: Jump.', '🎙️ 나레이션 (TTS):\n💬 고정 댓글: 이것을 읽으면 안 됩니다.']){const s=marketingSource(record(text));assert.equal(s.plan.narration,'');assert.ok(s.plan.importWarning);}
 assert.equal(marketingSource(record('🎙️ 나레이션 (TTS):\n"좋은 아침. / Good morning"\n💬 고정 댓글: 안녕')).plan.narration,'좋은 아침.');
 const p=marketingSource(record('🎙️ 나레이션 (TTS): 없음 (대사만)')).plan;assert.equal(p.narration,'');assert.equal(p.importWarning,undefined);
 const q=marketingSource({...record('🎙️ 나레이션 (TTS): 좋은 아침.'),videoPrompt:'Dialog:오원장:"퇴근합시다!"'}).plan;assert.equal(q.narration,'좋은 아침.');assert.ok(q.captions.some(c=>c.source==='dialogue'&&c.text==='퇴근합시다!'));
});
test('only one five-second clip is accepted before analysis',()=>{
 assert.deepEqual(clipLengths(5),[5]);assert.throws(()=>clipLengths(15));assert.throws(()=>validatePlan({...defaultPlan(),duration:15}));assert.throws(()=>importEpisode({duration:15,korean:''}));
 assert.throws(()=>validateMediaSizes([{size:1},{size:1}],5));assert.throws(()=>validateMediaSizes([{size:27*1024*1024}],5));assert.throws(()=>validateMediaDuration(8,5,0));validateMediaSizes([{size:123}],5);validateMediaDuration(5.03,5,0);
});
test('numbers become Korean readings while subtitle text stays intact',()=>{
 assert.equal(spokenNumbers('3명이 15초 동안 1%를 20개로'),'세 명이 십오 초 동안 일 퍼센트를 스무 개로');assert.equal(spokenNumbers('07:00에 1,000원'),'일곱 시에 천 원');assert.equal(marketingSource(record(raw)).plan.captions[0].text,'배터리가 방전됐네');
});
test('word timing aligns captions and preserves dialogue windows',()=>{
 const words=parseWords({steps:[{type:'model_output',content:[{annotations:[{type:'word_info',text:'안녕',start_offset:'0.100s',end_offset:'0.800s'},{type:'word_info',text:'친구야',start_offset:'0.900s',end_offset:'1.400s'}]}]}]});
 const c=alignCaptions([{text:'안녕 친구야',start:0,end:5}],words)[0];assert.equal(c.start,.1);assert.equal(c.end,1.4);assert.equal(c.review,undefined);assert.ok(alignCaptions([{text:'다른 문장',start:0,end:5}],words)[0].review);
 const segments=scheduleNarration(words,5,[{start:0,end:2}],1);assert.ok(segments[0].start>=2);assert.equal(placedWords(words,segments,1).length,2);assert.throws(()=>scheduleNarration(words,5,[{start:0,end:4.8}],1));
});
test('switching content does not discard a pending video draft',async()=>{
 let release;const gate=new Promise(r=>release=r),saved=[];const w=draftWriter(async v=>{if(!saved.length)await gate;saved.push(v);});const p=w.write('one',{id:'one',title:'피로'});w.write('one',{id:'one',title:'수정한 피로'});w.write('two',{id:'two',title:'다른 콘텐츠'});release();await p;await w.flush();assert.deepEqual(saved.map(v=>v.title),['피로','수정한 피로','다른 콘텐츠']);
});
test('WAV response contains all returned PCM blocks',()=>{
 const pcm=Buffer.from([1,0,2,0]);const out=audioResponse({steps:[{type:'model_output',content:[{type:'audio',mime_type:'audio/pcm',data:pcm.toString('base64')}]}]});assert.equal(out.toString('ascii',0,4),'RIFF');assert.equal(out.readUInt32LE(24),24000);assert.deepEqual(out.subarray(44),pcm);assert.throws(()=>audioResponse({steps:[]}));
});
test('title and caption positions/font match meme editor and title stops at 1 second',()=>{
 const ass=subtitles({...defaultPlan(),thumbnail:'첫 제목',captions:[{start:0,end:5,text:'{\\pos(0,0)} 1% 자막'}]});assert.match(ass,/Kyobo Handwriting 2024/);assert.match(ass,/pos\(540,480\)/);assert.match(ass,/pos\(540,1440\)/);assert.match(ass,/0:00:00.00,0:00:01.00,Title/);assert.ok(!ass.includes('{\\pos(0,0)}'));assert.throws(()=>validatePlan({...defaultPlan(),captions:[{start:0,end:3,text:'가'},{start:2,end:5,text:'나'}]}));
});
test('browser multipart accepts plan plus video and voice while rejecting extra fields and files',async()=>{
 const express=require('express'),app=express(),dir=fs.mkdtempSync(path.join(compiled,'upload-'));
 app.post('/upload',editorUpload(dir),(req,res)=>res.json({plan:req.body.plan,files:Object.keys(req.files).sort()}));
 app.use((err,req,res,next)=>res.status(400).json({error:err.code}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const send=async(extra)=>{const data=new FormData();data.append('plan','{"duration":5}');data.append('videos',new Blob(['video']), 'clip.mp4');data.append('voice',new Blob(['audio']), 'narration.wav');extra?.(data);return fetch(`http://127.0.0.1:${server.address().port}/upload`,{method:'POST',body:data});};
 try{const good=await send();assert.equal(good.status,200);assert.deepEqual(await good.json(),{plan:'{"duration":5}',files:['videos','voice']});
  assert.equal((await send(data=>data.append('extra','value'))).status,400);
  assert.equal((await send(data=>data.append('videos',new Blob(['extra']),'extra.mp4'))).status,400);
 }finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
test('new editor APIs reject unauthenticated calls',async()=>{
 const express=require('express'),app=express();app.use('/api/editor',editorRouter);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));try{for(const endpoint of ['voice','render','transcribe']){const res=await fetch(`http://127.0.0.1:${server.address().port}/api/editor/${endpoint}`,{method:'POST'});assert.equal(res.status,401);}}finally{await new Promise(r=>server.close(r));}
});
test('actual five-second rendering preserves source audio, mixes voice and handles silent MP4', {skip:!process.env.FFMPEG_PATH,timeout:240000},async()=>{
 const dir=path.join(compiled,'media');fs.mkdirSync(dir,{recursive:true});const ff=process.env.FFMPEG_PATH;
 await command(ff,['-y','-f','lavfi','-i','color=c=0x67514a:s=360x640:r=30','-f','lavfi','-i','sine=frequency=220:sample_rate=48000','-t','5','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','source.mp4'],dir);
 await command(ff,['-y','-f','lavfi','-i','sine=frequency=880:sample_rate=24000','-t','4.5','voice.wav'],dir);
 const source=path.join(dir,'source.mp4'),voice=path.join(dir,'voice.wav'),plan={...defaultPlan(),thumbnail:'배터리 일 퍼센트',captions:[{start:0,end:2,text:'첫 번째 자막입니다.'},{start:2,end:5,text:'마지막 소리와 자막을 확인합니다.'}]};
 await render(plan,[source],voice,dir);const meta=await inspect('finished.mp4',dir);assert.ok(meta.audio&&meta.video);assert.ok(Math.abs(meta.duration-5)<.1);
 const stats=await command(ff,['-i','finished.mp4','-vn','-af','astats','-f','null','-'],dir);assert.match(stats,/RMS level dB: -(?!inf)\d/);
 await command(ff,['-y','-ss','0.5','-i','finished.mp4','-frames:v','1','preview.png'],dir);fs.copyFileSync(path.join(dir,'finished.mp4'),path.join(dir,'verified-5s.mp4'));
 await assert.rejects(render({...plan,voiceSpeed:.8},[source],voice,dir),/나레이션이 영상보다/);
 await render({...plan,originalVolume:0,dialogueRanges:[{start:1.5,end:2}],voiceSegments:[{sourceStart:0,sourceEnd:1.5,start:0},{sourceStart:1.5,sourceEnd:4.5,start:2}]},[source],voice,dir);
 const preserved=await command(ff,['-ss','1.6','-t','0.2','-i','finished.mp4','-vn','-af','astats','-f','null','-'],dir);assert.match(preserved,/RMS level dB: -(?!inf)\d/);
 await command(ff,['-y','-i','source.mp4','-an','-c:v','copy','silent.mp4'],dir);await render({...plan,narration:''},[path.join(dir,'silent.mp4')],undefined,dir);assert.ok((await inspect('finished.mp4',dir)).audio);
});
