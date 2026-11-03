// 地形、碰撞物和视觉共用同一套路段坐标。每个碎石段前都留有起坡和刹车距离。
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t*t*(3-2*t); };
const RUGGED_SHAPES={
  teeth:[[0,0],[.08,0],[.23,-1.15],[.31,.22],[.47,-1.45],[.56,.18],[.72,-1.65],[.84,.15],[.94,0],[1,0]],
  bowl:[[0,0],[.08,0],[.2,-.4],[.34,1.35],[.46,1.35],[.69,-.85],[.75,-.85],[.92,0],[1,0]],
  stairs:[[0,0],[.09,0],[.2,-.65],[.31,-.65],[.4,-1.15],[.53,-1.15],[.64,-1.8],[.73,-1.8],[.91,0],[1,0]],
  kicker:[[0,0],[.09,0],[.2,.2],[.45,-1.65],[.58,-1.65],[.69,1],[.79,1],[.93,0],[1,0]],
  maw:[[0,0],[.08,0],[.24,-.55],[.36,.75],[.54,.75],[.7,-.65],[.8,-.65],[.94,0],[1,0]],
  eyes:[[0,0],[.06,0],[.16,-.6],[.22,-.85],[.3,-.6],[.36,.2],[.46,-1],[.54,-1.25],[.62,-.9],[.68,.1],[.82,-.7],[.9,-.35],[1,0]],
  fold:[[0,0],[.08,0],[.24,-1.2],[.38,-1.2],[.51,.8],[.61,.8],[.74,-1.35],[.82,-1.35],[.96,0],[1,0]],
  // Authored training shapes: a narrow near landing followed by a wide safe
  // shelf, and a round-bottom recovery ditch that never becomes a gap.
  landing:[[0,0],[.08,0],[.19,-.8],[.30,-.8],[.39,.28],[.48,.28],[.58,0],[.68,0],[.77,.18],[.9,0],[1,0]],
  recovery:[[0,0],[.1,0],[.33,.72],[.46,1],[.56,1],[.72,.45],[.88,0],[1,0]]
};
const STANDARD_RUGGED_KINDS=['teeth','bowl','stairs','kicker','maw','eyes','fold'];
// 填补原有障碍之间的空档，避开补给、分叉和长爬坡。
// 失败重试不洗牌；通关后轮换等长、等强度的四种组合。
function ruggedSections(profile={},features=roadFeatures(profile),branches=verticalBranches(profile)) {
  if(profile.authored?.rugged)return profile.authored.rugged.map(f=>({...f,landingZone:f.landingZone&&[...f.landingZone]}));
  if(!profile.ruggedness||!profile.goal)return [];
  if(profile.tutorial?.ruggedCount===0)return [];
  const finish=160+profile.goal*10,blocked=[],result=[],variant=profile.variant||0;
  for(const s of sections(0,finish,profile))blocked.push([s.x-130,s.x+700]);
  for(const f of features)blocked.push([f.x-420,f.end+320]);
  for(const b of branches)blocked.push([b.x-750,b.end+300]);
  for(const e of experimentZones(profile))blocked.push([e.x-200,e.end+200]);
  const gum=gumPosition(profile,features,branches);
  if(gum!==undefined)blocked.push([gum-220,gum+650]);
  const climb=profile.expedition?.climb;
  if(climb)blocked.push([climb.x-350,climb.x+climb.up+climb.down+350]);
  const first=profile.expedition?.first||2450,gap=profile.expedition?.gap||profile.tutorial?.fuelGap||(profile.objective==='fuel'?6900:5600);
  for(let x=first;x<finish;x+=gap)blocked.push([x-150,x+180]);
  blocked.sort((a,b)=>a[0]-b[0]);
  let start=1850;const free=[];
  for(const [a,b] of blocked){if(b<=start)continue;if(a>start)free.push([start,Math.min(a,finish-650)]);start=Math.max(start,b);}
  if(start<finish-650)free.push([start,finish-650]);
  const kinds=profile.tutorial&&profile.tutorial.ruggedScale<.5?['kicker','bowl','stairs','teeth']:STANDARD_RUGGED_KINDS;
  const limit=profile.tutorial?.ruggedCount??(profile.chapter===0?4:Math.min(12,6+profile.chapter));
  for(const [a,b] of free){
    const length=Math.min(760,b-a-70);if(length<480)continue;
    for(let x=a+35;x+length<=b-35&&result.length<limit;x+=length+260){
      const kind=kinds[(result.length+(profile.mixOffset||0)+variant)%kinds.length];
      const strength=.9+Math.min(.22,Math.max(0,profile.ruggedness-.85)*.5);
      result.push({id:'rugged'+result.length,kind,x,end:x+length,amplitude:({teeth:125,bowl:115,stairs:115,kicker:125,maw:120,eyes:110,fold:125}[kind])*strength*Math.min(1,length/620)*(profile.tutorial?.ruggedScale??1),sharp:!profile.tutorial||profile.tutorial.ruggedScale>=.5,tipRadius:profile.tutorial&&profile.tutorial.ruggedScale<.5?18:6});
    }
  }
  return result;
}
function ruggedOffset(x,features=[]) {
  let y=0;
  for(const f of features){
    const t=(x-f.x)/(f.end-f.x);if(t<0||t>1)continue;const points=RUGGED_SHAPES[f.kind];
    for(let i=1;i<points.length;i++)if(t<=points[i][0]){
      const [a,ya]=points[i-1],[b,yb]=points[i];let value=ya+(yb-ya)*(t-a)/(b-a);
      // 尖峰仍只圆掉 6px；凹沟转折留轮距级的圆弧，避免两侧夹住轮胎。
      for(let j=1;j<points.length-1;j++){
        const [px,py]=points[j],prev=points[j-1],next=points[j+1];
        const valley=f.sharp!==false&&['bowl','kicker','maw','fold'].includes(f.kind)&&(py-prev[1])/(px-prev[0])>(next[1]-py)/(next[0]-px);
        const round=valley?Math.max(f.tipRadius||6,62):f.tipRadius||6;
        const radius=Math.min(round/(f.end-f.x),(px-prev[0])*(valley?.45:.25),(next[0]-px)*(valley?.45:.25));
        if(Math.abs(t-px)<radius){
          const u=(t-px+radius)/(radius*2),before=py-radius*(py-prev[1])/(px-prev[0]),after=py+radius*(next[1]-py)/(next[0]-px);
          value=(1-u)*(1-u)*before+2*u*(1-u)*py+u*u*after;break;
        }
      }
      y+=f.amplitude*value;break;
    }
  }
  return y;
}
function gumPosition(profile={},features=roadFeatures(profile),branches=verticalBranches(profile)) {
  if(!profile.handsOn?.gum)return undefined;
  const finish=160+profile.goal*10,labs=experimentZones(profile);
  const clear=x=>!labs.some(e=>x>e.x-400&&x<e.end+400)&&!branches.some(b=>x>b.x-400&&x<b.end+200)&&!features.some(f=>x>f.x-400&&x<f.end+300);
  return sections(0,finish-1800,profile).map(s=>s.x+1560).find(x=>x+700<finish&&clear(x)&&clear(x+180));
}
// 上层桥头高于道路，只有真实起跳轨迹够高才能接上；慢车从下方经过。
function verticalBranches(profile={}) {
  if(profile.authored?.branches)return profile.authored.branches.map(b=>({...b,upperGap:{...b.upperGap},lowerTeeth:[...(b.lowerTeeth||[])]}));
  if(!profile.branch||!profile.goal)return [];
  const finish=160+profile.goal*10,length=1500;
  const x=Math.min(finish-length-650,Math.max(4200,finish*.76));
  const decision=x+180;
  const scale=profile.tutorial?.branchScale??1;
  return [{id:'branch0',kind:'branch',x,decision,end:x+length,height:scale<1?240:270,entryLift:scale<1?195:210,approachLift:scale<1?140:155,toothHeight:30*scale,toothWidth:48/scale,
    upperGap:{x:decision+650,end:decision+825},
    lowerTeeth:[decision+545,decision+790,decision+1035]}];
}
function branchApproachOffset(x,branches=[]) {
  let y=0;
  for(const b of branches){
    const start=b.x-300,lip=b.x+40;
    const lift=b.approachLift??b.entryLift??60;
    if(x>=start&&x<lip)y-=lift*((x-start)/(lip-start))**2;
    else if(x>=lip&&x<b.decision)y-=lift*(1-smooth((x-lip)/(b.decision-lip)));
  }
  return y;
}
function branchUpperOffset(x,branch) {
  if(!branch||x<branch.decision||x>branch.end)return 0;
  const entry=branch.decision+420;
  const exit=branch.end-330;
  const lift=branch.entryLift??60;
  if(x<entry)return lift+(branch.height-lift)*smooth((x-branch.decision)/(entry-branch.decision));
  return x<exit?branch.height:branch.height*(1-smooth((x-exit)/(branch.end-exit)));
}
function branchLowerOffset(x,branches=[]) {
  let y=0;
  for(const b of branches)for(const center of b.lowerTeeth||[]){
    const t=(x-center)/(b.toothWidth??48);if(Math.abs(t)<1)y-=(b.toothHeight??30)*Math.pow(Math.cos(t*Math.PI/2),2);
  }
  return y;
}
function branchGapAt(x,branches=[],choice) {
  if(choice!=='upper')return undefined;
  return branches.find(b=>b.upperGap&&x>=b.upperGap.x&&x<b.upperGap.end)?.upperGap;
}
function roadFeatures(profile={}) {
  if(profile.authored?.features)return profile.authored.features.map(f=>({...f}));
  if(!profile.weird||!profile.goal)return [];
  const finish=160+profile.goal*10,labs=experimentZones(profile),features=[];
  const climb=profile.expedition?.climb,overlapsClimb=(x,end)=>climb&&x<climb.x+climb.up+climb.down+350&&end>climb.x-350;
  const candidates=sections(0,finish-1100,profile).filter(s=>s.index>=1).flatMap(s=>[s.x+670,s.x+1200]);
  for(const x of candidates){
    const end=x+(profile.weird==='gap'?(profile.gapWidth||145):profile.weird==='rough'?580:250);
    if(end+700>=finish||features.some(f=>x-f.x<3100)||overlapsClimb(x,end))continue;
    if(labs.some(e=>e.kind==='portal'?(e.x>=x-180&&e.x<=end+180):(e.x>=x-650&&e.x<=end+370)||(e.kind==='swamp'&&e.end>=x-650&&e.x<=end+370)))continue;
    features.push({id:'weird'+features.length,kind:profile.weird,x,end});
    if(features.length>=(profile.hazardCount||1))break;
  }
  const mixes=profile.roadMix||[],branches=verticalBranches(profile);
  // 怪路放在起坡/碎石段之间；间隔留出恢复车身和看清下一段的时间。
  for(const s of sections(0,finish,profile)){
    if(!mixes.length||features.length>=(profile.featureCount||(profile.chapter>=3?3:2)))break;
    const x=s.x+1330,kind=mixes[((features.length-1)+(profile.mixOffset||0))%mixes.length];
    const length=Math.min(780,(profile.span||2300)-(kind==='heave'?1350:1530)),end=x+length;
    if(length<240||x<2100||end+800>=finish||overlapsClimb(x,end))continue;
    if(features.some(f=>x<f.end+500&&end>f.x-450))continue;
    if(labs.some(e=>x<e.end+300&&end>e.x-300)||branches.some(b=>x<b.end+200&&end>b.x-400))continue;
    features.push({id:'weird'+features.length,kind,x,end,motion:profile.motion||0,phase:0,previousPhase:0,heave:0,previousHeave:0,tilt:0,previousTilt:0,compression:0,previousCompression:0});
  }
  return features.map(f=>({...f,strength:profile.tutorial?.featureScale??1}));
}
function movingOffset(x,f,previous=false) {
 const t=(x-f.x)/(f.end-f.x);if(t<0||t>1)return 0;
 const envelope=Math.sin(Math.PI*t)**2,phase=(previous?f.previousPhase:f.phase)||0;
 if(f.kind==='wave')return -(20+(f.motion||0)*5)*Math.min(1,(f.end-f.x)/680)*Math.sin(t*Math.PI*4-phase)*envelope;
 if(f.kind==='heave')return ((previous?f.previousHeave:f.heave)||0)*envelope;
 if(f.kind==='sponge')return (-20+((previous?f.previousCompression:f.compression)||0))*envelope;
 if(f.kind==='tilt')return (x-(f.x+f.end)/2)*((previous?f.previousTilt:f.tilt)||0)*envelope;
 return 0;
}
function weirdOffset(x,features=[]) {
  let y=0;
  for(const f of features){
    const before=y;
    if(f.kind==='rough'){
      const t=(x-f.x)/580;if(t>=0&&t<=1)y-=12*Math.sin(t*Math.PI*2*3.5)*Math.sin(Math.PI*t);
    }else if(['wave','ribs','sponge','tilt','slick','heave'].includes(f.kind)){
      const t=(x-f.x)/(f.end-f.x);if(t<0||t>1)continue;
      const envelope=Math.sin(Math.PI*t)**2;
      y+=movingOffset(x,f);
      if(f.kind==='ribs')y-=15*(.5-.5*Math.cos(t*Math.PI*10))*envelope;
      if(f.kind==='slick')y-=13*envelope;
    }else if(x>=f.x-300&&x<f.x){
      const t=(x-f.x+300)/300;y-=95*t*t;
    }else if(f.kind==='gap'&&x>=f.x&&x<f.end){
      y-=95*(1-(x-f.x)/(f.end-f.x));
    }else if(f.kind==='ridge'&&x>=f.x&&x<f.end){
      y-=95*(1-smooth((x-f.x)/(f.end-f.x)));
    }
    y=before+(y-before)*(f.strength??1);
  }
  return y;
}
const gapAt=(x,features=[])=>features.find(f=>f.kind==='gap'&&x>=f.x&&x<f.end);
function sections(from, to, profile={}) {
  if(profile.authored)return [];
  const span=profile.span||2300;
  const result = [];
  for (let i=Math.max(0,Math.floor((from-span)/span));i<=Math.ceil((to-1050)/span);i++) {
    const x=1050+i*span;
    if(x+1250>=from&&x<=to)result.push({id:'section'+i,index:i,x,crest:x+330,rock:x+510,end:x+1250});
  }
  return result;
}
function hillOffset(x,profile={}) {
  let y=0;
  for(const s of sections(x,x,profile)){
    const t=x-s.x;
    if(t>=0&&t<330)y-=(profile.lift||82)*smooth(t/330);
    else if(t>=330&&t<=570)y-=(profile.lift||82)*(1-smooth((t-330)/240));
  }
  return y;
}
function stoneOffset(x,profile={},removed=new Set()) {
  let y=0;
  for(const s of sections(x-60,x+60,profile)) { if(removed.has('rock'+s.index))continue;const t=(x-s.rock)/55;if(Math.abs(t)<1)y-=(profile.stone||14)*Math.pow(Math.cos(t*Math.PI/2),2); }
  return y;
}
function roadEvents(from,to,profile={},features=roadFeatures(profile)) {
  const result=[];
  for(const s of sections(from-1300,to,profile)) {
    for(const event of [
      {id:'jump'+s.index,kind:'jump',x:s.x,end:s.crest+25,rock:s.rock},
      {id:'rock'+s.index,kind:'rock',x:s.rock,end:s.rock+55,approach:s.x},
      {id:'surface'+s.index,kind:'surface',x:s.x+835,end:s.end}
    ])if((event.kind!=='surface'||profile.mud!==false)&&event.end>=from&&event.x<=to)result.push(event);
  }
  for(const f of features)if(f.end>=from&&f.x<=to)result.push(f);
  return result.sort((a,b)=>a.x-b.x);
}
function surfaceAt(x,difficulty=1,profile={},features=roadFeatures(profile)) {
  const feature=features.find(f=>x>=f.x&&x<=f.end);
  if(feature?.kind==='slick')return {name:'玻璃路',grip:.32,drag:.025,color:'#b8e8e1'};
  if(feature?.kind==='sponge')return {name:'软糖路',grip:.9,drag:.08,color:'#d6a7cc'};
  if(feature?.kind==='tilt')return {name:'跷板桥',grip:1,drag:0,color:'#cfaa77'};
  if(feature?.kind==='heave')return {name:'呼吸桥',grip:.93,drag:.015,color:'#acb9ce'};
  const active=roadEvents(x,x,profile,features).find(e=>e.kind==='surface');
  if(!active)return {name:'土路',grip:1,drag:0,color:'#dcc49d'};
  const gentle=profile.tutorial,grip=value=>Math.max(value,gentle?.surfaceGrip||0),drag=value=>Math.min(value,gentle?.surfaceDrag??value);
  if(difficulty>=1.4)return {name:'积雪',grip:grip(.5),drag:drag(.08),color:'#e5eef0'};
  if(difficulty>=1.2)return {name:'松沙',grip:grip(.55),drag:drag(.22),color:'#e0b986'};
  return {name:'泥地',grip:grip(.52),drag:drag(.16),color:'#bc9e81'};
}
// 只保留自然路面，不再生成传送门和临时改变重力的装置。
function experimentZones(profile={}) {
 if(!profile.lab)return [];
 const goalX=160+(profile.goal||900)*10,span=profile.span||2300;
 const section=1050+Math.max(0,Math.round((goalX*.57-1050)/span))*span;
 const swampX=Math.min(section+650,goalX-1500),zones=[];
 if(profile.lab.swamp)zones.push({id:'swamp',kind:'swamp',x:swampX,end:swampX+460});
 return zones.sort((a,b)=>a.x-b.x);
}
module.exports={gumPosition,ruggedSections,ruggedOffset,movingOffset,verticalBranches,branchApproachOffset,branchUpperOffset,branchLowerOffset,branchGapAt,experimentZones,roadFeatures,weirdOffset,gapAt,sections,hillOffset,stoneOffset,roadEvents,surfaceAt};
