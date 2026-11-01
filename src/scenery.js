import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const cache = new Map();
export const surface = new T.MeshStandardMaterial({ vertexColors:true, roughness:.9 });
export function geometry(kind, ...args) {
  const key=JSON.stringify([kind,args]);
  if(!cache.has(key)) cache.set(key,new T[`${kind}Geometry`](...args));
  return cache.get(key);
}
export function part(g, geo, color, x=0,y=0,z=0, scale=[1,1,1]) {
  const m=new T.Mesh(geo);m.userData.tint=color;m.position.set(x,y,z);m.scale.set(...scale);g.add(m);return m;
}
export function bake(group) {
  group.updateMatrixWorld(true);const parts=[];
  group.traverse(o=>{if(!o.isMesh)return;let geo=o.geometry.clone();if(geo.index){const old=geo;geo=geo.toNonIndexed();old.dispose();}geo.applyMatrix4(o.matrixWorld);geo.deleteAttribute('uv');const c=new T.Color(o.userData.tint||'#ccccbb');const colors=new Float32Array(geo.attributes.position.count*3);for(let i=0;i<colors.length;i+=3)c.toArray(colors,i);if(!geo.getAttribute('color'))geo.setAttribute('color',new T.BufferAttribute(colors,3));parts.push(geo);});
  const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());return new T.Mesh(merged,surface);
}
export function roof(radius=1.3, height=.65, sides=4) {
  const key=`roof${radius}/${height}/${sides}`;if(cache.has(key))return cache.get(key);
  const p=[];for(let i=0;i<sides;i++){const a=(i/sides+.125)*Math.PI*2,b=((i+1)/sides+.125)*Math.PI*2;const ax=Math.cos(a)*radius,az=Math.sin(a)*radius,bx=Math.cos(b)*radius,bz=Math.sin(b)*radius;const mx=(ax+bx)*.5,mz=(az+bz)*.5;p.push(0,height,0, mx,0,mz,ax,.3,az, 0,height,0,bx,.3,bz,mx,0,mz);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.computeVertexNormals();cache.set(key,geo);return geo;
}
export function seedOf(str){let h=2166136261;for(const c of String(str)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let a=seed||1;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const ROOF_TINTS=['#c8452f','#d9a441','#5aa38a','#4f8fbf','#b8563d'];
const PILLARS=['#9a493b','#755744','#b0573f','#8a6a4a','#a0523a'];
const WALLS=['#e1d5b7','#efe4c8','#e8d8b0','#f2ead6'];
export function building(type, accent, seed=0) {
  const g=new T.Group();const box=geometry('Box',1,1,1), column=geometry('Cylinder',.065,.08,1,6);
  const R=rng(seed),pick=a=>a[Math.floor(R()*a.length)],add=(geo,c,x,y,z,s)=>part(g,geo,c,x,y,z,s);
  const mix=(a,b,t)=>'#'+new T.Color(a).lerp(new T.Color(b),t).getHexString();
  if(type==='洞府'){
    const k=.85+R()*.35;
    add(geometry('Dodecahedron',1.25,0),pick(['#737d73','#7d8a7a','#6f7a70']),0,.9,0,[k,1.2*(.9+R()*.25),.7]);add(geometry('Circle',.57,16),'#233b38',0,.65,.89);for(const x of [-.7,.7])add(box,'#a6a28a',x,.7,1,[.18,1.4,.22]);add(box,'#c6bc9c',0,1.45,1,[1.7,.2,.32]);
    if(R()<.6)add(box,'#d9a441',0,1.75,1.02,[.7,.26,.05]);
    if(R()<.5)for(const x of [-.95,.95]){add(geometry('Sphere',.13,8,6),'#d8462f',x,1.15,1.05);}
    return bake(g);
  }
  const pavilion=type==='亭', hall=type==='殿', tower=type==='塔';
  const baseLevels=pavilion?1:hall?2:type==='樓'?4:tower?5:3;
  const levels=Math.max(pavilion?1:tower?3:1,baseLevels+(pavilion?0:Math.floor(R()*3)-1));
  const width=(hall?1.6:1)*(.85+R()*.35),depth=.85+R()*.3,step=.75+R()*.2;
  const style=pavilion?pick(['攒尖','攒尖','卷棚','重簷']):hall?pick(['歇山','重簷','歇山','卷棚']):pick(['攒尖','歇山','重簷','卷棚']);
  const sides=style==='攒尖'?pick(pavilion?[6,8,4]:[4,8]):4;
  const roofC=R()<.55?accent:mix(accent,pick(ROOF_TINTS),.35+R()*.3),pillarC=pick(PILLARS),wallC=pick(WALLS);
  // Base platform: 1–3 stepped tiers.
  const tiers=1+Math.floor(R()*3);for(let t=0;t<tiers;t++)add(box,t%2?'#c4bb9f':'#a5a18b',0,.05+t*.1,0,[width*1.8+(tiers-t-1)*.3,.12,1.7*depth+(tiers-t-1)*.3]);
  const y0=tiers*.1;let top=0;
  for(let l=0;l<levels;l++){
    const y=y0+.15+l*step*.95, taper=tower?1-l*.11:1-l*.04;
    if(!pavilion)add(box,wallC,0,y+.32,0,[width*taper,.6,.9*depth*taper]);
    const n=pavilion?(sides>4?sides:6):4;for(let k=0;k<n;k++){const a=k/n*Math.PI*2+Math.PI/4;add(column,pillarC,Math.cos(a)*width*.75*taper,y+.35,Math.sin(a)*.75*depth*taper,[1,.75,1]);}
    const rr=(hall?1.9:1.25)*taper*(.92+R()*.16);
    if(style==='卷棚'){add(roof(rr,.38,sides),roofC,0,y+.75,0,[width>1.2?1.1:1,1,depth]);add(geometry('Cylinder',.12,.12,1,8),roofC,0,y+1.1,0,[1,rr*1.1,1]).rotation.z=Math.PI/2;}
    else if(style==='歇山'){add(roof(rr,.6,4),roofC,0,y+.75,0,[1.18,1,depth]);add(box,mix(roofC,'#3c3328',.25),0,y+1.33,0,[rr*.9,.08,.08]);for(const x of [-1,1])add(geometry('Cone',.07,.25,5),'#d9a441',x*rr*.45,y+1.42,0);}
    else{add(roof(rr,.65,sides),roofC,0,y+.75,0,[1,1,depth]);if(style==='重簷'&&l===levels-1)add(roof(rr*.72,.5,sides),mix(roofC,'#ffffff',.12),0,y+1.12,0,[1,1,depth]);}
    if(!pavilion){add(box,'#3c514b',0,y+.3,.46*depth*taper,[.2,.4,.03]);if(type==='樓'||tower||R()<.3){for(const z of [-.65,.65])add(box,'#a98b59',0,y+.2,z*depth*taper,[width*1.5*taper,.08,.06]);for(const x of [-.7,.7])add(box,'#a98b59',x*width*taper,y+.2,0,[.06,.08,1.3*depth*taper]);}}
    // 風鈴 at the eave corners.
    if(R()<.35)for(let k=0;k<4;k++){const a=k/4*Math.PI*2+Math.PI/4;add(geometry('Cone',.05,.14,5),'#d9a441',Math.cos(a)*rr*.95,y+.95,Math.sin(a)*rr*.95*depth);}
    top=y+(style==='重簷'&&l===levels-1?1.6:1.4);
  }
  // 寶頂 finial.
  if(style!=='卷棚'&&R()<.7){add(geometry('Sphere',.12,8,6),'#e0b448',0,top,0);add(geometry('Cone',.07,.3,6),'#e0b448',0,top+.2,0);}
  // 牌匾 plaque over the door.
  if(!pavilion&&R()<.6)add(box,pick(['#d9a441','#c8452f','#2f4f4a']),0,y0+.78,.47*depth,[.42,.16,.03]);
  // Ground 欄杆 railing.
  if(R()<.45){const w=width*.95+.25,d=.85*depth+.25;for(const z of [-d,d])add(box,'#b89a68',0,y0+.22,z,[w*2,.06,.05]);for(const x of [-w,w])add(box,'#b89a68',x,y0+.22,0,[.05,.06,d*2]);for(let k=-2;k<=2;k++)add(box,'#b89a68',k*w/2,y0+.15,d,[.05,.2,.05]);}
  // 燈籠 pair.
  if(R()<.4)for(const x of [-1,1]){add(column,'#755744',x*(width*.95+.35),y0+.45,.9*depth,[.6,.9,.6]);add(geometry('Sphere',.14,8,6),'#d8462f',x*(width*.95+.35),y0+.95,.9*depth,[1,1.2,1]);}
  return bake(g);
}
export function islandTerrain(radius, index) {
  const g=new T.Group(), outline=new T.Shape();
  for(let i=0;i<11;i++){const a=i/11*Math.PI*2,r=radius*(.88+.12*Math.sin(i*7+index));const x=Math.cos(a)*r,y=Math.sin(a)*r;i?outline.lineTo(x,y):outline.moveTo(x,y);}outline.closePath();
  for(let l=0;l<4;l++){const geo=new T.ExtrudeGeometry(outline,{depth:.55,bevelEnabled:false});geo.rotateX(-Math.PI/2);part(g,geo,['#b5c5ad','#5C8FA3','#c49a70','#87adba'][l],0,-l*.55,0,[1-l*.045,1,1-l*.045]);}
  const top=new T.ShapeGeometry(outline);top.rotateX(-Math.PI/2);part(g,top,'#8DB580',0,.57);
  const cone=part(g,geometry('Cone',radius*.85,7,9),'#7fa4af',0,-4.7);cone.rotation.z=Math.PI;
  return {group:g, transient:[...g.children].map(o=>o.geometry).filter(geo=>!Array.from(cache.values()).includes(geo))};
}
export function pine(g,x,z,size=1){part(g,geometry('Cylinder',.1,.18,1.8,5),'#705f49',x,1.1,z,[size,size,size]);for(let l=0;l<3;l++)part(g,geometry('Cone',.9-l*.18,1.25,6),'#74a776',x,(1.6+l*.55)*size,z,[size, size, size]);}
export function gate(g,z=4){for(const x of [-.8,.8])part(g,geometry('Box',.18,1.8,.2),'#a3a18a',x,1.4,z);part(g,geometry('Box',2,.25,.3),'#c0b28a',0,2.2,z);part(g,roof(1.5,.4),'#566f65',0,2.4,z);}
export function accents(g,id,r) {
  const box=geometry('Box',1,1,1), rock=geometry('Dodecahedron',1,0), ring=geometry('Torus',1,.05,5,48);
  gate(g,r*.8);
  for(let i=0;i<7;i++){const a=i*2.4,x=Math.cos(a)*r*.9,z=Math.sin(a)*r*.9;pine(g,x,z,.6+i%2*.2);part(g,rock,'#9ca28b',x,-2-i%3,z,[.5,.6,.6]);for(let k=0;k<2;k++){const vine=part(g,geometry('Cylinder',.025,.04,2.5,4),'#80a166',x+k*.18,-2.4,z,[1,1+i%3*.3,1]);vine.rotation.z=.15*Math.sin(i);}}
  if(id==='gewu') {for(let i=0;i<5;i++)part(g,box,i%2?'#c4b795':'#8b9281',-2+i*.3,.8+i*.3,-2,[2-i*.2,.25,1.7]);for(let i=0;i<13;i++){part(g,geometry('Cylinder',.035,.06,2.4,5),'#589858',-r*.78+i%4*.38,2.1,1-Math.floor(i/4)*.38);part(g,geometry('Cone',.35,.8,4),'#8DB580',-r*.78+i%4*.38,3.2,1-Math.floor(i/4)*.38);}for(let i=0;i<5;i++){part(g,rock,'#bcc2ab',i*.6-1,3+i%2*.5,-r,[.3,.15,.3]);part(g,geometry('Sphere',.055,6,4),'#e9cf8e',i*.6-1,3.3+i%2*.5,-r);}}
  if(id==='yayun'){for(let i=0;i<4;i++)part(g,box,i%2?'#a6ac79':'#b9b68d',0,.65+i*.17,-2,[4-i*.6,.17,1.4-i*.15]);for(let i=0;i<6;i++){const x=Math.sin(i)*r*.88,z=Math.cos(i)*r*.88;part(g,geometry('Cylinder',.035,.05,2.7,5),'#a47b48',x,.57+1.35,z);part(g,geometry('Sphere',.3,8,6),'#B23A2E',x,2.8,z,[1,1.3,1]);for(const y of [2.48,3.12])part(g,geometry('Cylinder',.2,.2,.08,8),'#C9A227',x,y,z);}}
  if(id.startsWith('xuan')){part(g,geometry('Cylinder',1.4,1.7,.4,12),'#bba66b',0,.8,r*.73);for(let i=0;i<3;i++){const m=part(g,ring,'#C9A227',0,2.8,r*.73,[1.9,1.9,1.9]);m.rotation.set(i*.8,.5,i*.7);} }
  if(id==='yinfeng'){part(g,geometry('Cone',1.4,5,7),'#73837a',-2,2.8,-2);const pool=part(g,geometry('Circle',1.65,32),'#a2dbe3',0,.61,r*.7);pool.rotation.x=-Math.PI/2;pine(g,-1.5,-1,1.5);}
  if(id==='qingshi'){const tower=building('塔','#6b8075');tower.position.set(-r*.72,.55,1);g.add(tower);tower.userData.tint='#eee3c4';part(g,geometry('Sphere',.4,10,8),'#ffe2a0',-r*.72,5.1,1);part(g,geometry('Sphere',.55,8,6),'#a38f5b',2,1.2,0,[1,.8,1]);for(const x of [1.6,2.4])part(g,box,'#8b7952',x,.8,0,[.1,.6,.1]);}
  if(id==='tashan'){for(let i=0;i<9;i++)part(g,rock,'#9caaa0',Math.sin(i*2.4)*(r+1),1+i%3,Math.cos(i*2.4)*(r+1),[.5,.25,.5]);part(g,geometry('Torus',1,.13,6,32),'#C9A227',0,2.1,r*.75);part(g,geometry('Circle',.92,32),'#b5e4ed',0,2.1,r*.75);const m=part(g,ring,'#b3d6c7',0,.65,0,[2,2,2]);m.rotation.x=Math.PI/2;}
}
