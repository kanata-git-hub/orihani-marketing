const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createRequire}=require('node:module');
// Resolve the exact cleanup dependency used by the Firestore API's google-gax.
const apiRequire=createRequire(require.resolve('@google-cloud/firestore-api'));
const gaxRequire=createRequire(apiRequire.resolve('google-gax'));
const {rimraf,rimrafSync}=gaxRequire('rimraf');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ori-cleanup-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const name of ['delete-one','delete-two','keep']){
  fs.mkdirSync(path.join(dir,name));fs.writeFileSync(path.join(dir,name,'file.txt'),'synthetic');
 }
 return dir;
}
test('Firestore cleanup dependency preserves literal and async glob removal',async t=>{
 const dir=fixture(t);
 assert.equal(await rimraf(path.join(dir,'delete-one')),true);
 assert.equal(await rimraf('delete-*',{glob:{cwd:dir}}),true);
 assert.deepEqual(fs.readdirSync(dir),['keep']);
});
test('Firestore cleanup dependency preserves sync glob removal',t=>{
 const dir=fixture(t);
 assert.equal(rimrafSync('delete-*',{glob:{cwd:dir}}),true);
 assert.deepEqual(fs.readdirSync(dir),['keep']);
});
test('an aborted glob cleanup rejects without deleting its targets',async t=>{
 const dir=fixture(t),controller=new AbortController();controller.abort();
 await assert.rejects(rimraf('delete-*',{glob:{cwd:dir},signal:controller.signal}),e=>e.name==='AbortError');
 assert.deepEqual(fs.readdirSync(dir).sort(),['delete-one','delete-two','keep']);
});
