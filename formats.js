/* Baseline TIFF 6.0, uncompressed chunky RGB(A), 8 bits per channel. */
((root)=>{
'use strict';
function encodeTiff(image){
 const {width,height,data}=image,offset=154,out=new Uint8Array(offset+data.length),v=new DataView(out.buffer);v.setUint16(0,0x4949,true);v.setUint16(2,42,true);v.setUint32(4,8,true);
 const tags=[[256,4,1,width],[257,4,1,height],[258,3,4,146],[259,3,1,1],[262,3,1,2],[273,4,1,offset],[277,3,1,4],[278,4,1,height],[279,4,1,data.length],[284,3,1,1],[338,3,1,2]];
 v.setUint16(8,tags.length,true);tags.forEach(([tag,type,count,value],i)=>{const at=10+12*i;v.setUint16(at,tag,true);v.setUint16(at+2,type,true);v.setUint32(at+4,count,true);if(type===3&&count===1)v.setUint16(at+8,value,true);else v.setUint32(at+8,value,true);});for(let i=0;i<4;i++)v.setUint16(146+2*i,8,true);out.set(data,offset);return out;
}
function decodeTiff(buffer,validateSize){
 const v=new DataView(buffer);function need(at,n){if(!Number.isSafeInteger(at)||at<0||at+n>v.byteLength)throw Error('Повреждённый TIFF.');}need(0,8);const order=v.getUint16(0),little=order===0x4949;if(!little&&order!==0x4d4d)throw Error('Неизвестный TIFF.');const u16=at=>{need(at,2);return v.getUint16(at,little);},u32=at=>{need(at,4);return v.getUint32(at,little);};if(u16(2)!==42)throw Error('Поддерживается обычный TIFF, без BigTIFF.');const start=u32(4),count=u16(start);need(start+2,count*12+4);const tags=new Map();
 for(let i=0;i<count;i++){const at=start+2+i*12,tag=u16(at),type=u16(at+2),n=u32(at+4);if(![3,4].includes(type))continue;const size=type===3?2:4;if(n>100000)throw Error('Повреждённые теги TIFF.');const p=n*size<=4?at+8:u32(at+8);need(p,n*size);tags.set(tag,Array.from({length:n},(_,j)=>type===3?u16(p+size*j):u32(p+size*j)));}
 const one=(tag,fallback)=>tags.get(tag)?.[0]??fallback,w=one(256),h=one(257);validateSize(w,h);const samples=one(277,3),bits=tags.get(258)||[1];if(one(259,1)!==1||one(262)!==2||![3,4].includes(samples)||bits.length!==samples||bits.some(b=>b!==8)||one(284,1)!==1||one(274,1)!==1||(samples===4&&one(338)!==2))throw Error('Этот TIFF использует неподдерживаемое сжатие или цветовой режим. Откройте PNG/JPEG либо TIFF RGB без сжатия.');
 const offsets=tags.get(273),sizes=tags.get(279),rows=one(278,h);if(!offsets||!sizes||rows<1||offsets.length!==Math.ceil(h/rows)||sizes.length!==offsets.length)throw Error('Повреждённые полосы TIFF.');const data=new Uint8ClampedArray(w*h*4);for(let s=0;s<offsets.length;s++){const first=s*rows,last=Math.min(h,first+rows),n=(last-first)*w*samples;if(sizes[s]<n)throw Error('Неполные пиксели TIFF.');need(offsets[s],n);let at=offsets[s];for(let i=first*w;i<last*w;i++){data[i*4]=v.getUint8(at++);data[i*4+1]=v.getUint8(at++);data[i*4+2]=v.getUint8(at++);data[i*4+3]=samples===4?v.getUint8(at++):255;}}return{width:w,height:h,data};
}
root.ContourFormats={encodeTiff,decodeTiff};if(typeof module!=='undefined')module.exports=root.ContourFormats;
})(typeof globalThis!=='undefined'?globalThis:this);
