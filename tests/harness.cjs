const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const native=require('@napi-rs/canvas');
const root=require('node:path').resolve(__dirname,'..');
function harness(store,savedPalettes,options={}){
const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test/'});
const w=dom.window,d=w.document,backing=new WeakMap(),curveCommands=[];
if(savedPalettes!==undefined)w.localStorage.setItem('contour-palettes',JSON.stringify(savedPalettes));
function back(el){if(!backing.has(el))backing.set(el,native.createCanvas(el.width,el.height));return backing.get(el);}
for(const prop of ['width','height']){const original=Object.getOwnPropertyDescriptor(w.HTMLCanvasElement.prototype,prop);Object.defineProperty(w.HTMLCanvasElement.prototype,prop,{get:original.get,set(v){original.set.call(this,v);if(backing.has(this))backing.get(this)[prop]=v;}});}
w.HTMLCanvasElement.prototype.getContext=function(){const el=this,ctx=back(this).getContext('2d');return new Proxy(ctx,{get(target,key){if(options.recordCurves&&['moveTo','bezierCurveTo'].includes(key))return(...args)=>{curveCommands.push({canvas:el,method:key,args});return target[key](...args);};if(key==='drawImage')return(source,...args)=>target.drawImage(source instanceof w.HTMLCanvasElement?back(source):source.native||source,...args);const v=target[key];return typeof v==='function'?v.bind(target):v;},set(target,key,value){target[key]=value;return true;}});};
w.HTMLCanvasElement.prototype.toDataURL=function(){return back(this).toDataURL('image/png');};w.ImageData=native.ImageData;w.Blob=global.Blob;w.confirm=()=>true;const urls=new Map();w.testDownloads=[];let seq=0;w.URL.createObjectURL=blob=>{const url='blob:fixture-'+(++seq);urls.set(url,blob);return url;};w.URL.revokeObjectURL=url=>urls.delete(url);w.Image=class{set src(url){(url.startsWith('data:')?Promise.resolve(Buffer.from(url.split(',')[1],'base64')):urls.get(url).arrayBuffer()).then(bytes=>native.loadImage(Buffer.from(bytes))).then(image=>{this.native=image;this.naturalWidth=image.width;this.naturalHeight=image.height;this.onload();}).catch(()=>this.onerror());}};w.HTMLAnchorElement.prototype.click=function(){w.testDownloads.push({name:this.download,blob:urls.get(this.href)});};const timers=new Map();let timerId=0;w.setTimeout=cb=>{timers.set(++timerId,cb);return timerId;};w.clearTimeout=id=>timers.delete(id);w.ContourDraftStore=store;w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};w.HTMLCanvasElement.prototype.toBlob=function(cb,type='image/png',quality){const blob=new Blob([back(this).toBuffer(type==='image/jpeg'?'image/jpeg':'image/png',type==='image/jpeg'?Math.round((quality||.95)*100):undefined)],{type});queueMicrotask(()=>cb(blob));};
w.HTMLElement.prototype.setPointerCapture=()=>{};
const viewport=d.querySelector('#viewport');viewport.setPointerCapture=()=>{};
viewport.getBoundingClientRect=()=>({left:0,top:0,right:1100,bottom:850});
Object.defineProperty(viewport,'clientWidth',{value:1100});Object.defineProperty(viewport,'clientHeight',{value:850});
d.querySelector('#canvasWrap').getBoundingClientRect=()=>({left:0,top:0,width:960,height:720});
const frames=[];w.requestAnimationFrame=cb=>{frames.push(cb);return frames.length;};w.eval(fs.readFileSync(root+'/core.js','utf8'));w.eval(fs.readFileSync(root+'/formats.js','utf8'));w.eval(fs.readFileSync(root+'/app.js','utf8'));

function event(type,x,y,extra={}){const e=new w.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true,...extra});Object.defineProperty(e,'pointerId',{value:1});viewport.dispatchEvent(e);}
function key(type,code,extra={}){viewport.dispatchEvent(new w.KeyboardEvent(type,{code,bubbles:true,cancelable:true,...extra}));}
function stroke(points,extra={}){event('pointerdown',...points[0],extra);for(const p of points.slice(1))event('pointermove',...p,extra);event('pointerup',...points.at(-1),extra);while(frames.length)frames.shift()();}
function image(){return Buffer.from(back(d.getElementById('display')).getContext('2d').getImageData(0,0,d.getElementById('display').width,d.getElementById('display').height).data);}
return {w,d,back,timers,event,key,stroke,image,curveCommands,flushFrames:()=>{while(frames.length)frames.shift()();}};
}
async function settle(){for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));}
async function runTimer(h){const callbacks=[...h.timers.values()];h.timers.clear();callbacks.forEach(cb=>cb());await settle();}
module.exports={harness,settle,runTimer,native};
