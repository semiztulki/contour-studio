const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const h=harness(),{w,d}=h,delays=new Map(),schedule=w.setTimeout;
w.setTimeout=(cb,delay)=>{const id=schedule(cb);delays.set(id,delay);return id;};
let worker;
w.Worker=class {
  constructor(){worker=this;this.jobs=[];}
  postMessage(message){if(message.kind==='source')this.data=message.data;else this.jobs.push(message);}
  respond(){const m=this.jobs.shift();assert.ok(m);const result=w.ContourCore.fillRegion(this.data,m.width,m.height,m.seed,m.tolerance,m.selection,m.gap);this.onmessage({data:{id:m.id,result}});}
};
const notice=d.getElementById('fileNotice');
d.getElementById('newWidth').value=800;d.getElementById('newHeight').value=600;d.getElementById('createDoc').click();
d.getElementById('zoom100').value=100;d.getElementById('zoom100').dispatchEvent(new w.Event('change'));
d.querySelector('[data-tool="fill"]').click();
function begin(color){d.getElementById('color').value=color;h.event('pointerdown',100,100);assert.equal(notice.hidden,true,'asynchronous fill must not immediately flash a notice');return [...h.timers.keys()].find(id=>delays.get(id)===350);}
function fire(id){const cb=h.timers.get(id);assert.ok(cb,'delayed progress timer exists');h.timers.delete(id);cb();}
// A fast worker reply removes the pending message entirely.
const original=h.image(),quick=begin('#3f7f8a');worker.respond();assert.equal(h.timers.has(quick),false);assert.equal(notice.hidden,true);
const painted=h.image();assert.notDeepEqual(painted,original);d.getElementById('undo').click();assert.deepEqual(h.image(),original);d.getElementById('redo').click();assert.deepEqual(h.image(),painted);
// A slow fill exposes cancellation, then removes its overlay on completion.
const slow=begin('#ead09b');fire(slow);assert.equal(notice.hidden,false);assert.match(d.getElementById('fileNoticeText').textContent,/Escape/);worker.respond();assert.equal(notice.hidden,true);
// Escape cancels both pending and already-visible messages. Late replies cannot repaint.
const beforeCancel=h.image(),pending=begin('#bd6152');h.key('keydown','Escape');assert.equal(h.timers.has(pending),false);worker.respond();assert.equal(notice.hidden,true);assert.deepEqual(h.image(),beforeCancel);
const visible=begin('#bd6152');fire(visible);h.key('keydown','Escape');assert.equal(notice.hidden,true);worker.respond();assert.deepEqual(h.image(),beforeCancel);
assert.equal(notice.parentElement.className,'document-bar','notices are anchored outside the scrolling sheet');
console.log('Fill notices: no fast-fill flash, delayed cancellation hint, Escape and late replies, unchanged undo/redo pixels verified.');
w.close();
