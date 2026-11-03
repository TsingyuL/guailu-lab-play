(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WildroadVisualModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DESIGN = { width: 720, height: 1280, meters: 1200, unitsPerMeter: 5.5 };
  const X = value => value * DESIGN.unitsPerMeter / 10;
  const GAP = { x0: X(4250), x1: X(4510), suggestedMeters: 45, calibratedMeters: 26 };
  const FORK_X = X(2400), MERGE_X = X(6800), FINISH_X = X(12000);
  const segments = [
    { id: 'approach', branch: 'shared', points: [[0,760],[900,760],[1800,730],[2400,700]].map(([x,y])=>[X(x),y]) },
    { id: 'upper_takeoff', branch: 'upper', points: [[2400,700],[3000,620],[3700,520],[4250,465]].map(([x,y])=>[X(x),y]) },
    { id: 'upper_landing', branch: 'upper', points: [[4510,475],[5200,500],[5900,590],[6800,710]].map(([x,y])=>[X(x),y]) },
    { id: 'lower', branch: 'lower', points: [[2400,700],[3000,780],[3700,860],[4600,895],[5100,895],[5800,830],[6800,710]].map(([x,y])=>[X(x),y]) },
    { id: 'exit', branch: 'shared', points: [[6800,710],[7500,700],[8400,730],[9300,685],[10500,720],[12000,720]].map(([x,y])=>[X(x),y]) }
  ];
  const coins = [4050,4250,4380,4480,4700,4850].map((x,i)=>({id:'coin-'+i,x:X(x),y:[380,335,320,330,365,400][i],taken:false}));
  const fuel = { id:'fuel-lower', x:X(4850), y:895, amount:14, taken:false };
  const bindings = {
    origin: 'wheel_center',
    wheel: { center:[0,0], draw:[-54,-54,108,108], sourcePivot:[212,213] },
    body: { mount:[0,-48], draw:[-46,-95,91,98], sourcePivot:[162,333] },
    rider: { mount:[7,-31], draw:[-45,-174,102,143], sourcePivot:[188,513] }
  };
  const lerp=(a,b,t)=>a+(b-a)*t;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function pointOn(points,x){
    for(let i=1;i<points.length;i++)if(x>=points[i-1][0]&&x<=points[i][0]){
      const a=points[i-1],b=points[i],t=(x-a[0])/(b[0]-a[0]);return {y:lerp(a[1],b[1],t),slope:(b[1]-a[1])/(b[0]-a[0])};
    }
    return null;
  }
  function surface(x,branch){
    const shared=segments.find(s=>s.branch==='shared'&&pointOn(s.points,x));
    if(shared)return {...pointOn(shared.points,x),branch:'shared'};
    if(branch==='upper'){
      if(x>=GAP.x0&&x<GAP.x1)return null;
      for(const s of segments.filter(s=>s.branch==='upper')){const p=pointOn(s.points,x);if(p)return {...p,branch:'upper'};}
    }
    const lower=segments.find(s=>s.branch==='lower'&&pointOn(s.points,x));
    return lower?{...pointOn(lower.points,x),branch:'lower'}:null;
  }
  function lowerSurface(x){const s=segments.find(s=>s.branch==='lower'&&pointOn(s.points,x));return s?{...pointOn(s.points,x),branch:'lower'}:null;}
  class InputState {
    constructor(){this.pointers=new Map();this.keys={};}
    down(id,action){this.pointers.set(id,action||'');}
    move(id,action){if(this.pointers.has(id))this.pointers.set(id,action||'');}
    up(id){this.pointers.delete(id);}
    clear(){this.pointers.clear();this.keys={};}
    get gas(){return !!this.keys.gas||[...this.pointers.values()].includes('gas');}
    get brake(){return !!this.keys.brake||[...this.pointers.values()].includes('back');}
    get jump(){return [...this.pointers.values()].includes('jump');}
  }
  class Car {
    constructor(){this.reset();}
    reset(){
      Object.assign(this,{x:X(150),y:675,vx:0,vy:0,angle:0,omega:0,wheelSpin:0,branch:null,grounded:true,fuel:100,coins:0,landings:0,airtime:0,landingFlash:0,finished:false,dead:false,lastSurfaceY:760});
      coins.forEach(c=>c.taken=false);fuel.taken=false;
    }
    jump(){if(!this.grounded||this.finished)return false;this.grounded=false;this.vy=-410;this.omega=-.38;this.airtime=.001;return true;}
    step(dt,input){
      if(this.finished||this.dead)return;
      const throttle=input.gas?1:0,reverse=input.brake?1:0;
      if(this.grounded){
        const road=surface(this.x,this.branch)||lowerSurface(this.x);
        const slope=road?.slope||0;
        this.vx+=((throttle-reverse)*235 - this.vx*.32 + slope*115)*dt;
        this.vx=clamp(this.vx,-115,445);
        this.angle+=(Math.atan(slope)-this.angle)*(1-Math.exp(-dt*8));
        this.omega*=Math.exp(-dt*8);
      }else{
        this.vy+=920*dt;this.omega+=(reverse-throttle)*1.75*dt;this.omega*=Math.exp(-dt*.7);this.angle+=this.omega*dt;
        this.airtime+=dt;
      }
      if(throttle&&this.fuel>0)this.fuel=Math.max(0,this.fuel-dt*1.55);
      const px=this.x,py=this.y;
      this.x+=this.vx*dt;this.y+=this.vy*dt;this.wheelSpin+=this.vx*dt/54;
      if(this.x>=FORK_X&&this.x<MERGE_X&&this.branch===null){
        const upper=surface(this.x,'upper'),wheelBottom=this.y+54;
        this.branch=!this.grounded&&upper&&wheelBottom<=upper.y+35&&this.vy<260?'upper':'lower';
      }
      if(this.branch==='upper'&&this.x>=GAP.x0&&this.x<GAP.x1)this.grounded=false;
      let road=surface(this.x,this.branch);
      if(this.branch==='upper'&&!road){
        const low=lowerSurface(this.x);
        if(low&&this.y+54>=low.y&&py+54<=low.y+Math.max(8,this.vy*dt+8)){this.branch='lower';road=low;}
      }
      if(this.branch==='upper'&&road&&this.y+54>road.y+80){
        const low=lowerSurface(this.x);if(low){this.branch='lower';road=low;}
      }
      if(road){
        const ride=54,nowBottom=this.y+ride,oldBottom=py+ride;
        if(this.grounded||nowBottom>=road.y&&oldBottom<=road.y+Math.max(10,this.vy*dt+10)){
          const landed=!this.grounded&&this.airtime>.12;
          this.y=road.y-ride;this.vy=0;this.grounded=true;this.lastSurfaceY=road.y;
          if(landed){this.landings++;this.landingFlash=.65;this.vx*=.97;}
          this.airtime=0;
        }
      }
      if(this.x>=MERGE_X)this.branch=null;
      if(this.y>1050){this.dead=true;}
      this.landingFlash=Math.max(0,this.landingFlash-dt);
      for(const c of coins)if(!c.taken&&this.branch!=='lower'&&Math.hypot(this.x-c.x,this.y-c.y)<92){c.taken=true;this.coins++;}
      if(!fuel.taken&&this.branch==='lower'&&Math.hypot(this.x-fuel.x,this.y-fuel.y+54)<105){fuel.taken=true;this.fuel=Math.min(100,this.fuel+fuel.amount);}
      if(this.x>=FINISH_X){this.x=FINISH_X;this.finished=true;this.vx=0;}
      if(!Number.isFinite(this.x+this.y+this.angle)){this.dead=true;Object.assign(this,{x:px,y:py,vx:0,vy:0});}
    }
  }
  return {DESIGN,X,GAP,FORK_X,MERGE_X,FINISH_X,segments,coins,fuel,bindings,surface,lowerSurface,InputState,Car,clamp};
});
