const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const native=require('@napi-rs/canvas');
const root=require('node:path').resolve(__dirname,'..');
function harness(store){
const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/'});
const w=dom.window,d=w.document,backing=new WeakMap();
function back(el){if(!backing.has(el))backing.set(el,native.createCanvas(el.width,el.height));return backing.get(el);}
for(const prop of ['width','height']){const original=Object.getOwnPropertyDescriptor(w.HTMLCanvasElement.prototype,prop);Object.defineProperty(w.HTMLCanvasElement.prototype,prop,{get:original.get,set(v){original.set.call(this,v);if(backing.has(this))backing.get(this)[prop]=v;}});}
w.HTMLCanvasElement.prototype.getContext=function(){const ctx=back(this).getContext('2d');return new Proxy(ctx,{get(target,key){if(key==='drawImage')return(source,...args)=>target.drawImage(source instanceof w.HTMLCanvasElement?back(source):source.native||source,...args);const v=target[key];return typeof v==='function'?v.bind(target):v;},set(target,key,value){target[key]=value;return true;}});};
w.HTMLCanvasElement.prototype.toDataURL=function(){return back(this).toDataURL();};w.ImageData=native.ImageData;w.Blob=global.Blob;w.confirm=()=>true;const urls=new Map();let seq=0;w.URL.createObjectURL=blob=>{const url='blob:fixture-'+(++seq);urls.set(url,blob);return url;};w.URL.revokeObjectURL=url=>urls.delete(url);w.Image=class{set src(url){urls.get(url).arrayBuffer().then(bytes=>native.loadImage(Buffer.from(bytes))).then(image=>{this.native=image;this.naturalWidth=image.width;this.naturalHeight=image.height;this.onload();}).catch(()=>this.onerror());}};w.HTMLAnchorElement.prototype.click=()=>{};const timers=new Map();let timerId=0;w.setTimeout=cb=>{timers.set(++timerId,cb);return timerId;};w.clearTimeout=id=>timers.delete(id);w.ContourDraftStore=store;w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};w.HTMLCanvasElement.prototype.toBlob=function(cb){const blob=new Blob([back(this).toBuffer('image/png')],{type:'image/png'});queueMicrotask(()=>cb(blob));};
const viewport=d.querySelector('#viewport');viewport.setPointerCapture=()=>{};
viewport.getBoundingClientRect=()=>({left:0,top:0,right:1100,bottom:850});
Object.defineProperty(viewport,'clientWidth',{value:1100});Object.defineProperty(viewport,'clientHeight',{value:850});
d.querySelector('#canvasWrap').getBoundingClientRect=()=>({left:0,top:0,width:960,height:720});
const frames=[];w.requestAnimationFrame=cb=>{frames.push(cb);return frames.length;};w.eval(fs.readFileSync(root+'/core.js','utf8'));w.eval(fs.readFileSync(root+'/app.js','utf8'));

function event(type,x,y,extra={}){const e=new w.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true,...extra});Object.defineProperty(e,'pointerId',{value:1});viewport.dispatchEvent(e);}
function key(type,code,extra={}){viewport.dispatchEvent(new w.KeyboardEvent(type,{code,bubbles:true,cancelable:true,...extra}));}
function stroke(points,extra={}){event('pointerdown',...points[0],extra);for(const p of points.slice(1))event('pointermove',...p,extra);event('pointerup',...points.at(-1),extra);while(frames.length)frames.shift()();}
function image(){return Buffer.from(back(d.getElementById('display')).getContext('2d').getImageData(0,0,960,720).data);}
return {w,d,back,timers,event,key,stroke,image};
}
async function settle(){for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));}
async function runTimer(h){const callbacks=[...h.timers.values()];h.timers.clear();callbacks.forEach(cb=>cb());await settle();}
// Clearing uses the active layer, preserves an irregular mask, and remains undoable.
const clear=harness({read:async()=>null,write:async()=>{}}),cd=clear.d,cv=cd.getElementById('viewport');
cd.getElementById('welcomeBlank').click();cd.getElementById('brushSize').value=60;cd.getElementById('color').value='#3f7f8a';clear.stroke([[200,200],[240,200]]);const bottom=clear.image();
cd.getElementById('addLayer').click();cd.getElementById('color').value='#bd6152';clear.stroke([[200,200],[240,200]]);const both=clear.image();
cd.querySelector('[data-tool="rect"]').click();clear.stroke([[190,190],[220,220]]);clear.stroke([[200,200],[210,210]],{altKey:true});const boundary=cd.querySelector('#selectionOutline path').getAttribute('d'),count=cd.getElementById('selectionInfo').textContent;
for(const code of ['Delete','Backspace']){
 const e=new clear.w.KeyboardEvent('keydown',{code,bubbles:true,cancelable:true});cv.dispatchEvent(e);assert.equal(e.defaultPrevented,true);
 const expected=Buffer.from(both);for(let y=190;y<220;y++)for(let x=190;x<220;x++)if(!(x>=200&&x<210&&y>=200&&y<210)){const i=(y*960+x)*4;bottom.copy(expected,i,i,i+4);}
 assert.deepEqual(clear.image(),expected,'only selected pixels of the top layer clear');assert.equal(cd.querySelector('#selectionOutline path').getAttribute('d'),boundary);assert.equal(cd.getElementById('selectionInfo').textContent,count);
 cd.getElementById('undo').click();assert.deepEqual(clear.image(),both);cd.getElementById('redo').click();assert.deepEqual(clear.image(),expected);
 clear.key('keydown',code);cd.getElementById('undo').click();assert.deepEqual(clear.image(),both,'repeating on empty pixels adds no history entry');
}
cd.querySelector('.layer-row.active button:last-child').click();clear.key('keydown','Delete');assert.deepEqual(clear.image(),both);assert.match(cd.getElementById('status').textContent,/защищён/);cd.querySelector('.layer-row.active button:last-child').click();
cd.querySelector('.layer-row.active button').click();const hidden=clear.image();clear.key('keydown','Backspace');assert.deepEqual(clear.image(),hidden);assert.match(cd.getElementById('status').textContent,/скрыт/);cd.querySelector('.layer-row.active button').click();
const input=cd.getElementById('colorHex');input.dispatchEvent(new clear.w.KeyboardEvent('keydown',{code:'Backspace',bubbles:true,cancelable:true}));assert.deepEqual(clear.image(),both);
cd.getElementById('help').click();clear.key('keydown','Delete');assert.deepEqual(clear.image(),both);cd.getElementById('helpDialog').close();
cd.getElementById('clearSelection').click();assert.notDeepEqual(clear.image(),both);cd.getElementById('undo').click();assert.deepEqual(clear.image(),both);cd.getElementById('deselect').click();clear.key('keydown','Backspace');assert.deepEqual(clear.image(),both);assert.equal(cd.getElementById('clearSelection').disabled,true);
clear.key('keydown','Tab');assert.equal(cv.classList.contains('keyboard-focus'),true);clear.event('pointerdown',10,10);assert.equal(cv.classList.contains('keyboard-focus'),false);clear.w.close();
// Exhaustive 3x3 masks: filled traced loops must exactly match the selected cells.
const C=require('../core.js');for(let bits=0;bits<512;bits++){const mask=Uint8Array.from({length:9},(_,i)=>(bits>>i)&1),copy=mask.slice(),c=native.createCanvas(3,3),ctx=c.getContext('2d'),outline=C.selectionOutline(mask,3,3);if(outline)ctx.fill(new native.Path2D(outline));const pixels=ctx.getImageData(0,0,3,3).data;for(let i=0;i<9;i++)assert.equal(pixels[i*4+3],mask[i]*255,'outline '+bits+' pixel '+i);assert.deepEqual(mask,copy);}assert.ok(C.selectionOutline(new Uint8Array(10000).fill(1),100,100).length<40);
(async()=>{
let stored=null,fail=false,writes=0;const store={read:async()=>stored?structuredClone(stored):null,write:async p=>{if(fail)throw Error('quota');stored=structuredClone(p);writes++;}};
const h=harness(store);await settle();h.d.getElementById('welcomeBlank').click();h.d.getElementById('color').value='#3f7f8a';h.d.getElementById('brushSize').value=9;h.stroke([[100,100],[180,140]]);const painted=h.image();
// Temporary picker samples without touching pixels or creating an undo action.
h.d.getElementById('color').value='#bd6152';h.key('keydown','AltLeft',{altKey:true});assert.equal(h.d.querySelector('[data-tool].selected').dataset.tool,'picker');h.stroke([[100,100]],{altKey:true});assert.equal(h.d.getElementById('color').value,'#3f7f8a');assert.deepEqual(h.image(),painted);h.key('keyup','AltLeft');assert.equal(h.d.querySelector('[data-tool].selected').dataset.tool,'brush');h.d.getElementById('undo').click();assert.ok(h.image().every(v=>v===255),'picker did not add an undo entry');h.d.getElementById('redo').click();
// Alt still subtracts selections, and hiding the boundary keeps its clipping mask.
h.d.querySelector('[data-tool="rect"]').click();h.stroke([[95,95],[120,120]]);const path=h.d.querySelector('#selectionOutline path').getAttribute('d');assert.ok(path.endsWith('Z'));assert.equal(h.d.getElementById('selectionOutline').hasAttribute('hidden'),false);h.d.getElementById('toggleSelectionOutline').click();assert.equal(h.d.getElementById('selectionOutline').hasAttribute('hidden'),true);assert.notEqual(h.d.getElementById('selectionInfo').textContent,'Без выделения');h.stroke([[100,100],[105,105]],{altKey:true});assert.notEqual(h.d.querySelector('#selectionOutline path').getAttribute('d'),path);h.d.getElementById('deselect').click();
h.d.querySelector('[data-tool="pencil"]').click();h.d.getElementById('pencilSize').value=2;h.event('pointermove',220,220);assert.equal(h.d.getElementById('toolCursor').style.getPropertyValue('--cursor-color'),'#3f7f8a');assert.equal(h.d.getElementById('toolCursor').style.backgroundColor,'rgba(63, 127, 138, 0.2)');
// Store, restore and then undo a new stroke against the recovered document.
await runTimer(h);assert.ok(stored);assert.equal(stored.layers.length,2);assert.equal(stored.layers[1].png.type,'image/png');const recovered=harness(store);await settle();assert.equal(recovered.d.getElementById('draftDialog').hasAttribute('open'),true);recovered.d.getElementById('restoreDraft').click();for(let i=0;i<60&&recovered.d.getElementById('restoreDraft').disabled;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(recovered.d.getElementById('draftDialog').hasAttribute('open'),false);assert.deepEqual(recovered.image(),painted);assert.equal(recovered.d.getElementById('dirtyMark').hidden,false);assert.equal(recovered.d.getElementById('undo').disabled,true);recovered.stroke([[250,250]]);recovered.d.getElementById('undo').click();assert.deepEqual(recovered.image(),painted);await runTimer(recovered);assert.equal(stored.settings.tool,'pencil');
// Failed storage does not claim success or replace the previous good draft.
const good=stored;fail=true;recovered.stroke([[260,260]]);await runTimer(recovered);assert.equal(stored,good);assert.match(recovered.d.getElementById('draftStatus').textContent,/не сохранён/);fail=false;
// While encoding, a newer stroke supersedes the old snapshot.
const deferred=[];recovered.w.HTMLCanvasElement.prototype.toBlob=function(cb){const blob=new Blob([recovered.back(this).toBuffer('image/png')],{type:'image/png'});deferred.push(()=>cb(blob));};recovered.stroke([[280,280]]);const n=writes;const callbacks=[...recovered.timers.values()];recovered.timers.clear();callbacks.forEach(cb=>cb());await settle();recovered.stroke([[290,290]]);deferred.splice(0).forEach(cb=>cb());await settle();assert.equal(writes,n,'obsolete encoding must not overwrite current state');
console.log('UX and draft verified: Alt sampling without painting, tool return, subtraction preserved, loop outline, hide without deselection, colored cursor, PNG layers, restore, dirty state, post-restore undo, quota failure and stale-write prevention.');h.w.close();recovered.w.close();
})().catch(e=>{console.error(e);process.exitCode=1});
