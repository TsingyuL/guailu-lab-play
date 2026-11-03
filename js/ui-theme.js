const config = require('./config');
const { Renderer } = require('./renderer');
const { Game } = require('./game');
const { RacingMechanics } = require('./mechanics');
const { hash } = require('./sketch');
const {
  COLORS: C, VEHICLES, CHARACTERS, UPGRADES, SPECIALIZATIONS,
  getRoute, vehicleStats, previewBuild, upgradesFor, CHAPTERS,
  stageUnlocked, stageStars, clamp, mapFrontier
} = config;

// UI-only skin. Gameplay/terrain/vehicle physics stay in the original project.
const T = {
  ink:'#172623', dark:'#1f2d29', dark2:'#2a3934', dark3:'#354842',
  paper:'#f4f0d5', paper2:'#e1dfc5', mint:'#a7e1ce', mint2:'#6cbca4',
  acid:'#b8f23a', acid2:'#91c92b', coral:'#e46669', purple:'#8567a7',
  gold:'#efb83b', muted:'#78948a', white:'#fffceb'
};
Object.assign(C,{ink:T.ink,muted:T.muted,paper:T.paper,green:T.acid,mint:T.mint,coral:T.coral,gold:T.gold,white:T.white,sky:T.mint});

function roughPoints(x,y,w,h,seed=1,j=4){
  const pts=[];
  const rnd=n=>(hash(seed*97+n)-.5)*j*2;
  for(let i=0;i<=4;i++)pts.push([x+w*i/4,y+rnd(i)]);
  for(let i=1;i<=3;i++)pts.push([x+w+rnd(10+i),y+h*i/3]);
  for(let i=4;i>=0;i--)pts.push([x+w*i/4,y+h+rnd(20+i)]);
  for(let i=2;i>=1;i--)pts.push([x+rnd(30+i),y+h*i/3]);
  return pts;
}

Renderer.prototype.scrapPaper=function(x,y,w,h,seed=1,fill=T.paper,stroke=T.ink){
  const pts=roughPoints(x,y,w,h,seed,4);
  this.shape(pts,fill,1.7,stroke);
  this.line([[x+9,y+h-8],[x+w-9,y+h-8]],'rgba(66,69,55,.16)',1);
};
Renderer.prototype.scrapDark=function(x,y,w,h,r=18){
  this.rect(x,y+4,w,h,r,'rgba(9,15,14,.22)');
  this.rect(x,y,w,h,r,T.dark2,T.mint2);
};
Renderer.prototype.uiTopBar=function(title='',back=false){
  const g=this.g,top=Math.max(18,(g.platform.safe?.top||0)+8,(g.platform.menuBottom||0)+8);
  this.rect(14,top,692,64,18,'rgba(31,45,41,.95)',T.mint2);
  if(back){this.icon('back',48,top+32,26,T.paper);this.hit('home',19,top,62,64);}
  if(title)this.text(title,back?88:34,top+13,28,T.paper,600);
  const coinX=470;this.icon('coin',coinX,top+32,22,T.gold);this.text(g.save.coins,coinX+28,top+18,20,T.paper,500);
  this.icon(g.save.sound?'sound':'mute',586,top+32,24,T.paper);this.hit('sound',546,top,80,64);
  this.icon('help',666,top+32,23,T.paper);this.hit('help',626,top,80,64);
};

Renderer.prototype.panel=function(x,y,w,h,fill=C.paper,r=20){
  // Existing content becomes cream-paper / dark-lab rather than clean app cards.
  const dark = typeof fill==='string' && (fill.includes('rgba(2')||fill===T.dark||fill===T.dark2||fill===T.dark3);
  if(dark){this.scrapDark(x,y,w,h,r);return;}
  this.rect(x,y+4,w,h,r,'rgba(13,25,21,.16)');
  this.scrapPaper(x,y,w,h,17,T.paper,T.ink);
};

Renderer.prototype.button=function(action,x,y,w,h,label,primary=true,iconName){
  const pressed=Array.from(this.g.pointers.values()).some(p=>p.action===action);
  const yy=y+(pressed?4:0),fill=primary?T.acid:T.paper2;
  this.rect(x,yy+4,w,h,Math.min(16,h/4),'rgba(8,16,14,.25)');
  this.shape(roughPoints(x,yy,w,h,action.length+label.length,3),fill,1.8,T.ink);
  const symbols={garage:'car',campaign:'mountain',routes:'mountain',start:'play',quickStart:'play',resume:'play',retry:'swap',next:'arrow',home:'home',characters:'person',equipCharacter:'person',equip:'car',pinVehicle:'flag',gas:'arrow',brake:'back',testAgain:'swap',audioTest:'sound'};
  const symbol=iconName||symbols[action]||(action.startsWith('upgrade:')?'plus':null);
  const size=h>65?26:20,cx=x+w/2;
  if(symbol){this.icon(symbol,cx-(label?Math.min(92,w*.23):0),yy+h/2,Math.min(31,h*.48),T.ink);}
  if(label)this.text(label,cx+(symbol?18:0),yy+(h-size)/2-1,size,T.ink,600,'center');
  this.hit(action,x,y,w,h);
};

Renderer.prototype.textAction=function(action,x,y,w,h,label,iconName){
  this.icon(iconName,x+w/2,y+21,26,T.paper);
  this.text(label,x+w/2,y+46,17,T.paper,500,'center');
  this.hit(action,x,y,w,h);
};

Renderer.prototype.headerPortrait=function(){
  const g=this.g;
  if(g.screen==='home'){
    const top=Math.max(18,(g.platform.safe?.top||0)+8,(g.platform.menuBottom||0)+8);
    this.rect(410,top,162,58,23,'rgba(31,45,41,.82)','rgba(167,225,206,.55)');
    this.icon('coin',438,top+29,22,T.gold);this.text(g.save.coins,462,top+16,21,T.paper,600);
    this.circle(610,top+29,29,'rgba(31,45,41,.82)','rgba(167,225,206,.55)',1.5);
    this.icon(g.save.sound?'sound':'mute',610,top+29,24,T.paper);this.hit('sound',580,top,60,58);
    this.circle(674,top+29,29,'rgba(31,45,41,.82)','rgba(167,225,206,.55)',1.5);
    this.icon('help',674,top+29,23,T.paper);this.hit('help',644,top,60,58);
  }
  else if(g.screen==='garage')this.uiTopBar('车库',true);
  else if(g.screen==='characters')this.uiTopBar('角色商店',true);
  else if(g.screen==='records')this.uiTopBar('关卡地图',true);
};
Renderer.prototype.campaignHeader=function(){this.uiTopBar('关卡地图',true);};

Renderer.prototype.homePortrait=function(){
  const g=this.g,c=this.ctx,h=this.h,w=this.w,r=g.routeSpec(),bottom=Math.max(24,(g.platform.safe.bottom||0)+12);
  const key=this.paintedSceneKey(r)||'sceneGlowroot',image=this.visualAsset(key)||this.visualAsset('sceneGlowroot');
  if(image){
    const scale=Math.max(w/image.width,h/image.height)*1.08,dw=image.width*scale,dh=image.height*scale;
    c.drawImage(image,(w-dw)/2+Math.sin(g.time*.25)*8,(h-dh)/2,dw,dh);
  }else this.rect(0,0,w,h,0,T.mint);
  const wash=c.createLinearGradient(0,0,0,h);
  wash.addColorStop(0,'rgba(12,37,40,.63)');wash.addColorStop(.34,'rgba(13,42,44,.18)');
  wash.addColorStop(.60,'rgba(13,33,38,.28)');wash.addColorStop(1,'rgba(16,30,29,.92)');
  this.rect(0,0,w,h,0,wash);

  const titleY=Math.max(132,this.headerY()+83),titleSize=clamp(h*.087,104,118);
  this.title(w/2,titleY,titleSize);
  this.text('开上怪路，看看能走多远',w/2,titleY+titleSize*2.24,24,T.paper,600,'center');

  const roadY=Math.min(h*.66,h-375),road=x=>roadY+12*Math.sin(x/128)+5*Math.sin(x/47),crest=[];
  for(let x=-12;x<=w+12;x+=12)crest.push([x,road(x)]);
  const underside=crest.slice().reverse().map(([x,y])=>[x,y+46]);
  this.shape([...crest,...underside],'#766687',2,T.ink);
  this.line(crest,T.acid,9);
  this.line(crest.map(([x,y])=>[x,y+26]),'rgba(244,240,213,.18)',2);
  const carX=360,carScale=clamp((roadY-titleY-titleSize*2.24-38)/135,1.4,2.78),carY=road(carX)-36*carScale;
  this.car(carX,carY+Math.sin(g.time*1.6)*2,Math.sin(g.time*1.2)*.015,carScale,g.save.vehicle,g.time*.1);
  this.hit('honk',carX-68*carScale,carY-88*carScale,136*carScale,119*carScale);
  if(g.honkUntil>g.time)this.hand('叭！',488,carY-154,34,T.paper,-.12);

  const record=this.routeRecord(),infoY=h-bottom-291;
  this.line([[30,infoY-16],[690,infoY-16]],'rgba(244,240,213,.42)',2);
  this.icon('flag',48,infoY+23,27,T.acid);
  this.text(this.routeTitle(),74,infoY+3,Math.min(31,430/this.routeTitle().length),T.paper,700);
  this.text((record.clear?'已通关 · ':'最远 ')+record.best+' / '+record.goal+'m',34,infoY+62,23,T.mint,600);
  this.rect(34,infoY+106,430,7,4,'rgba(244,240,213,.30)');
  if(record.percent)this.rect(34,infoY+106,430*record.percent/100,7,4,T.acid);
  this.button('quickStart',492,infoY+19,198,83,'出发',true,'play');

  const navY=h-bottom-146,nav=[['garage','车库','car'],['campaign','地图','mountain'],['records','记录','clock']];
  nav.forEach(([action,label,icon],i)=>this.button(action,24+i*230,navY,212,68,label,false,icon));
  this.text('已通关 '+this.progressSummary().frontier+' 关  ·  累计 '+Math.floor(g.save.lifetimeDistance||0)+'m',w/2,h-bottom-29,18,T.mint,500,'center');
};

Renderer.prototype.runBar=function(x,y,w){
  const g=this.g,c=g.car,ratio=clamp(c.fuel/c.fuelMax,0,1),progress=clamp(c.distance/g.goal,0,1);
  this.scrapDark(x,y,w,108,15);
  this.icon('flag',x+29,y+26,22,T.mint);this.text(this.routeTitle(),x+50,y+14,18,T.paper,500);
  const fuelX=x+w-272,fuelColor=ratio<.2?T.coral:T.acid2;
  this.icon('fuel',fuelX,y+27,21,fuelColor);this.rect(fuelX+22,y+20,110,13,7,T.paper2);if(ratio>0)this.rect(fuelX+22,y+20,110*ratio,13,7,fuelColor);
  this.text(Math.ceil(ratio*100)+'%',fuelX+144,y+15,18,T.paper,600);
  this.circle(x+w-36,y+28,24,T.paper,T.ink,2);this.icon('pause',x+w-36,y+28,21,T.ink);this.hit('pause',x+w-66,y,60,58);
  this.text(Math.min(g.goal,Math.floor(c.distance))+' / '+g.goal+'m',x+22,y+55,26,T.white,600);
  const income=g.runCoins+(g.airBonus||0)+(g.mechanics?.bonus||0),pulse=1+(g.coinPulse||0)*.15;
  this.icon('coin',x+w-84,y+72,21*pulse,T.gold);this.text(income,x+w-62,y+60,18*pulse,T.paper,500);
  this.rect(x+22,y+91,w-44,6,3,'rgba(244,240,213,.3)');if(progress>0)this.rect(x+22,y+91,(w-44)*progress,6,3,T.acid2);
};

Renderer.prototype.hudPortrait=function(){
  if(this.g.visualPack?.ready)return this.visualPackHud();
  const g=this.g,car=g.car,h=this.h,s=g.platform.safe,top=Math.max(25,s.top+14),bottom=Math.max(20,s.bottom+10),y=top+(g.platform.native?64:0),py=h-bottom-160;
  this.runBar(28,y,664);
  this.drivingNotice(360,y+123);
  this.text((car.vx<-5?'R · ':'')+Math.round(Math.abs(car.vx)*.36)+' km/h',360,py-54,25,T.paper,500,'center');
  this.jumpControl(75,Math.min(py-190,h*.59),108);
  [['brake',28,'后退',false],['gas',506,'油门',true]].forEach(([action,x,label,gas])=>{
    const pressed=g.input[action],yy=py+(pressed?5:0),fill=gas?T.acid:T.paper2;
    this.shape(roughPoints(x,yy,186,128,gas?302:301,3),fill,1.8,T.ink);
    this.icon(gas?'arrow':'back',x+93,yy+56,36,T.ink);this.text(label,x+93,yy+88,24,T.ink,600,'center');
    if(g.screen==='playing')this.hit(action,x,py,186,137);
  });
};
Renderer.prototype.handsOnHud=function(){/* Pure-vehicle build: no dismount/on-foot UI. */};

Renderer.prototype.pauseScreen=function(){
  const g=this.g,c=this.ctx,safe=g.platform.safe||{};
  g.buttons=[];
  this.rect(0,0,this.w,this.h,0,'rgba(12,24,23,.60)');
  const availableH=this.h-(safe.top||0)-(safe.bottom||0)-32;
  const scale=Math.min(1,(this.w-36)/520,availableH/400);
  const x=(this.w-520*scale)/2;
  const y=(safe.top||0)+16+(availableH-400*scale)/2;
  const p=(n)=>n*scale;
  c.save();c.shadowColor='rgba(5,15,14,.38)';c.shadowBlur=p(30);c.shadowOffsetY=p(14);
  this.rect(x,y,p(520),p(400),p(28),T.dark2);c.restore();
  this.rect(x,y,p(520),p(400),p(28),null,T.mint2,2);
  this.circle(x+p(61),y+p(61),p(27),T.acid,T.ink,2);
  this.icon('pause',x+p(61),y+p(61),p(26),T.ink);
  this.text('游戏暂停',x+p(104),y+p(28),p(32),T.paper,800);
  const distance=Math.max(0,Math.floor(g.car?.distance||0));
  this.text('第 '+(g.save.route+1)+' 关  ·  '+distance+' / '+g.goal+' m',x+p(104),y+p(74),p(19),T.mint,600);
  this.rect(x+p(40),y+p(117),p(440),p(7),p(4),'rgba(244,240,213,.22)');
  this.rect(x+p(40),y+p(117),p(440*clamp(distance/g.goal,0,1)),p(7),p(4),T.acid);
  this.button('resume',x+p(40),y+p(147),p(440),p(67),'继续游戏',true,'play');
  this.button('retry',x+p(40),y+p(234),p(208),p(60),'重新开始',false,'swap');
  this.button('home',x+p(272),y+p(234),p(208),p(60),'返回主页',false,'home');
  this.button('help',x+p(40),y+p(312),p(440),p(56),'玩法说明',false,'help');
  this.text('J 跳跃  ·  空格暂停',x+p(260),y+p(375),p(15),T.mint,500,'center');
};

Renderer.prototype.resultScreen=function(){
  const g=this.g,r=g.result,route=getRoute(r.route),complete=!!r.complete,next=g.resultAction(),c=this.ctx;g.buttons=[];
  this.rect(0,0,this.w,this.h,0,'rgba(60,111,137,.48)');
  const x=(this.w-Math.min(600,this.w-24))/2,y=(this.h-Math.min(820,this.h-24))/2,sx=Math.min(600,this.w-24)/600,sy=Math.min(820,this.h-24)/820;
  const hit=(action,xx,yy,ww,hh)=>this.hit(action,x+xx*sx,y+yy*sy,ww*sx,hh*sy);
  c.save();c.translate(x,y);c.scale(sx,sy);
  c.save();c.shadowColor='rgba(8,42,58,.28)';c.shadowBlur=28;c.shadowOffsetY=13;
  const card=c.createLinearGradient(0,0,0,820);card.addColorStop(0,'#fff9e8');card.addColorStop(1,'#f6f0d9');
  this.rect(0,0,600,820,31,card);c.restore();
  this.icon('close',560,35,23,'#768a8d');
  this.text(complete?'挑战成功':'挑战失败',300,32,45,'#163b47',900,'center');
  this.line([[70,309],[530,309]],'#9da9a5',2);
  this.circle(132,309,8,null,'#a8b3ae',2);this.circle(485,309,6,null,'#a8b3ae',2);
  if(!complete){
    this.line([[300,178],[315,166],[307,156],[320,145]],'#193e49',3);
    this.line([[323,149],[334,163],[321,175]],'#193e49',2);
    this.star(438,205,20,'#efbd5a');
    this.car(295,232,1.0,1.0,g.save.vehicle,0,[],null);
  }else{
    this.star(439,189,22,'#f4c760');
    this.car(300,235,-.07,1.0,g.save.vehicle,0,[],null);
    this.icon('flag',445,252,32,'#c4a84b');
  }
  this.text('第 '+(r.route+1)+' 关 · '+route.name.split(' · ').at(-1),300,328,25,'#274957',800,'center');
  this.text(Math.min(route.goal,r.distance)+' / '+route.goal+' m',300,375,45,'#163b47',900,'center');
  this.line([[60,450],[540,450]],'rgba(34,77,91,.25)',1.5);
  this.text('本次距离',70,469,24,'#385765',600);this.text(r.distance+' m',530,469,26,'#163b47',800,'right');
  this.text('收集金币',70,515,24,'#385765',600);
  this.circle(432,527,15,'#f6bc45','#a66c27',2);this.circle(432,527,9,null,'#fff0aa',2);
  this.text('+'+r.total,530,515,26,'#163b47',800,'right');
  this.line([[60,557],[540,557]],'rgba(34,77,91,.25)',1.5);
  const reason=complete?(r.personalBest?'刷新个人纪录！':'顺利抵达终点'):r.reason;
  this.text(reason,300,568,21,complete?'#37746b':'#a4544e',700,'center');
  const advice=r.advice?.title||(complete?'下一关已解锁':'调整操作，再试一次');
  const message=(complete?'下一趟：':'建议：')+advice;
  c.font='700 21px '+(g.platform.fontUI||'-apple-system, "PingFang SC", sans-serif');
  this.text(message,300,601,Math.max(17,Math.floor(21*490/Math.max(490,c.measureText(message).width))),'#385765',700,'center');
  this.text('主动跳跃 '+(r.jumpUses||0)+' 次 · 完美落地 '+(r.perfectLandings||0)+' 次',300,633,17,'#6e888e',600,'center');
  this.rect(65,669,470,61,18,'#1d4654');
  this.icon('play',164,699,27,'#fff9e8');
  this.text(complete?(next==='next'?'下一关':'返回地图'):'重新挑战',323,683,29,'#fff9e8',800,'center');
  this.rect(65,741,470,55,18,'#e7e7d8','#bac9c8');
  this.icon(complete?'mountain':'engine',164,768,25,'#234b58');
  this.text(complete?'返回地图':'按建议改装',323,754,26,'#234b58',800,'center');
  c.restore();
  hit('campaign',535,8,60,60);
  hit('rewardInfo',60,490,480,53);
  hit(complete?next:'retry',65,669,470,61);
  hit(complete?'campaign':'tune',65,741,470,55);
};

Renderer.prototype.charactersPortrait=function(){
  const g=this.g,h=this.h,idx=g.previewCharacter??g.save.character,p=CHARACTERS[idx],owned=g.save.ownedCharacters.includes(idx),equipped=g.save.character===idx;
  const top=Math.max(112,this.headerY()+80);this.rect(0,0,this.w,h,0,'#31443d');
  // Workshop-like scene with one hero, not a card wall.
  this.line([[0,h*.70],[this.w,h*.68]],'#6b7161',5);this.circle(126,top+168,86,'#40584e');
  this.characterPortrait(210,top+350,4.1,idx);
  this.scrapPaper(402,top+92,278,418,601,T.paper,T.ink);
  this.text(p.tag,438,top+126,30,T.ink,700);this.text(p.name,438,top+170,18,T.muted,500);
  this.wrap(p.desc,438,top+218,210,18,T.ink);
  this.text(owned?'已拥有':'角色价格',438,top+338,16,T.muted);
  if(!owned){this.icon('coin',447,top+386,22,T.gold);this.text(p.price,477,top+374,22,T.ink,600);}
  this.button('equipCharacter',422,top+438,238,58,equipped?'已选择':owned?'选择角色':'购买角色',!equipped,owned?'person':'coin');
  const railY=h-282;this.scrapDark(18,railY,684,194,20);
  CHARACTERS.forEach((spec,i)=>{const x=100+i*170,active=i===idx;this.circle(x,railY+82,54,active?T.acid:T.paper2,T.ink,active?3:1);this.characterPortrait(x,railY+91,1.55,i);this.text(spec.tag,x,railY+150,14,active?T.acid:T.paper,500,'center');this.hit('character:'+i,x-68,railY+18,136,145);});
};

Renderer.prototype.garagePortrait=function(){
  const g=this.g,h=this.h,v=VEHICLES[g.previewVehicle],build=previewBuild(g.save,g.previewVehicle),owned=g.save.owned.includes(g.previewVehicle),active=g.save.vehicle===g.previewVehicle;
  const top=Math.max(112,this.headerY()+80);this.rect(0,0,this.w,h,0,'#31443d');
  // Workshop wall / floor.
  for(let y=top+50;y<h-320;y+=72)this.line([[0,y],[720,y+8]],'rgba(184,202,178,.09)',1);
  this.line([[0,h-445],[720,h-455]],'#59675c',6);
  const stats=vehicleStats(build,g.previewVehicle);this.car(260,h-565,-.02,2.15,g.previewVehicle,0,[],build);
  this.scrapPaper(412,top+70,276,432,701,T.paper,T.ink);
  this.text(v.name,445,top+105,31,T.ink,700);this.text(v.desc||'怪路专用车辆',445,top+150,16,T.muted);
  [['速度',Math.round(stats.maxSpeed/65)],['操控',Math.round(stats.grip*7)],['稳定',Math.round(stats.angularDamping*3)],['缓冲',Math.round(stats.damping/2)]].forEach(([lab,val],i)=>{const yy=top+216+i*55;this.text(lab,445,yy,17,T.ink);this.rect(514,yy+5,132,12,6,T.paper2);this.rect(514,yy+5,Math.min(132,Math.max(12,val*13)),12,6,T.mint2);});
  if(active)this.text('已装备',550,top+455,20,T.acid2,600,'center');
  else this.button('equip',442,top+441,222,56,owned?'使用这辆车':String(v.price)+' 购车',true,owned?'car':'coin');
  const railY=h-300;this.scrapDark(18,railY,684,180,20);this.fleetPicker(30,railY+24,660,120);
  this.button('start',200,h-102,500,66,'开始游戏',true,'play');
};

const baseCampaignLayout=Renderer.prototype.campaignLayout;
Renderer.prototype.campaignLayout=function(){
  const m=baseCampaignLayout.call(this);
  const bends=[-112,112,-92,122,-108,102,-120,88];
  for(const node of m.nodes)node.x=clamp(m.center+bends[node.i%bends.length],m.x0+34,m.x1-34);
  return m;
};

Renderer.prototype.campaign=function(){
  const g=this.g,h=this.h,c=this.ctx,m=this.campaignLayout(),{left,right,top,bottom,nodes}=m;
  const route=getRoute(g.save.route),scene=this.paintedSceneKey(route);
  const image=this.visualAsset(scene||'sky');
  if(image){
    const scale=Math.max(this.w/image.width,h/image.height),dw=image.width*scale,dh=image.height*scale;
    c.drawImage(image,(this.w-dw)/2,(h-dh)/2,dw,dh);
    if(!scene){
      const far=this.visualAsset('far');
      if(far){const s=Math.max(this.w/far.width,h/far.height),fw=far.width*s,fh=far.height*s;c.drawImage(far,(this.w-fw)/2,(h-fh)/2,fw,fh);}
    }
  }else this.campaignBackdrop();
  const wash=c.createLinearGradient(0,0,0,h);wash.addColorStop(0,'rgba(15,39,41,.26)');wash.addColorStop(.48,'rgba(15,39,41,.12)');wash.addColorStop(1,'rgba(15,39,41,.58)');this.rect(0,0,this.w,h,0,wash);
  c.save();c.beginPath();c.rect(0,top+106,this.w,bottom-top-92);c.clip();
  const curve=(a,b,color,width,dashed=false)=>{c.beginPath();c.moveTo(a.x,a.y);const bend=(a.y+b.y)/2,dx=b.x-a.x;c.bezierCurveTo(a.x+dx*.12+22,bend,b.x-dx*.12-22,bend,b.x,b.y);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.setLineDash(dashed?[3,10]:[]);c.stroke();c.setLineDash([]);};
  for(const {a,b,lit,secondary} of this.campaignConnections(m)){if(secondary){curve(a,b,lit?'#d5e8ba':'#899e9d',3,true);continue;}curve(a,b,'rgba(10,27,30,.76)',24);curve(a,b,lit?'#b8f23a':'#d6d6c6',15);curve(a,b,lit?'#fff3b8':'#f2f0df',2,true);}
  for(const {i,x,y} of nodes){if(y<top+125||y>bottom+52)continue;const unlocked=stageUnlocked(g.save,i,g.mapSummary.frontier),clear=unlocked&&!!g.save.firstClears[i],selected=g.save.route===i,size=selected?38:32;
    const labelW=200,labelX=x>m.center?x-labelW-52:x+52,labelY=y-31,stage=getRoute(i),shortName=stage.name.split(' · ').pop();
    c.save();
    this.rect(labelX,labelY+4,labelW,64,14,'rgba(9,26,27,.24)');
    this.rect(labelX,labelY,labelW,62,14,selected?T.paper:'rgba(28,49,47,.90)',selected?T.acid:clear?T.mint2:'rgba(199,220,210,.42)',selected?3:1.5);
    this.text('第 '+(i+1)+' 关',labelX+14,labelY+7,17,selected?T.muted:clear?T.mint:'#a9bcb4',700);
    this.text(shortName,labelX+14,labelY+29,Math.min(22,176/shortName.length),selected?T.ink:T.paper,700);
    c.fillStyle='rgba(25,39,34,.25)';c.beginPath();c.ellipse(x,y+15,size+6,18,0,0,Math.PI*2);c.fill();
    const pts=[[x,y-size],[x+size*.94,y-size*.48],[x+size*.85,y+size*.5],[x,y+size],[x-size*.85,y+size*.5],[x-size*.94,y-size*.48]];this.shape(pts,selected?T.gold:clear?T.mint2:unlocked?T.paper2:T.dark2,2.8,T.ink);
    if(unlocked)this.text(i+1,x,y-14,27,T.ink,700,'center');else this.icon('lock',x,y,22,T.paper);
    if(clear)this.campaignStars(labelX+labelW-45,labelY+16,Math.max(1,g.save.routeStars?.[i]||3));
    if(selected){this.line([[x+35,y-18],[x+35,y-60]],T.ink,3);this.shape([[x+36,y-59],[x+70,y-50],[x+36,y-39]],T.coral,2,T.ink);}
    c.restore();if(y>=top+125&&y<=bottom-44){
      this.hit('route:'+i,labelX,labelY,labelW,62);
      this.hit('route:'+i,x-44,y-44,88,92);
    }
  }
  c.restore();
  const chapter=Math.max(0,route.chapter||0),cleared=Object.values(g.save.firstClears||{}).filter(Boolean).length;
  this.rect(24,top+12,672,80,18,'rgba(26,46,43,.94)',T.mint2,2);
  this.text('第 '+(chapter+1)+' 章  /  怪路探险',46,top+21,19,T.mint,700);
  this.text(CHAPTERS[chapter%CHAPTERS.length],46,top+45,30,T.paper,800);
  this.icon('flag',548,top+54,22,T.acid);this.text('通关 '+cleared,571,top+40,20,T.paper,700);
  const selected=getRoute(g.save.route),safeBottom=g.platform.safe.bottom||0,fy=h-Math.max(215,safeBottom+193),fw=this.w-left-right,record=this.routeRecord();
  this.rect(12,fy-20,696,h-fy+10,22,T.dark2,T.mint2,2);
  this.text('当前关卡',left+4,fy-2,18,T.mint,700);
  this.text(this.routeTitle(),left+4,fy+23,Math.min(29,580/this.routeTitle().length),T.paper,800);
  this.campaignStars(this.w-right-92,fy+36,g.save.routeStars?.[g.save.route]||0);
  this.text((record.clear?'已通关 · ':'最远 ')+record.best+' / '+selected.goal+'m',left+4,fy+67,19,T.mint);this.text(record.percent+'%',this.w-right-8,fy+67,19,T.mint,700,'right');
  this.rect(left+4,fy+96,fw-8,5,3,'rgba(244,240,213,.25)');if(record.percent)this.rect(left+4,fy+96,(fw-8)*record.percent/100,5,3,T.acid);
  this.button('garage',left+4,fy+115,145,66,'车库',false,'car');this.button('start',left+165,fy+115,fw-169,66,record.clear?'再玩一次':'开始挑战',true,'play');
};

Renderer.prototype.recordsScreen=function(){this.g.screen='campaign';this.campaign();};

Renderer.prototype.helpPortrait=function(){
  const g=this.g;g.buttons=[];this.rect(0,0,this.w,this.h,0,'rgba(12,20,18,.72)');const x=55,y=(this.h-760)/2;this.scrapDark(x,y,610,760,24);this.scrapPaper(x+54,y+34,502,84,901,T.paper,T.ink);this.text('怎么玩',x+305,y+54,34,T.ink,700,'center');this.icon('close',x+560,y+76,26,T.paper);this.hit('close',x+530,y+48,55,55);
  const rows=[['car','油门向前，后退提供反向动力'],['air','空中油门抬头，后退压头'],['air','左侧跳跃越过断路和尖坡'],['fuel','补给点双踏板驻车加油'],['wheel','特殊路面改变抓地与滚动阻力'],['clock','倒地持续 2 秒才判失败']];
  rows.forEach(([ico,label],i)=>{const yy=y+155+i*76;this.icon(ico,x+78,yy+20,28,T.acid);this.text(label,x+118,yy+7,20,T.paper);});
  this.button('close',x+90,y+655,430,60,'知道了',true);
};

// Product rules agreed in the conversation: no on-foot / no dismount.
// Normalize old hot-reload/debug sessions as well as new runs. Previously an
// already-active on-foot state could survive after the button was removed,
// leaving a tiny rider, drag target and driving controls drawn on top of one
// another while physics stayed frozen.
function pureVehicleState(mechanics){
  if(!mechanics)return;
  mechanics.onFoot=false;mechanics.walkTime=0;mechanics.stoneDrag=null;
  // The same terrain event remains a normal physical rock and is rendered by
  // roadMechanisms; only the obsolete draggable duplicate is removed.
  mechanics.looseStone=null;
}
const pureVehicleDraw=Renderer.prototype.draw;
Renderer.prototype.draw=function(){pureVehicleState(this.g.mechanics);return pureVehicleDraw.call(this);};
const pureVehicleStep=RacingMechanics.prototype.handsOnStep;
RacingMechanics.prototype.handsOnStep=function(dt){pureVehicleState(this);return pureVehicleStep.call(this,dt);};
RacingMechanics.prototype.canExit=function(){return false;};
RacingMechanics.prototype.toggleDriver=function(){return false;};
RacingMechanics.prototype.beginStoneDrag=function(){return false;};
RacingMechanics.prototype.moveStone=function(){};
RacingMechanics.prototype.dropStone=function(){return false;};

const oldAction=Game.prototype.action;
Game.prototype.action=function(action){
  if(action==='driver')return;
  if(action==='records')action='campaign';
  return oldAction.call(this,action);
};

// Route 2 keeps the stone as a vehicle obstacle, but no longer advertises dismounting.
try{
  const r=getRoute(1);if(r&&r.spec)r.spec.hint='碎石前减速，低速稳过；也可借坡跳过挡路石，到终点即可过关';
}catch(_){}

module.exports={T,pureVehicleState};
