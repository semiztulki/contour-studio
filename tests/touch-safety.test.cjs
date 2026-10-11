const assert=require('node:assert/strict');
const {harness,settle}=require('./harness.cjs');
function fire(h,target,type,extra={}){
 const e=new h.w.MouseEvent(type,{bubbles:true,cancelable:true,detail:type==='click'?1:0,clientX:30,clientY:30,...extra});
 for(const key of ['pointerId','pointerType','touches','sourceCapabilities'])if(key in extra)Object.defineProperty(e,key,{value:extra[key]});
 target.dispatchEvent(e);return e;
}
function change(h,id,value){const el=h.d.getElementById(id);el.value=value;el.dispatchEvent(new h.w.Event('change'));}
(async()=>{
 const h=harness(),d=h.d;let now=10000;h.w.Date.now=()=>now;
 d.getElementById('welcomeBlank').click();h.stroke([[100,140],[200,140]],{pointerType:'pen',pressure:.6,pointerId:7});
 const before=h.image(),revision=h.w.ContourEditor.state().revision,undo=d.getElementById('undo');
 assert.equal(h.w.localStorage.getItem('contour-pen-used'),'true');
 h.event('pointerdown',200,200,{pointerType:'touch',pointerId:21});
 now+=2000;
 h.event('pointermove',300,200,{pointerType:'touch',pointerId:21});h.event('pointerup',300,200,{pointerType:'touch',pointerId:21});h.flushFrames();
 assert.deepEqual(h.image(),before,'palm begun inside cooldown must stay blocked until release');
 assert.equal(h.w.ContourEditor.state().revision,revision);
 now+=2000;
 h.event('pointerdown',210,220,{pointerType:'touch',pointerId:22});h.event('pointermove',280,220,{pointerType:'touch',pointerId:22});h.event('pointerup',280,220,{pointerType:'touch',pointerId:22});
 assert.deepEqual(h.image(),before,'auto finger after pen pans without painting');assert.equal(h.w.ContourEditor.state().revision,revision);
 h.event('pointerdown',300,300,{pointerType:'pen',pressure:.6,pointerId:7});
 fire(h,undo,'pointerdown',{pointerType:'touch',pointerId:31});
 fire(h,undo,'pointerup',{pointerType:'touch',pointerId:31});
 const click=fire(h,undo,'click',{pointerType:'touch'});assert.equal(click.defaultPrevented,true);assert.equal(h.w.ContourEditor.state().revision,revision,'palm cannot activate Undo while drawing');
 h.event('pointercancel',350,300,{pointerType:'touch',pointerId:32}); // untracked cancellation belongs to another pointer
 // A tracked blocked palm cancellation must not cancel the pen's live stroke.
 h.event('pointerdown',350,300,{pointerType:'touch',pointerId:33});h.event('pointercancel',350,300,{pointerType:'touch',pointerId:33});
 h.event('pointermove',430,300,{pointerType:'pen',pressure:.6,pointerId:7});h.event('pointerup',430,300,{pointerType:'pen',pressure:0,pointerId:7});h.flushFrames();
 assert.ok(h.w.ContourEditor.state().revision>revision,'blocked palm cancellation must leave pen working');
 now+=2000;
 fire(h,undo,'pointerdown',{pointerType:'touch',pointerId:34});fire(h,undo,'pointerup',{pointerType:'touch',pointerId:34});
 assert.equal(fire(h,undo,'click',{pointerType:'touch'}).defaultPrevented,false,'ordinary panel tap works after cooldown');
 // Keep suppression even if a blocked contact is held beyond the cooldown and emits a compatibility click.
 h.event('pointerdown',330,340,{pointerType:'pen',pressure:.5,pointerId:7});fire(h,undo,'pointerdown',{pointerType:'touch',pointerId:35});h.event('pointerup',330,340,{pointerType:'pen',pressure:0,pointerId:7});now+=2000;
 fire(h,undo,'pointerup',{pointerType:'touch',pointerId:35});assert.equal(fire(h,undo,'click',{pointerType:'touch'}).defaultPrevented,true);assert.equal(fire(h,undo,'click').defaultPrevented,true,'legacy ghost click suppressed');
 assert.equal(fire(h,undo,'click',{pointerType:'mouse'}).defaultPrevented,false,'real mouse click not suppressed');
 now+=2000;
 change(h,'settingFinger','draw');assert.equal(JSON.parse(h.w.localStorage.getItem('contour-settings')).touchPolicy,2);
 const r=h.w.ContourEditor.state().revision;h.stroke([[200,400],[300,400]],{pointerType:'touch',pointerId:45});assert.ok(h.w.ContourEditor.state().revision>r,'explicit finger drawing remains available');
 for(const id of ['colorHex','newWidth','layerOpacity']){const el=d.getElementById(id);assert.equal(fire(h,el,'selectstart').defaultPrevented,false);assert.equal(fire(h,el,'contextmenu').defaultPrevented,false);}
 assert.equal(fire(h,undo,'selectstart').defaultPrevented,true);assert.equal(fire(h,undo,'contextmenu').defaultPrevented,true);
 for(const type of ['gesturestart','gesturechange','gestureend'])assert.equal(fire(h,d.body,type).defaultPrevented,true);
 assert.equal(fire(h,d.body,'touchmove',{touches:[{},{}]}).defaultPrevented,true);assert.equal(fire(h,d.getElementById('mobilePanel'),'touchmove',{touches:[{}]}).defaultPrevented,false,'one-finger panel scroll remains native');
 assert.equal(fire(h,d.getElementById('display'),'dragstart').defaultPrevented,true);assert.equal(fire(h,d.querySelector('.layer-row'),'dragstart').defaultPrevented,false,'layer reorder remains available');
 h.w.ContourI18n.setLanguage('en');await settle();assert.equal(d.querySelector('#settingFinger option[value=pan]').textContent,'Navigate only');h.w.ContourI18n.setLanguage('ru');await settle();assert.equal(d.querySelector('#settingFinger option[value=pan]').textContent,'Только перемещать');h.w.close();
 for(const [saved,want]of [[{finger:'draw'},'auto'],[{finger:'draw',touchPolicy:2},'draw'],[{finger:'pan'},'pan']]){const t=harness(undefined,undefined,{settings:saved});assert.equal(t.w.ContourInterface.prefs.finger,want);t.w.close();}
 const t=harness();let clock=10000;t.w.Date.now=()=>clock;t.d.getElementById('welcomeBlank').click();t.stroke([[100,100],[180,100]],{pointerType:'pen',pressure:.5});clock+=2000;
 const original=t.image(),rev=t.w.ContourEditor.state().revision;
 for(const tool of ['fill','colorSelect','rect','lasso','crop','move','curve']){t.w.ContourEditor.selectTool(tool);t.stroke([[200,200],[260,250]],{pointerType:'touch',pointerId:51});assert.deepEqual(t.image(),original,'auto fingers cannot apply '+tool);assert.equal(t.w.ContourEditor.state().revision,rev);}
 t.event('pointerdown',200,300,{pointerType:'touch',pointerId:61});t.event('pointerdown',300,300,{pointerType:'touch',pointerId:62});const z=t.w.ContourEditor.state().zoom;t.event('pointermove',400,300,{pointerType:'touch',pointerId:62});assert.ok(t.w.ContourEditor.state().zoom>z,'own two-finger zoom is preserved');t.event('pointerup',400,300,{pointerType:'touch',pointerId:62});t.event('pointerup',200,300,{pointerType:'touch',pointerId:61});t.w.close();
 console.log('Touch safety: palm/cooldown/ghost-click rejection, working pen and UI, automatic and explicit finger modes, own zoom, editable fields, panel scroll, layer drag, browser gesture prevention and RU/EN passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
