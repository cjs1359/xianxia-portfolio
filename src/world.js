import * as THREE from 'three';
import { Timer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
export function createWorld(data, actions) {
  const host = document.querySelector('#scene');
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
  renderer.setClearColor('#153638'); host.append(renderer.domElement);
  const labels = new CSS2DRenderer(); labels.domElement.style.cssText = 'position:absolute;inset:0;pointer-events:none'; host.append(labels.domElement);
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2('#244949', .008);
  const camera = new THREE.PerspectiveCamera(43,1,.1,500);
  const controls = new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.maxPolarAngle=Math.PI*.46; controls.minDistance=12; controls.maxDistance=230; controls.enablePan=false;
  scene.add(new THREE.HemisphereLight('#fff1cf','#183b45',2.8)); const sun=new THREE.DirectionalLight('#ffe1a4',3);sun.position.set(-20,40,20);scene.add(sun);
  const islands=new Map(), targets=[], workLabels=[]; let current=null, active=true, flight=null, last=0, idleSince=performance.now(), disposed=false;
  const ORBIT_RADIUS=23;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.85,...extra});
  const gold=mat('#c5a663'), paper=mat('#e5dec4'), wood=mat('#794a36');
  function mesh(parent,geo,material,x=0,y=0,z=0){ const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);parent.add(m);return m; }
  function roof(g,y,r,color){const m=mesh(g,new THREE.ConeGeometry(r,.8,4),color,0,y);m.rotation.y=Math.PI/4;}
  function building(type,accent){
    const g=new THREE.Group();const roofMat=mat(accent);
    if(type==='洞府'){mesh(g,new THREE.DodecahedronGeometry(1.1),mat('#68766c'),0,.65);const entry=mesh(g,new THREE.CircleGeometry(.48,16),mat('#112a2b'),0,.5,.95);entry.rotation.x=-.12;mesh(g,new THREE.TorusGeometry(.5,.09,6,16),gold,0,.5,1);}
    else if(type==='亭'){for(const x of [-.5,.5])for(const z of [-.5,.5])mesh(g,new THREE.CylinderGeometry(.07,.07,1.2,6),wood,x,.6,z);roof(g,1.5,1.15,roofMat);}
    else {const levels=type==='閣'?3:type==='樓'?2:1;for(let l=0;l<levels;l++){mesh(g,new THREE.BoxGeometry(type==='殿'?1.8:1.1,.7,1),paper,0,.45+l*.9);roof(g,.95+l*.9,type==='殿'?1.7:1.15-l*.1,roofMat);mesh(g,new THREE.BoxGeometry(.18,.35,.03),wood,0,.4+l*.9,.52);} }
    return g;
  }
  function label(text,position,cls,fn){const b=document.createElement('button');b.className=`label ${cls}`;b.textContent=text;b.onclick=e=>{e.stopPropagation();fn(b)};const o=new CSS2DObject(b);o.position.copy(position);return o;}
  data.islands.forEach((island,i)=>{
    const angle=i/6*Math.PI*2;const g=new THREE.Group();g.position.set(Math.cos(angle)*23,Math.sin(i*2)*1.5,Math.sin(angle)*23);scene.add(g);
    const radius=island.works.length>8?7:5.5;
    const rock=mesh(g,new THREE.ConeGeometry(radius,9,7),mat(island.color),0,-4.5);rock.rotation.z=Math.PI;
    const top=mesh(g,new THREE.CylinderGeometry(radius,radius*.94,.6,7),mat('#72836c'),0,.15);
    for(const m of [rock,top]){m.userData.island=island;targets.push(m);}
    mesh(g,new THREE.TorusGeometry(radius*.92,.045,5,64),mat(island.accent,{emissive:island.accent,emissiveIntensity:.35}),0,.52).rotation.x=Math.PI/2;
    island.works.forEach((work,j)=>{
      const a=j/island.works.length*Math.PI*2; const r=island.works.length===1?0:radius*.67;
      const b=building(work.buildingType,island.accent);b.position.set(Math.cos(a)*r,.5,Math.sin(a)*r);b.scale.setScalar(island.works.length>8?.68:.95);g.add(b);
      b.traverse(m=>{if(m.isMesh){m.userData.work=work;m.userData.island=island;targets.push(m)}});
      const l=label(work.buildingName,new THREE.Vector3(b.position.x,3.7,b.position.z),'work-label',trigger=>{if(current===island&&actions.getState()==='island')actions.openWork(island,work,trigger)});l.visible=false;g.add(l);workLabels.push({label:l,island});
    });
    for(let j=0;j<5;j++){const a=j*2.4;const x=Math.cos(a)*radius*.88,z=Math.sin(a)*radius*.88;mesh(g,new THREE.CylinderGeometry(.08,.12,.8,5),wood,x,.75,z);mesh(g,new THREE.ConeGeometry(.45,1.4,5),mat(island.color),x,1.6,z);mesh(g,new THREE.DodecahedronGeometry(.35),mat('#9b9d84'),x+.5,.6,z);}
    const l=label(`${island.name} · ${island.works.length}卷`,new THREE.Vector3(0,5.2,0),'island-label',b=>actions.enter(island,b));g.add(l);islands.set(island.id,{g,radius,label:l});
  });
  const clouds=new THREE.Group();scene.add(clouds);const cloudMat=mat('#aec9bc',{transparent:true,opacity:.12,depthWrite:false});
  for(let i=0;i<55;i++){const a=i*2.399;const r=12+Math.sqrt(i)*6;const c=mesh(clouds,new THREE.SphereGeometry(1,12,6),cloudMat,Math.cos(a)*r,-6+(i%5),Math.sin(a)*r);c.scale.set(7+i%4,1,3+i%3);}
  const stars=new THREE.BufferGeometry();const positions=[];for(let i=0;i<160;i++)positions.push(Math.sin(i*123)*90,8+(i%31),Math.cos(i*47)*90);stars.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));scene.add(new THREE.Points(stars,new THREE.PointsMaterial({color:'#d2c088',size:.12,transparent:true,opacity:.55})));
  function vehicle(kind){const g=new THREE.Group();
    if(kind==='飛劍'){mesh(g,new THREE.BoxGeometry(.28,.13,3),paper);mesh(g,new THREE.ConeGeometry(.24,.8,4),paper,0,0,-1.8).rotation.x=-Math.PI/2;mesh(g,new THREE.BoxGeometry(1,.2,.2),gold,0,0,1);}
    else if(kind==='玉如意'){mesh(g,new THREE.CylinderGeometry(.15,.15,2,8),mat('#89bca2')).rotation.x=Math.PI/2;mesh(g,new THREE.SphereGeometry(.5,12,8),mat('#89bca2'),0,.1,-1);}
    else if(kind==='雲舟'){const hull=mesh(g,new THREE.SphereGeometry(1,12,6),wood);hull.scale.set(.8,.35,2);mesh(g,new THREE.BoxGeometry(1.2,.1,2.6),gold,0,.3);}
    else if(kind==='紙鶴'){mesh(g,new THREE.ConeGeometry(.4,1.8,3),paper).rotation.x=Math.PI/2;for(const side of [-1,1]){const w=mesh(g,new THREE.ConeGeometry(.8,1.7,3),paper,side*.8,.25);w.rotation.z=side*-1;}}
    else if(kind==='葫蘆'){mesh(g,new THREE.SphereGeometry(.7,12,8),gold,0,-.2);mesh(g,new THREE.SphereGeometry(.48,12,8),gold,0,.65);}
    else {for(let i=0;i<2;i++){mesh(g,new THREE.TorusGeometry(1+i*.4,.07,8,48),gold).rotation.x=Math.PI/2;}}
    scene.add(g);return g;
  }
  function overview(){current=null;controls.enabled=true;controls.target.set(0,0,0);
    const R=ORBIT_RADIUS+9;const halfV=camera.fov*Math.PI/360;const halfH=Math.atan(Math.tan(halfV)*camera.aspect);
    const dist=R/Math.sin(Math.min(halfV,halfH))*1.12;
    camera.position.set(.38,.62,1).normalize().multiplyScalar(dist);
    workLabels.forEach(x=>x.label.visible=false);islands.forEach(x=>x.label.visible=true);controls.update();}
  function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,camera.aspect<1?1.5:2));renderer.setSize(innerWidth,innerHeight);labels.setSize(innerWidth,innerHeight);if(!current&&!flight)overview();}
  window.addEventListener('resize',resize);resize();
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
  renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
  renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>7||!['overview','island'].includes(actions.getState()))return;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(targets).find(h=>!current||h.object.userData.island===current);if(!hit)return;const {island,work}=hit.object.userData;if(current===island&&work)actions.openWork(island,work,renderer.domElement);else actions.enter(island);});renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','仙域場景；亦可使用浮島選擇按鈕');
  function travel(island){controls.enabled=false;current=island;workLabels.forEach(x=>x.label.visible=false);islands.forEach(x=>x.label.visible=false);const {g,radius}=islands.get(island.id);const target=g.position.clone();const end=target.clone().add(new THREE.Vector3(0,radius*1.8,radius*2.6));
    const finish=()=>{camera.position.copy(end);controls.target.copy(target);controls.enabled=true;controls.minDistance=7;controls.update();workLabels.forEach(x=>x.label.visible=x.island===island);};
    if(reduced.matches){finish();return Promise.resolve();}
    const start=camera.position.clone();const mid=start.clone().lerp(end,.5);mid.y+=12;const path=new THREE.QuadraticBezierCurve3(start,mid,end);const craft=vehicle(island.vehicle);
    return new Promise(resolve=>{flight={start:performance.now(),path,craft,target,oldTarget:controls.target.clone(),finish:()=>{scene.remove(craft);craft.traverse(o=>{if(o.isMesh){o.geometry.dispose();}});finish();resolve();}};});
  }
  const timer=new Timer();
  function frame(now){requestAnimationFrame(frame);if(!active||document.hidden)return;if(!flight&&now-last<50)return;last=now;timer.update();const dt=Math.min(timer.getDelta(),.1);if(flight){const t=Math.min((now-flight.start)/2500,1);const eased=t*t*(3-2*t);camera.position.copy(flight.path.getPoint(eased));const aim=flight.oldTarget.clone().lerp(flight.target,eased);camera.lookAt(aim);flight.craft.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(4)).add(new THREE.Vector3(0,-1.3,0));flight.craft.lookAt(flight.path.getPoint(Math.min(eased+.02,1)));if(t===1){const f=flight;flight=null;f.finish();}}else controls.update();if(!reduced.matches)clouds.rotation.y+=dt*.006;renderer.render(scene,camera);labels.render(scene,camera);}
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;if(flight){const f=flight;flight=null;f.finish();}actions.fail();});requestAnimationFrame(frame);
  return {travel,overview,setActive(value){active=value;}};
}
