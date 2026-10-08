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
function key(code,key){viewport.dispatchEvent(new w.KeyboardEvent('keydown',{code,key,bubbles:true,cancelable:true}));}
function zoom(percent){const select=d.querySelector('#zoom100');select.value=String(percent);select.dispatchEvent(new w.Event('change'));}
function pixel(x,y){return [...back(d.querySelector('#display')).getContext('2d').getImageData(x,y,1,1).data];}
function image(){return back(d.querySelector('#display')).toBuffer('image/png');}
function click(x,y){event('pointerdown',x,y);event('pointerup',x,y);}
d.querySelector('#welcomeBlank').click();key('KeyP','з');assert.equal(d.querySelector('[data-tool].selected').dataset.tool,'pencil');assert.equal(d.querySelector('#pencilSizeControl').hidden,false);assert.equal(d.querySelector('#brushSizeControl').hidden,true);
d.querySelector('#color').value='#000000';
// At 6400%, click a fractional position anywhere inside a pixel, not its centre.
zoom(6400);assert.equal(d.querySelector('#canvasWrap').style.width,'61440px');assert.equal(d.querySelector('#canvasWrap').classList.contains('pixel-view'),true);assert.equal(d.querySelector('#zoomIn').disabled,true);
click(10.1*64,10.95*64);assert.deepEqual(pixel(10,10),[0,0,0,255]);for(const [x,y] of [[9,10],[11,10],[10,9],[10,11]])assert.deepEqual(pixel(x,y),[255,255,255,255]);
const marked=image();d.querySelector('#undo').click();assert.deepEqual(pixel(10,10),[255,255,255,255]);d.querySelector('#redo').click();assert.deepEqual(image(),marked);
// Zoom affects presentation only.
zoom(50);assert.equal(d.querySelector('#canvasWrap').classList.contains('pixel-view'),false);assert.deepEqual(image(),marked);zoom(100);assert.equal(d.querySelector('#canvasWrap').classList.contains('pixel-view'),false);
// Continuous diagonal, with no grey fringes or dropped cells.
event('pointerdown',20.7,20.2);event('pointermove',28.4,28.7);event('pointerup',28.4,28.7);for(let n=20;n<=28;n++){assert.deepEqual(pixel(n,n),[0,0,0,255]);assert.deepEqual(pixel(n+1,n),[255,255,255,255]);}
// Pencil and brush keep their own sizes, and physical shortcut works in Russian layout.
key('BracketRight',']');assert.equal(d.querySelector('#pencilSize').value,'2');assert.equal(d.querySelector('#brushSize').value,'20');click(40.3,40.7);for(const [x,y] of [[40,40],[41,40],[40,41],[41,41]])assert.deepEqual(pixel(x,y),[0,0,0,255]);assert.deepEqual(pixel(42,40),[255,255,255,255]);key('KeyB','и');assert.equal(d.querySelector('#pencilSizeControl').hidden,true);assert.equal(d.querySelector('#brushSize').value,'20');
// Mask and uniform opacity apply to a pixel stroke too.
key('KeyM','ь');event('pointerdown',100,100);event('pointermove',102,102);event('pointerup',102,102);key('KeyP','з');d.querySelector('#pencilSize').value=1;d.querySelector('#brushOpacity').value=50;event('pointerdown',100.4,100.4);event('pointermove',104.4,100.4);event('pointerup',104.4,100.4);assert.deepEqual(pixel(100,100),[127,127,127,255]);assert.deepEqual(pixel(101,100),[127,127,127,255]);assert.deepEqual(pixel(102,100),[255,255,255,255]);
const C=require('../core.js'),line=[];C.pixelLine({x:3.9,y:1.2},{x:0,y:4.9},(x,y)=>line.push([x,y]));assert.deepEqual(line,[[3,1],[2,2],[1,3],[0,4]]);
// Live-browser fixture: a sharp diagonal with a one-pixel break.
const fixture=native.createCanvas(16,16),fc=fixture.getContext('2d');fc.fillStyle='#fff';fc.fillRect(0,0,16,16);fc.fillStyle='#000';for(let n=1;n<15;n++)if(n!==8)fc.fillRect(n,n,1,1);fc.fillStyle='#888';fc.fillRect(5,9,1,1);fs.writeFileSync(root+'/tests/pixel-fixture.png',fixture.toBuffer('image/png'));
console.log('Pixel editing verified: 6400% zoom, integer cells, exact 1px/2px footprint, no grey neighbours, continuous diagonal, zoom preserves data, separate tool sizes, mask, opacity, undo/redo, Russian-layout P.');w.close();
