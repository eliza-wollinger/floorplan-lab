import test from 'node:test';
import assert from 'node:assert/strict';
import {layout,area,patternDefinition,compatibleLength} from '../../../../../Downloads/floorplan-lab-v0.4/floorplan-lab-v0.4/geometry.js';
import {optimize,better} from '../../../../../Downloads/floorplan-lab-v0.4/floorplan-lab-v0.4/optimizer.js';
const material={w:200,h:700,joint:0,angle:0,ox:37,oy:-121,pattern:'straight',reserve:10,box:4,price:100,offset:100/3,bands:3};
const rect={x:170,y:310,w:1600,h:1300};
function overlap(a,b){
 const signed=b.reduce((s,p,i)=>{const q=b[(i+1)%b.length];return s+p[0]*q[1]-q[0]*p[1]},0),sign=Math.sign(signed);
 let poly=a;
 for(let i=0;i<b.length;i++){
  const p=b[i],q=b[(i+1)%b.length],cross=v=>sign*((q[0]-p[0])*(v[1]-p[1])-(q[1]-p[1])*(v[0]-p[0]));
  const out=[];
  for(let j=0;j<poly.length;j++){
   const x=poly[j],y=poly[(j+1)%poly.length],cx=cross(x),cy=cross(y),xi=cx>=-1e-7,yi=cy>=-1e-7;
   if(xi)out.push(x);if(xi!==yi){const t=cx/(cx-cy);out.push([x[0]+t*(y[0]-x[0]),x[1]+t*(y[1]-x[1])]);}
  }poly=out;if(!poly.length)return 0;
 }return area(poly);
}
for(const pattern of ['staggered','herringbone','basket','hexagon']){
 test(pattern+': covers surface without overlaps, including rotation and joints',()=>{
  for(const angle of [0,29,90])for(const joint of [0,3]){
   const m={...material,pattern,angle,joint};if(pattern==='basket')m.h=compatibleLength(m);
   const out=layout(rect,m);
   if(joint===0)assert.ok(Math.abs(out.covered-rect.w*rect.h)<.2,`${pattern} ${angle}: ${out.covered}`);
   else assert.ok(out.covered<rect.w*rect.h);
   for(let i=0;i<out.pieces.length;i++)for(let j=i+1;j<out.pieces.length;j++)assert.ok(overlap(out.pieces[i].polygon,out.pieces[j].polygon)<.1,`${pattern} overlapping pieces`);
   assert.ok(out.offcut>=0);
  }
 });
 test(pattern+': optimization preserves pattern and never worsens consumption',()=>{
  const m={...material,pattern,angle:17,joint:2};if(pattern==='basket')m.h=compatibleLength(m);
  const gen=optimize(rect,m);let item;while(!(item=gen.next()).done){}const result=item.value;
  assert.equal(result.best.material.pattern,pattern);assert.equal(result.best.material.angle,17);
  assert.ok(!better(result.initial,result.best.stats));
  const check=layout(rect,result.best.material);assert.equal(check.count,result.best.stats.count);assert.equal(check.offcut,result.best.stats.offcut);
 });
}
test('hexagon width is flat-to-flat and source area matches regular hexagon',()=>{const def=patternDefinition({...material,pattern:'hexagon',w:300}),p=def.templates[0];assert.ok(Math.abs(Math.max(...p.map(v=>v[1]))-Math.min(...p.map(v=>v[1]))-300)<1e-8);assert.ok(Math.abs(area(p)-Math.sqrt(3)/2*300**2)<1e-7);});
test('parquet requires length consistent with count and joints',()=>{assert.equal(compatibleLength({...material,w:200,joint:3,bands:3}),606);assert.throws(()=>layout(rect,{...material,pattern:'basket',h:600,joint:3}),/606/);});
test('herringbone does not silently accept square pieces',()=>assert.throws(()=>layout(rect,{...material,pattern:'herringbone',h:200}),/greater/));
test('third and custom offsets are periodic under their oblique lattice',()=>{for(const offset of [100/3,27,50]){const m={...material,w:200,h:700,pattern:'staggered',offset,joint:3},a=layout(rect,m),b=layout(rect,{...m,ox:m.ox+(m.w+m.joint)*offset/100,oy:m.oy+m.h+m.joint});assert.equal(a.count,b.count);assert.ok(Math.abs(a.covered-b.covered)<.01);}});
