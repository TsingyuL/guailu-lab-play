// Painted portrait UI based on the supplied home, map and garage references.
// All labels, progress and actions remain tied to the live game save.
const {Renderer}=require('./renderer');
const {Game}=require('./game');
const {VEHICLES,UPGRADES,CHAPTERS,getRoute,contractLabel,contractProgress,stageUnlocked,previewBuild,upgradePreview,upgradeCost,upgradeGate,vehicleStats,vehicleAppearance,MAX_LEVEL,clamp}=require('./config');
const {T}=require('./ui-theme');

const cream='#fff1c9',ink='#26332c',lime='#c8f431',orange='#eaa64f';

Renderer.prototype.referenceScene=function(name){
  const route=this.g.routeSpec(),scene=name||this.paintedSceneKey(route)||'sceneDune';
  const c=this.ctx,image=this.visualAsset(scene)||this.visualAsset('sceneDune');
  if(!image){this.rect(0,0,720,this.h,0,route.sky||'#edaa83');return;}
  const scale=Math.max(720/image.width,this.h/image.height),dw=image.width*scale,dh=image.height*scale;
  c.drawImage(image,(720-dw)/2,(this.h-dh)/2,dw,dh);
};
Renderer.prototype.referenceBrush=function(x,y,w,h,fill,seed=1){
  const points=[[x+9,y+5],[x+w*.28,y],[x+w*.76,y+4],[x+w-8,y+3],[x+w,y+h*.29],[x+w-13,y+h*.49],[x+w+2,y+h*.79],[x+w-18,y+h-4],[x+w*.61,y+h+2],[x+w*.24,y+h-2],[x+2,y+h-6],[x+10,y+h*.58],[x-3,y+h*.31]];
  this.shape(points,fill,2,ink);
  this.line([[x+12,y+h-8],[x+w-18,y+h-8]],'rgba(84,64,38,.19)',2);
};
Renderer.prototype.referenceWord=function(word,x,y,size,rotate=0){
  const c=this.ctx,face=this.g.platform.fontDisplay||this.g.platform.fontUI||'sans-serif';
  c.save();c.translate(x,y);c.rotate(rotate);c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
  c.font=`900 ${size}px ${face}`;c.shadowColor='rgba(25,42,36,.46)';c.shadowBlur=4;c.shadowOffsetY=9;
  c.strokeStyle='#203b35';c.lineWidth=Math.max(9,size*.18);c.strokeText(word,0,0);
  c.shadowBlur=0;c.shadowOffsetY=0;c.fillStyle=cream;c.fillText(word,0,0);c.restore();
};
Renderer.prototype.referenceRibbon=function(x,y,w,h,label){
  this.shape([[x,y+11],[x+w*.27,y],[x+w*.76,y+4],[x+w,y+10],[x+w-17,y+h*.53],[x+w,y+h-5],[x+w*.54,y+h],[x+5,y+h-4],[x+22,y+h*.55]],cream,2,'#87614b');
  this.text(label,x+w/2,y+(h-27)/2,26,ink,750,'center');
};
Renderer.prototype.referenceBadge=function(x,y,w,h){
  this.referenceBrush(x,y,w,h,'#294941',11);
  this.icon('coin',x+30,y+h/2,22,'#f4bc45');this.text(this.g.save.coins,x+56,y+(h-25)/2,25,cream,700);
};
Renderer.prototype.referenceButton=function(action,x,y,w,h,label,primary=true,icon){
  const pressed=Array.from(this.g.pointers.values()).some(p=>p.action===action),dy=pressed?4:0;
  this.ctx.save();this.ctx.shadowColor=primary?'rgba(198,240,44,.65)':'rgba(41,34,25,.25)';this.ctx.shadowBlur=primary?12:5;
  this.referenceBrush(x,y+dy,w,h,primary?lime:cream,action.length+label.length);this.ctx.restore();
  const fs=Math.min(36,h*.48,Math.max(21,w/(label.length+2.5)));
  if(icon)this.icon(icon,x+w*.25,y+dy+h*.51,Math.min(32,h*.45),ink);
  this.text(label,x+w*(icon?.57:.5),y+dy+(h-fs)/2-4,fs,ink,750,'center');
  this.hit(action,x,y,w,h);
};
Renderer.prototype.referenceTop=function(title,back=true){
  const g=this.g,top=this.headerY(),native=g.platform.native;
  if(g.screen==='garage'){
    this.referenceBrush(22,top-11,220,58,'#294941',38);
  }
  if(back){this.icon('back',51,top+17,27,cream);this.hit(g.garageFromPause?(g.screen==='garage'?'returnToPause':g.screen==='characters'?'garage':'home'):'home',14,top-13,76,66);}
  if(title)this.text(title,back?100:37,top-2,30,cream,700);
  // The WeChat capsule owns the upper right corner on a native screen.
  const right=native?Math.min(550,720-(g.platform.menuInset||150)-8):676;
  if(g.screen==='garage'){
    this.referenceBrush(right-199,top-10,120,56,'#294941',39);
    this.referenceBrush(right-102,top-10,57,56,'#294941',40);
    this.referenceBrush(right-38,top-10,57,56,'#294941',41);
  }
  this.icon('coin',right-171,top+18,20,'#f4c44d');this.text(g.save.coins,right-145,top+2,23,cream,600);
  this.icon(g.save.sound?'sound':'mute',right-61,top+18,25,cream);this.hit('sound',right-101,top-4,80,64);
  this.icon('help',right+3,top+18,24,cream);this.hit('help',right-37,top-4,80,64);
  this.line([[33,top+50],[687,top+50]],'rgba(255,227,168,.72)',2);
};
Renderer.prototype.headerPortrait=function(){
  if(this.g.screen==='home'){
    const g=this.g,top=this.headerY(),right=g.platform.native?Math.min(545,720-(g.platform.menuInset||150)-15):675;
    this.referenceBadge(right-260,top-11,130,55);
    this.referenceBrush(right-117,top-11,51,55,'#294941',31);this.icon(g.save.sound?'sound':'mute',right-91,top+16,25,cream);this.hit('sound',right-122,top-13,62,65);
    this.referenceBrush(right-56,top-11,51,55,'#294941',32);this.icon('help',right-31,top+16,25,cream);this.hit('help',right-61,top-13,62,65);
  }
  else if(this.g.screen==='garage')this.referenceTop('车库');
  else if(this.g.screen==='campaign'||this.g.screen==='routes'||this.g.screen==='records')this.referenceTop('关卡地图');
  else if(this.g.screen==='characters')this.referenceTop('角色商店');
};

Renderer.prototype.homePortrait=function(){
  const g=this.g,h=this.h,c=this.ctx,bottom=Math.max(20,(g.platform.safe.bottom||0)+14),top=this.headerY();
  this.referenceScene();
  const warm=c.createLinearGradient(0,0,0,h);warm.addColorStop(0,'rgba(255,235,192,.02)');warm.addColorStop(.75,'rgba(75,55,48,.03)');warm.addColorStop(1,'rgba(37,43,37,.55)');this.rect(0,0,720,h,0,warm);
  const titleY=Math.max(top+120,h*.16);
  this.line([[145,titleY+122],[230,titleY+88],[490,titleY+88],[575,titleY+122]],lime,4);
  this.referenceWord('怪路',360,titleY,105,-.025);this.referenceWord('实验室',360,titleY+108,97,.015);
  this.referenceRibbon(148,titleY+172,424,60,'· 开上怪路，看看能走多远 ·');
  const carY=Math.min(h*.60,h-484),carScale=clamp((h-1080)/320+2.4,2.35,2.65);
  this.shape([[75,carY+127],[220,carY+106],[360,carY+121],[513,carY+105],[650,carY+124],[566,carY+147],[319,carY+146],[126,carY+150]],'rgba(216,150,104,.53)',1,'rgba(123,83,68,.28)');
  this.car(360,carY+Math.sin(g.time*1.5)*2,0,carScale,g.save.vehicle,g.time*.09);
  this.hit('honk',205,carY-230,310,310);
  const actionY=h-bottom-343;
  this.referenceButton('quickStart',142,actionY,436,115,'出发',true,'play');
  this.line([[166,actionY+155],[207,actionY+155]],cream,2);
  const cleared=this.progressSummary().frontier,total=Math.floor(g.save.lifetimeDistance||0);
  this.text('已通关 '+cleared+' 关  ·  累计 '+total+'m',360,actionY+137,23,cream,700,'center');
  this.line([[514,actionY+155],[555,actionY+155]],cream,2);
  const navY=h-bottom-130,nav=[['garage','车库','car'],['campaign','关卡地图','mountain'],['records','记录','clock']];
  nav.forEach(([action,label,icon],i)=>{const x=27+i*231;this.referenceBrush(x,navY,208,91,cream,20+i);this.icon(icon,x+43,navY+46,29,ink);this.text(label,x+126,navY+24,29,ink,750,'center');this.hit(action,x,navY,208,91);});
};

const baseLayout=Renderer.prototype.campaignLayout;
Renderer.prototype.campaignLayout=function(){
  const m=baseLayout.call(this),bends=[275,478,360,230,310,400,265,480];
  for(const node of m.nodes){node.x=bends[node.i%bends.length];node.y-=105;}
  return m;
};
Renderer.prototype.campaignHeader=function(){this.referenceTop('关卡地图');};
Renderer.prototype.referenceNode=function(n,m){
  const g=this.g,{i,x,y}=n,selected=g.save.route===i,unlocked=stageUnlocked(g.save,i,g.mapSummary.frontier),clear=unlocked&&!!g.save.firstClears[i];
  const labelX=x>m.center?x-247:x+46,labelY=y-27,labelW=201;
  this.shape([[x-48,y+30],[x-23,y+15],[x+32,y+14],[x+53,y+33],[x+29,y+41],[x-43,y+41]],'#805b54',2,'#593e3b');
  const stone=[[x,y-39],[x+31,y-20],[x+29,y+28],[x,y+37],[x-30,y+27],[x-31,y-18]];
  this.shape(stone,selected?'#f9c947':clear?'#80c9b8':'#39494a',3,ink);
  if(unlocked)this.text(i+1,x,y-21,31,ink,800,'center');else this.icon('lock',x,y-1,26,cream);
  if(selected){this.line([[x+27,y-27],[x+27,y-83]],ink,3);this.shape([[x+27,y-82],[x+66,y-71],[x+27,y-57]],lime,2,ink);}
  this.referenceBrush(labelX,labelY,labelW,69,selected?cream:'#344743',i);
  const name=getRoute(i).name;
  this.text('第 '+(i+1)+' 关',labelX+17,labelY+8,18,selected?ink:cream,700);
  this.text(name,labelX+17,labelY+34,Math.min(23,166/name.length),selected?ink:cream,750);
  if(clear)this.campaignStars(labelX+labelW-46,labelY+17,Math.max(1,g.save.routeStars?.[i]||3));
  this.hit('route:'+i,labelX,labelY,labelW,69);this.hit('route:'+i,x-40,y-43,80,85);
};
Renderer.prototype.campaign=function(){
  const g=this.g,c=this.ctx,h=this.h,m=this.campaignLayout(),{top,bottom,nodes}=m;
  this.referenceScene();
  const wash=c.createLinearGradient(0,0,0,h);wash.addColorStop(0,'rgba(70,49,62,.25)');wash.addColorStop(.5,'rgba(255,225,189,.03)');wash.addColorStop(1,'rgba(31,39,35,.22)');this.rect(0,0,720,h,0,wash);
  c.save();c.beginPath();c.rect(0,top+22,720,bottom-top+55);c.clip();
  const drawPath=(a,b,color,width,dashes=[])=>{c.beginPath();c.moveTo(a.x,a.y);const mid=(a.y+b.y)/2;c.bezierCurveTo(a.x+10,mid,a.x+(b.x-a.x)*.35,mid,b.x,b.y);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.setLineDash(dashes);c.stroke();c.setLineDash([]);};
  for(const {a,b,lit,secondary} of this.campaignConnections(m)){
    if(secondary)continue;
    drawPath(a,b,'rgba(96,58,48,.55)',61);
    drawPath(a,b,lit?'#c6da55':'#eaa66f',48);
    drawPath(a,b,'#fff4d1',3,[10,15]);
  }
  for(const n of nodes)if(n.y>top+65&&n.y<bottom+47)this.referenceNode(n,m);
  c.restore();
  const bannerY=top-45,chapterIndex=Math.floor(g.save.route/3),firstStage=chapterIndex*3+1;
  this.referenceBrush(44,bannerY,332,55,cream,4);this.text('第 '+(chapterIndex+1)+' 章 / 第 '+firstStage+'–'+(firstStage+2)+' 关',70,bannerY+10,24,ink,700);
  this.referenceBrush(42,bannerY+54,342,73,'#2c473d',5);this.text(CHAPTERS[chapterIndex]||'延续路线',70,bannerY+65,39,cream,800);
  const safeBottom=g.platform.safe.bottom||0,fy=h-Math.max(292,safeBottom+268),record=this.routeRecord(),selected=getRoute(g.save.route);
  const shade=c.createLinearGradient(0,fy-32,0,h);shade.addColorStop(0,'rgba(38,42,38,.82)');shade.addColorStop(1,'rgba(35,39,34,.93)');this.rect(0,fy-32,720,h-fy+32,0,shade);
  this.icon('flag',67,fy+13,23,lime);this.text('当前关卡',90,fy-2,21,'#c4e4cb',700);
  this.text(this.routeTitle(),48,fy+35,Math.min(34,610/this.routeTitle().length),cream,800);
  this.campaignStars(617,fy+57,g.save.routeStars?.[g.save.route]||0);
  this.text('挑战 · '+contractLabel(selected)+(g.save.contracts[g.save.route]?' ✓':g.save.route?'  +'+selected.contractReward:''),48,fy+93,21,'#c8e0d0');this.text(record.best+' / '+selected.goal+'m',668,fy+93,21,cream,700,'right');
  this.rect(48,fy+125,624,7,4,'rgba(255,241,201,.35)');if(record.percent)this.rect(48,fy+125,624*record.percent/100,7,4,lime);
  this.referenceButton('garage',48,fy+162,177,70,'车库',false,'car');
  this.referenceButton('start',248,fy+155,423,84,record.clear?'再次挑战':'开始挑战',true,'play');
};
Renderer.prototype.recordsScreen=function(){this.campaign();};

Renderer.prototype.garagePortrait=function(){
  const g=this.g,h=this.h,c=this.ctx,v=VEHICLES[g.previewVehicle],build=previewBuild(g.save,g.previewVehicle),owned=g.save.owned.includes(g.previewVehicle),active=g.save.vehicle===g.previewVehicle;
  this.rect(0,0,720,h,0,'#a8d8cb');
  const sky=this.visualAsset('sky'),far=this.visualAsset('far'),heroBottom=Math.min(h*.41,550);
  if(sky){const scale=Math.max(720/sky.width,heroBottom/sky.height),dw=sky.width*scale,dh=sky.height*scale;c.drawImage(sky,(720-dw)/2,0,dw,dh);}
  if(far){const scale=Math.max(720/far.width,heroBottom*.66/far.height),dw=far.width*scale,dh=far.height*scale;c.drawImage(far,(720-dw)/2,heroBottom-dh,dw,dh);}
  this.referenceBrush(47,this.headerY()+65,627,80,'#294941',16);
  this.text(v.name,77,this.headerY()+78,33,cream,800);
  this.text(active?'当前驾驶':owned?'已拥有':'尚未拥有',80,this.headerY()+117,18,active?lime:cream,650);
  this.icon('car',544,this.headerY()+104,24,cream);this.text((g.previewVehicle+1)+' / '+VEHICLES.length,580,this.headerY()+86,26,cream,700);
  const personal=['unicycle','skateboard','scooter'].includes(v.kind),groundY=heroBottom+5;
  const clearance=(personal?185:v.kind==='bike'||v.kind==='trike'?146:139)+vehicleAppearance(build).bodyLift;
  const scale=clamp((groundY-this.headerY()-155)/clearance,1.25,2.15);
  const carY=groundY-(14+vehicleStats(build,g.previewVehicle).wheelRadius)*scale;
  this.line([[214,groundY+8],[506,groundY+8]],'#8e594d',5);
  this.line([[245,groundY+6],[475,groundY+6]],lime,4);
  this.car(360,carY,0,scale,g.previewVehicle,0,[],build);
  this.referenceBrush(57,heroBottom-213,61,68,cream,17);this.icon('chevron',87,heroBottom-178,26,ink);this.hit('vehicle:'+Math.max(0,g.previewVehicle-1),48,heroBottom-220,80,84);
  c.save();c.translate(632,heroBottom-178);c.rotate(Math.PI);this.referenceBrush(-30,-34,61,68,cream,18);this.icon('chevron',0,0,26,ink);c.restore();this.hit('vehicle:'+Math.min(VEHICLES.length-1,g.previewVehicle+1),592,heroBottom-220,80,84);
  const fleetY=heroBottom+27;this.rect(26,fleetY,668,116,25,'rgba(27,67,62,.90)','#9bc9b7');this.fleetPicker(32,fleetY+8,656,103);
  const statusY=fleetY+121;this.icon('check',190,statusY+18,25,lime);this.text(active?'已装备，可以直接出发':owned?'已拥有，选择后即可出发':'购买后即可驾驶',360,statusY+2,22,cream,700,'center');
  const tabsY=statusY+48,detailsY=tabsY+68,footerY=h-Math.max(115,(g.platform.safe.bottom||0)+99),detailsH=Math.max(240,footerY-detailsY-20),tab=g.referenceGarageTab||'upgrade';
  this.referenceButton('garageTab:upgrade',57,tabsY,303,62,'改装',tab==='upgrade','engine');
  this.referenceButton('garageTab:stats',365,tabsY,298,62,'属性',tab==='stats','speed');
  this.rect(26,detailsY,668,detailsH,25,'rgba(27,65,61,.96)','#9bc9b7',2);
  if(tab==='upgrade'){
    const selected=g.garagePart||'engine',parts=[UPGRADES[0],UPGRADES[1],UPGRADES[2],UPGRADES[3]],tileY=detailsY+18;
    parts.forEach((part,i)=>{const x=47+(i%2)*318,y=tileY+Math.floor(i/2)*54,sel=selected===part.id;
      this.rect(x,y,307,47,11,sel?'rgba(194,243,55,.16)':'rgba(230,246,229,.06)',sel?lime:'#789c91',sel?2:1.5);
      this.icon(part.icon,x+28,y+24,22,sel?lime:'#b8ded0');this.text(part.name,x+52,y+10,21,cream,700);this.text('Lv.'+(build[part.id]||0),x+292,y+12,18,sel?lime:'#b8ded0',600,'right');this.hit('inspect:'+part.id,x,y,307,47);
    });
    const part=UPGRADES.find(p=>p.id===selected)||UPGRADES[0],info=upgradePreview(part.id,build,g.previewVehicle),sectionY=tileY+125;
    this.icon(part.icon,70,sectionY+13,27,lime);this.text(part.name+'改装',100,sectionY,25,cream,750);this.text('Lv.'+info.level+' / '+MAX_LEVEL,656,sectionY+3,21,'#b8ded0',650,'right');
    for(let k=0;k<MAX_LEVEL;k++)this.rect(68+k*38,sectionY+43,33,5,2,k<info.level?lime:'rgba(233,239,214,.23)');
    info.rows.slice(0,2).forEach(([label,a,b,unit],i)=>{const y=sectionY+63+i*39;this.text(label,72,y,20,'#b8ded0',650);this.text(a+' → '+b+unit,650,y,21,cream,700,'right');});
    const by=detailsY+detailsH-72;
    this.referenceButton('test:'+selected,48,by,144,55,'试车',false,'speed');
    this.referenceButton('characters',205,by,172,55,'驾驶员',false,'person');
    const gate=upgradeGate(g.save,info.level),label=info.level>=MAX_LEVEL?'已满级':!owned?'先购车':gate||'升级 '+upgradeCost(info.level);
    this.referenceButton('upgrade:'+selected,393,by,274,55,label,true,'coin');
  }else{
    this.text(v.name+' · '+v.role,58,detailsY+25,30,cream,750);
    this.wrap(v.desc,60,detailsY+74,590,22,'#b8ded0');
    UPGRADES.forEach((part,i)=>{const y=detailsY+130+i*48;this.icon(part.icon,75,y+17,22,lime);this.text(part.name,106,y+3,23,cream,650);this.text('Lv.'+(build[part.id]||0),650,y+4,22,cream,700,'right');});
    this.referenceButton('workshopInfo',84,detailsY+detailsH-77,550,54,'查看车辆说明',false,'info');
  }
  this.referenceButton(owned?(g.garageFromPause?'resumeFromGarage':'start'):'equip',113,footerY+20,494,77,owned?(g.garageFromPause?'继续本局':'开始游戏'):v.price+' 购车',true,owned?'play':'coin');
};

const referenceAction=Game.prototype.action;
Game.prototype.action=function(action){
  if(action==='garageTab:upgrade'||action==='garageTab:stats'){this.referenceGarageTab=action.split(':')[1];return;}
  return referenceAction.call(this,action);
};

Renderer.prototype.hudPortrait=function(){
  const g=this.g,c=this.ctx,car=g.car,h=this.h,top=Math.max(25,g.platform.native?(g.platform.menuBottom||0)+16:(g.platform.safe.top||0)+16),distance=Math.min(g.goal,Math.max(0,Math.floor(car.distance))),progress=clamp(distance/g.goal,0,1),speed=Math.round(Math.abs(car.vx)*.36);
  const shade=c.createLinearGradient(0,0,0,250);shade.addColorStop(0,'rgba(37,44,47,.48)');shade.addColorStop(1,'rgba(37,44,47,0)');this.rect(0,0,720,250,0,shade);
  this.referenceBrush(19,top-8,78,69,cream,44);this.icon('pause',58,top+26,28,ink);this.hit('pause',12,top-13,92,80);
  const title='第 '+(g.save.route+1)+' 关 · '+getRoute(g.save.route).name;
  this.text(title,354,top+1,Math.min(31,550/title.length),cream,800,'center');
  this.referenceBadge(575,top-9,124,58);
  this.text(distance+'m / '+g.goal+'m',360,top+60,24,cream,750,'center');
  this.rect(182,top+96,362,17,9,'#263e39',cream,2);if(progress)this.rect(185,top+99,356*progress,11,6,lime);
  this.icon('flag',552,top+104,22,'#f27d6b');
  this.circle(618,top+192,58,'rgba(30,54,47,.92)',cream,2.5);
  c.save();c.beginPath();c.arc(618,top+192,51,Math.PI*.8,Math.PI*(.8+1.4*clamp(speed/220,0,1)));c.strokeStyle=lime;c.lineWidth=9;c.stroke();c.restore();
  this.text(String(speed),618,top+168,33,cream,800,'center');this.text('km/h',618,top+205,16,cream,700,'center');
  if(!g.visualPack?.ready)this.drivingNotice(359,top+227);
  if(!g.routeSpec().spec.authored){
   const mission=contractProgress(g),missionY=top+128+(this.threatMeterCount?.()||0)*35;
   this.referenceBrush(20,missionY,506,37,'#294941',81);
   this.text('挑战 · '+mission.label,41,missionY+6,19,cream,700);
   this.text(mission.task.shown,507,missionY+6,18,mission.task.met?lime:cream,800,'right');
  }
  const pedalY=h-226;
  this.metalPedal('brake',32,pedalY,172,138,'刹车');
  this.metalPedal('gas',550,pedalY-8,140,146,'油门');
  const jumpY=h-337,jumpPressed=Array.from(g.pointers.values()).some(p=>p.action==='jump');
  const jumpFill=c.createLinearGradient(0,jumpY-57,0,jumpY+57);
  jumpFill.addColorStop(0,'#f4f7f7');jumpFill.addColorStop(1,'#96b0bd');
  c.save();c.shadowColor='rgba(7,34,52,.5)';c.shadowBlur=12;
  this.circle(100,jumpY,57,jumpFill,'#142d3a',4);c.restore();
  this.circle(100,jumpY,49,null,'rgba(255,255,255,.8)',2);
  this.icon('air',100,jumpY,47,jumpPressed?'#2d657d':ink);
  this.text('跳跃',100,jumpY+66,22,'#fff1c9',800,'center');
  if(g.screen==='playing')this.hit('jump',34,jumpY-65,132,150);
};

Renderer.prototype.pauseScreen=function(){
  const g=this.g,h=this.h,c=this.ctx,top=Math.max(70,(g.platform.safe.top||0)+50),bottom=Math.max(26,(g.platform.safe.bottom||0)+10),distance=Math.max(0,Math.floor(g.car?.distance||0));g.buttons=[];
  this.referenceScene();this.rect(0,0,720,h,0,'rgba(29,31,37,.70)');
  this.referenceWord('暂停中',360,top+133,104,-.02);
  const boardY=top+215;
  this.shape([[70,boardY+38],[106,boardY+8],[590,boardY+8],[653,boardY+53],[668,boardY+169],[624,boardY+237],[540,boardY+248],[130,boardY+244],[54,boardY+193]],'#847d70',5,'#273e39');
  this.referenceBrush(151,boardY+39,418,52,'#34443d',50);this.icon('flag',186,boardY+65,24,lime);this.text(this.routeTitle(),360,boardY+49,29,cream,800,'center');
  this.icon('mountain',170,boardY+153,32,cream);this.text('当前距离',215,boardY+111,22,cream,650);this.text(distance+'m',215,boardY+146,39,cream,800);
  this.line([[370,boardY+110],[370,boardY+200]],cream,2);
  this.icon('coin',420,boardY+153,32,'#f0b742');this.text('当前金币',470,boardY+111,22,cream,650);this.text(g.save.coins,470,boardY+146,39,cream,800);
  const heroY=boardY+375;this.car(360,heroY,0,1.45,g.save.vehicle,0);
  const by=h-bottom-440;
  this.referenceButton('resume',137,by,446,76,'继续',true,'play');
  this.referenceButton('garage',156,by+88,408,65,'车库 · 换车改装',false,'car');
  this.referenceButton('retry',156,by+165,408,65,'重新开始',false,'swap');
  this.referenceButton('campaign',156,by+242,408,65,'返回地图',false,'mountain');
  this.referenceButton('home',156,by+319,408,65,'退出主页',false,'home');
};

Renderer.prototype.resultScreen=function(){
  const g=this.g,r=g.result,h=this.h,c=this.ctx,route=getRoute(r.route),complete=!!r.complete,bottom=Math.max(20,(g.platform.safe.bottom||0)+10);g.buttons=[];
  // Keep the completed run's route, parallax and crop on its settlement card.
  this.background(true);
  const shade=c.createLinearGradient(0,0,0,h);shade.addColorStop(0,'rgba(37,44,38,.04)');shade.addColorStop(1,'rgba(48,45,40,.52)');this.rect(0,0,720,h,0,shade);
  const titleY=Math.max(120,h*.14);
  this.referenceWord(complete?'挑战结算':'挑战结束',360,titleY,93,-.025);
  this.referenceRibbon(158,titleY+86,404,62,this.routeTitle(r.route));
  const heroY=Math.min(h*.59,titleY+440),carX=244;
  this.shape([[45,heroY+122],[200,heroY+106],[374,heroY+119],[480,heroY+146],[260,heroY+155],[70,heroY+146]],'rgba(224,148,92,.45)',1,'rgba(113,77,59,.28)');
  this.car(carX,heroY,complete?0:.13,2.45,g.save.vehicle,0);
  const dataX=394,dataY=titleY+194,items=complete?
    [['本次距离',r.distance+'m','mountain'],['历史最远',Math.max(r.distance,g.save.routeBests[r.route]||0)+'m','flag'],['获得金币',String(r.total),'coin']]:
    [['本次距离',r.distance+'m','mountain'],[r.distance>=route.goal?'任务进度':'距离终点',r.distance>=route.goal?(r.mission?.shown||'未完成'):Math.max(0,route.goal-r.distance)+'m','flag'],['获得金币',String(r.total),'coin']];
  items.forEach(([label,value,icon],i)=>{
    const y=dataY+i*94;this.referenceBrush(dataX,y,260,78,cream,70+i);this.icon(icon,dataX+36,y+39,26,ink);this.text(label,dataX+74,y+10,18,ink,650);this.text(value,dataX+228,y+34,31,ink,800,'right');
  });
  const progressY=h-bottom-365,chapter=Math.floor(r.route/3),clears=g.save.firstClears.slice(chapter*3,chapter*3+3).filter(Boolean).length,pct=Math.round(clears/3*100);
  this.referenceBrush(91,progressY-58,538,42,'#294941',80);
  this.text('挑战 · '+r.contractLabel,110,progressY-50,19,cream,700);
  const task=r.mission,missed=task?.type==='time'?'超时 '+Math.ceil(task.value-task.target)+' 秒':task?.type==='fuel'?'剩油 '+Math.floor(task.value)+'%':task?.type==='distance'?'未到站':'完成 '+Math.floor(task?.value||0)+'/'+(task?.target||0);
  this.text(r.missionMet?'已达成'+(r.contractReward?' +'+r.contractReward:''):complete?missed:'未到站',610,progressY-50,19,r.missionMet?lime:cream,800,'right');
  this.rect(87,progressY,546,45,18,'rgba(35,59,52,.92)',cream,2);this.icon('mountain',117,progressY+22,23,cream);this.text('章节进度',144,progressY+9,21,cream,700);
  this.rect(280,progressY+11,325,23,12,'#283e38',cream,1);if(pct)this.rect(283,progressY+14,319*pct/100,17,9,lime);this.text(pct+'%',441,progressY+7,25,ink,800,'center');
  const buttonY=h-bottom-240;
  this.referenceButton('campaign',30,buttonY,282,97,'返回地图',false,'mountain');
  this.icon('info',dataX+230,dataY+222,19,ink);
  this.hit('rewardInfo',dataX+6,dataY+188,250,78);
  const primaryAction=complete?g.resultAction():'retry';
  const primaryLabel=complete?(primaryAction==='next'?'下一关':'返回地图'):'再来一次';
  this.referenceButton(primaryAction,330,buttonY,360,97,primaryLabel,true,'play');
  this.icon('engine',265,h-bottom-65,23,cream);this.text('继续前往车库',360,h-bottom-78,24,cream,700,'center');this.icon('chevron',520,h-bottom-65,22,cream);this.hit('tune',205,h-bottom-92,340,65);
  if(!complete){this.referenceBrush(91,heroY+157,538,46,'#34443d',79);this.text('建议：'+(r.advice?.title||r.reason),360,heroY+165,20,cream,700,'center');}
};

module.exports={};
