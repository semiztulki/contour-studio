/* Regression and work-volume checks using native Canvas; no production instrumentation. */
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {JSDOM}=require('jsdom'),native=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
function harness(source){
const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/'});
const w=dom.window,d=w.document,backing=new WeakMap();
function back(el){if(!backing.has(el))backing.set(el,native.createCanvas(el.width,el.height));return backing.get(el);}
for(const prop of ['width','height']){const original=Object.getOwnPropertyDescriptor(w.HTMLCanvasElement.prototype,prop);Object.defineProperty(w.HTMLCanvasElement.prototype,prop,{get:original.get,set(v){original.set.call(this,v);if(backing.has(this))backing.get(this)[prop]=v;}});}
const stats={readPixels:0,displayPixels:0,thumbnails:0};
w.HTMLCanvasElement.prototype.getContext=function(){const el=this,ctx=back(this).getContext('2d');return new Proxy(ctx,{get(target,key){if(key==='getImageData')return(x,y,width,height)=>{stats.readPixels+=width*height;return target.getImageData(x,y,width,height);};if(key==='drawImage')return(source,...args)=>{const src=source instanceof w.HTMLCanvasElement?back(source):source;if(el.id==='display')stats.displayPixels+=args.length===8?args[6]*args[7]:src.width*src.height;return target.drawImage(src,...args);};const v=target[key];return typeof v==='function'?v.bind(target):v;},set(target,key,value){target[key]=value;return true;}});};
w.HTMLCanvasElement.prototype.toDataURL=function(){if(this.width===34&&this.height===30)stats.thumbnails++;return back(this).toDataURL();};w.ImageData=native.ImageData;w.confirm=()=>true;w.URL.createObjectURL=()=> 'blob:fixture';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};w.setTimeout=()=>0;
const viewport=d.querySelector('#viewport');viewport.setPointerCapture=()=>{};
Object.defineProperty(viewport,'clientWidth',{value:1100});Object.defineProperty(viewport,'clientHeight',{value:850});
d.querySelector('#canvasWrap').getBoundingClientRect=()=>({left:0,top:0,width:960,height:720});
const frames=[];w.requestAnimationFrame=cb=>{frames.push(cb);return frames.length;};w.eval(fs.readFileSync(root+'/core.js','utf8'));w.HTMLDialogElement.prototype.close=()=>{};w.eval(source.replace("  initialize(960,720,'Без названия');","  window.testHistory=()=>({undo:undoStack,redo:redoStack,bytes:undoStack.map(stateBytes)});initialize(960,720,'Без названия');"));

function event(type,x,y){const e=new w.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true});Object.defineProperty(e,'pointerId',{value:1});viewport.dispatchEvent(e);}
function flush(){while(frames.length)frames.shift()();}
function stroke(points){event('pointerdown',...points[0]);for(const p of points.slice(1)){event('pointermove',...p);flush();}event('pointerup',...points.at(-1));flush();}
function click(id){d.getElementById(id).click();flush();}
function tool(name){(name==='rect'?d.querySelector('[data-selection-mode="rect"]'):name==='pencil'?d.querySelector('[data-brush-shape="square"]'):d.querySelector('[data-tool="'+name+'"]')).click();}
function set(id,value){d.getElementById(id).value=value;}
function newDoc(width,height){set('newWidth',width);set('newHeight',height);click('createDoc');set('zoom100',100);d.getElementById('zoom100').dispatchEvent(new w.Event('change'));}
function image(){return Buffer.from(back(d.getElementById('display')).getContext('2d').getImageData(0,0,d.getElementById('display').width,d.getElementById('display').height).data);}
function reset(){stats.readPixels=stats.displayPixels=stats.thumbnails=0;}
return {w,d,back,stats,event,flush,stroke,click,tool,set,newDoc,image,reset};
}
const source=fs.readFileSync(root+'/app.js','utf8');
const h=harness(source);h.newDoc(2000,1500);h.click('addLayer');h.set('brushSize',9);h.set('color','#3f7f8a');h.reset();h.stroke([[110,110],[120,118],[130,122],[140,120]]);
const work={...h.stats},history=h.w.testHistory();assert.equal(work.thumbnails,1,'one edited thumbnail');assert.ok(work.readPixels<100000,'small stroke must not read full layers');assert.ok(work.displayPixels<100000,'preview must composite only small rectangles');assert.equal(history.undo.at(-1).kind,'patch');assert.ok(history.bytes.at(-1)<=4*128*128*4,'only the original intersected tiles are retained');
const painted=h.image();h.click('undo');h.click('redo');assert.deepEqual(h.image(),painted);h.reset();h.d.querySelector('.layer-row').click();assert.equal(h.stats.thumbnails,0,'switching layers reuses thumbnails');
console.log(JSON.stringify({canvas:'2000x1500',layers:3,smallStroke:work,undoPixelBytes:history.bytes.at(-1)}));h.w.close();
const optimized=harness(source);optimized.newDoc(2000,1500);optimized.click('addLayer');optimized.tool('pencil');optimized.set('brushSize',1);optimized.stroke([[100,100],[140,100],[140,140],[100,140],[100,100]]);optimized.tool('fill');optimized.reset();optimized.event('pointerdown',120,120);const fillUndo=optimized.w.testHistory();assert.equal(fillUndo.undo.at(-1).kind,'patch');assert.ok(fillUndo.bytes.at(-1)<=4*128*128*4,'bounded fill retains only its affected tiles');optimized.tool('move');optimized.reset();optimized.set('transformAngle',25);optimized.d.getElementById('transformAngle').dispatchEvent(new optimized.w.Event('input'));const firstPreview=optimized.stats.readPixels;assert.ok(firstPreview<150000,'transform preview captures local tiles, not all layers');optimized.set('transformAngle',35);optimized.d.getElementById('transformAngle').dispatchEvent(new optimized.w.Event('input'));assert.ok(optimized.stats.readPixels-firstPreview<150000,'repeated preview reuses original tiles');const transformed=optimized.image();optimized.click('applyTransform');const transformUndo=optimized.w.testHistory();assert.equal(transformUndo.undo.at(-1).kind,'patch');assert.ok(transformUndo.bytes.at(-1)<=4*128*128*4);optimized.click('undo');optimized.click('redo');assert.deepEqual(optimized.image(),transformed);console.log(JSON.stringify({boundedFillUndoBytes:fillUndo.bytes.at(-1),transformUndoBytes:transformUndo.bytes.at(-1),transformPreviewReadPixels:firstPreview,oldThreeLayerSnapshotBytes:2000*1500*3*4}));optimized.w.close();
// Compare to the previous renderer if a baseline is explicitly supplied.
const baselinePath=process.argv[2];
if(baselinePath){const base=harness(fs.readFileSync(baselinePath,'utf8'));base.newDoc(2000,1500);base.click('addLayer');base.set('brushSize',9);base.set('color','#3f7f8a');base.reset();base.stroke([[110,110],[120,118],[130,122],[140,120]]);console.log(JSON.stringify({baselineSmallStroke:{...base.stats},baselineUndoPixelBytes:base.w.testHistory().bytes.at(-1)}));base.w.close();}
const old=baselinePath?harness(fs.readFileSync(baselinePath,'utf8')):null;
const current=harness(source),both=old?[current,old]:[current];
function apply(fn){for(const e of both)fn(e);if(old)assert.deepEqual(current.image(),old.image(),'optimized output must match the previous renderer byte for byte');}
apply(e=>e.newDoc(333,257));
const states=[current.image()];
for(const opacity of [100,50]){
 apply(e=>{e.set('brushOpacity',opacity);e.set('brushSize',17);e.set('color','#bd6152');e.stroke([[2.3,2.8],[125.4,127.6],[260.7,250.9],[130.2,125.2],[20,200],[330,2]]);});states.push(current.image());
}
apply(e=>{e.click('addLayer');});states.push(current.image());
apply(e=>{e.set('color','#3f7f8a');e.set('brushOpacity',50);e.stroke([[10,130],[325,132],[130,2]]);});states.push(current.image());
apply(e=>{e.set('blendMode','multiply');e.d.getElementById('blendMode').dispatchEvent(new e.w.Event('change'));});states.push(current.image());
apply(e=>{e.tool('eraser');e.set('brushOpacity',100);e.stroke([[127,125],[130,250],[260,130]]);});states.push(current.image());
apply(e=>e.click('deleteLayer'));states.push(current.image());
for(let i=states.length-2;i>=0;i--){apply(e=>e.click('undo'));assert.deepEqual(current.image(),states[i],'mixed history undo '+i);}
for(let i=1;i<states.length;i++){apply(e=>e.click('redo'));assert.deepEqual(current.image(),states[i],'mixed history redo '+i);}
apply(e=>{e.tool('rect');e.event('pointerdown',120,120);e.event('pointermove',140,140);e.event('pointerup',140,140);e.tool('pencil');e.set('brushSize',2);e.stroke([[125,125],[135,135],[145,125]]);});
apply(e=>{e.click('undo');e.click('redo');});
const beforeCancel=current.image();apply(e=>{e.tool('brush');e.event('pointerdown',121,121);e.event('pointermove',300,250);e.flush();e.event('pointercancel',300,250);e.flush();});assert.deepEqual(current.image(),beforeCancel,'cancel restores every captured tile');
// Fill changes one existing thumbnail; visibility, opacity, names and reorder reuse it.
current.click('deselect');current.tool('fill');current.reset();current.event('pointerdown',320,240);assert.equal(current.stats.thumbnails,1);
current.reset();current.d.querySelector('.layer-row button').click();assert.equal(current.stats.thumbnails,0);
console.log('Performance regression passed: partial previews, tile history, cache invalidation, long strokes, edge tiles, opacity, hard edges, mask, cancel and mixed structural undo/redo.'+(old?' Baseline image comparison passed.':''));for(const e of both)e.w.close();
