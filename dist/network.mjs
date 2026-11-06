import { clamp, lerp, angleDelta, movePlayer } from './rules.mjs';

export function endpoint(value) {
  const address=value?.trim() || `${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`;
  const u=new URL(address);if(u.protocol==='https:')u.protocol='wss:';if(u.protocol==='http:')u.protocol='ws:';
  if(!['wss:','ws:'].includes(u.protocol) || u.username || u.password || u.hash)throw Error('Enter a WebSocket URL such as wss://your-game.onrender.com/ws.');
  if(location.protocol==='https:' && u.protocol==='ws:')throw Error('Use a secure wss:// server for this HTTPS website.');
  if(u.pathname==='/')u.pathname='/ws';return u.href;
}
export class RoomLink {
  constructor(url,intent,onPacket,onEnd) {
    this.socket=new WebSocket(url);this.ping=null;this.closed=false;this.joined=false;
    this.timeout=setTimeout(()=>{if(!this.joined){this.reason='Connection timed out. Check the server address or wake the hosting service.';this.close(false);}},18000);
    this.socket.onmessage=ev=>{
      let m;try{m=JSON.parse(ev.data);}catch{return;}
      if(m.t==='welcome'){this.id=m.id;this.send({t:'enter',...intent});this.pulse();this.heartbeat=setInterval(()=>this.pulse(),2200);}
      if(m.t==='pong'){this.ping=Math.max(0,Math.round(performance.now()-m.sent));return;}
      if(m.t==='room'){this.joined=true;clearTimeout(this.timeout);}
      onPacket(m);
    };
    this.socket.onerror=()=>{this.reason='The multiplayer server could not be reached. Check its address in Settings.';};
    this.socket.onclose=()=>{clearTimeout(this.timeout);clearInterval(this.heartbeat);if(!this.closed)onEnd(this.reason||'The connection closed. You can rejoin by room code if the room is still active.');};
  }
  pulse(){this.send({t:'ping',sent:performance.now()});}
  send(m){if(this.socket.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(m));}
  close(intentional=true){this.closed=intentional;clearTimeout(this.timeout);clearInterval(this.heartbeat);this.socket.close();}
}

// The server acknowledges input sequence numbers. Only unacknowledged movement is replayed.
export class ClientMotion {
  constructor(snap,id) {this.id=id;this.seq=0;this.pending=[];this.frames=[];this.accept(snap);}
  accept(snap) {
    const own=snap.players.find(p=>p.id===this.id);if(!own)return;
    if(this.latest?.mapId!==snap.mapId){this.frames=[];this.pending=[];}
    const now=performance.now();this.latest=snap;this.at=now;
    this.frames.push(snap);if(this.frames.length>8)this.frames.shift();
    if(!this.local || own.life!==this.local.life || own.hp<=0)this.pending=[];
    this.pending=this.pending.filter(i=>i.seq>own.ack);
    this.local={...own,effects:{...own.effects}};if(own.hp>0)for(const i of this.pending)movePlayer(this.local,i);
  }
  input(link,input) {
    const i={...input,mapId:this.latest.mapId,seq:++this.seq};link.send({t:'input',...i});
    if(this.local.hp>0){this.pending.push(i);if(this.pending.length>30)this.pending.shift();movePlayer(this.local,i);}
  }
  time(){return this.latest.time+Math.min(.3,(performance.now()-this.at)/1000);}
  visible() {
    const target=this.time()-.085, frames=this.frames;
    let a=frames[0],b=frames[frames.length-1];
    for(const frame of frames){if(frame.time<=target)a=frame;else{b=frame;break;}}
    const frac=clamp((target-a.time)/Math.max(.001,b.time-a.time),0,1);
    return this.latest.players.map(current=>{
      if(current.id===this.id)return this.local;
      const p=a.players.find(p=>p.id===current.id),q=b.players.find(p=>p.id===current.id);
      if(!p||!q||p.life!==q.life||q.life!==current.life||!current.hp)return current;
      const out={...current};for(const k of ['x','y','z','pitch'])out[k]=lerp(p[k],q[k],frac);
      out.yaw=p.yaw+angleDelta(p.yaw,q.yaw)*frac;return out;
    });
  }
}
