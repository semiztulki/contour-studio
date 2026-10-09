const assert=require('node:assert/strict'),{harness}=require('./harness.cjs');
function thickness(h,x,y){const data=h.back(h.d.getElementById('display')).getContext('2d').getImageData(x,y-60,1,120).data;let count=0;for(let i=0;i<data.length;i+=4)if(data[i]===17)count++;return count;}
function prepare(square=false,size=50){const h=harness();h.d.getElementById('welcomeBlank').click();if(square)h.d.querySelector('[data-brush-shape="square"]').click();h.d.getElementById('brushSize').value=size;h.d.getElementById('color').value='#112233';return h;}
for(const square of [false,true]){
 const h=prepare(square),before=h.image();h.event('pointerdown',100,150,{pointerType:'pen',pressure:.9});
 for(let x=105;x<=450;x+=5)h.event('pointermove',x,150,{pointerType:'pen',pressure:x<=200?.9:.002+.898*(450-x)/250});h.flushFrames();
 const live=h.image();h.event('pointerup',450,150,{pointerType:'pen',pressure:0});h.flushFrames();
 const widths=[210,250,300,350,400,440].map(x=>thickness(h,x,150));for(let i=1;i<widths.length;i++)assert.ok(widths[i]<widths[i-1],'actual falling pressure must narrow the whole tail gradually');
 assert.ok(thickness(h,450,150)<=3,'weak pressure produces a fine tip');for(let x=220;x<448;x++){assert.ok(thickness(h,x,150)>0,'stroke stays connected');assert.ok(Math.abs(thickness(h,x+1,150)-thickness(h,x,150))<=3,'no abrupt narrowing');}
 if(square)assert.deepEqual(h.image(),live,'pen lift must not reshape the existing square stroke');
 const result=h.image();for(let i=0;i<result.length;i+=4)assert.ok(result[i]===255||result[i]===17,'no mixed edge colors');h.d.getElementById('undo').click();assert.deepEqual(h.image(),before);h.d.getElementById('redo').click();assert.deepEqual(h.image(),result);h.w.close();
 const abrupt=prepare(square);abrupt.event('pointerdown',100,150,{pointerType:'pen',pressure:.9});for(let x=110;x<=350;x+=10)abrupt.event('pointermove',x,150,{pointerType:'pen',pressure:.9});abrupt.flushFrames();const width=thickness(abrupt,330,150);abrupt.event('pointerup',350,150,{pointerType:'pen',pressure:0});abrupt.flushFrames();assert.equal(thickness(abrupt,330,150),width);assert.ok(thickness(abrupt,350,150)>40,'strong-pressure lift retains its natural cap');abrupt.w.close();
}
const large=prepare(false,500);large.event('pointerdown',100,350,{pointerType:'pen',pressure:.9});for(let x=110;x<=850;x+=10)large.event('pointermove',x,350,{pointerType:'pen',pressure:x<=500?.9:.001+.899*(850-x)/350});large.event('pointerup',850,350,{pointerType:'pen',pressure:0});large.flushFrames();for(let x=750;x<=850;x++)assert.ok(thickness(large,x,350)>0);assert.ok(thickness(large,850,350)<=3);large.w.close();
for(const [settings,expected]of [[{pressureMin:10},0],[{pressureMin:25},25],[{pressureMin:10,pressureResponse:2},10]]){const h=harness(undefined,undefined,{settings});assert.equal(h.w.ContourInterface.prefs.pressureMin,expected);h.w.close();}
console.log('Pressure: gradual measured-pressure taper, no artificial point on lift, round/square and 500 px continuity, exact colors, undo/redo and minimum-size settings verified.');
