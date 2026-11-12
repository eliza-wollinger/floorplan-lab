import {layout} from './geometry.js';
// Lexicographic objective: source pieces, cut operations, then unused source area.
export function better(a,b){
 if(a.count!==b.count)return a.count<b.count;
 if(a.cut!==b.cut)return a.cut<b.cut;
 return a.offcut<b.offcut-1e-7;
}
export function* optimize(rect, material, allowRotation=false){
 const initial=layout(rect,material,{collect:false});
 let best={material:{...material},stats:initial},tested=0;
 const angles=allowRotation?[...new Set([material.angle,0,45,90])]:[material.angle];
 const px=material.w+material.joint,py=(material.h+material.joint)*(material.pattern==='staggered'?2:1);
 const seen=new Set();
 const probe=(angle,u,v)=>{
  const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const ox=Math.round((u*c-v*s)*1000)/1000,oy=Math.round((u*s+v*c)*1000)/1000;
  if(Math.abs(ox)>10000||Math.abs(oy)>10000)return;
  const key=[angle,ox,oy].join(':');if(seen.has(key))return;seen.add(key);tested++;
  const candidate={...material,angle,ox,oy};
  try{const stats=layout(rect,candidate,{collect:false});if(better(stats,best.stats))best={material:candidate,stats};return {material:candidate,stats};}
  catch(e){if(!e.message.includes('Too many pieces'))throw e;}
 };
 // Include the user's original setting; a sampled result can never worsen it.
 for(const angle of angles){
  let angleBest=null;
  for(let j=0;j<8;j++)for(let i=0;i<8;i++){
   const p=probe(angle,(i/8-.5)*px,(j/8-.5)*py);
   if(p&&(!angleBest||better(p.stats,angleBest.stats)))angleBest=p;
   yield {tested,best,phase:'Exploring origins'};
  }
  if(!angleBest)continue;
  for(let level=0;level<3;level++){
   const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),b=angleBest.material;
   const u=b.ox*c+b.oy*s,v=-b.ox*s+b.oy*c,stepX=px/(16*4**level),stepY=py/(16*4**level);
   for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){
    const p=probe(angle,u+i*stepX,v+j*stepY);
    if(p&&better(p.stats,angleBest.stats))angleBest=p;
    yield {tested,best,phase:'Refining best origins'};
   }
  }
 }
 return {best,initial,tested,improved:better(best.stats,initial)};
}
