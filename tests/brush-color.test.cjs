/* Dev-only tests: jsdom and native Canvas. */
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


function event(type,x,y){const e=new w.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true});Object.defineProperty(e,'pointerId',{value:1});viewport.dispatchEvent(e);}
function flush(){while(frames.length)frames.shift()();}
function stroke(points){event('pointerdown',...points[0]);for(const p of points.slice(1)){event('pointermove',...p);flush();}event('pointerup',...points.at(-1));flush();}
function pixel(x,y){return [...back(d.querySelector('#display')).getContext('2d').getImageData(x,y,1,1).data];}
function png(){return back(d.querySelector('#display')).toBuffer('image/png');}
function colors(x,y,width,height){const data=back(d.querySelector('#display')).getContext('2d').getImageData(x,y,width,height).data;const found=new Set();for(let i=0;i<data.length;i+=4)found.add([...data.slice(i,i+4)].join(','));return found;}
d.querySelector('#welcomeBlank').click();d.querySelector('#color').value='#3f7f8a';d.querySelector('#brushSize').value=9;
const path=[[100.35,100.7],[120.3,130.8],[150.6,135.3],[180.2,110.1]];
stroke(path);const found=colors(80,80,120,80);assert.deepEqual([...found].sort(),['255,255,255,255','63,127,138,255'].sort(),'opaque brush must have no mixed edge colours');
const hard=png();assert.equal(d.querySelector('#brushAntialias').checked,false);d.querySelector('#undo').click();assert.deepEqual(pixel(100,100),[255,255,255,255]);d.querySelector('#redo').click();assert.deepEqual(png(),hard);
// A second colour, over an existing coloured stroke, fully replaces covered cells.
d.querySelector('#color').value='#bd6152';stroke([[100.2,100.4],[180.6,110.2]]);const overlapping=colors(80,80,120,80);assert.deepEqual([...overlapping].sort(),['255,255,255,255','63,127,138,255','189,97,82,255'].sort());
// Explicit antialiasing remains available and is independent of trajectory smoothing.
d.querySelector('#brushAntialias').checked=true;d.querySelector('#color').value='#000000';stroke([[300.3,100.4],[380.4,130.2]]);assert.ok(colors(280,80,120,70).size>2);d.querySelector('#brushAntialias').checked=false;
// Opacity still works deliberately, uniformly, without additional fringe colours.
d.querySelector('#brushOpacity').value=50;stroke([[300.3,220.4],[380.4,250.2]]);assert.deepEqual([...colors(280,200,120,70)].sort(),['255,255,255,255','127,127,127,255'].sort());d.querySelector('#brushOpacity').value=100;
// Erasing a hard stroke at 100% leaves only the original colour or white.
d.querySelector('[data-tool="eraser"]').click();stroke([[120.3,130.8],[150.6,135.3]]);assert.deepEqual([...colors(80,80,120,80)].sort(),['255,255,255,255','63,127,138,255','189,97,82,255'].sort());
// A hard 1px brush tap must not vanish at an integer coordinate.
d.querySelector('[data-tool="brush"]').click();d.querySelector('#brushSize').value=1;d.querySelector('#color').value='#ff0000';stroke([[400,400]]);assert.deepEqual(pixel(400,400),[255,0,0,255]);d.querySelector('#brushSize').value=9;
// Editing must respect the selection even when producing a binary brush mask.
d.querySelector('[data-tool="rect"]').click();event('pointerdown',500,500);event('pointermove',510,510);event('pointerup',510,510);d.querySelector('[data-tool="brush"]').click();d.querySelector('#color').value='#ff0000';stroke([[505.2,505.3],[520.4,505.6]]);assert.deepEqual(pixel(505,505),[255,0,0,255]);assert.deepEqual(pixel(515,505),[255,255,255,255]);
// Capture a small native stroke fixture for live-browser verification if useful.
const fixture=native.createCanvas(32,24),fc=fixture.getContext('2d');fc.fillStyle='#fff';fc.fillRect(0,0,32,24);fs.writeFileSync(root+'/tests/brush-fixture.png',fixture.toBuffer('image/png'));
console.log('Brush colour verified: only selected solid colours at 100%, no mixed edge colours, overlapping colours replace, optional antialias, intentional opacity, hard eraser, mask, undo/redo.');w.close();
