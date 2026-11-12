import test from 'node:test';
import assert from 'node:assert/strict';
import {optimize,better} from '../optimizer.js';
import {layout} from '../geometry.js';
const m={w:600,h:600,joint:0,angle:0,ox:100,oy:100,pattern:'straight',reserve:10,box:4,price:100};
function run(rect,mat,rotation=false){const gen=optimize(rect,mat,rotation);let item;while(!(item=gen.next()).done){}return item.value;}
test('shifted 2×2 floor improves from nine source tiles to four',()=>{const a=run({x:0,y:0,w:1200,h:1200},m);assert.equal(a.initial.count,9);assert.equal(a.best.stats.count,4);assert.equal(a.best.stats.cut,0);assert.equal(a.best.stats.offcut,0);assert.equal(a.improved,true);});
test('already optimal layout is retained exactly',()=>{const mat={...m,ox:0,oy:0};const a=run({x:0,y:0,w:1200,h:1200},mat,true);assert.equal(a.improved,false);assert.deepEqual(a.best.material,mat);});
test('locked orientation remains fixed and proposal metrics reproduce',()=>{const rect={x:2700,y:300,w:1800,h:2300},mat={...m,w:180,h:1200,angle:31,joint:3,pattern:'staggered'};const a=run(rect,mat);assert.equal(a.best.material.angle,31);assert.ok(!better(a.initial,a.best.stats));const real=layout(rect,a.best.material);for(const key of ['count','cut','offcut','boxes','cost'])assert.equal(real[key],a.best.stats[key]);});
test('allowing rotation finds the six-piece rectangular fit',()=>{const rect={x:0,y:0,w:1200,h:900},mat={...m,w:300,h:600,angle:45,ox:0,oy:0};const a=run(rect,mat,true);assert.equal(a.best.stats.count,6);assert.equal(a.best.material.angle,90);});
test('quantity ranking prioritizes source pieces over cut count',()=>{assert.ok(better({count:5,cut:5,offcut:1},{count:6,cut:1,offcut:0}));assert.ok(!better({count:6,cut:1,offcut:0},{count:5,cut:5,offcut:1}));});
test('stats-only layout matches render geometry without collecting polygons',()=>{const rect={x:0,y:0,w:2300,h:1700},a=layout(rect,m),b=layout(rect,m,{collect:false});assert.equal(b.pieces.length,0);for(const key of ['count','full','cut','covered','offcut'])assert.equal(a[key],b[key]);});
