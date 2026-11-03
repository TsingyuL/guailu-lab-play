// Road encounters use the existing jump, physics, rewards and fixed simulation step.
const {Game} = require('./game');
const {Renderer} = require('./renderer');
const {RacingMechanics} = require('./mechanics');
const {STEP,START_X,fuelStops} = require('./physics');
const {clamp} = require('./config');
const {hash,INK} = require('./sketch');

const WARNING_TIME = .7;
const FIRST_WARNING_TIME = 1.15;
const SIZE = {halfWidth:23,height:43};
const FOG_SAFE_GAP = 180;
function fogMeter(game) {
  const m=game.mechanics;if(!m?.fogEnabled)return null;
  if(m.fogDelay>0)return {kind:'fog',progress:0,label:'怪雾追赶 · '+m.fogDelay.toFixed(1)+'s 后出发',color:'#b09ac8'};
  const gap=Math.max(0,m.fogGap),progress=clamp(1-gap/FOG_SAFE_GAP,0,1);
  return {kind:'fog',progress,label:'怪雾追赶 · 距离 '+Math.ceil(gap)+'m',color:gap<30?'#d75f68':'#b09ac8'};
}
function monsterMeter(game) {
  const a=game.mechanics?.monsters?.active;if(!a||a.resolved)return null;
  if(a.state==='warning'){
    const duration=Math.max(.01,a.warningDuration||WARNING_TIME),progress=.35*clamp(1-a.time/duration,0,1);
    return {kind:'monster',progress,label:'小怪预警 · '+Math.max(0,a.time).toFixed(1)+'s',color:'#e6b85c'};
  }
  const gap=Math.max(0,a.x-game.car.x),start=Math.max(1,a.startGap||gap||1);
  return {kind:'monster',progress:.35+.65*clamp(1-gap/start,0,1),label:'小怪接近 · '+Math.ceil(gap/10)+'m',color:'#e78883'};
}
function vehicleOverlap(car,monster,pose=car) {
  const points=[...car.stats.wheelOffsets.map(x=>[x,14,car.stats.wheelRadius]),...car.bodyPoints()];
  const co=Math.cos(pose.angle),si=Math.sin(pose.angle);
  return points.some(([lx,ly,r])=>{
    const x=pose.x+lx*co-ly*si,y=pose.y+lx*si+ly*co;
    const dx=x-clamp(x,monster.x-SIZE.halfWidth,monster.x+SIZE.halfWidth);
    const dy=y-clamp(y,monster.y-SIZE.height,monster.y-5);
    return dx*dx+dy*dy<r*r;
  });
}
class MonsterEncounters {
  constructor(game) {
    this.game=game;this.active=null;this.furthest=START_X;
    // The first two routes teach jumping and landing before monsters appear.
    this.nextAt=START_X+850;
    this.cooldown=0;this.sequence=0;this.launched=0;this.hits=0;this.dodges=0;
  }
  seed() {return this.game.save.route*71+(this.game.terrain.profile.variant||0)*19+this.sequence*13;}
  safeStretch(from,to) {
    const g=this.game,t=g.terrain,finish=START_X+g.goal*10;
    if(from<START_X+700||to>finish-500)return false;
    const blocked=[...t.roadFeatures,...t.ruggedSections,...t.verticalBranches,...t.experiments];
    if(blocked.some(f=>from<(f.exit||f.end||f.x)+160&&to>f.x-180))return false;
    const gum=g.mechanics.gum;
    if(gum&&from<gum.end+120&&to>gum.x-120)return false;
    // The opening lesson's 3px pebbles are harmless; sizeable rocks need their own approach.
    if((t.profile.tutorial?.stone??20)>6&&t.events(from-90,to+90).some(e=>e.kind==='rock'))return false;
    if(fuelStops(t,from-170,to+170).length)return false;
    for(let x=from;x<=to;x+=40) {
      if(t.gapAt(x)||Math.abs(t.slope(x))>.34||!Number.isFinite(t.height(x)))return false;
    }
    return true;
  }
  spawnGap(speed) {return clamp((Math.max(0,this.game.car.vx)+speed)*1.05,300,660);}
  canWarn() {
    const g=this.game,c=g.car;
    if(g.save.route<2&&!this.allowOpening)return false;
    if(c.contacts<=0||c.vx<70||g.input.brake||g.refueling||c.branchChoice||c.crashTime>0||
      Math.abs(c.angle-Math.atan(c.supportSlope()))>.38||Math.abs(c.omega)>1.2)return false;
    // Reserve the road the car will reach during both warning and approach.
    return this.safeStretch(c.x-70,c.x+c.vx*WARNING_TIME+this.spawnGap(130)+80);
  }
  warn() {
    const g=this.game,speed=110+hash(this.seed()+5)*40;
    const warningDuration=this.launched===0?FIRST_WARNING_TIME:WARNING_TIME;
    this.active={id:'monster-'+this.sequence++,state:'warning',time:warningDuration,warningDuration,
      x:g.car.x+this.spawnGap(speed),y:0,speed,age:0,color:['#e78883','#badc77','#b09ac8'][(this.sequence-1)%3],resolved:false};
    this.active.y=g.terrain.height(this.active.x);
    g.sound('horn');
  }
  resolve(hit) {
    const g=this.game,m=g.mechanics,c=g.car,a=this.active;
    if(!a||a.resolved)return;
    a.resolved=true;a.fade=.75;this.cooldown=4.5;
    if(hit) {
      this.hits++;m.hits++;m.impact=.55;m.breakFlow();g.combo=0;
      c.vx*=.58;
      g.sound('smash');g.platform.vibrate();m.feedback('撞到小怪 · 减速了');
      g.burst(a.x,a.y-24,a.color,12);
    } else {
      this.dodges++;m.dodged++;m.bonus+=3;
      g.coinPulse=1;g.sound('coin');m.feedback('跳过小怪 +3');
      g.burst(a.x,a.y-30,'#b8f23a',10);
    }
  }
  step(dt) {
    const g=this.game,c=g.car;
    if(g.screen!=='playing'||g.modal||g.backgrounded||!c||c.dead||g.mechanics.onFoot)return;
    this.furthest=Math.max(this.furthest,c.x);this.cooldown=Math.max(0,this.cooldown-dt);
    const a=this.active;
    if(!a) {
      if(!this.cooldown&&this.furthest>=this.nextAt&&this.canWarn())this.warn();
      return;
    }
    a.age+=dt;
    if(a.state==='warning') {
      a.time-=dt;a.x=c.x+this.spawnGap(a.speed);a.y=g.terrain.height(a.x);
      if(a.time<=0) {
        if(!this.safeStretch(c.x-70,a.x+80)||c.branchChoice) {this.active=null;this.cooldown=2;this.nextAt=c.x+400;return;}
        this.launched++;this.nextAt=this.furthest+1700+hash(this.seed())*700;
        a.state='running';a.startGap=Math.max(1,a.x-c.x);a.previousCar={x:c.x,y:c.y,angle:c.angle};
      }
      return;
    }
    const oldX=a.x,oldY=a.y,previous=a.previousCar||c;
    a.x-=a.speed*dt;a.y=g.terrain.height(a.x);
    // Cancel an encounter if an unusual reversal leads it into missing road.
    if(g.terrain.gapAt(a.x)||a.age>10) {this.active=null;this.cooldown=3;return;}
    if(!a.resolved) {
      const before=oldX-previous.x,after=a.x-c.x;
      let hit=vehicleOverlap(c,a);
      if(before>0&&after<=0) {
        const q=clamp(before/(before-after),0,1);
        const pose={x:previous.x+(c.x-previous.x)*q,y:previous.y+(c.y-previous.y)*q,
          angle:previous.angle+Math.atan2(Math.sin(c.angle-previous.angle),Math.cos(c.angle-previous.angle))*q};
        hit=hit||vehicleOverlap(c,{x:oldX+(a.x-oldX)*q,y:oldY+(a.y-oldY)*q},pose);
        a.crossed=true;a.jumped=c.contacts===0&&!hit;
      }
      if(hit)this.resolve(true);
      else if(a.x<c.x-c.stats.wheelbase-SIZE.halfWidth-45) {
        if(a.crossed&&a.jumped)this.resolve(false);
        else {a.resolved=true;a.fade=.75;this.cooldown=4.5;}
      }
    }
    if(a.resolved) {a.fade-=dt;if(a.fade<=0)this.active=null;}
    a.previousCar={x:c.x,y:c.y,angle:c.angle};
  }
}
const newRun=Game.prototype.newRun;
Game.prototype.newRun=function() {
  newRun.call(this);
  if(this.screen==='playing')this.mechanics.monsters=new MonsterEncounters(this);
};
const afterStep=RacingMechanics.prototype.afterStep;
RacingMechanics.prototype.afterStep=function() {afterStep.call(this);this.monsters?.step(STEP);};
const keyDown=Game.prototype.keyDown;
Game.prototype.keyDown=function(key) {
  const normalized=String(key).toLowerCase(),repeat=!!this.keys[normalized];
  keyDown.call(this,normalized);
  if(normalized==='j'&&!repeat)this.jump();
};
const finish=Game.prototype.finish;
Game.prototype.finish=function(reason,complete=false,animate=false) {
  const settled=this.settled;finish.call(this,reason,complete,animate);
  if(!settled&&this.result)Object.assign(this.result,{monsterDodges:this.mechanics.monsters?.dodges||0,monsterHits:this.mechanics.monsters?.hits||0});
};

Renderer.prototype.roadMonster=function(a) {
  const c=this.ctx;c.save();c.translate(a.x,a.y);
  if(a.resolved)c.globalAlpha=clamp(a.fade/.75,0,1);
  if(a.state==='warning') {
    this.circle(0,-30,14,'#efc789',INK,2);this.text('!',0,-42,23,INK,700,'center');
  } else {
    const stride=Math.sin(a.age*24)*10;
    c.save();c.globalAlpha*=.2;c.beginPath();c.ellipse(0,0,29,5,0,0,Math.PI*2);c.fillStyle=INK;c.fill();c.restore();
    for(const [side,shift] of [[-1,stride],[1,-stride]]) {
      this.line([[side*11,-12],[side*13+shift,-4],[side*18+shift,-2]],INK,4);
    }
    this.shape([[-20,-12],[-23,-26],[-16,-41],[2,-45],[20,-34],[23,-18],[13,-9],[-9,-8]],a.color,2,INK);
    this.shape([[-13,-39],[-17,-53],[-5,-44]],'#efdfa8',1.5,INK);
    this.shape([[9,-42],[19,-50],[18,-35]],'#efdfa8',1.5,INK);
    this.circle(-11,-29,10,'#fff5d1',INK,1.5);this.circle(-15,-29,4,INK);
    this.circle(9,-29,8,'#fff5d1',INK,1.5);this.circle(5,-29,3,INK);
    this.line([[-8,-14],[5,-15]],INK,2);this.shape([[-5,-16],[0,-16],[-3,-10]],'#fff5d1',1,INK);
    for(let i=0;i<3;i++)this.line([[32+i*10,-16-i*6],[45+i*10,-17-i*6]],'#b4bc93',2);
  }
  c.restore();
};
const adventureWorld=Renderer.prototype.adventureWorld;
Renderer.prototype.adventureWorld=function() {
  adventureWorld.call(this);const a=this.g.mechanics?.monsters?.active;
  if(a&&a.x>this.g.camera.x-100&&a.x<this.g.camera.x+this.w/this.g.viewZoom()+100)this.roadMonster(a);
};
const drivingNotice=Renderer.prototype.drivingNotice;
Renderer.prototype.drivingNotice=function(x,y,anchorX=null) {
  const c=this.g.car,a=this.g.mechanics?.monsters?.active;
  if(a&&!a.resolved&&c.crashTime<=0&&c.rollRisk<=.38)return;
  const fog=this.g.mechanics?.fogEnabled&&this.g.mechanics.fogDelay<=0&&this.g.mechanics.fogGap<55;
  if(fog&&c.crashTime<=0&&c.rollRisk<=.38)return;
  drivingNotice.call(this,x,y+(anchorX==null?this.threatMeterCount()*34:0),anchorX);
};
Renderer.prototype.threatMeterRows=function() {
  return [fogMeter(this.g),monsterMeter(this.g)].filter(Boolean);
};
Renderer.prototype.threatMeterCount=function() {return this.threatMeterRows().length;};
Renderer.prototype.threatMeters=function() {
  const rows=this.threatMeterRows();if(!rows.length)return;
  if(this.portrait&&this.g.visualPack?.ready){
    const c=this.ctx,top=(this.visualHudTop||24)+137;
    rows.forEach((row,i)=>{
      const y=top+i*35,color=row.color==='#d75f68'?'#b94457':row.kind==='fog'?'#765595':'#ab6642';
      c.save();c.shadowColor='rgba(248,254,255,.95)';c.shadowBlur=7;
      this.icon(row.kind==='fog'?'fog':'air',30,y+11,21,color);
      this.text(row.label,48,y-2,22,'#193947',800);
      c.restore();
      this.rect(338,y+13,304,7,3.5,'rgba(30,63,78,.32)');
      if(row.progress>0)this.rect(338,y+13,304*clamp(row.progress,0,1),7,3.5,color);
    });
    return;
  }
  const g=this.g,s=g.platform.safe;
  const x=this.portrait?82:Math.max(34,s.left+12),w=this.portrait?556:Math.min(780,this.w-Math.max(34,s.left+12)-Math.max(34,s.right+12,g.platform.menuInset||0));
  const top=(this.portrait?Math.max(31,s.top+18)+(g.platform.native?66:0):Math.max(22,s.top+8))+116;
  rows.forEach((row,i)=>{
    const y=top+i*34,trackX=x+196,trackW=w-216;
    this.rect(x,y,w,28,9,'rgba(31,46,42,.92)','#172623',1.5);
    this.icon(row.kind==='fog'?'fog':'air',x+17,y+14,19,row.color);
    this.text(row.label,x+34,y+6,14,'#f4efdb',600);
    this.rect(trackX,y+9,trackW,10,5,'rgba(244,239,219,.22)');
    if(row.progress>0)this.rect(trackX,y+9,trackW*clamp(row.progress,0,1),10,5,row.color);
  });
};
const hud=Renderer.prototype.hud;
Renderer.prototype.hud=function() {hud.call(this);if(this.g.screen==='playing'&&!this.g.modal)this.threatMeters();};
const jumpControl=Renderer.prototype.jumpControl;
Renderer.prototype.jumpControl=function(cx,cy,size) {
  jumpControl.call(this,cx,cy,size);const a=this.g.mechanics?.monsters?.active;
  if(a&&!a.resolved)this.circle(cx,cy,size/2+7+3*Math.sin(a.age*10),null,'#e78883',3);
};
const helpPortrait=Renderer.prototype.helpPortrait;
Renderer.prototype.helpPortrait=function() {
  helpPortrait.call(this);
  this.text('小怪冲来时点左侧跳跃，键盘也可按 J',this.w/2,(this.h-760)/2+625,18,'#a7e1ce',400,'center');
};
module.exports={MonsterEncounters,vehicleOverlap,fogMeter,monsterMeter,WARNING_TIME,FIRST_WARNING_TIME,FOG_SAFE_GAP,SIZE};
