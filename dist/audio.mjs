// All sound is synthesised locally. AudioContext is first opened by a player gesture.
export class GameAudio {
  constructor(volume) {this.volume=volume;}
  unlock() {
    try {
      if(!this.ctx) {
        this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);
        this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate*.42,this.ctx.sampleRate);
        const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
        this.set(this.volume);
      }
      if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
    } catch { /* Devices with audio disabled can still play. */ }
  }
  set(value) {this.volume=value;if(this.master)this.master.gain.setTargetAtTime(value*.62,this.ctx.currentTime,.015);}
  tone(start,end,duration,gain,type='sine',when=0) {
    if(!this.ctx || !this.volume)return;
    const t=this.ctx.currentTime+when,o=this.ctx.createOscillator(),env=this.ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(start,t);o.frequency.exponentialRampToValueAtTime(Math.max(end,1),t+duration);
    env.gain.setValueAtTime(.0001,t);env.gain.exponentialRampToValueAtTime(Math.max(.001,gain),t+.004);env.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(env).connect(this.master);o.start(t);o.stop(t+duration+.01);
  }
  shot(slot,distance=0) {
    if(!this.ctx || !this.volume || distance>70)return;
    const t=this.ctx.currentTime,gain=1/(1+distance*.18),dur=[.105,.235,.31,.085][slot];
    const src=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),env=this.ctx.createGain();src.buffer=this.noise;
    filter.type='lowpass';filter.frequency.setValueAtTime([4700,3400,5700,3900][slot]/(1+distance*.012),t);filter.frequency.exponentialRampToValueAtTime(420,t+dur);
    env.gain.setValueAtTime(.49*gain,t);env.gain.exponentialRampToValueAtTime(.0001,t+dur);
    src.connect(filter).connect(env).connect(this.master);src.start(t);src.stop(t+dur);
    this.tone([158,105,135,235][slot],38,dur,gain*.44,'triangle');
  }
  hit(head) {this.tone(head?1230:780,head?1860:1090,.07,.13,'sine');}
  kill() {this.tone(830,1035,.11,.16);this.tone(1240,1460,.16,.13,'sine',.08);}
  reload() {this.tone(420,150,.075,.11,'square');this.tone(245,840,.085,.082,'triangle',.15);}
  spawn() {this.tone(310,650,.2,.1);}
  step() {this.tone(99,43,.055,.09,'triangle');}
}
