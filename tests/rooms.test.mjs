import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { WebSocket } from '../server/vendor/ws/wrapper.mjs';

test('room codes, quick matching, ready gates, authoritative input, late joins, capacity and host migration', {timeout:24000}, async t=>{
  const server=spawn(process.execPath,[fileURLToPath(new URL('../server/server.mjs',import.meta.url))],{env:{...process.env,HOST:'127.0.0.1',PORT:'0'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  const clients=[];
  t.after(()=>{for(const c of clients)c.ws.terminate();server.kill();});
  const [line]=await once(server.stdout,'data'), port=String(line).match(/localhost:(\d+)/)[1];
  async function client(){
    const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`),queue=[];
    const c={ws,send:m=>ws.send(JSON.stringify(m)),wait:async predicate=>{
      const end=Date.now()+5000;
      do{const index=queue.findIndex(predicate);if(index>=0)return queue.splice(index,1)[0];await new Promise(r=>setTimeout(r,6));}while(Date.now()<end);
      throw Error('Missing expected server message');
    }};
    ws.on('message',b=>queue.push(JSON.parse(b)));clients.push(c);
    c.id=(await c.wait(m=>m.t==='welcome')).id;return c;
  }
  const enter=async(c,mode,extra={})=>{c.send({t:'enter',mode,name:'Pilot '+clients.indexOf(c),...extra});return (await c.wait(m=>m.t==='room' && m.room.members.some(p=>p.id===c.id))).room;};
  const a=await client(),b=await client(),q=await client();
  const privateRoom=await enter(a,'create',{public:false});
  const publicRoom=await enter(q,'quick');
  assert.notEqual(privateRoom.code,publicRoom.code);assert.equal(publicRoom.public,true);
  await enter(b,'join',{code:privateRoom.code.toLowerCase()});
  b.send({t:'start'});assert.match((await b.wait(m=>m.t==='error')).message,/host/);
  a.send({t:'start'});assert.match((await a.wait(m=>m.t==='error')).message,/ready/);
  a.send({t:'options',fill:true,difficulty:2});
  b.send({t:'ready',ready:true});a.send({t:'ready',ready:true});
  await a.wait(m=>m.t==='room' && m.room.fill && m.room.members.every(p=>p.ready));
  a.send({t:'start'});const s=(await a.wait(m=>m.t==='start')).snap;
  assert.equal(s.players.length,8);assert.equal(s.players.filter(p=>p.bot).length,6);
  a.send({t:'input',seq:1,f:999,s:10,yaw:0,pitch:99,slot:3,fire:true,x:99999,hp:99999,score:99999});
  const update=(await b.wait(m=>m.t==='snapshot' && m.snap.players.some(p=>p.id===a.id && p.ack===1))).snap;
  const before=s.players.find(p=>p.id===a.id),after=update.players.find(p=>p.id===a.id);
  assert.ok(Math.hypot(after.x-before.x,after.z-before.z)<1);assert.equal(after.hp,100);assert.equal(after.score,0);assert.ok(after.pitch<1.5);assert.equal(after.weapon,3);
  const late=await client();await enter(late,'join',{code:privateRoom.code});const lateSnap=(await late.wait(m=>m.t==='start')).snap;
  assert.equal(lateSnap.players.length,8);assert.equal(lateSnap.players.filter(p=>p.bot).length,5);
  a.ws.terminate();await b.wait(m=>m.t==='room' && m.room.host===b.id);
  const refilled=(await b.wait(m=>m.t==='snapshot' && m.snap.players.every(p=>p.id!==a.id))).snap;
  assert.equal(refilled.players.length,8);assert.equal(refilled.players.filter(p=>p.bot).length,6);
  for(let i=1;i<8;i++){const p=await client();assert.equal((await enter(p,'quick')).code,publicRoom.code);}
  const ninth=await client();ninth.send({t:'enter',mode:'join',name:'Ninth',code:publicRoom.code});
  assert.match((await ninth.wait(m=>m.t==='error')).message,/full/);
  assert.notEqual((await enter(ninth,'quick')).code,publicRoom.code);
});

