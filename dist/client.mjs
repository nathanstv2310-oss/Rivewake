import { Match } from './match.mjs';
import { STEP, WEAPONS, BOT_NAMES, DIFFICULTIES, clamp, lerp, rankPlayers, angleDelta } from './rules.mjs';
import { ArenaView } from './view.mjs';
import { GameAudio } from './audio.mjs';
import { ClientMotion, RoomLink, endpoint } from './network.mjs';

const $=id=>document.getElementById(id);
const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(action,label,style='secondary')=>`<button type="button" class="${style}" data-act="${action}">${label}</button>`;
const formatTime=seconds=>{const s=Math.max(0,Math.ceil(seconds));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const settings={name:'Pilot',difficulty:1,slot:0,sensitivity:1,volume:.65,quality:1,server:''};
try {Object.assign(settings,JSON.parse(localStorage.getItem('rivetwake.settings.1')||'{}'));} catch {}
for(const [key,lo,hi,fallback] of [['difficulty',0,2,1],['slot',0,3,0],['sensitivity',.25,2.5,1],['volume',0,1,.65],['quality',0,2,1]]) {
  const value=Number(settings[key]);settings[key]=Number.isFinite(value)?clamp(value,lo,hi):fallback;
  if(['slot','difficulty','quality'].includes(key))settings[key]=Math.trunc(settings[key]);
}
const persist=()=>{try{localStorage.setItem('rivetwake.settings.1',JSON.stringify(settings));}catch{}};
function callsign(){const name=$('nickname').value.trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,16)||'Pilot';$('nickname').value=settings.name=name;persist();return name;}
$('nickname').value=String(settings.name||'Pilot').slice(0,16);
$('nickname').addEventListener('change',callsign);
const canvas=$('world'), audio=new GameAudio(settings.volume), keys=new Set();
let view,thumbs=[],mode='offline',screen='home',dialog='',returnTo='',link=null,room=null,motion=null,world=null;
let snap=null,prior=null,self='',slot=settings.slot,look={yaw:0,pitch:0},locked=false,fire=false,ads=false,jumpPulse=false,reloadPulse=false,tab=false;
let acc=0,prevTime=performance.now(),lastHUD=0,camMe=null,knownLife=0,hitsUntil=0,damageUntil=0,msgUntil=0,carry=0,nextStep=0,lastMenu=0;
let feed=[],lastDamageBy='',playingOnline=false,lastVolume=.65,toastTimer,frameError=false;
let cursorAim=false,edgeX=0,edgeY=0,firePulse=false;
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3300);}
function modal(type,kicker,title,content,{wide=false,close=true}={}) {
  const fresh=dialog!==type;dialog=type;$('modal-layer').hidden=false;$('modal').className=wide?'wide':'';
  $('modal').innerHTML=`<div class="dialog-top"><div class="overline"><span class="status-square"></span>${kicker}</div>${close?`<button class="icon-btn" data-act="back" aria-label="Close dialog">${icon('cross')}</button>`:''}</div><h2 class="dialog-title" id="dialog-title">${title}</h2>${content}`;
  if(fresh){const focus=$('modal').querySelector('[autofocus],input:not([type=range]):not([type=checkbox]),button:not(.icon-btn),select');focus?.focus({preventScroll:true});}
}
function hideModal(){dialog='';$('modal-layer').hidden=true;}
function errorDialog(message,network=false){
  modal('error',network?'NETWORK / CONNECTION':'CLIENT / DISPLAY',network?'Connection issue':'Arena unavailable',`<p class="dialog-desc">${esc(message)}</p>${network?'<p class="inline-note">For local multiplayer, open the game served by the included Node server. A static website needs a running WebSocket endpoint.</p>':''}<div class="dialog-actions">${network?btn('net-settings','Server settings'):''}${btn('main','Back to deck','primary')}</div>`);
}
function rack(){
  $('weapon-rack').innerHTML=WEAPONS.map((w,i)=>`<button class="weapon-card ${i===settings.slot?'active':''}" data-act="equip" data-n="${i}" aria-pressed="${i===settings.slot}" title="Start with ${esc(w.name)}"><span class="weapon-meta"><span>${i+1}</span><span>${w.tag}</span></span>${thumbs[i]?`<img src="${thumbs[i]}" alt="">`:'<span class="weapon-placeholder"></span>'}<span class="weapon-copy"><span><strong>${w.name}</strong><small>${w.type}</small></span><i class="equip-mark"></i></span></button>`).join('');
}
function selectDifficulty(value){settings.difficulty=value;persist();document.querySelectorAll('#difficulty button').forEach(b=>{b.classList.toggle('selected',+b.dataset.n===value);b.setAttribute('aria-pressed',String(+b.dataset.n===value));});}
function selectMode(value){
  mode=value;$('offline-options').hidden=value!=='offline';$('online-options').hidden=value!=='online';
  document.querySelectorAll('[data-act=mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.mode===value);b.setAttribute('aria-pressed',String(b.dataset.mode===value));});
}
function muteLabel(){const b=$('mute-btn');b.innerHTML=icon(settings.volume?'volume':'muted');b.title=b.ariaLabel=settings.volume?'Mute audio':'Enable audio';}
function showGuide(){
  returnTo=screen==='game'?'pause':'home';
  const rows=[['Move',['W','A','S','D']],['Look / fire',['Mouse','Left click']],['Aim down sights',['Hold right click']],['Jump / sprint',['Space','Shift']],['Reload / switch weapon',['R','1–4']],['Scoreboard / pause',['Hold Tab','Esc']]];
  modal('guide','FIELD GUIDE / 01','How to play',`<p class="dialog-desc">Score the most points in five minutes. An elimination earns 100 points, or 125 for a finishing headshot. You respawn after 2.8 seconds.</p>${rows.map(([a,b])=>`<div class="controls-row"><span>${a}</span><span>${b.map(k=>`<kbd>${k}</kbd>`).join('')}</span></div>`).join('')}<p class="dialog-note">Ramps lead to both rooftops. Use cover to reload, and aim down sights for tighter shots. Every computer-controlled fighter carries a <strong>BOT</strong> tag.</p><div class="dialog-actions">${btn('back','Got it','primary')}</div>`);
}
function showSettings(from){
  returnTo=from|| (screen==='game'?'pause':room?'lobby':'home');
  modal('settings','CLIENT / PREFERENCES','Settings',`<label class="field-row" for="sens">Mouse sensitivity <output id="sens-val">${settings.sensitivity.toFixed(2)}×</output></label><input type="range" id="sens" min=".25" max="2.5" step=".05" value="${settings.sensitivity}"><label class="field-row" for="vol">Sound volume <output id="vol-val">${Math.round(settings.volume*100)}%</output></label><input type="range" id="vol" min="0" max="100" value="${Math.round(settings.volume*100)}"><label class="field" for="quality">GRAPHICS QUALITY</label><select id="quality">${['Performance','Balanced','High'].map((v,i)=>`<option value="${i}" ${i===settings.quality?'selected':''}>${v}</option>`).join('')}</select><label class="field" for="server-url">MULTIPLAYER SERVER</label><input class="modal-field" id="server-url" placeholder="Same host · /ws" spellcheck="false" value="${esc(settings.server)}"><p class="setting-help">Leave empty for the site default, or enter your server’s wss:// address. Changes apply to your next connection.</p><p id="settings-error" class="error-text"></p><div class="dialog-actions">${btn('save','Save settings','primary')}</div>`);
}
function saveSettings(){
  const value=$('server-url').value.trim();try{if(value)endpoint(value);}catch(e){$('settings-error').textContent=e.message;return;}
  settings.server=value;persist();back();
}
function scoreboard(players){
  return `<table class="table"><thead><tr><th>#</th><th>FIGHTER</th><th>K</th><th>D</th><th>PTS</th></tr></thead><tbody>${rankPlayers(players).map((p,i)=>`<tr class="${p.id===self?'me':''}"><td>${i+1}</td><td>${esc(p.name)} ${p.bot?'<small class="badge bot">BOT</small>':p.id===self?'<small class="badge">YOU</small>':''}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.score}</td></tr>`).join('')}</tbody></table>`;
}
function drawScores(){if(!tab||!snap){$('score-layer').hidden=true;return;}$('score-layer').hidden=false;$('score-layer').innerHTML=`<section class="score-box"><div class="overline">SUNSPOKE DEPOT / ${playingOnline?'ROOM '+esc(room?.code):'OFFLINE'}</div><h2>Live standings</h2>${scoreboard(snap.players)}</section>`;}
function clearKeys(){keys.clear();fire=firePulse=ads=jumpPulse=reloadPulse=tab=false;edgeX=edgeY=0;$('score-layer').hidden=true;}
function release(){clearKeys();cursorAim=false;if(document.pointerLockElement===canvas)document.exitPointerLock();locked=false;}
function closeLink(){const old=link;link=null;old?.close();room=null;motion=null;}
function main(){
  screen='home';release();closeLink();hideModal();view?.clearMatch();world=snap=prior=camMe=null;playingOnline=false;
  $('menu-world').append(canvas);$('stage').hidden=true;$('header').hidden=$('home').hidden=false;acc=0;lastMenu=0;
}
function back(){
  if(dialog==='settings'||dialog==='guide'){if(returnTo==='pause' && screen==='game'){showPause();return;}if(room && returnTo==='lobby'){showLobby();return;}hideModal();return;}
  if(dialog==='pause'||dialog==='deploy'){requestAim();return;}
  if(dialog==='lobby'||dialog==='connecting'||dialog==='results'||dialog==='error'){main();return;}
  hideModal();
}
function connect(mode,extra={}){
  if(!view){errorDialog('WebGL 2 is required. Open this game in desktop Chrome or Edge with graphics acceleration enabled.');return;}
  const name=callsign();closeLink();let url;try{url=endpoint(settings.server||window.RIVETWAKE_SERVER);}catch(e){errorDialog(e.message,true);return;}
  modal('connecting','NETWORK / HANDSHAKE','Connecting…',`<p class="dialog-desc">Contacting ${esc(new URL(url).host)} for ${mode==='quick'?'a public match':mode==='join'?'your room':'a new room'}.</p><div class="dialog-actions">${btn('main','Cancel')}</div>`,{close:false});
  try {
    const current=new RoomLink(url,{mode,name,...extra},m=>{if(link===current)packet(m);},reason=>{if(link===current){main();selectMode('online');errorDialog(reason,true);}});
    link=current;
  } catch(e){main();errorDialog(e.message,true);}
}
function createDialog(){modal('create','MULTIPLAYER / HOST','Create Room',`<p class="dialog-desc">Host a five-minute match for up to eight fighters.</p><label class="field" for="visibility">ROOM VISIBILITY</label><select id="visibility"><option value="private">Private · invite by code</option><option value="public">Public · visible to Quick Match</option></select><div class="dialog-actions">${btn('create',icon('plus')+' Create Room','primary')}</div>`);}
function joinDialog(){modal('join','MULTIPLAYER / INVITE','Join Room',`<p class="dialog-desc">Enter the five-character code from your host’s lobby.</p><label class="field" for="join-code">ROOM CODE</label><input class="modal-field" id="join-code" maxlength="5" placeholder="ABCDE" autocomplete="off" autocapitalize="characters" spellcheck="false"><p id="join-error" class="error-text"></p><div class="dialog-actions">${btn('join',icon('arrow')+' Join Room','primary')}</div>`);}
function showLobby(){
  if(!room||!link)return;const host=room.host===link.id,me=room.members.find(c=>c.id===link.id);
  const ready=room.members.every(c=>c.ready) && (room.members.length>=2 || room.fill);
  const bots=room.fill?8-room.members.length:0;
  modal('lobby',`NETWORK / ${room.public?'PUBLIC':'PRIVATE'} ROOM`,'Squad lobby',`<div class="lobby-code"><div><span class="tiny">ROOM CODE</span><br><strong>${esc(room.code)}</strong></div><button class="icon-btn" title="Copy room code" aria-label="Copy room code" data-act="copy">${icon('copy')}</button></div><div class="between tiny"><span>HUMAN PLAYERS</span><span>${room.members.length} / 8</span></div>${room.members.map(c=>`<div class="lobby-person"><span>${esc(c.name)} <small>${c.id===link.id?'YOU ':''}${c.id===room.host?'HOST':''}</small></span><span class="badge">${c.ready?'READY':'WAITING'}</span></div>`).join('')}<div class="lobby-options"><label><input type="checkbox" id="fill" ${room.fill?'checked':''} ${host?'':'disabled'}> Fill empty slots with bots</label><select aria-label="Bot difficulty" id="room-difficulty" ${host?'':'disabled'}>${DIFFICULTIES.map((d,i)=>`<option value="${i}" ${i===room.difficulty?'selected':''}>${d}</option>`).join('')}</select></div><p class="inline-note">${bots?`${bots} labelled ${bots===1?'bot':'bots'} will join at launch.`:room.members.length<2?'Invite another player, or enable bot fill.':'All-human match.'} ${host?'Ready everyone, then start.':'The host starts when everyone is ready.'}</p><p class="room-status" id="lobby-ping">● CONNECTED</p><div class="dialog-actions">${btn('ready',me?.ready?'Cancel ready':icon('check')+' Ready',me?.ready?'secondary':'primary')}${host?`<button class="primary" data-act="start" ${ready?'':'disabled'}>${icon('play')}Start match</button>`:''}</div><div class="dialog-actions">${btn('main','Leave room','quiet')}</div>`,{close:false});
}
function packet(m){
  if(m.t==='error'){if(!room){closeLink();errorDialog(m.message,true);}else toast(m.message);return;}
  if(m.t==='room'){
    room=m.room;
    if(room.state==='lobby'){
      if(screen==='results'){screen='home';view.clearMatch();$('menu-world').append(canvas);$('stage').hidden=true;$('home').hidden=$('header').hidden=false;world=motion=snap=null;playingOnline=false;}
      showLobby();
    }else if(screen==='results' && snap)showResults();
    return;
  }
  if(m.t==='start'){playingOnline=true;world=null;self=link.id;motion=new ClientMotion(m.snap,self);begin(m.snap);showDeploy();return;}
  if(m.t==='snapshot' && motion){motion.accept(m.snap);snap=m.snap;syncLife();events(m.events||[]);return;}
  if(m.t==='results' && motion){snap=m.snap;showResults();}
}
function begin(first){
  screen='game';clearKeys();hideModal();snap=first;prior=null;feed=[];lastDamageBy='';acc=carry=hitsUntil=damageUntil=msgUntil=0;knownLife=0;camMe=null;
  slot=settings.slot;view.clearMatch();$('game-world').append(canvas);$('stage').hidden=false;$('header').hidden=$('home').hidden=true;
  $('combat-text').textContent='';$('hitmark').style.opacity='0';$('damage').style.opacity='0';$('kill-feed').innerHTML='';$('respawn').hidden=true;
  $('hud-mode').textContent=playingOnline?'ONLINE · '+room.code:'OFFLINE · 5 BOTS';syncLife();updateHUD();
}
function own(){return playingOnline?motion?.local:snap?.players.find(p=>p.id===self);}
function syncLife(){const p=own();if(!p || p.life===knownLife)return;look={yaw:p.yaw,pitch:p.pitch};knownLife=p.life;carry=0;camMe=null;fire=false;audio.spawn();}
function offline(){
  if(!view){errorDialog('WebGL 2 is required. Open this game in desktop Chrome or Edge with graphics acceleration enabled.');return;}
  audio.unlock();closeLink();playingOnline=false;self='pilot';world=new Match(settings.difficulty);
  const p=world.add(self,callsign(),false,0);p.weapon=settings.slot;
  for(let i=0;i<5;i++)world.add('bot'+i,BOT_NAMES[i],true,i+1);
  world.events.length=0;begin(world.snapshot());requestAim();
}
function showDeploy(hint=''){
  modal('deploy',playingOnline?'NETWORK / MATCH LIVE':'LOCAL / CONTROLS','Enter the arena',`<p class="dialog-desc">${hint?esc(hint):'Click below to capture your mouse and enable game audio.'}</p><p class="inline-note">${playingOnline?'The room timer is running. ':''}Press Esc to release your cursor.</p><div class="dialog-actions">${btn('resume',icon('play')+' Enter arena','primary')}${btn('main','Leave match','quiet')}</div>${hint?`<p class="dialog-note"><a href="${esc(location.href)}" target="_blank" rel="noopener">Open game in a separate tab ↗</a></p>`:''}`,{close:false});
}
function requestAim(){
  if(screen!=='game')return;audio.unlock();clearKeys();
  if(document.pointerLockElement===canvas){locked=true;hideModal();return;}
  if(typeof canvas.requestPointerLock!=='function'){useCursorAim();return;}
  try{
    const p=canvas.requestPointerLock();
    if(p?.catch)p.catch(useCursorAim);
  }catch{useCursorAim();}
}
function useCursorAim(){
  if(screen!=='game' || locked)return;
  clearKeys();locked=cursorAim=true;acc=0;prevTime=performance.now();hideModal();
  toast('Cursor aim enabled. Move to a screen edge to keep turning. Esc opens the menu.');
}
function showPause(){
  if(screen!=='game')return;clearKeys();acc=0;link?.send({t:'idle'});
  modal('pause',playingOnline?'NETWORK / MENU':'LOCAL / PAUSED',playingOnline?'Match menu':'Match paused',`<p class="dialog-desc">${playingOnline?'Combat and the shared timer continue while this menu is open.':'The simulation and match clock are paused.'}</p><div class="dialog-actions">${btn('resume',icon('play')+' Resume','primary')}${btn('settings',icon('sliders')+' Settings')}</div><div class="dialog-actions">${btn('guide','How to play','quiet')}${btn('main','Leave match','quiet')}</div>`,{close:false});
}
function showResults(){
  if(!snap)return;screen='results';release();const players=rankPlayers(snap.players),winner=players[0],place=players.findIndex(p=>p.id===self)+1;
  modal('results','DEBRIEF / FINAL STANDINGS','Match complete',`<div class="result-top"><div><span>ARENA WINNER</span><br><strong>${esc(winner?.name||'—')}</strong> ${winner?.bot?'<small class="badge bot">BOT</small>':''}</div><span>YOUR RANK · ${place} / ${players.length}</span></div>${scoreboard(players)}<div class="dialog-actions">${playingOnline?(room?.host===self?btn('again','Reopen lobby','primary'):''):btn('offline',icon('play')+' Play again','primary')}${btn('main','Back to deck')}</div>`,{wide:true,close:false});
}
function events(list){
  const now=performance.now();
  for(const e of list){
    const me=own();if(!me)continue;
    if(e.type==='shot'){
      view.shot(e,self);audio.shot(e.weapon,e.who===self?0:Math.hypot(e.origin[0]-me.x,e.origin[2]-me.z));
      if(e.who===self && locked){const kick=WEAPONS[e.weapon].kick*(ads?.68:1);look.pitch=clamp(look.pitch+kick,-1.48,1.48);carry+=kick;}
    }else if(e.type==='hit'){
      if(e.who===self){hitsUntil=now+170;$('hitmark').style.color=e.head?'#ffb854':'#f5ffe2';audio.hit(e.head);}
      if(e.target===self)damageUntil=now+360;
    }else if(e.type==='kill'){
      const who=(name,bot)=>esc(name)+(bot?' <small>BOT</small>':'');
      feed.unshift({until:now+5400,html:`${who(e.killer,e.killerBot)} <small>${e.head?'⌖ HS':'›'}</small> ${who(e.victim,e.victimBot)}`});feed=feed.slice(0,4);
      if(e.who===self){$('combat-text').textContent=`${e.head?'HEADSHOT':'ELIMINATED'}  ·  ${e.victim}${e.victimBot?' [BOT]':''}  +${e.head?125:100}`;msgUntil=now+1150;audio.kill();}
      if(e.target===self)lastDamageBy=e.killer+(e.killerBot?' [BOT]':'');
    }else if(e.type==='reload' && e.who===self)audio.reload();
  }
}
function input(){
  const i={f:Number(keys.has('KeyW'))-Number(keys.has('KeyS')),s:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),yaw:look.yaw,pitch:look.pitch,fire:fire||firePulse,ads,jump:keys.has('Space')||jumpPulse,sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),reload:reloadPulse,slot};
  firePulse=jumpPulse=reloadPulse=false;return i;
}
function updateHUD(){
  const p=own();if(!p || !snap)return;const now=performance.now(),t=playingOnline?motion.time():snap.time;
  $('timer').textContent=formatTime(300-t);$('hp').textContent=p.hp;$('hp-bar').style.width=p.hp+'%';$('hp-bar').style.background=p.hp<=30?'#ff9c73':'var(--mint)';
  $('mag').textContent=p.mag;$('reserve').textContent=p.reserve;$('weapon-label').textContent=`0${p.weapon+1} / ${WEAPONS[p.weapon].name.toUpperCase()}`;
  $('gun-state').textContent=p.reloadTo>t?`RELOADING · ${(p.reloadTo-t).toFixed(1)}s`:p.mag===0?'R · RELOAD':WEAPONS[p.weapon].type.toUpperCase();
  $('net-label').textContent=playingOnline?`● CONNECTED  /  ${link?.ping??'…'} ms`:'● LOCAL SIMULATION';
  $('respawn').hidden=p.hp>0;if(p.hp<=0)$('respawn').innerHTML=`<b>Rebuilding in ${Math.max(0,p.respawnAt-t).toFixed(1)}s</b><small>${lastDamageBy?'ELIMINATED BY '+esc(lastDamageBy):'RESPAWNING'}</small>`;
  $('scope').hidden=!(ads && p.weapon===2 && p.hp>0 && locked);$('reticle').hidden=p.hp<=0 || !$('scope').hidden;$('reticle').classList.toggle('aim',ads);
  $('hitmark').style.opacity=String(clamp((hitsUntil-now)/75,0,1));$('damage').style.opacity=String(clamp((damageUntil-now)/360,0,1)*.65);
  if(now>msgUntil)$('combat-text').textContent='';feed=feed.filter(f=>f.until>now);const html=feed.map(f=>`<div>${f.html}</div>`).join('');if($('kill-feed').innerHTML!==html)$('kill-feed').innerHTML=html;
  if(tab)drawScores();
}
document.addEventListener('pointerlockchange',()=>{
  locked=document.pointerLockElement===canvas;cursorAim=false;if(screen!=='game')return;
  clearKeys();acc=0;prevTime=performance.now();
  if(locked)hideModal();else showPause();
});
document.addEventListener('pointerlockerror',useCursorAim);
document.addEventListener('mousemove',e=>{
  if(!locked || screen!=='game')return;const scale=.00215*settings.sensitivity*(ads?(slot===2?.34:.68):1);
  if(cursorAim){const edge=v=>Math.sign(v)*clamp((Math.abs(v)-.82)/.18,0,1);edgeX=edge(e.clientX/innerWidth*2-1);edgeY=edge(e.clientY/innerHeight*2-1);}
  look.yaw=Math.atan2(Math.sin(look.yaw-e.movementX*scale),Math.cos(look.yaw-e.movementX*scale));look.pitch=clamp(look.pitch-e.movementY*scale,-1.48,1.48);
});
document.addEventListener('mousedown',e=>{if(!locked || screen!=='game')return;if(e.button===0)fire=firePulse=true;if(e.button===2)ads=true;});
document.addEventListener('mouseup',e=>{if(e.button===0)fire=false;if(e.button===2)ads=false;});
document.addEventListener('contextmenu',e=>{if(screen==='game')e.preventDefault();});
document.addEventListener('keydown',e=>{
  if(!locked || screen!=='game'){
    if(e.key==='Escape' && dialog && !['pause','deploy','results'].includes(dialog)){e.preventDefault();back();}
    if(e.key==='Enter' && e.target.id==='join-code')document.querySelector('[data-act=join]')?.click();
    if(e.key==='Tab' && dialog){
      const controls=[...$('modal').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')];const end=e.shiftKey?controls[0]:controls.at(-1);
      if(document.activeElement===end){e.preventDefault();(e.shiftKey?controls.at(-1):controls[0])?.focus();}
    }
    return;
  }
  if(['Tab','Space','ShiftLeft','ShiftRight','KeyW','KeyA','KeyS','KeyD','KeyR','Digit1','Digit2','Digit3','Digit4'].includes(e.code))e.preventDefault();
  if(e.code==='Tab'){tab=true;drawScores();return;}
  if(e.code==='Escape'){release();showPause();return;}
  keys.add(e.code);if(e.repeat)return;
  if(e.code==='Space')jumpPulse=true;if(e.code==='KeyR')reloadPulse=true;if(/^Digit[1-4]$/.test(e.code))slot=Number(e.code.slice(-1))-1;
});
document.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Tab'){tab=false;$('score-layer').hidden=true;if(locked)e.preventDefault();}});
function blur(){if(screen==='game' && locked){release();showPause();}else clearKeys();}
window.addEventListener('blur',blur);document.addEventListener('visibilitychange',()=>{if(document.hidden)blur();});
document.addEventListener('input',e=>{
  if(e.target.id==='sens'){settings.sensitivity=Number(e.target.value);$('sens-val').textContent=settings.sensitivity.toFixed(2)+'×';persist();}
  if(e.target.id==='vol'){settings.volume=Number(e.target.value)/100;audio.set(settings.volume);$('vol-val').textContent=e.target.value+'%';persist();muteLabel();}
  if(e.target.id==='join-code')e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
});
document.addEventListener('change',e=>{
  if(e.target.id==='quality'){settings.quality=+e.target.value;view?.quality(settings.quality);persist();}
  if(['fill','room-difficulty'].includes(e.target.id))link?.send({t:'options',fill:$('fill').checked,difficulty:+$('room-difficulty').value});
});
document.addEventListener('click',e=>{
  const b=e.target.closest('button[data-act]');if(!b || b.disabled)return;const a=b.dataset.act;
  switch(a){
    case 'home':case 'main':main();break;
    case 'back':back();break;
    case 'mode':selectMode(b.dataset.mode);break;
    case 'difficulty':selectDifficulty(+b.dataset.n);break;
    case 'equip':settings.slot=+b.dataset.n;persist();rack();break;
    case 'guide':showGuide();break;
    case 'settings':showSettings();break;
    case 'net-settings':showSettings('home');break;
    case 'save':saveSettings();break;
    case 'offline':offline();break;
    case 'resume':requestAim();break;
    case 'mute':if(settings.volume){lastVolume=settings.volume;settings.volume=0;}else settings.volume=lastVolume||.65;audio.unlock();audio.set(settings.volume);persist();muteLabel();break;
    case 'quick':connect('quick');break;
    case 'create-dialog':createDialog();break;
    case 'join-dialog':joinDialog();break;
    case 'create':connect('create',{public:$('visibility').value==='public'});break;
    case 'join':{const code=$('join-code').value.trim().toUpperCase();if(code.length!==5){$('join-error').textContent='Enter all five characters.';break;}connect('join',{code});break;}
    case 'ready':link?.send({t:'ready',ready:!room.members.find(c=>c.id===link.id)?.ready});break;
    case 'start':audio.unlock();link?.send({t:'start'});break;
    case 'again':link?.send({t:'again'});break;
    case 'copy':if(navigator.clipboard?.writeText)navigator.clipboard.writeText(room.code).then(()=>toast('Room code copied')).catch(()=>toast('Room code · '+room.code));else toast('Room code · '+room.code);break;
  }
});
function loop(now){
  requestAnimationFrame(loop);if(frameError || !view)return;
  const dt=Math.max(0,Math.min(.12,(now-prevTime)/1000));prevTime=now;
  try{
    if(screen==='home'){
      if(!document.hidden && now-lastMenu>48){view.menu(matchMedia('(prefers-reduced-motion: reduce)').matches?0:now/1000);lastMenu=now;}
      if(dialog==='lobby' && $('lobby-ping'))$('lobby-ping').textContent='● CONNECTED  /  '+(link?.ping??'…')+' ms';return;
    }
    if(screen!=='game'||!snap)return;
    if(locked){
      if(cursorAim){look.yaw-=edgeX*dt*2.5*settings.sensitivity;look.pitch=clamp(look.pitch-edgeY*dt*1.5,-1.48,1.48);}
      acc+=dt;const back=carry*(1-Math.exp(-4*dt));look.pitch=clamp(look.pitch-back,-1.48,1.48);carry-=back;
      while(acc>=STEP){
        acc-=STEP;const i=input();
        if(playingOnline)motion.input(link,i);
        else {world.tick(new Map([[self,i]]));prior=snap;snap=world.snapshot();syncLife();events(world.events.splice(0));if(world.finished){showResults();return;}}
      }
    }
    const local=own();if(!local)return;
    const t=playingOnline?motion.time():snap.time;
    let players=playingOnline?motion.visible():snap.players;
    if(!playingOnline && prior){
      const f=clamp(acc/STEP,0,1);players=players.map(p=>{const q=prior.players.find(v=>v.id===p.id);if(!q||p.life!==q.life)return p;
        return {...p,x:lerp(q.x,p.x,f),y:lerp(q.y,p.y,f),z:lerp(q.z,p.z,f),yaw:q.yaw+angleDelta(q.yaw,p.yaw)*f};});
    }
    if(!playingOnline)camMe=players.find(p=>p.id===self);
    else if(!camMe || camMe.life!==local.life || Math.hypot(camMe.x-local.x,camMe.z-local.z)>2.5)camMe={...local};
    else {const k=1-Math.exp(-38*dt);camMe={...local,x:lerp(camMe.x,local.x,k),y:lerp(camMe.y,local.y,k),z:lerp(camMe.z,local.z,k)};}
    const w=WEAPONS[local.weapon],reloadFrac=local.reloadTo>t?clamp(1-(local.reloadTo-t)/w.reload,0,1):0;
    view.frame(dt,camMe,players,local.weapon,look,ads && locked && !reloadFrac,reloadFrac);
    if(locked && local.hp>0 && local.grounded && Math.hypot(local.vx,local.vz)>2 && now>nextStep){audio.step();nextStep=now+(local.sprinting?280:380);}
    if(now-lastHUD>48){updateHUD();lastHUD=now;}
  }catch(err){frameError=true;console.error(err);main();errorDialog('The renderer stopped. Reload this tab to initialise the arena again.');}
}
selectDifficulty(settings.difficulty);selectMode('offline');muteLabel();rack();
try{view=new ArenaView(canvas,settings.quality);thumbs=view.thumbnails();rack();view.menu(0);$('system-status').textContent='Client ready';}
catch(err){console.error(err);$('system-status').textContent='WebGL unavailable';}
requestAnimationFrame(loop);

