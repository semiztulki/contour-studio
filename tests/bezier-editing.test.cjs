const assert=require('node:assert/strict'),{harness}=require('./harness.cjs'),C=require('../core.js');
const value=(h,id,v,event='input')=>{const e=h.d.getElementById(id);e.value=v;e.dispatchEvent(new h.w.Event(event,{bubbles:true}));};
function setup(size=6){const h=harness(undefined,undefined,{recordCurves:true});h.d.getElementById('newDoc').click();value(h,'newWidth',420);value(h,'newHeight',320);h.d.getElementById('createDoc').click();h.flushFrames();value(h,'zoom100',100,'change');value(h,'brushSize',size);h.key('keydown','KeyQ');h.curveCommands.length=0;return h;}
function segments(h,overlay=false){const commands=h.curveCommands.filter(c=>overlay?c.canvas.id==='overlay':!c.canvas.id);let result=[],start=null,newPath=false;for(const c of commands){if(c.method==='moveTo'){newPath=true;start={x:c.args[0],y:c.args[1]};}else if(start){if(newPath){result=[];newPath=false;}const [x1,y1,x2,y2,x3,y3]=c.args,end={x:x3,y:y3};result.push([start,{x:x1,y:y1},{x:x2,y:y2},end]);start=end;}}return result;}
function draw(h,path,extra={}){h.curveCommands.length=0;h.stroke(path,extra);return segments(h);}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// De Casteljau subdivision preserves a cubic, including asymmetric controls and loops.
for(const points of [[{x:5,y:20},{x:300,y:-200},{x:-90,y:400},{x:200,y:160}],[{x:20,y:20},{x:200,y:20},{x:-200,y:20},{x:20,y:20}]])for(const t of [.07,.5,.91]){
 const halves=C.splitBezier(points,t);
 for(let i=0;i<=100;i++){const u=i/100,original=C.bezierPoint(points,u),part=u<t?C.bezierPoint(halves.left,u/t):C.bezierPoint(halves.right,(u-t)/(1-t));assert.ok(distance(original,part)<1e-9);}
}
for(const points of [[{x:0,y:0},{x:0,y:0},{x:300,y:0},{x:300,y:0}],[{x:0,y:0},{x:160,y:200},{x:40,y:-150},{x:300,y:50}],[{x:30,y:40},{x:200,y:40},{x:-100,y:40},{x:30,y:40}]])for(const t of [.1,.4,.8]){
 const p=C.bezierPoint(points,t),hit=C.nearestBezier(points,p,.2);assert.ok(hit);assert.ok(hit.distance<.01);
}
assert.equal(C.nearestBezier([{x:0,y:0},{x:0,y:0},{x:300,y:0},{x:300,y:0}],{x:150,y:30},5),null);

// Appending and moving an outgoing handle leave the preceding segment untouched.
let h=setup();draw(h,[[60,180],[100,180]]);const first=draw(h,[[180,140],[210,100]]),added=draw(h,[[300,190]]);assert.deepEqual(added[0],first[0]);
const independent=draw(h,[[210,100],[240,160]]);assert.deepEqual(independent[0],added[0]);assert.notDeepEqual(independent[1],added[1]);
h.key('keydown','AltLeft',{altKey:true});const linked=draw(h,[[240,160],[250,190]],{altKey:true});assert.notDeepEqual(linked[0],independent[0]);h.key('keyup','AltLeft');h.key('keydown','KeyZ',{ctrlKey:true});assert.deepEqual(segments(h)[0],independent[0]);h.key('keydown','KeyZ',{ctrlKey:true,shiftKey:true});assert.deepEqual(segments(h)[0],linked[0]);
const moved=draw(h,[[180,140],[180,115]]);assert.deepEqual(moved[0][1],linked[0][1]);assert.deepEqual(moved[1][2],linked[1][2]);assert.equal(moved[0][2].y,linked[0][2].y-25);h.w.close();

// Fractional pointer coordinates and odd/even widths use identical preview and committed controls.
for(const size of [1,5,6]){h=setup(size);draw(h,[[60,180],[105,130]]);draw(h,[[180,140],[205,110]]);h.curveCommands.length=0;h.event('pointermove',300.8,210.2);const preview=segments(h,true)[0];assert.ok(preview);const actual=draw(h,[[300.8,210.2]]);assert.deepEqual(actual.at(-1),preview);h.w.close();}

// Hover, modifiers without pointer movement, insertion, undo and cancellation.
h=setup();draw(h,[[60,180],[100,110]]);const before=draw(h,[[300,190],[330,120]]),original=before[0],mid=C.bezierPoint(original,.5),vp=h.d.getElementById('viewport');
h.event('pointermove',100,110);assert.equal(vp.style.cursor,'grab');assert.match(h.d.getElementById('pathHint').textContent,/ус/);
h.key('keydown','AltLeft',{altKey:true});assert.match(h.d.getElementById('pathHint').textContent,/оба/);h.key('keyup','AltLeft');
h.event('pointermove',mid.x,mid.y);h.key('keydown','AltLeft',{altKey:true});assert.equal(vp.style.cursor,'copy');assert.match(h.d.getElementById('pathHint').textContent,/вставить/);
const inserted=draw(h,[[mid.x,mid.y]],{altKey:true});assert.equal(inserted.length,2);assert.match(h.d.getElementById('pathHint').textContent,/3/);
for(let i=0;i<=100;i++){const t=i/100,p=t<.5?C.bezierPoint(inserted[0],t*2):C.bezierPoint(inserted[1],(t-.5)*2);assert.ok(distance(p,C.bezierPoint(original,t))<.01);}
h.key('keyup','AltLeft');h.key('keydown','ControlLeft',{ctrlKey:true});assert.equal(h.d.getElementById('applyPath').disabled,false);h.key('keydown','KeyZ',{ctrlKey:true});assert.deepEqual(segments(h),before);h.key('keydown','KeyZ',{ctrlKey:true,shiftKey:true});assert.deepEqual(segments(h),inserted);
h.event('pointermove',mid.x,mid.y);h.key('keydown','ShiftLeft',{shiftKey:true});assert.equal(vp.style.cursor,'not-allowed');h.key('keyup','ShiftLeft');
h.key('keydown','KeyZ',{ctrlKey:true});h.event('pointerdown',mid.x,mid.y,{altKey:true});h.event('pointercancel',mid.x,mid.y,{altKey:true});assert.deepEqual(segments(h),before);h.key('keydown','KeyZ',{ctrlKey:true,shiftKey:true});assert.deepEqual(segments(h),inserted);
const data=h.image();for(let i=0;i<data.length;i+=4)assert.ok(data[i]===255&&data[i+1]===255&&data[i+2]===255||data[i]===189&&data[i+1]===97&&data[i+2]===82);
h.key('keydown','Enter');h.d.getElementById('undo').click();assert.ok(h.image().every(v=>v===255));h.w.close();

// Closed paths can be subdivided on their closing segment and retain earlier arcs.
h=setup();draw(h,[[60,180],[100,110]]);draw(h,[[180,70],[230,70]]);const open=draw(h,[[300,190],[330,220]]);h.curveCommands.length=0;h.d.getElementById('closePath').click();const closed=segments(h);assert.deepEqual(closed.slice(0,2),open);const closing=closed[2],q=C.bezierPoint(closing,.5),split=draw(h,[[q.x,q.y]],{altKey:true});assert.equal(split.length,4);assert.deepEqual(split.slice(0,2),open);assert.equal(h.d.getElementById('closePath').getAttribute('aria-pressed'),'true');h.key('keydown','KeyZ',{ctrlKey:true});assert.deepEqual(segments(h),closed);h.w.close();
console.log('Bezier editing verified: stable previous arcs, independent/linked handles, exact preview, shape-preserving open/closed insertion, hover/modifier feedback, undo/redo/cancel and hard raster edges.');
