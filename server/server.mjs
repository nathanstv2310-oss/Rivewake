import http from 'node:http';
import { randomInt, randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { WebSocketServer, WebSocket } from './vendor/ws/wrapper.mjs';
import { Match } from '../dist/match.mjs';
import { STEP, BOT_NAMES, clamp, emptyInput } from '../dist/rules.mjs';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.png':'image/png','.woff2':'font/woff2'};
const rooms=new Map(), sockets=new Map();
const httpServer=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/healthz') { res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({game:'Rivetwake',status:'ok',protocol:1})); }
    if(req.method!=='GET' && req.method!=='HEAD') {res.writeHead(405);return res.end();}
    const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    const file=path.resolve(root,'.'+name);
    if(!file.startsWith(path.resolve(root)+path.sep) || name.includes('\\') || !mime[path.extname(file)]) {res.writeHead(404);return res.end();}
    const info=await stat(file); if(!info.isFile()) throw Error('Missing');
    res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Content-Length':info.size,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:await readFile(file));
  } catch { if(!res.headersSent) res.writeHead(404);res.end(); }
});
const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
httpServer.on('upgrade',(req,socket,head)=>{
  if(req.url?.split('?')[0]!=='/ws' || sockets.size>=512) return socket.destroy();
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
});
const send=(c,m)=>{if(c.ws.readyState===WebSocket.OPEN && c.ws.bufferedAmount<1048576) c.ws.send(JSON.stringify(m));};
const error=(c,message)=>send(c,{t:'error',message});
function broadcast(room,m) {for(const c of room.members.values()) send(c,m);}
function roomInfo(room) {
  return {code:room.code,host:room.host,public:room.public,fill:room.fill,difficulty:room.difficulty,state:room.state,
    members:[...room.members.values()].map(c=>({id:c.id,name:c.name,ready:c.ready,color:c.color})),capacity:8};
}
function publishRoom(room) {broadcast(room,{t:'room',room:roomInfo(room)});}
function newRoom(isPublic) {
  if(rooms.size>=128) return null;
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code='';
  do {code=Array.from({length:5},()=>chars[randomInt(chars.length)]).join('');} while(rooms.has(code));
  const r={code,public:isPublic,fill:false,difficulty:1,state:'lobby',members:new Map(),host:null,game:null,ticks:0};
  rooms.set(code,r);return r;
}
function fillBots(room) {
  const game=room.game; if(!room.fill || !game) return;
  for(let i=0;game.players.size<8 && i<8;i++) {
    if(!game.players.has('bot'+i)) game.add('bot'+i,BOT_NAMES[i],true,i);
  }
}
function clearInput(c) { c.queue=[]; c.last=null;c.lastAt=0; }
function leave(c) {
  const r=c.room; if(!r) return;
  r.members.delete(c.id);r.game?.players.delete(c.id);c.room=null;c.ready=false;clearInput(c);
  if(!r.members.size){rooms.delete(r.code);return;}
  if(r.host===c.id) r.host=r.members.keys().next().value;
  if(r.state==='playing') fillBots(r);
  publishRoom(r);
}
function enter(c,m) {
  if(c.room) return error(c,'Leave your current room first.');
  if(!['quick','create','join'].includes(m.mode)) return error(c,'Choose a room option.');
  const name=typeof m.name==='string'?m.name.replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,16):'';
  if(!name) return error(c,'Enter a nickname first.');
  let r;
  if(m.mode==='join') r=rooms.get(String(m.code||'').trim().toUpperCase());
  else if(m.mode==='quick') {
    const available=[...rooms.values()].filter(r=>r.public && r.members.size<8 && r.state!=='results');
    r=available.find(r=>r.state==='lobby') || available[0] || newRoom(true);
  } else r=newRoom(m.public===true);
  if(!r) return error(c,m.mode==='join'?'Room not found. Check the five-character code.':'The server is full. Try again shortly.');
  if(r.members.size>=8 || r.state==='results') return error(c,'This room is full or showing results.');
  c.name=name; c.ready=false;c.room=r;
  const used=new Set([...r.members.values()].map(q=>q.color));c.color=Array.from({length:8},(_,i)=>i).find(i=>!used.has(i));
  r.members.set(c.id,c);r.host??=c.id;
  if(r.state==='playing') {
    if(r.game.players.size>=8) {const bot=[...r.game.players.values()].find(p=>p.bot);if(bot) r.game.players.delete(bot.id);}
    r.game.add(c.id,c.name,false,c.color);
  }
  publishRoom(r); if(r.state==='playing') send(c,{t:'start',snap:r.game.snapshot()});
}
function start(c,r) {
  if(r.host!==c.id) return error(c,'Only the host can start the match.');
  if(r.state!=='lobby') return;
  if([...r.members.values()].some(q=>!q.ready)) return error(c,'Every player must mark ready first.');
  if(r.members.size<2 && !r.fill) return error(c,'Wait for a second player or enable bot fill.');
  r.game=new Match(r.difficulty);r.state='playing';r.ticks=0;
  for(const q of r.members.values()) {clearInput(q);q.lastSeq=0;r.game.add(q.id,q.name,false,q.color);}
  fillBots(r);publishRoom(r);broadcast(r,{t:'start',snap:r.game.snapshot()});
}
function readInput(c,m) {
  if(!Number.isSafeInteger(m.seq) || m.seq<=c.lastSeq || ![m.f,m.s,m.yaw,m.pitch,m.slot].every(Number.isFinite)) return;
  c.lastSeq=m.seq;
  const input={seq:m.seq,f:clamp(m.f,-1,1),s:clamp(m.s,-1,1),yaw:Math.atan2(Math.sin(m.yaw),Math.cos(m.yaw)),pitch:clamp(m.pitch,-1.48,1.48),
    slot:clamp(Math.trunc(m.slot),0,3),fire:m.fire===true,ads:m.ads===true,sprint:m.sprint===true,jump:m.jump===true,reload:m.reload===true};
  if(c.queue.length>=5) c.queue.shift();c.queue.push(input);
}
function handle(c,m) {
  if(m.t==='ping') return send(c,{t:'pong',sent:Number(m.sent)||0});
  if(m.t==='enter') return enter(c,m);
  if(m.t==='leave') {leave(c);return send(c,{t:'left'});}
  const r=c.room;if(!r) return;
  if(m.t==='idle') return clearInput(c);
  if(m.t==='input') {if(r.state==='playing') readInput(c,m);return;}
  if(m.t==='ready' && r.state==='lobby') c.ready=m.ready===true;
  else if(m.t==='options' && r.state==='lobby' && c.id===r.host) {r.fill=m.fill===true;r.difficulty=clamp(Number(m.difficulty)|0,0,2);}
  else if(m.t==='start') return start(c,r);
  else if(m.t==='again' && r.state==='results' && c.id===r.host) {
    r.game=null;r.state='lobby';for(const q of r.members.values()) q.ready=false;
  } else return;
  publishRoom(r);
}
wss.on('connection',ws=>{
  const c={id:randomUUID().slice(0,13),ws,ready:false,room:null,queue:[],lastSeq:0,rtt:70,live:true,pingAt:0};
  sockets.set(c.id,c);send(c,{t:'welcome',id:c.id,protocol:1});
  let windowAt=performance.now(), count=0;
  ws.on('message',(raw,isBinary)=>{
    if(isBinary) return ws.close(1003,'Text messages only');
    const now=performance.now();if(now-windowAt>=1000){windowAt=now;count=0;}
    if(++count>125) return ws.close(1008,'Too many messages');
    let m;try {m=JSON.parse(raw.toString());} catch {return ws.close(1007,'Invalid JSON');}
    if(m && typeof m==='object' && typeof m.t==='string') handle(c,m);
  });
  ws.on('pong',()=>{c.live=true;c.rtt=clamp(performance.now()-c.pingAt,0,600);});
  ws.on('error',()=>ws.terminate());ws.on('close',()=>{leave(c);sockets.delete(c.id);});
});
// Only the server clock advances physics. Packet floods cannot buy extra simulation steps.
let previous=performance.now(),accumulator=0;
setInterval(()=>{
  const now=performance.now();accumulator+=Math.min(.25,(now-previous)/1000);previous=now;
  while(accumulator>=STEP) {
    accumulator-=STEP;
    for(const r of rooms.values()) {
      if(r.state!=='playing') continue;
      const inputs=new Map(),rewinds=new Map();
      for(const c of r.members.values()) {
        const p=r.game.players.get(c.id), i=c.queue.shift();
        if(i){c.last=i;c.lastAt=now;p.ack=i.seq;}
        const active=c.last && now-c.lastAt<170;
        inputs.set(c.id,active?c.last:emptyInput(p));
        rewinds.set(c.id,Math.min(.2,.085+c.rtt/2000));
      }
      r.game.tick(inputs,rewinds);r.ticks++;
      if(r.ticks%2===0 || r.game.finished) {
        const snap=r.game.snapshot();broadcast(r,{t:'snapshot',snap,events:r.game.events.splice(0)});
        if(r.game.finished){r.state='results';publishRoom(r);broadcast(r,{t:'results',snap});}
      }
    }
  }
},8);
setInterval(()=>{
  for(const c of sockets.values()) {
    if(!c.live || c.ws.bufferedAmount>1048576) {c.ws.terminate();continue;}
    c.live=false;c.pingAt=performance.now();c.ws.ping();
  }
},10000);
const port=Number(process.env.PORT||3000),host=process.env.HOST||'0.0.0.0';
httpServer.listen(port,host,()=>console.log(`Rivetwake is ready at http://localhost:${httpServer.address().port}  |  WebSocket /ws`));
