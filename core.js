/* Pixel operations shared by the editor and its verification fixtures. */
(function(root){
  'use strict';
  function similar(data,index,target,tolerance){
    return data[index+3]>0 && Math.max(Math.abs(data[index]-target[0]),Math.abs(data[index+1]-target[1]),Math.abs(data[index+2]-target[2]),Math.abs(data[index+3]-target[3]))<=tolerance;
  }
  function selectColor(data,width,height,seed,tolerance,contiguous){
    const n=width*height,mask=new Uint8Array(n),p=seed*4;
    if(seed<0||seed>=n||!data[p+3]) return mask;
    const target=data.slice(p,p+4);
    if(!contiguous){for(let i=0;i<n;i++) if(similar(data,i*4,target,tolerance)) mask[i]=1;return mask;}
    const queue=new Int32Array(n),seen=new Uint8Array(n);let head=0,tail=0;
    queue[tail++]=seed;seen[seed]=1;
    const visit=i=>{if(!seen[i]){seen[i]=1;if(similar(data,i*4,target,tolerance))queue[tail++]=i;}};
    while(head<tail){const i=queue[head++];mask[i]=1;const x=i%width;if(x>0)visit(i-1);if(x<width-1)visit(i+1);if(i>=width)visit(i-width);if(i<n-width)visit(i+width);}
    return mask;
  }
  function floodRegion(data,width,height,seed,tolerance,selection){
    const n=width*height,mask=new Uint8Array(n),p=seed*4;
    if(seed<0||seed>=n||(selection&&!selection[seed]))return mask;
    const target=data.slice(p,p+4),queue=new Int32Array(n),seen=new Uint8Array(n);let head=0,tail=0;
    const match=i=>Math.max(Math.abs(data[i*4]-target[0]),Math.abs(data[i*4+1]-target[1]),Math.abs(data[i*4+2]-target[2]),Math.abs(data[i*4+3]-target[3]))<=tolerance;
    queue[tail++]=seed;seen[seed]=1;
    const visit=i=>{if(!seen[i]){seen[i]=1;if((!selection||selection[i])&&match(i))queue[tail++]=i;}};
    while(head<tail){const i=queue[head++];mask[i]=1;const x=i%width;if(x>0)visit(i-1);if(x<width-1)visit(i+1);if(i>=width)visit(i-width);if(i<n-width)visit(i+width);}
    return mask;
  }
  function extractOutline(data,whitePoint){
    const result=new Uint8ClampedArray(data.length);
    for(let i=0;i<data.length;i+=4){const luminance=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];result[i+3]=Math.round(data[i+3]*Math.max(0,1-luminance/whitePoint));}
    return result;
  }
  function combineMasks(previous,next,mode){
    if(!previous||mode==='replace')return next;
    for(let i=0;i<next.length;i++)next[i]=mode==='subtract'?Number(previous[i]&&!next[i]):Number(previous[i]||next[i]);
    return next;
  }
  function maskCount(mask){if(!mask)return 0;let n=0;for(const value of mask)n+=value;return n;}
  // Distance-based filtering gives the same feel at different pointer event rates.
  function strokeSmoother(start,amount,zoom=1){
    const strength=Math.max(0,Math.min(100,Number(amount)||0))/100;
    const scale=Math.max(.02,Number(zoom)||1),radius=32*strength*strength/scale;
    let raw={...start},filtered={...start};
    function push(point){
      if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return[];
      const dx=point.x-raw.x,dy=point.y-raw.y,distance=Math.hypot(dx,dy);
      if(!distance)return[];
      if(!radius){raw=filtered={...point};return[{...point}];}
      const steps=Math.min(4096,Math.max(1,Math.ceil(distance*scale))),alpha=1-Math.exp(-distance/steps/radius),out=[];
      for(let i=1;i<=steps;i++){
        filtered={x:filtered.x+(raw.x+dx*i/steps-filtered.x)*alpha,y:filtered.y+(raw.y+dy*i/steps-filtered.y)*alpha};out.push(filtered);
      }
      raw={...point};return out;
    }
    function finish(){
      if(!radius||Math.hypot(raw.x-filtered.x,raw.y-filtered.y)<.01/scale)return[{...raw}];
      const out=[],alpha=1-Math.exp(-1/(scale*radius));
      // Gently bring the tail to the release position instead of leaving it short.
      for(let i=0;i<512&&Math.hypot(raw.x-filtered.x,raw.y-filtered.y)>.05/scale;i++){
        filtered={x:filtered.x+(raw.x-filtered.x)*alpha,y:filtered.y+(raw.y-filtered.y)*alpha};out.push(filtered);
      }
      filtered={...raw};out.push({...raw});return out;
    }
    return{push,finish};
  }
  const api={selectColor,floodRegion,extractOutline,combineMasks,maskCount,strokeSmoother};root.ContourCore=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
