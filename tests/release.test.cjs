const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const support = require('../lib/entries');
const good = {id:'custom_123_456',label:'入口',width:1440,height:2560,dpi:640,imageWidth:80,imageHeight:100,region:[20,400,320,300]};
assert.equal(support.validate(good),good);
for(const patch of [{id:'../../escape'}, {dpi:320}, {width:900}, {region:[0,700,300,200]}, {region:[-1,400,300,200]}, {imageWidth:400}, {imageHeight:NaN}, {region:[0,400,300.5,200]}, {label:'x'.repeat(81)}]) {
  assert.throws(()=>support.validate({...good,...patch}));
}
const root='/project';
const fileApi={exists:p=>p===root+'/custom/entries.json'||p===root+'/custom/entries/'+good.id+'.png',read:()=>JSON.stringify([good])};
assert.equal(support.load(fileApi,root).length,1);
assert.deepEqual(support.load({exists:()=>false},root),[]);
assert.throws(()=>support.load({...fileApi,read:()=>JSON.stringify([good,good])},root));
assert.throws(()=>support.load({...fileApi,exists:p=>p.endsWith('entries.json')},root));
assert.throws(()=>support.load({...fileApi,read:()=>'{bad'},root));
const runner=fs.readFileSync(path.join(__dirname,'../runner.js'),'utf8');
for(const name of ['main.js','runner.js','导入福袋图片.js','lib/entries.js']) new vm.Script(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),{filename:name});
assert(!runner.includes('/fudai-active-run.txt'));
assert(!runner.includes('/ldplayer-1440x2560/main.js'));
assert(runner.includes('/douyin-live-helper-active-run.txt'));
assert(runner.includes('__engineSource.replace(/^file:'));
assert(runner.indexOf('const pinkPanel =') < runner.indexOf('var customEntry ='));
assert(runner.includes('max: 1, level: 0'));
const guardText=runner.match(/function isSafeImageTarget[\s\S]*?\n}\n/)[0];
const guard=vm.runInNewContext('('+guardText+')');
const window={packageName:'dy',active:true,focused:true,bounds:[0,0,1440,2560]};
assert.equal(guard({x:40,y:430},'dy',window,'dy'),true);
assert.equal(guard({x:40,y:430},'other',window,'dy'),false);
assert.equal(guard({x:1500,y:430},'dy',window,'dy'),false);
assert.equal(guard({x:40,y:430},'dy',{...window,packageName:'payment'},'dy'),false);
const should=vm.runInNewContext('('+runner.match(/function shouldStartTask[\s\S]*?\n}/)[0]+')');
assert.equal(should(0,false,1,4000),true);
assert.equal(should(1,true,2,4000),true);
assert.equal(should(2,true,2,4000),false);
assert.equal(should(1,true,2,2000),false);
// Exercise the actual importer script with mocked Android file/image/dialog APIs.
const importer=fs.readFileSync(path.join(__dirname,'../导入福袋图片.js'),'utf8');
function runImport(rawInputs, dimensions=[1440,2560]) {
  const writes={}, removed=[], alerts=[], recycled=[];
  let selections=[0,0];
  const api={
    threads:{start:f=>f()},
    engines:{myEngine:()=>({getSource:()=>root+'/导入福袋图片.js'})},
    require:()=>support,
    dialogs:{select:()=>selections.shift(),confirm:()=>true,rawInput:()=>rawInputs.shift(),alert:(...x)=>alerts.push(x)},
    files:{exists:p=>Object.hasOwn(writes,p),read:p=>writes[p],listDir:()=>[],isDir:()=>false,join:(a,b)=>a+'/'+b,ensureDir:()=>{},write:(p,v)=>{writes[p]=v;},remove:p=>{removed.push(p);delete writes[p];}},
    images:{read:()=>({getWidth:()=>dimensions[0],getHeight:()=>dimensions[1],recycle:()=>recycled.push('original')}),clip:()=>({recycle:()=>recycled.push('crop')}),save:(img,p)=>{writes[p]='PNG';}}
  };
  vm.runInNewContext(importer,api);
  return {writes,removed,alerts,recycled};
}
let result=runImport(['/sdcard/Download/screen.png','40,430,140,120','20,400,320,300','Test']);
assert.equal(result.alerts[0][0],'导入完成');
const saved=JSON.parse(result.writes[root+'/custom/entries.json']);
assert.equal(saved.length,1);
assert.equal(saved[0].imageWidth,140);
assert.equal(Object.keys(result.writes).length,2);
assert.equal(result.recycled.length,2);
result=runImport(['/sdcard/Download/screen.png','40,430,140,120','20,400,320,300','Test'],[900,1600]);
assert.equal(result.alerts[0][0],'导入失败');
assert.equal(Object.keys(result.writes).length,0);
result=runImport(['/sdcard/Download/screen.png',null]);
assert.equal(Object.keys(result.writes).length,0);
assert.equal(result.recycled.length,1);
result=runImport(['/sdcard/Download/screen.png','40,430,140,120','20,700,320,300','Test']);
assert.equal(result.alerts[0][0],'导入失败');
assert.equal(Object.keys(result.writes).length,0);
console.log('PASS: syntax, manifest, path validation, isolation, matching priority, click bounds, retries, importer save/cancel/wrong-resolution/invalid-region and image recycling');
