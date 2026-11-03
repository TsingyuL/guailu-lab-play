// Garage controls share the painted-world palette used by the game and homepage.
const {Renderer} = require('./renderer');
const {VEHICLES,UPGRADES,MAX_LEVEL,clamp,previewBuild,vehicleAppearance,vehicleStats,upgradePreview,upgradeGate,upgradeCost,selectedSpecialization,specializationGate,SPECIALIZATIONS} = require('./config');
const {T} = require('./ui-theme');

Renderer.prototype.garagePortrait=function(){
  const g=this.g,h=this.h,c=this.ctx,v=VEHICLES[g.previewVehicle],build=previewBuild(g.save,g.previewVehicle);
  const owned=g.save.owned.includes(g.previewVehicle),active=g.save.vehicle===g.previewVehicle,part=g.garagePart||'engine';
  const top=Math.max(123,this.headerY()+78),footer=h-Math.max(96,(g.platform.safe.bottom||0)+80);
  const detailH=clamp(h*.22,260,282),detailY=footer-16-detailH,tabsY=detailY-160,equipY=tabsY-67,fleetY=equipY-116,sceneH=fleetY-12;
  this.rect(0,0,720,h,0,T.dark);
  const sky=this.visualAsset('sky'),far=this.visualAsset('far');
  if(sky){const scale=Math.max(720/sky.width,sceneH/sky.height),w=sky.width*scale,hh=sky.height*scale;c.drawImage(sky,(720-w)/2,(sceneH-hh)/2,w,hh);}
  if(far){const scale=Math.max(720/far.width,sceneH/far.height),w=far.width*scale,hh=far.height*scale;c.drawImage(far,(720-w)/2,(sceneH-hh)/2,w,hh);}
  const shade=c.createLinearGradient(0,top,0,sceneH);shade.addColorStop(0,'rgba(13,34,40,.04)');shade.addColorStop(1,'rgba(12,31,36,.64)');this.rect(0,top,720,sceneH-top,0,shade);
  this.scrapDark(22,top-5,676,82,16);
  this.text(v.name,45,top+7,34,T.paper,700);
  this.text(active?'当前驾驶':owned?'已拥有':'尚未拥有',47,top+49,22,active?T.acid:T.mint,600);
  this.icon('car',548,top+34,23,T.mint);this.text((g.previewVehicle+1)+' / '+VEHICLES.length,577,top+20,23,T.paper);
  this.circle(663,top+35,20,active?T.acid:T.paper2,T.ink,2);this.icon(active?'check':owned?'car':'lock',663,top+35,21,T.ink);
  const personal=['unicycle','skateboard','scooter'].includes(v.kind),liftY=sceneH-55,clearance=(personal?185:v.kind==='bike'||v.kind==='trike'?146:139)+vehicleAppearance(build).bodyLift;
  const scale=clamp((liftY-top-87)/clearance,.78,2.9),carX=360,carY=liftY-(14+vehicleStats(build,g.previewVehicle).wheelRadius)*scale;
  c.save();c.shadowColor='rgba(184,242,58,.8)';c.shadowBlur=18;this.line([[144,liftY+14],[576,liftY+14]],T.acid,9);c.restore();
  this.line([[144,liftY+21],[576,liftY+21]],T.ink,13);
  this.car(carX,carY,-.018,scale,g.previewVehicle,0,[],build);
  const stats=vehicleStats(build,g.previewVehicle);
  this.scrapDark(18,fleetY-5,684,108,16);this.fleetPicker(26,fleetY,668,98);
  if(active){this.icon('check',49,equipY+28,27,T.acid);this.text('已装备 · 可以直接出发',77,equipY+14,24,T.paper,600);this.iconButton('workshopInfo',635,equipY+1,54,54,'info',false);}
  else{this.garageAction('equip',26,equipY,owned?590:436,56,owned?'使用这辆车':String(v.price)+' 购车',true,owned?'car':'coin');if(!owned)this.garageAction('pinVehicle',473,equipY,150,56,g.save.goalVehicle===g.previewVehicle?'已设目标':'攒币目标',false);this.iconButton('workshopInfo',637,equipY+1,54,54,'info',false);}
  this.scrapDark(18,tabsY-8,684,footer-tabsY+6,18);
  this.text('车辆改装',42,tabsY+2,26,T.paper,700);this.text('点选部件查看属性',226,tabsY+7,20,T.mint);
  this.garageAction('tuning',526,tabsY-1,155,49,'改装总览',false);
  UPGRADES.forEach((u,i)=>{const xx=30+(i%2)*335,yy=tabsY+54+Math.floor(i/2)*49,selected=part===u.id;this.rect(xx,yy,325,44,10,selected?'rgba(184,242,58,.18)':'rgba(167,225,206,.08)',selected?T.acid:'rgba(167,225,206,.4)');this.icon(u.icon,xx+28,yy+22,23,selected?T.acid:T.mint);this.text(u.name,xx+52,yy+8,24,T.paper,selected?700:500);this.text('Lv.'+build[u.id],xx+303,yy+10,21,selected?T.acid:T.mint,600,'right');this.hit('inspect:'+u.id,xx,yy,325,44);});
  this.workshopDetail(26,detailY,668,detailH,UPGRADES.find(u=>u.id===part)||UPGRADES[0]);
  this.garageAction('characters',26,footer,168,62,'驾驶员',false,'person');this.garageAction('start',210,footer,484,62,owned?'开始游戏':'先购买车辆',true,'play');
};

Renderer.prototype.garageAction=function(action,x,y,w,h,label,primary=true,iconName){
  const fill=primary?T.acid:T.paper2;
  this.scrapPaper(x,y,w,h,action.length+label.length,fill,T.ink);
  if(iconName)this.icon(iconName,x+35,y+h/2,26,T.ink);
  this.text(label,x+w/2+(iconName?12:0),y+(h-25)/2-2,25,T.ink,700,'center');
  this.hit(action,x,y,w,h);
};

Renderer.prototype.workshopDetail=function(x,y,w,h,u){
  const g=this.g,build=previewBuild(g.save,g.previewVehicle),info=upgradePreview(u.id,build,g.previewVehicle),owned=g.save.owned.includes(g.previewVehicle),gate=upgradeGate(g.save,info.level);
  const mod=selectedSpecialization(build,u.id),available=SPECIALIZATIONS[u.id].filter(m=>!specializationGate(g.save,g.previewVehicle,u.id,m));
  this.icon(u.icon,x+35,y+27,27,T.acid);this.text(u.name+'改装',x+61,y+11,28,T.paper,700);this.text('Lv.'+info.level+' / '+MAX_LEVEL,x+w-18,y+16,22,T.mint,600,'right');
  for(let i=0;i<MAX_LEVEL;i++)this.rect(x+17+i*(w-34)/MAX_LEVEL,y+54,(w-34)/MAX_LEVEL-4,5,2,i<info.level?T.acid:'rgba(244,240,213,.19)');
  info.rows.slice(0,2).forEach(([label,a,b,unit],i)=>{const yy=y+72+i*44,icons={engine:['engine','speed'],tires:['wheel','mountain'],suspension:['shield','spring'],tank:['fuel','clock']};this.icon(icons[u.id][i],x+35,yy+17,24,T.mint);this.text(label,x+64,yy+3,23,T.mint,500);this.text(a+' → '+b+unit,x+w-20,yy+3,26,T.paper,600,'right');});
  const my=y+h-113;this.line([[x+20,my-7],[x+w-20,my-7]],'rgba(244,240,213,.22)',1.5);this.icon('swap',x+36,my+15,21,T.acid);
  this.text(mod?mod.name:available.length?'专精 · '+available.length+' 项可选':'专精 · 未解锁',x+61,my+2,22,T.mint);this.icon('chevron',x+w-30,my+15,21,T.mint);this.hit('branch:'+u.id,x+18,my-4,w-36,38);
  this.garageAction('test:'+u.id,x+16,y+h-61,168,52,'试车',false,'speed');
  const cost=upgradeCost(info.level),maxed=info.level>=MAX_LEVEL,label=maxed?'已满级':!owned?'先购车':gate||'升级 '+cost;
  this.garageAction('upgrade:'+u.id,x+195,y+h-61,w-211,52,label,owned&&!gate&&!maxed,'plus');
};
Renderer.prototype.fleetPicker=function(x,y,w,h){
  const g=this.g,count=Math.ceil(VEHICLES.length/3),page=clamp(g.fleetPage||0,0,count-1),edge=44,gap=10,slot=(w-edge*2-gap*4)/3;
  for(const [step,xx,enabled] of [[-1,x,page>0],[1,x+w-edge,page<count-1]]){
    this.ctx.save();this.ctx.translate(xx+edge/2,y+h/2);if(step<0)this.ctx.rotate(Math.PI);
    this.icon('chevron',0,0,21,enabled?T.paper:T.muted);this.ctx.restore();if(enabled)this.hit('fleet:'+step,xx,y,edge,h);
  }
  for(let j=0;j<3;j++){
    const i=page*3+j,v=VEHICLES[i];if(!v)break;
    const xx=x+edge+gap+j*(slot+gap),selected=g.previewVehicle===i,has=g.save.owned.includes(i);
    if(selected)this.rect(xx-2,y+1,slot+4,h-2,12,'rgba(184,242,58,.11)',T.acid);
    this.vehicleStamp(xx+slot/2,y+h*.38,i,has?1.13:.64);
    this.text(v.name,xx+slot/2,y+h-30,Math.min(23,(slot-8)/v.name.length),selected?T.paper:T.mint,selected?700:500,'center');
    this.icon(has?'check':'lock',xx+slot-16,y+14,12,has?T.acid:T.muted);
    this.hit('vehicle:'+i,xx,y,slot,h);
  }
};
module.exports = {};
