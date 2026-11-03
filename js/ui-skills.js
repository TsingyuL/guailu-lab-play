// 技能反馈使用已选定的旧纸 / 暗色实验室 UI，不加载 M4 的其他皮肤。
const { Renderer } = require('./renderer');
const { Game } = require('./game');
const { T } = require('./ui-theme');
const { LANDMARKS } = require('./driving-skills');
const { UPGRADES, SPECIALIZATIONS, MAX_LEVEL, previewBuild, upgradesFor, upgradePreview,
  upgradeCost, upgradeGate, selectedSpecialization, specializationGate, clamp } = require('./config');

const hud=Renderer.prototype.hud;
Renderer.prototype.hud=function() {
  hud.call(this);
  const g=this.g,m=g.mechanics;if(!m||m.onFoot)return;
  const lesson=g.terrain.profile.tutorial?.skillLesson;
  if(lesson){
    const jumps=m.groundJumpUses||0,landings=g.cleanLandings||0,done=jumps>=lesson.jumps&&landings>=lesson.landings;
    const label=done?'训练完成 · 冲向终点':jumps<lesson.jumps?'训练：坡前点左侧跳跃':'训练：空中稳住姿态，后退压头，对准坡面落地';
    const w=this.portrait?Math.min(470,this.w-40):Math.min(420,this.w-40),x=this.portrait?28:(this.w-w)/2;
    const threats=typeof this.threatMeterCount==='function'?this.threatMeterCount():0;
    const y=(this.portrait?(g.platform.native?Math.max((g.platform.menuBottom||0)+260,290):Math.max((g.platform.safe.top||0)+150,150))+78:Math.max((g.platform.safe.top||0)+76,92))+threats*34;
    this.rect(x,y,w,42,13,done?T.acid:T.dark,T.ink,2);
    this.text(label,x+w/2,y+10,17,done?T.ink:T.paper,600,'center');
  }
  const statusY=this.portrait?Math.max(25,g.platform.native?(g.platform.menuBottom||0)+16:(g.platform.safe.top||0)+16)+263:92;
  if(m.landingSurge>0||m.flowTime>0){
    const text=m.landingSurge>0?'落地冲刺':'顺风 '+m.flowTime.toFixed(1)+'s';
    const w=136,x=this.w-w-20;
    this.rect(x,statusY,w,38,12,T.acid,T.ink,2);this.text(text,x+w/2,statusY+9,17,T.ink,700,'center');
  }else if((m.flowChain||0)>0){
    const w=136,x=this.w-w-20;
    this.rect(x,statusY,w,38,12,T.dark,T.mint,2);this.text('稳落 '+m.flowChain+' / 3',x+w/2,statusY+9,17,T.paper,600,'center');
  }
};
const roadMechanisms=Renderer.prototype.roadMechanisms;
Renderer.prototype.roadMechanisms=function(from,to) {
  roadMechanisms.call(this,from,to);
  if(!this.g.terrain.profile.drivingRhythm)return;
  for(const [i,point] of LANDMARKS.entries()) {
    if(point.x<from-120||point.x>to+120)continue;
    const post=point.x+(i%2?-54:54),y=this.g.terrain.height(post);
    this.line([[post,y],[post,y-88]],T.ink,4);
    this.scrapPaper(post-86,y-164,172,75,1200+i,T.paper,T.ink);
    this.text(point.title,post,y-151,20,T.ink,600,'center');
    this.text(point.hint,post,y-121,Math.min(13,146/point.hint.length),T.dark2,400,'center');
  }
};
const garagePortrait=Renderer.prototype.garagePortrait;
Renderer.prototype.garagePortrait=function() {
  garagePortrait.call(this);
  this.button('tuning',20,this.h-102,160,66,'改装',false,'engine');
};
const action=Game.prototype.action;
Game.prototype.action=function(id) {
  if(id==='tuning'&&this.screen==='garage'){this.clearInput();this.modal='tuning';return;}
  return action.call(this,id);
};
Renderer.prototype.tuningScreen=function() {
  const g=this.g,hh=Math.min(920,this.h-60),x=(this.w-660)/2,y=(this.h-hh)/2,w=660;
  g.buttons=[];this.rect(0,0,this.w,this.h,0,'rgba(12,20,18,.72)');this.scrapDark(x,y,w,hh,22);
  this.text('车辆改装',x+28,y+24,30,T.paper,600);this.iconButton('close',x+w-70,y+16,52,52,'close');
  const build=previewBuild(g.save,g.previewVehicle),ch=(hh-134-42)/4,owned=g.save.owned.includes(g.previewVehicle);
  UPGRADES.forEach((part,i)=>{
    const yy=y+82+i*(ch+14),info=upgradePreview(part.id,build,g.previewVehicle),mod=selectedSpecialization(build,part.id);
    this.scrapPaper(x+24,yy,w-48,ch,1300+i,T.paper,T.ink);
    this.icon(part.icon,x+49,yy+30,27,T.ink);this.text(part.name,x+74,yy+15,26,T.ink,600);
    this.text(info.level+' / '+MAX_LEVEL,x+w-42,yy+20,20,T.muted,400,'right');
    info.rows.forEach(([label,a,b,unit],n)=>this.text(label+' '+a+' → '+b+unit,x+40,yy+58+n*29,18,T.ink));
    const gate=upgradeGate(g.save,info.level),label=info.level>=MAX_LEVEL?'已满级':!owned?'未拥有':gate?'待解锁':'升级 '+upgradeCost(info.level);
    this.button('branch:'+part.id,x+40,yy+ch-60,365,44,mod?mod.name:'选择专精',false,'swap');
    this.button('upgrade:'+part.id,x+w-213,yy+ch-60,176,44,label,owned&&!gate,'plus');
  });
  this.text('各车独立升级 · 专精免费切换 · 每项只能选一种',x+w/2,y+hh-35,17,T.mint,400,'center');
};
// 五个选项也完整展示收益、代价与解锁条件。
Renderer.prototype.branchScreen=function() {
  const g=this.g,id=g.branchPart,part=UPGRADES.find(u=>u.id===id);if(!part)return;
  const build=upgradesFor(g.save,g.previewVehicle),selected=selectedSpecialization(build,id);
  const options=[null,...SPECIALIZATIONS[id]],hh=Math.min(930,this.h-60),w=660,x=(this.w-w)/2,y=(this.h-hh)/2;
  g.buttons=[];this.rect(0,0,this.w,this.h,0,'rgba(12,20,18,.72)');this.scrapDark(x,y,w,hh,22);
  this.text(part.name+'专精',x+28,y+24,30,T.paper,600);this.iconButton('tuning',x+w-70,y+16,52,52,'back');
  const ch=(hh-140-(options.length-1)*10)/options.length;
  options.forEach((mod,i)=>{
    const yy=y+82+i*(ch+10),active=mod?selected?.id===mod.id:!selected,gate=specializationGate(g.save,g.previewVehicle,id,mod);
    this.scrapPaper(x+24,yy,w-48,ch,1400+i,T.paper,T.ink);
    this.text(mod?mod.name:'标准配置',x+40,yy+14,25,T.ink,600);
    this.wrap(mod?mod.plus:'沿用原车参数',x+40,yy+49,510,17,T.ink);
    this.text(mod?mod.minus:'随时免费恢复',x+40,yy+ch-54,17,T.muted);
    this.text(active?'已装配':gate||'已解锁 · 免费换装',x+40,yy+ch-27,16,gate?T.coral:T.dark2);
    this.circle(x+w-63,yy+ch-31,18,active?T.acid:T.paper2,T.ink,1);
    this.icon(active?'check':gate?'lock':'plus',x+w-63,yy+ch-31,21,T.ink);
    this.hit('mod:'+id+':'+(mod?mod.id:'stock'),x+24,yy,w-48,ch);
  });
  this.text('每项只能选一种 · 原有车辆和改装存档继续使用',x+w/2,y+hh-32,17,T.mint,400,'center');
};
const draw=Renderer.prototype.draw;
Renderer.prototype.draw=function() {draw.call(this);if(this.g.modal==='tuning')this.tuningScreen();};
const resultScreen=Renderer.prototype.resultScreen;
Renderer.prototype.resultScreen=function() {
  resultScreen.call(this);
};
// 原六条帮助仍保留，加一条具体的技能用法。
const helpPortrait=Renderer.prototype.helpPortrait;
Renderer.prototype.helpPortrait=function() {
  helpPortrait.call(this);const x=(this.w-610)/2,y=(this.h-760)/2;
  this.text('坡前主动跳跃；空中再点可二段跳，后退可压头',x+305,y+595,18,T.mint,400,'center');
};
module.exports={};
