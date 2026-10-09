const assert=require('node:assert/strict'),{harness}=require('./harness.cjs');
function thickness(h,x,y){const data=h.back(h.d.getElementById('display')).getContext('2d').getImageData(x,y-60,1,120).data;let count=0;for(let i=0;i<data.length;i+=4)if(data[i]===17)count++;return count;}
for(const square of [false,true]){
 const h=harness();h.d.getElementById('welcomeBlank').click();if(square)h.d.querySelector('[data-brush-shape="square"]').click();h.d.getElementById('brushSize').value=50;h.d.getElementById('color').value='#112233';const before=h.image();
 h.event('pointerdown',100,150,{pointerType:'pen',pressure:.2});for(let x=110;x<=350;x+=10)h.event('pointermove',x,150,{pointerType:'pen',pressure:.9});h.event('pointerup',350,150,{pointerType:'pen',pressure:0});h.flushFrames();
 assert.ok(thickness(h,250,150)>40,'body retains pressure-controlled thickness');assert.ok(thickness(h,335,150)<thickness(h,310,150),'tail tapers');assert.ok(thickness(h,350,150)<=3,'released stroke ends in a pixel-scale tip');assert.equal(thickness(h,354,150),0,'previous fat footprint must not remain past the endpoint');
 for(let x=310;x<=350;x++)assert.ok(thickness(h,x,150)>0,'taper remains continuous at '+x);
 const result=h.image();for(let i=0;i<result.length;i+=4)assert.ok(result[i]===255||result[i]===17,'no blended edge colors');h.d.getElementById('undo').click();assert.deepEqual(h.image(),before);h.d.getElementById('redo').click();assert.deepEqual(h.image(),result);h.w.close();
}
for(const pressure of [.9,.5]){
 const h=harness();h.d.getElementById('welcomeBlank').click();h.d.getElementById('brushSize').value=50;h.d.getElementById('color').value='#112233';h.event('pointerdown',150,150,{pointerType:'pen',pressure});h.event('pointerup',150,150,{pointerType:'pen',pressure:0});assert.ok(thickness(h,150,150)>40,'tap remains a dot');h.w.close();
}
const large=harness();large.d.getElementById('welcomeBlank').click();large.d.getElementById('brushSize').value=500;large.d.getElementById('color').value='#112233';large.event('pointerdown',100,350,{pointerType:'pen',pressure:.2});for(let x=120;x<=850;x+=20)large.event('pointermove',x,350,{pointerType:'pen',pressure:.9});large.event('pointerup',850,350,{pointerType:'pen',pressure:0});large.flushFrames();for(let x=750;x<=850;x++)assert.ok(thickness(large,x,350)>0,'large brush tip must stay connected');assert.ok(thickness(large,850,350)<=3);large.w.close();
console.log('Pressure tips: round/square pointed and continuous endings, 500 px brush, exact colors, unchanged body, taps and undo/redo verified.');
