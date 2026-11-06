import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../dist/match.mjs';
import {ClientMotion} from '../dist/network.mjs';
import {arenaFor,ROTATION} from '../dist/maps.mjs';
import {STEP,EYE,WEAPONS,emptyInput,movePlayer,assistedLook} from '../dist/rules.mjs';
import {spring,weaponTransition} from '../dist/animation.mjs';
import {makeFighter,poseFighter} from '../dist/models.mjs';

test('five-minute rotations continue around all four arenas and reset stale prediction',()=>{
  const game=new Match(),other=new Match(),p=game.add('p','Pilot');
  p.score=125;p.kills=1;p.deaths=2;
  const motion=new ClientMotion(game.snapshot(),p.id);
  for(const [time,id] of [[300,'desert'],[600,'village'],[900,'depot'],[1200,'mansion']]){
    const old=game.mapId,life=p.life;game.time=time-2*STEP;
    game.tick();assert.equal(game.mapId,old);
    p.effects.speed=15;motion.pending.push({seq:999});game.tick();
    const snap=game.snapshot();motion.accept(snap);
    assert.equal(game.mapId,id);assert.equal(p.life,life+1);assert.equal(snap.finished,false);
    assert.equal(snap.nextMapAt,time+300);assert.ok(Math.abs(snap.remaining-300)<1e-6);
    assert.deepEqual([p.score,p.kills,p.deaths],[125,1,2]);assert.deepEqual(p.effects,{});
    assert.equal(motion.pending.length,0);assert.equal(motion.frames.length,1);
    assert.equal(other.mapId,'mansion');assert.equal(game.history.length,0);
  }
});

test('every arena has four pickup types, usable pads, safe spawns and connected paths',()=>{
  for(const id of ROTATION){
    const a=arenaFor(id);
    assert.equal(new Set(a.pickups.map(p=>p.type)).size,4,id);
    assert.ok(a.pads.length>=4);assert.ok(a.spawns.length>=8);
    for(const p of [...a.spawns,...a.pickups,...a.pads]){
      assert.ok(!a.boxes.some(b=>b.y<p.y+1.84 && b.y+b.h>p.y+.05 && Math.abs(b.x-p.x)<b.w/2+.32 && Math.abs(b.z-p.z)<b.d/2+.32),`${id} blocked point ${JSON.stringify(p)}`);
    }
    const seen=new Set([0]),queue=[0];for(const i of queue)for(const j of a.graph[i])if(!seen.has(j)){seen.add(j);queue.push(j);}
    assert.equal(seen.size,a.nodes.length,id);
  }
  const mansion=arenaFor('mansion'),depot=arenaFor('depot');
  assert.equal(mansion.bounds.maxX-mansion.bounds.minX,2*(depot.bounds.maxX-depot.bounds.minX));
  assert.equal(mansion.bounds.maxZ-mansion.bounds.minZ,2*(depot.bounds.maxZ-depot.bounds.minZ));
  assert.ok(mansion.nodes.some(n=>n.y===4.6));
});

test('mansion stairs reach the second floor and pads launch through its open atrium',()=>{
  const game=new Match(),p=game.add('p','Pilot');
  for(const r of game.arena.ramps){
    Object.assign(p,{x:r.x,z:r.z+r.d/2+.7,y:0,vx:0,vy:0,vz:0,yaw:0,grounded:true});
    const input={...emptyInput(p),f:1};
    const steps=Math.ceil((r.d+2)/5.95/STEP)+5;
    for(let i=0;i<steps;i++)movePlayer(p,input);
    assert.ok(Math.abs(p.y-r.h)<.02,`ramp ${r.x} ${r.z} landed at ${p.y}`);
  }
  Object.assign(p,{x:-6,y:0,z:0,vx:0,vy:0,vz:0,padCooldown:0,grounded:true});
  movePlayer(p,emptyInput(p));assert.ok(p.vy>17);assert.equal(p.padLaunch,1);
  let peak=p.y;
  for(let i=0;i<30;i++){movePlayer(p,{...emptyInput(p),s:-1,yaw:0});peak=Math.max(peak,p.y);}
  assert.ok(peak>6.5,'pad reaches gallery height through open atrium');
  // Drift west while descending and land on the real gallery floor.
  for(let i=0;i<35;i++)movePlayer(p,emptyInput(p));
  assert.ok(Math.abs(p.y-4.6)<.02,`gallery landing ${p.y}`);
});

test('pickups collect once, expire, respawn and replicate without mutating snapshots',()=>{
  const game=new Match(),p=game.add('p','Pilot'),q=game.add('q','Guest');
  const pickup=game.arena.pickups[0];Object.assign(p,pickup);Object.assign(q,{x:55,z:45});
  game.tick();assert.equal(p.effects.speed,20);
  const snap=game.snapshot(),motion=new ClientMotion(snap,p.id);
  motion.input({send(){}},{...emptyInput(p),f:1});
  assert.equal(snap.players[0].effects.speed,20);assert.ok(motion.local.effects.speed<20);
  Object.assign(q,pickup);game.tick();assert.equal(q.effects.speed,undefined);
  Object.assign(p,{x:55,z:40});Object.assign(q,{x:55,z:45});
  for(let i=0;i<605;i++)game.tick();assert.equal(p.effects.speed,0);
  for(let i=0;i<120;i++)game.tick();Object.assign(q,pickup);game.tick();assert.equal(q.effects.speed,20);
});

test('speed, jump and spray give their advertised benefits',()=>{
  function pilot(effects={}){const g=new Match(1,'depot'),p=g.add('p','Pilot');return Object.assign(p,{x:0,y:0,z:23,yaw:Math.PI/2,effects});}
  const normal=pilot(),fast=pilot({speed:20});
  for(let i=0;i<30;i++)for(const p of [normal,fast])movePlayer(p,{...emptyInput(p),f:1});
  assert.ok(Math.abs(fast.x)>Math.abs(normal.x)*1.3);
  const jump=pilot({jump:20}),base=pilot();movePlayer(jump,{...emptyInput(jump),jump:true});movePlayer(base,{...emptyInput(base),jump:true});
  assert.ok(jump.vy>base.vy*1.5);
  const g=new Match(),p=g.add('p','Pilot');p.nextShot=0;g.fire(p,0);const delay=p.nextShot;
  p.nextShot=0;p.effects.spray=20;g.fire(p,0);assert.ok(p.nextShot<delay*.7);
});

test('weapon damage is reduced except sniper, and every bot weapon deals less',()=>{
  assert.deepEqual(WEAPONS.map(w=>w.damage),[18,9,84,24]);
  const previous=Math.random;Math.random=()=>0;
  try{for(let weapon=0;weapon<4;weapon++){
    const damages=[];
    for(const bot of [false,true]){
      const g=new Match(1,'depot'),p=g.add('p','Pilot',bot),q=g.add('q','Guest');
      Object.assign(p,{x:-6,y:0,z:23,yaw:-Math.PI/2,pitch:Math.atan2(1-EYE,6),weapon,ads:true,nextShot:0,shieldUntil:0});
      Object.assign(q,{x:0,y:0,z:23,shieldUntil:0});g.fire(p,0);damages.push(100-q.hp);
    }
    assert.ok(damages[0]>damages[1] && damages[1]>0,`${weapon}: ${damages}`);
  }}finally{Math.random=previous;}
});

test('aim assistance stays near the reticle and respects cover and expiration',()=>{
  const g=new Match(1,'depot'),p=g.add('p','Pilot'),q=g.add('q','Guest');
  Object.assign(p,{x:-6,y:0,z:23,effects:{assist:20}});Object.assign(q,{x:5,y:0,z:23,shieldUntil:0});
  const look={yaw:-Math.PI/2+.04,pitch:Math.atan2(1.1-EYE,11)};
  assert.ok(assistedLook(p,[q],look,true,.1).yaw<look.yaw);
  assert.deepEqual(assistedLook(p,[q],look,false,.1),look);
  p.effects.assist=0;assert.deepEqual(assistedLook(p,[q],look,true,.1),look);
  p.effects.assist=20;Object.assign(p,{x:7,z:4});Object.assign(q,{x:23,z:4});
  assert.deepEqual(assistedLook(p,[q],look,true,.1),look);
});

test('animation springs match across frame rates and weapon models swap only while lowered',()=>{
  const a={ads:0},b={ads:0};for(let i=0;i<30;i++)spring(a,'ads',1,22,1/30);for(let i=0;i<144;i++)spring(b,'ads',1,22,1/144);
  assert.ok(Math.abs(a.ads-b.ads)<1e-8);
  const state={};weaponTransition(state,0,0);const drop=weaponTransition(state,2,.1);assert.equal(state.displaySlot,0);assert.ok(drop>.7);
  assert.ok(weaponTransition(state,2,.05)>.99);assert.equal(state.displaySlot,2);
  assert.equal(weaponTransition(state,2,.3),0);
  const model=makeFighter(2);for(let i=0;i<120;i++)poseFighter(model,{weapon:2,stride:i*.1,moving:1,air:i<60?1:0,dt:1/60,time:i/60});
  model.traverse(o=>assert.ok([o.position.x,o.position.y,o.position.z,o.rotation.x,o.rotation.y,o.rotation.z].every(Number.isFinite)));
});
