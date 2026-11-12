// All geometry is in millimetres; display zoom never changes model values.
export const area = p => Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0))/2;
export function clipRect(poly, r){
  const edges=[[0,r.x,1],[0,r.x+r.w,-1],[1,r.y,1],[1,r.y+r.h,-1]];
  for(const [axis,value,sign] of edges){
    const out=[];if(!poly.length)break;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      const ai=sign*(a[axis]-value)>=-1e-7,bi=sign*(b[axis]-value)>=-1e-7;
      if(ai)out.push(a);
      if(ai!==bi){const t=(value-a[axis])/(b[axis]-a[axis]);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
    }poly=out;
  }return poly;
}
export function layout(rect, m, {collect=true}={}){
  const rad=m.angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
  const tx=rect.x+m.ox,ty=rect.y+m.oy;
  const rot=([x,y])=>[x*c-y*s+tx,x*s+y*c+ty];
  const inv=([x,y])=>[(x-tx)*c+(y-ty)*s,-(x-tx)*s+(y-ty)*c];
  const corners=[[rect.x,rect.y],[rect.x+rect.w,rect.y],[rect.x+rect.w,rect.y+rect.h],[rect.x,rect.y+rect.h]].map(inv);
  const px=m.w+m.joint,py=m.h+m.joint;
  if(px<=0||py<=0)throw Error('Invalid tile dimensions.');
  const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
  const x0=Math.floor(Math.min(...xs)/px)-1,x1=Math.ceil(Math.max(...xs)/px)+1;
  const y0=Math.floor(Math.min(...ys)/py)-1,y1=Math.ceil(Math.max(...ys)/py)+1;
  if((x1-x0+1)*(y1-y0+1)>18000)throw Error('Too many pieces for this preview. Increase tile size or reduce the room.');
  let full=0,cut=0,covered=0;const pieces=[];
  for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++){
    const shift=m.pattern==='staggered'&&Math.abs(j%2)===1?px/2:0;
    const x=i*px+shift,y=j*py;
    const original=[[x,y],[x+m.w,y],[x+m.w,y+m.h],[x,y+m.h]].map(rot);
    const polygon=clipRect(original,rect),a=area(polygon);if(a<0.01)continue;
    const isCut=Math.abs(a-m.w*m.h)>0.1;
    if(isCut)cut++;else full++;covered+=a;if(collect)pieces.push({polygon,cut:isCut});
  }
  const count=full+cut,recommended=Math.ceil(count*(1+m.reserve/100)-1e-9),boxes=Math.ceil(recommended/m.box);
  return {pieces,full,cut,count,covered,offcut:Math.max(0,count*m.w*m.h-covered)/1e6,area:rect.w*rect.h/1e6,recommended,boxes,buy:boxes*m.box,cost:boxes*m.price};
}
export function regions(room){
  if(room.split==='none')return [{x:0,y:0,w:room.w,h:room.h}];
  if(room.split==='vertical')return [{x:0,y:0,w:room.at,h:room.h},{x:room.at,y:0,w:room.w-room.at,h:room.h}];
  return [{x:0,y:0,w:room.w,h:room.at},{x:0,y:room.at,w:room.w,h:room.h-room.at}];
}
