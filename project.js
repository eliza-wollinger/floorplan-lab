import {validateRoom,outlineOf} from './room-geometry.js';
import {layout,regions} from './geometry.js';
export function validateProject(p){
 if(!p||![1,2,3].includes(p.version)||!Array.isArray(p.rooms)||!p.rooms.length||p.rooms.length>20)throw Error('Use a Floorplan Lab project with 1–20 rooms.');
 const num=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
 const legacy=p.version===1;
 for(const q of p.rooms){
  if(typeof q.name!=='string'||q.name.length>40||!num(q.w,500,15000)||!num(q.h,500,15000)||!['none','horizontal','vertical'].includes(q.split)||!num(q.at,200,15000)||!Array.isArray(q.materials)||q.materials.length!==2)throw Error('Invalid room geometry.');
  if(q.split!=='none'&&q.at>(q.split==='vertical'?q.w:q.h)-200)throw Error('Each divided area must be at least 200 mm wide.');
  if(p.version<3){q.outline=outlineOf(q);q.holes=[];q.shape='rectangle';}
  if(!Array.isArray(q.outline))throw Error('Missing room outline.');
  validateRoom(q);
  for(const a of q.materials){
   if(legacy){a.offset=a.offset??50;a.bands=a.bands??3;}
   if(!num(a.offset,0,100)||!Number.isInteger(a.bands)||a.bands<2||a.bands>8)throw Error('Invalid pattern settings.');
   for(const [key,min,max]of[['w',50,3000],['h',50,3000],['joint',0,20],['angle',0,180],['ox',-10000,10000],['oy',-10000,10000],['reserve',0,50],['box',1,200],['price',0,100000]])if(!num(a[key],min,max))throw Error('Invalid material value: '+key+'.');
   if(!Number.isInteger(a.box)||!['straight','staggered','herringbone','basket','hexagon'].includes(a.pattern)||!['square','large','small','wood','custom'].includes(a.preset))throw Error('Invalid material configuration.');
  }
  regions(q).forEach((rect,i)=>layout(rect,q.materials[i]));
 }p.version=3;return p;
}
