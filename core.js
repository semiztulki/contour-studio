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
  function pixelLine(a,b,stamp){
    let x=Math.floor(a.x),y=Math.floor(a.y);const endX=Math.floor(b.x),endY=Math.floor(b.y),dx=Math.abs(endX-x),dy=-Math.abs(endY-y),sx=x<endX?1:-1,sy=y<endY?1:-1;let error=dx+dy;
    while(true){stamp(x,y);if(x===endX&&y===endY)break;const twice=2*error;if(twice>=dy){error+=dy;x+=sx;}if(twice<=dx){error+=dx;y+=sy;}}
  }
  // Trace oriented pixel edges into closed loops, including holes. Collinear
  // edges share one SVG command, so large rectangular selections stay compact.
  function selectionOutline(mask,width,height){
    if(!mask)return '';const edges=new Uint8Array(mask.length),out=[];
    for(let i=0;i<mask.length;i++){if(!mask[i])continue;const x=i%width,y=Math.floor(i/width);edges[i]=(y===0||!mask[i-width]?1:0)|(x===width-1||!mask[i+1]?2:0)|(y===height-1||!mask[i+width]?4:0)|(x===0||!mask[i-1]?8:0);}
    function edgeAt(x,y,d){const px=x-(d===1||d===2?1:0),py=y-(d===2||d===3?1:0);if(px<0||py<0||px>=width||py>=height)return -1;const i=py*width+px;return edges[i]&(1<<d)?i:-1;}
    for(let i=0;i<edges.length;i++)while(edges[i]){
      let d=0;while(!(edges[i]&(1<<d)))d++;const px=i%width,py=Math.floor(i/width),sx=px+(d===1||d===2?1:0),sy=py+(d===2||d===3?1:0);let x=sx,y=sy,j=i;out.push('M'+x+' '+y);
      while(true){edges[j]&=~(1<<d);x+=[1,0,-1,0][d];y+=[0,1,0,-1][d];if(x===sx&&y===sy){out.push(d%2?'V'+y:'H'+x);out.push('Z');break;}
        let next=-1,nd=d;for(const candidate of [(d+1)%4,d,(d+3)%4,(d+2)%4]){next=edgeAt(x,y,candidate);if(next>=0){nd=candidate;break;}}if(next<0)throw Error('Unclosed selection boundary');if(nd!==d)out.push(d%2?'V'+y:'H'+x);d=nd;j=next;
      }
    }
    return out.join('');
  }
  function polygonMask(points,width,height){
    const mask=new Uint8Array(width*height);if(points.length<3)return mask;
    let minY=height,maxY=0;for(const p of points){minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}const y0=Math.max(0,Math.floor(minY)),y1=Math.min(height,Math.ceil(maxY));
    for(let y=y0;y<y1;y++){const crosses=[],scan=y+.5;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[j],b=points[i];if((a.y>scan)!==(b.y>scan))crosses.push(a.x+(scan-a.y)*(b.x-a.x)/(b.y-a.y));}crosses.sort((a,b)=>a-b);for(let i=0;i+1<crosses.length;i+=2){const x0=Math.max(0,Math.ceil(crosses[i]-.5)),x1=Math.min(width,Math.ceil(crosses[i+1]-.5));if(x1>x0)mask.fill(1,y*width+x0,y*width+x1);}}return mask;
  }
  const api={selectColor,floodRegion,extractOutline,combineMasks,maskCount,strokeSmoother,pixelLine,selectionOutline,polygonMask};root.ContourCore=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
