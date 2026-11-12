import {optimize} from './optimizer.js';
self.onmessage=({data})=>{
 try{
  const search=optimize(data.rect,data.material,data.allowRotation);let next,last=0;
  while(!(next=search.next()).done){
   if(performance.now()-last>120){self.postMessage({type:'progress',tested:next.value.tested,phase:next.value.phase});last=performance.now();}
  }
  self.postMessage({type:'result',...next.value});
 }catch(e){self.postMessage({type:'error',message:e.message});}
};
