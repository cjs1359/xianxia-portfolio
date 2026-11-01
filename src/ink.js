import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
export function texture(kind) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
  if(kind==='runes'){c.strokeStyle='#d4e6ba';c.lineWidth=2;for(const r of [72,95,116]){c.beginPath();c.arc(128,128,r,0,Math.PI*2);c.stroke();}for(let i=0;i<16;i++){c.save();c.translate(128,128);c.rotate(i/16*Math.PI*2);c.strokeRect(-5,78,10,12);c.beginPath();c.moveTo(0,98);c.lineTo(0,110);c.stroke();c.restore();}}
  else if(kind==='mountain'){const gradient=c.createLinearGradient(0,20,0,256);gradient.addColorStop(0,'#5C8FA34d');gradient.addColorStop(1,'#8DB58000');c.fillStyle=gradient;c.beginPath();c.moveTo(0,256);for(let x=0;x<=256;x+=4)c.lineTo(x,110+Math.sin(x*.033)*40+Math.sin(x*.08)*17);c.lineTo(256,256);c.fill();}
  else {const gradient=c.createRadialGradient(128,128,0,128,128,128);gradient.addColorStop(0,kind==='flow'?'#ffffffee':'#ffe2a0d9');gradient.addColorStop(.4,kind==='flow'?'#ffffff99':'#f3cf7044');gradient.addColorStop(1,'#ffffff00');c.fillStyle=gradient;c.fillRect(0,0,256,256);if(kind==='flow'){c.strokeStyle='#ffffff99';for(let i=0;i<30;i++){c.beginPath();c.moveTo(i*9,0);c.bezierCurveTo(i*9+18,80,i*9-12,160,i*9,256);c.stroke();}}}
  const t=new T.CanvasTexture(canvas);t.wrapS=t.wrapT=T.RepeatWrapping;return t;
}
export function atmosphere(scene){
  const mist=texture('flow'),glow=texture('glow'),mountain=texture('mountain');const flows=[];
  for(let i=0;i<12;i++){const m=new T.Mesh(new T.PlaneGeometry(75,40),new T.MeshBasicMaterial({map:mountain,transparent:true,opacity:.35+i%3*.1,depthWrite:false,side:T.DoubleSide}));const a=i/12*Math.PI*2;m.position.set(Math.sin(a)*110,-2+i%3*4,Math.cos(a)*110);m.lookAt(0,0,0);scene.add(m);}
  for(let i=0;i<14;i++){const material=new T.MeshBasicMaterial({map:mist,transparent:true,opacity:.55,depthWrite:false,side:T.DoubleSide});const m=new T.Mesh(new T.PlaneGeometry(30,13),material);m.rotation.x=-Math.PI/2;m.position.set(Math.sin(i*2.4)*45,-4+i%3,Math.cos(i*2.4)*45);scene.add(m);}
  return {glow,flows,mist,update(dt){mist.offset.y-=dt*.08;flows.forEach(t=>t.offset.y-=dt*.35);}};
}
export function waterfall(parent,r,atmosphere,cloud=false){const map=texture('flow');atmosphere.flows.push(map);const m=new T.Mesh(new T.PlaneGeometry(cloud?3:1.3,8),new T.MeshBasicMaterial({map,color:cloud?'#ffffff':'#f4fdff',transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide}));m.position.set(r*.65,-3,r*.6);parent.add(m);const s=new T.Sprite(new T.SpriteMaterial({map:atmosphere.glow,color:'#ffd478',transparent:true,opacity:.4,depthWrite:false}));s.position.set(0,-1,0);s.scale.set(r*3, r*1.6,1);parent.add(s);}
export function inkComposer(renderer,scene,camera){
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const pass=new ShaderPass({uniforms:{tDiffuse:{value:null},resolution:{value:new T.Vector2(1,1)}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 resolution;varying vec2 vUv;
  float lum(vec2 p){return dot(texture2D(tDiffuse,p).rgb,vec3(.299,.587,.114));}
  void main(){vec2 d=1./resolution;float a=lum(vUv+d*vec2(-1,1)),b=lum(vUv+d*vec2(0,1)),c=lum(vUv+d),e=lum(vUv+d*vec2(-1,0)),f=lum(vUv+d*vec2(1,0)),g=lum(vUv-d),h=lum(vUv+d*vec2(0,-1)),i=lum(vUv+d*vec2(1,-1));float edge=length(vec2(-a-2.*e-g+c+2.*f+i,a+2.*b+c-g-2.*h-i));vec3 color=texture2D(tDiffuse,vUv).rgb;float l=dot(color,vec3(.299,.587,.114));color=mix(vec3(l),color,1.12);color=mix(color,vec3(1.,.98,.91),.035);color*=1.-min(edge*.07,.07);float noise=fract(sin(dot(floor(vUv*resolution),vec2(12.9898,78.233)))*43758.5453);color+=(noise-.5)*.012;gl_FragColor=vec4(color,1.);}`});
  composer.addPass(pass);composer.addPass(new OutputPass());return {render:()=>composer.render(),resize(w,h,dpr){composer.setPixelRatio(dpr);composer.setSize(w,h);pass.uniforms.resolution.value.set(w*dpr,h*dpr);},dispose(){composer.passes.forEach(p=>p.dispose?.());composer.dispose();}};
}

export function runeHalo(parent,radius){
  const ring=new T.Mesh(new T.PlaneGeometry(radius*2,radius*2),new T.MeshBasicMaterial({map:texture('runes'),color:'#e8bd4f',transparent:true,opacity:.85,side:T.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.64;parent.add(ring);return ring;
}
