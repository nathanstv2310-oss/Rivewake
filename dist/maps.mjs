import {ARENA} from './arena.mjs';
import {DESERT} from './desert.mjs';
import {VILLAGE} from './village.mjs';
import {MANSION} from './mansion.mjs';

export const ROTATION_SECONDS=300;
export const ROTATION=['mansion','desert','village','depot'];
const arenas={mansion:MANSION,depot:ARENA,desert:DESERT,village:VILLAGE};
export const arenaFor=id=>arenas[id]||ARENA;
export const mapAt=time=>ROTATION[Math.floor((time+1e-7)/ROTATION_SECONDS)%ROTATION.length];

// Ground lanes and ramp landings are sampled from the actual collision geometry.
function chart(arena){
  const {bounds,boxes,ramps}=arena, nodes=[],edges=[],grid=new Map(),spacing=4;
  const inside=(b,x,z,margin)=>Math.abs(x-b.x)<b.w/2+margin && Math.abs(z-b.z)<b.d/2+margin;
  const clear=(x,y,z)=>!boxes.some(b=>b.y+b.h>y+.04 && b.y<y+1.86 && inside(b,x,z,.46))
    && !ramps.some(r=>r.y+r.h>y+.04 && r.y<y+1.86 && inside(r,x,z,.30));
  const levels=[...new Set([0,...ramps.map(r=>r.y+r.h)])];
  function walkable(x,y,z){
    return clear(x,y,z) && (y===0 || boxes.some(b=>Math.abs(b.y+b.h-y)<.04 && inside(b,x,z,-.05)));
  }
  function corridor(a,b){
    const count=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.4);
    for(let i=1;i<count;i++){
      const f=i/count;
      if(!walkable(a.x+(b.x-a.x)*f,a.y,a.z+(b.z-a.z)*f))return false;
    }
    return true;
  }
  for(const y of levels)for(let x=Math.ceil((bounds.minX+1)/spacing)*spacing;x<bounds.maxX-1;x+=spacing){
    for(let z=Math.ceil((bounds.minZ+1)/spacing)*spacing;z<bounds.maxZ-1;z+=spacing){
      if(!walkable(x,y,z))continue;
      const a={x,y,z},id=nodes.push(a)-1;
      grid.set([x,y,z].join(),id);
      for(const [dx,dz] of [[-4,0],[0,-4],[-4,-4],[-4,4]]){
        const j=grid.get([x+dx,y,z+dz].join());
        if(j!==undefined && corridor(a,nodes[j]))edges.push([id,j]);
      }
    }
  }
  const regular=nodes.length;
  for(const r of ramps){
    const dx=r.dir.endsWith('x')?(r.dir[0]==='+'?1:-1):0;
    const dz=dx?0:(r.dir[0]==='+'?1:-1);
    const extent=(dx?r.w:r.d)/2+.65;
    const ends=[];
    for(const sign of [-1,1]){
      const a={x:r.x+sign*dx*extent,z:r.z+sign*dz*extent,y:r.y+(sign===1?r.h:0)};
      const id=nodes.push(a)-1;ends.push(id);
      for(let j=0;j<regular;j++){
        const b=nodes[j];
        if(Math.abs(a.y-b.y)<.04 && Math.hypot(a.x-b.x,a.z-b.z)<8 && corridor(a,b))edges.push([id,j]);
      }
    }
    const mid=nodes.push({x:r.x,y:r.y+r.h/2,z:r.z})-1;edges.push([ends[0],mid],[mid,ends[1]]);
  }
  const links=nodes.map(()=>[]);
  for(const [a,b] of edges){links[a].push(b);links[b].push(a);}
  let biggest=[];const visited=new Set();
  for(let i=0;i<nodes.length;i++){
    if(visited.has(i))continue;
    const list=[i];visited.add(i);
    for(let k=0;k<list.length;k++)for(const j of links[list[k]])if(!visited.has(j)){visited.add(j);list.push(j);}
    if(list.length>biggest.length)biggest=list;
  }
  const ids=new Map(biggest.map((n,i)=>[n,i]));
  arena.nodes=biggest.map(i=>nodes[i]);
  arena.edges=edges.filter(([a,b])=>ids.has(a)&&ids.has(b)).map(([a,b])=>[ids.get(a),ids.get(b)]);
  const eligible=arena.nodes.filter(n=>n.y===0 && Math.abs(n.x)<bounds.maxX-4 && Math.abs(n.z)<bounds.maxZ-4);
  const sites=[eligible[Math.floor(eligible.length/2)]];
  while(sites.length<16){
    let best,score=-1;
    for(const p of eligible){
      const nearest=Math.min(...sites.map(q=>(q.x-p.x)**2+(q.z-p.z)**2));
      if(nearest>score){score=nearest;best=p;}
    }
    sites.push(best);
  }
  arena.spawns=sites.map(p=>({...p,yaw:Math.atan2(p.x,p.z)}));
}
for(const id of ROTATION)if(id!=='depot')chart(arenas[id]);
for(const arena of Object.values(arenas)){
  arena.pickups=(arena.pickupSites||arena.spawns.slice(0,8)).map((p,i)=>({...p,id:'pickup'+i,type:['speed','spray','jump','assist'][i%4]}));
  const outdoor=arena.nodes.filter(n=>n.y===0 && !arena.boxes.some(b=>Math.abs(n.x-b.x)<b.w/2+1.3 && Math.abs(n.z-b.z)<b.d/2+1.3));
  arena.pads=(arena.pads||[0,.27,.55,.82].map(f=>outdoor[Math.floor(f*outdoor.length)])).map((p,i)=>({...p,id:'pad'+i,radius:1.25,force:18.5}));
  arena.graph=arena.nodes.map(()=>[]);
  for(const [a,b] of arena.edges){arena.graph[a].push(b);arena.graph[b].push(a);}
  arena.shapes=[...arena.boxes,...arena.ramps].map(b=>({...b,x0:b.x-b.w/2,x1:b.x+b.w/2,z0:b.z-b.d/2,z1:b.z+b.d/2,top:b.y+b.h}));
}
