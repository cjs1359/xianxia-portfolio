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
  const ORBIT_RADIUS=23;
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
      const l=label(work.buildingName,new THREE.Vector3(b.position.x,3.7,b.position.z),'work-label',trigger=>{if(current===island&&actions.getState()==='island')actions.openWork(island,work,trigger)});l.visible=false;g.add(l);workLabels.push({label:l,island});
    });
    const l=label(`${island.name} · ${island.works.length}卷`,new THREE.Vector3(0,5.2,0),'island-label',b=>actions.enter(island,b));g.add(l);islands.set(island.id,{g,radius,label:l});
  });
  function overview(){current=null;controls.minDistance=12;controls.enabled=true;controls.target.set(0,0,0);
    const R=ORBIT_RADIUS+9;const halfV=camera.fov*Math.PI/360;const halfH=Math.atan(Math.tan(halfV)*camera.aspect);
    const dist=R/Math.sin(Math.min(halfV,halfH))*1.12;
    camera.position.set(.38,.62,1).normalize().multiplyScalar(dist);
    workLabels.forEach(x=>x.label.visible=false);islands.forEach(x=>x.label.visible=true);controls.update();}
  function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();quality();const dpr=Math.min(devicePixelRatio,1.5);renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight);labels.setSize(innerWidth,innerHeight);composer?.resize(innerWidth,innerHeight,dpr);if(!current&&!flight)overview();}
  window.addEventListener('resize',resize);resize();
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
  renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
  renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>7||!['overview','island'].includes(actions.getState()))return;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(targets).find(h=>!current||h.object.userData.island===current);if(!hit)return;const {island,work}=hit.object.userData;if(current===island&&work)actions.openWork(island,work,renderer.domElement);else actions.enter(island);});renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','仙域場景；亦可使用浮島選擇按鈕');
  function travel(island){controls.enabled=false;current=island;workLabels.forEach(x=>x.label.visible=false);islands.forEach(x=>x.label.visible=false);const {g,radius}=islands.get(island.id);const target=g.position.clone();const end=target.clone().add(new THREE.Vector3(0,radius*1.8,radius*2.6));
    const finish=()=>{camera.position.copy(end);controls.target.copy(target);controls.enabled=true;controls.minDistance=7;controls.update();workLabels.forEach(x=>x.label.visible=x.island===island);};
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
    if(composer)composer.render();else renderer.render(scene,camera);labels.render(scene,camera);
  }
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;if(flight){const f=flight;flight=null;f.finish();}actions.fail();});raf=requestAnimationFrame(frame);
  return {travel,overview,setActive(value){active=value;sampleTime=0;},dispose(){
    if(disposed)return;disposed=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);reduced.removeEventListener('change',motionChanged);
    if(flight){const f=flight;flight=null;f.finish();}controls.dispose();composer?.dispose();
    const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}}});
    air.flows.forEach(t=>textures.add(t));textures.add(skyTexture);textures.add(air.glow);textures.add(air.mist);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();labels.domElement.remove();document.body.classList.remove('ink-simple');
  }};
}
