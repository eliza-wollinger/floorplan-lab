import {clipConvex,roomCells,outlineOf,rectangle as roomRectangle,roomPath} from './room-geometry.js';
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
const rectangle=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
export function compatibleLength(m){return (m.bands??3)*m.w+((m.bands??3)-1)*m.joint;}
export function patternDefinition(m){
 const g=m.joint,px=m.w+g,py=m.h+g,pattern=m.pattern;
 if(!Number.isFinite(px)||!Number.isFinite(py)||m.w<=0||m.h<=0||g<0)throw Error('Invalid tile dimensions.');
 if(pattern==='hexagon'){
  const d=m.w,R=(d+g)/Math.sqrt(3),r=d/Math.sqrt(3);
  return {basis:[[1.5*R,(d+g)/2],[0,d+g]],templates:[Array.from({length:6},(_,k)=>[r*Math.cos(k*Math.PI/3),r*Math.sin(k*Math.PI/3)])],sourceArea:Math.sqrt(3)/2*d*d};
 }
 if(pattern==='herringbone'){
  if(m.h<=m.w)throw Error('Herringbone needs a length greater than the width.');
  const L=py,W=px;
  return {basis:[[L,L],[W,-W]],templates:[rectangle(g/2,g/2,m.h,m.w),rectangle(L+g/2,g/2,m.w,m.h)],sourceArea:m.w*m.h};
 }
 if(pattern==='basket'){
  const n=m.bands??3,L=compatibleLength(m);
  if(!Number.isInteger(n)||n<2||n>8)throw Error('Choose 2–8 planks per block.');
  if(Math.abs(m.h-L)>.01)throw Error(`For ${n} planks and this joint, length must be ${L.toFixed(2)} mm.`);
  const B=n*px,templates=[];
  for(let k=0;k<n;k++){
   templates.push(rectangle(g/2,k*px+g/2,m.h,m.w));
   templates.push(rectangle(B+k*px+g/2,g/2,m.w,m.h));
  }
  return {basis:[[B,B],[B,-B]],templates,sourceArea:m.w*m.h};
 }
 if(!['straight','staggered'].includes(pattern))throw Error('Unknown layout pattern.');
 const offset=pattern==='staggered'?(m.offset??50)/100:0;
 if(!Number.isFinite(offset)||offset<0||offset>1)throw Error('Offset must be between 0 and 100%.');
 return {basis:[[px,0],[offset*px,py]],templates:[rectangle(0,0,m.w,m.h)],sourceArea:m.w*m.h};
}
export function layout(rect, m, {collect=true}={}){
 const def=patternDefinition(m),[u,v]=def.basis,det=u[0]*v[1]-u[1]*v[0];
 const rad=m.angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad),tx=rect.x+m.ox,ty=rect.y+m.oy;
 const rot=([x,y])=>[x*c-y*s+tx,x*s+y*c+ty];
 const inv=([x,y])=>[(x-tx)*c+(y-ty)*s,-(x-tx)*s+(y-ty)*c];
 const lattice=([x,y])=>[(x*v[1]-y*v[0])/det,(u[0]*y-u[1]*x)/det];
 const corners=rectangle(rect.x,rect.y,rect.w,rect.h).map(inv),points=def.templates.flat();
 const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),ax=points.map(p=>p[0]),ay=points.map(p=>p[1]);
 const minX=Math.min(...xs)-Math.max(...ax),maxX=Math.max(...xs)-Math.min(...ax),minY=Math.min(...ys)-Math.max(...ay),maxY=Math.max(...ys)-Math.min(...ay);
 const bounds=rectangle(minX,minY,maxX-minX,maxY-minY).map(lattice),is=bounds.map(p=>p[0]),js=bounds.map(p=>p[1]);
 const i0=Math.floor(Math.min(...is))-1,i1=Math.ceil(Math.max(...is))+1,j0=Math.floor(Math.min(...js))-1,j1=Math.ceil(Math.max(...js))+1;
 if((i1-i0+1)*(j1-j0+1)*def.templates.length>18000)throw Error('Too many pieces for this preview. Increase tile size or reduce the room.');
 let full=0,cut=0,covered=0;const pieces=[];
 for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
  const dx=i*u[0]+j*v[0],dy=i*u[1]+j*v[1];
  for(const template of def.templates){
   const original=template.map(([x,y])=>rot([x+dx,y+dy])),polygon=clipRect(original,rect);
   const fragments=rect.cells?rect.cells.map(cell=>clipConvex(polygon,cell)).filter(p=>area(p)>1e-7):[polygon],a=fragments.reduce((sum,p)=>sum+area(p),0);
   if(a<.01)continue;
   const isCut=Math.abs(a-def.sourceArea)>.1;
   if(isCut)cut++;else full++;covered+=a;
   if(collect)pieces.push(rect.cells?{polygon:fragments[0],fragments,source:original,cut:isCut}:{polygon,cut:isCut});
  }
 }
 const count=full+cut,recommended=Math.ceil(count*(1+m.reserve/100)-1e-9),boxes=Math.ceil(recommended/m.box);
 return {pieces,full,cut,count,covered,sourceArea:def.sourceArea,offcut:Math.max(0,count*def.sourceArea-covered)/1e6,area:(rect.surfaceArea??rect.w*rect.h)/1e6,recommended,boxes,buy:boxes*m.box,cost:boxes*m.price};
}
export function regions(room){
 const rects=room.split==='none'?[{x:0,y:0,w:room.w,h:room.h}]:room.split==='vertical'?[{x:0,y:0,w:room.at,h:room.h},{x:room.at,y:0,w:room.w-room.at,h:room.h}]:[{x:0,y:0,w:room.w,h:room.at},{x:0,y:room.at,w:room.w,h:room.h-room.at}];
 if(!(room.holes?.length)&&JSON.stringify(outlineOf(room))===JSON.stringify(roomRectangle(0,0,room.w,room.h)))return rects;
 const cells=roomCells(room),path=roomPath(room);
 return rects.map(r=>{const clipped=cells.map(p=>clipRect(p,r)).filter(p=>area(p)>1e-7);return {...r,cells:clipped,surfaceArea:clipped.reduce((s,p)=>s+area(p),0),roomPath:path};});
}
