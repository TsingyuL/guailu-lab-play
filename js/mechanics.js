const { roadEvents, gumPosition } = require('./course');
class RacingMechanics {
  constructor(game) {
    this.game=game;this.energy=0;this.boostTime=0;this.boostUses=0;this.bonus=0;
    this.hits=0;this.dodged=0;this.crawled=0;this.resolved=new Set();this.pending=new Map();
    this.flowTime=0;this.flowChain=0;this.flowTriggers=0;
    this.fogX=game.car.x-1100;this.fogEnabled=game.terrain.profile.tutorial?.fog!==false;this.fogDelay=game.terrain.profile.tutorial?.fogDelay??6;this.fogGap=110;
    this.boostCost=30;this.boostDuration=1.1;this.boostFlash=0;
    this.labUsed=new Set();this.labSkipped=new Set();this.gravityTime=0;this.portalUses=0;this.gravityUses=0;this.swampCharge=0;this.portalFlash=0;
    this.impact=0;this.surface=game.terrain.surface(game.car.x);
    this.branchNotified=new Set();
    const t=game.terrain,finish=160+game.routeSpec().goal*10;
    // Kept as empty compatibility fields for old debug tools and saves. The
    // shipped game no longer creates collectible rings or an energy economy.
    this.airRings=[];this.ringResolved=new Set();this.ringChain=0;this.ringsCaught=0;this.ringFlash=null;
    const clear=x=>!t.experiments.some(e=>x>e.x-400&&x<(e.exit||e.end)+400)&&!t.verticalBranches.some(b=>x>b.x-400&&x<b.end+200)&&!t.roadFeatures.some(f=>x>f.x-400&&x<f.end+300);
    this.looseStone=t.profile.handsOn?.rock?t.events(900,finish-800).find(e=>e.kind==='rock'&&clear(e.x)):null;
    const gumX=gumPosition(t.profile,t.roadFeatures,t.verticalBranches);
    this.gum=gumX?{x:gumX,end:gumX+180,caught:false,cleared:false,release:0,flash:0}:null;
    this.onFoot=false;this.stoneCleared=false;this.stoneDrag=null;this.walkTime=0;
  }
  canExit() {
    const g=this.game,c=g.car,e=this.looseStone;
    return g.screen==='playing'&&!g.modal&&!c.dead&&!this.onFoot&&e&&!this.stoneCleared&&e.x-c.x>55&&e.x-c.x<245&&c.contacts>0&&Math.abs(c.vx)<35&&Math.abs(c.angle)<.65;
  }
  toggleDriver() {
    const g=this.game;
    if(g.screen!=='playing'||g.modal||g.car.dead)return false;
    if(!this.onFoot&&!this.canExit())return false;
    this.onFoot=!this.onFoot;this.walkTime=0;this.cancelStoneDrag();g.clearInput();
    g.car.vx=0;g.car.vy=0;g.car.omega=0;g.car.landing=0;
    this.boostTime=0;g.car.boostThrust=0;g.sound('click');return true;
  }
  stonePosition() {
    const e=this.looseStone;
    return e?{x:e.x,y:this.game.terrain.groundHeight(e.x)-10}:null;
  }
  stoneTarget() {const p=this.stonePosition();return p?{x:p.x+90,y:p.y-95}:null;}
  beginStoneDrag(id,p) {
    const g=this.game,stone=this.stonePosition();
    if(g.screen!=='playing'||g.modal||!this.onFoot||this.stoneCleared||this.stoneDrag||!stone||Math.hypot(p.x-stone.x,p.y-stone.y)>70)return false;
    this.stoneDrag={id,start:p,x:stone.x,y:stone.y};return true;
  }
  moveStone(id,p) {
    const d=this.stoneDrag,s=this.stonePosition();if(!d||d.id!==id||this.game.screen!=='playing')return;
    d.x=s.x+Math.max(-30,Math.min(135,p.x-d.start.x));d.y=s.y+Math.max(-145,Math.min(0,p.y-d.start.y));
  }
  dropStone(id,p) {
    if(this.stoneDrag?.id!==id)return false;this.moveStone(id,p);
    const d=this.stoneDrag,target=this.stoneTarget(),g=this.game;
    const cleared=g.screen==='playing'&&!g.modal&&this.onFoot&&Math.hypot(d.x-target.x,d.y-target.y)<42;
    this.cancelStoneDrag();
    if(cleared&&!this.stoneCleared){
      this.stoneCleared=true;g.terrain.removedStones.add(this.looseStone.id);
      this.resolved.add(this.looseStone.id);this.pending.delete(this.looseStone.id);this.crawled++;this.bonus+=3;this.charge(10);
      g.burst(target.x,target.y,'#d7c7a3',12);g.sound('coin');g.platform.vibrate();
    }
    return cleared;
  }
  cancelStoneDrag(id) {if(id===undefined||this.stoneDrag?.id===id)this.stoneDrag=null;}
  handsOnStep(dt) {
    const g=this.game,c=g.car,a=this.gum;
    if(this.onFoot)this.walkTime=Math.min(1,this.walkTime+dt*2.5);
    c.adhesion=null;if(!a)return;
    a.flash=Math.max(0,a.flash-dt);
    // 口香糖是可直接开过的粘性路面，不再锁车或要求固定踏板节奏。
    const touching=c.contacts>0&&c.x>=a.x&&c.x<=a.end;
    if(touching){
      if(!a.caught){a.caught=true;g.platform.vibrate();}
      a.anchor=Math.max(a.x,Math.min(a.end,c.x-28));
      a.release=Math.max(0,Math.min(1,(c.x-a.x)/(a.end-a.x)));
      const practice=g.terrain.profile.tutorial;
      c.extraDrag+=(practice?.ruggedScale<.5?.25:.95)/Math.min(1.6,c.stats.grip/.83);c.driveScale*=practice?.ruggedScale<.5?.95:.82;
    }
    if(a.caught&&!a.cleared&&c.x>a.end){a.release=1;a.cleared=true;a.flash=.5;g.burst(c.x,c.y+25,'#ec88ba',10);}
  }
  charge(amount) {
    // Obsolete energy calls are inert, including old preview integrations.
  }
  activateBoost() {
    return false;
  }
  feedback(text) {this.game.pop={text,until:this.game.time+1.1};}
  updateEffects(dt) {this.impact=Math.max(0,this.impact-dt*4);}
  cleanLanding() {
    this.flowChain++;
    if(this.flowChain>=3){this.flowChain=0;this.flowTime=4;this.flowTriggers++;this.feedback('顺风！');this.game.sound('rush');}
  }
  breakFlow() {
    this.flowChain=0;this.flowTime=0;
  }
  adventureStep(dt) {
    const g=this.game,c=g.car;
    if(g.screen!=='playing'||g.modal)return;
    if(!this.fogEnabled){this.fogGap=Math.max(0,(c.x-this.fogX)/10);return;}
    if(this.fogDelay>0)this.fogDelay=Math.max(0,this.fogDelay-dt);
    else {
      const chapter=Math.min(8,g.routeSpec().chapter);
      this.fogX+=dt*(g.terrain.profile.tutorial?.fogSpeed??(g.routeSpec().type==='grip'?85:g.routeSpec().type==='fuel'?125:g.routeSpec().type==='chase'?245+chapter*8:chapter===0?95:150+chapter*12));
      // 只把远离镜头的雾推进到最大落后距离，避免长关卡彻底丢失追逐压力。
      this.fogX=Math.max(this.fogX,c.x-1800);
    }
    this.fogGap=Math.max(0,(c.x-this.fogX)/10);
    if(this.fogX>=c.x-25){c.dead=true;c.reason='被怪雾追上了';}
  }
  nearbyLab(range=480) {
    return undefined;
  }
  activateLab(target) {
    // 旧调用安全失效，不允许隐藏快捷键继续改变位置或重力。
    return false;
  }
  beforeStep(dt) {
    const car=this.game.car;
    this.boostFlash=Math.max(0,this.boostFlash-dt);
    if(this.game.input.brake||car.fuel<=0||car.dead){this.boostTime=0;this.boostFlash=0;}
    this.gravityTime=0;this.portalFlash=0;car.gravityScale=1;
    this.flowTime=Math.max(0,this.flowTime-dt);
    this.boostTime=Math.max(0,this.boostTime-dt);this.surface=this.game.terrain.surface(car.x);
    const road={drive:1,burn:1};
    car.burnScale=road.burn;car.driveScale=(this.flowTime>0?1.16:1)*road.drive;car.speedBonus=this.flowTime>0?30:0;
    car.boostThrust=0;
    car.gripScale=this.surface.grip*(this.surface.name==='土路'?1:car.stats.softGrip);car.extraDrag=this.surface.name==='黏性沼泽'&&car.contacts===0?0:this.surface.drag;
    this.handsOnStep(dt);
  }
  afterStep() {
    const g=this.game,c=g.car;
    const branchRun=c.branchRuns[c.branchRuns.length-1];
    if(branchRun&&!this.branchNotified.has(branchRun.id)){
      this.branchNotified.add(branchRun.id);
      g.burst(c.x,c.y,branchRun.choice==='upper'?'#eabd53':'#75dace',10);
    }
    for(const e of g.terrain.events(c.x-150,c.x+180)) {
      if(e.kind!=='rock'||this.resolved.has(e.id))continue;
      const dx=c.x-e.x;
      if(dx>=-90&&dx<=90) {
        let record=this.pending.get(e.id);
        if(!record){record={air:true,hit:false};this.pending.set(e.id,record);}
        if(Math.abs(dx)<65) {
          const clear=c.contacts===0;
          const rockContact=c.wheels.some(w=>w.compression>0&&Math.abs(w.x-e.x)<55);
          if(!clear)record.air=false;
          // 岩石同时存在于物理地形里。只有高速贴地硬闯才记录磕碰；慢行可直接碾过。
          const tutorialPebble=(g.terrain.profile.tutorial?.stone??20)<=6;
          if(!tutorialPebble&&rockContact&&c.vx>195&&!record.hit) {
            const severity=Math.max(0,Math.min(1,(c.vx-195)/210));
            record.hit=true;this.hits++;this.impact=.55;g.combo=0;this.breakFlow();c.vx*=.9;
            // 高速硬撞不是纯扣速：前轮会被石头抬起，玩家需要用后退压头救车。
            c.vy-=12+severity*26;c.omega-=.1+severity*.28;
            g.burst(c.x,g.terrain.height(c.x)-5,'#c4b49a',10);g.sound('smash');this.feedback('磕碰');
          }
        }
      }
      if(dx>85&&this.pending.has(e.id)) {
        const record=this.pending.get(e.id);this.resolved.add(e.id);this.pending.delete(e.id);
        if(record.air){this.dodged++;this.bonus+=6;this.charge(22);this.feedback('飞越 +6');g.sound('coin');this.cleanLanding();}
        else if(!record.hit){this.crawled++;this.bonus+=3;this.charge(10);this.feedback('稳过 +3');}
        g.coinPulse=1;
      }
    }
  }
  nextObstacle() {
    const x=this.game.car.x;
    return this.game.terrain.events(x-40,x+3000).find(e=>e.kind==='rock'&&!this.resolved.has(e.id));
  }
  nextEvent() {
    const x=this.game.car.x;
    return this.game.terrain.events(x,x+1300).find(e=>e.kind==='jump'||e.kind==='surface');
  }
}
module.exports={roadEvents,RacingMechanics};
