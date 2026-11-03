const { clamp, VEHICLES, vehicleStats } = require('./config');
const { ruggedSections, ruggedOffset, movingOffset, verticalBranches, branchApproachOffset, branchUpperOffset, branchLowerOffset, branchGapAt, hillOffset, stoneOffset, surfaceAt, roadEvents, experimentZones, roadFeatures, weirdOffset, gapAt } = require('./course');
const STEP = 1 / 120;
const START_X = 160;
const FALL_TIMEOUT = 2;
const smoothStep=t=>t*t*(3-2*t);
class Terrain {
  constructor(difficulty = 1, biome = null, profile={}) { this.difficulty = difficulty; this.biome=biome; this.profile=profile;this.removedStones=new Set();this.experiments=experimentZones(profile);this.roadFeatures=roadFeatures(profile);this.verticalBranches=verticalBranches(profile);
    this.ruggedSections=ruggedSections(profile,this.roadFeatures,this.verticalBranches);
    const climb=profile.expedition?.climb;
    if(climb)this.climbBase=[this.naturalHeight(climb.x),this.naturalHeight(climb.x+climb.up+climb.down)];
  }
  baseHeight(x) {
    const p = x - 420;
    const ramp = clamp(p / 850, 0, 1);
    const envelope = ramp * ramp * (3 - 2 * ramp);
    const progress = 1 + Math.min(Math.max(p, 0) / 16000, 0.6);
    const m={difficulty:this.difficulty*(this.profile.tutorial?.terrainScale??1),phase:this.profile.tutorial?(this.profile.variant||0)*.32:0};
    return 420 - envelope * m.difficulty * progress * (65 * Math.sin(p / 390+m.phase) + 25 * Math.sin(p / 190+m.phase*.5) + 6 * Math.sin(p / 110));
  }
  courseHeight(x) {return this.baseHeight(x)+hillOffset(x,this.profile)+weirdOffset(x,this.roadFeatures)+branchApproachOffset(x,this.verticalBranches);}
  naturalHeight(x) {
    const base=this.courseHeight(x),f=this.ruggedSections.find(f=>x>=f.x&&x<=f.end);
    if(!f)return base;
    const t=(x-f.x)/(f.end-f.x),blend=smoothStep(clamp(Math.min(t,1-t)/.18,0,1));
    const road=this.courseHeight(f.x)*(1-t)+this.courseHeight(f.end)*t;
    return base+(road-base)*blend+ruggedOffset(x,[f]);
  }
  groundHeight(x) {
    const climb=this.profile.expedition?.climb;
    if(!climb||x<climb.x||x>climb.x+climb.up+climb.down)return this.naturalHeight(x);
    const {x:start,up,down,rise}=climb,end=start+up+down;
    const t=x-start,hill=t<=up?smoothStep(t/up):1-smoothStep((t-up)/down);
    const blend=smoothStep(clamp(Math.min(t,end-x)/300,0,1));
    const target=this.climbBase[0]+(this.climbBase[1]-this.climbBase[0])*t/(up+down)-rise*hill;
    return blend===1?target:this.naturalHeight(x)*(1-blend)+target*blend;
  }
  height(x) { return this.groundHeight(x) + stoneOffset(x,this.profile,this.removedStones)+branchLowerOffset(x,this.verticalBranches); }
  branchAt(x) {return this.verticalBranches.find(b=>x>=b.x-300&&x<=b.end);}
  branchHeight(x,branch=this.branchAt(x)) {return this.height(x)-branchLowerOffset(x,this.verticalBranches)-branchUpperOffset(x,branch);}
  driveHeight(x,choice) {const b=this.branchAt(x);return choice==='upper'&&b&&x>=b.decision&&x<=b.end?this.branchHeight(x,b):this.height(x);}
  driveSlope(x,choice) {return (this.driveHeight(x+2,choice)-this.driveHeight(x-2,choice))/4;}
  surface(x) { if(this.experiments.some(e=>e.kind==='swamp'&&x>=e.x&&x<=e.end))return {name:'黏性沼泽',grip:Math.max(.62,this.profile.tutorial?.surfaceGrip||0),drag:Math.min(.32,this.profile.tutorial?.surfaceDrag??.32),color:'#779c35'};return surfaceAt(x,this.biome===null?this.difficulty:[1,1.3,1.4][this.biome],this.profile,this.roadFeatures); }
  events(from,to) {return [...roadEvents(from,to,this.profile,this.roadFeatures).filter(e=>!this.removedStones.has(e.id)),...this.verticalBranches.filter(b=>b.end>=from&&b.x<=to),...this.ruggedSections.filter(f=>f.end>=from&&f.x-180<=to)].sort((a,b)=>a.x-b.x);}
  gapAt(x,choice) {return branchGapAt(x,this.verticalBranches,choice)||gapAt(x,this.roadFeatures);}
  slope(x) { return (this.height(x + 2) - this.height(x - 2)) / 4; }
  bankRadiusBlend(x) {
    // Apply the bank-contact correction to deep concave rugged sections only;
    // existing gentle lessons, convex peaks and long upgrade-testing grades
    // keep their calibrated collision envelope.
    const spans={bowl:[.27,.70],maw:[.30,.71],kicker:[.64,.94],fold:[.46,.77]};
    const f=this.ruggedSections.find(f=>f.sharp!==false&&spans[f.kind]&&x>f.x&&x<f.end);
    if(!f)return 0;
    const [a,b]=spans[f.kind],length=f.end-f.x;
    return smoothStep(clamp((x-f.x-a*length)/35,0,1))*smoothStep(clamp((f.x+b*length-x)/35,0,1));
  }
  update(dt,car) {
    this.dynamicStep=dt;
    for(const f of this.roadFeatures){
      f.previousTilt=f.tilt||0;f.previousCompression=f.compression||0;
      f.previousPhase=f.phase||0;f.previousHeave=f.heave||0;
      if(f.motion)f.phase=(f.phase||0)+dt*(.85+(f.x%7)*.035+f.motion*.09);
      if(f.kind==='heave')f.heave=-Math.sin(f.phase||0)*(30+(f.motion||0)*9);
      const loaded=car.contacts>0&&car.x>f.x&&car.x<f.end;
      if(f.kind==='tilt'){
        const target=(loaded?clamp((car.x-(f.x+f.end)/2)/(f.end-f.x)*.3,-.09,.09):0)+Math.sin(f.phase||0)*(f.motion||0)*.045;
        f.tilt+=(target-f.tilt)*(1-Math.exp(-dt*1.5));
      }
      if(f.kind==='sponge')f.compression+=((loaded?26:0)-f.compression)*(1-Math.exp(-dt*(loaded?3:1.8)));
    }
  }
  verticalVelocity(x) {
    if(!this.dynamicStep)return 0;
    let speed=0;
    for(const f of this.roadFeatures){
      speed+=(movingOffset(x,f)-movingOffset(x,f,true))*(f.strength??1)/this.dynamicStep;
    }
    return speed;
  }
}
class Car {
  constructor(terrain, upgrades, vehicle = 0) {
    this.terrain = terrain;
    this.upgrades = Object.assign({ engine: 0, tires: 0, suspension: 0, tank: 0 }, upgrades);
    this.spec = VEHICLES[vehicle] || VEHICLES[0];
    this.x = START_X; this.y = terrain.height(this.x) - 38;
    this.vx = 0; this.vy = 0; this.angle = 0; this.omega = 0;
    this.stats = vehicleStats(this.upgrades, vehicle);
    this.y=terrain.height(this.x)-this.stats.wheelRadius-16;
    this.fuelMax = this.stats.fuel;
    this.fuel = this.fuelMax; this.distance = 0;
    this.wheelSpin = 0; this.contacts = 0; this.airtime = 0;
    this.reversing=false;
    this.crashTime = 0; this.stallTime = 0; this.dead = false; this.reason = '';this.rollRisk=0;this.landingDanger=0;this.manualHop=false;this.bodyContacts=0;this.rollAngle=0;
    this.wheels = []; this.landing = 0; this.time = 0;
    this.engineLoad=0;this.powerStrain=0;this.strainTime=0;this.fuelRate=0;this.fuelUsed=0;this.fuelMode='idle';this.coastTime=0;
    this.branchChoice=null;this.branchId=null;this.branchIntent=null;this.branchRuns=[];
    this.gravityScale=1;this.burnScale=1; this.driveScale = 1; this.gripScale = 1; this.extraDrag = 0; this.speedBonus = 0;this.boostThrust=0;
  }
  point(lx, ly) {
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    return { x: this.x + lx * c - ly * s, y: this.y + lx * s + ly * c };
  }
  roadHeight(x) {return this.terrain.driveHeight?this.terrain.driveHeight(x,this.branchChoice):this.terrain.height(x);}
  roadSlope(x) {return this.terrain.driveSlope?this.terrain.driveSlope(x,this.branchChoice):this.terrain.slope(x);}
  supportSlope(x=this.x) {
    const span=Math.max(12,(this.spec.kind==='unicycle'?this.stats.wheelRadius:this.stats.wheelbase)*Math.cos(this.angle));
    return (this.roadHeight(x+span)-this.roadHeight(x-span))/(span*2);
  }
  recoveryRise() {
    // Only a genuine, short concave ditch qualifies, never an ordinary climb
    // or a missing road. Look at both banks rather than engine level or timers.
    if(this.terrain.gapAt?.(this.x,this.branchChoice))return 0;
    const ground=this.roadHeight(this.x);
    const recovery=this.terrain.ruggedSections?.find(f=>f.kind==='recovery'&&this.x>=f.x&&this.x<=f.end);
    if(recovery){
      const left=this.roadHeight(recovery.x),right=this.roadHeight(recovery.end),depth=Math.min(ground-left,ground-right);
      if(depth>60)return depth;
    }
    let left=ground,right=ground;
    for(let dx=80;dx<=360;dx+=40){
      if(!this.terrain.gapAt?.(this.x-dx,this.branchChoice))left=Math.min(left,this.roadHeight(this.x-dx));
      if(!this.terrain.gapAt?.(this.x+dx,this.branchChoice))right=Math.min(right,this.roadHeight(this.x+dx));
    }
    return Math.min(ground-left,ground-right)>60?Math.max(ground-left,ground-right):0;
  }
  canHop() {
    return !this.dead&&(this.contacts>0||this.bodyContacts>0&&this.rollAngle<Math.PI/3&&this.recoveryRise()>0);
  }
  bodyPoints() {
    // 接触点随载具轮廓变化，独轮/滑板骑手的头部不再套用汽车矮车顶。
    const kind=this.spec.kind,top=['unicycle','skateboard','scooter'].includes(kind)?-105:['bike','trike'].includes(kind)?-80:-40;
    return [[0,top,7],[this.stats.wheelbase-1,-20,6],[-this.stats.wheelbase+1,-20,6],[0,5,8]];
  }
  hop() {
    if(!this.canHop())return false;
    // 主动跳跃从真实轮胎接地点弹起，陡坡上也保持向前的驾驶动量。
    // 高跳用于跨过尖峰；只能着地触发，不改变空中重力或自动调平。
    const rise=Math.abs(this.vx)<140?this.recoveryRise():0;
    const impulse=rise?clamp(Math.sqrt(2*610*(rise+110)),580,760):580;
    this.vy=Math.min(this.vy,0)-impulse;this.y-=6;
    this.omega*=.4;this.contacts=0;this.bodyContacts=0;this.airtime=Math.max(this.airtime,.1);this.manualHop=true;return true;
  }
  updateBranchChoice(input={},dt=0) {
    const branch=this.terrain.branchAt?.(this.x);
    if(!branch){this.branchChoice=null;this.branchId=null;return;}
    const front=this.point(Math.max(...this.stats.wheelOffsets),14);
    if(front.x<branch.decision)return;
    if(this.branchId!==branch.id){
      // 不读取踏板意图、不抬高车辆：前轮实际越过桥头才选择碰撞层。
      const bridge=this.terrain.branchHeight(front.x,branch);
      this.branchChoice=this.vx>0&&front.y+this.stats.wheelRadius<=bridge+8?'upper':'lower';
      this.branchId=branch.id;this.branchRuns.push({id:branch.id,choice:this.branchChoice});
    }
    if(this.branchChoice==='upper'&&this.x<branch.end-250&&this.y>this.terrain.branchHeight(this.x,branch)){
      this.branchChoice='lower';const run=this.branchRuns.find(r=>r.id===branch.id);
      if(run){run.choice='lower';run.fell=true;}else this.branchRuns.push({id:branch.id,choice:'lower',fell:true});
    }
  }
  step(dt, input) {
    if (this.dead) return;
    this.updateBranchChoice(input,dt);
    this.time += dt;
    const throttle = input.gas && this.fuel > 0 ? 1 : 0;
    const brake = input.brake ? 1 : 0;
    // 两个方向共用同一发动机，只改变力的符号；不等待停车、不瞬间改速度。
    // 双踏板或显式驻车用于制动；空中仍只调姿，无油不提供驱动力。
    const parking=!!input.park||!!(input.gas&&input.brake);
    const direction=parking||this.fuel<=0?0:throttle-brake;
    const powered=Math.abs(direction);
    this.reversing=direction<0;
    let fx = -this.vx * (0.13 + this.extraDrag), fy = 610 * this.gravityScale, torque = -this.omega * this.stats.angularDamping;
    let contacts = 0,contactWeight=0;
    this.wheels = [];
    for (const [wheelIndex,lx] of this.stats.wheelOffsets.entries()) {
      const weight=this.stats.wheelWeights[wheelIndex];
      const hub = this.point(lx, 14);
      if(this.terrain.gapAt?.(hub.x,this.branchChoice)){this.wheels.push({x:hub.x,y:hub.y,compression:0});continue;}
      const slope = this.roadSlope(hub.x), norm = Math.sqrt(1 + slope * slope);
      const nx = slope / norm, ny = -1 / norm, tx = 1 / norm, ty = slope / norm;
      // Retain the calibrated shallow-road suspension, but use the tire's
      // normal radius on steep banks: the old vertical-only radius sank tires.
      const bank=clamp((Math.abs(slope)-1)/.25,0,1)*(this.terrain.bankRadiusBlend?.(hub.x)??1);
      const penetration = (hub.y + this.stats.wheelRadius - this.roadHeight(hub.x)) / norm
        +this.stats.wheelRadius*(1-1/norm)*bank;
      const rx = hub.x - this.x, ry = hub.y - this.y;
      const pvx = this.vx - this.omega * ry, pvy = this.vy + this.omega * rx;
      const normalVelocity = pvx * nx + (pvy-(this.terrain.verticalVelocity?.(hub.x)||0)) * ny;
      let compression = 0;
      if (penetration > 0) {
        contacts++;contactWeight+=weight;
        const spring = clamp(penetration * this.stats.spring - normalVelocity * this.stats.damping, 0, 3200);
        const speed = pvx * tx + pvy * ty;
        let drive = parking?-clamp(speed*5,-this.stats.brakeForce,this.stats.brakeForce)
          :direction*this.stats.drive*this.driveScale;
        const traction = spring * this.stats.grip * this.gripScale;
        drive = clamp(drive, -traction, traction);
        const contactFx = (spring * nx + drive * tx)*weight, contactFy = (spring * ny + drive * ty)*weight;
        fx += contactFx; fy += contactFy;
        torque += (rx * contactFy - ry * contactFx) / this.stats.inertia;
        compression = clamp(penetration, 0, 12);
      }
      this.wheels.push({ x: hub.x, y: hub.y - compression * 0.35, compression });
    }
    this.landing = 0;
    // 独轮骑手只在轮胎接地、可控制倾角内施加有限平衡力矩。
    // 空中、断路和大角度失控不扶正，不增加接地点或跳跃机会。
    if(contacts&&this.stats.balance){
      const lean=Math.atan2(Math.sin(this.angle-Math.atan(this.supportSlope())),Math.cos(this.angle-Math.atan(this.supportSlope())));
      if(Math.abs(lean)<.85)torque+=clamp(-Math.sin(lean)*this.stats.balance-this.omega*2.8,-9,9);
    }
    // 减震器只在着地冲击时耗散法向动能，不扶正车身、不改变空中操作。
    if(contacts>0&&this.contacts===0&&this.airtime>.08){
      // 尖顶两侧法线方向相反：着陆姿态应比较两轮跨距的支撑面，
      // 不能用车身中心那一个像素的陡坡把正常跨顶判成车头着地。
      const slope=this.supportSlope(),norm=Math.hypot(1,slope),nx=slope/norm,ny=-1/norm;
      const incoming=Math.min(0,this.vx*nx+this.vy*ny),impulse=-incoming*this.stats.impactAbsorb;
      const landingAngle=Math.atan2(Math.sin(this.angle-Math.atan(slope)),Math.cos(this.angle-Math.atan(slope)));
      // Once the opening is behind the player, a fast crooked landing carries
      // its rotation into the body instead of being silently absorbed. A mild
      // mistake can still be counter-steered; a severe body-first impact flips.
      const angleError=Math.abs(landingAngle),impact=-incoming,opening=this.distance<550;
      this.landingDanger=opening?0:clamp((angleError-.28)*1.35+(impact-65)/210,0,1);
      const firstCupBodyFirst=this.terrain.profile?.chapter===0&&this.airtime>.65&&impact>95&&(landingAngle<-.48||landingAngle>.68);
      if(firstCupBodyFirst||(!opening&&this.airtime>.5&&impact>88&&angleError>.58)){
        const direction=Math.sign(landingAngle)||1;
        this.omega+=direction*clamp((angleError-.48)*impact/82,.28,1.65);
      }
      this.vx+=nx*impulse;this.vy+=ny*impulse;
    }
    if (contacts === 0) {
      this.reversing=false;
      this.airtime += dt;
      // A held gas pedal is the normal way to leave a crest or take a jump.
      // On the starter unicycle it must not also command a full backflip.
      // Brake still gives the rider a deliberate, stronger air correction.
      const openingUnicycle=this.spec.kind==='unicycle'&&!!this.terrain.profile?.authored?.notices?.length;
      const airGas=openingUnicycle ? 0.08 : 2.5;
      torque += (brake*2.5-throttle*airGas)*this.stats.airControl;
    } else {
      if (this.airtime > 0.38) this.landing = this.airtime;
      this.manualHop=false;
      this.airtime = 0;
    }
    this.contacts = contacts;
    // 车身/骑手真实碰撞支撑：蹭地可继续翻滚或救车，不让车顶穿地后直接判死。
    let bodyContacts=0;
    for(const [lx,ly,radius] of this.bodyPoints()){
      const p=this.point(lx,ly);if(this.terrain.gapAt?.(p.x,this.branchChoice))continue;
      const slope=this.roadSlope(p.x),norm=Math.hypot(1,slope),nx=slope/norm,ny=-1/norm;
      const bank=clamp((Math.abs(slope)-1)/.25,0,1)*(this.terrain.bankRadiusBlend?.(p.x)??1);
      const penetration=(p.y+radius-this.roadHeight(p.x))/norm+radius*(1-1/norm)*bank;
      if(penetration<=0)continue;
      bodyContacts++;
      const rx=p.x-this.x,ry=p.y-this.y,pvx=this.vx-this.omega*ry,pvy=this.vy+this.omega*rx;
      const vn=pvx*nx+(pvy-(this.terrain.verticalVelocity?.(p.x)||0))*ny;
      const support=clamp(penetration*160-vn*14,0,3200)*.65;
      const tangent=(pvx+pvy*slope)/norm,drag=clamp(-tangent*2,-support*.55,support*.55);
      const bfx=support*nx+drag/norm,bfy=support*ny+drag*slope/norm;
      fx+=bfx;fy+=bfy;torque+=(rx*bfy-ry*bfx)/this.stats.inertia;
    }
    this.bodyContacts=bodyContacts;
    const roadAngle=Math.atan(this.roadSlope(this.x));
    // Mid-flight, the road can be far below (or on the opposite face of a
    // crest); its slope is not the rider's current balance reference.
    const referenceAngle=contacts===0?0:roadAngle;
    const tilt=Math.abs(Math.atan2(Math.sin(this.angle-referenceAngle),Math.cos(this.angle-referenceAngle)));
    const riskTarget=contacts===0
      ?clamp((tilt-.55)/.9+Math.abs(this.omega)*.08,0,1)
      :clamp((tilt-.38)/.75+Math.abs(this.omega)*.08+this.landingDanger*.75,0,1);
    this.rollRisk+=(riskTarget-this.rollRisk)*(1-Math.exp(-dt*(riskTarget>this.rollRisk?9:3.5)));
    this.landingDanger=Math.max(0,this.landingDanger-dt*1.7);
    // Compare actual uphill load with delivered wheel force, independent of level.
    const slope=this.roadSlope(this.x),uphill=Math.max(0,-slope*(direction<0?-1:1))/Math.hypot(1,slope);
    const load=contacts?clamp((610*uphill+Math.abs(this.vx)*(.13+this.extraDrag))/(Math.max(1,contactWeight)*this.stats.drive*this.driveScale),0,1.5):0;
    this.engineLoad+=(load-this.engineLoad)*(1-Math.exp(-dt*5));
    const strained=powered&&contacts&&uphill>.25&&Math.abs(this.vx)<160&&load>.85&&!this.adhesion;
    this.powerStrain+=((strained?1:0)-this.powerStrain)*(1-Math.exp(-dt*3));
    if(strained)this.strainTime+=dt;
    if(this.adhesion&&contacts)fx-=clamp((this.x-this.adhesion.x)*14,-700,700);
    const limit=this.stats.maxSpeed+this.speedBonus;
    this.vx = clamp(this.vx + fx * dt, -Math.max(limit,-this.vx-180*dt), Math.max(limit,this.vx-180*dt));
    this.vy = clamp(this.vy + fy * dt, -650, 850);
    this.omega = clamp(this.omega + torque * dt, -5, 5);
    this.x += this.vx * dt; this.y += this.vy * dt; this.angle += this.omega * dt;
    this.angle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle));
    if (this.x < 85) { this.x = 85; this.vx = Math.max(0, this.vx); }
    this.wheelSpin += this.vx * dt / this.stats.wheelRadius;
    this.distance = Math.max(this.distance, Math.max(0, (this.x - START_X) / 10));
    // Lift downhill to cut fuel delivery; gravity still accelerates the car.
    // Saving fuel never supplies free grip, braking or uphill drive.
    const effort=powered&&contacts?uphill*.3:0;
    const coasting=!throttle&&!brake&&contacts>0&&slope>.045&&this.vx>80;
    this.fuelRate=(coasting?.12:(.7+powered*2.65)*(1+effort))*(this.stats.burn/3.35)*this.burnScale;
    this.fuelMode=this.fuel<=0?'empty':this.reversing?'reverse':coasting?'coast':powered&&effort>.06?'load':powered?'drive':'idle';
    if(coasting)this.coastTime+=dt;
    const used=Math.min(this.fuel,dt*this.fuelRate);this.fuelUsed+=used;this.fuel-=used;
    this.rollAngle=Math.abs(Math.atan2(Math.sin(this.angle-Math.atan(this.supportSlope())),Math.cos(this.angle-Math.atan(this.supportSlope()))));
    // 侧倒或倒扣且身体触地才计时；空中翻转和扶正会清零，给玩家两秒救车。
    const fallen=this.rollAngle>=Math.PI/2&&this.bodyContacts>0;
    this.crashTime=fallen?this.crashTime+dt:0;
    this.stallTime = this.fuel <= 0 && Math.abs(this.vx) < 14 ? this.stallTime + dt : 0;
    if (this.crashTime + 1e-9 >= FALL_TIMEOUT) { this.dead = true; this.reason = '倒地2秒没扶正，翻车了'; }
    if (this.stallTime > 1.5) { this.dead = true; this.reason = '油箱空了，休息一下再出发'; }
    if (this.y > this.roadHeight(this.x) + 250) { this.dead = true; this.reason = this.terrain.gapAt?.(this.x,this.branchChoice)?'掉进断路了，再试一次':'这次着陆有一点点冒险'; }
  }
}
const RISK_COIN_LIFTS=[150,230,310,360,370,340,280];
function collectibles(from, to, terrain) {
  const result = [];
  const authored=terrain.profile?.authored;
  if(authored?.coinTrails){
    for(const trail of authored.coinTrails)for(let i=0;i<trail.points.length;i++){
      const p=trail.points[i],x=p.x;if(x<from||x>to)continue;
      const upper=trail.branch==='upper',base=upper?terrain.branchHeight(x):terrain.height(x),type=trail.type||'coin';
      result.push({id:'a'+trail.id+'-'+i,type,x,y:p.y??base+(p.yOffset??-54),branch:trail.branch,
        fuelUnits:type==='fuel'?(trail.fuelUnits||14):undefined,trail:trail.path,trailId:trail.id});
    }
    return result;
  }
  // Risk trails belong to a specific rock. Do not bend an unrelated grid of
  // ordinary coins around it: that made the reward arc drift away from the
  // collision point whenever the two grids did not happen to line up.
  const riskRocks=terrain.events
    ?terrain.events(from-260,to+260).filter(e=>e.kind==='rock'):[];
  const first = Math.max(0, Math.floor((from - 600) / 490));
  const last = Math.ceil((to - 600) / 490);
  for (let g = first; g <= last; g++) for (let i = 0; i < 5; i++) {
    const x = 600 + g * 490 + i * 42;
    const reserved=riskRocks.some(e=>Math.abs(x-e.x)<=230);
    if (x >= from && x <= to&&!reserved&&!terrain.verticalBranches?.some(b=>x>=b.decision&&x<=b.end-100)) {
      result.push({id:'c'+g+'-'+i,type:'coin',x,
        y:terrain.height(x)-(terrain.profile?.tutorial?.ruggedCount===0?48:58)-Math.sin(i/4*Math.PI)*(terrain.profile?.tutorial?.ruggedCount===0?20:g%3===1?76:26),
        trail:'neutral'});
    }
  }
  for(const rock of riskRocks)for(let i=0;i<7;i++){
    const x=rock.x-180+i*60;
    if(x>=from&&x<=to&&!terrain.verticalBranches?.some(b=>x>=b.decision&&x<=b.end-100)){
      const lift=RISK_COIN_LIFTS[i];
      result.push({id:'rc'+rock.id+'-'+i,type:'coin',x,
        y:terrain.height(x)-lift,
        trail:'risk',trailId:rock.id});
    }
  }
  for(const b of terrain.verticalBranches||[]){
    for(let i=0;i<12;i++){const x=b.decision+95+i*(b.end-b.decision-210)/11;if(x>=from&&x<=to)result.push({id:'bc'+b.id+'-'+i,type:'coin',branch:'upper',x,y:terrain.branchHeight(x,b)-62-Math.sin(i/11*Math.PI)*24});}
    const x=(b.decision+b.end)/2;if(x>=from&&x<=to)result.push({id:'bf'+b.id,type:'fuel',fuelUnits:14,branch:'lower',x,y:terrain.height(x)-54});
  }
  for(const item of fuelStops(terrain,from,to))result.push(item);
  if(terrain.profile?.objective==='fuel'&&!terrain.profile.expedition&&terrain.ruggedSections?.length){
    const x=terrain.ruggedSections[0].end+110;
    if(x>=from&&x<=to)result.push({id:'ruggedFuel',type:'fuel',fuelUnits:14,x,y:terrain.height(x)-54});
  }
  return result;
}
function fuelStops(terrain,from,to){
 const plan=terrain.profile?.expedition,gap=plan?.gap||terrain.profile?.tutorial?.fuelGap||(terrain.profile?.objective==='fuel'?6900:5600),first=plan?.first||2450,result=[];
 for(let n=Math.max(0,Math.floor((from-first)/gap));n<=Math.ceil((to-first)/gap);n++){
  const x=first+n*gap;
  const parkable=Math.abs(terrain.slope(x))<.38&&!(terrain.roadFeatures||[]).some(f=>x>f.x-140&&x<f.end+140)&&!(terrain.verticalBranches||[]).some(b=>x>b.x-140&&x<b.end+140);
  const station=parkable&&(!!plan&&n>0||terrain.profile?.chapter>0&&n>0&&n%2===1);
  if(x>=from&&x<=to&&!terrain.gapAt?.(x))result.push({id:'f'+n,type:'fuel',fuelUnits:station?(plan?.refill||90):28,quickFuel:28,station,x,y:terrain.height(x)-60});
 }
 return result;
}
module.exports = { Terrain, Car, collectibles, fuelStops, STEP, START_X, FALL_TIMEOUT };
