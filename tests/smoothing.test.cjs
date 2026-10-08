/* Dev-only tests: jsdom and native Canvas. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const native=require('@napi-rs/canvas');
const root=require('node:path').resolve(__dirname,'..');
const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/'});
const w=dom.window,d=w.document,backing=new WeakMap();
function back(el){if(!backing.has(el))backing.set(el,native.createCanvas(el.width,el.height));return backing.get(el);}
for(const prop of ['width','height']){const original=Object.getOwnPropertyDescriptor(w.HTMLCanvasElement.prototype,prop);Object.defineProperty(w.HTMLCanvasElement.prototype,prop,{get:original.get,set(v){original.set.call(this,v);if(backing.has(this))backing.get(this)[prop]=v;}});}
w.HTMLCanvasElement.prototype.getContext=function(){const ctx=back(this).getContext('2d');return new Proxy(ctx,{get(target,key){if(key==='drawImage')return(source,...args)=>target.drawImage(source instanceof w.HTMLCanvasElement?back(source):source,...args);const v=target[key];return typeof v==='function'?v.bind(target):v;},set(target,key,value){target[key]=value;return true;}});};
w.HTMLCanvasElement.prototype.toDataURL=function(){return back(this).toDataURL();};w.ImageData=native.ImageData;w.confirm=()=>true;w.URL.createObjectURL=()=> 'blob:fixture';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};w.setTimeout=()=>0;
const viewport=d.querySelector('#viewport');viewport.setPointerCapture=()=>{};
Object.defineProperty(viewport,'clientWidth',{value:1100});Object.defineProperty(viewport,'clientHeight',{value:850});
d.querySelector('#canvasWrap').getBoundingClientRect=()=>({left:0,top:0,width:960,height:720});
const frames=[];w.requestAnimationFrame=cb=>{frames.push(cb);return frames.length;};w.eval(fs.readFileSync(root+'/core.js','utf8'));w.eval(fs.readFileSync(root+'/app.js','utf8'));

const C=require('../core.js');
function key(code,key,mods={}){viewport.dispatchEvent(new w.KeyboardEvent('keydown',{code,key,bubbles:true,cancelable:true,...mods}));}
function event(type,p,coalesced=[]){const e=new w.MouseEvent(type,{clientX:p[0],clientY:p[1],button:0,bubbles:true,cancelable:true});Object.defineProperty(e,'pointerId',{value:1});if(coalesced.length)e.getCoalescedEvents=()=>coalesced.map(([clientX,clientY])=>({clientX,clientY}));viewport.dispatchEvent(e);}
function flush(){while(frames.length)frames.shift()();}
function stroke(points,amount=45){d.querySelector('#brushSmoothing').value=amount;d.querySelector('#brushSmoothing').dispatchEvent(new w.Event('input'));event('pointerdown',points[0]);for(const p of points.slice(1)){event('pointermove',p);flush();}event('pointerup',points.at(-1));flush();}
function pixel(x,y){return [...back(d.querySelector('#display')).getContext('2d').getImageData(x,y,1,1).data];}
function png(){return back(d.querySelector('#display')).toBuffer('image/png');}
function painted(x,y){return pixel(x,y)[1]<200;}
d.querySelector('#welcomeBlank').click();d.querySelector('#brushSize').value=6;d.querySelector('#color').value='#111111';
// The screenshot's sparse bent path should round corners rather than trace a polygon.
const sparse=[[120,100],[160,220],[280,240],[380,170],[380,100]];
stroke(sparse,0);const raw=png();assert.ok(painted(280,240));
d.querySelector('#undo').click();assert.deepEqual(pixel(280,240),[255,255,255,255]);
stroke(sparse);const smooth=png();assert.ok(!painted(280,240),'sharp raw corner should be rounded');assert.ok(painted(120,100));assert.ok(painted(380,100),'release endpoint must be reached');
const committed=png();d.querySelector('#undo').click();assert.deepEqual(pixel(120,100),[255,255,255,255]);d.querySelector('#redo').click();assert.deepEqual(png(),committed,'redo restores entire smoothed stroke');
// Cancel restores every pixel and late preview callbacks cannot resurrect the stroke.
event('pointerdown',[500,200]);event('pointermove',[600,220]);event('pointercancel',[600,220]);flush();assert.deepEqual(png(),committed);
// A simple click is still a dot.
stroke([[500,100]]);assert.ok(painted(500,100));d.querySelector('#undo').click();
// Coalesced points must preserve a curved excursion between two delivered events.
d.querySelector('#brushSmoothing').value=45;event('pointerdown',[500,300]);event('pointermove',[700,300],[[550,400],[650,400]]);flush();event('pointerup',[700,300]);flush();assert.ok(painted(600,397)||painted(600,394),'coalesced curved samples retained');d.querySelector('#undo').click();
// Single-stroke opacity cannot accumulate at overlaps.
d.querySelector('#brushOpacity').value=50;stroke([[500,500],[600,500],[500,500]],45);const alphaPixel=pixel(550,500);assert.ok(alphaPixel[0]>=127&&alphaPixel[0]<=139);d.querySelector('#undo').click();d.querySelector('#brushOpacity').value=100;
// Erasing follows the same path and supports undo.
d.querySelector('[data-tool="eraser"]').click();d.querySelector('#brushSize').value=20;stroke([[120,100]]);assert.deepEqual(pixel(120,100),[255,255,255,255]);d.querySelector('#undo').click();assert.deepEqual(png(),committed);
// Mask still constrains the entire curve.
d.querySelector('[data-tool="rect"]').click();event('pointerdown',[500,500]);event('pointermove',[600,600]);event('pointerup',[600,600]);d.querySelector('[data-tool="brush"]').click();stroke([[550,550],[650,550]]);assert.ok(painted(550,550));assert.deepEqual(pixel(620,550),[255,255,255,255]);
// Core filtering demonstrably suppresses jitter, including dense input.
let filter=C.strokeSmoother({x:0,y:0},75),out=[];for(let x=1;x<=400;x++)out.push(...filter.push({x,y:x%2?5:-5}));const tail=out.filter(p=>p.x>80);assert.ok(Math.max(...tail.map(p=>Math.abs(p.y)))<1,'jitter amplitude reduced by >80%');assert.deepEqual(filter.finish().at(-1),{x:400,y:-5});
let disabled=C.strokeSmoother({x:0,y:0},0);assert.deepEqual(disabled.push({x:20,y:15}),[{x:20,y:15}]);
function end(step){let f=C.strokeSmoother({x:0,y:0},65);let pts;for(let x=step;x<=200;x+=step)pts=f.push({x,y:0});return pts.at(-1).x;}
assert.ok(Math.abs(end(1)-end(10))<.01,'filter independent of input sampling density');
assert.equal(w.localStorage.getItem('contour-brush-smoothing'),'45');
const preview=native.createCanvas(960,720),pc=preview.getContext('2d');
(async()=>{pc.fillStyle='#fff';pc.fillRect(0,0,960,720);pc.drawImage(await native.loadImage(raw),0,40);pc.drawImage(await native.loadImage(smooth),420,40);pc.fillStyle='#25303a';pc.font='24px sans-serif';pc.fillText('0% — прямые отрезки',70,65);pc.fillText('45% — плавная линия',490,65);pc.font='18px sans-serif';pc.fillText('Одинаковые точки движения мыши; кисть 6 px',70,470);fs.writeFileSync(root+'/tests/smoothing-preview.png',preview.toBuffer('image/png'));console.log('Smoothing verified: sparse corners rounded, >80% jitter reduction, sampling independence, release endpoint, coalesced input, dot, one-step undo/redo, cancel, mask, eraser, uniform opacity, saved setting.');w.close();})().catch(e=>{console.error(e);w.close();process.exitCode=1;});
