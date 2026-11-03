const COLORS = {
  ink: '#172623', muted: '#7c6c83', paper: '#eee8d6', sky: '#9fd6bd',
  green: '#b4cb57', mint: '#d9dd9d', coral: '#e88067', gold: '#d9e766', white: '#f4efdb'
};
const BIOMES = [
  { id: 'pine', name: '瞪眼山谷', en: 'WATCHING VALLEY', tag: '第一关', difficulty: 1, goal: 900, coinGoal: 60, firstReward: 150, sky: '#9fd6bd', far: '#729fa0', mid: '#527c87', near: '#365667', earth: '#8c70a4', grass: '#b5ed48', desc: '这里的树好像一直在看你。', length: '短途旅行' },
  { id: 'dune', name: '怪牙荒漠', en: 'CROOKED DUNES', tag: '第二关', difficulty: 1.3, goal: 1200, coinGoal: 80, firstReward: 200, sky: '#e6bb99', far: '#be839a', mid: '#92537a', near: '#633955', earth: '#ad7d85', grass: '#c3ea52', desc: '石头的牙比车胎还多。', length: '短途旅行' },
  { id: 'snow', name: '冷笑雪岭', en: 'GRINNING RIDGE', tag: '第三关', difficulty: 1.4, goal: 1600, coinGoal: 110, firstReward: 250, sky: '#a9dcdc', far: '#88a7c5', mid: '#687bad', near: '#4d527d', earth: '#827ba9', grass: '#c1f1d4', desc: '冻僵的笑容也会动。', length: '短途旅行' }
];
const CHAPTERS = ['怪物出门','菌伞漂流','白骨回声','钟摆废城','玻璃潮汐','倒生花园'];
const SCENES = [
 {id:'wild',name:'瞪眼荒野'},
 {id:'mushroom',name:'菌伞漂流',sky:'#d7bfd8',far:'#b397bb',mid:'#8b739e',near:'#655878',earth:'#97758b',grass:'#e5bc73'},
 {id:'fossil',name:'白骨回声',sky:'#e8cca3',far:'#cfac8f',mid:'#b38d86',near:'#8b687a',earth:'#b58b81',grass:'#e7d4a2'},
 {id:'clockwork',name:'钟摆废城',sky:'#a8c8c4',far:'#799f9e',mid:'#617e8d',near:'#485f74',earth:'#8b7f88',grass:'#e9bd72'},
 {id:'crystal',name:'玻璃潮汐',sky:'#bed6e7',far:'#9cb5d7',mid:'#7c96bb',near:'#5d749a',earth:'#8c89ad',grass:'#b5f0e4'},
 {id:'inverted',name:'倒生花园',sky:'#c2bfd4',far:'#a49ebc',mid:'#7c789f',near:'#5c627f',earth:'#95829f',grass:'#d0e79c'}
];
const ROAD_MIXES = [[],['wave','sponge','ribs'],['ribs','wave','tilt','heave'],['tilt','slick','heave','sponge'],['slick','heave','wave','ribs'],['sponge','tilt','heave','wave']];
const STAGE_TYPES = {
  cruise:{label:'热身',hint:'熟悉山坡，稳稳到站',span:2300,lift:82,stone:14,mud:true,objective:'landing',target:3},
  sprint:{label:'疾驰',hint:'借陡坡起跳，落地前收油调平',span:2850,lift:62,stone:9,mud:false,objective:'time',target:52,weird:'ridge'},
  air:{label:'飞越',hint:'断路前保持速度，空中调平车身',span:1800,lift:92,stone:12,mud:false,objective:'dodge',target:4,weird:'gap'},
  grip:{label:'技术',hint:'崎岖路慢过，碎石前提前减速',span:2000,lift:65,stone:17,mud:true,objective:'crawl',target:2,weird:'rough'},
  fuel:{label:'续航',hint:'崎岖路稳住车身，下坡松油',span:2650,lift:72,stone:10,mud:false,objective:'fuel',target:55,weird:'rough'},
  chase:{label:'追逐',hint:'怪雾逼近，断路前保持速度',span:2200,lift:84,stone:12,mud:false,objective:'flow',target:2,weird:'gap'}
};
const STAGE_PLANS = [
 ['瞪眼山谷','cruise'],['怪牙荒漠','cruise'],['冷笑雪岭','cruise'],
 ['裂谷快线','sprint'],['连跳沙丘','air'],['冰脊慢行','grip'],
 ['最后一桶油','fuel'],['沙暴尾随','chase'],['低空航线','air'],
 ['根须迷道','grip'],['油箱远征','fuel'],['极地快递','sprint'],
 ['怪雾猎场','chase'],['碎齿试炼','grip'],['零度飞车','air'],
 ['漫长归途','fuel'],['末班高架','sprint'],['怪物谢幕','chase']
];
// The next 36 deterministic courses keep their existing terrain seeds and
// physics, but have distinct editorial identities and a short in-run focus.
const EXTENDED_STAGE_BRIEFS = [
 ['钟摆跃线','坡前提速，空中调平'],['潮汐断面','看清断口再起跳'],['白骨油径','长路留油，坡上保速'],
 ['菌伞追影','雾近时保持轮胎着地'],['软路齿廊','软路减速，碎齿再跳'],['倾桥速递','桥面变化时稳住车身'],
 ['倒生空档','连续断路之间留起跳速度'],['晶面远征','滑路少空转，油桶别漏'],['暗林回声','被追时先稳落再加速'],
 ['悬根碎阶','台阶前收油，落地再补'],['斜塔快道','借起坡飞过高差'],['玻璃飞桥','跳过断口后压平车头'],
 ['骨海补给线','留油越过最后长坡'],['菌影突围','保持前进，别陷入沟底'],['潮声波路','波面上保持稳定轮距'],
 ['摇桥冲刺','桥头提速，桥中调姿'],['钟楼缺口','断口前确认速度'],['白骨长坡','上坡留扭矩，下坡省油'],
 ['晶雾边缘','雾逼近时先选稳路线'],['化石黏齿','黏路后控制碎石速度'],['钟摆双坡','两段陡坡之间及时调平'],
 ['倒生连跃','落稳后再起第二跳'],['骨纹省油路','无补给段多用滑行'],['菌群追逐','穿过软路保持速度'],
 ['钟楼碎浪','波浪路先稳住车身'],['晶石飞台','起跳后看落点再调姿'],['化石滑空','滑路起跳避免空转'],
 ['菌伞长途','下坡松油为长坡留余量'],['骨雾近身','追雾中减少无效跳跃'],['齿轮薄冰','滑面和碎石分段处理'],
 ['白骨终点线','终段仍要留速度'],['菌海越隙','断路前助跑并二段调姿'],['钟表油门','长路注意下一桶油'],
 ['倒影疾追','雾压迫下优先稳落'],['菌根险坡','陡沟出弯再加速'],['化石末班车','连续高差控制车速']
];
// 先让玩家学会驾驶，再逐步叠加怪路；不改车的动力，也不自动救车。
const OPENING_LESSONS=[
 {label:'第一次跳跃',hint:'小坡前点左侧跳跃；独轮车可保持油门，后退可压头',terrainScale:.3,lift:24,stone:3,ruggedCount:1,ruggedScale:.1,surfaceGrip:.95,surfaceDrag:.015,fog:false,skillLesson:{jumps:1,landings:0}},
 {label:'对准坡面',hint:'起跳后调整车身角度，贴着落地坡面稳稳着地',terrainScale:.43,lift:32,stone:5,ruggedCount:1,ruggedScale:.24,surfaceGrip:.86,surfaceDrag:.035,fog:false,skillLesson:{jumps:1,landings:1}},
 {label:'起伏与收油',hint:'碎石前减速稳过，或起跳沿金币弧飞越；落地后再加速',terrainScale:.58,lift:43,stone:7,ruggedCount:2,ruggedScale:.34,surfaceGrip:.78,surfaceDrag:.06,fog:false},
 {label:'第一处分叉',hint:'先走平缓下路熟悉分叉，上路跳跃可稍后挑战',terrainScale:.64,lift:46,stone:7,ruggedCount:2,ruggedScale:.4,surfaceGrip:.78,surfaceDrag:.06,fog:false,featureScale:.45,branchScale:.6},
 // 第一次断路只练跳跃：圆坡、恢复距离和补给先给足，追雾留到下一关。
 {label:'越过小断路',hint:'断口前按跳跃，落稳再加速；没有追雾，可以后退重新助跑',terrainScale:.72,span:2300,lift:54,stone:8,ruggedCount:2,ruggedScale:.46,surfaceGrip:.76,surfaceDrag:.06,fog:false,featureScale:.6,featureCount:1,gapWidth:100,fuelGap:3600},
 {label:'怪路组合',hint:'尖坡、起伏组合出现，落稳再跳，不必一直轰油门',terrainScale:1,lift:65,stone:14,ruggedCount:4,ruggedScale:.85,surfaceGrip:.56,surfaceDrag:.14,fog:true,fogDelay:8,fogSpeed:145,featureScale:1}
];
// 首关不是障碍样品陈列，而是一条可背、可练、可比较的900m短路线。
// 物理、分叉和拾取仍走通用系统；这里只声明经过人工编排的坐标。
const OPENING_SHOWCASE={
 features:[
  {id:'auth-contact',kind:'ribs',x:900,end:1700,strength:.72,lesson:'贴地快过'}
 ],
 rugged:[
  {id:'auth-launch',kind:'kicker',x:1900,end:3000,amplitude:68,sharp:false,tipRadius:62,style:'launch'},
  {id:'auth-landing',kind:'landing',x:3000,end:4400,amplitude:54,sharp:false,tipRadius:62,style:'landing',landingZone:[3260,3420]},
  {id:'auth-recovery',kind:'recovery',x:6500,end:8400,amplitude:108,sharp:false,tipRadius:72,style:'recovery'}
 ],
 branches:[{
  id:'auth-branch',kind:'branch',x:4400,decision:4620,end:6200,height:240,entryLift:195,approachLift:140,toothHeight:30,toothWidth:80,
  upperGap:{x:5260,end:5450},lowerTeeth:[5160,5400,5640]
 }],
 coinTrails:[
  {id:'contact',path:'ground',points:Array.from({length:10},(_,i)=>({x:980+i*76,yOffset:-48}))},
  // The kicker drops away sharply. Fixed world heights keep this coin line
  // on the actual jump parabola instead of bending it down with the road.
  {id:'launch',path:'air',points:[150,115,35,0,-10,5,55,140,250,360,340,335].map((y,i)=>({x:2460+i*65,y}))},
  {id:'near-land',path:'ground',points:Array.from({length:8},(_,i)=>({x:3260+i*22,yOffset:-50}))},
  {id:'far-land',path:'ground',points:Array.from({length:5},(_,i)=>({x:3780+i*65,yOffset:-50}))},
  {id:'upper',path:'upper',branch:'upper',points:Array.from({length:18},(_,i)=>({x:4700+i*72,yOffset:-58-Math.sin(i/17*Math.PI)*28}))},
  {id:'lower',path:'lower',branch:'lower',points:Array.from({length:12},(_,i)=>({x:4700+i*90,yOffset:-48}))},
  {id:'lower-fuel',path:'lower',branch:'lower',type:'fuel',fuelUnits:14,points:[{x:5500,yOffset:-54}]},
  {id:'recovery-air',path:'air',points:[180,105,90,135,245,350,440,455,450,440,420,395].map((y,i)=>({x:6740+i*105,y}))},
  {id:'recovery-low',path:'ground',points:[{x:7280,yOffset:-48},{x:7500,yOffset:-48}]}
 ],
 notices:[
  {id:'contact',x:700,decisionX:900,icon:'wheel',text:'贴地收币 · 起跳会错过'},
  {id:'launch',x:1850,decisionX:2380,icon:'air',text:'借坡起跳 · 慢行也能过'},
  {id:'landing',x:2850,decisionX:3260,icon:'down',text:'近处收币 · 远处稳落'},
  {id:'branch',x:4000,decisionX:4620,icon:'swap',text:'上路金币 · 下路补给'},
  {id:'recovery',x:6250,decisionX:6740,icon:'air',text:'飞越收币 · 落沟可爬出'}
 ]
};
const ROUTES = STAGE_PLANS.map(([name,type],i)=>{
 const chapter=Math.floor(i/3),biome=i%3,b=BIOMES[biome],spec={...STAGE_TYPES[type]};
 // 首章先学驾驶，之后才逐步增加跳跃、起伏和路线判断。
 if(i===0)Object.assign(spec,{label:'山谷杯',objective:'landing',target:3,hint:'尖坡前起跳，落地前调姿，开到终点即可过关'});
 if(i===1)Object.assign(spec,{label:'清障路',objective:'crawl',target:1,hint:'挡路石前减速可稳过，保持速度起跳可飞越；到终点即可过关'});
 if(i===2)Object.assign(spec,{label:'续航路',objective:'fuel',target:45,hint:'黏路别硬轰，下坡松油，保持燃油开到终点'});
 const {id:scene,name:sceneName,...palette}=SCENES[chapter];
 spec.ruggedness=.85+Math.min(.45,chapter*.1);
 if(i<OPENING_LESSONS.length){const lesson=OPENING_LESSONS[i];Object.assign(spec,{tutorial:lesson,label:lesson.label,hint:lesson.hint,lift:lesson.lift,stone:lesson.stone,span:lesson.span??spec.span});}
 if(i===0)Object.assign(spec,{authored:OPENING_SHOWCASE,branch:true,mud:false,label:'回声试验道',hint:'贴地、借坡、选落点和选路线；看金币高度决定开法',tutorial:{...spec.tutorial,skillLesson:null}});
 const goal=type==='fuel'?({6:2200,10:2800,15:3350}[i]):b.goal+chapter*180;
 // Equipment pressure comes from an actual dry leg, never a minimum-level lock.
 const expedition=type==='fuel'?{first:1800,gap:goal*10-3000,refill:90,
  climb:i>=10?{x:4200,up:4400,down:3400,rise:i===10?2300:2400}:null}:null;
 return {...b,...palette,scene,sceneName,id:b.id+'-'+chapter,biome,chapter,name:i===0?'回声试验道':name,type,spec:{...spec,expedition,chapter,motion:chapter?Math.min(2.5,.65+chapter*.35):0,hazardCount:chapter>=3?2:1,gapWidth:spec.tutorial?.gapWidth??(145+Math.max(0,chapter-1)*7),featureCount:spec.tutorial?.featureCount??(chapter?Math.min(7,2+chapter):0),roadMix:ROAD_MIXES[chapter],mixOffset:biome,goal,branch:spec.branch||type==='sprint'&&i>=3,handsOn:{rock:i===1||type==='grip',gum:i===2||type==='fuel'},lab:{swamp:i>=1}},tag:'第 '+(i+1)+' 关',
  difficulty:b.difficulty+chapter*.035,goal,coinGoal:b.coinGoal+chapter*10,
  firstReward:b.firstReward+chapter*65,contractReward:80+chapter*25,masteryReward:40+chapter*20,
  target:spec.objective==='time'?Math.ceil((b.goal+chapter*180)/(36+chapter*.6))+(chapter>=3?6:3):spec.objective==='dodge'?4+chapter:spec.objective==='crawl'&&chapter>0?3+Math.floor(chapter/3):spec.objective==='fuel'&&chapter>0?66+chapter*2:spec.objective==='flow'?2+Math.floor(chapter/3):spec.target,
  hitLimit:chapter>0&&['grip','air','chase'].includes(type)?(chapter>=3&&type!=='chase'?1:2):null};
});
const CHAPTER_REWARDS=[300,500,750,1000,1300,1700];
// Deterministic retries; a bounded cache avoids generating the whole map.
const MAX_ROUTE=99999,generatedRoutes=new Map();
const stageDepth=i=>i;
const depthStages=depth=>Number.isInteger(depth)&&depth>=0&&depth<=MAX_ROUTE?[depth]:[];
function stageParents(i){
 return i>0&&i<=MAX_ROUTE?[i-1]:[];
}
function mapFrontier(save){
 let next=0;
 while(next<MAX_ROUTE&&save.firstClears[next])next++;
 return next;
}
function getRoute(i){
 if(!Number.isInteger(i)||i<0||i>MAX_ROUTE)return null;
 if(i<ROUTES.length)return ROUTES[i];
 if(generatedRoutes.has(i))return generatedRoutes.get(i);
 // 路线编号的内容种子沿用旧版；地图改为单线不重洗已有怪路。
 const depth=3+Math.floor((i-3)/3),tier=depth-7,column=(i-3)%3;
 let seed=(Math.imul(i+1,2654435761)^0x51f15e)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const biome=Math.floor(random()*3),sceneIndex=1+Math.floor(random()*5);
 const types=['air','grip','fuel','sprint','chase'],type=types[(depth+column*2)%types.length];
 const base=STAGE_TYPES[type],chapter=Math.floor(i/3),pressure=Math.log2(1+tier);
 const goal=2400+Math.round(220*pressure),difficulty=1.48+.15*(1-Math.exp(-tier/16));
 const {id:scene,name:sceneName,...palette}=SCENES[sceneIndex];
 const mix=['wave','sponge','ribs','tilt','slick','heave'];
 for(let n=mix.length-1;n>0;n--){const j=Math.floor(random()*(n+1));[mix[n],mix[j]]=[mix[j],mix[n]];}
 const route={...BIOMES[biome],...palette,id:'generated-v3-'+i,generatorVersion:3,generated:true,biome,scene,sceneName,chapter,depth,type,
  name:sceneName+' · '+base.label,tag:'第 '+(i+1)+' 关',goal,difficulty,
  coinGoal:140+Math.floor(pressure*14),firstReward:600+Math.floor(pressure*35),contractReward:230+Math.floor(pressure*12),masteryReward:150+Math.floor(pressure*8),
  spec:{...base,chapter,goal,ruggedness:1.3,span:Math.max(1800,base.span-Math.floor(80*(1-Math.exp(-tier/12)))),
   lift:base.lift+Math.min(9,pressure*2),stone:base.stone,roadMix:mix,mixOffset:column,featureCount:Math.min(8,6+Math.floor(pressure)),motion:Math.min(3,2+pressure*.15),hazardCount:Math.min(3,2+Math.floor(pressure/4)),gapWidth:174+Math.min(16,pressure*2),
   expedition:type==='fuel'?{first:1800,gap:Math.min(33000,goal*10-3000),refill:90,climb:{x:4200,up:4400,down:3400,rise:2400}}:null,
   branch:type==='sprint',handsOn:{rock:type==='grip',gum:type==='fuel'},lab:{swamp:true}},
  target:base.objective==='time'?Math.ceil(goal/(50+Math.min(9,pressure))):base.objective==='dodge'?9+Math.floor(pressure):base.objective==='crawl'?4+Math.floor(pressure/2):base.objective==='fuel'?Math.min(78,68+Math.floor(pressure)):3+Math.floor(pressure/3),
  hitLimit:['grip','air'].includes(type)?1:type==='chase'?2:null};
 const brief=EXTENDED_STAGE_BRIEFS[i-ROUTES.length];
 if(brief){route.name=sceneName+' · '+brief[0];route.spec={...route.spec,focus:brief[1]};route.editorial=true;}
 generatedRoutes.set(i,route);
 if(generatedRoutes.size>128)generatedRoutes.delete(generatedRoutes.keys().next().value);
 return route;
}
function contractLabel(r){
 const task=stageTask(r);
 return task.type==='distance'?'抵达 '+r.goal+'m':task.type==='landing'?'稳落 '+task.target+' 次':task.type==='time'?'限时 '+task.target+' 秒到站':task.type==='dodge'?'飞越障碍 '+task.target+' 次':task.type==='crawl'?'稳过碎石 '+task.target+' 次':task.type==='fuel'?'剩油至少 '+task.target+'%':'触发顺风 '+task.target+' 次';
}
function stageTask(r){
 if(r.spec.authored)return {type:'distance',target:r.goal};
 const type=r.spec.objective,target=type==='landing'?1:type==='time'?Math.max(10,Math.round(r.target*.82)):type==='dodge'?r.target:type==='crawl'&&r.spec.tutorial?3:type==='fuel'&&r.spec.tutorial?75:r.target;
 return {type,target};
}
function contractProgress(game){
 const r=getRoute(game.save.route),task=stageTask(r),value=game.car?.distance||0,m=game.mechanics||{};
 const progress=task.type==='distance'?value:task.type==='landing'?game.cleanLandings||0:task.type==='time'?game.runTime||0:task.type==='dodge'?m.dodged||0:task.type==='crawl'?m.crawled||0:task.type==='fuel'?game.car?game.car.fuel/game.car.fuelMax*100:0:m.flowTriggers||0;
 const primaryMet=value>=r.goal,cleanMet=task.type==='time'?progress<=task.target:progress>=task.target;
 const shown=task.type==='time'?Math.max(0,Math.ceil(task.target-progress))+'秒剩余':task.type==='fuel'?Math.floor(progress)+'% / '+task.target+'%':Math.min(Math.floor(progress),task.target)+' / '+task.target;
 return {value,primaryMet,cleanMet,met:primaryMet,label:contractLabel(r),task:{...task,value:progress,met:cleanMet,shown}};
}
const CHARACTERS=[
  {id:'pip',name:'歪嘴星期三',price:0,kind:'goblin',skin:'#91d9bc',suit:'#df8d43',accent:'#3d6970',shade:'#64af96',back:'#dbe8bf',halo:'#bdd8a6',tag:'迷路邮差',desc:'帽子装着地图，嘴里藏着星期三'},
  {id:'momo',name:'罐装喵脆脆',price:1200,kind:'cat',skin:'#efb6bd',suit:'#67b5b0',accent:'#704c76',shade:'#d689a5',back:'#f0dce0',halo:'#dfbbc9',tag:'零食飞行员',desc:'护目镜不摘，尾巴负责保持体面'},
  {id:'bolt',name:'螺丝没拧紧',price:3600,kind:'robot',skin:'#dfc88c',suit:'#789aaa',accent:'#a76845',shade:'#b39464',back:'#d7e3e4',halo:'#b8cdd1',tag:'过期维修员',desc:'一只眼看路，另一只眼测气压'},
  {id:'luna',name:'半颗月亮酱',price:6800,kind:'alien',skin:'#c7b2df',suit:'#65578c',accent:'#e5bd68',ink:'#725988',shade:'#a189bd',back:'#e5dff0',halo:'#c6b8df',tag:'午夜梦游者',desc:'披着半片夜空，带走半颗月亮'}
];
const MAX_LEVEL=15;
const clearedCount=save=>save.firstClears.reduce((n,clear)=>n+Number(Boolean(clear)),0);
const upgradeCap=save=>Math.min(MAX_LEVEL,3+Math.floor(clearedCount(save)/3)*2);
const upgradeGate=(save,level)=>level>=MAX_LEVEL?'已满级':level>=upgradeCap(save)?'累计通关 '+(Math.floor((level-3)/2)+1)*3+' 关解锁':'';
const stageUnlocked=(save,i,frontier=mapFrontier(save))=>Number.isInteger(i)&&i>=0&&i<=MAX_ROUTE&&i<=frontier;
const VEHICLES = [
  { id:'scout',name:'咬咬牙箱',en:'BITEBOX',desc:'会咬人的铁皮箱 · 短轴灵活',role:'飞跃',color:'#b5d957',dark:'#657842',trim:'#f0deb0',price:0,power:1,grip:1,tank:1,speed:1,air:1,damping:1,wheelbase:39,radius:22,inertia:2450 },
  { id:'ranger',name:'腮帮子潜艇',en:'GILLPOD',desc:'陆地潜艇 · 长轴抓地稳',role:'越野',color:'#63bbb7',dark:'#366c72',trim:'#e8c17f',price:4800,power:1.22,grip:1.48,tank:1.2,speed:.92,air:.68,damping:1.35,wheelbase:49,radius:24,inertia:3500 },
  { id:'rover',name:'胃袋锅炉车',en:'BELLY BOILER',desc:'铜胃大轮 · 高扭长续航',role:'攀爬',color:'#d98a55',dark:'#885449',trim:'#e9c88e',price:12800,power:1.7,grip:1.28,tank:1.65,speed:.82,air:.48,damping:1.12,wheelbase:44,radius:30,inertia:4100 },
  { id:'hopper',kind:'bike',name:'蛙噗弹簧腿',en:'FROGSPROING',desc:'青蛙摩托 · 轻跳小油箱',role:'摩托',color:'#b8ce65',dark:'#56714b',trim:'#f1d694',price:2200,power:1.12,grip:1.02,tank:.78,speed:1.14,air:1.42,damping:1.08,wheelbase:36,radius:24,inertia:2150,burn:.9,voice:1.2 },
  { id:'trike',kind:'trike',name:'三罐不倒翁',en:'TIN TRINITY',desc:'三罐货厢 · 承重稳但极速低',role:'三轮',color:'#ae96c7',dark:'#6e557f',trim:'#e7d4ac',price:7600,power:1.38,grip:1.35,tank:1.5,speed:.86,air:.57,damping:1.32,wheelbase:44,radius:23,inertia:3700,burn:1.04,voice:.8 },
  { id:'racer',kind:'racer',name:'红眼剪风兽',en:'REDSHEAR',desc:'刀锋甲壳 · 高速怕烂路',role:'赛车',color:'#d97768',dark:'#87424e',trim:'#f2dec0',price:18000,power:1.34,grip:1.18,tank:.93,speed:1.34,air:.74,damping:1.18,wheelbase:53,radius:19,inertia:3400,burn:1.18,voice:1.08 },
  { id:'unicycle',kind:'unicycle',name:'眨巴滚滚球',en:'BLINKROLL',desc:'眼球独轮 · 单点接地灵活',role:'独轮车',color:'#8bcbbc',dark:'#426e69',trim:'#eddf9d',price:0,power:1.06,grip:1.17,tank:.86,speed:1.03,air:1.6,damping:1.18,wheelbase:22,radius:29,inertia:2600,burn:.88,voice:1.12,balance:12 },
  { id:'skateboard',kind:'skateboard',name:'吐司溜溜板',en:'JAMSLIDE',desc:'果酱动力板 · 小轮怕尖坡',role:'滑板',color:'#de9caf',dark:'#925971',trim:'#efc789',price:2800,power:1.15,grip:1.1,tank:.94,speed:1.2,air:1.48,damping:1.22,wheelbase:38,radius:16,inertia:2450,burn:.85,voice:1.16 },
  { id:'scooter',kind:'scooter',name:'长颈打喷嚏',en:'SNEEZENECK',desc:'长颈滑行车 · 灵活省补给',role:'滑行车',color:'#dfc46d',dark:'#887145',trim:'#ecddad',price:3400,power:1.18,grip:1.13,tank:1.02,speed:1.1,air:1.24,damping:1.18,wheelbase:41,radius:21,inertia:2750,burn:.8,voice:1.05 }
];
const UPGRADES = [
  { id: 'engine', name: '动力', en: 'ENGINE', desc: '提升动力与极速', icon: 'engine' },
  { id: 'tires', name: '轮胎', en: 'TIRES', desc: '抓地更稳，爬坡更轻松', icon: 'wheel' },
  { id: 'suspension', name: '悬挂', en: 'SUSPENSION', desc: '缓和落地，稳定车身', icon: 'spring' },
  { id: 'tank', name: '油箱', en: 'FUEL TANK', desc: '每次出发，走得更远', icon: 'fuel' }
];
const SPECIALIZATIONS = {
 engine:[{id:'torque',name:'短齿扭矩',plus:'动力 +28%',minus:'极速 -8% · 油耗 +15%',level:2,stage:0,contract:false,effects:{drive:1.28,maxSpeed:.92,burn:1.15}},
 {id:'cruise',name:'长齿巡航',plus:'极速 +20%',minus:'动力 -10% · 油耗 +8%',level:5,stage:3,contract:true,effects:{maxSpeed:1.2,drive:.9,burn:1.08}},
 {id:'turbo',name:'双涡轮增压',plus:'动力 +18% · 极速 +14%',minus:'油耗 +25%',level:8,stage:9,contract:false,effects:{drive:1.18,maxSpeed:1.14,burn:1.25}}],
 tires:[{id:'mud',name:'深纹越野胎',plus:'松软路牵引 +32% · 抓地 +10%',minus:'极速 -7%',level:2,stage:1,contract:false,effects:{softGrip:1.32,grip:1.1,maxSpeed:.93}},
 {id:'road',name:'轻量公路胎',plus:'极速 +10%',minus:'抓地 -10% · 松软路牵引 -20%',level:5,stage:5,contract:true,effects:{maxSpeed:1.1,grip:.9,softGrip:.8}},
 {id:'rock',name:'岩爪大轮',plus:'轮径 +10% · 抓地 +20%',minus:'极速 -6%',level:8,stage:8,contract:false,effects:{wheelRadius:1.1,grip:1.2,maxSpeed:.94}}],
 suspension:[{id:'stable',name:'液压稳落',plus:'阻尼 +30% · 抑制车身旋转',minus:'极速 -4% · 空中调姿更慢',level:2,stage:0,contract:false,effects:{damping:1.3,angularDamping:1.18,maxSpeed:.96,airControl:.85}},
 {id:'acrobat',name:'陀螺飞行架',plus:'空中调姿 +40%',minus:'旋转阻力 -38% · 落地阻尼 -10%',level:5,stage:4,contract:true,effects:{airControl:1.4,angularDamping:.62,damping:.9}},
 {id:'travel',name:'长行程避震',plus:'吸收冲击 +20% · 阻尼 +15%',minus:'弹簧刚度 -15%',level:8,stage:11,contract:false,effects:{impactAbsorb:1.2,damping:1.15,spring:.85}}],
 tank:[{id:'eco',name:'节流循环器',plus:'油耗 -30%',minus:'容量 -12% · 动力 -10%',level:2,stage:2,contract:false,effects:{burn:.7,fuel:.88,drive:.9}},
 {id:'reserve',name:'副油箱',plus:'容量 +35%',minus:'极速 -10% · 动力 -6%',level:5,stage:6,contract:true,effects:{fuel:1.35,maxSpeed:.9,drive:.94}},
 {id:'light',name:'轻量竞速油箱',plus:'极速 +10% · 空中调姿 +18%',minus:'容量 -18%',level:8,stage:12,contract:false,effects:{maxSpeed:1.1,airControl:1.18,fuel:.82}}]
};
function specializationGate(save,vehicle,id,mod){
 if(!save.owned.includes(vehicle))return '先拥有这辆车';
 if(!mod)return '';
 if(save.builds[vehicle][id]<mod.level)return idName(id)+'升至 '+mod.level+' 级';
 if(!save.firstClears[mod.stage])return '通关第 '+(mod.stage+1)+' 关';
 return '';
}
const idName=id=>UPGRADES.find(u=>u.id===id)?.name||'';
const selectedSpecialization=(build,id)=>SPECIALIZATIONS[id]?.find(m=>m.id===build.mods?.[id]);
// Visible parts grow on every level; major silhouettes change at 1 / 4 / 8 / 12.
function vehicleAppearance(build={}) {
 const level=id=>Math.max(0,Math.min(15,Number(build[id])||0));
 const stage=id=>{const n=level(id);return n===0?0:n<4?1:n<8?2:n<12?3:4;};
 return {engine:level('engine'),tires:level('tires'),suspension:level('suspension'),tank:level('tank'),
  engineStage:stage('engine'),tireStage:stage('tires'),suspensionStage:stage('suspension'),tankStage:stage('tank'),
  intakeHeight:level('engine')?13+level('engine')*.9:0,treadWidth:2+level('tires')*.1,
  bodyLift:level('suspension')*.55,tankHeight:level('tank')?20+level('tank')*1.35:0,tankWidth:20+level('tank')*.45};
}
// 同一套参数同时用于物理、车库数值和试车，避免界面与实际收益不一致。
function vehicleStats(upgrades = {}, vehicle = 0) {
  const u = Object.assign({ engine: 0, tires: 0, suspension: 0, tank: 0 }, upgrades), v = VEHICLES[vehicle] || VEHICLES[0];
  // 后半程仍保留 75% 的单级增益；不再在 5 级后突然缩到四分之一。
  for(const key of UPGRADES.map(u=>u.id)) u[key]=u[key]<=5?u[key]:5+(u[key]-5)*.75;
  const stats={ drive: (172 + u.engine * 40) * v.power, maxSpeed: (490 + u.engine * 34)*v.speed,
    grip: (.83 + u.tires * .19) * v.grip, spring: 116 + u.suspension * 8,
    damping: (10 + u.suspension * 1.8)*v.damping, angularDamping: 1.7 + u.suspension * .2,
    impactAbsorb:u.suspension*.04, brakeForce:470*(1+u.tires*.045),
    wheelbase:v.wheelbase, wheelRadius:v.radius, inertia:v.inertia,
    fuel: (100 + u.tank * 28) * v.tank, burn: 3.35*(v.burn||1),softGrip:v.kind==='racer'?.78:1,airControl:v.air,
    balance:v.balance||0,
    wheelOffsets:v.kind==='unicycle'?[0]:v.kind==='skateboard'?[-v.wheelbase,-v.wheelbase,v.wheelbase,v.wheelbase]:v.kind==='trike'?[-v.wheelbase,-v.wheelbase,v.wheelbase]:[-v.wheelbase,v.wheelbase],
    wheelWeights:v.kind==='unicycle'?[2]:v.kind==='skateboard'?[.5,.5,.5,.5]:v.kind==='trike'?[.5,.5,1]:[1,1] };
  for(const part of UPGRADES){const mod=selectedSpecialization(upgrades,part.id);if(mod)for(const [key,value] of Object.entries(mod.effects))stats[key]*=value;}
  return stats;
}
function upgradePreview(id, upgrades, vehicle) {
  const level = upgrades[id], next = Object.assign({}, upgrades, { [id]: Math.min(MAX_LEVEL, level + 1) });
  const a = vehicleStats(upgrades, vehicle), b = vehicleStats(next, vehicle);
  const rows = {
    engine: [['动力',Math.round(a.drive),Math.round(b.drive),''],['极速',Math.round(a.maxSpeed*.36),Math.round(b.maxSpeed*.36),'km/h']],
    tires: [['抓地',a.grip.toFixed(2),b.grip.toFixed(2),''],['泥地牵引',Math.round(a.grip*a.softGrip*.52*100),Math.round(b.grip*b.softGrip*.52*100),'%']],
    suspension: [['阻尼',a.damping.toFixed(1),b.damping.toFixed(1),''],['冲击吸收',Math.round(a.impactAbsorb*100),Math.round(b.impactAbsorb*100),'%']],
    tank: [['容量',Math.round(a.fuel),Math.round(b.fuel),''],['满油全油门',Math.round(a.fuel/a.burn),Math.round(b.fuel/b.burn),'s']]
  };
  return { level, rows: rows[id], next, current: a, upgraded: b };
}
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
// 保留原价和解锁节奏，已有等级自动享受新的改装效果。
const UPGRADE_COSTS = [320, 440, 560, 700, 860, 980, 1100, 1220, 1340, 1460, 1580, 1700, 1820, 1940, 2060];
const upgradeCost = level => UPGRADE_COSTS[level] || 0;
const MILESTONES = [
  {distance:3000,reward:120},{distance:10000,reward:250},{distance:25000,reward:500},
  {distance:50000,reward:900},{distance:100000,reward:1600}
];
const emptyBuild = () => ({engine:0,tires:0,suspension:0,tank:0});
const upgradesFor = (save, vehicle=save.vehicle) => save.builds[vehicle];
// 购车只继承基础调校，不复制专精，也不持续同步各车后续升级。
function purchaseBuild(save) {
 const build=emptyBuild();
 for(const part of UPGRADES)build[part.id]=Math.max(...save.owned.map(i=>save.builds[i][part.id]));
 return build;
}
const previewBuild=(save,vehicle)=>save.owned.includes(vehicle)?upgradesFor(save,vehicle):purchaseBuild(save);
function stageStars(game,complete) {
 // 旧星数仅用于读取历史存档；新局不再评分或发放补星奖励。
 return 0;
}
function drivingAdvice(game,complete) {
 const r=getRoute(game.save.route),m=game.mechanics,c=game.car;
 const fuelTip={part:'tank',title:'留油还是赶路，换一种开法',detail:'下坡松油省油；补给站双踏板驻车慢慢加，怪雾不会等。大油箱少停站，节流专精更省但减动力'};
 if(!complete&&/断路/.test(c.reason))return {part:'engine',title:'断路前保留起跳速度',detail:'提前加速，空中调平；短齿扭矩起步更快，但耗油更多'};
 if(!complete&&c.strainTime>3&&/怪雾|油箱/.test(c.reason))return {part:'engine',title:'这段长坡，动力已经吃紧',detail:'本趟满油门低速爬坡 '+Math.round(c.strainTime)+' 秒；试升动力或短齿扭矩，大油箱不能解决爬不动'};
 if(!complete&&c.fuel<=0)return fuelTip;
 if(!complete&&/油箱/.test(c.reason))return fuelTip;
 const rugged=game.terrain?.ruggedSections?.find(f=>c.x>=f.x-80&&c.x<=f.end+180);
 if(!complete&&rugged&&/翻车|着陆|怪雾/.test(c.reason)){
  const tips={
   teeth:['尖山前起跳，别贴地硬爬','尖坡开始前点击左侧跳跃；着地后再跳下一峰，空中用踏板对准落地坡面'],
   bowl:['深 V 坑提前跳，别掉到底再起步','坑沿保留速度提前起跳；空中用踏板调姿，避免低速落在对面的尖反坡'],
   stairs:['台阶前跳，平台上再加速','踏上陡阶前点击左侧跳跃；车头过高用后退压头，等轮胎落稳再加油'],
   kicker:['高台提前跳，落地前看坡面','在尖坡和陡降前点击左侧跳跃；空中对准落地坡面调姿，落稳后再接油门'],
   maw:['别掉进巨口，嘴沿前起跳','保留速度，从嘴沿跳过低谷；落地前压平车头，不在坑底硬轰油门'],
   eyes:['眼球脊背连续跳，别硬撞凸起','每个眼球都是实体凸坡；接地后再跳，空中对准下一个落点'],
   fold:['折叠路先看落点，再跳断崖','高台后紧跟低谷和第二层陡坡；空中调姿，落稳后再接下一跳']
   ,landing:['近平台要收住落点','金币下降线指向窄平台；二段跳会去更远的安全平台，落稳后再准备分叉']
   ,recovery:['掉进恢复沟也能自己爬出','保持车身正立，在圆底按跳跃并朝恢复坡调姿；这里不会直接判失败']
  }[rugged.kind];
  return {part:/怪雾/.test(c.reason)?'engine':'suspension',title:tips[0],detail:tips[1]+'；失败重试保留这条险路'};
 }
 if(!complete&&/怪雾/.test(c.reason))return {part:'engine',title:'坡前加油，落地后接回油门',detail:'下坡保留速度，坡前提前给油；免费试车比较动力升级的加速差异'};
 if((!complete&&/翻车|着陆/.test(c.reason))||r.spec.objective==='landing')return {part:'suspension',title:'头翘高踩后退，头朝下补油门',detail:'落地前调平；仍回弹可免费试悬挂升级。改装后复跑同一关看差异'};
 if(r.spec.objective==='fuel')return fuelTip;
 if(r.spec.objective==='crawl'||m.hits>=3)return {part:'tires',title:'碎石前减速，低速稳过',detail:'深纹胎增加松软路牵引，但降低极速；反向踏板减速，双踏板驻车'};
 if(r.spec.objective==='dodge')return {part:'suspension',title:'借起坡飞越，落地前调平',detail:'飞行架调姿更灵活，稳落架回弹更小；按路况选择'};
 return {part:'engine',title:'保持速度，挑战更快到站',detail:'长齿巡航极速更高，但起步较慢；先用试车比较'};
}
function defaultSave() {
  const builds=VEHICLES.map(()=>emptyBuild());
  return { version:6,coins:0,best:0,runs:0,route:0,vehicle:6,owned:[0,6],character:0,ownedCharacters:[0],builds,upgrades:builds[6],sound:true,
    routeBests:ROUTES.map(()=>0),routeStars:ROUTES.map(()=>0),bestTimes:ROUTES.map(()=>0),roadVariants:ROUTES.map(()=>0),playMode:'stage',
    firstClears:ROUTES.map(()=>false),contracts:ROUTES.map(()=>false),chapterClaims:[],lifetimeDistance:0,milestones:[],goalVehicle:1,attemptHistory:[] };
}
function sanitizeSave(raw) {
  const save = defaultSave();
  if (!raw || typeof raw !== 'object') return save;
  for (const key of ['coins', 'best', 'runs']) if (Number.isFinite(raw[key])) save[key] = Math.floor(clamp(raw[key], 0, 1e9));
  if (Number.isInteger(raw.route)) save.route = clamp(raw.route, 0, MAX_ROUTE);
  const progressLength=Math.max(18,...['firstClears','contracts','routeStars','routeBests','bestTimes','roadVariants'].map(key=>Array.isArray(raw[key])?Math.min(raw[key].length,MAX_ROUTE+1):0));
  const slots=Array.from({length:progressLength});
  if (Array.isArray(raw.owned)) save.owned = Array.from(new Set([0, ...raw.owned.filter(v => Number.isInteger(v) && v >= 0 && v < VEHICLES.length)]));
  if (save.owned.includes(raw.vehicle)) save.vehicle = raw.vehicle;
  else if(!save.owned.includes(save.vehicle))save.vehicle=0;
  if(Array.isArray(raw.ownedCharacters))save.ownedCharacters=[...new Set([0,...raw.ownedCharacters.filter(i=>Number.isInteger(i)&&i>=0&&i<CHARACTERS.length)])];
  if(save.ownedCharacters.includes(raw.character))save.character=raw.character;
  for (const key of Object.keys(save.upgrades)) if (raw.upgrades && Number.isInteger(raw.upgrades[key])) save.upgrades[key] = clamp(raw.upgrades[key], 0, MAX_LEVEL);
  save.routeBests = slots.map((_,i) => Number.isFinite(raw.routeBests?.[i]) ? Math.floor(clamp(raw.routeBests[i], 0, 1e9)) : 0);
  save.routeStars = slots.map((_,i) => Number.isInteger(raw.routeStars?.[i]) ? clamp(raw.routeStars[i], 0, 3) : 0);
  save.bestTimes = slots.map((_,i) => Number.isFinite(raw.bestTimes?.[i]) ? clamp(raw.bestTimes[i],0,1e6) : 0);
  save.roadVariants = slots.map((_,i) => Number.isInteger(raw.roadVariants?.[i]) ? clamp(raw.roadVariants[i],0,3) : 0);
  const cleanBuild = value => {
    const build=emptyBuild();
    for(const key of Object.keys(build))if(value&&Number.isInteger(value[key]))build[key]=clamp(value[key],0,MAX_LEVEL);
    if(value?.mods){build.mods={};for(const id of Object.keys(SPECIALIZATIONS))if(SPECIALIZATIONS[id].some(m=>m.id===value.mods[id]))build.mods[id]=value.mods[id];}
    return build;
  };
  // 老存档的共享改装复制给已拥有车辆；新购车辆从自己的基础配置开始。
  save.builds=VEHICLES.map((_,i)=>Array.isArray(raw.builds)?cleanBuild(raw.builds[i]):cleanBuild(save.owned.includes(i)?raw.upgrades:null));
  save.upgrades=save.builds[save.vehicle];
  save.firstClears=slots.map((_,i)=>raw.firstClears?.[i]===true||save.routeStars[i]>0);
  save.contracts=slots.map((_,i)=>raw.contracts?.[i]===true);
  save.chapterClaims=Array.isArray(raw.chapterClaims)?[...new Set(raw.chapterClaims.filter(n=>Number.isInteger(n)&&n>=0&&n<6))]:[];
  for(const key of ['lifetimeDistance'])if(Number.isFinite(raw[key]))save[key]=Math.floor(clamp(raw[key],0,1e9));
  if(Array.isArray(raw.milestones))save.milestones=[...new Set(raw.milestones.filter(n=>Number.isInteger(n)&&n>=0&&n<MILESTONES.length))];
  if(Number.isInteger(raw.goalVehicle)&&raw.goalVehicle>=0&&raw.goalVehicle<VEHICLES.length)save.goalVehicle=raw.goalVehicle;
  if(Array.isArray(raw.attemptHistory))save.attemptHistory=raw.attemptHistory.slice(-20).map(a=>({
    route:Number.isInteger(a?.route)?clamp(a.route,0,MAX_ROUTE):0,complete:a?.complete===true,
    roadVariant:Number.isInteger(a?.roadVariant)?clamp(a.roadVariant,0,3):0,
    time:Number.isFinite(a?.time)?clamp(a.time,0,1e6):0,distance:Number.isFinite(a?.distance)?Math.floor(clamp(a.distance,0,1e9)):0,
    hits:Number.isFinite(a?.hits)?Math.floor(clamp(a.hits,0,1e6)):0,fuelPercent:Number.isFinite(a?.fuelPercent)?clamp(a.fuelPercent,0,100):0,
    reason:typeof a?.reason==='string'?a.reason.slice(0,80):'',vehicle:Number.isInteger(a?.vehicle)?clamp(a.vehicle,0,VEHICLES.length-1):0
  }));
  if(!stageUnlocked(save,save.route))save.route=depthStages(mapFrontier(save)).find(i=>stageUnlocked(save,i))??0;
  if (typeof raw.sound === 'boolean') save.sound = raw.sound;
  return save;
}
module.exports = { CHARACTERS, vehicleAppearance, getRoute, stageDepth, depthStages, stageParents, mapFrontier, MAX_ROUTE, previewBuild, purchaseBuild, stageStars, drivingAdvice, SPECIALIZATIONS, specializationGate, selectedSpecialization, contractLabel, stageTask, STAGE_TYPES, CHAPTER_REWARDS, contractProgress, CHAPTERS, MAX_LEVEL, upgradeCap, upgradeGate, stageUnlocked, clearedCount, COLORS, ROUTES, VEHICLES, UPGRADES, clamp, lerp, upgradeCost, defaultSave, sanitizeSave, vehicleStats, upgradePreview, upgradesFor, UPGRADE_COSTS, MILESTONES };
