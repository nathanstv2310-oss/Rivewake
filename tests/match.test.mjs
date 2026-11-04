import test from 'node:test';

test('slide gains momentum, respects cover and cannot repeat while held',()=>{
  const game=new Match(), p=game.add('test','Pilot');
  Object.assign(p,{x:6,y:0,z:4,yaw:0});
  const right={...emptyInput(p),s:1};
  for(let i=0;i<5;i++)movePlayer(p,right);
  movePlayer(p,{...right,slide:true});
  assert.ok(p.slideLeft>0 && p.vx>9);
  assert.equal(game.snapshot().players[0].slideLeft,p.slideLeft);
  for(let i=0;i<60;i++)movePlayer(p,{...right,slide:true});
  assert.equal(p.slideLeft,0);assert.ok(p.x<9.7);
});
import assert from 'node:assert/strict';
import { Match } from '../dist/match.mjs';
import { ARENA } from '../dist/arena.mjs';
import { STEP, EYE, movePlayer, emptyInput, WEAPONS, wallDistance } from '../dist/rules.mjs';

test('buildings stop movement and bullets; all four ramps connect to their rooftops',()=>{
  const g=new Match(),p=g.add('p','Pilot');Object.assign(p,{x:7,y:0,z:4,yaw:0});
  for(let i=0;i<90;i++)movePlayer(p,{...emptyInput(p),s:1});
  assert.ok(p.x<9.7 && p.x>9.35);
  assert.equal(wallDistance({x:7,y:EYE,z:4},{x:1,y:0,z:0},40),3);
  for(const r of ARENA.ramps){
    const direction=r.dir==='+z'?1:-1;
    Object.assign(p,{x:r.x,z:r.z-direction*(r.d/2+.8),y:0,vx:0,vz:0,vy:0,yaw:direction>0?Math.PI:0,grounded:true});
    for(let i=0;i<64;i++)movePlayer(p,{...emptyInput(p),f:1});
    assert.ok(Math.abs(p.y-r.h)<.02,`roof reached via ${r.x},${r.z}`);
  }
  const y=p.y;movePlayer(p,{...emptyInput(p),jump:true});assert.ok(p.y>y && !p.grounded);
});

test('headshot score, deaths, ammunition, reloads and automatic respawn',()=>{
  const g=new Match(),p=g.add('a','Copper'),q=g.add('b','Slate');
  Object.assign(p,{x:-6,y:0,z:23.1,yaw:-Math.PI/2,pitch:0,weapon:2,ads:true,nextShot:0,shieldUntil:0});
  Object.assign(q,{x:0,y:0,z:23.1,shieldUntil:0});
  g.fire(p,0);
  assert.equal(q.hp,0);assert.equal(q.deaths,1);assert.equal(p.kills,1);assert.equal(p.score,125);assert.equal(p.ammo[2],4);
  assert.ok(g.events.some(e=>e.type==='hit' && e.head));
  const input=new Map([[p.id,{...emptyInput(p),reload:true}]]);g.tick(input);
  assert.ok(p.reloadTo>g.time+2);
  for(let i=0;i<90;i++)g.tick();
  assert.equal(q.hp,100);assert.equal(q.life,2);assert.equal(q.deaths,1);assert.equal(p.ammo[2],WEAPONS[2].mag);assert.equal(p.reserve[2],WEAPONS[2].reserve-1);
});

test('rewind interpolates prior positions, caps age, and excludes a previous life',()=>{
  const g=new Match(),p=g.add('a','Pilot');Object.assign(p,{x:-7,y:0,z:23,yaw:-Math.PI/2});
  for(let i=0;i<14;i++)g.tick(new Map([[p.id,{...emptyInput(p),f:1}]]));
  const pose=g.pastPose(p,.1);assert.ok(pose.x<p.x);assert.deepEqual(g.pastPose(p,50),g.pastPose(p,.2));
  g.spawn(p);assert.equal(g.pastPose(p,.1),null);
});

test('a five-minute match ends once and bots fight, move and respawn at every difficulty',()=>{
  for(let level=0;level<3;level++){
    const g=new Match(level);for(let i=0;i<6;i++)g.add('b'+i,'Bot '+i,true,i);
    for(let i=0;i<Math.round(300/STEP);i++){g.tick();g.events.length=0;}
    const s=g.snapshot();assert.equal(s.finished,true);assert.equal(s.remaining,0);
    const k=s.players.reduce((a,p)=>a+p.kills,0),d=s.players.reduce((a,p)=>a+p.deaths,0);assert.ok(k>10);assert.equal(k,d);
    assert.ok(s.players.every(p=>Object.values(p).every(v=>typeof v!=='number'||Number.isFinite(v))));
    g.tick();assert.deepEqual(g.snapshot(),s);
  }
});

