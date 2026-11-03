// 从 M4 吸收路线节奏和驾驶技能；沿用当前游戏、物理与存档格式。
const { ROUTES, SPECIALIZATIONS, clamp } = require('./config');
const { Terrain } = require('./physics');
const { hillOffset } = require('./course');
const { RacingMechanics } = require('./mechanics');
const { Game } = require('./game');

// 真正的二段跳：首次离地后可在空中立即追加一次较弱冲量。
// 每次腾空只恢复一次，既提供修正落点的操作空间，也不会变成无限飞行。
const AIR_JUMP_IMPULSE=290;
const AIR_JUMP_DELAY=.12;
const GROUND_JUMP_FORWARD=65;
const AIR_JUMP_FORWARD=45;

// Each button press contributes one bounded horizontal impulse. This makes a
// jump read as an up-forward action without adding continuous mid-air thrust.
function jumpForward(game,air=false) {
  const c=game.car,gas=!!game.input.gas,brake=!!game.input.brake;
  const direction=brake&&!gas?-1:gas?1:c.vx<-20?-1:1;
  const neutral=air?22:32,reverse=air?35:48;
  const impulse=gas?(air?AIR_JUMP_FORWARD:GROUND_JUMP_FORWARD):brake?reverse:neutral;
  const cap=Math.max(c.stats.maxSpeed+(c.speedBonus||0),Math.abs(c.vx));
  c.vx=clamp(c.vx+direction*impulse,-cap,cap);
}

const LANDMARKS = [
  { id:'warmup', x:720, end:1650, title:'热身直道', hint:'先熟悉油门和后退' },
  { id:'rollers', x:1650, end:3350, title:'短坡连段', hint:'坡前起跳 · 空中调姿' },
  { id:'leap', x:3350, end:4700, title:'长坡起跳', hint:'对准坡面落地会冲刺' },
  { id:'bridge', x:4700, end:6500, title:'连续起伏', hint:'落稳后再接油门' },
  { id:'finale', x:6500, end:9160, title:'冲线直道', hint:'开到终点即可过关' }
];
const RHYTHM_POINTS = [
  [160,0],[700,-4],[1150,-12],[1500,2],
  [1780,-48],[2070,16],[2370,-72],[2680,20],[3010,-92],[3340,-4],
  [3610,-142],[3920,-182],[4160,-168],[4410,58],[4700,28],
  [5000,-42],[5320,-8],[5650,44],[5980,-35],[6310,12],
  [6660,-38],[7010,-112],[7380,-21],[7770,-95],[8160,12],[8530,-58],[8880,-8],[9300,0]
];
function rhythmOffset(x) {
  if(x<=RHYTHM_POINTS[0][0]||x>=RHYTHM_POINTS[RHYTHM_POINTS.length-1][0])return 0;
  for(let i=1;i<RHYTHM_POINTS.length;i++) {
    const [bx,by]=RHYTHM_POINTS[i];if(x>bx)continue;
    const [ax,ay]=RHYTHM_POINTS[i-1],t=clamp((x-ax)/(bx-ax),0,1),u=t*t*(3-2*t);
    return ay+(by-ay)*u;
  }
  return 0;
}

// 专精按 ID 保存；追加选项不改变已有存档中的选择。
if(!SPECIALIZATIONS.engine.some(m=>m.id==='kinetic'))SPECIALIZATIONS.engine.push({
  id:'kinetic',name:'落地飞轮',plus:'完美落地冲刺 +45%',minus:'基础动力 -6%',
  level:3,stage:1,contract:false,effects:{drive:.94}
});
if(!SPECIALIZATIONS.suspension.some(m=>m.id==='cushion'))SPECIALIZATIONS.suspension.push({
  id:'cushion',name:'缓冲悬挂',plus:'完美落地窗口 +35% · 降低落地旋转冲击',minus:'弹簧刚度 -6%',
  level:3,stage:0,contract:false,effects:{damping:1.12,angularDamping:1.08,spring:.94}
});
// Legacy rhythm remains available for old/generated profiles. The authored
// opening route owns its geometry explicitly and must not receive a second,
// unrelated height layer.
if(!ROUTES[0].spec.authored)ROUTES[0].spec.drivingRhythm={scale:.24,landmarks:LANDMARKS};
const courseHeight=Terrain.prototype.courseHeight;
Terrain.prototype.courseHeight=function(x) {
  const base=courseHeight.call(this,x),rhythm=this.profile.drivingRhythm;
  return rhythm?base-hillOffset(x,this.profile)+rhythmOffset(x)*rhythm.scale:base;
};

const hasMod=(g,part,id)=>g.car?.upgrades?.mods?.[part]===id;
const beforeStep=RacingMechanics.prototype.beforeStep;
RacingMechanics.prototype.beforeStep=function(dt) {
  beforeStep.call(this,dt);
  const g=this.game,c=g.car;
  this.landingSurge=Math.max(0,(this.landingSurge||0)-dt);
  if(g.screen!=='playing'||g.modal||g.backgrounded||c.dead)return;
  if(this.landingSurge>0){
    const flywheel=hasMod(g,'engine','kinetic');
    c.driveScale*=flywheel?1.42:1.28;c.speedBonus+=flywheel?115:80;
  }
};

Game.prototype.land=function() {
  const c=this.car,m=this.mechanics;if(!c||!m)return;
  this.airJumpUsed=false;this.jumpChainActive=false;
  this.landingKick=Math.min(1,c.landing);this.burst(c.x,this.terrain.height(c.x)-4,'#e8cda2',12);
  const cushion=hasMod(this,'suspension','cushion')?1.35:1;
  const slope=Math.atan(c.supportSlope()),error=Math.abs(Math.atan2(Math.sin(c.angle-slope),Math.cos(c.angle-slope)));
  // 碰撞后减轻旋转冲击；空中姿态仍由玩家控制。
  const omega=Math.abs(c.omega);if(cushion>1&&c.contacts>0&&c.landing>0)c.omega*=.82;
  if(error>.48||omega>2.6) {
    this.sound('landing');this.combo=0;m.breakFlow();this.pop={text:'晃了一下',until:this.time+1};return;
  }
  // 同一落点、后退重跳都不能反复刷落地奖励。
  if(c.x<this.lastLandingX+180){this.sound('landing');return;}
  const perfect=c.contacts>0&&c.landing>=.48&&error<=.22*cushion&&omega<=1.35*cushion;
  this.sound('clean-land');this.lastLandingX=c.x;this.cleanLandings++;this.combo=Math.min(this.combo+1,5);
  this.airBonus+=2*this.combo;this.coinPulse=1;m.cleanLanding();
  if(perfect) {
    m.perfectLandings=(m.perfectLandings||0)+1;m.landingRushes=(m.landingRushes||0)+1;m.landingSurge=1.4;
    this.burst(c.x,this.terrain.height(c.x)-8,'#b8f23a',18);
    this.sound('rush');this.platform.vibrate();this.pop={text:'完美落地 · 冲刺！',until:this.time+1.4};
  }else this.pop={text:'稳落 ×'+this.combo,until:this.time+1.4};
};
const jump=Game.prototype.jump;
Game.prototype.jump=function() {
  const c=this.car;
  // 第二次按下在空中立即生效；不依赖地面接触，也不刷新为第三跳。
  if(this.screen==='playing'&&!this.modal&&!this.mechanics?.onFoot&&c&&!c.dead&&c.contacts===0&&c.bodyContacts===0&&c.airtime>=AIR_JUMP_DELAY&&this.jumpChainActive&&!this.airJumpUsed){
    c.vy=Math.max(-600,Math.min(c.vy,0)-AIR_JUMP_IMPULSE);c.y-=4;c.omega*=.75;c.manualHop=true;
    jumpForward(this,true);
    this.airJumpUsed=true;this.jumpChainActive=false;this.runStarted=true;
    if(this.mechanics){this.mechanics.jumpUses=(this.mechanics.jumpUses||0)+1;this.mechanics.airJumpUses=(this.mechanics.airJumpUses||0)+1;}
    this.sound('rush');this.platform.vibrate();this.burst(c.x,c.y+20,'#d9e777',14);
    this.pop={text:'二段跳！',until:this.time+.8};
    return true;
  }
  const jumped=jump.call(this);
  if(jumped&&this.mechanics){
    jumpForward(this,false);
    this.mechanics.jumpUses=(this.mechanics.jumpUses||0)+1;this.mechanics.groundJumpUses=(this.mechanics.groundJumpUses||0)+1;
    this.airJumpUsed=false;this.jumpChainActive=true;
  }
  return jumped;
};
const newRun=Game.prototype.newRun;
Game.prototype.newRun=function() {
  newRun.call(this);
  if(this.screen==='playing'&&this.mechanics){
    this.airJumpUsed=false;this.jumpChainActive=false;
    Object.assign(this.mechanics,{energy:0,boostTime:0,boostUses:0,perfectLandings:0,landingRushes:0,landingSurge:0,jumpUses:0,groundJumpUses:0,airJumpUses:0,lessonComplete:false});
  }
};
const finish=Game.prototype.finish;
Game.prototype.finish=function(reason,complete=false,animate=false) {
  const lesson=this.terrain?.profile?.tutorial?.skillLesson,m=this.mechanics;
  if(complete&&lesson&&m){
    m.lessonComplete=(m.groundJumpUses||0)>=lesson.jumps&&this.cleanLandings>=lesson.landings;
  }
  const settled=this.settled;finish.call(this,reason,complete,animate);
  if(!settled&&this.result&&this.mechanics)Object.assign(this.result,{
    perfectLandings:this.mechanics.perfectLandings||0,landingRushes:this.mechanics.landingRushes||0,jumpUses:this.mechanics.jumpUses||0,
    groundJumpUses:this.mechanics.groundJumpUses||0,airJumpUses:this.mechanics.airJumpUses||0,lessonComplete:this.mechanics.lessonComplete
  });
};
module.exports={LANDMARKS,RHYTHM_POINTS,rhythmOffset,AIR_JUMP_IMPULSE,AIR_JUMP_DELAY,GROUND_JUMP_FORWARD,AIR_JUMP_FORWARD,jumpForward};
