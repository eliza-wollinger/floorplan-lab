import test from 'node:test';
import assert from 'node:assert/strict';
import {layout,regions,area,compatibleLength} from '../../../../../Downloads/floorplan-lab-v0.4/floorplan-lab-v0.4/geometry.js';
import {validateRoom,rectangle,roomArea,roomCells,clipConvex,triangulate} from '../../../../../Downloads/floorplan-lab-v0.4/floorplan-lab-v0.4/room-geometry.js';
import {validateProject} from '../../../../../Downloads/floorplan-lab-v0.4/floorplan-lab-v0.4/project.js';
import {optimize,better} from '../../../../../Downloads/floorplan-lab-v0.4/floorplan-lab-v0.4/optimizer.js';
const mat={preset:'custom',w:500,h:500,joint:0,angle:0,ox:0,oy:0,pattern:'straight',reserve:0,box:1,price:0,offset:50,bands:3};
const room=()=>({name:'L room',w:2000,h:1500,outline:[[0,0],[1000,0],[1000,500],[2000,500],[2000,1500],[0,1500]],holes:[],split:'none',at:1000,materials:[{...mat},{...mat}]});
const near=(a,b)=>assert.ok(Math.abs(a-b)<.1,`${a} != ${b}`);
test('L room on exact grid: 10 full pieces, 2.5 m² and no triangulation cuts',()=>{const q=room(),a=layout(regions(q)[0],mat);assert.equal(a.full,10);assert.equal(a.cut,0);assert.equal(a.count,10);near(a.area,2.5);near(a.covered,2500000);near(a.offcut,0);});
test('one source tile surrounding a pillar is counted once, across all fragments',()=>{const q={...room(),w:1000,h:1000,outline:rectangle(0,0,1000,1000),holes:[{x:400,y:400,w:200,h:200}]};validateRoom(q);const a=layout(regions(q)[0],{...mat,w:1000,h:1000});assert.equal(a.count,1);assert.equal(a.cut,1);assert.equal(a.full,0);near(a.covered,960000);near(a.offcut,.04);assert.ok(a.pieces[0].fragments.length>1);});
test('L notch cutting one large source counts it once',()=>{const a=layout(regions(room())[0],{...mat,w:2000,h:1500});assert.equal(a.count,1);assert.equal(a.cut,1);near(a.offcut,.5);});
test('convex cells have disjoint interiors and preserve concave area minus multiple pillars',()=>{const q=room();q.holes=[{x:100,y:100,w:200,h:200},{x:1200,y:800,w:300,h:400}];validateRoom(q);const cells=roomCells(q);near(cells.reduce((s,p)=>s+area(p),0),2340000);for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++)near(area(clipConvex(cells[i],cells[j])),0);});
for(const pattern of ['straight','staggered','herringbone','basket','hexagon'])test(`${pattern} conserves L room area with a pillar, rotations and nonzero origin`,()=>{
 const q=room();q.holes=[{x:200,y:800,w:230,h:310}];const rect=regions(q)[0];
 for(const angle of [0,23,90])for(const joint of [0,3]){
  const m={...mat,w:200,h:600,pattern,angle,joint,ox:17,oy:-91};if(pattern==='basket')m.h=compatibleLength(m);
  const a=layout(rect,m);if(joint===0)near(a.covered,roomArea(q));else assert.ok(a.covered<roomArea(q));
  near(a.count*a.sourceArea-a.covered,a.offcut*1e6);
  for(const p of a.pieces)near(p.fragments.reduce((s,f)=>s+area(f),0),p.cut?p.fragments.reduce((s,f)=>s+area(f),0):a.sourceArea);
  const b=layout(rect,m,{collect:false});assert.equal(b.count,a.count);near(b.covered,a.covered);
 }
});
test('split regions conserve net area, including a pillar straddling the division',()=>{const q=room();q.holes=[{x:850,y:900,w:300,h:200}];q.split='vertical';const rs=regions(q);near(rs.reduce((s,r)=>s+r.surfaceArea,0),2440000);near(rs.map((r,i)=>layout(r,q.materials[i]).covered).reduce((s,a)=>s+a,0),2440000);});
test('reversed winding and redundant collinear vertices triangulate correctly',()=>{const p=[[0,0],[500,0],[1000,0],[1000,1000],[0,1000]].reverse();near(triangulate(p).reduce((s,p)=>s+area(p),0),1000000);});
test('self-crossing, folded, degenerate and outside outlines are rejected',()=>{
 for(const p of [[[0,0],[1000,1000],[0,1000],[1000,0]],[[0,0],[1000,0],[500,0],[500,1000],[0,1000]],[[0,0],[0,0],[0,1000]],[[0,0],[2100,0],[0,1000]]])assert.throws(()=>validateRoom({...room(),outline:p}));
});
test('pillars outside, touching, overlapping, or spanning a concave notch are rejected',()=>{
 for(const holes of [[{x:900,y:100,w:200,h:200}],[{x:0,y:600,w:100,h:100}],[{x:200,y:600,w:200,h:200},{x:300,y:700,w:200,h:200}]])assert.throws(()=>validateRoom({...room(),holes}));
 const q={...room(),w:2000,h:2000,outline:[[0,0],[2000,0],[2000,2000],[1200,2000],[1200,800],[800,800],[800,2000],[0,2000]],holes:[{x:400,y:1000,w:1200,h:200}]};assert.throws(()=>validateRoom(q),/inside/);
});
test('polygon geometry survives schema 3 save and open',()=>{const p={version:3,rooms:[room()]};p.rooms[0].holes=[{x:100,y:100,w:200,h:200}];const next=validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(next,p);});
test('optimizer uses clipped geometry and cannot worsen the starting L-room layout',()=>{const q=room();q.holes=[{x:200,y:700,w:250,h:250}];const rect=regions(q)[0],m={...mat,ox:127,oy:83},gen=optimize(rect,m,true);let step;while(!(step=gen.next()).done){}const a=step.value;assert.ok(!better(a.initial,a.best.stats));const final=layout(rect,a.best.material);assert.equal(final.count,a.best.stats.count);near(final.offcut,a.best.stats.offcut);near(final.covered,roomArea(q));});
