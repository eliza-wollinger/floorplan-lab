import {layout,regions} from './geometry.js';
const $=id=>document.getElementById(id),clone=v=>JSON.parse(JSON.stringify(v));
const material=()=>({preset:'square',w:600,h:600,joint:3,angle:0,ox:0,oy:0,pattern:'straight',reserve:10,box:4,price:0});
const room=(name='Living room')=>({name,w:4800,h:3600,split:'none',at:2400,materials:[material(),material()]});
let project={version:1,rooms:[room()]},selected=0,zone=0,history=[],future=[],results=[],showGrid=true,showCuts=true;
let view={x:-1000,y:-1000,w:6800,h:5600},baseWidth=6800,drag=null,tool='pan',dragFrame=null;
let optimizerWorker=null,proposal=null,optimizationContext=null;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r=()=>project.rooms[selected],m=()=>r().materials[zone];
function validate(p){
 if(!p||p.version!==1||!Array.isArray(p.rooms)||!p.rooms.length||p.rooms.length>20)throw Error('Use a Floorplan Lab version 1 project with 1–20 rooms.');
 const num=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
 for(const q of p.rooms){
  if(typeof q.name!=='string'||q.name.length>40||!num(q.w,500,15000)||!num(q.h,500,15000)||!['none','horizontal','vertical'].includes(q.split)||!num(q.at,200,15000)||!Array.isArray(q.materials)||q.materials.length!==2)throw Error('Invalid room geometry.');
  if(q.split!=='none'&&q.at>(q.split==='vertical'?q.w:q.h)-200)throw Error('Each divided area must be at least 200 mm wide.');
  for(const a of q.materials){for(const [key,min,max]of[['w',50,3000],['h',50,3000],['joint',0,20],['angle',0,180],['ox',-10000,10000],['oy',-10000,10000],['reserve',0,50],['box',1,200],['price',0,100000]])if(!num(a[key],min,max))throw Error('Invalid material value: '+key+'.');
   if(!Number.isInteger(a.box)||!['straight','staggered'].includes(a.pattern)||!['square','large','small','wood','custom'].includes(a.preset))throw Error('Invalid material configuration.');
  }
  regions(q).forEach((rect,i)=>layout(rect,q.materials[i]));
 }return p;
}
function status(msg){$('status').textContent=msg;}
function persist(){try{localStorage.setItem('floorplan-lab-v1',JSON.stringify(project));status('Saved locally · mm');}catch{status('Local save unavailable — export JSON to keep your work.');}}
try{const saved=localStorage.getItem('floorplan-lab-v1');if(saved)project=validate(JSON.parse(saved));}catch{status('Starting a new project.');}
function change(fn,fit=false){const previous=clone(project);try{fn();validate(project);history.push(previous);if(history.length>50)history.shift();future=[];persist();render(fit);}catch(e){project=previous;render();status(e.message);}}
function props(){
 const q=r(),a=m();$('roomName').value=q.name;$('roomW').value=q.w;$('roomH').value=q.h;$('split').value=q.split;$('splitAt').value=q.at;$('splitAt').max=(q.split==='vertical'?q.w:q.h)-200;$('splitLabel').hidden=q.split==='none';
 for(const [id,key]of Object.entries({tileW:'w',tileH:'h',joint:'joint',angle:'angle',ox:'ox',oy:'oy',reserve:'reserve',box:'box',price:'price',pattern:'pattern',preset:'preset'}))$(id).value=a[key];
 $('delete').disabled=project.rooms.length===1;$('add').disabled=project.rooms.length>=20;$('undo').disabled=!history.length;$('redo').disabled=!future.length;
 $('drawingName').textContent=q.name;
 $('rooms').innerHTML=project.rooms.map((q,i)=>`<button class="room-row ${i===selected?'active':''}" data-room="${i}" aria-pressed="${i===selected}"><span>▱ &nbsp;${esc(q.name)}</span><small>${(q.w*q.h/1e6).toFixed(1)} m²</small></button>`).join('');
 $('areaTabs').innerHTML=regions(q).map((_,i)=>`<button data-zone="${i}" aria-pressed="${zone===i}">${q.split==='none'?'Entire room':'Area '+String(i+1).padStart(2,'0')}</button>`).join('');
}
function fitView(){const box=$('stage').getBoundingClientRect(),aspect=box.width/Math.max(1,box.height);let w=r().w+1500,h=r().h+1700;if(w/h<aspect)w=h*aspect;else h=w/aspect;view={x:(r().w-w)/2,y:(r().h-h)/2,w,h};baseWidth=w;}
function render(fit=false){if(selected>=project.rooms.length)selected=project.rooms.length-1;if(r().split==='none')zone=0;props();if(fit)fitView();results=regions(r()).map((rect,i)=>layout(rect,r().materials[i]));draw();stats();}
function draw(){
 const q=r(),rects=regions(q),f=view.w/Math.max($('stage').clientWidth,1),text=11*f,dim=27*f;
 const pts=p=>p.map(a=>a.join(',')).join(' ');
 let svg=`<defs><pattern id="dotGrid" width="200" height="200" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="${.6*f}" fill="#000" opacity=".16"/></pattern><pattern id="cutHatch" width="${7*f}" height="${7*f}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${7*f}" stroke="#111" stroke-width="${.65*f}" opacity=".35"/></pattern></defs>`;
 if(showGrid)svg+=`<rect x="${view.x}" y="${view.y}" width="${view.w}" height="${view.h}" fill="url(#dotGrid)"/>`;
 rects.forEach((rect,i)=>{
  svg+=`<g data-area="${i}"><rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="white"/>`;
  for(const p of results[i].pieces)svg+=`<polygon points="${pts(p.polygon)}" fill="${p.cut&&showCuts?'url(#cutHatch)':'white'}" stroke="#222" stroke-width=".65" vector-effect="non-scaling-stroke"/>`;
  svg+=`</g>`;
 });
 svg+=`<rect x="0" y="0" width="${q.w}" height="${q.h}" fill="none" stroke="#111" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
 if(q.split!=='none'){
  svg+=q.split==='vertical'?`<path d="M${q.at} 0V${q.h}"`:`<path d="M0 ${q.at}H${q.w}"`;
  svg+=` stroke="black" stroke-width="2" stroke-dasharray="7 5" vector-effect="non-scaling-stroke"/>`;
  const z=rects[zone];svg+=`<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" fill="none" stroke="black" stroke-width="2" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>`;
  rects.forEach((a,i)=>{const cx=a.x+a.w/2,cy=a.y+a.h/2;svg+=`<g data-area="${i}" style="cursor:pointer"><rect x="${cx-43*f}" y="${cy-14*f}" width="${86*f}" height="${28*f}" fill="${zone===i?'#111':'white'}" stroke="#111" stroke-width="1" vector-effect="non-scaling-stroke"/><text x="${cx}" y="${cy+4*f}" text-anchor="middle" font-family="monospace" font-size="${text}" fill="${zone===i?'white':'black'}">AREA 0${i+1}</text></g>`;});
 }
 const tick=6*f;
 svg+=`<g fill="none" stroke="#333" stroke-width=".75" vector-effect="non-scaling-stroke"><path vector-effect="non-scaling-stroke" d="M0 ${-dim-10*f}V${-8*f} M${q.w} ${-dim-10*f}V${-8*f} M0 ${-dim}H${q.w} M${-tick} ${-dim+tick}L${tick} ${-dim-tick} M${q.w-tick} ${-dim+tick}L${q.w+tick} ${-dim-tick} M${-dim-10*f} 0H${-8*f} M${-dim-10*f} ${q.h}H${-8*f} M${-dim} 0V${q.h} M${-dim-tick} ${tick}L${-dim+tick} ${-tick} M${-dim-tick} ${q.h+tick}L${-dim+tick} ${q.h-tick}"/></g>`;
 svg+=`<g font-family="monospace" font-size="${text}" fill="#333" text-anchor="middle"><text x="${q.w/2}" y="${-dim-10*f}">${q.w.toLocaleString('en-US')} mm</text><text transform="translate(${-dim-10*f} ${q.h/2}) rotate(-90)">${q.h.toLocaleString('en-US')} mm</text><text x="${q.w/2}" y="${q.h+38*f}">${esc(q.name.toUpperCase())} · ${(q.w*q.h/1e6).toFixed(2)} m²</text></g>`;
 $('drawing').setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);$('drawing').innerHTML=svg;$('zoomValue').textContent=Math.round(baseWidth/view.w*100)+'%';
}
function stats(){const total=key=>results.reduce((s,a)=>s+a[key],0);$('area').textContent=total('area').toFixed(2)+' m²';$('full').textContent=total('full');$('cut').textContent=total('cut');$('offcut').textContent=total('offcut').toFixed(2)+' m²';const a=results[zone];$('recommended').textContent=a.recommended;$('boxes').textContent=a.boxes+' / '+a.buy+' pcs';$('cost').textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'BRL'}).format(a.cost);}
$('rooms').onclick=e=>{const el=e.target.closest('[data-room]');if(el){selected=+el.dataset.room;zone=0;render(true);}};
$('areaTabs').onclick=e=>{const el=e.target.closest('[data-zone]');if(el){zone=+el.dataset.zone;render();}};
$('roomName').onchange=()=>change(()=>r().name=$('roomName').value.trim()||'Untitled room');
for(const [id,key]of [['roomW','w'],['roomH','h']])$(id).onchange=()=>change(()=>{r()[key]=+$(id).value;const max=(r().split==='vertical'?r().w:r().h)-200;r().at=Math.min(r().at,max);},true);
$('split').onchange=()=>change(()=>{r().split=$('split').value;r().at=Math.round((r().split==='vertical'?r().w:r().h)/2);zone=0;});
$('splitAt').onchange=()=>change(()=>r().at=+$('splitAt').value);
for(const [id,key]of Object.entries({tileW:'w',tileH:'h',joint:'joint',angle:'angle',ox:'ox',oy:'oy',reserve:'reserve',box:'box',price:'price'}))$(id).onchange=()=>change(()=>{m()[key]=Number($(id).value);if(key==='w'||key==='h')m().preset='custom';});
$('pattern').onchange=()=>change(()=>m().pattern=$('pattern').value);
$('preset').onchange=()=>change(()=>{const val=$('preset').value;m().preset=val;const presets={square:[600,600,'straight'],large:[600,1200,'straight'],wood:[180,1200,'staggered'],small:[200,200,'straight']};if(presets[val]){[m().w,m().h,m().pattern]=presets[val];}});
$('add').onclick=()=>change(()=>{project.rooms.push(room('Room '+(project.rooms.length+1)));selected=project.rooms.length-1;zone=0;},true);
$('delete').onclick=()=>{if(project.rooms.length>1)change(()=>{project.rooms.splice(selected,1);selected=Math.max(0,selected-1);zone=0;},true);};
function undo(redo=false){const src=redo?future:history,dst=redo?history:future;if(!src.length)return;dst.push(clone(project));project=src.pop();selected=Math.min(selected,project.rooms.length-1);zone=0;persist();render(true);}
$('undo').onclick=()=>undo();$('redo').onclick=()=>undo(true);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();undo(e.shiftKey);}});
$('grid').onclick=()=>{showGrid=!showGrid;$('grid').setAttribute('aria-pressed',showGrid);draw();};$('cuts').onclick=()=>{showCuts=!showCuts;$('cuts').setAttribute('aria-pressed',showCuts);draw();};$('fit').onclick=()=>{fitView();draw();};
function zoom(factor,x=.5,y=.5){const newW=Math.max(baseWidth*.2,Math.min(baseWidth*4,view.w*factor)),ratio=newW/view.w;view.x+=view.w*x*(1-ratio);view.y+=view.h*y*(1-ratio);view.w*=ratio;view.h*=ratio;draw();}
$('plus').onclick=()=>zoom(.8);$('minus').onclick=()=>zoom(1.25);
$('drawing').addEventListener('wheel',e=>{e.preventDefault();if(drag)return;const b=$('drawing').getBoundingClientRect();zoom(e.deltaY>0?1.1:1/1.1,(e.clientX-b.left)/b.width,(e.clientY-b.top)/b.height);},{passive:false});
function setTool(next){tool=next;$('panTool').setAttribute('aria-pressed',next==='pan');$('moveTool').setAttribute('aria-pressed',next==='move');$('drawing').classList.toggle('move-layout',next==='move');$('toolHint').textContent=next==='move'?'Drag a pattern. The room stays fixed.':'Drag to move the view.';}
$('panTool').onclick=()=>setTool('pan');$('moveTool').onclick=()=>setTool('move');
function hitArea(e){
 const b=$('drawing').getBoundingClientRect(),x=view.x+(e.clientX-b.left)*view.w/b.width,y=view.y+(e.clientY-b.top)*view.h/b.height;
 return regions(r()).findIndex(a=>x>=a.x&&x<=a.x+a.w&&y>=a.y&&y<=a.y+a.h);
}
$('drawing').onpointerdown=e=>{
 if(e.button!==0||drag)return;
 const area=hitArea(e),moving=tool==='move'&&area>=0;
 if(tool==='move'&&area<0){status('Drag inside an area to move its layout. Use Pan view to move the drawing.');return;}
 if(moving){zone=area;render();}
 drag={x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,vx:view.x,vy:view.y,sx:view.w/$('drawing').clientWidth,sy:view.h/$('drawing').clientHeight,moved:false,area,moving,old:clone(project),ox:m().ox,oy:m().oy};
 $('drawing').setPointerCapture(e.pointerId);$('drawing').classList.add('dragging');
};
function flushDrag(){
 if(dragFrame!==null){cancelAnimationFrame(dragFrame);dragFrame=null;}
 if(!drag)return;
 const dx=drag.px-drag.x,dy=drag.py-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;
 if(!drag.moved)return;
 if(!drag.moving){view.x=drag.vx-dx*drag.sx;view.y=drag.vy-dy*drag.sy;draw();return;}
 const oldX=m().ox,oldY=m().oy;
 m().ox=Math.max(-10000,Math.min(10000,Math.round(drag.ox+dx*drag.sx)));
 m().oy=Math.max(-10000,Math.min(10000,Math.round(drag.oy+dy*drag.sy)));
 try{results[zone]=layout(regions(r())[zone],m());$('ox').value=m().ox;$('oy').value=m().oy;draw();stats();status('Moving layout · release to save · Esc to cancel');}
 catch(e){m().ox=oldX;m().oy=oldY;status(e.message);}
}
$('drawing').onpointermove=e=>{if(!drag)return;drag.px=e.clientX;drag.py=e.clientY;if(dragFrame===null)dragFrame=requestAnimationFrame(()=>{dragFrame=null;flushDrag();});};
function finishDrag(cancel=false){
 if(!drag)return;
 if(!cancel)flushDrag();else if(dragFrame!==null){cancelAnimationFrame(dragFrame);dragFrame=null;}
 const d=drag;drag=null;$('drawing').classList.remove('dragging');
 if(cancel){if(d.moving)project=d.old;else{view.x=d.vx;view.y=d.vy;}render();status('Drag cancelled.');return;}
 if(d.moving&&d.moved&&(m().ox!==d.ox||m().oy!==d.oy)){history.push(d.old);if(history.length>50)history.shift();future=[];persist();render();}
 else if(!d.moved&&d.area>=0){zone=d.area;render();}
}
$('drawing').onpointerup=e=>{if(drag){drag.px=e.clientX;drag.py=e.clientY;}finishDrag();};
$('drawing').onpointercancel=()=>finishDrag(true);
$('drawing').onlostpointercapture=()=>{if(drag)finishDrag(true);};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){e.preventDefault();finishDrag(true);}});
function stopSearch(){if(optimizerWorker){optimizerWorker.terminate();optimizerWorker=null;}$('searchProgress').classList.remove('busy');$('runOptimizer').disabled=false;}
function closeOptimization(){stopSearch();proposal=null;optimizationContext=null;$('optimizerDialog').close();}
$('optimize').onclick=()=>{
 finishDrag();optimizationContext={project:JSON.stringify(project),room:selected,zone,rect:regions(r())[zone],material:clone(m())};proposal=null;
 $('comparison').hidden=true;$('applyOptimizer').hidden=true;$('runOptimizer').hidden=false;$('runOptimizer').disabled=false;$('searchProgress').textContent='Ready to compare layout origins.';
 $('optimizerDialog').showModal();
};
$('closeOptimizer').onclick=$('cancelOptimizer').onclick=closeOptimization;
$('optimizerDialog').addEventListener('cancel',e=>{e.preventDefault();closeOptimization();});
$('allowRotation').onchange=()=>{stopSearch();proposal=null;$('comparison').hidden=true;$('applyOptimizer').hidden=true;$('runOptimizer').hidden=false;$('searchProgress').textContent='Search options changed. Run again to compare.';};
function miniPlan(rect,mat){
 const a=layout(rect,mat),points=p=>p.map(v=>v.join(',')).join(' '),pad=Math.max(rect.w,rect.h)*.03;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${rect.x-pad} ${rect.y-pad} ${rect.w+pad*2} ${rect.h+pad*2}" role="img" aria-label="Layout comparison"><rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="white"/>${a.pieces.map(p=>`<polygon points="${points(p.polygon)}" fill="${p.cut?'#e5e5e5':'white'}" stroke="black" stroke-width=".6" vector-effect="non-scaling-stroke"/>`).join('')}<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="none" stroke="black" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
}
function showComparison(data){
 proposal=data;const a=data.initial,b=data.best.stats,ctx=optimizationContext,rows=[['Source pieces',a.count,b.count],['Pieces requiring cuts',a.cut,b.cut],['Cutting offcuts',a.offcut.toFixed(3)+' m²',b.offcut.toFixed(3)+' m²'],['Boxes with reserve',a.boxes,b.boxes],['Rotation',ctx.material.angle+'°',data.best.material.angle+'°']];
 const saved=a.count-b.count;
 $('comparison').innerHTML=`<div class="comparison-plans"><div class="comparison-plan"><strong>CURRENT</strong>${miniPlan(ctx.rect,ctx.material)}</div><div class="comparison-plan"><strong>BEST FOUND</strong>${miniPlan(ctx.rect,data.best.material)}</div></div><table class="comparison-table"><thead><tr><th>Selected area</th><th>Current</th><th>Best found</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td></tr>`).join('')}</tbody></table><p class="result-note">${saved>0?`${saved} fewer source piece${saved===1?'':'s'} (${(saved/a.count*100).toFixed(1)}% reduction).`:data.improved?'Same source-piece count; improved cuts or offcuts.':'No better layout found in this search. Your current layout is retained.'} ${a.boxes===b.boxes?'The rounded box quantity is unchanged.':''}</p><p class="hint">${data.tested} candidates evaluated. One new piece per cut; no offcut reuse. Best found among sampled origins and enabled angles, not a guaranteed global minimum.</p>`;
 $('comparison').hidden=false;$('applyOptimizer').hidden=!data.improved;$('runOptimizer').hidden=true;
 $('searchProgress').textContent=data.improved?'A better fit is ready to review.':'Search complete.';
}
$('runOptimizer').onclick=()=>{
 stopSearch();proposal=null;$('comparison').hidden=true;$('applyOptimizer').hidden=true;$('runOptimizer').disabled=true;$('searchProgress').classList.add('busy');$('searchProgress').textContent='Searching layout origins…';
 try{
  optimizerWorker=new Worker(new URL('./optimizer-worker.js',import.meta.url),{type:'module'});
  optimizerWorker.onmessage=({data})=>{
   if(data.type==='progress'){$('searchProgress').textContent=`${data.phase} · ${data.tested} candidates`;return;}
   stopSearch();if(data.type==='error'){$('searchProgress').textContent='Search failed: '+data.message;return;}showComparison(data);
  };
  optimizerWorker.onerror=()=>{stopSearch();$('searchProgress').textContent='Could not run optimization. Serve all project files over HTTP and try again.';};
  optimizerWorker.postMessage({...optimizationContext,allowRotation:$('allowRotation').checked});
 }catch(e){stopSearch();$('searchProgress').textContent='Could not start search: '+e.message;}
};
$('applyOptimizer').onclick=()=>{
 if(!proposal||!optimizationContext)return;
 if(JSON.stringify(project)!==optimizationContext.project||selected!==optimizationContext.room||zone!==optimizationContext.zone){closeOptimization();status('Project changed. Please run optimization again.');return;}
 const candidate=clone(proposal.best.material);closeOptimization();change(()=>r().materials[zone]=candidate);status('Best found applied · Undo restores the previous layout.');
};
function download(name,type,data){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
$('save').onclick=()=>{download('floorplan-lab-project.json','application/json',JSON.stringify(project,null,2));status('Project exported as JSON.');};
$('open').onclick=()=>$('file').click();$('file').onchange=async()=>{const file=$('file').files[0];if(!file)return;try{if(file.size>2e6)throw Error('Project file must be under 2 MB.');const incoming=validate(JSON.parse(await file.text()));change(()=>{project=clone(incoming);selected=0;zone=0;},true);status('Project opened.');}catch(e){status('Could not open: '+e.message);}finally{$('file').value='';}};
$('export').onclick=()=>{const old={...view},grid=showGrid;fitView();showGrid=false;draw();const svg=$('drawing').cloneNode(true);svg.setAttribute('width','1400');svg.setAttribute('height',String(Math.round(1400*view.h/view.w)));const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=r().name+' — conceptual floor layout, dimensions in mm';svg.prepend(title);download('floorplan-lab-drawing.svg','image/svg+xml',new XMLSerializer().serializeToString(svg));view=old;showGrid=grid;draw();status('Vector drawing exported. Purchase estimate stays in the project.');};
$('help').onclick=()=>$('guide').showModal();$('closeGuide').onclick=$('startGuide').onclick=()=>$('guide').close();
new ResizeObserver(()=>{fitView();if(results.length)draw();}).observe($('stage'));
render(true);
