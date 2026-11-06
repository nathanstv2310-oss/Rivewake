import { arenaFor,mapAt,ROTATION_SECONDS,ROTATION } from './maps.mjs';
import { ABILITIES,PICKUP_RESPAWN,hasAbility } from './abilities.mjs';
import { STEP, MATCH_SECONDS, WEAPONS, EYE, clamp, lerp, angleDelta, emptyInput, movePlayer, wallDistance, fighterHit, sight } from './rules.mjs';

const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function nearestNode(p) {
  let best=0, cost=Infinity;
  arenaFor(p.mapId).nodes.forEach((n,i)=>{ const d=(p.x-n.x)**2+(p.z-n.z)**2+5*(p.y-n.y)**2; if(d<cost){cost=d;best=i;} });
  return best;
}
function route(start, goal, arena) {
  const graph=arena.graph;
  const queue=[start], parent=new Map([[start,-1]]);
  for(let i=0;i<queue.length && !parent.has(goal);i++) {
    for(const next of graph[queue[i]]) if(!parent.has(next)){ parent.set(next,queue[i]); queue.push(next); }
  }
  const path=[];
  if(parent.has(goal)) for(let n=goal;n!==-1;n=parent.get(n)) path.push(arena.nodes[n]);
  return path.reverse();
}

function botInput(world,p) {
  const ai=p.brain, now=world.time, level=world.difficulty;
  const input=emptyInput(p);
  if(now>=ai.think) {
    ai.think=now+.24+Math.random()*.18;
    let best=Infinity, target=null;
    for(const foe of world.players.values()) {
      if(foe===p || foe.hp<=0 || foe.shieldUntil>now) continue;
      const d=distance(p,foe);
      if(d<best && d<55 && sight(p,foe)){target=foe;best=d;}
    }
    if(target?.id!==ai.target) ai.trigger=now+[1.2,.85,.55][level];
    ai.target=target?.id;
    ai.error=(Math.random()-.5)*[.23,.14,.085][level];
    ai.lift=(Math.random()-.52)*[.18,.12,.075][level];
    if(!target && (!ai.path?.length || now>=ai.repath)) {
      const foes=[...world.players.values()].filter(q=>q!==p && q.hp>0).sort((a,b)=>distance(p,a)-distance(p,b));
      const dest=foes.length && Math.random()<.84 ? nearestNode(foes[0]) : Math.floor(Math.random()*world.arena.nodes.length);
      ai.path=route(nearestNode(p),dest,world.arena); ai.repath=now+2.3+Math.random();
    }
  }
  const enemy=world.players.get(ai.target);
  if(enemy && enemy.hp>0) {
    const dx=enemy.x-p.x, dz=enemy.z-p.z, range=Math.hypot(dx,dz);
    const yaw=Math.atan2(-dx,-dz)+ai.error;
    const pitch=Math.atan2(enemy.y+1.19-p.y-EYE,Math.max(.1,range))+ai.lift;
    input.yaw=p.yaw+clamp(angleDelta(p.yaw,yaw),-.105,.105);
    input.pitch=lerp(p.pitch,pitch,.16);
    const desired=[13,6.5,20,11][p.weapon];
    input.f=range>desired? .86 : range<desired*.48? -.48 : .08;
    input.s=.6*Math.sin(now*1.7+ai.phase);
    input.ads=range>12 && p.weapon!==1;
    input.fire=now>ai.trigger && Math.abs(angleDelta(input.yaw,yaw))<.13 && Math.abs(input.pitch-pitch)<.105;
    if(p.weapon===0 && (now+ai.phase)%[1.7,1.45,1.2][level] < [.95,.72,.48][level]) input.fire=false;
    ai.path=[];
  } else {
    while(ai.path?.length && distance(p,ai.path[0])<.68) ai.path.shift();
    if(ai.path?.length) {
      const node=ai.path[0], aim=Math.atan2(p.x-node.x,p.z-node.z);
      input.yaw=p.yaw+clamp(angleDelta(p.yaw,aim),-.24,.24);
      input.f=clamp(1-Math.abs(angleDelta(input.yaw,aim)),0,1);
      input.sprint=true;
    }
    input.pitch=p.pitch*.83;
  }
  input.reload=p.ammo[p.weapon]===0 || (!enemy && p.ammo[p.weapon]<WEAPONS[p.weapon].mag*.42);
  if(p.ammo[p.weapon]+p.reserve[p.weapon]===0) {
    const next=p.ammo.findIndex((n,i)=>n+p.reserve[i]>0); if(next>=0) input.slot=next;
  }
  return input;
}

export class Match {
  constructor(difficulty=1,startMap=mapAt(0)) {
    this.mapId=startMap;this.arena=arenaFor(startMap);this.rotates=true;this.rotationStart=Math.max(0,ROTATION.indexOf(startMap));this.pickupReady={};
    this.players=new Map(); this.time=0; this.finished=false; this.events=[]; this.history=[];
    this.difficulty=clamp(difficulty|0,0,2); this.eventId=0;
  }
  event(type,data) { this.events.push({type,...data,id:++this.eventId}); }
  add(id,name,bot=false,color=0) {
    const p={id,name,bot,color,kills:0,deaths:0,score:0,life:0,hp:0,lastSpawn:-1,ack:0};
    this.players.set(id,p); this.spawn(p); return p;
  }
  spawn(p) {
    let index=0, best=-Infinity;
    this.arena.spawns.forEach((s,i)=>{
      let nearest=70;
      for(const q of this.players.values()) if(q!==p && q.hp>0) nearest=Math.min(nearest,distance(s,q));
      const weight=nearest+Math.random()*8-(i===p.lastSpawn?12:0);
      if(weight>best){best=weight;index=i;}
    });
    Object.assign(p,this.arena.spawns[index],{mapId:this.mapId,effects:{},padCooldown:0,padLaunch:0,hp:100,life:p.life+1,lastSpawn:index,pitch:0,vx:0,vy:0,vz:0,grounded:true,slideLatch:false,slideLeft:0,slideCooldown:0,slideX:0,slideZ:0,jumpLatch:false,
      weapon:p.bot ? (p.color+1)%4 : p.weapon??0, ammo:WEAPONS.map(w=>w.mag),reserve:WEAPONS.map(w=>w.reserve),
      reloadTo:0,nextShot:this.time+.23,bloom:0,ads:false,sprinting:false,respawnAt:0,shieldUntil:this.time+1.15,
      brain:{think:0,trigger:this.time+.8,phase:Math.random()*12,path:[],repath:0}});
    this.event('spawn',{who:p.id,life:p.life});
  }
  pastPose(p,seconds) {
    if(seconds<=0 || this.history.length===0) return p;
    const t=this.time-clamp(seconds,0,.2);
    let a, b;
    for(const frame of this.history) {
      const pose=frame.actors.get(p.id);
      if(!pose || pose.life!==p.life) continue;
      if(frame.t<=t) a={t:frame.t,pose}; else {b={t:frame.t,pose};break;}
    }
    // A target who did not exist at the requested time cannot be hit in a previous life.
    if(!a) return null;
    if(!b) b={t:this.time,pose:p};
    const f=clamp((t-a.t)/Math.max(.001,b.t-a.t),0,1);
    return {slideLeft:(f<.5?a.pose:b.pose).slideLeft,x:lerp(a.pose.x,b.pose.x,f),y:lerp(a.pose.y,b.pose.y,f),z:lerp(a.pose.z,b.pose.z,f)};
  }
  fire(p,rewind) {
    const w=WEAPONS[p.weapon], now=this.time;
    if(now+.0001<p.nextShot || p.reloadTo || !p.ammo[p.weapon]) return;
    p.ammo[p.weapon]--; p.nextShot=Math.max(now-STEP*.5,p.nextShot)+w.delay*(hasAbility(p,'spray')?.65:1);
    p.shieldUntil=0;
    const o={x:p.x,y:p.y+EYE-(p.slideLeft>0?.32:0),z:p.z};
    const spread=(hasAbility(p,'spray')?.78:1)*w.spread*(p.ads?w.aim:1)*(p.grounded?1:2.4)*(1+Math.hypot(p.vx,p.vz)*.055)+p.bloom;
    p.bloom=Math.min(.032,p.bloom+w.kick*(p.ads?.1:.21));
    const candidates=[];
    for(const foe of this.players.values()) {
      if(foe===p || foe.hp<=0 || foe.shieldUntil>now) continue;
      const pose=this.pastPose(foe,rewind); if(pose) candidates.push({foe,pose});
    }
    const hits=new Map(), ends=[];
    for(let n=0;n<w.pellets;n++) {
      const r=Math.sqrt(Math.random())*spread, a=Math.random()*2*Math.PI;
      const yaw=p.yaw+Math.cos(a)*r, pitch=p.pitch+Math.sin(a)*r;
      const d={x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};
      let end=wallDistance(o,d,w.range,this.mapId), target, head=false;
      for(const {foe,pose} of candidates) {
        const hit=fighterHit(o,d,pose,end);
        if(hit && hit.t<end){end=hit.t;target=foe;head=hit.head;}
      }
      ends.push([+(o.x+d.x*end).toFixed(2),+(o.y+d.y*end).toFixed(2),+(o.z+d.z*end).toFixed(2)]);
      if(target) {
        const h=hits.get(target)||{damage:0,head:false};
        const falloff=p.weapon===1?clamp(1-(end-8)*.027,.46,1):1;
        h.damage+=Math.round(w.damage*(head?w.head:1)*falloff*(p.bot?[.42,.5,.6][this.difficulty]:1)); h.head ||= head; hits.set(target,h);
      }
    }
    this.event('shot',{who:p.id,weapon:p.weapon,origin:[o.x,o.y,o.z],ends});
    for(const [foe,hit] of hits) {
      const damage=Math.min(foe.hp,hit.damage); foe.hp-=damage;
      this.event('hit',{who:p.id,target:foe.id,damage,head:hit.head});
      if(foe.hp===0) {
        foe.deaths++; p.kills++; p.score+=hit.head?125:100;
        foe.respawnAt=now+2.8; foe.reloadTo=0; foe.vx=foe.vz=0;
        this.event('kill',{who:p.id,killer:p.name,killerBot:p.bot,target:foe.id,victim:foe.name,victimBot:foe.bot,head:hit.head,weapon:p.weapon});
      }
    }
  }
  tick(inputs=new Map(), rewindById=new Map()) {
    if(this.finished) return;
    this.time+=STEP;
    if(!this.rotates && this.time>=MATCH_SECONDS-1e-7) {this.time=MATCH_SECONDS;this.finished=true;return;}
    const nextMap=ROTATION[(this.rotationStart+Math.floor((this.time+1e-7)/ROTATION_SECONDS))%ROTATION.length];
    if(this.rotates && this.mapId!==nextMap){
      this.mapId=nextMap;this.arena=arenaFor(nextMap);
      this.history=[];this.events=[];this.pickupReady={};
      for(const p of this.players.values())p.hp=0;
      for(const p of this.players.values())this.spawn(p);
      return;
    }
    const actions=[];
    for(const p of this.players.values()) {
      if(p.hp<=0) { if(this.time>=p.respawnAt) this.spawn(p); continue; }
      const i=p.bot?botInput(this,p):(inputs.get(p.id) || emptyInput(p));
      if(p.weapon!==i.slot) {p.weapon=i.slot;p.reloadTo=0;p.nextShot=Math.max(p.nextShot,this.time+.35);p.bloom=0;}
      p.bloom=Math.max(0,p.bloom-STEP*.039);
      if(p.reloadTo && this.time>=p.reloadTo) {
        const n=Math.min(WEAPONS[p.weapon].mag-p.ammo[p.weapon],p.reserve[p.weapon]);
        p.ammo[p.weapon]+=n;p.reserve[p.weapon]-=n;p.reloadTo=0;
      }
      if((i.reload || (i.fire && !p.ammo[p.weapon])) && !p.reloadTo && p.ammo[p.weapon]<WEAPONS[p.weapon].mag && p.reserve[p.weapon]>0) {
        p.reloadTo=this.time+WEAPONS[p.weapon].reload;this.event('reload',{who:p.id,weapon:p.weapon});
      }
      const previousLaunch=p.padLaunch;
      movePlayer(p,i);
      if(p.padLaunch!==previousLaunch)this.event('launch',{who:p.id});
      for(const pickup of this.arena.pickups){
        if((this.pickupReady[pickup.id]||0)>this.time || Math.abs(p.y-pickup.y)>.9 || Math.hypot(p.x-pickup.x,p.z-pickup.z)>1.15)continue;
        p.effects[pickup.type]=ABILITIES[pickup.type].duration;
        this.pickupReady[pickup.id]=this.time+PICKUP_RESPAWN;
        this.event('pickup',{who:p.id,ability:pickup.type});
      }
      if(i.fire && !p.sprinting) actions.push(p);
    }
    for(const p of actions) if(p.hp>0) this.fire(p,rewindById.get(p.id)||0);
    const actors=new Map();
    for(const p of this.players.values()) if(p.hp>0) actors.set(p.id,{x:p.x,y:p.y,z:p.z,slideLeft:p.slideLeft,life:p.life});
    this.history.push({t:this.time,actors}); if(this.history.length>10) this.history.shift();
  }
  snapshot() {
    const players=[];
    for(const p of this.players.values()) {
      const {id,name,bot,color,hp,weapon,kills,deaths,score,life,grounded,slideLatch,slideLeft,slideCooldown,slideX,slideZ,jumpLatch,sprinting,ads,ack,respawnAt,reloadTo,shieldUntil}=p;
      const out={mapId:this.mapId,effects:{...p.effects},padCooldown:p.padCooldown,padLaunch:p.padLaunch,id,name,bot,color,hp,weapon,kills,deaths,score,life,grounded,slideLatch,slideLeft,slideCooldown,slideX,slideZ,jumpLatch,sprinting,ads,ack,respawnAt,reloadTo,shieldUntil,mag:p.ammo[weapon],reserve:p.reserve[weapon]};
      for(const key of ['x','y','z','vx','vy','vz','yaw','pitch']) out[key]=+p[key].toFixed(4);
      players.push(out);
    }
    const round=Math.floor((this.time+1e-7)/ROTATION_SECONDS),nextMapAt=(round+1)*ROTATION_SECONDS;
    return {mapId:this.mapId,nextMapId:ROTATION[(this.rotationStart+round+1)%ROTATION.length],nextMapAt,round:round+1,pickups:this.arena.pickups.map(p=>({...p,readyAt:this.pickupReady[p.id]||0})),time:this.time,remaining:this.rotates?nextMapAt-this.time:Math.max(0,MATCH_SECONDS-this.time),finished:this.finished,players};
  }
}
