// Simple polygon rooms, in mm. Convex cells are internal computation only;
// the renderer clips original pieces to the room to avoid triangulation seams.
const EPS=1e-7;
export const rectangle=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
export const signedArea=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
export const polygonArea=p=>Math.abs(signedArea(p));
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const onSegment=(p,a,b)=>Math.abs(cross(a,b,p))<EPS&&p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS;
function intersects(a,b,c,d){
 const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
 return ((abC>EPS&&abD<-EPS||abC<-EPS&&abD>EPS)&&(cdA>EPS&&cdB<-EPS||cdA<-EPS&&cdB>EPS))||onSegment(a,c,d)||onSegment(b,c,d)||onSegment(c,a,b)||onSegment(d,a,b);
}
export function contains(poly,p,boundary=true){
 let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[j],b=poly[i];if(onSegment(p,a,b))return boundary;
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;
}
export const outlineOf=q=>q.outline??rectangle(0,0,q.w,q.h);
export const roomArea=q=>polygonArea(outlineOf(q))-(q.holes??[]).reduce((s,h)=>s+h.w*h.h,0);
export const inRoom=(q,p)=>contains(outlineOf(q),p)&&!(q.holes??[]).some(h=>contains(rectangle(h.x,h.y,h.w,h.h),p));
export function validateRoom(q){
 const p=outlineOf(q);
 if(!Array.isArray(p)||p.length<3||p.length>40)throw Error('A room needs 3–40 vertices.');
 for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length];
  if(!Array.isArray(a)||a.length!==2||a.some(v=>typeof v!=='number'||!Number.isFinite(v))||a[0]<0||a[1]<0||a[0]>q.w||a[1]>q.h)throw Error('Vertices must stay inside the room envelope.');
  if(Math.hypot(a[0]-b[0],a[1]-b[1])<1)throw Error('Adjacent vertices must be at least 1 mm apart.');
  for(let j=i+1;j<p.length;j++){
   if(j===i+1||(i===0&&j===p.length-1))continue;
   if(intersects(a,b,p[j],p[(j+1)%p.length]))throw Error('Room edges cannot cross or touch each other.');
  }
  const prev=p[(i+p.length-1)%p.length];
  if(Math.abs(cross(prev,a,b))<EPS&&(prev[0]-a[0])*(b[0]-a[0])+(prev[1]-a[1])*(b[1]-a[1])>0)throw Error('Room edges cannot fold back on themselves.');
 }
 if(polygonArea(p)<10000)throw Error('Room area must be at least 0.01 m².');
 if(!Array.isArray(q.holes)||q.holes.length>10)throw Error('Use up to 10 rectangular exclusions.');
 for(let i=0;i<q.holes.length;i++){
  const h=q.holes[i];
  if(!h||['x','y','w','h'].some(k=>typeof h[k]!=='number'||!Number.isFinite(h[k]))||h.w<10||h.h<10)throw Error('Pillars need valid dimensions of at least 10 mm.');
  const hp=rectangle(h.x,h.y,h.w,h.h);
  if(!hp.every(v=>contains(p,v,false))||hp.some((a,j)=>p.some((b,k)=>intersects(a,hp[(j+1)%4],b,p[(k+1)%p.length]))))throw Error('Keep pillars fully inside the room, away from its boundary.');
  if(q.holes.slice(0,i).some(o=>h.x<o.x+o.w+EPS&&h.x+h.w>o.x-EPS&&h.y<o.y+o.h+EPS&&h.y+h.h>o.y-EPS))throw Error('Pillars cannot overlap or touch.');
 }
 return q;
}
export function triangulate(poly){
 let p=poly.map(v=>[...v]);if(signedArea(p)<0)p.reverse();
 // Remove redundant collinear points only in the computational copy.
 let changed=true;while(changed&&p.length>3){changed=false;for(let i=0;i<p.length;i++)if(Math.abs(cross(p[(i+p.length-1)%p.length],p[i],p[(i+1)%p.length]))<EPS){p.splice(i,1);changed=true;break;}}
 const triangles=[];
 while(p.length>3){
  let found=false;
  for(let i=0;i<p.length;i++){
   const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length];
   if(cross(a,b,c)<=EPS)continue;
   if(p.some(v=>v!==a&&v!==b&&v!==c&&cross(a,b,v)>=-EPS&&cross(b,c,v)>=-EPS&&cross(c,a,v)>=-EPS))continue;
   triangles.push([a,b,c]);p.splice(i,1);found=true;break;
  }
  if(!found)throw Error('Cannot triangulate this room. Check its vertices.');
 }
 triangles.push(p);return triangles;
}
function halfPlane(poly,a,b,sign=1){
 const out=[];
 for(let i=0;i<poly.length;i++){
  const p=poly[i],q=poly[(i+1)%poly.length],dp=sign*cross(a,b,p),dq=sign*cross(a,b,q),pi=dp>=-EPS,qi=dq>=-EPS;
  if(pi)out.push(p);
  if(pi!==qi){const t=dp/(dp-dq);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
 }return out;
}
export function clipConvex(poly,clip){
 const sign=signedArea(clip)>=0?1:-1;
 for(let i=0;i<clip.length&&poly.length;i++)poly=halfPlane(poly,clip[i],clip[(i+1)%clip.length],sign);
 return poly;
}
export function subtractRect(poly,h){
 const rect=rectangle(h.x,h.y,h.w,h.h),out=[];let inside=poly;
 for(let i=0;i<4&&inside.length;i++){
  const outside=halfPlane(inside,rect[i],rect[(i+1)%4],-1);
  if(polygonArea(outside)>EPS)out.push(outside);
  inside=halfPlane(inside,rect[i],rect[(i+1)%4]);
 }return out;
}
export function roomCells(q){
 let cells=triangulate(outlineOf(q));
 for(const h of q.holes??[])cells=cells.flatMap(p=>subtractRect(p,h));
 return cells;
}
export const pathOf=p=>'M'+p.map(v=>v.join(' ')).join('L')+'Z';
export const roomPath=q=>pathOf(outlineOf(q))+(q.holes??[]).map(h=>pathOf(rectangle(h.x,h.y,h.w,h.h))).join('');
