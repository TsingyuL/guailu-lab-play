const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ROAD_SOUNDS = ['dirt', 'sand', 'snow', 'mud', 'wave', 'ribs', 'sponge', 'tilt', 'slick'];
const SOUND_FILES = ['engine', 'accelerate', 'brake', 'pickup', 'ring', 'landing', 'refuel', 'rush', 'smash', 'music', 'wind', 'clean-land', ...ROAD_SOUNDS.map(s => 'road-' + s)];

// A bounded mixer: continuous loops never restart each frame; pickups use two voices.
class DrivingAudio {
  constructor(backend) { this.backend=backend;this.loops=new Map();this.clock=0;this.lastCoin=-1;this.coinChain=0;this.wasGas=false;this.revAt=-2;this.duck=0;this.gear=0;this.feedbackAt=-1;this.bedGain=1;this.mixElapsed=0; }
  unlock() { try { this.backend.unlock?.(); } catch (_) {} }
  effect(name, enabled=true) {
    if(!enabled)return;
    let rate=1,volume={coin:.38,ring:.34,landing:.36,'clean-land':.32,refuel:.32,smash:.3,rush:.18,start:.22,finish:.22,click:.16,accelerate:.14}[name]||.25;
    if(['landing','clean-land','smash'].includes(name)){
      if(this.clock-this.feedbackAt<.12)return;
      this.feedbackAt=this.clock;
    }
    if(name==='coin') {
      if(this.clock-this.lastCoin<.07)return;
      this.coinChain=this.clock-this.lastCoin<.65?Math.min(3,this.coinChain+1):0;
      this.lastCoin=this.clock;rate=[1,1.04,1.08,1.12][this.coinChain];this.duck=.14;name='pickup';
    }
    if(['ring','clean-land','smash','refuel'].includes(name))this.duck=Math.max(this.duck,.28);
    try {this.backend.effect(name,volume,rate);}catch(_){}
  }
  loop(name,volume,rate,dt) {
    const old=this.loops.get(name)||{volume:0,rate:1};
    old.volume+=(volume-old.volume)*(1-Math.exp(-dt*(name==='music'?2.5:name==='wind'?4:14)));
    old.rate+=(rate-old.rate)*(1-Math.exp(-dt*9));
    if(old.volume<.002&&volume===0)old.volume=0;
    this.loops.set(name,old);this.backend.loop(name,old.volume,old.rate);
  }
  update(state,dt) {
    this.clock+=dt;this.duck=Math.max(0,this.duck-dt);
    if(!state?.active||!state.enabled){this.stop();return;}
    this.mixElapsed+=dt;
    if(this.mixElapsed<.05&&this.loops.size)return;
    dt=this.mixElapsed;this.mixElapsed=0;
    const speed=clamp(Math.abs(state.speed)/650,0,1),gas=state.gas&&!state.brake&&state.fuel>0;
    const load=clamp(-state.slope,0,.65),pitch=[1,.86,.7,1.2,.8,1.08,1.12,1.16,1.05][state.vehicle]||1;
    if(gas&&!this.wasGas&&this.clock-this.revAt>.8){this.effect('accelerate');this.revAt=this.clock;}
    this.wasGas=gas;
    // Hysteresis prevents gear hunting at the threshold. Pitch rises within a gear,
    // drops on an upshift, and free-revs gently when wheels leave the ground.
    const thresholds=[.32,.65];
    if(this.gear<2&&speed>thresholds[this.gear]+.035)this.gear++;
    if(this.gear>0&&speed<thresholds[this.gear-1]-.055)this.gear--;
    const rpm=.67+speed*1.45-this.gear*.22+(gas?.38+load*.13:0)+(gas&&!state.grounded?.18:0);
    const duck=this.duck>0?.78:1;
    // Atmosphere stays behind the driving cues. Duck quickly, recover gradually;
    // never restart or change the music's pitch when speed or materials change.
    this.bedGain+=((this.duck>0?.45:1)-this.bedGain)*(1-Math.exp(-dt*(this.duck>0?18:3)));
    // The score is a quiet low bed, not a lead melody. Keep it well below the
    // engine and terrain so long sessions do not turn the sustained chord harsh.
    this.loop('music',.03*this.bedGain,1,dt);
    this.loop('wind',Math.min(.17,.018+speed*speed*.1+(!state.grounded&&speed>.12?.045:0))*this.bedGain,.85+speed*.18,dt);
    this.loop('engine',state.fuel>0?(gas?.25+load*.045:.085)*duck*(state.grounded?1:.8):0,pitch*rpm,dt);
    const character={dirt:.85,sand:.78,snow:1,mud:1,wave:.7,ribs:1.12,sponge:1,tilt:1.15,slick:.7};
    for(const road of ROAD_SOUNDS)this.loop('road-'+road,state.grounded&&state.road===road?(.06+speed*.29)*character[road]*Math.min(1,Math.abs(state.speed)/40)*duck:0,.72+speed*.75,dt);
    this.loop('brake',state.brake&&state.grounded&&Math.abs(state.speed)>65?speed*(state.road==='slick'?.28:.16):0,.8+speed*.35,dt);
  }
  stop() {
    if(this.loops.size){this.backend.stopLoops();this.loops.clear();}
    this.wasGas=false;
    this.gear=0;
    this.bedGain=1;
    this.mixElapsed=0;
  }
  silence() {this.stop();this.backend.silence();this.lastCoin=-1;this.coinChain=0;this.feedbackAt=-1;this.duck=0;}
}

function createAudioBackend(native) {
  const loops=new Map(),voices=new Map();let context=null,master=null,epoch=0;
  const buffers=new Map(),pending=new Map(),failed=new Map(),active=new Set();
  // Some WebKit versions expose only the callback form of decodeAudioData.
  const decode=bytes=>new Promise((resolve,reject)=>{
    try{const result=context.decodeAudioData(bytes,resolve,reject);if(result?.then)result.then(resolve,reject);}catch(error){reject(error);}
  });
  const load=name=>{
    if(buffers.has(name))return Promise.resolve(buffers.get(name));
    if(failed.has(name)&&Date.now()-failed.get(name)<3000)return Promise.resolve(null);
    if(!pending.has(name))pending.set(name,fetch('assets/'+name+'.wav').then(r=>{if(!r.ok)throw Error('audio');return r.arrayBuffer();}).then(decode).then(b=>{buffers.set(name,b);failed.delete(name);pending.delete(name);return b;}).catch(()=>{pending.delete(name);failed.set(name,Date.now());return null;}));
    return pending.get(name);
  };
  const player=(name,loop=false)=>{
    const p=wx.createInnerAudioContext();p.obeyMuteSwitch=false;p.loop=loop;p.src='assets/'+name+'.wav';return p;
  };
  // Playback rate is optional on older WeChat runtimes; it must never block play().
  const nativeRate=(p,rate)=>{try{p.playbackRate=rate;}catch(_){}};
  const backend={
    unlock() {
      if(native){if(wx.setInnerAudioOption)wx.setInnerAudioOption({obeyMuteSwitch:false,mixWithOther:true});return;}
      const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;
      if(!context){context=new AudioContext();master=context.createGain();master.gain.value=.8;master.connect(context.destination);}
      if(context.state==='suspended'||context.state==='interrupted')context.resume().catch(()=>{});
      // Decode away from the physics loop, after the first real user gesture.
      for(const name of [...SOUND_FILES,'click','start','finish','smash','horn','rush'])load(name);
    },
    effect(name,volume,rate) {
      if(native){
        let pool=voices.get(name);if(!pool){pool={next:0,items:[]};voices.set(name,pool);}
        const i=pool.next++%2;
        if(!pool.items[i])pool.items[i]=player(name);
        const p=pool.items[i];p.stop();p.volume=volume;nativeRate(p,rate);p.play();return;
      }
      if(!context)return;
      const issued=epoch,at=context.currentTime;
      load(name).then(buffer=>{
        if(!buffer||issued!==epoch||context.state!=='running'||context.currentTime-at>.3)return;
        const same=[...active].filter(n=>n.name===name);if(same.length>=(name==='pickup'?2:4)){same[0].source.stop();active.delete(same[0]);}
        const source=context.createBufferSource(),gain=context.createGain(),entry={source,name,gain};
        source.buffer=buffer;source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain);gain.connect(master);active.add(entry);
        source.onended=()=>{active.delete(entry);source.disconnect();gain.disconnect();};source.start();
      }).catch(()=>{});
    },
    loop(name,volume,rate) {
      let node=loops.get(name);
      if(!node&&volume>.002){
        if(native){node={player:player(name,true),playing:false};}
        else {if(!context||context.state!=='running')return;if(!buffers.has(name)){load(name);return;}const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffers.get(name);source.loop=true;source.connect(gain);gain.connect(master);gain.gain.value=0;source.start();node={source,gain};}
        loops.set(name,node);
      }
      if(!node)return;
      if(volume===0){if(native){node.player.stop();node.player.destroy?.();}else{node.source.stop();node.source.disconnect();node.gain.disconnect();}loops.delete(name);return;}
      if(node.volume===undefined||Math.abs(volume-node.volume)>.002){if(native)node.player.volume=volume;else node.gain.gain.setTargetAtTime(volume,context.currentTime,.05);node.volume=volume;}
      if(node.rate===undefined||Math.abs(rate-node.rate)>.008){if(native)nativeRate(node.player,rate);else node.source.playbackRate.setTargetAtTime(rate,context.currentTime,.065);node.rate=rate;}
      if(native&&volume>0&&!node.playing){node.player.play();node.playing=true;}
    },
    stopLoops(){for(const n of loops.values()){if(native){n.player.stop();n.player.destroy?.();}else{n.source.stop();n.source.disconnect();n.gain.disconnect();}}loops.clear();},
    silence(){epoch++;backend.stopLoops();for(const n of active)n.source.stop();active.clear();for(const pool of voices.values())for(const p of pool.items)p.pause();}
  };
  return backend;
}
module.exports={DrivingAudio,createAudioBackend,ROAD_SOUNDS,SOUND_FILES};
