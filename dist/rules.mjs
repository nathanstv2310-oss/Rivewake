// Shared by the browser and the authoritative server. Coordinates are metres, Y is up.
import { ARENA } from './arena.mjs';

export const STEP = 1 / 30;
export const MATCH_SECONDS = 300;
export const EYE = 1.57;
const HEIGHT = 1.84, RADIUS = 0.32, STEP_UP = 0.32;
export const WEAPONS = [
  { name: 'Rivet AR', type: 'Assault rifle', tag: 'AR–30', damage: 25, head: 1.6, mag: 30, reserve: 150, reload: 1.65, delay: .105, spread: .011, aim: .24, kick: .021, pellets: 1, range: 85, zoom: 56 },
  { name: 'Kiln Breaker', type: 'Shotgun', tag: 'SG–06', damage: 13, head: 1.4, mag: 6, reserve: 36, reload: 2.15, delay: .78, spread: .071, aim: .75, kick: .076, pellets: 9, range: 32, zoom: 62 },
  { name: 'Longwave', type: 'Sniper rifle', tag: 'SR–05', damage: 84, head: 1.8, mag: 5, reserve: 25, reload: 2.45, delay: 1.1, spread: .049, aim: .012, kick: .056, pellets: 1, range: 130, zoom: 24 },
  { name: 'Pilot Nine', type: 'Pistol', tag: 'P–12', damage: 34, head: 1.55, mag: 12, reserve: 84, reload: 1.12, delay: .245, spread: .019, aim: .31, kick: .029, pellets: 1, range: 62, zoom: 61 },
];
export const BOT_NAMES = ['Sprocket', 'Lumen', 'Circuit', 'Gasket', 'Mica', 'Piston', 'Relay', 'Volt'];
export const DIFFICULTIES = ['Rookie', 'Regular', 'Veteran'];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b-a)*t;
export const angleDelta = (a, b) => Math.atan2(Math.sin(b-a), Math.cos(b-a));
export const emptyInput = (p = {}) => ({f:0, s:0, yaw:p.yaw || 0, pitch:p.pitch || 0, fire:false, ads:false, jump:false, sprint:false, reload:false, slot:p.weapon || 0});
const shapes = [...ARENA.boxes, ...ARENA.ramps].map(b => ({...b, x0:b.x-b.w/2, x1:b.x+b.w/2, z0:b.z-b.d/2, z1:b.z+b.d/2, top:b.y+b.h}));
const slopeY = (b,x,z) => b.y + b.h * clamp(b.dir === '+x' ? (x-b.x0)/b.w : b.dir === '-x' ? (b.x1-x)/b.w : b.dir === '+z' ? (z-b.z0)/b.d : (b.z1-z)/b.d, 0, 1);

function touches(b, x, z) {
  const dx = x - clamp(x,b.x0,b.x1), dz = z - clamp(z,b.z0,b.z1);
  return dx*dx + dz*dz < RADIUS*RADIUS - 1e-7;
}
function canStandAt(p, x, z, stepUp) {
  for (const b of shapes) {
    if (p.y+HEIGHT <= b.y+.001 || b.top <= p.y+stepUp+.001 || !touches(b,x,z)) continue;
    if (!b.dir || slopeY(b,x,z) > p.y+stepUp+.001) return false;
  }
  return true;
}

// Fixed-step kinematics. Replayed by the owning client after each acknowledgement.
export function movePlayer(p, input, dt = STEP) {
  p.yaw = input.yaw; p.pitch = input.pitch;
  const length = Math.max(1, Math.hypot(input.f,input.s));
  p.sprinting = !!(input.sprint && input.f > .1 && !input.ads && !input.fire);
  p.ads = !!(input.ads && !p.sprinting);
  const speed = p.sprinting ? 8.6 : p.ads ? 3.55 : 5.95;
  const sn = Math.sin(p.yaw), cs = Math.cos(p.yaw);
  const vx = (input.s*cs-input.f*sn)*speed/length, vz = (-input.f*cs-input.s*sn)*speed/length;
  const accel = (p.grounded ? 51 : 19)*dt;
  p.vx += clamp(vx-p.vx,-accel,accel); p.vz += clamp(vz-p.vz,-accel,accel);
  p.slideCooldown=Math.max(0,(p.slideCooldown||0)-dt);
  p.slideLeft=Math.max(0,(p.slideLeft||0)-dt);
  if(input.slide && !p.slideLatch && !p.slideCooldown && p.grounded && !input.jump){
    const magnitude=Math.hypot(p.vx,p.vz);
    if(magnitude>2){
      p.slideX=p.vx/magnitude;p.slideZ=p.vz/magnitude;
      p.slideLeft=.56;p.slideCooldown=1.25;
    }
  }
  p.slideLatch=!!input.slide;
  if(input.jump || !p.grounded)p.slideLeft=0;
  if(p.slideLeft>0){
    const momentum=5.8+8*p.slideLeft;
    p.vx=p.slideX*momentum;p.vz=p.slideZ*momentum;p.sprinting=false;
  }
  const bounds = ARENA.bounds, stepUp = p.grounded ? STEP_UP : .015;
  const x = clamp(p.x+p.vx*dt,bounds.minX+RADIUS,bounds.maxX-RADIUS);
  if (canStandAt(p,x,p.z,stepUp)) p.x=x; else p.vx=0;
  const z = clamp(p.z+p.vz*dt,bounds.minZ+RADIUS,bounds.maxZ-RADIUS);
  if (canStandAt(p,p.x,z,stepUp)) p.z=z; else p.vz=0;
  let floor = 0, ceiling = Infinity;
  for (const b of shapes) {
    if (!touches(b,p.x,p.z)) continue;
    const top = b.dir ? slopeY(b,p.x,p.z) : b.top;
    if (top <= p.y+stepUp+.001) floor=Math.max(floor,top);
    if (b.y >= p.y+HEIGHT-.002) ceiling=Math.min(ceiling,b.y);
  }
  if (input.jump && !p.jumpLatch && p.grounded) { p.y=Math.max(p.y,floor); p.vy=8.0; p.grounded=false; }
  p.jumpLatch=!!input.jump;
  const follow = p.grounded && p.y-floor <= STEP_UP+.02;
  p.vy -= 23.4*dt;
  p.y += p.vy*dt;
  if (p.y+HEIGHT > ceiling && p.vy>0) { p.y=ceiling-HEIGHT; p.vy=0; }
  if (p.y <= floor || follow) { p.y=floor; p.vy=0; p.grounded=true; } else p.grounded=false;
}

// Ray/slab intersection, returning entry and exit. The slope adds one half-space to each ramp.
function interval(o, d, x0, x1, y0, y1, z0, z1, limit) {
  let near=0, far=limit;
  for (let k=0;k<3;k++) {
    const origin=k===0?o.x:k===1?o.y:o.z, dir=k===0?d.x:k===1?d.y:d.z;
    const lo=k===0?x0:k===1?y0:z0, hi=k===0?x1:k===1?y1:z1;
    if (Math.abs(dir)<1e-8) { if(origin<lo || origin>hi) return null; continue; }
    let a=(lo-origin)/dir, b=(hi-origin)/dir;
    if(a>b) [a,b]=[b,a]; near=Math.max(near,a); far=Math.min(far,b);
    if(near>far) return null;
  }
  return [near,far];
}
export function wallDistance(o, d, limit) {
  let closest = d.y < -.00001 ? Math.min(limit, -o.y/d.y) : limit;
  for(const b of shapes) {
    const span=interval(o,d,b.x0,b.x1,b.y,b.top,b.z0,b.z1,closest);
    if(!span) continue;
    let t=span[0];
    if(b.dir) {
      const x=o.x+d.x*t, z=o.z+d.z*t, above=o.y+d.y*t-slopeY(b,x,z);
      if(above>.0001) {
        const along=b.dir.endsWith('x')?d.x/b.w:d.z/b.d;
        const rate=d.y-b.h*along*(b.dir[0]==='+'?1:-1);
        if(rate>=0) continue;
        t-=above/rate; if(t>span[1]) continue;
      }
    }
    closest=Math.min(closest,t);
  }
  return closest;
}
export function fighterHit(o,d,p,limit) {
  const drop=p.slideLeft>0?.32:0;
  const body=interval(o,d,p.x-.32,p.x+.32,p.y+.035,p.y+1.39-drop,p.z-.32,p.z+.32,limit);
  const head=interval(o,d,p.x-.245,p.x+.245,p.y+1.39-drop,p.y+1.84-drop,p.z-.245,p.z+.245,limit);
  if(head && (!body || head[0]<=body[0])) return {t:head[0],head:true};
  return body ? {t:body[0],head:false} : null;
}
export function sight(a,b,height=1.12) {
  const o={x:a.x,y:a.y+EYE,z:a.z}, x=b.x-o.x,y=b.y+height-o.y,z=b.z-o.z;
  const len=Math.hypot(x,y,z)||.001;
  return wallDistance(o,{x:x/len,y:y/len,z:z/len},len)>=len-.02;
}
export function rankPlayers(players) {
  return [...players].sort((a,b)=>b.score-a.score || b.kills-a.kills || a.deaths-b.deaths || a.name.localeCompare(b.name));
}
