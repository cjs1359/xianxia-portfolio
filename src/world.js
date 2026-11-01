import * as THREE from 'three';
import { Timer } from 'three';
import { building, islandTerrain, accents, bake, seedOf } from './scenery.js';
import { atmosphere, waterfall, inkComposer, runeHalo } from './ink.js';
import { createVehicle } from './vehicles.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
const OV={s:2.1,fov:16,rx:50,rz:40,dx:0,dy:.8,grid:1,gx:31,gz:26,off:4,fog:.0009,norm:1.25};
export function createWorld(data, actions) {
  const host = document.querySelector('#scene');
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
  renderer.setClearColor('#F4EFE3'); host.append(renderer.domElement);
  const labels = new CSS2DRenderer(); labels.domElement.style.cssText = 'position:absolute;inset:0;pointer-events:none'; host.append(labels.domElement);
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2('#F4EFE3', .0025);
  // A procedural dawn sky keeps both render paths equally bright.
  const skyCanvas=document.createElement('canvas');skyCanvas.width=2;skyCanvas.height=256;
  const skyContext=skyCanvas.getContext('2d'), dawn=skyContext.createLinearGradient(0,0,0,256);
  dawn.addColorStop(0,'#F9E7B9');dawn.addColorStop(.5,'#FFF9E9');dawn.addColorStop(1,'#F4EFE3');
  skyContext.fillStyle=dawn;skyContext.fillRect(0,0,2,256);
  const skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.colorSpace=THREE.SRGBColorSpace;scene.background=skyTexture;
  const camera = new THREE.PerspectiveCamera(43,1,.1,500);
  const controls = new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.maxPolarAngle=Math.PI*.46; controls.minDistance=12; controls.maxDistance=230; controls.enablePan=false;
  scene.add(new THREE.HemisphereLight('#fff8e6','#b3c9ac',3.1)); const sun=new THREE.DirectionalLight('#fff0ce',3.2);sun.position.set(-20,40,20);scene.add(sun);
  const islands=new Map(), targets=[], workLabels=[]; let hovered=null, current=null, active=true, flight=null, disposed=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const air=atmosphere(scene), halos=[];
  let lowQuality=innerWidth<768, composer=null, slowTime=0, sampleTime=0;
  function quality(){
    const simple=lowQuality||innerWidth<768||reduced.matches;
    document.body.classList.toggle('ink-simple',simple);
    if(simple&&composer){composer.dispose();composer=null;}
    if(!simple&&!composer){try{composer=inkComposer(renderer,scene,camera);}catch(error){console.warn('水墨後處理無法啟用，使用簡化效果',error);lowQuality=true;document.body.classList.add('ink-simple');}}
  }
  quality();
  function label(text,position,cls,fn){const b=document.createElement('button');b.className=`label ${cls}`;b.textContent=text;b.onclick=e=>{e.stopPropagation();fn(b)};const o=new CSS2DObject(b);o.position.copy(position);return o;}
  data.islands.forEach((island,i)=>{
    const angle=i/6*Math.PI*2;const g=new THREE.Group();if(OV.grid)g.position.set(((i%3)-1)*OV.gx+(i<3?-OV.off:OV.off),Math.sin(i*2)*1.5,(i<3?-1:1)*OV.gz);else g.position.set(Math.cos(angle)*OV.rx,Math.sin(i*2)*1.5,Math.sin(angle)*OV.rz);scene.add(g);
    const radius=island.works.length>8?7:5.5;
    const terrain=islandTerrain(radius,i);accents(terrain.group,island.id,radius);
    const land=bake(terrain.group);terrain.transient.forEach(g=>g.dispose());g.add(land);land.userData.island=island;targets.push(land);
    waterfall(g,radius,air,island.id==='qingshi');
    if(['xuanji','tashan'].includes(island.id))halos.push(runeHalo(g,island.id==='xuanji'?radius*.9:2));
    island.works.forEach((work,j)=>{
      const a=j/island.works.length*Math.PI*2; const r=island.works.length===1?0:radius*.67;
      const b=building(work.buildingType,island.accent,seedOf(work.id||work.buildingName));b.position.set(Math.cos(a)*r,.5,Math.sin(a)*r);b.scale.setScalar(island.works.length>8?.68:.95);g.add(b);
      b.traverse(m=>{if(m.isMesh){m.userData.work=work;m.userData.island=island;targets.push(m)}});
      const l=label(work.buildingName,new THREE.Vector3(b.position.x,3.7,b.position.z),'work-label',trigger=>{if(current===island&&actions.getState()==='island')actions.openWork(island,work,trigger)});l.visible=false;g.add(l);workLabels.push({label:l,island,name:work.buildingName,building:b});
    });
    const l=label(`${island.name} · ${island.works.length}卷`,new THREE.Vector3(0,5.2,0),'island-label',b=>actions.enter(island,b));g.add(l);const bounds=new THREE.Box3().setFromObject(land);
    const focusBounds=bounds.clone();
    g.children.filter(child=>child.isCSS2DObject||child.children.length).forEach(child=>bounds.expandByPoint(child.getWorldPosition(new THREE.Vector3())));
    bounds.expandByPoint(g.localToWorld(new THREE.Vector3(-radius,-radius, -radius)));
    bounds.expandByPoint(g.localToWorld(new THREE.Vector3(radius,6,radius)));
    islands.set(island.id,{g,radius,label:l,bounds,focusBounds,desktopPosition:g.position.clone()});
  });
  function layoutIslands(){
    const mobile=innerWidth<768,up=new THREE.Vector3(0,1,-.65).normalize();
    [...islands.values()].forEach((entry,i)=>{
      const position=mobile?up.clone().multiplyScalar((1-Math.floor(i/2))*19).add(new THREE.Vector3(i%2?9:-9,0,0)):entry.desktopPosition;
      const delta=position.clone().sub(entry.g.position);
      entry.g.position.copy(position);entry.bounds.translate(delta);entry.focusBounds.translate(delta);
    });
    workLabels.forEach(({label,name})=>{
      label.element.textContent=mobile&&name.length>8?name.slice(0,7)+'…':name;
      label.element.title=name;label.element.setAttribute('aria-label',name);
    });
    // Remove desktop-only width constraints when crossing back to mobile.
    if(mobile)[...workLabels.map(x=>x.label),...[...islands.values()].map(x=>x.label)].forEach(l=>{
      l.element.style.maxWidth='';l.element.style.overflow='';l.element.style.textOverflow='';
    });
    scene.updateMatrixWorld(true);
  }
  // Leader-line callouts for desktop/tablet close-ups: labels sit in columns
  // outside the projected island silhouette and point back at their building.
  const leaderSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');leaderSvg.setAttribute('class','leader-lines');leaderSvg.setAttribute('aria-hidden','true');document.body.appendChild(leaderSvg);
  function buildingRect(b){const r=projectRect(corners(new THREE.Box3().setFromObject(b)),camera);return {x0:r.x,y0:r.y,x1:r.r,y1:r.b};}
  function arrangeCallouts(){
    const list=workLabels.filter(x=>x.island===current&&x.label.visible);if(!list.length){leaderSvg.innerHTML='';return;}
    const q=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r&&r.width?r:null};
    const gap=10,W=innerWidth,H=innerHeight,top=safeRect().top+gap,obs=[q('#island-nav'),q('.bottom')].filter(Boolean);
    const items=list.map(x=>{const r=buildingRect(x.building);return {x,r,ax:(r.x0+r.x1)/2,ay:r.y0+(r.y1-r.y0)*.35};});
    const ir=projectRect(islandBox(current),camera),isl={x0:ir.x,x1:ir.r};items.forEach(({r})=>{isl.x0=Math.min(isl.x0,r.x0);isl.x1=Math.max(isl.x1,r.x1);});
    const cx=(isl.x0+isl.x1)/2,sides=[{x0:gap,x1:isl.x0-gap*2,right:false},{x0:isl.x1+gap*2,x1:W-gap,right:true}];
    sides.forEach(s=>s.w=s.x1-s.x0);
    items.forEach(it=>{let s=it.ax<cx?0:1;if(sides[s].w<110)s=1-s;it.side=s;});
    let svg='';
    sides.forEach((s,si)=>{const col=items.filter(i=>i.side===si).sort((a,b)=>a.ay-b.ay);if(!col.length)return;
      const lower=Math.min(H-gap,...obs.filter(o=>o.left<s.x1&&o.right>s.x0).map(o=>o.top-gap));
      col.forEach(({x})=>{const e=x.label.element;e.style.maxWidth=`${Math.max(80,s.w)}px`;e.style.overflow='hidden';e.style.textOverflow='ellipsis';e.style.whiteSpace='nowrap';});
      const hs=col.map(({x})=>x.label.element.offsetHeight),total=hs.reduce((a,b)=>a+b,0),g2=Math.max(2,Math.min(gap,(lower-top-total)/Math.max(1,col.length-1)));
      let edge=top;const ys=col.map((it,i)=>{const y=Math.max(edge+hs[i]/2,Math.min(lower-hs[i]/2,it.ay));edge=y+hs[i]/2+g2;return y;});
      let below=lower;for(let i=col.length-1;i>=0;i--){ys[i]=Math.min(ys[i],below-hs[i]/2);below=ys[i]-hs[i]/2-g2;}
      col.forEach((it,i)=>{const e=it.x.label.element,w=e.offsetWidth,x=s.right?s.x0+w/2:s.x1-w/2;
        e.style.transform=`translate(-50%,-50%) translate(${x}px,${ys[i]}px)`;
        const lx=s.right?x-w/2:x+w/2;
        svg+=`<path d="M${lx.toFixed(1)} ${ys[i].toFixed(1)} L${it.ax.toFixed(1)} ${it.ay.toFixed(1)}" class="leader"/><circle cx="${it.ax.toFixed(1)}" cy="${it.ay.toFixed(1)}" r="3" class="leader-dot"/>`;});
    });
    leaderSvg.innerHTML=svg;
  }
  window.__buildingRects=()=>current?workLabels.filter(x=>x.island===current).map(x=>{const r=buildingRect(x.building);return {name:x.name,x:r.x0,y:r.y0,r:r.x1,b:r.y1};}):[];
  window.__leaderLines=()=>leaderSvg.querySelectorAll('path.leader').length;
  function arrangeDesktopLabels(){
    if(innerWidth<768||flight||!current)leaderSvg.innerHTML='';
    if(innerWidth<768||flight)return;
    if(current){arrangeCallouts();return;}
    const entries=current?workLabels.filter(x=>x.island===current).map(x=>x.label):[...islands.values()].map(x=>x.label);
    const rect=selector=>document.querySelector(selector).getBoundingClientRect();
    const header=rect('header'),intro=rect('.intro'),nav=rect('#island-nav'),bottom=rect('.bottom');
    const gap=8;
    // A conservative clear rectangle also excludes the brand and mode controls
    // inside the header, and the intro only while it is displayed in overview.
    const left=!current&&intro.width?intro.right+gap:gap,right=innerWidth-gap;
    const top=Math.max(gap,header.bottom+gap,rect('.brand').bottom+gap,rect('#mode').bottom+gap);
    const lower=Math.min(innerHeight-gap,nav.top-gap,bottom.top-gap);
    const projected=entries.filter(l=>l.visible).map(l=>({l,p:l.getWorldPosition(new THREE.Vector3()).project(camera)})).sort((a,b)=>a.p.x-b.p.x);
    if(!projected.length)return;
    const count=Math.min(projected.length,2);
    const columnWidth=(right-left-gap*(count-1))/count;
    for(let index=0;index<count;index++){
      const column=projected.slice(Math.floor(index*projected.length/count),Math.floor((index+1)*projected.length/count)).sort((a,b)=>b.p.y-a.p.y);
      const minX=left+index*(columnWidth+gap),maxX=minX+columnWidth;
      column.forEach(({l})=>{
        l.element.style.maxWidth=`${columnWidth}px`;
        l.element.style.overflow='hidden';l.element.style.textOverflow='ellipsis';
        if(!l.element.title)l.element.title=l.element.textContent;
      });
      const heights=column.map(({l})=>l.element.offsetHeight);
      let edge=top;
      const positions=column.map(({p},i)=>{
        const y=Math.max(edge+heights[i]/2,Math.min(lower-heights[i]/2,(1-p.y)*innerHeight/2));
        edge=y+heights[i]/2+gap;return y;
      });
      let edgeBelow=lower;
      for(let i=column.length-1;i>=0;i--){positions[i]=Math.min(positions[i],edgeBelow-heights[i]/2);edgeBelow=positions[i]-heights[i]/2-gap;}
      column.forEach(({l,p},i)=>{
        const width=l.element.offsetWidth;
        const x=Math.max(minX+width/2,Math.min(maxX-width/2,(p.x+1)*innerWidth/2));
        l.element.style.transform=`translate(-50%,-50%) translate(${x}px,${positions[i]}px)`;
      });
    }
  }
  // Pack screen-space labels into two independent columns after CSS2D projection.
  // Recomputed after orbiting, so every work remains reachable on either side.
  function arrangeMobileLabels(){
    if(innerWidth>=768||flight)return;
    const entries=current?workLabels.filter(x=>x.island===current).map(x=>x.label):[...islands.values()].map(x=>x.label);
    const top=current?Math.max(110,document.querySelector('header').getBoundingClientRect().bottom+8):170;
    const bottom=Math.min(640,document.querySelector('#island-nav').getBoundingClientRect().top-10);
    const projected=entries.filter(l=>l.visible).map(l=>({l,p:l.getWorldPosition(new THREE.Vector3()).project(camera)})).sort((a,b)=>a.p.x-b.p.x);
    const split=Math.ceil(projected.length/2);
    [projected.slice(0,split),projected.slice(split)].forEach((column,index)=>{
      column.sort((a,b)=>b.p.y-a.p.y);
      const heights=column.map(({l})=>l.element.offsetHeight),gap=5;
      const total=heights.reduce((a,b)=>a+b,0)+Math.max(0,column.length-1)*gap;
      let edge=top;
      const positions=column.map(({p},i)=>{
        const y=Math.max(edge+heights[i]/2,Math.min(bottom-heights[i]/2,(1-p.y)*innerHeight/2));
        edge=y+heights[i]/2+gap;return y;
      });
      let lower=bottom;
      for(let i=column.length-1;i>=0;i--){positions[i]=Math.min(positions[i],lower-heights[i]/2);lower=positions[i]-heights[i]/2-gap;}
      column.forEach(({l,p},i)=>{
        const width=l.element.offsetWidth;
        const minX=index===0?6:innerWidth/2+3,maxX=index===0?innerWidth/2-3:innerWidth-6;
        const x=Math.max(minX+width/2,Math.min(maxX-width/2,(p.x+1)*innerWidth/2));
        const y=total<=bottom-top?positions[i]:top+(i+.5)*(bottom-top)/column.length;
        l.element.style.transform=`translate(-50%,-50%) translate(${x}px,${y}px)`;
      });
    });
  }
  // Shift the optical centre into the unobstructed area. CSS labels use the
  // same projection as the scene, so their pixel margins belong in this fit.
  function framing(isOverview) {
    const w=innerWidth,h=innerHeight,mobile=w<768;
    const header=document.querySelector('header').getBoundingClientRect();
    const nav=document.querySelector('#island-nav').getBoundingClientRect();
    const bottom=document.querySelector('.bottom').getBoundingClientRect();
    const intro=document.querySelector('.intro').getBoundingClientRect();
    const left=isOverview&&!mobile?intro.right+24:12;
    const top=Math.max(header.bottom+12,isOverview&&mobile?170:0);
    const right=w-12, lower=Math.min(nav.top,bottom.top)-12;
    const width=Math.max(80,right-left),height=Math.max(80,lower-top);
    camera.clearViewOffset();camera.aspect=w/h;
    camera.setViewOffset(w,h,w/2-(left+width/2),h/2-(top+height/2),w,h);
    const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    return {tanH:tanV*width/h,tanV:tanV*height/h,width,height};
  }
  function fittedPosition(target,direction,points,isOverview) {
    const {tanH,tanV,width,height}=framing(isOverview);
    const forward=direction.clone().normalize();
    const right=new THREE.Vector3().crossVectors(camera.up,forward).normalize();
    const up=new THREE.Vector3().crossVectors(forward,right);
    let distance=12;
    for(const point of points){
      const p=point.clone().sub(target),z=p.dot(forward);
      const padX=point.labelWidth?point.labelWidth/2+8:8;
      const padY=point.labelWidth?30:8;
      distance=Math.max(distance,z+Math.abs(p.dot(right))/(tanH*Math.max(.1,1-2*padX/width)),z+Math.abs(p.dot(up))/(tanV*Math.max(.1,1-2*padY/height)));

    }
    controls.maxDistance=Math.max(230,distance*2);
    camera.far=Math.max(500,distance*3);camera.updateProjectionMatrix();
    return target.clone().addScaledVector(forward,distance*1.04);
  }
  function corners(bounds){
    const points=[];
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new THREE.Vector3(x,y,z));
    return points;
  }
  function labelPoint(label){
    const point=label.getWorldPosition(new THREE.Vector3());
    // Hidden CSS2D elements have no measurable width until their first render.
    point.labelWidth=Math.max(label.element.scrollWidth,label.element.textContent.length*(innerWidth<768?12:14)+28);
    return point;
  }
  function safeRect(){const q=x=>document.querySelector(x)?.getBoundingClientRect();const gap=8;
    const tops=['header','.brand','#mode'].map(q).filter(r=>r&&r.width).map(r=>r.bottom+gap);
    const lows=['#island-nav','.bottom'].map(q).filter(r=>r&&r.width&&r.top>innerHeight*.4).map(r=>r.top-gap);
    return {left:gap,right:innerWidth-gap,top:Math.max(gap,...tops),bottom:Math.min(innerHeight-gap,...lows)};}
  function islandBox(island){const g=islands.get(island.id).g;g.updateMatrixWorld(true);const pts=[];
    const shown=o=>{for(let x=o;x;x=x.parent){if(!x.visible)return false;if(x===g)return true;}return true;};
    g.traverse(o=>{if(!o.isMesh||!o.geometry||!shown(o))return;const m=[].concat(o.material);if(m.every(x=>!x||x.visible===false||x.colorWrite===false||(x.transparent&&x.opacity<.05)))return;
      const pos=o.geometry.attributes.position;if(!pos)return;const step=Math.max(1,Math.floor(pos.count/1500));for(let k=0;k<pos.count;k+=step)pts.push(new THREE.Vector3().fromBufferAttribute(pos,k).applyMatrix4(o.matrixWorld));});return pts;}
  function projectRect(pts,cam){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;pts.forEach(q=>{const p=q.clone().project(cam);const x=(p.x+1)/2*innerWidth,y=(1-p.y)/2*innerHeight;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);});return {x:x0,y:y0,r:x1,b:y1};}
  function uiRects(){const q=x=>{const r=document.querySelector(x)?.getBoundingClientRect();return r&&r.width?r:null};return {header:safeRect().top,nav:q('#island-nav'),bottom:q('.bottom')};}
  function tagged(island){const g=islands.get(island.id).g;g.updateMatrixWorld(true);const surf=g.getWorldPosition(new THREE.Vector3()).y+.15;
    return islandBox(island).map(p=>({p,hard:p.y>surf}));}
  // Desktop rule: every point stays below the header and inside the viewport; nothing touches the island-button block;
  // buildings/trees (points above the island surface) also stay above the bottom bar, while rocks/mist below the surface may pass under it.
  function desktopCheck(pts,cam){const ui=uiRects(),m=12,W=innerWidth,H=innerHeight;let hardOut=0,softOut=0,navHit=0,x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
    pts.forEach(({p,hard})=>{const v=p.clone().project(cam);const behind=v.z>1||v.z<-1;const x=(v.x+1)/2*W,y=(1-v.y)/2*H;if(behind){hard?hardOut++:softOut++;return;}x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      let bad=x<m||x>W-m||y<ui.header+m||y>H;
      if(ui.nav&&x>ui.nav.left-m&&x<ui.nav.right+m&&y>ui.nav.top-m&&y<ui.nav.bottom+m){bad=true;navHit++;}
      if(hard&&ui.bottom&&y>ui.bottom.top-m)bad=true;
      if(bad){hard?hardOut++:softOut++;}});
    return {hardOut,softOut,navHit,x:x0,r:x1,y:y0,b:y1,ok:hardOut===0&&softOut===0};}
  function fitInside(island,view){const cam=camera.clone(),dir=view.end.clone().sub(view.target),safe=safeRect();let d=dir.length();dir.normalize();
    const target=view.target.clone();
    if(innerWidth>=768){const pts=tagged(island),ui=uiRects(),right=new THREE.Vector3().crossVectors(camera.up,dir).normalize();
      const bandMid=(ui.header+(ui.bottom?ui.bottom.top:innerHeight))/2,base=d;
      const place=(t,dd)=>{cam.position.copy(t).addScaledVector(dir,dd);cam.lookAt(t);cam.updateMatrixWorld();cam.updateProjectionMatrix();return desktopCheck(pts,cam);};
      const centre=(t,dd,cx)=>{for(let k=0;k<4;k++){const c=place(t,dd);if(!isFinite(c.x))return;const wpp=2*Math.tan(THREE.MathUtils.degToRad(cam.fov/2))*dd/innerHeight;
        t.addScaledVector(right,((c.x+c.r)/2-cx)*wpp);t.y-=((c.y+c.b)/2-bandMid)*wpp;}};
      let best=null;
      for(const cx of [innerWidth*.5,innerWidth*.46,innerWidth*.42,innerWidth*.38]){const t=view.target.clone();let lo=base*.3,hi=base*2.5;
        for(let k=0;k<18;k++){const mid=(lo+hi)/2;centre(t,mid,cx);if(place(t,mid).ok)hi=mid;else lo=mid;}
        centre(t,hi,cx);let dd=hi;while(!place(t,dd).ok&&dd<base*4)dd*=1.02;
        if(!best||dd<best.d)best={t:t.clone(),d:dd};}
      return {target:best.t,end:best.t.clone().addScaledVector(dir,best.d)};}
    const box=islandBox(island);
    for(let i=0;i<60;i++){cam.position.copy(target).addScaledVector(dir,d);cam.lookAt(target);cam.updateMatrixWorld();cam.updateProjectionMatrix();
      const r=projectRect(box,cam);const m=16;const fits=r.x>=safe.left+m&&r.r<=safe.right-m&&r.y>=safe.top+m&&r.b<=safe.bottom-m;
      const mid=(safe.top+safe.bottom)/2,cy=(r.y+r.b)/2;
      if(Math.abs(cy-mid)>4&&i<20){const ndc=(cy-mid)/innerHeight*2;const worldPerNdc=Math.tan(THREE.MathUtils.degToRad(cam.fov/2))*d;target.y-=ndc*worldPerNdc*.8;continue;}
      if(fits)break;d*=1.05;}
    return {target,end:target.clone().addScaledVector(dir,d)};}
  window.__islandRect=()=>current?{...projectRect(islandBox(current),camera),safe:safeRect()}:null;
  window.__overviewRects=()=>[...islands.keys()].map(id=>({id,...projectRect(islandBox({id}),camera)}));
  window.__islandAnchor=id=>{const g=islands.get(id).g;g.updateMatrixWorld(true);const v=g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.5,0)).project(camera);return {x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight};};
  window.__islandIds=()=>[...islands.keys()];
  window.__islandCheck=()=>current&&innerWidth>=768?desktopCheck(tagged(current),camera):null;
  function islandView(island){return fitInside(island,islandViewRaw(island));}
  function islandViewRaw(island){
    const {bounds,g,radius}=islands.get(island.id),target=bounds.getCenter(new THREE.Vector3());
    if(innerWidth<768){
      framing(false);
      target.copy(g.position).add(new THREE.Vector3(0,1,0));
      // Fit the physical island to 90% of the viewport; labels are packed separately.
      const distance=radius/Math.sin(Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect*.9));
      return {target,end:target.clone().addScaledVector(new THREE.Vector3(0,1.8,2.6).normalize(),distance)};
    }
    // Frame only the physical island. Labels are packed independently below.
    const entry=islands.get(island.id);entry.g.updateMatrixWorld(true);const focusBounds=new THREE.Box3().setFromObject(entry.g);if(focusBounds.isEmpty())focusBounds.copy(entry.focusBounds);
    focusBounds.getCenter(target);
    camera.clearViewOffset();camera.aspect=innerWidth/innerHeight;
    const tanH=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect;
    const forward=new THREE.Vector3(0,1.8,2.6).normalize();
    const right=new THREE.Vector3().crossVectors(camera.up,forward).normalize();
    // Perspective depth is included so the projected box spans at most 62%.
    const distance=1.15*islands.get(island.id).radius/Math.sin(Math.atan(tanH*.62));
    controls.maxDistance=Math.max(230,distance*2);
    camera.far=Math.max(500,distance*3);camera.updateProjectionMatrix();
    return {target,end:target.clone().addScaledVector(forward,distance)};
  }
  function islandVisibility(){
    const rmax=Math.max(...[...islands.values()].map(x=>x.radius));islands.forEach(({g,radius},id)=>{g.visible=innerWidth<768||!current||id===current.id;g.scale.setScalar(innerWidth>=768&&!current?OV.s*Math.min(OV.norm,Math.pow(rmax/radius,.6)):1);g.updateMatrixWorld(true);});const f=innerWidth>=768&&!current?OV.fov:43;scene.fog.density=innerWidth>=768&&!current?OV.fog:.0025;if(camera.fov!==f){camera.fov=f;camera.updateProjectionMatrix();}
  }
  // Desktop/tablet overview: pull the camera in until island geometry would touch the header, intro panel, island buttons, bottom bar or screen edge.
  function overviewTighten(){const q=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r&&r.width?r:null};
    const obs=["header",".intro","#island-nav",".bottom"].map(q).filter(Boolean),m=6,W=innerWidth,H=innerHeight;
    const pts=[...islands.keys()].flatMap(id=>islandBox({id}).filter((p,k)=>k%7===0)),t=controls.target.clone(),dir=camera.position.clone().sub(t),base=dir.length();dir.normalize();
    const cam=camera.clone();const ok=dd=>{cam.position.copy(t).addScaledVector(dir,dd);cam.lookAt(t);cam.updateMatrixWorld();cam.updateProjectionMatrix();
      for(const p of pts){const v=p.clone().project(cam);if(v.z>1)return false;const x=(v.x+1)/2*W,y=(1-v.y)/2*H;if(x<m||x>W-m||y<m||y>H-m)return false;
        for(const o of obs)if(x>o.left-m&&x<o.right+m&&y>o.top-m&&y<o.bottom+m)return false;}return true;};
    const right=new THREE.Vector3().crossVectors(camera.up,dir).normalize(),up=new THREE.Vector3().crossVectors(dir,right).normalize(),t0=t.clone();
    let best={d:Infinity,t:t0.clone()};
    for(let ox=-.2;ox<=.201;ox+=.05)for(let oy=-.15;oy<=.151;oy+=.05){t.copy(t0).addScaledVector(right,ox*base).addScaledVector(up,oy*base);
      let lo=base*.3,hi=Math.min(best.d,base*1.3);if(!ok(hi))continue;for(let k=0;k<12;k++){const mid=(lo+hi)/2;if(ok(mid))hi=mid;else lo=mid;}
      if(hi<best.d)best={d:hi,t:t.clone()};}
    if(!isFinite(best.d))best={d:base,t:t0};
    controls.target.copy(best.t);camera.position.copy(best.t).addScaledVector(dir,best.d*1.03);}
  function overview(){current=null;hovered=null;islands.forEach(x=>x.label.element.classList.remove('show'));islandVisibility();controls.minDistance=12;controls.enabled=true;controls.target.set(0,0,0);
    if(innerWidth<768){
      const up=new THREE.Vector3(0,1,-.65).normalize();
      const points=[...islands.values()].flatMap(({g,radius})=>[-1,1].flatMap(x=>[-1,1].map(y=>g.position.clone().add(new THREE.Vector3(x*radius,0,0)).addScaledVector(up,y*7))));
      camera.position.copy(fittedPosition(controls.target,new THREE.Vector3(0,.65,1),points,true));
    }else camera.position.copy(fittedPosition(controls.target,new THREE.Vector3(OV.dx,OV.dy,1),[...islands.keys()].flatMap(id=>islandBox({id}).filter((p,k)=>k%4===0)),true));overviewTighten();
    workLabels.forEach(x=>x.label.visible=false);islands.forEach(x=>x.label.visible=true);controls.update();}
  function resize(){layoutIslands();islandVisibility();quality();const dpr=Math.min(devicePixelRatio,1.5);renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight);labels.setSize(innerWidth,innerHeight);composer?.resize(innerWidth,innerHeight,dpr);
    if(flight){framing(false);}else if(current){const {target,end}=islandView(current);camera.position.copy(end);controls.target.copy(target);controls.update();}else overview();}
  window.addEventListener('resize',resize);resize();
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
  renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
  // Overview: island name labels are hidden until the pointer hovers that island (mouse/pen only; touch taps zoom directly).

  const showLabel=id=>{if(hovered===id)return;hovered=id;islands.forEach((x,k)=>x.label.element.classList.toggle('show',k===id));};
  islands.forEach((x,id)=>{x.label.element.addEventListener('pointerenter',()=>{if(!current)showLabel(id)});x.label.element.addEventListener('pointerleave',e=>{if(!current&&e.relatedTarget!==renderer.domElement)showLabel(null)});});
  renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||current||actions.getState()!=='overview')return;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(targets).find(h=>h.object.parent&&h.object.parent.visible);const id=hit?hit.object.userData.island.id:null;showLabel(id);renderer.domElement.style.cursor=id?'pointer':'';});
  renderer.domElement.addEventListener('pointerleave',e=>{if(!current&&!(e.relatedTarget&&e.relatedTarget.classList?.contains('island-label')))showLabel(null)});
  window.__hoverIsland=id=>showLabel(id);
  renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>7||!['overview','island'].includes(actions.getState()))return;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(targets).find(h=>!current||h.object.userData.island===current);if(!hit)return;const {island,work}=hit.object.userData;if(current===island&&work)actions.openWork(island,work,renderer.domElement);else actions.enter(island);});renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','善域場景；亦可使用浮島選擇按鈕');
  function travel(island){controls.enabled=false;current=island;islandVisibility();workLabels.forEach(x=>x.label.visible=false);islands.forEach(x=>x.label.visible=false);const {target,end}=islandView(island);
    const finish=()=>{const view=islandView(island);camera.position.copy(view.end);controls.target.copy(view.target);controls.enabled=true;controls.minDistance=Math.min(7,camera.position.distanceTo(view.target)*.8);controls.update();workLabels.forEach(x=>x.label.visible=x.island===island);};
    if(reduced.matches){finish();return Promise.resolve();}
    const start=camera.position.clone();const mid=start.clone().lerp(end,.5);mid.y+=12;const path=new THREE.QuadraticBezierCurve3(start,mid,end);const craft=createVehicle(island.vehicle);scene.add(craft.group);
    return new Promise(resolve=>{flight={start:performance.now(),path,craft,target,oldTarget:controls.target.clone(),finish:()=>{scene.remove(craft.group);craft.dispose();finish();resolve();}};});
  }
  const timer=new Timer();
  let raf;
  function motionChanged(){resize();if(reduced.matches&&flight){const f=flight;flight=null;f.finish();}}
  reduced.addEventListener('change',motionChanged);
  function frame(now){
    if(disposed)return;raf=requestAnimationFrame(frame);
    if(!active||document.hidden){sampleTime=0;timer.update();return;}
    if(sampleTime){const elapsed=now-sampleTime;slowTime=elapsed>34?slowTime+elapsed:Math.max(0,slowTime-elapsed*2);if(slowTime>3000&&!lowQuality){lowQuality=true;resize();}}
    sampleTime=now;timer.update();const dt=Math.min(timer.getDelta(),.1);
    if(flight){const t=Math.min((now-flight.start)/3200,1),eased=t*t*(3-2*t);
      const point=flight.path.getPoint(eased),next=flight.path.getPoint(Math.min(eased+.03,1));
      const direction=next.clone().sub(point);if(direction.lengthSq()<.001)direction.set(0,0,-1);direction.normalize();
      flight.craft.group.position.copy(point);flight.craft.group.lookAt(point.clone().sub(direction));
      flight.craft.update(now/1000);
      camera.position.copy(point).addScaledVector(direction,-6).add(new THREE.Vector3(2,3,0));camera.lookAt(point);
      if(t===1){const f=flight;flight=null;f.finish();}
    }else controls.update();
    if(!reduced.matches){air.update(dt);halos.forEach(h=>h.rotation.z+=dt*.08);}
    if(composer)composer.render();else renderer.render(scene,camera);labels.render(scene,camera);arrangeMobileLabels();arrangeDesktopLabels();
  }
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;if(flight){const f=flight;flight=null;f.finish();}actions.fail();});raf=requestAnimationFrame(frame);
  return {travel,overview,setActive(value){active=value;sampleTime=0;},dispose(){
    if(disposed)return;disposed=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);reduced.removeEventListener('change',motionChanged);
    if(flight){const f=flight;flight=null;f.finish();}controls.dispose();composer?.dispose();
    const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}}});
    air.flows.forEach(t=>textures.add(t));textures.add(skyTexture);textures.add(air.glow);textures.add(air.mist);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();labels.domElement.remove();document.body.classList.remove('ink-simple');
  }};
}
