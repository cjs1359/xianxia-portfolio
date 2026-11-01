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
export function building(type, accent) {
  const g=new T.Group();const box=geometry('Box',1,1,1), column=geometry('Cylinder',.065,.08,1,6);
  const add=(geo,c,x,y,z,s)=>part(g,geo,c,x,y,z,s);
  if(type==='洞府'){
    add(geometry('Dodecahedron',1.25,0),'#737d73',0,.9,0,[1,1.2,.7]);add(geometry('Circle',.57,16),'#233b38',0,.65,.89);for(const x of [-.7,.7])add(box,'#a6a28a',x,.7,1,[.18,1.4,.22]);add(box,'#c6bc9c',0,1.45,1,[1.7,.2,.32]);
  }else{
    const pavilion=type==='亭', hall=type==='殿', tower=type==='塔';const levels=pavilion?1:hall?2:type==='樓'?4:tower?5:3;const width=hall?1.6:1;
    add(box,'#a5a18b',0,.1,0,[width*1.8,.2,1.7]);
    for(let l=0;l<levels;l++){
      const y=.25+l*.85, taper=tower?1-l*.12:1;
      if(!pavilion)add(box,'#e1d5b7',0,y+.32,0,[width*taper,.6,.9*taper]);
      const n=pavilion?6:4;for(let k=0;k<n;k++){const a=k/n*Math.PI*2+Math.PI/4;add(column,hall?'#9a493b':'#755744',Math.cos(a)*width*.75*taper,y+.35,Math.sin(a)*.75*taper,[1,.75,1]);}
      add(roof((hall?1.9:1.25)*taper,.65,pavilion?6:4),accent,0,y+.75,0);
      if(!pavilion){add(box,'#3c514b',0,y+.3,.46*taper,[.2,.4,.03]);if(type==='樓'||tower){for(const z of [-.65,.65])add(box,'#a98b59',0,y+.2,z*taper,[width*1.5*taper,.08,.06]);for(const x of [-.7,.7])add(box,'#a98b59',x*width*taper,y+.2,0,[.06,.08,1.3*taper]);}}
    }
  }
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
