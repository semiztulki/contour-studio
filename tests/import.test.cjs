/* Dev-only regression test. Requires jsdom and @napi-rs/canvas; the app has no dependencies. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),native=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/'});
const w=dom.window,d=w.document,backing=new WeakMap(),urls=new Map();let sequence=0;
function back(el){if(!backing.has(el))backing.set(el,native.createCanvas(el.width,el.height));return backing.get(el);}
for(const prop of ['width','height']){const original=Object.getOwnPropertyDescriptor(w.HTMLCanvasElement.prototype,prop);Object.defineProperty(w.HTMLCanvasElement.prototype,prop,{get:original.get,set(v){original.set.call(this,v);if(backing.has(this))backing.get(this)[prop]=v;}});}
w.HTMLCanvasElement.prototype.getContext=function(){const ctx=back(this).getContext('2d');return new Proxy(ctx,{get(target,key){if(key==='drawImage')return(source,...args)=>target.drawImage(source instanceof w.HTMLCanvasElement?back(source):source.native||source,...args);const v=target[key];return typeof v==='function'?v.bind(target):v;},set(target,key,value){target[key]=value;return true;}});};
w.HTMLCanvasElement.prototype.toDataURL=function(){return back(this).toDataURL();};w.ImageData=native.ImageData;w.confirm=()=>true;
w.URL.createObjectURL=file=>{const url='blob:fixture-'+(++sequence);urls.set(url,file);return url;};w.URL.revokeObjectURL=url=>urls.delete(url);
w.Image=class{
  set src(url){const file=urls.get(url);if(file?.dimensions){this.naturalWidth=file.dimensions[0];this.naturalHeight=file.dimensions[1];queueMicrotask(()=>this.onload?.());return;}
    native.loadImage(file?.bytes||Buffer.from('broken')).then(image=>{this.native=image;this.naturalWidth=image.width;this.naturalHeight=image.height;this.onload?.();}).catch(()=>this.onerror?.());}
};
const viewport=d.querySelector('#viewport');Object.defineProperty(viewport,'clientWidth',{value:1200});Object.defineProperty(viewport,'clientHeight',{value:900});
w.eval(fs.readFileSync(root+'/core.js','utf8'));w.eval(fs.readFileSync(root+'/app.js','utf8'));
const input=d.querySelector('#imageInput');
function choose(file){Object.defineProperty(input,'files',{configurable:true,value:[file]});input.dispatchEvent(new w.Event('change'));}
async function settled(){for(let i=0;i<100;i++){if(!d.querySelector('#status').textContent.startsWith('Открываю'))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Import did not settle');}
(async()=>{
  const fixture=native.createCanvas(4000,3000),fc=fixture.getContext('2d');fc.fillStyle='#fff';fc.fillRect(0,0,4000,3000);fc.fillStyle='#234567';fc.fillRect(0,0,20,20);
  const bytes=fixture.toBuffer('image/png');const file={name:'Большой рисунок.png',size:bytes.length,bytes};
  choose(file);assert.equal(d.querySelector('#fileNotice').hidden,false);await settled();
  assert.equal(d.querySelector('#dimensions').textContent,'4000 × 3000 px');assert.equal(d.querySelector('#welcome').hidden,true);assert.equal(d.querySelector('#fileNotice').hidden,true);assert.equal(d.querySelectorAll('.layer-row').length,2);
  assert.deepEqual([...back(d.querySelector('#display')).getContext('2d').getImageData(1,1,1,1).data],[35,69,103,255]);
  choose({name:'Слишком большой.png',size:200,dimensions:[5000,5000]});await settled();
  assert.equal(d.querySelector('#fileNotice').hidden,false);assert.equal(d.querySelector('#fileNotice').getAttribute('role'),'alert');assert.match(d.querySelector('#fileNoticeText').textContent,/5000 × 5000.*24 миллионов/);
  assert.equal(d.querySelector('#dimensions').textContent,'4000 × 3000 px');
  choose({name:'Повреждённый.png',size:6,bytes:Buffer.from('broken')});await settled();
  assert.match(d.querySelector('#fileNoticeText').textContent,/Не удалось открыть «Повреждённый.png»/);assert.equal(d.querySelector('#fileNotice').hidden,false);
  // Selecting the same good file again must succeed after a failed import.
  choose(file);await settled();assert.equal(d.querySelector('#fileNotice').hidden,true);assert.match(d.querySelector('#status').textContent,/Рисунок открыт/);assert.equal(urls.size,0);
  console.log('PNG import verified: 4000×3000 at full resolution, visible loading/error, oversize and corrupt-file rejection preserve the document, same-file retry, Blob URL cleanup.');w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1;});
