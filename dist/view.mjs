import * as THREE from './vendor/three.module.js';
import { ARENA } from './arena.mjs';
import { WEAPONS, EYE, lerp, clamp } from './rules.mjs';
import { makeFighter, poseFighter, makeGun } from './models.mjs';

const v3=(x,y,z)=>new THREE.Vector3(x,y,z);
const cube=new THREE.BoxGeometry(1,1,1);
const coat=new THREE.MeshStandardMaterial({roughness:.86,metalness:.02});
function boxBatch(list) {
  const batch=new THREE.InstancedMesh(cube,coat,list.length), dummy=new THREE.Object3D();
  list.forEach((b,i)=>{
    dummy.position.set(b.x,b.y+b.h*.5,b.z);dummy.scale.set(b.w,b.h,b.d);dummy.rotation.y=b.angle||0;dummy.updateMatrix();
    batch.setMatrixAt(i,dummy.matrix);batch.setColorAt(i,new THREE.Color(b.color));
  });
  batch.receiveShadow=true;batch.castShadow=true;return batch;
}
function rampMesh(r) {
  const x=r.w/2,z=r.d/2,h=r.h;
  const height=(sx,sz)=>r.dir==='+x'?(sx>0?h:0):r.dir==='-x'?(sx<0?h:0):r.dir==='+z'?(sz>0?h:0):(sz<0?h:0);
  const low=[[-x,0,-z],[x,0,-z],[x,0,z],[-x,0,z]],high=low.map(([x,,z])=>[x,height(x,z),z]);
  const vertices=[];const tri=(a,b,c)=>vertices.push(...a,...b,...c);
  tri(high[0],high[2],high[1]);tri(high[0],high[3],high[2]);
  for(let i=0;i<4;i++){const j=(i+1)%4;tri(low[i],high[j],high[i]);tri(low[i],low[j],high[j]);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:r.color,side:THREE.DoubleSide,roughness:.91}));
  mesh.position.set(r.x,r.y,r.z);mesh.receiveShadow=mesh.castShadow=true;return mesh;
}
function labelTexture(text,fg,bg,ratio=6,alpha=false) {
  const c=document.createElement('canvas');c.width=512;c.height=Math.round(512/ratio);
  const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`800 ${Math.floor(c.height*.59)}px "Bahnschrift", Arial, sans-serif`;
  ctx.fillText(text,c.width/2,c.height*.53,c.width*.92);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xf1ffff,0xcdb192,1.75));
  const sun=new THREE.DirectionalLight(0xffedcb,2.05);sun.position.set(-30,43,24);scene.add(sun);return sun;
}
function buildArena(scene) {
  scene.background=new THREE.Color('#a6d8e2');scene.fog=new THREE.Fog('#bad9d9',60,153);
  const floor=new THREE.Mesh(new THREE.BoxGeometry(330,.22,330),new THREE.MeshStandardMaterial({color:ARENA.floorColor,roughness:1}));
  floor.position.y=-.112;floor.receiveShadow=true;scene.add(floor);
  scene.add(boxBatch([...ARENA.boxes,...ARENA.decor]));for(const r of ARENA.ramps)scene.add(rampMesh(r));
  for(const sign of ARENA.signs) {
    const tex=labelTexture(sign.text,sign.fg,sign.bg,sign.width/sign.height);
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(sign.width,sign.height),new THREE.MeshBasicMaterial({map:tex}));
    plane.position.set(sign.x,sign.y,sign.z);plane.rotation.y=sign.yaw;scene.add(plane);
  }
  // Faceted distant ridgelines and high, stepped clouds frame the freight yard.
  const peaks=[];
  for(let i=0;i<23;i++) {
    const a=i*2*Math.PI/23, radius=99+(i%3)*11;
    const geo=new THREE.ConeGeometry(18+(i*7)%15,17+(i*9)%19,5,1);
    const peak=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:i%2?'#8eafb2':'#b1c3b5',flatShading:true}));
    peak.rotation.y=i*1.77;peak.position.set(Math.cos(a)*radius,2,Math.sin(a)*radius);scene.add(peak);
    if(i%2===0) for(let k=0;k<3;k++) peaks.push({x:Math.cos(a)*112+k*4,y:24+(i*4)%13+k%2,z:Math.sin(a)*112,w:8+k*1.3,h:1.2+k*.45,d:3.5+k,color:'#f9f4df'});
  }
  scene.add(boxBatch(peaks));
  const sun=addLights(scene);sun.castShadow=true;sun.shadow.camera.left=-47;sun.shadow.camera.right=47;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;
  sun.shadow.camera.near=1;sun.shadow.camera.far=130;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.032;sun.shadow.bias=-.00024;
  return sun;
}
function makeTag(p) {
  const label=(p.bot?'BOT  /  ':'')+p.name;
  const tex=labelTexture(label,p.bot?'#fff3d7':'#b7ffe6','#172c36',5.2);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:.92,depthWrite:false}));
  s.scale.set(1.74,.335,1);s.position.y=2.12;return s;
}
export class ArenaView {
  constructor(canvas,quality) {
    this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene=new THREE.Scene();this.sun=buildArena(this.scene);this.camera=new THREE.PerspectiveCamera(72,1,.055,190);
    this.camera.rotation.order='YXZ';this.viewScene=new THREE.Scene();addLights(this.viewScene);
    this.gunCamera=new THREE.PerspectiveCamera(57,1,.015,10);this.guns=WEAPONS.map((_,i)=>makeGun(i,true));
    this.gunRig=new THREE.Group();this.viewScene.add(this.gunRig);for(const g of this.guns)this.gunRig.add(g);
    this.menuActors=new THREE.Group();this.scene.add(this.menuActors);
    for(const [x,y,z,yaw,palette,weapon] of [[16.9,3.2,9.18,2.58,1,0],[-4,0,7,-1.55,4,1],[-16.7,3.6,-4,-1.12,2,2],[4,0,-8,.2,3,3]]) {
      const f=makeFighter(palette);f.position.set(x,y,z);f.rotation.y=yaw;poseFighter(f,{weapon,pitch:-.04});this.menuActors.add(f);
    }
    this.actors=new Map();this.effects=[];this.clock=0;this.ads=0;this.kick=0;this.walk=0;this.quality(quality);
    this.flash=new THREE.Mesh(new THREE.OctahedronGeometry(.068),new THREE.MeshBasicMaterial({color:0xffd758,depthTest:false}));
    this.flash.visible=false;this.viewScene.add(this.flash);
  }
  quality(level) {
    this.level=level;this.ratio=Math.min(window.devicePixelRatio||1,[.8,1.25,1.8][level]);
    this.renderer.shadowMap.enabled=level>0;this.renderer.setPixelRatio(this.ratio);this.width=0;
  }
  thumbnails() {
    const shots=[],scene=new THREE.Scene();addLights(scene);
    const cam=new THREE.OrthographicCamera(-.67,.67,.205,-.205,.01,10);
    this.renderer.setPixelRatio(1);this.renderer.setSize(432,132,false);this.renderer.setClearColor(0x000000,0);
    for(let i=0;i<4;i++) {
      const gun=makeGun(i);scene.add(gun);gun.rotation.y=-Math.PI/2;
      const bounds=new THREE.Box3().setFromObject(gun);const center=bounds.getCenter(v3(0,0,0));
      const sz=bounds.getSize(v3(0,0,0));const extent=Math.max(sz.x*.575,.39,sz.y*1.85);
      cam.left=-extent;cam.right=extent;cam.top=extent*132/432;cam.bottom=-cam.top;cam.updateProjectionMatrix();
      cam.position.copy(center).add(v3(.16,.31,2.3));cam.lookAt(center);
      this.renderer.render(scene,cam);shots.push(this.canvas.toDataURL('image/png'));scene.remove(gun);
    }
    this.renderer.setPixelRatio(this.ratio);this.width=0;return shots;
  }
  resize() {
    const host=this.canvas.parentElement,w=host.clientWidth,h=host.clientHeight;
    if(w<1 || h<1) return false;
    if(w!==this.width || h!==this.height) {
      this.width=w;this.height=h;this.renderer.setSize(w,h,false);this.camera.aspect=this.gunCamera.aspect=w/h;
      this.camera.updateProjectionMatrix();this.gunCamera.updateProjectionMatrix();
    }return true;
  }
  clearMatch() {
    for(const entry of this.actors.values()) {this.scene.remove(entry.model);entry.tag.material.map.dispose();entry.tag.material.dispose();}
    this.actors.clear();this.clearEffects();this.kick=0;this.ads=0;this.walk=0;this.life=undefined;
  }
  clearEffects() {for(const fx of this.effects){this.scene.remove(fx.obj);fx.obj.geometry.dispose();fx.obj.material.dispose();}this.effects=[];}
  menu(t) {
    if(!this.resize())return;this.menuActors.visible=true;
    this.camera.fov=46;this.camera.updateProjectionMatrix();
    this.camera.position.set(18.05+Math.sin(t*.13)*.18,4.73+Math.sin(t*.18)*.045,12.18+Math.cos(t*.13)*.11);
    this.camera.lookAt(-6.6,2.5,-15);
    poseFighter(this.menuActors.children[0],{weapon:0,pitch:-.04+Math.sin(t*.75)*.012});
    this.renderer.autoClear=true;this.renderer.render(this.scene,this.camera);
  }
  shot(event,localId) {
    const mine=event.who===localId;
    if(mine) {this.kick=Math.min(1.35,this.kick+.77);this.flashUntil=performance.now()+52;}
    const actor=this.actors.get(event.who);if(actor)actor.kick=1;
    let origin=v3(...event.origin);
    if(mine){const gun=this.guns[event.weapon];if(gun.visible && this.ads<.95){const pos=gun.localToWorld(gun.userData.muzzle.clone());origin=pos.applyQuaternion(this.camera.quaternion).add(this.camera.position);}}
    else if(actor) {const gun=actor.model.userData.gun;origin=gun.localToWorld(gun.userData.muzzle.clone());}
    const lines=[];for(const end of event.ends)lines.push(origin.x,origin.y,origin.z,...end);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
    const obj=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:mine?0xffe294:0xffa85c,transparent:true,opacity:.9,depthWrite:false}));
    this.scene.add(obj);this.effects.push({obj,life:.085,max:.085});
    if(!mine && actor){const spark=new THREE.Mesh(new THREE.OctahedronGeometry(.14),new THREE.MeshBasicMaterial({color:0xffda52}));spark.position.copy(origin);this.scene.add(spark);this.effects.push({obj:spark,life:.062,max:.062});}
  }
  frame(dt,me,players,slot,look,ads,reloadFrac) {
    if(!this.resize() || !me)return;
    this.menuActors.visible=false;this.clock+=dt;
    if(this.life!==me.life) {this.life=me.life;this.kick=0;this.ads=0;this.walk=0;}
    this.ads=lerp(this.ads,ads&&me.hp>0?1:0,1-Math.exp(-17*dt));this.kick*=Math.exp(-13*dt);
    const speed=Math.hypot(me.vx,me.vz);this.walk+=speed*dt*2.1;
    const sway=Math.min(1,speed/5.95)*(me.grounded?1:.15)*(1-this.ads*.89);
    this.camera.fov=lerp(me.sprinting?82:76,WEAPONS[slot].zoom,this.ads);this.camera.updateProjectionMatrix();
    this.camera.position.set(me.x,me.y+(me.hp>0?EYE:.87)+Math.abs(Math.sin(this.walk))*.033*sway,me.z);
    this.camera.rotation.set(look.pitch,look.yaw,.004*Math.sin(this.walk)*sway,'YXZ');
    const seen=new Set();
    for(const p of players) {
      if(p.id===me.id)continue;seen.add(p.id);
      let e=this.actors.get(p.id);if(!e){const model=makeFighter(p.color),tag=makeTag(p);model.add(tag);this.scene.add(model);e={model,tag,stride:p.color*.75,kick:0};this.actors.set(p.id,e);}
      e.model.visible=p.hp>0;if(!e.model.visible)continue;
      e.model.position.set(p.x,p.y,p.z);e.model.rotation.y=p.yaw;
      e.tag.visible=this.camera.position.distanceTo(e.model.position)<30;
      const pace=Math.hypot(p.vx,p.vz);e.stride+=pace*dt*2.05;e.kick*=Math.exp(-16*dt);
      poseFighter(e.model,{weapon:p.weapon,pitch:p.pitch,moving:clamp(pace/5.9,0,1),stride:e.stride,recoil:e.kick});
    }
    for(const [id,e] of this.actors) if(!seen.has(id)){this.scene.remove(e.model);e.tag.material.map.dispose();e.tag.material.dispose();this.actors.delete(id);}
    for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.life-=dt;if(e.life<=0){this.scene.remove(e.obj);e.obj.material.dispose();e.obj.geometry.dispose();this.effects.splice(i,1);}else e.obj.material.opacity=e.life/e.max;}
    const gun=this.guns[slot],reload=reloadFrac>0?Math.sin(Math.PI*reloadFrac):0;
    this.guns.forEach((g,i)=>g.visible=i===slot);
    const bob=Math.sin(this.walk)*sway;
    this.gunRig.position.set(lerp(.235+Math.sin(this.walk*.5)*.012*sway,0,this.ads),lerp(-.225+bob*.012,-gun.userData.sightHeight,this.ads)-reload*.18,lerp(-.425,-.36,this.ads)+this.kick*.065);
    this.gunRig.rotation.set(this.kick*.12-reload*.41,lerp(.025,0,this.ads),reload*-.61+bob*.012);
    this.flash.visible=performance.now()<(this.flashUntil||0);
    if(this.flash.visible){this.flash.position.copy(gun.localToWorld(gun.userData.muzzle.clone()));this.flash.rotation.z=Math.random()*6;this.flash.scale.set(1,1,1.9);}
    this.renderer.autoClear=true;this.renderer.render(this.scene,this.camera);
    if(me.hp>0 && !(slot===2 && this.ads>.87)){this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.viewScene,this.gunCamera);this.renderer.autoClear=true;}
  }
}
