const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const compile=(rel,imports={})=>{const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,rel),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(name=>imports[name]||require(name),m,m.exports);return m.exports;};
const policy=compile('src/characterReference.ts');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const originals=Array.from({length:9},(_,i)=>({url:png,label:['오원장','소미','덕이'][Math.floor(i/3)]+' '+['Front','Side','Back'][i%3]}));
test('all nine design sheets survive the previous-scene reference and override conflicting hand instructions',()=>{
 const parts=policy.buildReferenceParts([...originals,{url:png,role:'scene'}],'Copy the previous yellow feathered fingers exactly.');
 assert.equal(parts.filter(p=>p.inlineData).length,10);
 assert.equal(parts.filter(p=>p.text?.startsWith('[ORIGINAL CHARACTER DESIGN SHEET:')).length,9);
 assert.match(parts.at(-1).text,/HIGHEST VISUAL PRIORITY/);assert.match(parts.at(-1).text,/O-wonjang: pale warm cream/);assert.match(parts.at(-1).text,/Somi: pale cream/);assert.match(parts.at(-1).text,/Deok-i: keep his own ORIGINAL yellow/);
 assert.match(parts[18].text,/NOT a character design reference/);assert.match(parts.at(-1).text,/No added fingers/);
 assert.throws(()=>policy.buildReferenceParts([{url:png,role:'scene'}],'x'),/원본/);
 assert.throws(()=>policy.buildReferenceParts(Array.from({length:15},()=>originals[0]),'x'),/14장/);
});
test('one character does not receive another character\'s color rule',()=>{
 const text=policy.buildReferenceParts(originals.slice(0,3),'x').at(-1).text;
 assert.match(text,/O-wonjang: pale/);assert.doesNotMatch(text,/Somi:|Deok-i:/);
});
test('failed and non-image reference downloads stop before generation',async()=>{
 const old=global.fetch;
 try{global.fetch=async()=>new Response('missing',{status:404});await assert.rejects(policy.loadReferenceImage('/missing.png'),/원본 사진/);
 global.fetch=async()=>new Response('<html>login</html>',{headers:{'Content-Type':'text/html'}});await assert.rejects(policy.loadReferenceImage('/bad.png'),/올바른 사진/);
 global.fetch=async()=>new Response(Buffer.from(png.split(',')[1],'base64'),{headers:{'Content-Type':'image/png'}});assert.equal(await policy.loadReferenceImage('/ok.png'),png);
 assert.throws(()=>policy.referenceData('data:text/html;base64,AAAA'),/참조 사진/);
 }finally{global.fetch=old;}
});
if(fs.existsSync(path.join(root,'src/hooks/useMediaGeneration.ts')))test('meme generator sends named originals with a lower-priority previous scene and stops on missing assets',async()=>{
 const calls=[],toasts=[];const old=global.fetch;
 const {handleGenerateImage}=compile('src/hooks/useMediaGeneration.ts',{'react':{useRef:v=>({current:v})},'../utils/db':{db:{get:async()=>({images:{first:png}})}},'../constants':{CHARACTERS:[{id:'owonjang',name:'오원장',file:'오원장.png',imgs:['front.png','side.png','back.png']}]},'../characterReference':policy}).useMediaGeneration(msg=>toasts.push(msg),async()=>{},'record',()=>{},{},()=>{}, {},'owonjang');
 try{global.fetch=async(url,options)=>{calls.push(url);return url==='/api/generate-image'?(calls.push(JSON.parse(options.body)),Response.json({result:png})):new Response(Buffer.from(png.split(',')[1],'base64'),{headers:{'Content-Type':'image/png'}});};
 assert.equal(await handleGenerateImage('second','O-wonjang holding toothpaste',1,[{title:'first',prompt:'old'}]),true);
 const request=calls.find(x=>typeof x==='object');assert.equal(request.parts.filter(p=>p.inlineData).length,4);assert.match(request.parts.at(-1).text,/O-wonjang: pale warm cream/);
 calls.length=0;global.fetch=async url=>{calls.push(url);return new Response('missing',{status:404});};assert.equal(await handleGenerateImage('third','O-wonjang',0,[]),false);assert.ok(!calls.includes('/api/generate-image'));assert.ok(toasts.length);
 }finally{global.fetch=old;}
});
if(fs.existsSync(path.join(root,'src/services/thumbnail/geminiService.ts')))test('marketing generation forwards every original and the final identity policy to Gemini',async()=>{
 let request;const service=compile('src/services/thumbnail/geminiService.ts',{'../geminiClient':{getGeminiClient:()=>({models:{generateContent:async r=>{request=r;return {candidates:[{content:{parts:[{inlineData:{data:png.split(',')[1]}}]}}]};}}})},'../../characterReference':policy});
 // The existing request timeout is unrelated to this immediate mocked response.
 const originalTimeout=global.setTimeout;global.setTimeout=(fn,ms,...args)=>{const t=originalTimeout(fn,ms,...args);if(ms===180000)t.unref();return t;};
 try{assert.equal(await service.generateImage({model:'gemini-3.1-flash-image',prompt:'Draw yellow fingers',referenceImages:[...originals,{url:png,role:'scene'}]}),png);assert.equal(request.contents.parts.filter(p=>p.inlineData).length,10);assert.match(request.contents.parts.at(-1).text,/O-wonjang: pale warm cream/);}finally{global.setTimeout=originalTimeout;}
});
