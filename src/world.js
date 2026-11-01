import * as THREE from 'three';
import { Timer } from 'three';
import { building, islandTerrain, accents, bake } from './scenery.js';
import { atmosphere, waterfall, inkComposer, runeHalo } from './ink.js';
import { createVehicle } from './vehicles.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
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
  const islands=new Map(), targets=[], workLabels=[]; let current=null, active=true, flight=null, disposed=false;
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
    const angle=i/6*Math.PI*2;const g=new THREE.Group();g.position.set(Math.cos(angle)*23,Math.sin(i*2)*1.5,Math.sin(angle)*23);scene.add(g);
    const radius=island.works.length>8?7:5.5;
    const terrain=islandTerrain(radius,i);accents(terrain.group,island.id,radius);
    const land=bake(terrain.group);terrain.transient.forEach(g=>g.dispose());g.add(land);land.userData.island=island;targets.push(land);
    waterfall(g,radius,air,island.id==='qingshi');
    if(['xuanji','tashan'].includes(island.id))halos.push(runeHalo(g,island.id==='xuanji'?radius*.9:2));
    island.works.forEach((work,j)=>{
      const a=j/island.works.length*Math.PI*2; const r=island.works.length===1?0:radius*.67;
      const b=building(work.buildingType,island.accent);b.position.set(Math.cos(a)*r,.5,Math.sin(a)*r);b.scale.setScalar(island.works.length>8?.68:.95);g.add(b);
      b.traverse(m=>{if(m.isMesh){m.userData.work=work;m.userData.island=island;targets.push(m)}});
      const l=label(work.buildingName,new THREE.Vector3(b.position.x,3.7,b.position.z),'work-label',trigger=>{if(current===island&&actions.getState()==='island')actions.openWork(island,work,trigger)});l.visible=false;g.add(l);workLabels.push({label:l,island,name:work.buildingName});
    });
    const l=label(`${island.name} · ${island.works.length}卷`,new THREE.Vector3(0,5.2,0),'island-label',b=>actions.enter(island,b));g.add(l);const bounds=new THREE.Box3().setFromObject(land);
    g.children.filter(child=>child.isCSS2DObject||child.children.length).forEach(child=>bounds.expandByPoint(child.getWorldPosition(new THREE.Vector3())));
    bounds.expandByPoint(g.localToWorld(new THREE.Vector3(-radius,-radius, -radius)));
    bounds.expandByPoint(g.localToWorld(new THREE.Vector3(radius,6,radius)));
    islands.set(island.id,{g,radius,label:l,bounds,desktopPosition:g.position.clone()});
  });
  function layoutIslands(){
    const mobile=innerWidth<768,up=new THREE.Vector3(0,1,-.65).normalize();
    [...islands.values()].forEach((entry,i)=>{
      const position=mobile?up.clone().multiplyScalar((1-Math.floor(i/2))*19).add(new THREE.Vector3(i%2?9:-9,0,0)):entry.desktopPosition;
      const delta=position.clone().sub(entry.g.position);
      entry.g.position.copy(position);entry.bounds.translate(delta);
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
  function arrangeDesktopLabels(){
    if(innerWidth<768||flight)return;
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
    const height=Math.max(...projected.map(({l})=>l.element.offsetHeight));
    const rows=Math.max(1,Math.floor((lower-top+gap)/(height+gap)));
    const count=Math.min(projected.length,Math.max(2,Math.ceil(projected.length/rows)));
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
  function islandView(island){
    const {bounds,g,radius}=islands.get(island.id),target=bounds.getCenter(new THREE.Vector3());
    if(innerWidth<768){
      framing(false);
      target.copy(g.position).add(new THREE.Vector3(0,1,0));
      // Fit the physical island to 90% of the viewport; labels are packed separately.
      const distance=radius/Math.sin(Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect*.9));
      return {target,end:target.clone().addScaledVector(new THREE.Vector3(0,1.8,2.6).normalize(),distance)};
    }
    const end=fittedPosition(target,new THREE.Vector3(0,1.8,2.6),corners(bounds).concat(workLabels.filter(x=>x.island===island).map(x=>labelPoint(x.label))),false);
    return {target,end};
  }
  function overview(){current=null;controls.minDistance=12;controls.enabled=true;controls.target.set(0,0,0);
    if(innerWidth<768){
      const up=new THREE.Vector3(0,1,-.65).normalize();
      const points=[...islands.values()].flatMap(({g,radius})=>[-1,1].flatMap(x=>[-1,1].map(y=>g.position.clone().add(new THREE.Vector3(x*radius,0,0)).addScaledVector(up,y*7))));
      camera.position.copy(fittedPosition(controls.target,new THREE.Vector3(0,.65,1),points,true));
    }else camera.position.copy(fittedPosition(controls.target,new THREE.Vector3(.38,.62,1),[...islands.values()].flatMap(x=>corners(x.bounds).concat(labelPoint(x.label))),true));
    workLabels.forEach(x=>x.label.visible=false);islands.forEach(x=>x.label.visible=true);controls.update();}
  function resize(){layoutIslands();quality();const dpr=Math.min(devicePixelRatio,1.5);renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight);labels.setSize(innerWidth,innerHeight);composer?.resize(innerWidth,innerHeight,dpr);
    if(flight){framing(false);}else if(current){const {target,end}=islandView(current);camera.position.copy(end);controls.target.copy(target);controls.update();}else overview();}
  window.addEventListener('resize',resize);resize();
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
  renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
  renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>7||!['overview','island'].includes(actions.getState()))return;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(targets).find(h=>!current||h.object.userData.island===current);if(!hit)return;const {island,work}=hit.object.userData;if(current===island&&work)actions.openWork(island,work,renderer.domElement);else actions.enter(island);});renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','仙域場景；亦可使用浮島選擇按鈕');
  function travel(island){controls.enabled=false;current=island;workLabels.forEach(x=>x.label.visible=false);islands.forEach(x=>x.label.visible=false);const {target,end}=islandView(island);
    const finish=()=>{const view=islandView(island);camera.position.copy(view.end);controls.target.copy(view.target);controls.enabled=true;controls.minDistance=7;controls.update();workLabels.forEach(x=>x.label.visible=x.island===island);};
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
