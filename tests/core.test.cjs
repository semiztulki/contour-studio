const assert=require('node:assert/strict');
const C=require('../core.js');
function image(colors){return Uint8ClampedArray.from(colors.flat());}
const black=[0,0,0,255],white=[255,255,255,255],gray=[20,20,20,255],transparent=[0,0,0,0];
const d=image([black,white,gray,black,white,black]);
assert.deepEqual([...C.selectColor(d,3,2,0,0,false)],[1,0,0,1,0,1]);
assert.deepEqual([...C.selectColor(d,3,2,0,0,true)],[1,0,0,1,0,0]);
assert.deepEqual([...C.selectColor(d,3,2,0,20,false)],[1,0,1,1,0,1]);
assert.deepEqual([...C.selectColor(image([transparent,black]),2,1,0,255,false)],[0,0]);
assert.deepEqual([...C.floodRegion(image([white,white,white]),3,1,0,0,new Uint8Array([1,0,1]))],[1,0,0]);
assert.deepEqual([...C.floodRegion(image([transparent,transparent]),2,1,0,0,null)],[1,1]);
const contour=C.extractOutline(image([black,[125,125,125,255],[250,250,250,255],white,[0,0,0,128]]),250);
assert.deepEqual([contour[3],contour[7],contour[11],contour[15],contour[19]],[255,128,0,0,128]);
assert.deepEqual([...C.combineMasks(new Uint8Array([1,0,1]),new Uint8Array([0,1,1]),'add')],[1,1,1]);
assert.deepEqual([...C.combineMasks(new Uint8Array([1,0,1]),new Uint8Array([0,1,1]),'subtract')],[1,0,0]);
console.log('Core verified: disconnected colors, tolerance, transparency, bounded fill, antialiasing, selection addition/subtraction.');
