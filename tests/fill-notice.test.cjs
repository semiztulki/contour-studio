const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
const h=harness(),{w,d}=h;
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
function begin(color){d.getElementById('color').value=color;h.event('pointerdown',100,100);assert.equal(notice.hidden,true,'asynchronous fill must not show a notice');}
function fireTimers(){const callbacks=[...h.timers.values()];h.timers.clear();callbacks.forEach(cb=>cb());}
const original=h.image();begin('#3f7f8a');worker.respond();assert.equal(notice.hidden,true);
const painted=h.image();assert.notDeepEqual(painted,original);d.getElementById('undo').click();assert.deepEqual(h.image(),original);d.getElementById('redo').click();assert.deepEqual(h.image(),painted);
// Even a pending worker job must stay silent after timers have elapsed.
begin('#ead09b');fireTimers();assert.equal(notice.hidden,true);worker.respond();assert.equal(notice.hidden,true);
// Cancellation remains functional without a popup; late replies cannot repaint.
const beforeCancel=h.image();begin('#bd6152');fireTimers();h.key('keydown','Escape');worker.respond();assert.equal(notice.hidden,true);assert.deepEqual(h.image(),beforeCancel);
assert.equal(notice.parentElement.className,'document-bar','notices are anchored outside the scrolling sheet');
console.log('Fill notices: fast and slow fills stay silent, cancellation and late replies are safe, undo/redo pixels verified.');
w.close();
