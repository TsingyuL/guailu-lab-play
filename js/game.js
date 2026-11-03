const { getRoute, mapFrontier, previewBuild, purchaseBuild, drivingAdvice, contractProgress, SPECIALIZATIONS, specializationGate, CHAPTER_REWARDS, MAX_LEVEL, upgradeGate, stageUnlocked, VEHICLES, UPGRADES, sanitizeSave, upgradeCost, upgradePreview, upgradesFor, vehicleStats, MILESTONES, clamp, lerp } = require('./config');
const { Terrain, Car, collectibles, fuelStops, STEP, START_X } = require('./physics');
const { CHARACTERS } = require('./config');
const { Renderer } = require('./renderer');
const { RacingMechanics } = require('./mechanics');
const { compareUpgrade } = require('./tuning');
const { Telemetry } = require('./telemetry');
class Game {
  constructor(platform) {
    this.platform = platform; this.save = sanitizeSave(platform.load());
    this.screen = 'home'; this.modal = null; this.time = 0; this.lastFrame = null; this.accumulator = 0;
    this.input = { gas: false, brake: false }; this.keys = {}; this.pointers = new Map();this.pedalPulse={gas:0,brake:0};
    this.buttons = []; this.hover = null; this.toast = null; this.particles = [];
    this.honkUntil = 0; this.flashes = []; this.landingKick = 0; this.coinPulse = 0;
    this.previewVehicle = this.save.vehicle;this.fleetPage=Math.floor(this.previewVehicle/3);this.previewCharacter=this.save.character;this.garagePart='engine'; this.renderer = new Renderer(this);
    this.terrain = new Terrain(getRoute(this.save.route).difficulty,getRoute(this.save.route).biome,getRoute(this.save.route).spec);
    this.car = null; this.result = null; this.camera = { x: 0, y: 0 };
    this.mechanics = null;
    this.advanceRemaining = null; this.backgrounded = false; this.garageFromPause = false;
    this.attempts=new Map();for(const a of this.save.attemptHistory||[])this.attempts.set(a.route,a);this.garageFocus=null;
    this.campaignScroll=null;this.mapVelocity=0;this.mapPointer=null;
    this.runTime=0;this.trial=null;this.goal = 900; this.combo = 0; this.cleanLandings = 0; this.lastLandingX = 0; this.pop = null;
    this.telemetry=new Telemetry(platform);this.telemetry.track('session_start',{route:this.save.route,runs:this.save.runs});
    platform.on('down', (id, p) => this.pointerDown(id, p));
    platform.on('move', (id, p) => this.pointerMove(id, p));
    platform.on('up', (id, p) => this.pointerUp(id, p));
    platform.on('cancel', id => { this.mechanics?.cancelStoneDrag(id);if(this.mapPointer===id){this.mapPointer=null;this.mapVelocity=0;}this.pointers.delete(id); this.syncInput(); });
    platform.on('wheel', (delta,p) => {
      if(this.screen!=='campaign'||this.modal||this.mapPointer!==null)return false;
      const m=this.renderer.campaignLayout();if(!this.inMap(p,m))return false;
      this.campaignScroll=clamp(m.scroll-delta/m.gap,0,m.maxScroll);this.mapVelocity=0;return true;
    });
    platform.on('keydown', key => this.keyDown(key));
    platform.on('keyup', key => { delete this.keys[key]; this.syncInput(); });
    platform.on('hide', () => { this.backgrounded=true; if (this.screen === 'playing') this.pause(); this.clearInput(); this.lastFrame = null; });
    platform.on('show', () => { this.backgrounded=false; this.lastFrame=null; });
    platform.on('resize', () => { this.clearInput(); this.lastFrame = null; });
  }
  persist() {
    if (!this.platform.save(this.save)) this.notify('暂时无法保存进度，请检查设备存储空间');
  }
  sound(name) { this.platform.sound(name, this.save.sound); }
  notify(message) { this.toast = { message, until: this.time + 3 }; }
  clearInput() { this.mechanics?.cancelStoneDrag();this.keys = {}; this.pointers.clear();this.pedalPulse.gas=0;this.pedalPulse.brake=0; this.input.gas = false; this.input.brake = false;if(this.car)this.car.reversing=false;this.mapPointer=null;this.mapVelocity=0; }
  syncInput() {
    if (this.screen !== 'playing' || this.modal || this.mechanics?.onFoot) { this.input.gas = false; this.input.brake = false; return; }
    const touches = Array.from(this.pointers.values());
    this.input.gas = !!(this.keys.d || this.keys.arrowright || this.keys.arrowup || this.pedalPulse.gas>this.time || touches.some(p => p.action === 'gas'));
    this.input.brake = !!(this.keys.a || this.keys.arrowleft || this.keys.arrowdown || this.pedalPulse.brake>this.time || touches.some(p => p.action === 'brake'));
  }
  hit(p) { return this.buttons.slice().reverse().find(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h); }
  worldPoint(p) {const z=this.viewZoom();return {x:p.x/z+this.camera.x,y:p.y/z+this.camera.y};}
  inMap(p,m) {return p&&p.x>=m.left&&p.x<=m.mapRight&&p.y>=m.top&&p.y<=m.bottom;}
  moveMap(entry,p) {
    if(Math.hypot(p.x-entry.start.x,p.y-entry.start.y)>12)entry.dragged=true;
    if(!entry.dragged)return;
    const m=this.renderer.campaignLayout(),dy=p.y-entry.last.y,dt=clamp(this.time-entry.at,1/120,.08);
    const next=clamp(entry.offset+(p.y-entry.start.y)/m.gap,0,m.maxScroll);
    this.mapVelocity=next===0||next===m.maxScroll?0:clamp(dy/m.gap/dt,-9,9);
    this.campaignScroll=next;entry.last=p;entry.at=this.time;
  }
  pointerDown(id, p) {
    if(this.save.sound)this.platform.unlockAudio?.();
    if(this.screen==='campaign'&&this.mapPointer!==null){this.pointers.set(id,{map:true,ignored:true});return;}
    const hit = this.hit(p);
    if(this.screen==='campaign'&&!this.modal){
      const m=this.renderer.campaignLayout();
      if(this.inMap(p,m)){
        const ignored=this.mapPointer!==null;
        this.pointers.set(id,{action:hit?.action||'',start:p,last:p,offset:m.scroll,at:this.time,map:true,ignored,dragged:Math.abs(this.mapVelocity)>.15});
        if(!ignored){this.mapPointer=id;this.mapVelocity=0;}return;
      }
      this.mapVelocity=0;
    }
    if(hit&&['gas','brake'].includes(hit.action))this.pedalPulse[hit.action]=0;
    this.pointers.set(id, { action: hit ? hit.action : '', start: p,at:this.time });
    this.syncInput();
    if(hit?.action==='jump'){
      const entry=this.pointers.get(id);if(entry)entry.fired=true;
      this.action('jump');
    }
    if(hit?.action==='stoneDrag')this.mechanics?.beginStoneDrag(id,this.worldPoint(p));
  }
  pointerMove(id, p) {
    const hit = this.hit(p); this.hover = hit ? hit.action : null;
    if (!this.platform.native&&this.platform.canvas?.style) this.platform.canvas.style.cursor = hit ? 'pointer' : this.screen==='campaign'?'grab':'default';
    if (this.pointers.has(id)) {
      const entry = this.pointers.get(id);
      if(entry.map){if(!entry.ignored&&this.screen==='campaign'&&!this.modal)this.moveMap(entry,p);return;}
      if(entry.action==='stoneDrag'){this.mechanics?.moveStone(id,this.worldPoint(p));return;}
      if (entry.action === 'gas' || entry.action === 'brake' || (hit && (hit.action === 'gas' || hit.action === 'brake'))) {
        const pedalHit=hit&&['gas','brake'].includes(hit.action)?hit:null;
        const held=this.buttons.find(b=>b.action===entry.action);
        const margin=28;
        const insideHeld=held&&p.x>=held.x-margin&&p.x<=held.x+held.w+margin&&p.y>=held.y-margin&&p.y<=held.y+held.h+margin;
        // A thumb naturally drifts near the edge of a large pedal. Keep the
        // captured pedal until it leaves a small hysteresis area, while still
        // allowing an intentional slide directly onto the opposite pedal.
        if(pedalHit)entry.action=pedalHit.action;
        else if(!insideHeld)entry.action='';
      }
      this.syncInput();
    }
  }
  pointerUp(id, p) {
    const entry = this.pointers.get(id), hit = this.hit(p);
    if(entry?.map){
      if(this.modal||this.screen!=='campaign'){this.pointers.delete(id);if(this.mapPointer===id){this.mapPointer=null;this.mapVelocity=0;}return;}
      if(!entry.ignored&&p&&Math.hypot(p.x-entry.start.x,p.y-entry.start.y)>12&&!entry.dragged)this.moveMap(entry,p);
      this.pointers.delete(id);
      if(entry.ignored)return;
      this.mapPointer=null;
      if(this.time-entry.at>.1)this.mapVelocity=0;
      if(!entry.dragged&&hit&&entry.action===hit.action&&hit.action.startsWith('route:'))this.action(hit.action);
      return;
    }
    this.pointers.delete(id);
    if(entry&&hit&&entry.action===hit.action&&['gas','brake'].includes(entry.action)&&this.time-(entry.at??this.time)<.18&&!Array.from(this.pointers.values()).some(v=>['gas','brake'].includes(v.action)))this.pedalPulse[entry.action]=this.time+.18;
    this.syncInput();
    if(entry?.action==='stoneDrag'){this.mechanics?.dropStone(id,this.worldPoint(p));return;}
    if (entry && !entry.fired && hit && entry.action === hit.action && !['gas', 'brake'].includes(hit.action)) this.action(hit.action);
  }
  keyDown(key) {
    if(this.save.sound)this.platform.unlockAudio?.();
    this.keys[key] = true;
    if (key === ' ' || key === 'escape' || key === 'p') {
      if (this.modal) { this.modal = null; this.clearInput(); }
      else if (this.screen === 'playing') this.pause();
      else if (this.screen === 'paused') this.resume();
    }
    if (key === 'enter') {
      if (this.screen === 'result') this.action(this.resultAction());
      else if (this.screen === 'home') this.action('mode:'+this.save.playMode);
      else if(['campaign'].includes(this.screen))this.newRun();
      else if (this.screen === 'paused') this.resume();
    }
    if (['home', 'garage', 'routes', 'campaign'].includes(this.screen)) {
      if (key === 'g') this.action('garage');
      if (key === 'm') this.action('routes');
      if (key === 'h') this.action('home');
      if (key === '?') this.action('help');
    }
    this.syncInput();
  }
  action(action) {
    if(this.screen==='result'&&['retry','tune','next','campaign','home'].includes(action))this.telemetry.track('result_action',{action,route:this.save.route,complete:!!this.result?.complete,reason:this.result?.reason||''});
    if (action !== 'sound' && action !== 'honk' && action !== 'jump') this.sound('click');
    if (['home', 'garage', 'routes', 'campaign', 'characters', 'records'].includes(action)) {
      // 保留选关；地图只有已通关节点与下一关可挑战。
      this.garageFromPause = action==='garage'&&this.screen==='paused'||this.garageFromPause&&(action==='characters'&&this.screen==='garage'||action==='garage'&&this.screen==='characters');
      this.advanceRemaining=null;
      this.screen = action==='routes'?'campaign':action; this.modal = null; this.clearInput();
      this.garageFocus=null;
      this.previewVehicle = this.save.vehicle;this.fleetPage=Math.floor(this.previewVehicle/3);this.previewCharacter=this.save.character;this.campaignScroll=null;this.mapSummary=null;
      if(action==='records')this.recordsPage=Math.floor(mapFrontier(this.save)/6);
    } else if(action==='returnToPause'&&this.garageFromPause&&this.screen==='garage'){
      this.screen='paused';this.garageFromPause=false;this.modal=null;this.clearInput();
    } else if(action==='resumeFromGarage'&&this.garageFromPause&&this.screen==='garage'){
      if(!this.save.owned.includes(this.previewVehicle)){this.notify('先购买「'+VEHICLES[this.previewVehicle].name+'」再继续');return;}
      this.garageFromPause=false;this.modal=null;this.resume();
    } else if(action==='tune'&&this.screen==='result'&&this.result){
      this.garageFocus={route:this.save.route,...this.result.advice};this.advanceRemaining=null;
      this.screen='garage';this.modal=null;this.previewVehicle=this.save.vehicle;this.fleetPage=Math.floor(this.previewVehicle/3);this.garagePart=this.garageFocus.part;this.clearInput();
    } else if (action === 'start' || action === 'retry' || action === 'quickStart') {
      if(action==='start'&&this.screen==='garage'&&!this.save.owned.includes(this.previewVehicle)){
        this.notify('先购买「'+VEHICLES[this.previewVehicle].name+'」再出发');return;
      }
      this.newRun();
    }
    else if (action === 'next' && this.selectNextRoute()) this.newRun();
    else if (action === 'jump') this.jump();
    else if (action === 'pause') this.pause();
    else if (action === 'resume') this.resume();
    else if (action.startsWith('mode:')) { this.save.playMode='stage';this.screen='campaign';this.modal=null;this.clearInput();this.campaignScroll=null;this.mapSummary=null;this.persist(); }
    else if(action.startsWith('recordsPage:')&&this.screen==='records'){
      const page=Number(action.split(':')[1]);if(Number.isInteger(page))this.recordsPage=clamp(page,0,Math.floor(mapFrontier(this.save)/6));
    }
    else if(action==='pinVehicle'&&!this.save.owned.includes(this.previewVehicle)){this.save.goalVehicle=this.previewVehicle;this.persist();this.notify('已设为攒币目标');}
    else if(action.startsWith('routeInfo:')){const i=Number(action.split(':')[1]);if(getRoute(i)){this.infoRoute=i;this.modal='routeInfo';}}
    else if(action.startsWith('modInfo:')){const [,part,id]=action.split(':');if(SPECIALIZATIONS[part]?.some(m=>m.id===id)){this.modInfo={part,id};this.modal='modInfo';}}
    else if(action.startsWith('branch:')){const id=action.split(':')[1];if(SPECIALIZATIONS[id]){this.branchPart=id;this.modal='branch';}}
    else if(action.startsWith('mod:')){
      const [,id,choice]=action.split(':'),mods=SPECIALIZATIONS[id];if(!mods)return;
      const mod=mods.find(m=>m.id===choice);if(choice!=='stock'&&!mod)return;
      const gate=specializationGate(this.save,this.previewVehicle,id,mod);if(gate){this.notify(gate);return;}
      const build=upgradesFor(this.save,this.previewVehicle);build.mods=Object.assign({},build.mods);
      if(mod)build.mods[id]=mod.id;else delete build.mods[id];this.persist();this.refreshPausedCar();this.notify(mod?'已装配 '+mod.name:'已恢复标准配置');
    }
    else if (action.startsWith('test:')) {const id=action.split(':')[1];if(UPGRADES.some(u=>u.id===id)){this.trial=compareUpgrade(id,previewBuild(this.save,this.previewVehicle),this.previewVehicle);this.trialStart=this.time;this.modal='test';}}
    else if(action==='workshopInfo'&&this.screen!=='characters')this.modal='workshopInfo';
    else if(action.startsWith('inspect:')){const part=action.split(':')[1];if(UPGRADES.some(u=>u.id===part))this.garagePart=part;}
    else if(action==='rewardInfo'&&this.screen==='result')this.modal='rewardInfo';
    else if(action==='holdResult'&&this.screen==='result')this.advanceRemaining=null;
    else if (action === 'testAgain') this.trialStart=this.time;
    else if (action === 'help') this.modal = 'help';
    else if(action==='audioTest'){this.save.sound=true;this.platform.unlockAudio?.();this.sound('coin');this.persist();this.notify('已开启声音 · 试听金币声');}
    else if(action.startsWith('character:')){const i=Number(action.split(':')[1]);if(Number.isInteger(i)&&CHARACTERS[i])this.previewCharacter=i;}
    else if(action==='equipCharacter'){
      const i=this.previewCharacter,spec=CHARACTERS[i];if(!spec)return;
      if(!this.save.ownedCharacters.includes(i)){
        if(this.save.coins<spec.price){this.notify('还差 '+(spec.price-this.save.coins)+' 金币');return;}
        this.save.coins-=spec.price;this.save.ownedCharacters.push(i);
      }
      this.save.character=i;this.persist();this.notify(spec.tag+' 已上车');
    }
    else if (action === 'honk') { this.honkUntil = this.time + 1; this.sound('horn'); }
    else if(action==='driver'&&this.mechanics)this.mechanics.toggleDriver();
    else if (action === 'close') this.modal = null;
    else if (action === 'sound') { this.save.sound = !this.save.sound; if (!this.save.sound) this.platform.silence(); else {this.platform.unlockAudio?.();this.sound('click');} this.persist(); }
    else if (action.startsWith('route:')) { const index=Number(action.split(':')[1]);if(!stageUnlocked(this.save,index)){this.notify('先通关第 '+(mapFrontier(this.save)+1)+' 关');return;}this.save.route=index; this.terrain = new Terrain(getRoute(index).difficulty,getRoute(index).biome,getRoute(index).spec); this.persist(); }
    else if(action.startsWith('fleet:')){const step=Number(action.split(':')[1]);if(step===-1||step===1)this.fleetPage=clamp((this.fleetPage||0)+step,0,Math.ceil(VEHICLES.length/3)-1);}
    else if (action.startsWith('vehicle:')) {const index=Number(action.split(':')[1]);if(Number.isInteger(index)&&VEHICLES[index]){
      this.previewVehicle=index;this.fleetPage=Math.floor(index/3);
      if(this.screen==='garage'&&this.save.owned.includes(index)&&this.save.vehicle!==index){
        this.save.vehicle=index;this.save.upgrades=upgradesFor(this.save,index);this.persist();
        this.refreshPausedCar();
        this.notify('已换上「'+VEHICLES[index].name+'」');
      }
    }}
    else if (action === 'equip') {
      const i = this.previewVehicle, spec = VEHICLES[i];
      let purchased=false;
      if (!this.save.owned.includes(i)) {
        if (this.save.coins < spec.price) { this.notify('还差 ' + (spec.price - this.save.coins) + ' 金币，去山路上收集吧'); return; }
        this.save.builds[i]=purchaseBuild(this.save);
        this.save.coins -= spec.price; this.save.owned.push(i);purchased=true;
      }
      this.save.vehicle = i; this.save.upgrades=upgradesFor(this.save,i); this.persist(); this.refreshPausedCar(); this.notify((purchased?'已购入并换上':'已换上')+'「' + spec.name + '」');
    } else if (action.startsWith('upgrade:')) {
      const id = action.split(':')[1],build=upgradesFor(this.save,this.previewVehicle),level=build[id];
      if(!this.save.owned.includes(this.previewVehicle)){this.notify('先拥有这辆车，再为它改装');return;}
      if (!UPGRADES.some(u => u.id === id) || level >= MAX_LEVEL) return;
      const gate=upgradeGate(this.save,level);if(gate){this.notify(gate);return;}
      const cost = upgradeCost(level);
      if (this.save.coins < cost) { this.notify('还差 ' + (cost - this.save.coins) + ' 金币，完成一趟冒险就能积累'); return; }
      const before=upgradePreview(id,build,this.previewVehicle);
      this.save.coins -= cost; build[id]++; this.persist(); this.refreshPausedCar(); this.sound('coin');
      this.telemetry.track('upgrade_purchase',{part:id,vehicle:this.previewVehicle,level:build[id],cost,balance:this.save.coins});
      this.upgradeReveal={vehicle:this.previewVehicle,part:id,at:this.time};
      const unlocked=SPECIALIZATIONS[id].find(m=>m.level===build[id]&&!specializationGate(this.save,this.previewVehicle,id,m));
      this.notify(unlocked?'专精已解锁：'+unlocked.name+' · 点部件下方切换':before.rows[0][0]+' '+before.rows[0][1]+' → '+before.rows[0][2]);if(this.modal==='test'){this.modal=null;this.trial=null;}
    }
  }
  refreshPausedCar() {
    if(!this.garageFromPause||!this.car)return;
    const car=this.car,oldRadius=car.stats.wheelRadius,fuelRatio=car.fuelMax>0?car.fuel/car.fuelMax:0;
    car.spec=VEHICLES[this.save.vehicle];car.upgrades={...this.save.upgrades,mods:{...(this.save.upgrades.mods||{})}};
    car.stats=vehicleStats(car.upgrades,this.save.vehicle);
    car.y+=oldRadius-car.stats.wheelRadius;
    car.fuelMax=car.stats.fuel;car.fuel=Math.min(car.fuelMax,Math.max(0,fuelRatio*car.fuelMax));
    car.wheels=[];car.contacts=0;this.previousPose=null;this.accumulator=0;
  }
  jump() {
    if(this.screen!=='playing'||this.modal||this.mechanics?.onFoot||!this.car||this.time<(this.jumpReadyAt||0))return false;
    if(!this.car.hop())return false;
    this.runStarted=true;
    this.jumpReadyAt=this.time+1.15;this.sound('rush');this.platform.vibrate();this.pop={text:'主动跳跃',until:this.time+.7};return true;
  }
  resultAction() {
    if(!this.result?.complete)return 'retry';
    return stageUnlocked(this.save,this.save.route+1)?'next':'campaign';
  }
  selectNextRoute() {
    if(this.screen!=='result'||!this.result?.complete||!stageUnlocked(this.save,this.save.route+1))return false;
    this.save.route++;this.advanceRemaining=null;this.persist();return true;
  }
  worldRoute() {return getRoute(this.save.route).biome;}
  routeSpec() {return getRoute(this.save.route);}
  viewZoom() {return this.platform.portrait?1.22:1.48;}
  renderPose() {
    const c=this.car,p=this.previousPose;
    if(!c||!p||this.screen!=='playing'||Math.abs(c.x-p.x)>80||Math.abs(c.y-p.y)>80)return c;
    const a=clamp(this.accumulator/STEP,0,1),angle=p.angle+Math.atan2(Math.sin(c.angle-p.angle),Math.cos(c.angle-p.angle))*a;
    return {x:lerp(p.x,c.x,a),y:lerp(p.y,c.y,a),angle,wheelSpin:lerp(p.wheelSpin,c.wheelSpin,a),wheels:c.wheels.map((w,i)=>({...w,compression:lerp(p.wheels[i]||0,w.compression,a)}))};
  }
  newRun() {
    if(!stageUnlocked(this.save,this.save.route)){this.screen='campaign';return;}
    this.advanceRemaining=null;this.garageFromPause=false;
    this.clearInput(); this.modal = null; this.screen = 'playing';
    
    const route=getRoute(this.save.route),variant=this.save.roadVariants[this.save.route]||0;
    this.terrain = new Terrain(route.difficulty,route.biome,{...route.spec,variant});
    this.car = new Car(this.terrain, this.save.upgrades, this.save.vehicle);
    this.previousPose=null;
    this.camera = { x: this.car.x - this.platform.width * .29 / this.viewZoom(), y: this.car.y - this.platform.height * .54 / this.viewZoom() };
    this.mechanics = new RacingMechanics(this);
    this.runTime=0;this.runStarted=false;this.runWait=0;this.jumpReadyAt=0;
    this.goal = getRoute(this.save.route).goal; this.combo = 0; this.cleanLandings = 0;
    this.lastLandingX = 0; this.pop = null;
    this.collected = new Set();this.stationDraws=new Map();this.refueling=null;this.refuelTime=0;this.refuelAdded=0;this.refuelSoundAt=-10; this.runCoins = 0; this.airBonus = 0; this.particles = [];
    this.flashes = []; this.landingKick = 0; this.coinPulse = 0;
    this.accumulator = 0; this.settled = false; this.result = null; this.finishRibbon = null; this.milestone = 0;this.progressMark=0;
    this.telemetry.track('run_start',{route:this.save.route,vehicle:this.save.vehicle,retry:this.attempts.has(this.save.route),build:{...this.save.upgrades,mods:{...(this.save.upgrades.mods||{})}}});
    this.sound('start');
  }
  rookieChallenge() {
    return null;
  }
  pause() {
    this.screen = 'paused'; this.clearInput();this.platform.silence?.();
  }
  resume() { this.screen = 'playing'; this.clearInput(); this.lastFrame = null; }
  finish(reason, complete = false, animate = false) {
    if (!this.car || this.settled) return;
    this.platform.stopDrivingSound?.();
    this.settled = true; this.clearInput();
    const distance = Math.floor(this.car.distance),route=getRoute(this.save.route);
    const distanceReward=Math.floor(distance/50),mechanismBonus=this.mechanics?this.mechanics.bonus:0;
    const bonus=this.airBonus+mechanismBonus,cargo=this.runCoins+bonus;

    const stars=0,starReward=0,mission=contractProgress(this);
    const contractReward=complete&&this.save.route>0&&mission.cleanMet&&!this.save.contracts[this.save.route]?route.contractReward:0;
    if(contractReward)this.save.contracts[this.save.route]=true;
    const firstReward=complete&&!this.save.firstClears[this.save.route]?route.firstReward:0;
    const goalReward=complete?40:0;
    this.save.lifetimeDistance+=distance;
    let milestoneReward=0;
    MILESTONES.forEach((m,i)=>{if(this.save.lifetimeDistance>=m.distance&&!this.save.milestones.includes(i)){milestoneReward+=m.reward;this.save.milestones.push(i);}});
    const completionReward=complete?route.masteryReward:0;
    // 旧结果字段是兼容别名；到站奖励与一次性驾驶挑战奖励分别计算。
    const masteryReward=completionReward;
    if(complete)this.save.firstClears[this.save.route]=true;
    const chapter=route.chapter,chapterDone=this.save.firstClears.slice(chapter*3,chapter*3+3).every(Boolean);
    const chapterReward=complete&&chapterDone&&!this.save.chapterClaims.includes(chapter)?(CHAPTER_REWARDS[chapter]||0):0;
    if(chapterReward)this.save.chapterClaims.push(chapter);
    const recurringReward=cargo+distanceReward+goalReward+masteryReward;
    const oneTimeReward=contractReward+chapterReward+firstReward+starReward+milestoneReward;
    const total=recurringReward+oneTimeReward;
    const record=distance>this.save.best;
    const personalBest=complete&&(!this.save.bestTimes[this.save.route]||this.runTime<this.save.bestTimes[this.save.route]);
    if(personalBest)this.save.bestTimes[this.save.route]=this.runTime;
    const previous=this.attempts.get(this.save.route),fuelPercent=this.car.fuel/this.car.fuelMax*100;
    const reviewReason=chapterReward?'章节完成 · 新改装等级开放':firstReward?'首次到站 · 下一条路线已解锁':'';
    this.result={route:this.save.route,previous,reviewReason,advice:drivingAdvice(this,complete),fuelPercent,hits:this.mechanics.hits,completionReward,masteryReward,recurringReward,oneTimeReward,portalUses:this.mechanics.portalUses,gravityUses:this.mechanics.gravityUses,contractReward,chapterReward,contractMet:complete,contractLabel:mission.label,missionMet:complete&&mission.cleanMet,mission:mission.task,flows:this.mechanics.flowTriggers,time:this.runTime,personalBest,distance,coins:this.runCoins,bonus,distanceReward,goalReward,firstReward,starReward,milestoneReward,total,record,reason,complete,stars};
    const attempt={route:this.save.route,roadVariant:this.terrain.profile.variant||0,time:this.runTime,fuelPercent,hits:this.mechanics.hits,complete,distance,reason,vehicle:this.save.vehicle,strainTime:this.car.strainTime};
    this.attempts.set(this.save.route,attempt);
    this.save.attemptHistory=[...(this.save.attemptHistory||[]),attempt].slice(-20);
    if(complete)this.save.firstClears[this.save.route]=true;
    this.save.best=Math.max(this.save.best,distance);
    this.save.routeBests[this.save.route]=Math.max(this.save.routeBests[this.save.route]||0,distance);
    this.result.roadVariant=this.terrain.profile.variant||0;
    if(complete)this.save.roadVariants[this.save.route]=(this.result.roadVariant+1)%4;
    this.save.coins+=total;this.save.runs++;this.persist();this.screen='result';
    this.finishRibbon=complete&&animate?{started:this.time,duration:1.15}:null;
    this.telemetry.track('run_end',{route:this.save.route,complete,reason,distance,time:this.runTime,hits:this.mechanics.hits,fuelPercent,total,completionReward});
    this.advanceRemaining=null;
    this.sound('finish'); this.platform.vibrate();
  }
  burst(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) this.particles.push({ x, y, vx: (Math.random() - 0.5) * 150, vy: -40 - Math.random() * 100, life: 0.65, max: 0.65, color, size: 2 + Math.random() * 3 });
  }
  land() {
    const car = this.car;
    this.landingKick = Math.min(1, car.landing);
    this.burst(car.x, this.terrain.height(car.x) - 4, '#e8cda2', 12);
    const slopeAngle = Math.atan(car.supportSlope());
    const error = Math.abs(Math.atan2(Math.sin(car.angle - slopeAngle), Math.cos(car.angle - slopeAngle)));
    if (error > .48 || Math.abs(car.omega) > 2.6) { this.sound('landing');this.combo = 0; this.mechanics.breakFlow(); this.pop = { text: '晃了一下', until: this.time + 1 }; return; }
    // 必须继续向前，避免在同一个坡上反复领取落地奖励。
    if (car.x < this.lastLandingX + 180) {this.sound('landing');return;}
    this.sound('clean-land');
    this.lastLandingX = car.x; this.cleanLandings++;
    this.combo = Math.min(this.combo + 1, 5);
    this.airBonus += 2 * this.combo;

    this.pop = { text: '稳落 ×' + this.combo, until: this.time + 1.4 };
    this.coinPulse = 1;
    this.mechanics.cleanLanding();
  }
  stationRemaining(station) {
    return Math.max(0,station.fuelUnits-station.quickFuel-(this.stationDraws?.get(station.id)||0));
  }
  nearbyFuelStation() {
    const c=this.car;
    return fuelStops(this.terrain,c.x-115,c.x+115).find(s=>s.station&&Math.abs(s.y-(c.y-12))<110&&c.contacts>0);
  }
  parkForFuel() {
    const c=this.car;
    if(!this.input.brake||!this.input.gas||Math.abs(c.angle)>=.65)return false;
    const station=this.nearbyFuelStation();return !!station&&this.stationRemaining(station)>.001;
  }
  serviceFuel(dt) {
    this.refueling=null;
    const c=this.car;
    if(this.screen!=='playing'||this.modal||this.backgrounded||!c||c.dead||this.mechanics?.onFoot)return;
    const station=this.nearbyFuelStation();
    if(!station)return;
    const remaining=this.stationRemaining(station),room=Math.max(0,c.fuelMax-c.fuel);
    const ready=this.input.brake&&this.input.gas&&!c.reversing&&Math.abs(c.vx)<70&&Math.abs(c.angle)<.65;
    const state=remaining<.001?'empty':room<.02?'full':ready?'pumping':'brake';
    this.refueling={station,state,remaining};
    if(state!=='pumping')return;
    // The quick can and the finite pump reservoir are separate. Holding longer
    // buys fuel with time; backing out never resets the station's inventory.
    const added=Math.min(room,remaining,dt*12);
    c.fuel=Math.min(c.fuelMax,c.fuel+added);c.stallTime=0;
    this.stationDraws.set(station.id,(this.stationDraws.get(station.id)||0)+added);
    this.refuelTime+=dt;this.refuelAdded+=added;this.refueling.remaining-=added;
    if(this.runTime-this.refuelSoundAt>1.2){this.sound('refuel');this.refuelSoundAt=this.runTime;}
  }
  update(dt) {
    this.time += dt;
    if((this.pedalPulse.gas&&this.pedalPulse.gas<=this.time)||(this.pedalPulse.brake&&this.pedalPulse.brake<=this.time))this.syncInput();
    if(this.screen==='campaign'&&!this.modal&&!this.backgrounded&&this.mapPointer===null&&Math.abs(this.mapVelocity)>.005){
      const m=this.renderer.campaignLayout(),decay=Math.exp(-7*Math.min(dt,.05));
      this.campaignScroll=clamp(m.scroll+this.mapVelocity*(1-decay)/7,0,m.maxScroll);
      this.mapVelocity*=decay;
      if(this.campaignScroll===0||this.campaignScroll===m.maxScroll)this.mapVelocity=0;
    }
    const c=this.car,m=this.mechanics;
    let road='dirt';
    if(c&&m){
      const feature=this.terrain.roadFeatures.find(f=>c.x>=f.x&&c.x<=f.end);
      const surface=this.terrain.surface(c.x).name;
      road=({wave:'wave',ribs:'ribs',sponge:'sponge',tilt:'tilt',heave:'tilt',slick:'slick',rough:'ribs'})[feature?.kind]||({松沙:'sand',积雪:'snow',泥地:'mud',黏性沼泽:'mud'})[surface]||'dirt';
      if(m.gum&&c.x>=m.gum.x&&c.x<=m.gum.end)road='sponge';
    }
    this.platform.drivingSound?.({active:this.screen==='playing'&&!this.modal&&!this.backgrounded&&!!c&&!c.dead&&!m?.onFoot,enabled:this.save.sound,speed:c?.vx||0,gas:!!this.input.gas!==!!this.input.brake,brake:!!this.input.gas&&!!this.input.brake,fuel:c?.fuel||0,grounded:c?.contacts>0,slope:c?this.terrain.slope(c.x):0,road,vehicle:this.save.vehicle},dt);
    this.coinPulse = Math.max(0, this.coinPulse - dt * 4);
    this.landingKick *= Math.exp(-dt * 9);
    this.flashes = this.flashes.filter(f => this.time - f.at < .8);
    if (this.toast && this.time > this.toast.until) this.toast = null;
    if(this.screen==='result'&&this.advanceRemaining!==null&&!this.backgrounded&&!this.modal){
      this.advanceRemaining=Math.max(0,this.advanceRemaining-Math.min(dt,.1));
      if(this.advanceRemaining<.00001)this.action('next');
      return;
    }
    if (this.screen !== 'playing') return;
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator >= STEP && this.screen === 'playing') {
      this.runWait+=STEP;
      if(!this.runStarted&&(this.input.gas||this.input.brake||this.runWait>=8||this.car.distance>0||Math.abs(this.car.x-START_X)>20||Math.abs(this.car.angle)>1))this.runStarted=true;
      this.previousPose={x:this.car.x,y:this.car.y,angle:this.car.angle,wheelSpin:this.car.wheelSpin,wheels:this.car.wheels.map(w=>w.compression)};
      this.terrain.update(STEP,this.car);
      if (this.runStarted&&this.mechanics) this.mechanics.beforeStep(STEP);
      else this.car.burnScale=0;
      if(this.runStarted)this.runTime += STEP;
      if(!this.mechanics.onFoot){this.car.step(STEP, {...this.input,park:this.parkForFuel()});if(this.runStarted)this.mechanics.afterStep();}
      this.accumulator -= STEP;
      if (this.car.landing > 0) this.land();
      const radius = 90;
      for (const item of this.runStarted?collectibles(this.car.x - radius, this.car.x + radius, this.terrain):[]) {
        if (!this.collected.has(item.id) && Math.hypot(item.x - this.car.x, item.y - (this.car.y - 12)) < (item.type === 'coin' ? 66 : 72)) {
          this.collected.add(item.id);
          if (item.type === 'coin') { this.runCoins += 1; this.coinPulse = 1; this.flashes.push({ x: item.x, y: item.y, at: this.time }); this.sound('coin'); this.burst(item.x, item.y, '#eabd53', 5); this.mechanics.charge(3); }
          else { const before=this.car.fuel;this.car.fuel = Math.min(this.car.fuelMax, this.car.fuel + (item.station?item.quickFuel:item.fuelUnits)); this.sound('refuel');if(item.station)this.refuelSoundAt=this.runTime; this.burst(item.x, item.y, '#ed9a83', 12);const gained=Math.floor(this.car.fuel-before);if(gained>0)this.pop={text:'补给 +'+gained+' · 油量 '+Math.ceil(this.car.fuel/this.car.fuelMax*100)+'%',until:this.time+2}; }
        }
      }
      if(this.runStarted){
        this.serviceFuel(STEP);
        this.mechanics.adventureStep(STEP);
        const progress=Math.min(3,Math.floor(this.car.distance/this.goal*4));
        if(progress>this.progressMark){this.progressMark=progress;if(!this.pop||this.pop.until<=this.time)this.pop={text:'已到 '+progress*25+'% · 还剩 '+Math.max(0,Math.ceil(this.goal-this.car.distance))+'m',until:this.time+2};}
        if (this.car.distance >= this.goal) this.finish('到站啦',true,true);
        else if (this.car.dead) this.finish(this.car.reason);
      }
    }
    // 同一局保留已收集标识，倒车经过旧路段也不能重复领取。
    const h = this.platform.height,pose=this.renderPose();
    const lookAhead=clamp(Math.max(0,pose.vx||this.car.vx)/this.car.stats.maxSpeed,0,1)*48/this.viewZoom();
    this.camera.x = lerp(this.camera.x, pose.x - this.platform.width * .29 / this.viewZoom()+lookAhead, 1 - Math.exp(-dt * 6));
    this.camera.y = lerp(this.camera.y, pose.y - h * .54 / this.viewZoom(), 1 - Math.exp(-dt * 2.5));
    const speed=Math.abs(this.car.vx),dustRate=12+speed*.055;
    if (this.car.contacts && speed > 45 && Math.random() < dt * dustRate) this.particles.push({ x: this.car.x-36-Math.random()*20, y: this.terrain.height(this.car.x-42)-3, vx: -this.car.vx*(.17+Math.random()*.08), vy: -22-Math.random()*35, life: .82, max: .82, color: '#c8b798', size: 4+Math.random()*9 });
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.life -= dt; }
    this.particles = this.particles.filter(p => p.life > 0).slice(-160);
    if (this.mechanics) this.mechanics.updateEffects(dt);
  }
  startLoop() {
    const tick = now => {
      if(this.backgrounded){this.lastFrame=null;this.platform.raf(tick);return;}
      const dt = this.lastFrame === null ? 0 : clamp((now - this.lastFrame) / 1000, 0, 0.1);
      this.lastFrame = now; this.update(dt); this.renderer.draw(); this.platform.raf(tick);
    };
    this.platform.raf(tick);
  }
}
module.exports = { Game };
