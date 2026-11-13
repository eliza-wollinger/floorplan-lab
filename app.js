import {rectangle,outlineOf,roomArea,inRoom,validateRoom,roomPath,pathOf} from './room-geometry.js';
import {layout,regions,compatibleLength} from './geometry.js';
import {validateProject} from './project.js';
const $=id=>document.getElementById(id),clone=v=>JSON.parse(JSON.stringify(v));
const material=()=>({preset:'square',w:600,h:600,joint:3,angle:0,ox:0,oy:0,pattern:'straight',offset:50,bands:3,reserve:10,box:4,price:0});
const room=(name='Living room')=>({name,w:4800,h:3600,split:'none',at:2400,outline:rectangle(0,0,4800,3600),holes:[],shape:'rectangle',materials:[material(),material()]});
let project={version:3,rooms:[room()]},selected=0,zone=0,history=[],future=[],results=[],showGrid=true,showCuts=true;
let view={x:-1000,y:-1000,w:6800,h:5600},baseWidth=6800,drag=null,tool='pan',dragFrame=null;
let vertex=0,pillar=0;
let optimizerWorker=null,proposal=null,optimizationContext=null;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r=()=>project.rooms[selected],m=()=>r().materials[zone];
const validate=validateProject;
function status(msg){$('status').textContent=msg;}
function persist(){try{localStorage.setItem('floorplan-lab-v4',JSON.stringify(project));status('Saved locally · mm');}catch{status('Local save unavailable — export JSON to keep your work.');}}
try{const saved=localStorage.getItem('floorplan-lab-v4')||localStorage.getItem('floorplan-lab-v3')||localStorage.getItem('floorplan-lab-v1');if(saved)project=validate(JSON.parse(saved));}catch{status('Starting a new project.');}
function change(fn,fit=false){const previous=clone(project);try{fn();validate(project);history.push(previous);if(history.length>50)history.shift();future=[];persist();render(fit);return true;}catch(e){project=previous;render();status(e.message);return false;}}
const patternNames={straight:'Aligned',staggered:'Running bond',herringbone:'Herringbone',basket:'Basket weave',hexagon:'Hexagon'};
const galleryItems=[
 {id:'horizontal',name:'Aligned horizontal',tag:'RECTANGULAR',pattern:'straight',angle:0,w:480,h:240,note:'Straight rows · 0°'},
 {id:'vertical',name:'Aligned vertical',tag:'RECTANGULAR',pattern:'straight',angle:90,w:480,h:240,note:'Straight rows · 90°'},
 {id:'diagonal',name:'Aligned diagonal',tag:'RECTANGULAR',pattern:'straight',angle:45,w:400,h:240,note:'Straight rows · 45°'},
 {id:'staggered',name:'Running bond',tag:'OFFSET ROWS',pattern:'staggered',angle:0,w:480,h:240,note:'½, ⅓ or custom row offset'},
 {id:'herringbone',name:'Herringbone',tag:'WOOD & TILE',pattern:'herringbone',angle:45,w:160,h:640,note:'Perpendicular rectangular pieces'},
 {id:'basket',name:'Basket weave / parquet',tag:'ALTERNATING BLOCKS',pattern:'basket',angle:0,w:160,h:488,note:'2–8 planks per compatible block'},
 {id:'hexagon',name:'Regular hexagon',tag:'GEOMETRIC',pattern:'hexagon',angle:0,w:300,h:300,note:'Size measured across parallel faces'}
];
function previewPattern(a){
 const rect={x:0,y:0,w:1800,h:1100},pieces=layout(rect,a).pieces;
 return `<svg viewBox="0 0 1800 1100" aria-hidden="true" focusable="false">${pieces.map(p=>`<polygon points="${p.polygon.map(v=>v.join(',')).join(' ')}" fill="white" stroke="currentColor" stroke-width=".7" vector-effect="non-scaling-stroke"/>`).join('')}</svg>`;
}
function openPatterns(){
 $('patternCards').innerHTML=galleryItems.map(g=>{
  const a={...material(),pattern:g.pattern,w:g.w,h:g.h,angle:g.angle,joint:4};
  if(g.pattern==='basket')a.h=compatibleLength(a);
  const active=m().pattern===g.pattern&&(g.pattern!=='straight'||m().angle===g.angle);
  return `<button class="pattern-card" data-pattern="${g.id}" aria-pressed="${active}"><span class="pattern-tag">${g.tag}</span>${previewPattern(a)}<strong>${g.name}</strong><span class="pattern-note">${g.note}</span></button>`;
 }).join('');$('patternLibrary').showModal();
}
function choosePattern(id){
 const g=galleryItems.find(a=>a.id===id);const pattern=g?g.pattern:id;
 const applied=change(()=>{
  const a=m(),previous=a.pattern;a.pattern=pattern;
  if(g)a.angle=g.angle;
  if(pattern==='herringbone'){
   if(a.h<a.w)[a.w,a.h]=[a.h,a.w];
   if(a.h===a.w){a.w=200;a.h=800;}
   a.preset='custom';
  }
  if(pattern==='basket'){
   if(compatibleLength(a)>3000)a.w=200;
   a.h=compatibleLength(a);a.preset='custom';
  }
  if(pattern==='hexagon'){
   if(previous!=='hexagon'){a.w=300;a.h=300;a.price=0;}
   a.preset='custom';
  }
 });
 if(!applied)return;
 if($('patternLibrary').open)$('patternLibrary').close();
 status(pattern==='basket'?'Basket weave: length calculated to fit the block. Check your product dimensions.':pattern==='hexagon'?'Regular hexagon: size is measured across flats. Review box quantity and price.':'Pattern applied · drag or rotate to explore.');
}
function updatePatternControls(){
 const a=m(),hex=a.pattern==='hexagon',basket=a.pattern==='basket';
 $('patternLabel').textContent=patternNames[a.pattern];$('pattern').value=a.pattern;
 $('widthTitle').textContent=hex?'Across flats':'Width';$('lengthField').hidden=hex;$('tileH').disabled=basket;
 $('preset').disabled=hex||basket;
 for(const option of $('preset').options)option.disabled=a.pattern==='herringbone'&&['square','small'].includes(option.value);
 $('offsetControls').hidden=a.pattern!=='staggered';$('offset').value=Number((a.offset??50).toFixed(4));
 $('halfOffset').setAttribute('aria-pressed',Math.abs(a.offset-50)<.0001);$('thirdOffset').setAttribute('aria-pressed',Math.abs(a.offset-100/3)<.0001);
 $('basketControls').hidden=!basket;$('bands').value=a.bands;
 $('shapeNote').textContent=hex?`Regular hexagon · ${a.w} mm across flats · ${(2*a.w/Math.sqrt(3)).toFixed(2)} mm corner to corner. Joint is the perpendicular gap between edges.`:basket?`${a.bands} planks per block. Compatible length = ${a.bands} × ${a.w} + ${a.bands-1} × ${a.joint} = ${a.h.toFixed(2)} mm. Length updates automatically; verify your product matches.`:a.pattern==='herringbone'?'Width is the short side; length must be greater. Rotation turns the entire herringbone pattern.':'Dimensions describe one piece. Rotation turns the whole layout.';
 $('patternChip').innerHTML=patternIcon(a.pattern);
}
function patternIcon(pattern){
 const g=galleryItems.find(x=>x.pattern===pattern),a={...material(),pattern,w:g.w,h:g.h,joint:4,angle:g.angle};
 if(pattern==='basket')a.h=compatibleLength(a);return previewPattern(a);
}
$('choosePattern').onclick=openPatterns;$('closePatterns').onclick=()=>$('patternLibrary').close();
$('patternCards').onclick=e=>{const el=e.target.closest('[data-pattern]');if(el)choosePattern(el.dataset.pattern);};
$('offset').onchange=()=>change(()=>m().offset=+$('offset').value);
$('halfOffset').onclick=()=>change(()=>m().offset=50);$('thirdOffset').onclick=()=>change(()=>m().offset=100/3);
$('bands').onchange=()=>change(()=>{m().bands=+$('bands').value;m().h=compatibleLength(m());});

function geometryProps(){
 const q=r();vertex=Math.max(0,Math.min(vertex,q.outline.length-1));pillar=Math.max(0,Math.min(pillar,q.holes.length-1));
 $('roomShape').value=q.shape??'custom';$('vertexControls').hidden=tool!=='edit';
 $('vertexSelect').innerHTML=q.outline.map((_,i)=>`<option value="${i}">Vertex ${i+1}</option>`).join('');$('vertexSelect').value=vertex;
 $('vertexX').value=q.outline[vertex][0];$('vertexY').value=q.outline[vertex][1];$('vertexX').max=q.w;$('vertexY').max=q.h;
 $('addVertex').disabled=q.outline.length>=40;$('removeVertex').disabled=q.outline.length<=3;
 $('pillarCount').textContent=q.holes.length;$('pillarControls').hidden=!q.holes.length;$('addPillar').disabled=q.holes.length>=10;
 $('pillarSelect').innerHTML=q.holes.map((_,i)=>`<option value="${i}">Pillar ${i+1}</option>`).join('');$('pillarSelect').value=pillar;
 if(q.holes.length)for(const [id,key]of [['pillarX','x'],['pillarY','y'],['pillarW','w'],['pillarH','h']])$(id).value=q.holes[pillar][key];
}
function props(){
 const q=r(),a=m();$('roomName').value=q.name;$('roomW').value=q.w;$('roomH').value=q.h;$('split').value=q.split;$('splitAt').value=q.at;$('splitAt').max=(q.split==='vertical'?q.w:q.h)-200;$('splitLabel').hidden=q.split==='none';
 for(const [id,key]of Object.entries({tileW:'w',tileH:'h',joint:'joint',angle:'angle',ox:'ox',oy:'oy',reserve:'reserve',box:'box',price:'price',pattern:'pattern',preset:'preset'}))$(id).value=a[key];
 updatePatternControls();geometryProps();
 $('delete').disabled=project.rooms.length===1;$('add').disabled=project.rooms.length>=20;$('undo').disabled=!history.length;$('redo').disabled=!future.length;
 $('drawingName').textContent=q.name;
 $('rooms').innerHTML=project.rooms.map((q,i)=>`<button class="room-row ${i===selected?'active':''}" data-room="${i}" aria-pressed="${i===selected}"><span>▱ &nbsp;${esc(q.name)}</span><small>${(roomArea(q)/1e6).toFixed(1)} m²</small></button>`).join('');
 $('areaTabs').innerHTML=regions(q).map((_,i)=>`<button data-zone="${i}" aria-pressed="${zone===i}">${q.split==='none'?'Entire room':'Area '+String(i+1).padStart(2,'0')}</button>`).join('');
}
function fitView(){const box=$('stage').getBoundingClientRect(),aspect=box.width/Math.max(1,box.height);let w=r().w+1500,h=r().h+1700;if(w/h<aspect)w=h*aspect;else h=w/aspect;view={x:(r().w-w)/2,y:(r().h-h)/2,w,h};baseWidth=w;}
function render(fit=false){if(selected>=project.rooms.length)selected=project.rooms.length-1;if(r().split==='none')zone=0;props();if(fit)fitView();results=regions(r()).map((rect,i)=>layout(rect,r().materials[i]));draw();stats();}
function draw(){
 const q=r(),rects=regions(q),f=view.w/Math.max($('stage').clientWidth,1),text=11*f,dim=27*f;
 const pts=p=>p.map(a=>a.join(',')).join(' ');
 let svg=`<defs><pattern id="dotGrid" width="200" height="200" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="${.6*f}" fill="#000" opacity=".16"/></pattern><pattern id="cutHatch" width="${7*f}" height="${7*f}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${7*f}" stroke="#111" stroke-width="${.65*f}" opacity=".35"/></pattern><clipPath id="roomClip"><path d="${roomPath(q)}" clip-rule="evenodd"/></clipPath>${rects.map((a,i)=>`<clipPath id="regionClip${i}"><rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}"/></clipPath>`).join('')}</defs>`;
 if(showGrid)svg+=`<rect x="${view.x}" y="${view.y}" width="${view.w}" height="${view.h}" fill="url(#dotGrid)"/>`;
 rects.forEach((rect,i)=>{
  svg+=`<g clip-path="url(#roomClip)"><g data-area="${i}" clip-path="url(#regionClip${i})"><rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="white"/>`;
  for(const p of results[i].pieces)svg+=`<polygon points="${pts(p.source??p.polygon)}" fill="${p.cut&&showCuts?'url(#cutHatch)':'white'}" stroke="#222" stroke-width=".65" vector-effect="non-scaling-stroke"/>`;
  svg+=`</g></g>`;
 });
 svg+=`<path d="${roomPath(q)}" fill="none" stroke="#111" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
 q.holes.forEach((h,i)=>{svg+=`<g><rect x="${h.x}" y="${h.y}" width="${h.w}" height="${h.h}" fill="white" stroke="#111" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="M${h.x} ${h.y}l${h.w} ${h.h}M${h.x+h.w} ${h.y}l${-h.w} ${h.h}" stroke="#111" stroke-width=".7" vector-effect="non-scaling-stroke"/><text x="${h.x+h.w/2}" y="${h.y+h.h/2-7*f}" text-anchor="middle" font-size="${text}" font-family="monospace">P${i+1}</text></g>`;});
 if(q.split!=='none'){
  svg+=`<g clip-path="url(#roomClip)">`;
  svg+=q.split==='vertical'?`<path d="M${q.at} 0V${q.h}"`:`<path d="M0 ${q.at}H${q.w}"`;
  svg+=` stroke="black" stroke-width="2" stroke-dasharray="7 5" vector-effect="non-scaling-stroke"/>`;
  const z=rects[zone];svg+=`<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" fill="none" stroke="black" stroke-width="2" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>`;
  svg+=`</g>`;
  rects.forEach((a,i)=>{let cx=a.x+a.w/2,cy=a.y+a.h/2;if(!inRoom(q,[cx,cy])&&a.cells?.length){const cell=a.cells.reduce((best,c)=>c.length>best.length?c:best,a.cells[0]);cx=cell.reduce((sum,p)=>sum+p[0],0)/cell.length;cy=cell.reduce((sum,p)=>sum+p[1],0)/cell.length;}if(a.surfaceArea===0)return;svg+=`<g data-area="${i}" style="cursor:pointer"><rect x="${cx-43*f}" y="${cy-14*f}" width="${86*f}" height="${28*f}" fill="${zone===i?'#111':'white'}" stroke="#111" stroke-width="1" vector-effect="non-scaling-stroke"/><text x="${cx}" y="${cy+4*f}" text-anchor="middle" font-family="monospace" font-size="${text}" fill="${zone===i?'white':'black'}">AREA 0${i+1}</text></g>`;});
 }
 if(tool==='edit')q.outline.forEach((p,i)=>{svg+=`<g data-vertex="${i}" class="vertex-handle"><circle cx="${p[0]}" cy="${p[1]}" r="${8*f}" fill="${i===vertex?'#111':'white'}" stroke="black" stroke-width="1.5" vector-effect="non-scaling-stroke"/><text x="${p[0]}" y="${p[1]+3*f}" text-anchor="middle" font-size="${9*f}" font-family="monospace" fill="${i===vertex?'white':'black'}">${i+1}</text></g>`;});
 const tick=6*f;
 svg+=`<g fill="none" stroke="#333" stroke-width=".75" vector-effect="non-scaling-stroke"><path vector-effect="non-scaling-stroke" d="M0 ${-dim-10*f}V${-8*f} M${q.w} ${-dim-10*f}V${-8*f} M0 ${-dim}H${q.w} M${-tick} ${-dim+tick}L${tick} ${-dim-tick} M${q.w-tick} ${-dim+tick}L${q.w+tick} ${-dim-tick} M${-dim-10*f} 0H${-8*f} M${-dim-10*f} ${q.h}H${-8*f} M${-dim} 0V${q.h} M${-dim-tick} ${tick}L${-dim+tick} ${-tick} M${-dim-tick} ${q.h+tick}L${-dim+tick} ${q.h-tick}"/></g>`;
 svg+=`<g font-family="monospace" font-size="${text}" fill="#333" text-anchor="middle"><text x="${q.w/2}" y="${-dim-10*f}">${q.w.toLocaleString('en-US')} mm</text><text transform="translate(${-dim-10*f} ${q.h/2}) rotate(-90)">${q.h.toLocaleString('en-US')} mm</text><text x="${q.w/2}" y="${q.h+38*f}">${esc(q.name.toUpperCase())} · ${(roomArea(q)/1e6).toFixed(2)} m²</text></g>`;
 $('drawing').setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);$('drawing').innerHTML=svg;$('zoomValue').textContent=Math.round(baseWidth/view.w*100)+'%';
}
function stats(){const total=key=>results.reduce((s,a)=>s+a[key],0);$('area').textContent=total('area').toFixed(2)+' m²';$('full').textContent=total('full');$('cut').textContent=total('cut');$('offcut').textContent=total('offcut').toFixed(2)+' m²';const a=results[zone];$('recommended').textContent=a.recommended;$('boxes').textContent=a.boxes+' / '+a.buy+' pcs';$('cost').textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'BRL'}).format(a.cost);}
$('rooms').onclick=e=>{const el=e.target.closest('[data-room]');if(el){selected=+el.dataset.room;zone=0;render(true);}};
$('areaTabs').onclick=e=>{const el=e.target.closest('[data-zone]');if(el){zone=+el.dataset.zone;render();}};
$('roomName').onchange=()=>change(()=>r().name=$('roomName').value.trim()||'Untitled room');
for(const [id,key]of [['roomW','w'],['roomH','h']])$(id).onchange=()=>change(()=>{const q=r(),value=+$(id).value,scale=value/q[key],axis=key==='w'?0:1;q.outline=q.outline.map(p=>p.map((v,i)=>i===axis?v*scale:v));q.holes.forEach(h=>{h[axis===0?'x':'y']*=scale;h[axis===0?'w':'h']*=scale;});q[key]=value;const max=(r().split==='vertical'?r().w:r().h)-200;r().at=Math.min(r().at,max);},true);
$('split').onchange=()=>change(()=>{r().split=$('split').value;r().at=Math.round((r().split==='vertical'?r().w:r().h)/2);zone=0;});
$('splitAt').onchange=()=>change(()=>r().at=+$('splitAt').value);
for(const [id,key]of Object.entries({tileW:'w',tileH:'h',joint:'joint',angle:'angle',ox:'ox',oy:'oy',reserve:'reserve',box:'box',price:'price'}))$(id).onchange=()=>change(()=>{m()[key]=Number($(id).value);if(key==='w'||key==='h')m().preset='custom';if(m().pattern==='basket'&&['w','joint'].includes(key))m().h=compatibleLength(m());if(m().pattern==='hexagon'&&key==='w')m().h=m().w;});
$('pattern').onchange=()=>choosePattern($('pattern').value);
$('preset').onchange=()=>change(()=>{const val=$('preset').value;m().preset=val;const presets={square:[600,600,'straight'],large:[600,1200,'straight'],wood:[180,1200,'staggered'],small:[200,200,'straight']};if(presets[val]){[m().w,m().h]=presets[val];}});
$('add').onclick=()=>change(()=>{project.rooms.push(room('Room '+(project.rooms.length+1)));selected=project.rooms.length-1;zone=0;},true);
$('delete').onclick=()=>{if(project.rooms.length>1)change(()=>{project.rooms.splice(selected,1);selected=Math.max(0,selected-1);zone=0;},true);};
function undo(redo=false){const src=redo?future:history,dst=redo?history:future;if(!src.length)return;dst.push(clone(project));project=src.pop();selected=Math.min(selected,project.rooms.length-1);zone=0;persist();render(true);}
$('undo').onclick=()=>undo();$('redo').onclick=()=>undo(true);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();undo(e.shiftKey);}});
$('grid').onclick=()=>{showGrid=!showGrid;$('grid').setAttribute('aria-pressed',showGrid);draw();};$('cuts').onclick=()=>{showCuts=!showCuts;$('cuts').setAttribute('aria-pressed',showCuts);draw();};$('fit').onclick=()=>{fitView();draw();};
function zoom(factor,x=.5,y=.5){const newW=Math.max(baseWidth*.2,Math.min(baseWidth*4,view.w*factor)),ratio=newW/view.w;view.x+=view.w*x*(1-ratio);view.y+=view.h*y*(1-ratio);view.w*=ratio;view.h*=ratio;draw();}
$('plus').onclick=()=>zoom(.8);$('minus').onclick=()=>zoom(1.25);
$('drawing').addEventListener('wheel',e=>{e.preventDefault();if(drag)return;const b=$('drawing').getBoundingClientRect();zoom(e.deltaY>0?1.1:1/1.1,(e.clientX-b.left)/b.width,(e.clientY-b.top)/b.height);},{passive:false});
function setTool(next){finishDrag();tool=next;for(const [id,name]of [['panTool','pan'],['moveTool','move'],['vertexTool','edit']])$(id).setAttribute('aria-pressed',next===name);$('drawing').classList.toggle('move-layout',next==='move');$('drawing').classList.toggle('edit-shape',next==='edit');$('toolHint').textContent=next==='edit'?'Drag numbered vertices · Esc cancels':next==='move'?'Drag a pattern. The room stays fixed.':'Drag to move the view.';geometryProps();draw();}
$('panTool').onclick=()=>setTool('pan');$('moveTool').onclick=()=>setTool('move');$('vertexTool').onclick=$('editShape').onclick=()=>setTool('edit');
$('roomShape').onchange=()=>{const shape=$('roomShape').value;change(()=>{const q=r();q.shape=shape;if(shape==='rectangle')q.outline=rectangle(0,0,q.w,q.h);if(shape==='lshape')q.outline=[[0,0],[q.w*.6,0],[q.w*.6,q.h*.4],[q.w,q.h*.4],[q.w,q.h],[0,q.h]];vertex=0;},true);if(shape==='custom')setTool('edit');};
$('vertexSelect').onchange=()=>{vertex=+$('vertexSelect').value;geometryProps();draw();};
for(const [id,axis]of [['vertexX',0],['vertexY',1]])$(id).onchange=()=>change(()=>{r().outline[vertex][axis]=+$(id).value;r().shape='custom';});
$('addVertex').onclick=()=>change(()=>{const p=r().outline,a=p[vertex],b=p[(vertex+1)%p.length];p.splice(vertex+1,0,[(a[0]+b[0])/2,(a[1]+b[1])/2]);vertex++;r().shape='custom';});
$('removeVertex').onclick=()=>change(()=>{r().outline.splice(vertex,1);vertex=Math.min(vertex,r().outline.length-1);r().shape='custom';});
$('pillarSelect').onchange=()=>{pillar=+$('pillarSelect').value;geometryProps();};
$('addPillar').onclick=()=>{
 const q=r(),size=Math.min(400,q.w/5,q.h/5);let candidate=null;
 for(const fy of [.5,.25,.75,.1,.9])for(const fx of [.5,.25,.75,.1,.9]){if(candidate)continue;const h={x:Math.round(q.w*fx-size/2),y:Math.round(q.h*fy-size/2),w:size,h:size};try{validateRoom({...q,holes:[...q.holes,h]});candidate=h;}catch{}}
 if(!candidate){status('No clear space for a new pillar. Adjust the outline or existing pillars.');return;}
 change(()=>{q.holes.push(candidate);pillar=q.holes.length-1;});$('pillarSection').open=true;
};
for(const [id,key]of [['pillarX','x'],['pillarY','y'],['pillarW','w'],['pillarH','h']])$(id).onchange=()=>change(()=>r().holes[pillar][key]=+$(id).value);
$('removePillar').onclick=()=>change(()=>{r().holes.splice(pillar,1);pillar=Math.max(0,pillar-1);});
function hitArea(e){
 const b=$('drawing').getBoundingClientRect(),x=view.x+(e.clientX-b.left)*view.w/b.width,y=view.y+(e.clientY-b.top)*view.h/b.height;
 if(!inRoom(r(),[x,y]))return -1;
 return regions(r()).findIndex(a=>x>=a.x&&x<=a.x+a.w&&y>=a.y&&y<=a.y+a.h);
}
$('drawing').onpointerdown=e=>{
 if(e.button!==0||drag)return;
 const handle=e.target.closest('[data-vertex]'),editing=tool==='edit'&&!!handle;
 if(tool==='edit'&&!editing){status('Drag a numbered vertex, or use Pan view.');return;}
 if(editing){vertex=+handle.dataset.vertex;geometryProps();}
 const area=hitArea(e),moving=tool==='move'&&area>=0;
 if(tool==='move'&&area<0){status('Drag inside an area to move its layout. Use Pan view to move the drawing.');return;}
 if(moving){zone=area;render();}
 drag={x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,vx:view.x,vy:view.y,sx:view.w/$('drawing').clientWidth,sy:view.h/$('drawing').clientHeight,moved:false,area,moving,editing,point:editing?[...r().outline[vertex]]:null,old:clone(project),ox:m().ox,oy:m().oy};
 $('drawing').setPointerCapture(e.pointerId);$('drawing').classList.add('dragging');
};
function flushDrag(){
 if(dragFrame!==null){cancelAnimationFrame(dragFrame);dragFrame=null;}
 if(!drag)return;
 const dx=drag.px-drag.x,dy=drag.py-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;
 if(!drag.moved)return;
 if(drag.editing){
  const step=$('snapVertices').checked?50:1,previous=clone(project),q=r();
  q.outline[vertex]=[Math.max(0,Math.min(q.w,Math.round((drag.point[0]+dx*drag.sx)/step)*step)),Math.max(0,Math.min(q.h,Math.round((drag.point[1]+dy*drag.sy)/step)*step))];q.shape='custom';
  try{validate(project);render();status('Editing room · release to save · Esc to cancel');}catch(e){project=previous;status(e.message);}return;
 }
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
 if(cancel){if(d.moving||d.editing)project=d.old;else{view.x=d.vx;view.y=d.vy;}render();status('Drag cancelled.');return;}
 if(d.editing&&d.moved&&JSON.stringify(project)!==JSON.stringify(d.old)){history.push(d.old);if(history.length>50)history.shift();future=[];persist();render();}
 else if(d.moving&&d.moved&&(m().ox!==d.ox||m().oy!==d.oy)){history.push(d.old);if(history.length>50)history.shift();future=[];persist();render();}
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
let previewSequence=0;
function miniPlan(rect,mat){
 const a=layout(rect,mat),points=p=>p.map(v=>v.join(',')).join(' '),pad=Math.max(rect.w,rect.h)*.03,id='preview'+(++previewSequence),path=rect.roomPath??pathOf(rectangle(rect.x,rect.y,rect.w,rect.h));
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${rect.x-pad} ${rect.y-pad} ${rect.w+pad*2} ${rect.h+pad*2}" role="img" aria-label="Layout comparison"><defs><clipPath id="${id}"><path d="${path}" clip-rule="evenodd"/></clipPath><clipPath id="${id}box"><rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}"/></clipPath></defs><g clip-path="url(#${id}box)"><g clip-path="url(#${id})"><rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="white"/>${a.pieces.map(p=>`<polygon points="${points(p.source??p.polygon)}" fill="${p.cut?'#e5e5e5':'white'}" stroke="black" stroke-width=".6" vector-effect="non-scaling-stroke"/>`).join('')}</g><path d="${path}" fill="none" stroke="black" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g></svg>`;
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
$('export').onclick=()=>{const old={...view},grid=showGrid,oldTool=tool;fitView();showGrid=false;tool='pan';draw();const svg=$('drawing').cloneNode(true);svg.setAttribute('width','1400');svg.setAttribute('height',String(Math.round(1400*view.h/view.w)));const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=r().name+' — conceptual floor layout, dimensions in mm';svg.prepend(title);download('floorplan-lab-drawing.svg','image/svg+xml',new XMLSerializer().serializeToString(svg));view=old;showGrid=grid;tool=oldTool;draw();status('Vector drawing exported. Purchase estimate stays in the project.');};
$('help').onclick=()=>$('guide').showModal();$('closeGuide').onclick=$('startGuide').onclick=()=>$('guide').close();
new ResizeObserver(()=>{fitView();if(results.length)draw();}).observe($('stage'));
render(true);
