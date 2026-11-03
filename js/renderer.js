const { vehicleAppearance, getRoute, stageDepth, depthStages, stageParents, mapFrontier, clearedCount, previewBuild, SPECIALIZATIONS, specializationGate, selectedSpecialization, vehicleStats, MAX_LEVEL, upgradeGate, stageUnlocked, COLORS: C, VEHICLES, UPGRADES, upgradeCost, upgradePreview, upgradesFor, MILESTONES, clamp } = require('./config');
const { collectibles, fuelStops, START_X, FALL_TIMEOUT } = require('./physics');
const { CHARACTERS } = require('./config');
const { INK, hash, stroke, paper } = require('./sketch');
const { roadEvents } = require('./mechanics');
const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
// A two-part silhouette for every named stage. The first mark follows the
// stage's distinctive noun; the second supplies its action or setting.
const STAGE_LANDMARKS = [
 ['echo','lab'],['fang','dune'],['ice','monster'],
 ['rift','speed'],['dune','flight'],['ice','ridge'],
 ['oil','finish'],['dune','fog'],['flight','cloud'],
 ['root','maze'],['oil','road'],['ice','delivery'],
 ['fog','monster'],['fang','rock'],['ice','speed'],
 ['road','home'],['bridge','clock'],['monster','curtain'],
 ['clock','flight'],['wave','rift'],['bone','oil'],
 ['mushroom','fog'],['fang','mushroom'],['bridge','tilt'],
 ['inverted','rift'],['crystal','road'],['root','echo'],
 ['root','rock'],['tower','speed'],['crystal','bridge'],
 ['bone','oil'],['mushroom','monster'],['wave','road'],
 ['bridge','speed'],['tower','rift'],['bone','ridge'],
 ['crystal','fog'],['bone','fang'],['clock','ridge'],
 ['inverted','flight'],['bone','oil'],['mushroom','monster'],
 ['tower','wave'],['crystal','flight'],['bone','flight'],
 ['mushroom','road'],['bone','fog'],['gear','ice'],
 ['bone','finish'],['mushroom','rift'],['clock','oil'],
 ['inverted','fog'],['root','ridge'],['bone','clock']
];
const ROAD_MATERIALS = {
  dune:{body:'#9e675e',band:'#c38a69',deep:'#80565a',rim:'#f2c37e',glint:'#ffe3af',seam:'#724b4d'},
  ice:{body:'#7193b4',band:'#a1bfd1',deep:'#587994',rim:'#e9fbff',glint:'#ffffff',seam:'#426c8c'},
  mushroom:{body:'#655269',band:'#876680',deep:'#4e425c',rim:'#e7b5c6',glint:'#f6daae',seam:'#4d3c59'},
  fossil:{body:'#9a776d',band:'#bb9181',deep:'#785d60',rim:'#eee0b9',glint:'#fff1d3',seam:'#6c5457'},
  clockwork:{body:'#4d6576',band:'#7a8b8f',deep:'#354c60',rim:'#d9b273',glint:'#ffdb98',seam:'#293f50'},
  crystal:{body:'#607ca7',band:'#8da9c6',deep:'#45658d',rim:'#c3f6f5',glint:'#edffff',seam:'#345475'},
  inverted:{body:'#667179',band:'#899597',deep:'#4f626d',rim:'#cbe7b3',glint:'#f2f2cd',seam:'#455660'},
  root:{body:'#766577',band:'#9a8190',deep:'#5b536a',rim:'#b6dc8b',glint:'#e2efb7',seam:'#4e455e'}
};
class Renderer {
  constructor(game) {
    this.g = game; this.ctx = game.platform.ctx; this.motion = {};
    const sheet = null;
    this.paperPattern = sheet && this.ctx.createPattern ? this.ctx.createPattern(sheet, 'repeat') : null;
    this.visualPatterns = {};
  }
  visualAsset(name) { return this.g.visualPack?.images?.[name] || null; }
  paintedSceneKey(route) {
    const index=this.g.save.route,name=route.name||'';
    if(index>=18&&route.scene==='crystal'&&(/潮/.test(name)||index>=54&&index%3===0))return 'sceneOcean';
    if(index>=18&&route.scene==='inverted'&&(/连跃|快道/.test(name)||index>=54&&index%5===1))return 'sceneSkyIslands';
    if(index>=18&&route.scene==='mushroom'&&(/暗林|追影/.test(name)||index>=54&&index%7===0))return 'sceneMoonlit';
    if(index>=18&&route.scene==='inverted'&&index%3===0)return 'sceneGlowroot';
    if(index>=18&&route.scene==='fossil'&&index%3===1)return 'sceneFossilLantern';
    const cold=index<18&&/雪|冰|极地|零度/.test(name),sandy=index<18&&/沙|荒漠/.test(name);
    return route.scene==='clockwork'&&/冰|雪|极地|零度/.test(name)?'sceneClockworkIce':cold?'sceneSnow':sandy?'sceneDune':({mushroom:'sceneMushroom',fossil:'sceneFossil',clockwork:'sceneClockwork',crystal:'sceneCrystal',inverted:'sceneInverted'})[route.scene];
  }
  illustratedEnvironment() { return !!this.g.visualPack?.ready && this.g.save.route===0; }
  visualPattern(name) {
    const image=this.visualAsset(name);if(!image||!this.ctx.createPattern)return null;
    return this.visualPatterns[name]||(this.visualPatterns[name]=this.ctx.createPattern(image,'repeat'));
  }
  drawVisual(name,x,y,w,h,angle=0,alpha=1) {
    const image=this.visualAsset(name);if(!image)return false;
    const c=this.ctx;c.save();c.globalAlpha*=alpha;
    if(angle){c.translate(x+w/2,y+h/2);c.rotate(angle);c.drawImage(image,-w/2,-h/2,w,h);}else c.drawImage(image,x,y,w,h);
    c.restore();return true;
  }
  neonBubble(x,y,w,h,r=22,light=false) {
    const c=this.ctx;c.save();c.shadowColor=light?'rgba(255,214,90,.65)':'rgba(36,198,255,.65)';c.shadowBlur=13;
    const fill=c.createLinearGradient(x,y,x,y+h);
    fill.addColorStop(0,light?'rgba(255,249,222,.88)':'rgba(8,29,67,.57)');
    fill.addColorStop(1,light?'rgba(246,230,185,.91)':'rgba(5,30,65,.37)');
    this.rect(x,y,w,h,r,fill,light?'#ffeaa7':'#78d9ff');c.restore();
    this.rect(x+3,y+3,w-6,h-6,Math.max(2,r-3),null,light?'rgba(255,255,255,.7)':'rgba(184,232,255,.24)');
    if(!light){
      const sheen=c.createLinearGradient(x,y+3,x,y+h*.56);
      sheen.addColorStop(0,'rgba(220,245,255,.22)');sheen.addColorStop(1,'rgba(220,245,255,0)');
      this.rect(x+5,y+5,w-10,Math.max(10,h*.45),Math.max(5,r-5),sheen);
    }
  }
  visualLayer(name,factor=0) {
    const image=this.visualAsset(name);if(!image)return false;
    const h=Math.min(this.h,1120),w=image.width*h/image.height,room=Math.max(0,w-this.w);
    const progress=this.g.car&&this.g.goal?clamp(this.g.car.distance/this.g.goal,0,1):0;
    const crop=factor===0?room*.5:room*clamp(.5+(progress-.5)*factor,0,1);
    this.ctx.drawImage(image,-crop,0,w,h);return true;
  }
  paintedSceneBackground(route) {
    const key=this.paintedSceneKey(route);
    const image=this.visualAsset(key);if(!image)return false;
    const w=this.w,h=this.h,t=this.g.time,progress=this.g.car&&this.g.goal?clamp(this.g.car.distance/this.g.goal,0,1):0;
    const scale=Math.max(w/image.width,h/image.height)*1.14,drawW=image.width*scale,drawH=image.height*scale;
    const roomX=drawW-w,roomY=drawH-h,variant=this.g.save.route%5;
    const cropX=roomX*clamp(.5+(variant-2)*.06+(progress-.5)*.12+Math.sin(t*.52+variant)*.28,0,1);
    const cropY=roomY*clamp(.48+Math.sin(t*.38+variant)*.2,0,1);
    this.ctx.drawImage(image,-cropX,-cropY,drawW,drawH);
    return true;
  }
  visualPackScenery(from,to) {
    const g=this.g,authored=!!g.terrain.profile?.authored;
    const opening=[
      ['eyeTree',620,102,113],['mushrooms',1480,80,83],['mushrooms',2120,68,71],
      ['rootRock',3180,66,96],['eyeTree',3860,92,102],
      ['mushrooms',6460,82,86],['rootRock',8120,62,90],['eyeTree',8580,96,106]
    ];
    const generated=[];
    if(!authored){
      const end=START_X+g.goal*10;
      for(let x=720,n=0;x<end;x+=1380,n++){
        const kinds=[['eyeTree',92,102],['mushrooms',76,79],['rootRock',61,89]],spec=kinds[(n+g.worldRoute())%kinds.length];
        generated.push([spec[0],x,spec[1],spec[2]]);
      }
    }
    for(const [name,x,w,h] of authored?opening:generated){
      if(x<from-100||x>to+100||g.terrain.gapAt(x))continue;
      if((g.terrain.verticalBranches||[]).some(b=>x>b.x-180&&x<b.end+120))continue;
      const y=g.terrain.height(x);this.drawVisual(name,x-w/2,y-h,w,h);
    }
  }
  visualPackSign(x,y,title,subtitle='') {
    this.roadSign(x,y,title,subtitle,'branch');
  }
  roadSign(x,ground,title,subtitle='',kind='warning') {
    const m=this.roadMaterial(this.g.routeSpec()),c=this.ctx,wide=!!subtitle;
    const w=wide?200:Math.max(144,Math.min(184,title.length*20+58));
    const h=wide?69:48,top=ground-h-38,left=x-w/2;
    c.save();c.shadowColor='rgba(21,35,42,.28)';c.shadowBlur=7;c.shadowOffsetY=4;
    this.line([[x,ground-3],[x,top+h]],m.deep,7);
    this.shape([[x-12,ground-3],[x+12,ground-3],[x+9,ground+4],[x-9,ground+4]],m.deep,1,m.seam);
    this.rect(left,top,w,h,10,'#f7f1dc',m.deep);
    c.restore();
    this.rect(left+6,top+6,4,h-12,2,m.rim);
    this.circle(left+12,top+h/2,2.4,m.deep);
    this.circle(left+w-10,top+10,2.2,m.band);
    this.circle(left+w-10,top+h-10,2.2,m.band);
    const glyph={jump:'air',gap:'air',rough:'wheel',rock:'wheel',branch:'flag',alien:'air',fuel:'fuel',gum:'wheel',wave:'mountain',ribs:'wheel',sponge:'spring',tilt:'swap',slick:'drop',heave:'spring'}[kind]||'air';
    this.circle(left+27,top+h/2,14,m.deep);
    this.icon(glyph,left+27,top+h/2,18,'#fff8e8');
    const center=left+47+(w-53)/2,textColor='#203b3c';
    const size=wide?19:Math.min(21,Math.floor((w-53)/Math.max(1,title.length)));
    this.text(title,center,top+(wide?10:12),size,textColor,800,'center');
    if(subtitle){
      this.line([[left+48,top+35],[left+w-11,top+35]],'rgba(57,85,81,.27)',1);
      this.text(subtitle,center,top+40,18,textColor,700,'center');
    }
  }
  roadBlockRock(e,height) {
    const g=this.g,m=this.roadMaterial(g.routeSpec()),x=e.x,ground=dx=>g.terrain.groundHeight(x+dx),peak=dx=>ground(dx)-height*Math.cos(dx/55*Math.PI/2)**2;
    const icy=m.kind==='ice'||m.kind==='crystal',metal=m.kind==='clockwork',c=this.ctx;
    c.save();c.shadowColor='rgba(10,25,43,.42)';c.shadowBlur=9;c.shadowOffsetY=5;
    this.shape([[-57,8],[-42,-5],[-27,-5],[-13,-17],[9,-18],[29,-10],[49,-3],[57,8]].map(([dx,dy])=>[x+dx,ground(dx)+dy]),m.deep,1.5,m.seam);
    const face=c.createLinearGradient(x-55,ground(0)-height,x+42,ground(0)+12);
    face.addColorStop(0,m.glint);face.addColorStop(.33,m.band);face.addColorStop(1,m.body);
    const top=[-55,-38,-18,0,22,40,55].map(dx=>[x+dx,peak(dx)]);
    this.shape([...top,[x+55,ground(55)+10],[x-55,ground(-55)+10]],face,2,m.seam);
    c.restore();
    this.shape([[x-38,peak(-38)+2],[x-18,peak(-18)],[x-4,ground(0)+5],[x-31,ground(-31)+4]],m.rim,1.2,m.seam);
    this.shape([[x-18,peak(-18)],[x+9,peak(0)+2],[x+27,ground(25)+5],[x-4,ground(0)+5]],m.band,1.2,m.seam);
    this.shape([[x+9,peak(0)+2],[x+39,peak(40)+1],[x+48,ground(45)+6],[x+27,ground(25)+5]],m.deep,1.2,m.seam);
    this.line([[x-38,peak(-38)+2],[x-18,peak(-18)],[x+9,peak(0)+2]],m.glint,2.5);
    this.line([[x-19,ground(-19)+1],[x-11,ground(-11)-5],[x-5,ground(-5)+4]],m.seam,1.5);
    if(icy){
      this.shape([[x-17,peak(-18)],[x-4,peak(0)+2],[x+8,peak(0)+3]],'rgba(197,251,255,.72)',1.3,m.glint);
      this.shape([[x+17,peak(20)],[x+28,peak(22)+1],[x+39,peak(40)+2]],'rgba(153,192,255,.66)',1.2,m.glint);
    }else if(metal){
      this.line([[x-34,ground(-34)-2],[x+33,ground(33)-2]],m.rim,4);
      for(const dx of [-23,2,26])this.circle(x+dx,ground(dx)-2,2.6,m.glint,m.seam,1);
    }else{
      for(const dx of [-29,24])this.circle(x+dx,ground(dx)+3,2.5,m.glint,m.seam,1);
    }
    this.line([[x-48,ground(-48)+8],[x+48,ground(48)+8]],m.rim,2.5);
  }
  rect(x, y, w, h, r = 0, fill, stroke) {
    const c = this.ctx; r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2.4; c.stroke(); }
  }
  line(points, color, width = 2, close = false, fill = false) {
    const c = this.ctx; c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); if (close) c.closePath();
    if (fill) { c.fillStyle = color; c.fill(); } else stroke(c, points, color, width, close);
  }
  circle(x, y, r, fill, stroke, width = 1.5) {
    const c = this.ctx; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }
  text(str, x, y, size = 18, color = C.ink, weight = 400, align = 'left', family = 'ui') {
    const c = this.ctx;
    const face=family==='display'?(this.g.platform.fontDisplay||this.g.platform.font||FONT):(this.g.platform.fontUI||FONT);
    // WeChat Canvas may reject intermediate numeric weights such as 650/750
    // and fall back to its tiny default font. Keep all UI labels on 100 steps.
    const canvasWeight=typeof weight==='number'?Math.max(100,Math.min(900,Math.round(weight/100)*100)):weight;
    c.font = canvasWeight + ' ' + size + 'px ' + face;
    c.textAlign = align; c.textBaseline = 'top'; c.fillStyle = color;
    const value=String(str);
    // Arrows are UI graphics, not font glyphs: native fonts may omit them.
    if(value.includes('→')){
      const runs=value.split('→'),widths=runs.map(s=>c.measureText(s).width),arrowWidth=size*1.15,total=widths.reduce((a,b)=>a+b,0)+(runs.length-1)*arrowWidth;
      let xx=x-(align==='right'?total:align==='center'?total/2:0);c.textAlign='left';
      runs.forEach((s,i)=>{c.fillText(s,xx,y);xx+=widths[i];if(i<runs.length-1){this.icon('arrow',xx+arrowWidth/2,y+size*.53,size*.8,color);xx+=arrowWidth;}});c.textAlign=align;
    }else c.fillText(value,x,y);
  }
  wrap(str,x,y,w,size=21,color=C.ink) {
    let line='',row=0;this.ctx.font='400 '+size+'px '+(this.g.platform.fontUI||FONT);
    for(const ch of String(str)){if(line&&this.ctx.measureText(line+ch).width>w){this.text(line,x,y+row*(size+8),size,color);line='';row++;}line+=ch;}
    if(line)this.text(line,x,y+row*(size+8),size,color);
    return (row+1)*(size+8);
  }
  label(str, x, y, size = 12, color = C.muted, spacing = 2.5) {
    const c = this.ctx; c.font = '400 ' + size + 'px ' + (this.g.platform.fontUI || FONT); c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = color;
    for (const ch of str) { c.fillText(ch, x, y); x += c.measureText(ch).width + spacing; }
  }
  panel(x,y,w,h,fill=C.paper,r=20) {
    this.rect(x,y+3,w,h,r,'rgba(23,38,35,.13)');
    this.rect(x,y,w,h,r,fill);
  }
  hit(action, x, y, w, h) { this.g.buttons.push({ action, x, y, w, h }); }
  headerY() {
    const p=this.g.platform;
    return Math.max(31,(p.safe.top||0)+17,p.native?(p.menuBottom??((p.safe.top||0)+70))+14:0);
  }
  routeTitle(index=this.g.save.route) {
    const name=getRoute(index).name.replace(/\s*·\s*/g,'·');
    return '第 '+(index+1)+' 关 · '+name;
  }
  routeRecord(index=this.g.save.route) {
    const g=this.g,r=getRoute(index),clear=index<this.progressSummary().frontier,best=Math.max(clear?r.goal:0,Math.min(r.goal,g.save.routeBests[index]||0));
    return {clear,best,percent:Math.floor(best/r.goal*100),time:g.save.bestTimes[index]||0,goal:r.goal};
  }
  progressSummary() {
    const g=this.g,cache=g.mapSummary;
    if(!cache||cache.save!==g.save||cache.clears!==g.save.firstClears||cache.runs!==g.save.runs||cache.length!==g.save.firstClears.length)
      g.mapSummary={save:g.save,clears:g.save.firstClears,runs:g.save.runs,length:g.save.firstClears.length,frontier:mapFrontier(g.save),count:clearedCount(g.save)};
    return g.mapSummary;
  }
  textAction(action,x,y,w,h,label,icon) {
    if(icon)this.icon(icon,x+21,y+h/2,27,INK);
    this.text(label,x+(icon?44:0),y+(h-24)/2,24,INK,500);
    this.hit(action,x,y,w,h);
  }
  button(action,x,y,w,h,label,primary=true,icon) {
    const pressed=Array.from(this.g.pointers.values()).some(p=>p.action===action),hover=this.g.hover===action;
    const target=pressed?4:hover?-2:0;
    this.motion[action]=(this.motion[action]||0)+(target-(this.motion[action]||0))*.22;
    const yy=y+this.motion[action],size=h>65?34:22;
    if(primary||pressed||hover)this.rect(x,yy,w,h,primary?12:6,primary?'#b6f04b':'rgba(226,237,207,.55)');
    const symbols={garage:'car',tune:'engine',campaign:'mountain',routes:'mountain',records:'clock',start:'play',quickStart:'play',resume:'play',retry:'swap',next:'arrow',home:'home',characters:'person',equipCharacter:'person',equip:'car',pinVehicle:'flag',gas:'arrow',brake:'back',driver:'person',testAgain:'swap',audioTest:'sound'};
    const symbol=icon||symbols[action]||(action.startsWith('test:')?'speed':action.startsWith('upgrade:')?'plus':null);
    // 导航和动作保留短文字；纯图标工具与数字价格仍保持紧凑。
    const drivingLabel=['gas','brake','driver'].includes(action)&&['playing','paused'].includes(this.g.screen);
    const value=String(label||''),numeric=/^\d+(?:\.\d+)?$/.test(value);
    if(symbol&&drivingLabel){
      this.icon(symbol,x+w/2-48,yy+h/2,32,INK);
      this.text(label,x+w/2+18,yy+(h-28)/2-2,28,INK,500,'center');
    }else if(symbol&&value&&!numeric){
      const fontSize=Math.min(size,26,Math.max(16,(w-64)/Math.max(1,value.length)));
      this.ctx.font='500 '+fontSize+'px '+(this.g.platform.fontUI||FONT);
      const fontWidth=Math.min(w-58,this.ctx.measureText(value).width),cx=x+w/2;
      this.icon(symbol,cx-fontWidth/2-19,yy+h/2,Math.min(29,h*.5),INK);
      this.text(value,cx+17,yy+(h-fontSize)/2-2,fontSize,INK,500,'center');
    }else if(symbol){
      const cx=x+w/2;
      this.icon(symbol,value?cx-42:cx,yy+h/2,Math.min(48,h*.56),INK);
      if(value)this.text(value,cx+12,yy+(h-size)/2-2,size,INK,500,'center');
    }else if(value)this.text(value,x+w/2,yy+(h-size)/2-2,size,INK,500,'center');
    this.hit(action,x,y,w,h);
  }
  iconButton(action,x,y,w,h,name,primary=false,label='') {
    this.button(action,x,y,w,h,label,primary,name);
  }
  metric(icon,value,x,y,color=INK) {
    this.icon(icon,x+12,y+13,23,color);this.text(value,x+33,y,22,color);
  }
  objectiveIcon(type) {return {landing:'down',time:'clock',dodge:'air',crawl:'wheel',fuel:'fuel',flow:'bolt',hits:'shield'}[type]||'flag';}
  shape(points, fill, weight = 2, ink = INK) {
    this.line(points,fill,1,true,true);
    stroke(this.ctx,points,ink,Math.max(1.8,weight*1.18),true,12);
  }
  hand(str,x,y,size=32,color=INK,angle=0) {
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(angle*.28);
    c.font='400 '+size+'px '+(this.g.platform.fontDisplay||this.g.platform.font||FONT);c.textBaseline='top';c.textAlign='left';c.fillStyle=color;
    c.fillText(String(str),0,0);c.restore();
  }
  tape(x,y,w=63,angle=-.1) {
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(angle);
    this.line([[0,0],[w,2],[w-2,19],[2,18]],'rgba(212,186,128,.48)',1,true,true);
    for(let i=4;i<w;i+=9)this.line([[i,3],[i-2,15]],'rgba(170,145,94,.13)',1);
    c.restore();
  }
  star(x,y,size=10,color='#d6a04f') {
    const p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?size*.46:size;p.push([x+Math.cos(a)*r,y+Math.sin(a)*r]);}this.shape(p,color,1.1,color);
  }
  flower(x,y,size=1,phase=0) {
    const c=this.ctx,t=this.g.time;c.save();c.translate(x,y);c.rotate(Math.sin(t*1.8+phase)*.18);c.scale(size,size);
    this.line([[0,0],[-4,-13],[3,-26],[-1,-38]],INK,2.5);
    this.shape([[-3,-13],[-14,-22],[-14,-8]],'#c2cd6c',1.4);
    this.eye(-1,-38,8,phase);c.restore();
  }
  butterfly(x,y,seed=0,scale=1) {
    const t=this.g.time,c=this.ctx;c.save();c.translate(x+Math.sin(t*.9+seed)*37,y+Math.cos(t*1.5+seed)*15);c.rotate(Math.sin(t+seed)*.15);c.scale(scale,scale);
    const flap=5+Math.abs(Math.sin(t*11+seed))*14;
    this.shape([[-4,0],[-22,-flap],[-24,-3],[-10,7]],'#e9e3ce',1.8);
    this.shape([[4,0],[22,-flap],[24,-3],[10,7]],'#e9e3ce',1.8);
    this.eye(0,0,10,seed);this.line([[-3,9],[-5,18],[0,14],[4,19],[4,9]],INK,1.6);c.restore();
  }
  eye(x,y,r=12,phase=0,look=0) {
    const c=this.ctx,t=this.g.time,blink=(t+phase)%4.8>4.57;
    c.save();c.translate(x,y);c.rotate(Math.sin(phase)*.13);
    if(blink){this.line([[-r,0],[0,2],[r,-1]],INK,2.5);}
    else{
      c.beginPath();c.ellipse(0,0,r,r*.82,0,0,Math.PI*2);c.fillStyle='#f3eed8';c.fill();c.strokeStyle=INK;c.lineWidth=2;c.stroke();
      const px=Math.sin(t*.9+phase)*r*.15+look*r*.2;
      this.circle(px,1,r*.43,'#b9b777',INK,1);this.circle(px+1,1,r*.24,INK);this.circle(px+2,-1,r*.08,'#faf5df');
    }c.restore();
  }
  icon(name, x, y, size = 24, color = C.ink) {
    const c = this.ctx; c.save(); c.translate(x, y); c.scale(size / 24, size / 24);
    if (name === 'arrow') {this.line([[-8,0],[8,0]],color,2);this.line([[2,-6],[8,0],[2,6]],color,2);}
    else if (name === 'chevron') this.line([[-2,-5],[3,0],[-2,5]],color,2);
    else if (name === 'back') {this.line([[7,0],[-7,0]],color,2);this.line([[-1,-6],[-7,0],[-1,6]],color,2);}
    else if (name === 'mountain') { this.line([[-12,8],[-3,-8],[3,1],[7,-4],[15,8]],color,2.1); this.line([[-6,-3],[-3,0],[0,-3]],color,1.4); }
    else if (name === 'coin') { this.circle(0,0,10,'#f1bf54'); this.circle(0,0,6,null,'#c58e24',1.3); this.line([[0,-3],[0,3]],'#ad7b21',1.8); }
    else if (name === 'flag') { this.line([[-7,10],[-7,-10],[9,-10],[6,-3],[-7,-3]],color,1.8); }
    else if (name === 'sound' || name === 'mute') {
      this.line([[-9,-4],[-5,-4],[1,-9],[1,9],[-5,4],[-9,4]],color,1.8,true);
      if (name === 'sound') { c.strokeStyle=color;c.lineWidth=1.6;[6,10].forEach(r=>{c.beginPath();c.arc(0,0,r,-0.72,0.72);c.stroke();}); }
      else this.line([[6,-4],[12,4],[9,0],[12,-4],[6,4]],color,1.7);
    } else if (name === 'help') { this.circle(0,0,10,null,color,1.7);this.line([[-3,-4],[-2,-6],[2,-6],[4,-4],[3,-1],[0,1],[0,3]],color,1.7);this.circle(0,6,1,color); }
    else if(name==='person'){this.circle(0,-5,5,null,color,1.8);this.line([[-9,10],[-8,4],[-3,1],[3,1],[8,4],[9,10]],color,1.8);}
    else if (name === 'close') {this.line([[-6,-6],[6,6]],color,2);this.line([[6,-6],[-6,6]],color,2);}
    else if (name === 'pause') {this.rect(-6,-8,4,16,1,color);this.rect(3,-8,4,16,1,color);}
    else if (name === 'play') this.line([[-5,-8],[8,0],[-5,8]],color,1,true,true);
    else if (name === 'bolt') {this.shape([[2,-13],[-9,2],[-1,2],[-4,13],[10,-3],[2,-3]],color,1,color);}
    else if (name === 'shield') {this.shape([[-9,-9],[0,-12],[9,-9],[8,3],[0,11],[-8,3]],'#e3f3ed',1.5,color);this.line([[-4,0],[-1,3],[5,-4]],color,1.5);}
    else if (name === 'box') {this.rect(-10,-8,20,18,4,'#edcea3',color);this.line([[-10,-1],[10,-1],[0,-8],[0,10]],color,1.2);this.circle(-4,3,1.4,color);this.circle(4,3,1.4,color);}
    else if (name === 'swap') {this.line([[-9,-3],[8,-3],[4,-7]],color,1.7);this.line([[9,4],[-8,4],[-4,8]],color,1.7);}
    else if (name === 'down') {this.line([[0,-8],[0,8],[-5,3],[0,8],[5,3]],color,1.8);}
    else if (name === 'check') this.line([[-7,0],[-2,5],[8,-6]],color,2.2);
    else if (name === 'fuel') { this.rect(-8,-7,13,17,2,null,color);this.rect(-6,-5,9,5,1,color);this.line([[5,-4],[9,-4],[11,0],[11,7],[8,7],[8,2],[5,2]],color,1.7);this.line([[-10,11],[7,11]],color,1.5); }
    else if (name === 'wheel') {this.circle(0,0,10,null,color,2.5);this.circle(0,0,4,null,color,1.5);for(let i=0;i<6;i++){const a=i*Math.PI/3;this.line([[Math.cos(a)*7,Math.sin(a)*7],[Math.cos(a)*10,Math.sin(a)*10]],color,2);}}
    else if (name === 'engine') {this.line([[-9,-5],[-4,-5],[-4,-8],[5,-8],[5,-4],[9,-4],[9,7],[-7,7],[-7,3],[-10,3],[-10,-4]],color,1.8);this.line([[-1,-11],[4,-11]],color,1.8);this.line([[12,-4],[12,6]],color,2);}
    else if (name === 'spring') {this.line([[-7,-10],[7,-10],[-6,-5],[6,0],[-6,5],[7,10],[-7,10]],color,1.7);}
    else if (name === 'trophy') {this.line([[-6,-9],[6,-9],[5,1],[0,5],[-5,1],[-6,-9]],color,1.8);this.line([[0,5],[0,10],[-5,10],[5,10]],color,1.8);this.line([[-6,-6],[-11,-6],[-10,-1],[-5,2]],color,1.5);this.line([[6,-6],[11,-6],[10,-1],[5,2]],color,1.5);}
    else if (name === 'car') {this.line([[-12,4],[-12,-2],[-7,-3],[-4,-9],[5,-9],[8,-3],[13,-1],[13,4]],color,1.8);this.line([[-4,-8],[-3,-2],[5,-2],[4,-8]],color,1.4);this.circle(-7,5,3,null,color,1.8);this.circle(8,5,3,null,color,1.8);this.line([[-4,5],[5,5]],color,1.8);}
    else if(name==='speed'){c.beginPath();c.arc(0,2,10,Math.PI,Math.PI*2);c.strokeStyle=color;c.lineWidth=2;c.stroke();this.line([[0,3],[6,-6]],color,2);this.circle(0,3,2,color);}
    else if(name==='clock'){this.circle(0,0,10,null,color,2);this.line([[0,-6],[0,0],[5,3]],color,2);}
    else if(name==='lock'){this.rect(-7,-1,14,12,3,null,color);c.beginPath();c.arc(0,-1,5,Math.PI,0);c.strokeStyle=color;c.lineWidth=2;c.stroke();this.circle(0,5,1.5,color);}
    else if(name==='home'){this.line([[-11,0],[0,-10],[11,0]],color,2);this.line([[-7,-2],[-7,10],[7,10],[7,-2]],color,2);}
    else if(name==='air'){this.line([[-10,5],[8,-8],[2,9],[-1,2],[-10,5]],color,2,true);}
    else if(name==='portal'){c.beginPath();c.ellipse(0,0,8,11,.2,0,Math.PI*2);c.strokeStyle=color;c.lineWidth=2;c.stroke();this.line([[-4,0],[4,0],[1,-3]],color,2);}
    else if(name==='fog'){this.line([[-11,0],[-11,-4],[-6,-5],[-4,-10],[2,-10],[5,-5],[10,-4],[11,0]],color,2);this.line([[-9,4],[9,4]],color,2);this.line([[-5,8],[6,8]],color,2);}
    else if(name==='drop'){c.beginPath();c.moveTo(0,-11);c.bezierCurveTo(-16,6,-3,15,4,9);c.bezierCurveTo(13,4,3,-5,0,-11);c.strokeStyle=color;c.lineWidth=2;c.stroke();}
    else if(name==='info'){this.circle(0,0,10,null,color,1.7);this.circle(0,-5,1.3,color);this.line([[0,-1],[0,6]],color,2);}
    else if(name==='plus'){this.line([[-7,0],[7,0]],color,2);this.line([[0,-7],[0,7]],color,2);}
    else if (name === 'leaf') {this.line([[-7,7],[-5,-3],[1,-9],[10,-10],[8,1],[2,7],[-7,7]],color,1.7);this.line([[-7,9],[5,-4]],color,1.5);}
    c.restore();
  }
  draw() {
    const g = this.g; this.w = g.platform.width; this.h = g.platform.height; g.buttons = [];
    this.portrait = this.w < 1000;
    g.platform.beginFrame(); this.ctx.globalAlpha = 1;
    if (['playing','paused','result'].includes(g.screen)) {
      this.world();if(g.screen!=='result'){this.hud();this.handsOnHud();}
      if (g.screen === 'paused') this.pauseScreen();
      if (g.screen === 'result') {
        if(g.finishRibbon&&g.time-g.finishRibbon.started<g.finishRibbon.duration)this.finishRibbonEffect();
        else this.resultScreen();
      }
    } else {
      if(g.screen==='home')this.background(false);else this.rect(0,0,this.w,this.h,0,'#a9d6bd');
      if (g.screen === 'home') this.home();
      if (g.screen === 'garage') this.garage();
      if (g.screen === 'characters') this.charactersPortrait();
      if (g.screen === 'records') this.recordsScreen();
      if (g.screen === 'routes' || g.screen === 'campaign') this.campaign();
      this.header();
    }
    if (g.modal === 'help') this.help();
    if (g.modal === 'test') this.trialScreen();
    if(g.modal==='branch')this.branchScreen();
    if(g.modal==='modInfo')this.modInfoScreen();
    if(g.modal==='routeInfo')this.routeInfoScreen();
    if(g.modal==='workshopInfo')this.workshopInfoScreen();
    if(g.modal==='rewardInfo')this.rewardInfoScreen();
    if (g.toast) {
      const width = Math.max(300, this.ctx.measureText(g.toast.message).width + 90);
      this.rect((this.w-width)/2,this.h-64,width,42,21,'rgba(35,76,66,0.94)');
      this.text(g.toast.message,this.w/2,this.h-53,17,C.paper,500,'center');
    }
    if(this.paperPattern){this.ctx.fillStyle=this.paperPattern;this.ctx.fillRect(0,0,this.w,this.h);}
  }
  header() {
    if(['campaign','routes'].includes(this.g.screen))return this.campaignHeader();
    if(this.portrait) return this.headerPortrait();
    const g=this.g,s=g.platform.safe,left=Math.max(56,s.left+16),right=Math.max(56,s.right+18,g.platform.menuInset||0),top=Math.max(29,s.top+10);
    if(g.screen==='home'){
      this.icon('mountain',left+14,top+16,29,INK);
      
    }else{
      this.icon('back',left+12,top+17,24,INK);
      
      this.hit('home',left-10,top-6,180,54);
      this.iconButton('garage',637,top-5,58,48,'car',g.screen==='garage');this.iconButton('home',717,top-5,58,48,'home');
    }
    const coinX=this.w-right-210;
    this.panel(coinX,top-2,117,43,'#eae3d2');
    this.icon('coin',coinX+24,top+20,22);
    this.text(g.save.coins,coinX+47,top+5,22,INK,500);
    [['sound',g.save.sound?'sound':'mute'],['help','help']].forEach(([action,name],i)=>{const x=this.w-right-59+i*50;this.icon(name,x,top+20,23,INK);this.hit(action,x-22,top-3,44,49);});
  }
  mountainLayer(base, amp, color, offset, period, phase=0) {
    const ridge=[];
    for(let x=-30;x<=this.w+40;x+=16){
      const p=(x+offset)/period;
      const peak=Math.pow((Math.sin(p+phase)+1)/2,1.5);
      ridge.push([x,base-amp*peak-amp*.25*Math.sin(p*2.1+1)+Math.sin(p*17)*1.8]);
    }
    this.line([[-30,this.h+20],...ridge,[this.w+40,this.h+20]],color,1,true,true);
    this.line(ridge,'rgba(100,115,84,.32)',1.25);

  }
  background(playing) {
    const g=this.g,r=g.routeSpec(),h=this.h,w=this.w,t=g.time,offset=playing?g.camera.x:0;
    this.paintedSceneActive=!!(playing&&g.visualPack?.ready&&this.paintedSceneBackground(r));
    if(this.paintedSceneActive){
      this.environmentMotion(r,offset);
      return;
    }
    if(playing&&this.illustratedEnvironment()){
      this.visualLayer('sky',0);this.visualLayer('far',.28);this.visualLayer('mid',.62);this.visualLayer('foreground',1);
      this.stageLandmarks(r,offset);return;
    }
    const sky=this.ctx.createLinearGradient?.(0,0,0,h);
    if(sky){sky.addColorStop(0,r.sky);sky.addColorStop(1,r.far);}
    this.rect(0,0,w,h,0,sky||r.sky);
    // 场景保持怪诞，但天空与地面装饰不冒充交互装置。
    const variant=g.save.route%4,planetR=(playing?52:68)+(variant===2?13:0),planetX=w*(.68+variant*.065),planetY=h*(.19+(variant%2)*.09);
    const planetColor=variant===1?'#ffe2b0':variant===2?'#f5f7df':variant===3?'#d9cdea':'#e8ebad';
    this.circle(planetX,planetY,planetR,planetColor,INK,2.5);
    this.circle(planetX+planetR*.22,planetY-planetR*.25,planetR*.15,r.far);
    this.circle(planetX-planetR*.28,planetY+planetR*.28,planetR*.23,r.far);
    this.circle(w*.93,h*.16,playing?7:10,planetColor,INK,1.5);
    if(r.scene!=='wild')this.sceneBackdrop(r.scene,offset*.12);
    else for(let i=0;i<6;i++){
      const x=((i*317-offset*.12)%(w+400)+w+400)%(w+400)-150,base=h*.79;
      if(r.biome===1){
        this.shape([[x-115,base],[x-78,base-80],[x-15,base-126],[x+58,base-94],[x+132,base]],r.far,2,r.far);
        this.line([[x-65,base-55],[x-10,base-72],[x+47,base-58]],'rgba(255,232,190,.42)',3);
      }else{
        this.shape([[x-70,base],[x-33,base-180],[x-49,base-247],[x-5,base-222],[x+18,base-350],[x+50,base-288],[x+37,base-191],[x+93,base]],r.far,2,r.far);
        if(r.biome===2)this.line([[x-48,base-244],[x-5,base-222],[x+18,base-350],[x+50,base-288]],'rgba(245,252,241,.82)',9);
      }
      
    }
    this.mountainLayer(h*.87,135,r.mid,offset*.24,171,4.7);
    this.mountainLayer(h*.99,110,r.near,offset*.37,215,2.5);
    this.stageLandmarks(r,offset);
    this.environmentAtmosphere(r,offset,variant);
    for(let i=0;i<4;i++){
      const x=((i*403+t*12-offset*.03)%(w+150)+w+150)%(w+150)-70,y=h*(.17+(i%3)*.07);
      this.cloud(x,y,.55+i*.07,r.scene==='fossil'||r.biome===1?'#f3dec1':r.scene==='mushroom'?'#ead6e9':r.scene==='clockwork'?'#d2dfd9':r.scene==='inverted'?'#e1e4bf':'#dcebe8',r.far);
    }
  }
  environmentMotion(route,offset) {
    const t=this.g.time,w=this.w,h=this.h,scene=route.scene;
    const snowy=/雪|冰|极地|零度/.test(route.name);
    const sandy=/沙|荒漠/.test(route.name)||scene==='fossil',misty=/雾|影|追/.test(route.name);
    const c=this.ctx;c.save();
    if(scene==='crystal'||scene==='mushroom'||scene==='inverted'){
      const beam=c.createLinearGradient(0,0,190,0);
      beam.addColorStop(0,'rgba(255,255,228,0)');beam.addColorStop(.5,'rgba(255,255,228,.2)');beam.addColorStop(1,'rgba(255,255,228,0)');
      c.translate(w*(.38+Math.sin(t*.42)*.27),h*.12);c.rotate(-.28);
      this.rect(-95,0,190,h*.72,0,beam);c.restore();c.save();
    }
    if(snowy||misty||scene==='mushroom'||scene==='inverted'){
      for(let i=0;i<3;i++){
        const span=w+430,x=((i*347+t*(i%2?22:-17)-offset*.018)%span+span)%span-215;
        c.save();c.translate(x,h*(.44+i*.15));c.scale(2.8,.38);
        c.globalAlpha=snowy?.12:misty?.14:.075;
        this.circle(0,0,100,snowy?'#e8f6ff':'#f5f5e7');c.restore();
      }
    }
    const count=snowy?64:sandy?42:scene==='crystal'?30:36;
    for(let i=0;i<count;i++){
      const seed=hash(i*71+this.g.save.route*191),phase=hash(i*137+41),near=i%4===0;
      const span=w+130,wind=snowy?54+seed*80:sandy?80+seed*70:scene==='clockwork'?35+seed*35:23+seed*38;
      const x=((seed*span+t*wind-offset*.035)%span+span)%span-65;
      const fall=snowy?54+seed*95:sandy?-20-seed*32:scene==='inverted'?-35-seed*30:-24-seed*23;
      const y=((phase*(h+120)+t*fall)%(h+120)+h+120)%(h+120)-60;
      c.globalAlpha=(near?.82:.55)*(.78+Math.sin(t*2+i)*.22);
      if(snowy){
        const size=near?3.8:2.3;
        this.line([[x,y],[x-7-size,y+11+size]],'#f7fdff',size);
        if(near&&i%3===0)this.circle(x+1,y-2,2.2,'#ffffff');
      }else if(sandy)this.line([[x-17-seed*14,y+4],[x+18+seed*20,y-4]],'#ffe6bf',near?3.1:1.8);
      else if(scene==='crystal'){
        const size=near?8:5;
        this.line([[x,y-size],[x+size*.6,y],[x,y+size],[x-size*.6,y]],'#e4ffff',near?2.7:1.8,true);
      }else if(scene==='clockwork'){
        this.circle(x,y,near?4:2.5,'#ffe5a8');
        if(near)this.line([[x-8,y],[x+8,y]],'#fff0c7',1.8);
      }else{
        const size=near?5:3;
        this.circle(x,y,size,scene==='mushroom'?'#fff1ae':'#fff8d8');
        if(near)this.circle(x,y,size*1.8,null,'rgba(255,250,215,.55)',1.5);
      }
    }
    c.restore();
  }
  foregroundWeather(route) {
    if(!this.paintedSceneActive)return;
    const c=this.ctx,t=this.g.time,w=this.w,h=this.h,scene=route.scene;
    const snowy=/雪|冰|极地|零度/.test(route.name),sandy=/沙|荒漠/.test(route.name)||scene==='fossil';
    c.save();
    for(let i=0;i<14;i++){
      const seed=hash(i*109+this.g.save.route*83),phase=hash(i*67+29),span=w+140;
      const x=((seed*span+t*(snowy?95:sandy?120:43))%span+span)%span-70;
      const fall=snowy?85:sandy?-35:scene==='inverted'?-32:-24;
      const y=((phase*(h*.7)+t*fall)%(h*.7)+h*.7)%(h*.7)+h*.22;
      c.globalAlpha=.34+seed*.38;
      if(snowy){this.circle(x,y,2.5+seed*2.2,'#ffffff');this.line([[x+2,y-3],[x-9,y+13]],'#e8f8ff',2.1);}
      else if(sandy)this.line([[x-25,y+4],[x+31,y-4]],'#fff0d4',2.2);
      else this.circle(x,y,2.8+seed*2.4,scene==='mushroom'?'#fff1ab':scene==='crystal'?'#e7ffff':'#fff5c8');
    }
    c.restore();
  }
  roadMaterial(route) {
    const name=route.name||'';
    const kind=/雪|冰|极地|零度/.test(name)?'ice':/沙|荒漠/.test(name)&&route.scene==='wild'?'dune':ROAD_MATERIALS[route.scene]?route.scene:'root';
    return {kind,...ROAD_MATERIALS[kind]};
  }
  themedRoadSegment(pts,a,b,underside,material,route) {
    const m=material,g=this.g;
    this.line([...pts,...underside.slice().reverse()],m.body,1,true,true);
    this.line(pts.map(([x,y])=>[x,y+25]),m.band,12);
    this.line(pts.map(([x,y])=>[x,y+49]),m.deep,9);
    this.line(underside,m.seam,3);
    const spacing=m.kind==='clockwork'?72:m.kind==='mushroom'?76:90;
    for(let x=Math.ceil(a/spacing)*spacing;x<b-12;x+=spacing){
      const y=g.terrain.height(x),v=hash(x+g.save.route*19);
      if(m.kind==='ice'){
        this.shape([[x-19,y+14],[x+8,y+18],[x+18,y+51],[x-7,y+44]],v>.5?'rgba(219,251,255,.4)':'rgba(81,146,185,.32)',1,m.seam);
        this.line([[x+8,y+18],[x-7,y+44]],m.glint,2);
        this.shape([[x+23,y+10],[x+31,y+12],[x+27,y+28]],m.glint,0);
      }else if(m.kind==='mushroom'){
        for(const dx of [-17,0,17])this.line([[x+dx,y+12],[x+dx+(dx?dx*.25:0),y+48]],m.seam,2.5);
        this.circle(x-12,y+33,3,m.glint);this.circle(x+16,y+38,2.5,m.glint);
        if(/桥/.test(route.name))this.line([[x-27,y-1],[x-27,y+17]],m.glint,3);
      }else if(m.kind==='clockwork'){
        this.line([[x,y+13],[x,y+54]],m.seam,3);
        this.circle(x-18,y+28,3.5,m.glint,m.seam,1);
        this.circle(x+19,y+39,3.5,m.glint,m.seam,1);
      }else if(m.kind==='crystal'){
        this.shape([[x-20,y+15],[x+6,y+10],[x+22,y+46],[x-2,y+53]],'rgba(180,241,252,.25)',1,m.seam);
        this.line([[x+6,y+10],[x-2,y+53]],m.glint,2);
      }else if(m.kind==='fossil'){
        this.line([[x-24,y+31],[x-3,y+26],[x+18,y+32]],m.glint,2);
        this.circle(x+5,y+44,5,null,m.glint,2);
      }else if(m.kind==='dune'){
        this.line([[x-28,y+21],[x-6,y+17],[x+25,y+24]],m.glint,2);
        this.circle(x+12,y+42,2,m.glint);
      }else if(m.kind==='inverted'){
        this.line([[x-14,y+12],[x-4,y+34],[x-15,y+57]],m.seam,3);
        this.line([[x+12,y+15],[x+3,y+38],[x+15,y+51]],m.glint,2);
      }else{
        this.line([[x-18,y+20],[x-4,y+39],[x+13,y+45]],m.seam,3);
        this.circle(x+17,y+25,3,m.glint);
      }
    }
    this.line(pts.map(([x,y])=>[x,y-4]),m.rim,12);
    this.line(pts.map(([x,y])=>[x,y-8]),m.glint,3);
    this.line(pts,m.seam,2.5);
  }
  stageLandmarks(route,offset) {
    const fallback={wild:'root',mushroom:'mushroom',fossil:'bone',clockwork:'clock',crystal:'crystal',inverted:'inverted'};
    const action={cruise:'road',sprint:'speed',air:'flight',grip:'rock',fuel:'oil',chase:'fog'};
    const marks=STAGE_LANDMARKS[this.g.save.route]||[fallback[route.scene]||'root',action[route.type]||'road'];
    const span=this.w+380;
    for(let i=0;i<2;i++){
      const origin=this.w*(i?.82:.48),shift=offset*(i?.035:.06);
      const x=((origin+190-shift)%span+span)%span-190;
      const floating=['flight','mushroom','inverted','cloud','fog','crystal'].includes(marks[i]);
      const y=this.h*(i?.48:.43)+(floating?Math.sin(this.g.time*(i?.85:.65)+i)*7:0);
      this.drawStageLandmark(marks[i],x,y,i?.78:1.13,route);
    }
  }
  drawStageLandmark(kind,x,y,scale,route) {
    const c=this.ctx,fill=route.mid,edge=route.near,light=route.grass;
    c.save();c.translate(x,y);c.scale(scale,scale);if(kind==='gear')c.rotate(this.g.time*.12);c.globalAlpha*=.66;
    const L=(points,width=5,color=edge)=>this.line(points,color,width);
    const S=points=>this.shape(points,fill,2,edge);
    if(kind==='echo'){
      for(const radius of [24,43,62])this.circle(0,0,radius,null,edge,5);
      this.circle(0,0,10,light,edge,2);
    }else if(kind==='lab'){
      this.rect(-44,25,88,13,3,fill,edge);L([[0,25],[0,-38]],7);this.circle(0,-43,16,light,edge,3);
      L([[-28,25],[-35,-6],[-12,-6]],4);L([[28,25],[35,-6],[12,-6]],4);
    }else if(kind==='fang'){
      S([[-62,-29],[-45,49],[-20,-19],[2,54],[25,-24],[51,49],[61,-34]]);
      L([[-67,-35],[67,-35]],9,edge);
    }else if(kind==='dune'){
      S([[-78,39],[-48,9],[-9,-8],[30,13],[73,39]]);L([[-72,54],[-20,30],[31,39],[73,57]],5,light);
    }else if(kind==='ice'||kind==='crystal'){
      S([[-45,46],[-27,-29],[-6,1],[12,-58],[51,46]]);
      L([[12,-58],[4,41]],4,light);L([[-27,-29],[-8,44]],3,light);
      if(kind==='crystal')this.shape([[24,34],[36,-23],[62,34]],light,2,edge);
    }else if(kind==='monster'){
      S([[-62,38],[-57,-29],[-30,-47],[0,-28],[31,-49],[58,-23],[62,38]]);
      for(const xx of [-24,24]){this.circle(xx,-9,15,light,edge,3);this.circle(xx+5,-8,5,edge);}
    }else if(kind==='rift'){
      S([[-75,50],[-75,-42],[-14,-34],[-7,8],[-28,50]]);S([[25,50],[4,10],[19,-31],[75,-45],[75,50]]);
      L([[-7,8],[-17,25],[-4,42]],3,light);
    }else if(kind==='speed'){
      for(let j=0;j<3;j++)L([[-67,-28+j*25],[30,-28+j*25]],7,light);
      S([[4,-54],[65,0],[4,54],[22,3]]);
    }else if(kind==='flight'){
      S([[-67,11],[-10,-18],[38,-17],[68,8],[10,27]]);L([[-48,33],[-20,44]],4,light);L([[7,38],[27,47]],4,light);
    }else if(kind==='oil'){
      this.rect(-40,-41,80,91,12,fill,edge);this.rect(-19,-56,38,18,3,light,edge);
      S([[0,-17],[-18,14],[-13,29],[0,36],[13,29],[18,14]]);
    }else if(kind==='finish'){
      L([[-28,57],[-28,-54]],8);S([[-24,-50],[49,-41],[19,-6],[-24,-16]]);
      L([[-60,57],[59,57]],5,light);
    }else if(kind==='fog'||kind==='cloud'){
      for(let j=0;j<3;j++)L([[-70+j*9,-29+j*28],[-28-j*5,-40+j*28],[15+j*7,-29+j*28],[69,-38+j*28]],kind==='cloud'?13:8,kind==='cloud'?fill:edge);
      if(kind==='fog')for(const xx of [-18,24])this.circle(xx,12,7,light,edge,2);
    }else if(kind==='root'){
      L([[0,-58],[0,19],[-39,52]],12);L([[0,19],[45,57]],10);L([[0,-18],[-47,-44]],8);L([[0,-29],[48,-53]],8);
      for(const xx of [-50,-20,13,44])this.circle(xx,-49+(xx%3)*8,13,fill,edge,2);
    }else if(kind==='maze'){
      L([[-57,46],[-57,-36],[-12,-36],[-12,9],[27,9],[27,-48],[61,-48],[61,40]],9);
      this.circle(-12,9,8,light);
    }else if(kind==='road'||kind==='home'){
      S([[-60,55],[-27,9],[-18,-31],[10,-55],[27,-15],[60,55]]);
      L([[0,48],[0,10],[5,-25]],4,light);
      if(kind==='home'){this.rect(-20,-52,40,29,4,light,edge);this.shape([[-29,-52],[0,-74],[29,-52]],fill,2,edge);}
    }else if(kind==='ridge'){
      S([[-75,48],[-40,-31],[-12,9],[16,-59],[43,2],[67,-36],[83,48]]);
      L([[16,-59],[28,-19],[43,2]],5,light);
    }else if(kind==='delivery'){
      this.rect(-43,-25,86,69,4,fill,edge);L([[-43,-4],[0,14],[43,-4]],4,light);L([[0,14],[0,43]],4,light);
    }else if(kind==='rock'){
      S([[-63,44],[-50,-8],[-21,-38],[3,-18],[26,-48],[57,-10],[67,44]]);
      L([[-21,-38],[-12,15],[12,44]],4,light);
    }else if(kind==='bridge'||kind==='tilt'){
      const d=kind==='tilt'?25:0;L([[-70,0+d],[70,-d]],12);for(const xx of [-48,0,48])L([[xx,0-d*xx/70],[xx,54]],7);
      L([[-70,54],[70,54]],5,light);
    }else if(kind==='clock'||kind==='tower'){
      this.rect(-32,-46,64,101,5,fill,edge);S([[-44,-45],[0,-69],[44,-45]]);
      this.circle(0,-21,kind==='tower'?14:24,light,edge,3);
      const hand=this.g.time*.24;L([[0,-21],[Math.sin(hand)*15,-21-Math.cos(hand)*15]],4);L([[0,-21],[Math.sin(hand*.34+1)*10,-21-Math.cos(hand*.34+1)*10]],3);
    }else if(kind==='curtain'){
      S([[-70,-55],[-18,-45],[-30,54],[-70,54]]);S([[70,-55],[18,-45],[30,54],[70,54]]);
      L([[-63,-58],[63,-58]],7,light);this.circle(0,-24,12,light);
    }else if(kind==='wave'){
      for(let j=0;j<3;j++)L([[-75,-25+j*28],[-43,-43+j*28],[-10,-25+j*28],[24,-43+j*28],[70,-25+j*28]],7,j===1?light:edge);
    }else if(kind==='bone'){
      const arc=[];for(let j=0;j<=16;j++){const a=Math.PI+j*Math.PI/16;arc.push([Math.cos(a)*63,Math.sin(a)*75]);}
      L(arc,13,fill);L([[-65,42],[65,42]],10,edge);
      for(let j=0;j<5;j++)L([[-46+j*22,22],[-39+j*18,-13]],7,light);
    }else if(kind==='mushroom'){
      S([[-13,47],[-9,-8],[12,-9],[15,47]]);S([[-71,-10],[-45,-49],[0,-60],[48,-49],[72,-10],[28,1],[-28,1]]);
      for(const xx of [-28,4,34])this.circle(xx,-31,6,light);
    }else if(kind==='inverted'){
      S([[-72,-45],[-38,-23],[0,-35],[39,-21],[72,-48],[72,-63],[-72,-63]]);
      for(const xx of [-43,-8,27,55])L([[xx,-25],[xx+7,30],[xx-5,54]],7);
    }else if(kind==='gear'){
      this.circle(0,0,43,fill,edge,8);this.circle(0,0,20,light,edge,5);
      for(let j=0;j<12;j++){const a=j*Math.PI/6,cs=Math.cos(a),sn=Math.sin(a);L([[cs*43,sn*43],[cs*58,sn*58]],10);}
    }
    c.restore();
  }
  environmentAtmosphere(r,offset,variant) {
    const h=this.h,w=this.w,scene=r.scene;
    if(scene==='crystal'){
      for(let i=0;i<13;i++){const x=((i*149-offset*.09)%(w+180)+w+180)%(w+180)-90,y=h*(.31+(i%5)*.09);this.line([[x,y-14],[x+9,y],[x,y+14],[x-9,y]],'rgba(234,255,255,.68)',2,true);}
    }else if(scene==='clockwork'){
      for(let i=0;i<7;i++){const x=((i*211-offset*.1)%(w+210)+w+210)%(w+210)-100,y=h*(.38+(i%3)*.11);this.circle(x,y,14+i%3*5,null,'rgba(238,220,180,.32)',3);}
    }else if(scene==='fossil'||r.biome===1){
      for(let i=0;i<13;i++){const x=((i*137-offset*.16)%(w+150)+w+150)%(w+150)-75,y=h*(.42+(i%4)*.07);this.line([[x,y],[x+24,y-7]],'rgba(255,232,187,.45)',2);}
    }else if(scene==='mushroom'||scene==='inverted'){
      for(let i=0;i<11;i++){const x=((i*173-offset*.08)%(w+180)+w+180)%(w+180)-90,y=h*(.39+(i%4)*.11);this.circle(x,y,2+(i%3),'rgba(251,239,197,.63)');}
    }else if(r.biome===2){
      for(let i=0;i<16;i++){const x=((i*113-offset*.06)%(w+130)+w+130)%(w+130)-65,y=h*(.32+(i%6)*.095);this.line([[x,y],[x-9,y+18]],'rgba(247,255,255,.65)',2);}
    }
    const light=['','rgba(249,169,96,.13)','rgba(225,245,255,.13)','rgba(49,45,93,.16)'][variant];
    if(light)this.rect(0,0,w,h,0,light);
  }
  cloud(x,y,s,fill='#d2e6c6',edge='#70607e') {
    const c=this.ctx;c.save();c.translate(x,y);c.scale(s,s);
    this.shape([[-64,8],[-51,-4],[-34,-3],[-25,-25],[-7,-29],[3,-15],[20,-21],[37,-9],[39,1],[60,8],[32,19],[-31,16]],fill,1.8,edge);
    c.restore();
  }
  sceneBackdrop(scene,offset) {
    const r=this.g.routeSpec(),c=this.ctx,base=this.h*(this.portrait?.59:.76),phase=(this.g.save.route*113)%420;
    for(let wx=Math.floor((offset-240-phase)/420)*420;wx<offset+this.w+240;wx+=420){
      const x=wx+phase-offset,n=hash(wx+27+this.g.save.route*67),size=.78+n*.38;
      c.save();c.translate(x,base);c.scale(size,size);
      if(scene==='mushroom'){
        this.shape([[-23,70],[-16,-193],[13,-223],[31,70]],r.far,1,r.far);
        this.shape([[-164,-192],[-120,-267],[-29,-298],[65,-280],[155,-191],[86,-164],[-64,-162]],r.far,1,r.far);
        for(let i=0;i<6;i++)this.line([[-104+i*40,-187],[-11+i*5,-242]],r.sky,4);
        this.circle(-72,-233,15,r.sky);this.circle(45,-250,23,r.sky);
      }else if(scene==='fossil'){
        const pts=[];for(let i=0;i<=24;i++){const a=Math.PI+i/24*Math.PI;pts.push([Math.cos(a)*164,Math.sin(a)*235]);}
        this.line(pts,r.mid,23);this.line([[-175,14],[174,14]],r.mid,17);
        for(let i=0;i<6;i++){const a=Math.PI+i/5*Math.PI;this.line([[Math.cos(a)*145,Math.sin(a)*210],[Math.cos(a)*109,Math.sin(a)*172]],r.mid,16);}
        this.circle(-128,-35,29,r.mid);this.circle(-131,-41,12,r.sky);
      }else if(scene==='clockwork'){
        this.shape([[-89,60],[-72,-256],[50,-256],[80,60]],r.far,1,r.far);
        this.circle(-12,-244,69,r.far);this.circle(-12,-244,51,r.sky);this.line([[-12,-281],[-12,-244],[20,-220]],r.far,7);
        const sway=Math.sin(this.g.time*.7+wx)*29;this.line([[-8,-171],[sway,-31]],r.sky,5);this.circle(sway,-31,23,r.sky);
        for(let j=0;j<3;j++)this.rect(18,-141+j*34,18,11,2,r.sky);
      }else if(scene==='crystal'){
        for(let j=0;j<4;j++){const xx=-135+j*74,hh=160+hash(wx+j)*160;this.shape([[xx,25],[xx-22,-hh*.78],[xx+14,-hh],[xx+45,-hh*.73],[xx+54,25]],r.far,1,r.far);this.line([[xx+14,-hh],[xx+21,20]],r.sky,2);}
      }else{
        this.shape([[-181,-322],[-113,-278],[-28,-311],[62,-268],[164,-320]],r.far,1,r.far);
        for(let j=0;j<6;j++){const xx=-135+j*51;this.line([[xx,-307],[xx+12,-237],[xx-16,-204-j%3*25],[xx-25,-145-j%2*30]],r.far,8);this.line([[xx-16,-204-j%3*25],[xx+22,-186-j%3*25]],r.far,5);}
      }
      c.restore();
    }
  }
  sceneProp(x,y,scale,scene) {
    const c=this.ctx,r=this.g.routeSpec();c.save();c.translate(x,y);c.scale(scale,scale);
    if(scene==='mushroom'){
      this.shape([[-8,0],[-5,-69],[11,-76],[17,0]],'#a6b9aa',2,'#566966');
      this.shape([[-52,-58],[-33,-99],[4,-113],[44,-89],[61,-58],[13,-47]],'#bca1c0',2,'#756b89');
      this.circle(-12,-83,10,'#e4c5cd');this.circle(24,-72,7,'#e4c5cd');
    }else if(scene==='fossil'){
      const pts=[];for(let i=0;i<=18;i++){const a=Math.PI+i*Math.PI/18;pts.push([Math.cos(a)*58,Math.sin(a)*90]);}this.line(pts,'#d9c5a2',12);this.line([[-65,0],[66,0]],'#ad977f',4);
      for(let i=0;i<4;i++)this.line([[-33+i*23,-72],[-21+i*15,-45]],'#d9c5a2',7);
    }else if(scene==='clockwork'){
      this.rect(-18,-106,41,106,5,'#819995','#546e6d',2);this.circle(3,-93,32,'#c4b690','#627778',2);this.circle(3,-93,7,'#627778');
      for(let i=0;i<8;i++){const a=i*Math.PI/4+this.g.time*.25;this.line([[3+Math.cos(a)*10,-93+Math.sin(a)*10],[3+Math.cos(a)*26,-93+Math.sin(a)*26]],'#627778',4);}
      this.line([[-39,-10],[43,-10]],'#546e6d',6);
    }else if(scene==='crystal'){
      this.shape([[-31,0],[-48,-58],[-26,-104],[-4,-57],[2,0]],'#99c4cd',2,'#65859e');this.shape([[-3,0],[0,-103],[20,-143],[42,-93],[24,0]],'#b6dcd7',2,'#65859e');this.line([[20,-140],[16,-6]],'#e0eee4',3);
    }else{
      this.line([[0,0],[5,-95]],'#777a93',7);this.shape([[-57,-84],[-28,-64],[-8,-73],[7,-57],[39,-66],[60,-94]],'#a8bb95',2,'#777a93');
      for(const xx of [-39,-9,22,42])this.line([[xx,-79],[xx-4,-115],[xx+11,-130]],'#a8bb95',5);
    }
    c.restore();
  }
  tree(x,y,scale=1,color='#9aa776',snow=false) {
    const c=this.ctx,t=this.g.time;c.save();c.translate(x,y);c.rotate(Math.sin(t*1.4+x*.04)*.055);c.scale(scale,scale);
    this.shape([[-9,1],[-5,-57],[-27,-72],[-30,-91],[-13,-77],[-2,-87],[6,-76],[26,-95],[20,-65],[8,-49],[11,1]],'#68588c',2.5);
    this.shape([[-43,-66],[-51,-85],[-31,-112],[-14,-99],[3,-126],[22,-113],[27,-94],[46,-102],[50,-78],[32,-58],[4,-63],[-19,-53]],snow?'#b1e3d7':'#99d967',2.5);
    this.eye(-18,-83,14,x*.017,-.2);this.eye(20,-89,10,x*.017+.3,.5);
    this.shape([[-9,-68],[12,-71],[5,-53],[-4,-51]],INK,1.2);
    this.shape([[-6,-68],[0,-69],[-1,-58]],'#efe4c6',1);this.line([[-14,-15],[-3,-23],[12,-15]],INK,2);
    if(snow)this.line([[-35,-108],[-13,-101],[3,-122],[19,-111]],'#f0efd8',8);
    c.restore();
  }
  cactus(x,y,s=1) {
    const c=this.ctx,t=this.g.time;c.save();c.translate(x,y);c.rotate(Math.sin(t+x*.03)*.05);c.scale(s,s);
    this.shape([[-14,0],[-12,-35],[-32,-45],[-33,-77],[-22,-80],[-20,-55],[-10,-56],[-9,-97],[3,-106],[15,-95],[14,-47],[27,-54],[27,-82],[38,-78],[40,-43],[16,-26],[18,0]],'#72be91',2.5);
    this.eye(2,-85,14,x*.013);this.line([[-5,-57],[8,-59],[6,-48],[-3,-46]],INK,2);
    for(let i=0;i<5;i++)this.line([[-17,-8-i*12],[-11,-4-i*12]],INK,1.5);c.restore();
  }
  homeGround(x) {
    return this.h*.738+24*Math.sin(x/191)+25*Math.sin((x-300)/351);
  }
  home() {
    if(this.portrait)return this.homePortrait();
    const g=this.g,h=this.h;
    this.title(320,112,Math.min(112,(h-285)/2.3));
    const ground=h*.66;
    this.line([[0,ground+50],[600,ground+40],[970,ground-5],[1440,ground+15],[1440,h],[0,h]],g.routeSpec().earth,1,true,true);
    this.line([[0,ground+50],[600,ground+40],[970,ground-5],[1440,ground+15]],'#b4ed57',12);
    this.car(1030,ground-80,Math.sin(g.time)*.02,3.25,g.save.vehicle,g.time*.1);
    this.button('mode:stage',77,h-156,490,89,'第 '+(g.save.route+1)+' 关',true,'play');
    this.button('garage',596,h-156,277,89,'车库',false,'car');

  }
  driverHead(x,y,scale=1,index=this.g.save.character||0) {
    const c=this.ctx,p=CHARACTERS[index]||CHARACTERS[0],t=this.g.time;c.save();c.translate(x,y);c.scale(scale,scale);
    if(p.kind==='goblin'){
      this.shape([[-18,-14],[-23,-25],[-11,-24],[-9,-40],[4,-32],[17,-35],[11,-22],[20,-13]],p.accent,2);
      this.shape([[-9,-36],[3,-29],[12,-30],[6,-24],[-7,-25]],'#729397',1.3);
      this.line([[-21,-17],[17,-17]],'#e5c788',5);this.rect(-4,-21,9,6,1,'#efd5a0',INK);
      this.shape([[-15,-9],[-25,-14],[-20,1],[-13,4],[-8,17],[7,18],[14,9],[31,4],[19,-3],[15,-14]],p.skin,2);
      this.shape([[-20,-7],[-14,-3],[-18,0]],p.shade,1,p.shade);
      this.shape([[-11,10],[5,14],[13,9],[7,18],[-6,16]],p.shade,1,p.shade);
      this.eye(-7,-6,8,.6,.4);this.eye(10,-8,6.5,.9,.5);
      this.line([[-15,-16],[-1,-13]],INK,2.3);this.line([[7,-17],[16,-18]],INK,2);
      this.line([[17,0],[27,4],[16,5]],'#507c66',1.5);this.circle(-10,6,2.5,'#d6b679');
      this.shape([[0,6],[14,6],[11,14],[0,12]],INK,1);this.rect(4,7,4,4,0,'#fff1cf');
      this.line([[-20,-22],[-23,-28]],INK,1.2);
    }else if(p.kind==='cat'){
      this.shape([[-22,2],[-24,-30],[-9,-22],[7,-22],[23,-31],[23,3],[13,16],[0,19],[-13,15]],p.skin,2);
      this.shape([[-20,-24],[-12,-19],[-19,-11]],p.shade,1.2);this.shape([[19,-24],[12,-18],[20,-12]],p.shade,1.2);
      this.shape([[-18,8],[-6,5],[0,9],[7,5],[19,8],[11,16],[-9,16]],'#f7d9cb',1,'#f7d9cb');
      this.line([[-23,-7],[23,-7]],p.accent,6);
      for(const xx of [-10,11]){this.circle(xx,-7,11.5,'#e9ca8b',INK,1.5);this.eye(xx,-7,8.7,1.3,xx>0?.2:0);this.line([[xx-6,-12],[xx-2,-15]],'#fff7df',1.8);}
      this.rect(-3,-10,7,3,1,p.accent,INK);this.shape([[-2,4],[4,4],[1,7]],p.accent,1);
      this.line([[-6,10],[-2,12],[1,9],[5,12],[9,10]],INK,1.4);
      for(const side of [-1,1]){this.circle(side*16,7,3.2,p.shade);this.line([[side*18,5],[side*29,2]],INK,1.1);this.line([[side*19,10],[side*29,13]],INK,1.1);}
      this.line([[14,-25],[18,-22],[14,-20]],'#f4dcc9',2);
    }else if(p.kind==='robot'){
      this.line([[-6,-25],[-8,-35],[2,-35],[6,-39]],INK,2);this.circle(8,-40,4,p.accent,INK,1.3);
      this.rect(-29,-12,9,22,3,p.accent,INK);this.rect(21,-10,7,16,2,p.suit,INK);
      this.shape([[-21,-19],[-13,-26],[17,-26],[23,-18],[23,11],[13,18],[-13,18],[-22,10]],p.skin,2);
      this.shape([[-19,5],[17,5],[21,-3],[21,11],[12,16],[-13,16],[-20,9]],p.shade,1,p.shade);
      this.rect(-18,-17,37,21,5,'#344d54',INK);
      this.circle(-8,-7,7.5,'#c1ddbb',INK,1.2);this.circle(-7,-7,3,'#385853');this.circle(-5,-9,1.5,'#fff2c9');
      this.rect(5,-14,10,13,2,'#efc87e',INK);this.line([[6,-4],[10,-9],[13,-7]],'#8d5340',1.5);
      this.rect(-10,7,20,7,2,'#685c4e');for(let i=0;i<4;i++)this.line([[-7+i*4,8],[-7+i*4,12]],'#efd1a0',1.2);
      for(const [xx,yy] of [[-15,-21],[16,-21],[-16,10],[16,10]]){this.circle(xx,yy,2.2,'#f3dbac',INK,1);this.line([[xx-1,yy],[xx+1,yy]],p.accent,1);}
      this.line([[-14,-28],[12,-28]],'#dfcfae',2);
    }else{
      this.shape([[-22,-4],[-17,-24],[1,-32],[21,-24],[9,-20],[6,-12],[11,-4],[26,0],[17,14],[1,21],[-16,13]],p.skin,2);
      this.shape([[-18,5],[-2,15],[15,12],[2,20],[-15,13]],p.shade,1,p.shade);
      this.eye(-5,-3,12.5,2.4,.4);this.line([[-13,-20],[-3,-22],[4,-17]],p.accent,2.3);
      this.line([[-5,14],[3,15],[10,11]],INK,1.6);this.circle(-17,7,2,p.accent);
      this.circle(17,-29+Math.sin(t*1.4)*1.2,3,p.accent,INK,1);
      this.circle(24,-18+Math.sin(t*1.4+.8)*1.2,1.7,'#f4e1a4');
      this.star(0,-26,3.4,p.accent);
    }
    c.restore();
  }
  driverTorso(x,y,scale=1,index=this.g.save.character||0) {
    const c=this.ctx,p=CHARACTERS[index]||CHARACTERS[0],flutter=Math.sin(this.g.time*3.2+index)*2;
    c.save();c.translate(x,y);c.scale(scale,scale);
    if(p.kind==='alien'){
      this.shape([[-12,-15],[12,-15],[24,18],[4,15],[-20,19]],p.suit,2);
      this.shape([[-12,-15],[-3,-7],[13,-15],[5,4],[-5,8]],'#9480b3',1.3);
      this.line([[-12,-11],[0,-1],[13,-12]],p.accent,2);this.circle(0,-1,3,p.accent,INK,1);
      for(const [xx,yy] of [[-9,6],[11,8],[-2,12]])this.star(xx,yy,2.4,'#e5d4a8');
      this.line([[-16,14],[3,11],[18,15]],'#aea3d2',1.4);
    }else if(p.kind==='robot'){
      this.line([[-8,-18],[7,-18],[-6,-15],[7,-12]],'#ae8256',2.3);
      this.shape([[-15,-12],[12,-13],[16,14],[-14,16],[-19,4]],p.suit,2);
      this.rect(-10,-7,21,16,3,'#365963',INK);this.circle(-1,1,6,'#e5cc89',INK,1);
      this.line([[-3,3],[0,-2],[3,0]],p.accent,1.4);this.rect(-9,12,17,4,1,p.accent,INK);
      this.circle(-15,-7,3,p.skin,INK,1);this.circle(12,-8,3,p.skin,INK,1);
    }else if(p.kind==='cat'){
      this.shape([[-14,-14],[12,-14],[19,-5],[16,15],[-17,15],[-20,-4]],p.suit,2);
      this.shape([[-15,-13],[-4,-7],[1,-15],[8,-7],[15,-13]],'#ead9af',1.4);
      this.line([[1,-7],[1,12]],p.accent,2);this.line([[-17,13],[16,13]],p.accent,4);
      this.rect(-13,0,9,8,2,'#92cbc0',INK);this.circle(10,2,4,'#ebc678',INK,1);this.line([[7,2],[12,2]],p.accent,1);
      this.line([[14,-10],[27,-6+flutter],[30,-12+flutter]],p.accent,5);
    }else{
      this.shape([[-13,-13],[13,-13],[17,15],[-16,15]],p.suit,2);
      this.shape([[-10,-12],[-2,-3],[0,14],[-13,14]],'#bb703b',1,'#bb703b');
      this.line([[-12,-12],[13,9]],'#e4ce9b',4);this.rect(7,6,15,13,3,p.accent,INK);
      this.line([[10,10],[19,10]],'#b7cfb9',1.6);this.circle(-5,4,2.5,'#efd197',INK,1);
      this.shape([[-12,-15],[10,-15],[22,-10+flutter],[28,-17+flutter],[30,-8+flutter],[11,-8],[-10,-9]],p.accent,1.4);
    }
    c.restore();
  }
  characterPortrait(x,y,scale,index) {
    const c=this.ctx,p=CHARACTERS[index];c.save();c.translate(x,y);c.scale(scale,scale);
    this.line([[-8,23],[-11,44]],p.kind==='robot'?p.shade:INK,6);this.line([[9,22],[16,43]],p.kind==='robot'?p.shade:INK,6);
    this.rect(-23,41,16,8,3,p.accent,INK);this.rect(13,39,17,8,3,p.accent,INK);
    if(p.kind==='cat'){this.line([[-12,16],[-32,21],[-41,8],[-35,-4]],p.shade,7);this.line([[-34,17],[-39,10]],p.accent,4);}
    if(p.kind==='robot')for(const xx of [-11,16])this.circle(xx,32,4,p.skin,INK,1);
    this.line([[-13,0],[-25,12],[-20,21]],INK,3.5);this.circle(-20,21,4,p.skin,INK);
    this.line([[13,0],[25,5],[30,-8]],INK,3.5);this.circle(30,-8,4,p.skin,INK);
    this.driverTorso(0,9,1,index);this.driverHead(0,-24,1,index);
    if(p.kind==='goblin'){this.rect(25,-17,10,8,1,'#e7dbb7',INK);this.line([[27,-15],[32,-12],[34,-15]],p.accent,1);}
    if(p.kind==='alien'){this.circle(31,-20,6,p.accent,INK,1.5);this.circle(34,-23,5,p.suit);}
    c.restore();
  }
  charactersPortrait() {
    const g=this.g,h=this.h,selected=g.previewCharacter??g.save.character,p=CHARACTERS[selected];
    const top=Math.max(128,g.platform.safe.top+112)+(g.platform.native?40:0);
    this.icon('person',58,top+23,43,INK);
    this.text('驾驶员',94,top,40,INK);
    const y=top+102,cardH=Math.min(380,(h-y-233)/2),gap=18;
    CHARACTERS.forEach((spec,i)=>{
      const x=35+(i%2)*337,yy=y+Math.floor(i/2)*(cardH+gap),active=selected===i,owned=g.save.ownedCharacters.includes(i);
      this.panel(x,yy,313,cardH,spec.back);
      if(active)this.rect(x+3,yy+3,307,cardH-6,18,null,'#819c55');
      this.circle(x+157,yy+cardH*.4,cardH*.25,spec.halo);
      this.text(spec.tag,x+292,yy+16,22,spec.ink||spec.accent,400,'right');
      this.line([[x+51,yy+cardH*.43],[x+65,yy+cardH*.43]],spec.accent,1.5);this.circle(x+259,yy+cardH*.34,4,spec.accent);
      this.characterPortrait(x+156,yy+cardH*.43,Math.min(2.05,cardH/165),i);
      if(!owned)this.text(spec.price,x+165,yy+cardH-32,21,'#526b55',400,'center');
      this.icon(g.save.character===i?'check':owned?'person':'coin',x+(owned?156:114),yy+cardH-21,23,'#78914e');
      this.hit('character:'+i,x,yy,313,cardH);
    });
    const bottom=y+cardH*2+gap+20,owned=g.save.ownedCharacters.includes(selected),equipped=g.save.character===selected;
    this.iconButton('equipCharacter',35,bottom+40,650,68,equipped?'check':owned?'person':'coin',!equipped,owned?'':String(p.price));
  }
  car(x,y,angle,scale=1,index=0,spin=0,compression=[],build=null,showRider=true) {
    const c=this.ctx,g=this.g,t=g.time,v=VEHICLES[index],parked=!['playing','paused','result'].includes(g.screen);
    if(g.visualPack?.ready&&!parked&&showRider&&index===6)return this.visualPackCar(x,y,angle,scale,index,spin,compression,build);
    if(['unicycle','skateboard','scooter'].includes(v.kind))return this.personalVehicle(x,y,angle,scale,index,spin,compression,build||previewBuild(g.save,index),showRider);
    if(v.kind)return this.specialVehicle(x,y,angle,scale,index,spin,compression,build||previewBuild(g.save,index),showRider);
    const excited=(!parked&&g.input.gas&&g.car?.vx>260)||g.honkUntil>t;
    c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);
    build=build||previewBuild(g.save,index);const mods=build?.mods||{},stats=vehicleStats(build,index),look=vehicleAppearance(build);
    if(mods.tank==='reserve')this.rect(-73,-59,24,33,4,'#d9a65b',INK);
    if(mods.suspension==='acrobat')this.shape([[-53,-20],[-84,-38],[-77,-15]],'#72d2ce',2);
    if(mods.engine==='torque')this.line([[-53,-24],[-57,-49],[-68,-49]],'#d77659',7);
    this.line([[-stats.wheelbase-18,9],[stats.wheelbase+13,9]],INK,7);
    for(const [i,xx] of [-stats.wheelbase,stats.wheelbase].entries()){
      const wheelY=14-(compression[i]||0)*.35;
      this.line([[xx,-9-look.bodyLift],[xx-5,-3],[xx+5,3],[xx-5,8],[xx,wheelY]],look.suspension?'#e7ae57':INK,2+look.suspension*.16);
      if(look.suspension){this.line([[xx-10,-14-look.bodyLift],[xx-7,wheelY-3]],'#243d3a',6);this.line([[xx-10,-13-look.bodyLift],[xx-8,3]],'#78cfc2',3+look.suspension*.14);this.circle(xx-10,-14-look.bodyLift,3,'#ebd99d',INK,1);}
      c.save();c.translate(xx,wheelY);c.rotate(spin);
      c.scale(stats.wheelRadius/22,stats.wheelRadius/22);
      this.circle(0,0,23,'#38333f',INK,2.5);this.circle(0,0,13,mods.tires==='mud'?'#91bc4b':mods.tires==='road'?'#77cfcb':look.tires?'#dc9f57':'#c5b6a2',INK,2);
      if(look.tires)this.circle(0,0,15+look.tires*.19,null,'#e4c486',1.8);
      const tread=7+look.tires;
      for(let i=0;i<tread;i++){const a=i*Math.PI*2/tread;this.line([[Math.cos(a)*(18-look.tires*.16),Math.sin(a)*(18-look.tires*.16)],[Math.cos(a+.14)*22,Math.sin(a+.14)*22]],look.tires?'#d9d896':'#b4a491',look.treadWidth);}
      if(index===1){this.circle(0,0,9,v.dark,INK,1);for(let k=0;k<3;k++){c.save();c.rotate(k*Math.PI*2/3);this.shape([[0,0],[-3,-10],[5,-7],[7,-2]],v.trim,1);c.restore();}}
      else if(index===2){this.circle(0,0,9,v.dark,INK,1.5);for(let k=0;k<6;k++){const aa=k*Math.PI/3;this.circle(Math.cos(aa)*9,Math.sin(aa)*9,2,v.trim,INK,1);}}
      else this.line([[-8,-7],[8,7],[-7,8],[7,-8]],INK,2);
      this.circle(0,0,3,v.trim,INK,1);c.restore();
    }
    c.save();c.translate(0,Math.sin(t*7)*.7-look.bodyLift);c.scale(stats.wheelbase/39,1);if(!parked)c.scale(1+g.landingKick*.035,1-g.landingKick*.07);
    if(index===1){this.line([[-51,-26],[-51,-64],[-42,-72],[-30,-72]],v.dark,10);this.line([[-51,-58],[-51,-64],[-42,-69],[-31,-69]],v.trim,3);this.rect(-35,-77,16,12,4,v.trim,INK);this.circle(-28,-71,4,'#a1d9ce',INK,1);}
    if(index===2){this.rect(-64,-67,26,37,6,'#a86d49',INK,2);this.line([[-51,-64],[-51,-82],[-41,-82]],INK,7);this.rect(-56,-87,18,7,2,v.trim,INK);this.line([[-60,-57],[-42,-57]],v.trim,3);}
    if(look.tank){
      const yy=-28-look.tankHeight;
      this.rect(-78,yy,look.tankWidth,look.tankHeight,5,'#d79c50',INK,2);
      this.rect(-72,yy+3,6,look.tankHeight-6,2,'#f2ce7d');this.rect(-72,yy-5,11,6,2,'#435e54',INK,1);
      this.line([[-78,yy+9],[-78+look.tankWidth,yy+9]],'#665949',3);
      if(look.tankStage>=2)this.rect(-86,yy+11,8,look.tankHeight-11,2,'#bc7856',INK,1.5);
      if(look.tankStage>=3)this.line([[-82,yy-3],[-48,yy-3],[-45,-26]],'#415f57',3);
    }
    // 歪脖子长鼻司机；夸张轮廓由关节带动，不逐帧随机抖动。
    if(showRider&&(parked||!g.mechanics?.onFoot)){
    this.rect(-22,-44,12,24,4,v.dark,INK);
    this.driverTorso(-1,-40,.85);
    c.save();c.translate(-4,-56+Math.sin(t*5)*1.5);c.rotate(Math.sin(t*3)*.065);
    this.driverHead(0,0,1);c.restore();
    this.line([[4,-40],[23,-28],[34,-38]],INK,3);this.circle(35,-36,10,null,INK,2);
    }
    this.vehicleShell(index,excited);
    if(look.engine){
      this.rect(23,-39-look.intakeHeight,19+look.engine*.5,look.intakeHeight,3,'#7cafa0',INK,2);
      this.rect(19,-44-look.intakeHeight,27+look.engine*.5,9,3,'#dbd8ba',INK,2);
      for(let i=0;i<look.engineStage+1;i++)this.line([[24+i*6,-42-look.intakeHeight],[24+i*6,-37-look.intakeHeight]],'#334f49',2);
      if(look.engineStage>=2){this.circle(29,-31,9+look.engine*.2,'#ddb777',INK,2);this.circle(29,-31,4,'#567e74',INK,1);}
      if(look.engineStage>=3)this.line([[-51,-30],[-57,-58-look.engine*.7],[-66,-58-look.engine*.7]],'#486b60',6);
    }
    c.restore();
    this.advancedParts(mods,look);
    if(look.suspension)for(const [i,xx] of [-stats.wheelbase,stats.wheelbase].entries()){
      const sx=xx+(i?9:-9),top=-19-look.bodyLift,bottom=9-(compression[i]||0)*.35;
      this.line([[sx,top],[sx+(i?-8:8),bottom]],'#243c37',6);
      this.line([[sx,top+2],[sx+(i?-5:5),bottom-5]],'#7cdbc5',3+look.suspension*.08);
      const coils=[];for(let n=0;n<=6;n++)coils.push([sx+(i?-1:1)*n+(n%2?3:-3),top+6+(bottom-top-11)*n/6]);
      this.line(coils,'#e1ae58',2);this.circle(sx,top,3.5,'#eee0b4',INK,1);
    }
    const reveal=g.upgradeReveal,age=reveal?t-reveal.at:3;
    if(g.screen==='garage'&&reveal?.vehicle===index&&age>=0&&age<2.2){
      const targets={engine:[[35,-43-look.intakeHeight/2,23]],tank:[[-66,-28-look.tankHeight/2,25]],tires:[[-stats.wheelbase,14,28],[stats.wheelbase,14,28]],suspension:[[-stats.wheelbase-9,-6,21],[stats.wheelbase+9,-6,21]]};
      c.save();c.globalAlpha=Math.sin(Math.PI*age/2.2)*.8;
      for(const [xx,yy,rr] of targets[reveal.part]||[])this.circle(xx,yy,rr+age*2,null,'#f4d86e',2.3);
      c.restore();
    }
    c.restore();
  }
  visualPackCar(x,y,angle,scale,index,spin,compression,build) {
    const c=this.ctx,g=this.g,stats=vehicleStats(build||previewBuild(g.save,index),index);
    const wheelSize=Math.max(stats.wheelRadius*2,72),unit=wheelSize/108,wheelY=14-(compression[0]||0)*.35;
    c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);
    if(g.landingKick)c.scale(1+g.landingKick*.025,1-g.landingKick*.05);
    c.save();c.translate(0,wheelY);c.rotate(spin);this.drawVisual('wheel',-wheelSize/2,-wheelSize/2,wheelSize,wheelSize);c.restore();
    this.drawVisual('vehicleBody',-46*unit,wheelY-95*unit,91*unit,98*unit);
    if(!g.mechanics?.onFoot)this.drawVisual('rider',-38*unit,wheelY-205*unit,102*unit,143*unit);
    c.restore();
  }
  vehicleShell(index,excited=false) {
    const v=VEHICLES[index],t=this.g.time;
    if(index===0){
      this.shape([[-64,-33],[-33,-32],[-18,-25],[24,-28],[34,-39],[59,-36],[67,-22],[64,3],[-64,3],[-70,-12]],v.color,2.7);
      this.shape([[-63,-6],[-31,-4],[-19,-13],[20,-15],[21,2],[-65,2]],v.dark,1,v.dark);
      this.line([[-60,-29],[-36,-28],[-24,-21]],'#e5f2a2',3);this.line([[-30,-24],[-30,-4],[18,-4],[23,-23]],INK,1.5);
      this.rect(-20,-21,33,16,3,'#375748',INK);this.shape([[-11,-18],[-1,-13],[6,-17],[3,-7],[-10,-9]],v.trim,1);
      this.rect(-56,-21,15,9,1,'#e8d8a0',INK);this.line([[-53,-18],[-44,-15]],v.dark,1.5);
      const stalk=Math.sin(t*(excited?13:4))*3;
      this.line([[47,-31],[47+stalk,-47]],INK,3);this.eye(47+stalk,-51,12,2,1);
      this.shape([[30,-21],[64,-23],[64,-4],[32,-2]],INK,2);
      for(let i=0;i<4;i++)this.shape([[34+i*7,-19],[39+i*7,-20],[38+i*7,-9+(i%2)*2],[35+i*7,-9]],v.trim,1);
      if(excited)this.shape([[48,-5],[64,-5],[73,4],[64,8],[47,3]],'#c77e98',1.5);
      for(const xx of [-59,-33,20,59])this.circle(xx,-25,2,v.trim,INK,1);
      this.line([[-64,-8],[-75,-11],[-76,-23]],INK,6);
    }else if(index===1){
      this.shape([[-62,-18],[-77,-35],[-74,-10],[-78,1],[-61,-4]],v.dark,2);
      this.rect(-65,-37,132,43,21,v.color,INK);this.rect(-58,-28,113,22,11,'#85cfc2');
      this.shape([[-61,-7],[-42,1],[42,1],[61,-9],[55,6],[-55,6]],v.dark,1,v.dark);
      for(const xx of [-41,-16]){this.circle(xx,-18,11,v.trim,INK,1.5);this.circle(xx,-18,7,'#345f6a',INK,1);this.line([[xx-4,-22],[xx+2,-24]],'#b6ead9',2);}
      this.circle(48,-21,17,v.trim,INK,1.7);this.eye(48,-21,12,3.1,.8);
      this.line([[24,-31],[26,-9]],v.dark,2.2);for(let i=0;i<3;i++)this.line([[29+i*4,-29],[31+i*4,-10]],v.dark,1.7);
      this.line([[-52,-33],[29,-33]],'#e9e0b0',2);this.line([[-49,7],[50,7]],v.trim,3);
      for(const xx of [-57,11,58])this.circle(xx,-4,2,v.trim,INK,1);
    }else{
      this.shape([[-64,-29],[-29,-31],[-16,-25],[8,-31],[12,-46],[47,-46],[65,-31],[65,-6],[52,8],[-58,6],[-67,-5]],v.color,2.7);
      this.shape([[-63,-3],[-24,-1],[-11,-10],[57,-9],[50,7],[-58,5]],v.dark,1,v.dark);
      this.circle(31,-20,25,'#bd704a',INK,2);this.circle(31,-20,19,v.trim,INK,1.8);
      this.circle(31,-20,13,'#503f43',INK,1.5);
      this.shape([[23,-12],[27,-26],[32,-20],[37,-30],[40,-14]],'#e49a59',1.2,'#e49a59');this.shape([[29,-12],[33,-22],[36,-14]],'#f8d58e',1,'#f8d58e');
      for(let k=0;k<8;k++){const aa=k*Math.PI/4;this.circle(31+Math.cos(aa)*22,-20+Math.sin(aa)*22,1.6,v.trim,INK,1);}
      this.rect(-21,-25,21,23,4,'#7b594c',INK);this.circle(-10,-14,7,v.trim,INK,1);this.line([[-10,-14],[-7,-18+Math.sin(t*2)]],v.dark,1.3);
      this.line([[-57,-25],[-30,-25],[-30,-4]],v.trim,3);this.line([[-53,-17],[-53,-8]],'#f0c187',3);
      this.rect(58,-27,13,9,3,'#e7c989',INK);this.line([[60,-23],[68,-23]],'#87503f',1.6);
      this.line([[-59,8],[51,8]],v.trim,3);
    }
  }
  advancedParts(mods,look) {
    if(mods.engine==='turbo'){
      for(const xx of [13,33]){this.circle(xx,-36-look.bodyLift,10,'#ba9862',INK,2);this.circle(xx,-36-look.bodyLift,5,'#6fafa5',INK,1.5);}
      this.line([[13,-47-look.bodyLift],[13,-59-look.bodyLift],[36,-59-look.bodyLift]],'#536e66',5);
    }
    if(mods.suspension==='travel')for(const xx of [-35,35]){
      this.rect(xx,-24,8,28,3,'#ddc26a',INK);this.line([[xx+4,3],[xx+8,15]],'#79b9b5',4);
    }
    if(mods.tank==='light'){
      this.shape([[-66,-28],[-71,-47],[-48,-50],[-45,-29]],'#a4c8c7',2);
      for(let k=0;k<3;k++)this.line([[-64+k*6,-43],[-62+k*6,-34]],'#436968',2);
    }
  }
  specialVehicle(x,y,angle,scale,index,spin,compression,build,showRider=true) {
    const c=this.ctx,g=this.g,v=VEHICLES[index],s=vehicleStats(build,index),a=vehicleAppearance(build),mods=build.mods||{};
    c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);
    const bike=v.kind==='bike',trike=v.kind==='trike';
    // A tricycle has a paired rear axle: the farther wheel is visible behind it.
    const wheels=trike?[{x:-s.wheelbase+13,y:5,k:1,far:true},{x:-s.wheelbase,y:14,k:0},{x:s.wheelbase,y:14,k:2}]:[{x:-s.wheelbase,y:14,k:0},{x:s.wheelbase,y:14,k:1}];
    const wheel=w=>{
      c.save();c.translate(w.x,w.y-(compression[w.k]||0)*.35);c.rotate(spin);c.scale(s.wheelRadius/22,s.wheelRadius/22);
      this.circle(0,0,23,w.far?'#565c59':'#303d38',INK,2.5);
      this.circle(0,0,15,mods.tires==='road'?'#81c5cd':a.tires?'#e2ba70':'#c3c8b1',INK,2);
      for(let j=0;j<(bike?9:6);j++){const t=j*Math.PI*2/(bike?9:6);this.line([[0,0],[Math.cos(t)*14,Math.sin(t)*14]],'#495c50',bike?1.5:3);}
      for(let j=0;j<7+a.tires;j++){const t=j*Math.PI*2/(7+a.tires);this.line([[Math.cos(t)*19,Math.sin(t)*19],[Math.cos(t+.13)*22,Math.sin(t+.13)*22]],mods.tires==='rock'?'#f0ce91':'#b8c58e',a.treadWidth+(mods.tires==='mud'?1:0));}
      this.circle(0,0,4,'#ded89e',INK,1);c.restore();
    };
    if(trike)wheel(wheels[0]);
    c.save();c.translate(0,-a.bodyLift);
    if(bike){
      this.line([[-s.wheelbase,14],[-14,-27],[17,-18],[-s.wheelbase,14],[2,10],[-14,-27]],INK,6);
      this.line([[17,-18],[s.wheelbase,14]],'#84bdb3',8);this.line([[24,-19],[s.wheelbase+5,13]],INK,3);
      this.shape([[-19,-31],[2,-38],[21,-29],[13,-16],[-17,-19]],v.color,2.5);
      this.shape([[-17,-23],[-3,-19],[16,-25],[12,-16],[-15,-18]],v.dark,1,v.dark);
      this.circle(10,-36,8,v.color,INK,1.5);this.circle(23,-32,7,v.color,INK,1.5);
      this.eye(11,-36,4.8,1.4,.8);this.eye(23,-32,4.3,1.4,.8);
      this.line([[2,-24],[12,-25],[18,-22]],v.trim,2.3);
      this.rect(-30,-37,29,7,3,'#344f46',INK);this.line([[17,-20],[13,-50],[29,-52]],INK,4);
      this.line([[-46,-11],[-36,-24],[-22,-24]],v.color,6);this.line([[25,-11],[38,-15],[47,-7]],v.color,5);
      this.line([[-40,-18],[-24,-8],[-16,4]],v.trim,3);this.rect(27,-25,6,22,2,v.trim,INK);
      this.line([[15,-17],[10,-5],[19,7],[6,9]],v.dark,5);
    }else if(trike){
      this.shape([[-68,-3],[-68,-14],[-24,-14],[-17,-4],[29,-8],[41,-30],[54,-23],[60,5],[-64,6]],v.color,2.7);
      for(let j=0;j<3;j++){
        const xx=-66+j*15,yy=-48-(j%2)*6;this.rect(xx,yy,14,36,5,j===1?v.trim:v.color,INK);
        this.rect(xx-1,yy-3,16,5,2,v.dark,INK);this.line([[xx+3,yy+7],[xx+3,yy+29]],'#eedec0',1.7);
        this.rect(xx+3,yy+15,8,9,2,j===1?v.dark:v.trim,INK);this.line([[xx+5,yy+17],[xx+9,yy+21]],v.dark,1.3);
      }
      this.line([[-70,-11],[-23,-11]],v.trim,4);this.line([[-68,-32],[-23,-32]],'#735473',2.5);
      this.rect(-15,-28,29,8,3,'#324f48',INK);this.line([[27,-3],[25,-47],[40,-49]],INK,4);
      this.rect(33,-34,17,12,5,v.trim,INK);this.eye(42,-28,5.2,2.1,.7);
      this.line([[31,-11],[53,-5]],v.dark,3);this.circle(23,-6,3,v.trim,INK,1);
    }else{
      this.shape([[-67,3],[-62,-19],[-26,-24],[-8,-43],[14,-39],[33,-20],[68,-8],[76,2],[58,9],[-62,9]],v.color,2.7);
      this.shape([[-25,-23],[-8,-39],[11,-35],[27,-20]],'#466976',2);
      if(showRider&&(!g.mechanics?.onFoot||!['playing','paused','result'].includes(g.screen)))this.driverHead(0,-28,.34);
      this.line([[-16,-30],[-10,-34],[7,-30]],'#aed9d2',2);this.line([[-66,1],[60,4]],v.dark,5);
      this.shape([[-64,-17],[-66,-33],[-78,-40],[-34,-39],[-27,-34],[-56,-32]],v.dark,2);
      this.line([[-72,-38],[-38,-37]],v.trim,2.3);
      this.shape([[27,-17],[41,-12],[74,0],[37,-4]],v.trim,1.3);
      this.shape([[44,-11],[61,-7],[58,-2],[43,-4]],'#843842',1.2);this.line([[47,-7],[58,-5]],'#f6b4a3',2);
      this.line([[-13,-18],[4,-14],[24,-12]],v.trim,3);this.shape([[-46,-15],[-27,-19],[-38,-6]],v.dark,1.3);
      for(let j=0;j<3;j++)this.line([[17+j*7,-10],[13+j*7,-3]],v.dark,2);
      this.circle(-24,-8,4,v.trim,INK,1);this.line([[-26,-9],[-22,-7]],v.dark,1.5);
    }
    // Motorcycle/tricycle riders sit on the frame, rather than in a car shell.
    if(showRider&&(bike||trike)&&(!g.mechanics?.onFoot||g.screen==='garage'||g.screen==='home'||g.screen==='campaign')){
      this.driverTorso(-5,-47,.92);
      this.line([[-10,-33],[6,-18],[-2,-1],[9,-1]],INK,4);this.line([[-4,-52],[14,-39],[26,-48]],INK,3);
      this.driverHead(-10,-73,.85);
    }
    // Each level changes geometry; milestone levels add fins, reservoirs and piping.
    this.rect(-16,-17,25+a.engine*.45,19,4,'#607d70',INK);
    for(let j=0;j<3+a.engineStage;j++)this.line([[-12,-13+j*3],[6+a.engine*.45,-13+j*3]],'#bfd0b3',1.5);
    if(a.engine){this.line([[-14,-6],[-44,-9],[-48,-19-a.engine*.65]],'#4c655c',5);this.rect(-52,-23-a.engine*.65,12,6,2,'#d6cfaf',INK);}
    if(a.engineStage>=2){this.circle(16,-13,8+a.engine*.25,'#c4a767',INK,2);this.circle(16,-13,4,'#476960');}
    if(a.tank){
      const tx=trike?-58:-42,ty=bike?-42:-31;
      this.rect(tx,ty-a.tankHeight*.46,a.tankWidth*.74,a.tankHeight*.66,4,mods.tank==='light'?'#9fc6c0':'#c7a56b',INK);
      this.line([[tx+5,ty-a.tankHeight*.46],[tx+5,ty+a.tankHeight*.2]],'#e8cd91',3);
      if(a.tankStage>=3)this.line([[tx+4,ty-18],[tx-7,ty-18],[tx-7,-8]],'#536d62',3);
    }
    if(mods.tank==='reserve')this.rect(-73,-31,14,25,3,'#deb766',INK);
    if(mods.suspension==='acrobat')this.shape([[-30,-18],[-67,-38],[-58,-9]],'#79c8b9',2);
    if(mods.engine==='torque')this.circle(0,-7,11,'#dbaa69',INK,2);
    this.advancedParts(mods,a);c.restore();
    for(const w of wheels.filter(w=>!w.far)){
      this.line([[w.x*.73,-16-a.bodyLift],[w.x,w.y]],INK,5);
      if(a.suspension){
        this.line([[w.x*.73,-17-a.bodyLift],[w.x,w.y-4]],'#84c6b5',3+a.suspension*.06);
        const pts=[];for(let j=0;j<8;j++)pts.push([w.x*.73+(w.x-w.x*.73)*j/7+(j%2?3:-3),-12-a.bodyLift+(23+a.bodyLift)*j/7]);
        this.line(pts,'#ebc065',2);
      }
      wheel(w);
    }
    const reveal=g.upgradeReveal,age=reveal?g.time-reveal.at:3;
    if(g.screen==='garage'&&reveal?.vehicle===index&&age>=0&&age<2.2){
      const pos={engine:[0,-15,25],tank:[-43,-40,26],tires:[s.wheelbase,14,s.wheelRadius+6],suspension:[s.wheelbase*.8,0,25]}[reveal.part];
      if(pos){c.save();c.globalAlpha=Math.sin(age/2.2*Math.PI);this.circle(...pos,null,'#f1cf6a',3);c.restore();}
    }
    c.restore();
  }
  personalVehicle(x,y,angle,scale,index,spin,compression,build,showRider=true) {
    const c=this.ctx,g=this.g,v=VEHICLES[index],s=vehicleStats(build,index),a=vehicleAppearance(build),mods=build.mods||{};
    const mono=v.kind==='unicycle',board=v.kind==='skateboard',parked=!['playing','paused','result'].includes(g.screen),rider=showRider&&(parked||!g.mechanics?.onFoot);
    c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);
    const wheel=(xx,k,far=false)=>{
      c.save();c.translate(xx+(far?6:0),14-(compression[k]||0)*.35-(far?4:0));c.rotate(spin);c.scale(s.wheelRadius/22,s.wheelRadius/22);
      this.circle(0,0,22,far?'#667c6c':'#31473d',INK,2.3);this.circle(0,0,15,mods.tires==='mud'?'#9fc67b':a.tires?'#e3bb74':v.color,INK,1.8);
      for(let i=0;i<8+a.tires;i++){const t=i*Math.PI*2/(8+a.tires);this.line([[Math.cos(t)*18,Math.sin(t)*18],[Math.cos(t+.12)*22,Math.sin(t+.12)*22]],'#d9d4a8',a.treadWidth);}
      for(let i=0;i<6;i++){const t=i*Math.PI/3;this.line([[0,0],[Math.cos(t)*12,Math.sin(t)*12]],v.dark,2);}
      this.circle(0,0,5,'#efe6bb',INK,1);c.restore();
    };
    if(board){wheel(-s.wheelbase,1,true);wheel(s.wheelbase,3,true);}
    c.save();c.translate(0,-a.bodyLift);
    if(mono){
      this.shape([[-28,-8],[-26,-22],[-12,-29],[12,-29],[28,-19],[29,-9],[21,-16],[-18,-16]],v.color,2);
      this.line([[-20,-22],[-8,-26],[10,-26],[21,-20]],v.trim,2.5);
      this.line([[-12,14],[-12,-32],[0,-48],[12,-32],[12,14]],v.dark,6);
      this.line([[0,-45],[0,-58]],INK,6);this.rect(-22,-61,44,10,5,v.color,INK,2.3);
      this.rect(-21,-62,42,5,2,v.trim,INK);this.circle(0,-37,5,v.trim,INK,1);this.line([[-3,-37],[3,-37]],v.dark,1.3);
      this.line([[-22,14],[22,14]],'#b89963',4);
      // Actual pedalling animation follows wheel travel, not a separate looping motor.
      const px=Math.cos(spin)*19,py=14+Math.sin(spin)*19;
      this.line([[0,14],[px,py]],INK,4);this.line([[px-6,py],[px+7,py]],'#e6c886',4);
      if(rider){
        this.driverTorso(0,-71,.85);
        this.line([[-8,-55],[-24,-24],[px,py]],INK,4);this.line([[9,-55],[24,-19],[-px,28-py]],INK,4);
        this.line([[-12,-74],[-35,-60],[-48,-70]],INK,3);this.line([[11,-75],[31,-59],[44,-66]],INK,3);
        this.driverHead(-2,-96,.72);
      }
    }else{
      this.shape([[-62,-12],[-48,-4],[43,-4],[61,-16],[67,-12],[52,3],[-49,3],[-67,-7]],board?v.trim:v.color,2.5);
      this.line([[-44,-1],[45,-1]],v.dark,3);
      if(board){
        this.shape([[-54,-11],[-42,-9],[38,-9],[56,-17],[60,-12],[45,-4],[24,-3],[15,-8],[3,-4],[-17,-7],[-40,-5]],v.color,1.5);
        for(const [xx,yy] of [[-36,-9],[-10,-9],[15,-8],[36,-9]])this.circle(xx,yy,2.1,'#f3c4c5');
        this.rect(-8,-10,16,4,1,v.dark,INK);this.line([[-45,4],[-35,4]],'#bb8855',2);
        this.shape([[-57,-4],[-69,-16],[-77,-14],[-67,-2]],v.color,1.5);
      }else{
        this.line([[s.wheelbase,14],[32,-25],[25,-80]],INK,8);this.line([[32,-23],[26,-78]],v.color,6);
        for(let n=0;n<4;n++)this.circle(27+n,-66+n*12,2.5,v.dark);
        this.shape([[24,-79],[18,-85],[20,-94],[25,-90],[33,-96],[34,-85],[50,-85],[53,-77],[37,-75]],v.color,2);
        this.eye(36,-83,4.5,2.3,.8);this.circle(49,-79,1.7,v.dark);this.line([[40,-75],[49,-75]],v.dark,1.3);
        this.line([[25,-80],[44,-83]],v.dark,4);this.line([[-31,-8],[26,-8]],v.trim,2.5);
        this.shape([[-58,-7],[-67,-15],[-72,-8],[-62,-2]],v.dark,1.5);
      }
      if(rider){
        const lean=parked?0:Math.sin(g.time*7)*1.4;
        this.driverTorso(0,-54,.86);
        this.line([[-8,-43],[-24,-25],[-31,-12],[-20,-12]],INK,4);this.line([[8,-43],[20,-29],[24,-12],[36,-12]],INK,4);
        this.line([[-8,-59],[-29,-48],[-42,-53]],INK,3);
        this.line([[10,-60],[26,-48],board?[45,-57]:[35,-80]],INK,3);
        this.driverHead(lean,-81,.78);
      }
    }
    // Compact drive and reservoir modules preserve all four upgrade systems.
    const ex=mono?-29:-16,ey=mono?-29:2;
    this.rect(ex,ey,22+a.engine*.45,10+a.engine*.23,3,'#638d80',INK,1.6);
    for(let i=0;i<2+a.engineStage;i++)this.line([[ex+4+i*5,ey+3],[ex+4+i*5,ey+8+a.engine*.23]],'#d7dcad',1.2);
    if(a.tank){const tx=mono?19:-57,ty=mono?-48:-25;this.rect(tx,ty-a.tankHeight*.28,a.tankWidth*.63,a.tankHeight*.62,4,'#d8b372',INK,1.8);this.line([[tx+5,ty-a.tankHeight*.25],[tx+5,ty+a.tankHeight*.25]],'#f3deb0',2.5);}
    if(mods.engine==='torque')this.circle(ex+10,ey+6,7,'#dbba78',INK,1.5);
    if(mods.tank==='reserve')this.rect(mono?34:-70,-24,12,22,3,'#dcb96b',INK);
    if(mods.suspension==='acrobat')this.shape([[-23,-14],[-54,-32],[-45,-9]],'#87cbbd',2);
    this.advancedParts(mods,a);c.restore();
    for(const [i,xx] of (mono?[0]:[-s.wheelbase,s.wheelbase]).entries()){
      const k=board?i*2:i;
      this.line([[xx,mono?-26-a.bodyLift:0-a.bodyLift],[xx,14]],v.dark,4);
      if(a.suspension){this.line([[xx-6,-8-a.bodyLift],[xx-6,11]],'#91cab8',3+a.suspension*.06);const pts=[];for(let n=0;n<7;n++)pts.push([xx+(n%2?4:-4),-7-a.bodyLift+n*(19+a.bodyLift)/6]);this.line(pts,'#e7bd73',2);}
      wheel(xx,k);
    }
    if(mono)this.eye(0,14-(compression[0]||0)*.35,s.wheelRadius*.55,4.1,.6);
    const age=g.upgradeReveal?g.time-g.upgradeReveal.at:3;
    if(g.screen==='garage'&&g.upgradeReveal?.vehicle===index&&age>=0&&age<2.2){c.save();c.globalAlpha=Math.sin(age/2.2*Math.PI);const pos={engine:[ex+12,ey+6,22],tank:[mono?30:-48,-27,24],tires:[mono?0:s.wheelbase,14,s.wheelRadius+7],suspension:[mono?0:s.wheelbase,0,23]}[g.upgradeReveal.part];if(pos)this.circle(...pos,null,'#efcf70',2.5);c.restore();}
    c.restore();
  }
  bunny(x,y,scale=1,cheer=false) {
    const c=this.ctx,t=this.g.time;c.save();c.translate(x,y-(cheer?Math.abs(Math.sin(t*4))*6:0));c.scale(scale,scale);
    this.line([[-15,-5],[-24,3],[-10,3]],INK,3);this.line([[15,-5],[25,3],[11,3]],INK,3);
    this.shape([[-26,-7],[-25,-48],[-34,-75],[-20,-70],[-12,-88],[-5,-57],[12,-64],[29,-82],[26,-46],[32,-8],[10,-1],[-7,-7]],'#c4cd79',2.5);
    this.eye(0,-41,20,1);this.shape([[-14,-17],[18,-21],[8,-5],[-7,-7]],INK,1.5);
    this.shape([[-8,-17],[-2,-17],[-2,-10]],'#f4e9d0',1);this.shape([[6,-19],[13,-20],[8,-12]],'#f4e9d0',1);
    this.line([[28,-32],[43,-42+Math.sin(t*7)*6],[40,-55]],INK,3);c.restore();
  }
  stars(x,y,count,size=15,gap=43) {
    for(let i=0;i<3;i++)this.star(x+i*gap,y,size,i<count?'#c2cf5c':'#b8aeb9');
  }
  savingsGoal(x,y,w) {
    const g=this.g,v=VEHICLES[g.save.goalVehicle],owned=g.save.owned.includes(g.save.goalVehicle);
    this.icon(owned?'check':'car',x+13,y+12,24,'#526657');this.text(v.name,x+37,y,22,'#526657');
    if(!owned){this.icon('coin',x+w-171,y+12,21);this.text(g.save.coins+' / '+v.price,x+w,y,21,'#526657',400,'right');}
    this.rect(x,y+33,w,4,2,'#ccd6c5');this.rect(x,y+33,w*(owned?1:Math.min(1,g.save.coins/v.price)),4,2,'#84944a');
  }
  upgradeCard(x,y,w,h,u) {
    const g=this.g,info=upgradePreview(u.id,previewBuild(g.save,g.previewVehicle),g.previewVehicle),roomy=h>=300;
    const focused=g.garageFocus?.part===u.id||(g.upgradeReveal?.vehicle===g.previewVehicle&&g.upgradeReveal.part===u.id&&g.time-g.upgradeReveal.at<2.2),fill=focused?'#e8f3c8':'#eef1dc';
    this.panel(x,y,w,h,fill);this.rect(x,y,w,h,18,null,focused?'#91a84d':'#b8c5aa');
    this.circle(x+35,y+34,22,focused?'#c5e96f':'#dbe4c6');this.icon(u.icon,x+35,y+34,25,'#526657');this.text(u.name,x+66,y+17,27,INK);
    this.rect(x+w-76,y+17,54,30,15,'#d8e1ca');this.text(info.level+'/'+MAX_LEVEL,x+w-49,y+23,17,'#526657',500,'center');
    this.rect(x+66,y+53,w-88,5,3,'#d2d9c5');this.rect(x+66,y+53,(w-88)*info.level/MAX_LEVEL,5,3,'#91ad54');
    const icons={engine:['engine','speed'],tires:['wheel','mountain'],suspension:['shield','spring'],tank:['fuel','clock']};
    info.rows.slice(0,h<205?1:2).forEach(([label,a,b,unit],i)=>{
      const yy=y+(roomy?76:65)+i*(roomy?64:34);
      if(roomy)this.rect(x+17,yy-5,w-34,54,12,i===0?'#e1e8d2':'#e7ebd9');
      this.icon(icons[u.id][i],x+35,yy+18,21,'#526657');this.text(label,x+54,yy-1,roomy?17:15,'#66745e');
      this.text(a+' → '+b+unit,x+w-24,yy+9,roomy?25:21,INK,500,'right');
    });
    const bh=roomy?50:36,mod=selectedSpecialization(upgradesFor(g.save,g.previewVehicle),u.id),gate=upgradeGate(g.save,info.level),owned=g.save.owned.includes(g.previewVehicle);
    const available=SPECIALIZATIONS[u.id].filter(m=>!specializationGate(g.save,g.previewVehicle,u.id,m));
    this.iconButton('branch:'+u.id,x+17,y+h-bh-55,w-34,32,'swap',false,mod?mod.name:available.length?'可选专精 '+available.length:'专精待解锁');
    this.iconButton('test:'+u.id,x+17,y+h-bh-15,104,bh,'play',false,'试车');
    this.iconButton('upgrade:'+u.id,x+133,y+h-bh-15,w-150,bh,!owned||gate?'lock':'coin',!gate&&owned,info.level>=MAX_LEVEL?'MAX':!owned||gate?gate||'未拥有':String(upgradeCost(info.level)));
  }
  branchScreen() {
    const g=this.g,id=g.branchPart,part=UPGRADES.find(u=>u.id===id);if(!part)return;
    const build=upgradesFor(g.save,g.previewVehicle),selected=selectedSpecialization(build,id),hh=Math.min(860,this.h-60),{x,y}=this.overlay(690,hh);
    this.icon(part.icon,x+47,y+45,38);
    this.iconButton('close',x+612,y+17,55,55,'close');
    const options=[null,...SPECIALIZATIONS[id]],ch=(hh-162)/options.length;
    const icons={drive:'engine',maxSpeed:'speed',burn:'drop',grip:'wheel',softGrip:'mountain',damping:'shield',angularDamping:'swap',airControl:'air',fuel:'fuel',wheelRadius:'wheel',spring:'spring',impactAbsorb:'shield'};
    options.forEach((mod,i)=>{
      const yy=y+94+i*(ch+10),active=mod?selected?.id===mod.id:!selected,gate=specializationGate(g.save,g.previewVehicle,id,mod);
      this.panel(x+24,yy,642,ch,active?'#cbed9b':'#f0efdf');
      this.hit('mod:'+id+':'+(mod?mod.id:'stock'),x+24,yy,642,ch);
      if(mod)this.text(mod.name,x+43,yy+18,27,INK);else this.icon('car',x+66,yy+34,30,INK);
      if(mod){
        this.iconButton('modInfo:'+id+':'+mod.id,x+597,yy+10,50,42,'info');
        Object.entries(mod.effects).forEach(([key,value],n)=>{
          const xx=x+43+(n%3)*176,cy=yy+62+Math.floor(n/3)*36,good=key==='burn'?value<1:value>1;
          this.metric(icons[key],(value>1?'+':'')+Math.round((value-1)*100)+'%',xx,cy,good?'#366044':'#975547');
        });
      }else {this.icon('check',x+68,yy+82,36,'#64836e');}
      if(gate&&mod){this.icon('lock',x+54,yy+ch-25,22,'#975547');this.icon(part.icon,x+92,yy+ch-25,22,'#975547');this.text(mod.level,x+112,yy+ch-36,19,'#975547');this.icon('flag',x+166,yy+ch-25,22,'#975547');this.text(mod.stage+1,x+187,yy+ch-36,19,'#975547');}
      this.rect(x+591,yy+ch-54,56,42,12,!gate&&!active?'#b6f04b':'#e2edcf');
      this.icon(active?'check':gate?'lock':'plus',x+619,yy+ch-33,24);
    });
    const stats=vehicleStats(build,g.previewVehicle);this.metric('speed',Math.round(stats.maxSpeed*.36)+' km/h',x+140,y+hh-29);this.metric('clock',Math.round(stats.fuel/stats.burn)+'s',x+411,y+hh-29);
  }
  modInfoScreen() {
    const g=this.g,{part,id}=g.modInfo||{},mod=SPECIALIZATIONS[part]?.find(m=>m.id===id);if(!mod)return;
    const {x,y}=this.overlay(660,380),gate=specializationGate(g.save,g.previewVehicle,part,mod);
    this.text(mod.name,x+34,y+31,32);this.iconButton('branch:'+part,x+580,y+20,54,50,'back');
    this.text(mod.plus,x+34,y+112,24,'#366044');this.text(mod.minus,x+34,y+166,23,'#975547');
    this.text(gate||'已解锁 · 免费换装',x+34,y+242,23,'#526657');
    this.text('每项只能选一种 · 随时恢复标准',x+34,y+308,21,'#526657');
  }
  garage() {
    if(this.portrait)return this.garagePortrait();
    const g=this.g,h=this.h;this.rect(0,110,1440,h-110,0,'#a9c5b4');this.text('车库',64,146,44,INK);this.savingsGoal(255,162,670);
    const y=226,ch=h-y-85,carScale=Math.min(1.75,1.2+(ch-230)/210),v=VEHICLES[g.previewVehicle],active=g.save.vehicle===g.previewVehicle;
    this.panel(55,y,546,ch,'#dce5d3');this.circle(358,y+ch*.43,116,'#c7d6c7');this.line([[82,y+ch*.66],[570,y+ch*.66]],'#90a98d',5);
    this.rect(82,y+20,active?106:82,29,15,active?'#b7e968':'#d2dcc9');this.text(active?'当前驾驶':'车辆预览',active?135:123,y+25,16,'#42594d',500,'center');
    this.text(v.name,84,y+62,34,INK);this.wrap(v.desc,84,y+105,175,20,'#526657');this.car(382,y+ch*.56,-.025,carScale,g.previewVehicle,0);
    this.vehicleMetrics(85,y+ch-185,162);
    this.iconButton('workshopInfo',530,y+16,48,42,'info');
    this.fleetPicker(77,y+ch-144,505,76);
    const owned=g.save.owned.includes(g.previewVehicle);this.button('equip',77,y+ch-65,320,40,g.save.vehicle===g.previewVehicle?'已选':owned?'选择':VEHICLES[g.previewVehicle].price+' 购车',true);if(!owned)this.button('pinVehicle',412,y+ch-65,170,40,'存车钱',false);
    const rh=(ch-18)/2;UPGRADES.forEach((u,i)=>this.upgradeCard(630+i%2*397,y+Math.floor(i/2)*(rh+18),375,rh,u));
    this.text(g.garageFocus?'本关建议 · '+UPGRADES.find(u=>u.id===g.garageFocus.part).name:'购车继承各部件最高等级 · 专精独立选择',64,h-55,22,'#365747');
    this.button('start',1090,h-60,280,40,'开始游戏',true,'play');
  }
  campaignLayout() {
    const g=this.g,w=g.platform.width,h=g.platform.height,s=g.platform.safe||{};
    const left=Math.max(26,(s.left||0)+12),right=Math.max(26,(s.right||0)+12);
    const top=Math.max(150,this.headerY()+118),bottom=h-Math.max(226,(s.bottom||0)+204);
    const mapRight=w-right,x0=left+52,x1=mapRight-52,center=(x0+x1)/2,gap=176;
    this.progressSummary();
    const maxDepth=Math.min(stageDepth(99999),Math.max(4,g.mapSummary.frontier+2));
    const span=(bottom-top-136)/gap,maxScroll=Math.max(0,maxDepth-span);
    const scroll=clamp(g.campaignScroll??Math.max(0,stageDepth(g.save.route)-span*.45),0,maxScroll);
    g.campaignScroll=scroll;
    const page=Math.max(0,Math.floor(scroll)-2),rows=Math.ceil((bottom-top)/gap)+5,nodes=[];
    // 单条蜿蜒路线，位置锚定关卡编号，没有分支或跨关连线。
    const bends=[.47,.66,.39,.18,.45,.77,.58,.28];
    for(let depth=page;depth<=Math.min(maxDepth,page+rows);depth++){
      for(const i of depthStages(depth)){
        const nx=bends[i%bends.length];
        nodes.push({i,depth,row:depth-page,col:0,x:x0+(x1-x0)*nx,y:bottom-78-(depth-scroll)*gap});
      }
    }
    const visible=nodes.filter(n=>n.y>=top+48&&n.y<=bottom-44);
    return {left,right,top,bottom,mapRight,x0,x1,center,gap,scroll,maxScroll,maxDepth,page,rows,nodes,visible};
  }
  campaignConnections(m) {
    const g=this.g,coords=new Map(m.nodes.map(n=>[n.i,n])),edges=[];
    for(const n of m.nodes){
      const parents=stageParents(n.i).map(i=>coords.get(i)).filter(Boolean);
      parents.sort((a,b)=>Number(!!g.save.firstClears[b.i])-Number(!!g.save.firstClears[a.i])||Math.abs(n.x-a.x)-Math.abs(n.x-b.x));
      for(let j=0;j<parents.length;j++){
        const a=parents[j],related=n.i===g.save.route||a.i===g.save.route;
        if(j===0||related)edges.push({a,b:n,secondary:j>0,lit:!!g.save.firstClears[a.i],related});
      }
    }
    return edges;
  }
  campaignStars(x,y,count) {
    for(let j=0;j<3;j++){
      const cx=x+(j-1)*24,points=[];
      for(let k=0;k<10;k++){
        const a=-Math.PI/2+k*Math.PI/5,r=k%2?4.8:10.5;
        points.push([cx+Math.cos(a)*r,y+Math.sin(a)*r]);
      }
      this.shape(points,j<count?'#f3c65e':'#d8d4bc',1.1,j<count?'#896a35':'#8d9a7f');
    }
  }
  campaignBackdrop() {
    this.ctx.fillStyle='#9fc7bd';this.ctx.fillRect(0,0,this.w,this.h);
  }
  campaignButton(action,x,y,w,h,label,primary=false) {this.button(action,x,y,w,h,label,primary);}
  campaignHeader() {
    const g=this.g,s=g.platform.safe,left=Math.max(32,(s.left||0)+16);
    const right=Math.max(32,(s.right||0)+16),y=this.headerY();
    this.icon('back',left+18,y+23,25,INK);
    this.hit('home',left-10,y-5,56,56);
    const x=this.w-right-166;
    this.icon('coin',x+23,y+23,23);this.text(g.save.coins,x+44,y+9,23,INK);
    this.icon(g.save.sound?'sound':'mute',this.w-right-5,y+23,25,INK);this.hit('sound',this.w-right-31,y-3,52,52);
  }
  mapIsland(x,y,w,h,seed,fill,outline) {
    const c=this.ctx,points=[];
    for(let i=0;i<24;i++){
      const a=i*Math.PI/12,r=1+Math.sin(i*2.7+seed)*.075;
      points.push([x+Math.cos(a)*w*.5*r,y+Math.sin(a)*h*.5*r]);
    }
    c.beginPath();c.moveTo(...points[0]);
    for(let i=1;i<=24;i++){const a=points[i%24],b=points[(i+1)%24];c.quadraticCurveTo(...a,(a[0]+b[0])/2,(a[1]+b[1])/2);}
    c.closePath();c.fillStyle=fill;c.fill();
    if(outline){c.strokeStyle=outline;c.lineWidth=2;c.stroke();}
  }
  mapLandmark(x,y,kind,scale=1) {
    const c=this.ctx;c.save();c.translate(x,y);c.scale(scale,scale);
    // Static illustrated landmarks: no waving vegetation or time-dependent layout.
    c.fillStyle='rgba(43,66,51,.12)';c.beginPath();c.ellipse(0,8,61,18,0,0,Math.PI*2);c.fill();
    if(kind==='forest'){
      for(const [xx,yy,ss] of [[-35,-10,.65],[29,-24,.82],[0,12,1]]){
        c.save();c.translate(xx,yy);c.scale(ss,ss);
        this.shape([[-9,0],[-7,-55],[-20,-68],[-16,-76],[0,-62],[16,-81],[23,-73],[9,-53],[11,0]],'#9a8661',2,'#3f5843');
        this.shape([[-43,-65],[-49,-93],[-29,-111],[-15,-104],[0,-132],[20,-112],[25,-97],[44,-99],[49,-72],[29,-59],[5,-65],[-22,-55]],'#8faf6e',2.2,'#3f5843');
        this.line([[-31,-88],[-13,-83],[-4,-92]],'#c9d497',3);
        this.circle(-13,-81,9,'#f3e8c8','#3f5843',2);this.circle(10,-86,7,'#f3e8c8','#3f5843',2);
        this.circle(-11,-80,3,INK);this.circle(12,-85,3,INK);c.restore();
      }
    }else if(kind==='mushroom'){
      for(const [xx,yy,ss] of [[40,6,.65],[-29,17,.7],[0,-8,1]]){
        c.save();c.translate(xx,yy);c.scale(ss,ss);
        this.shape([[-9,0],[-6,-61],[10,-65],[18,0]],'#efe4c3',2,'#635a60');
        this.shape([[-50,-57],[-39,-89],[-9,-108],[22,-99],[48,-73],[51,-56],[9,-47]],'#b88a93',2.5,'#635a60');
        this.circle(-14,-78,9,'#ebcdb4');this.circle(17,-81,6,'#ebcdb4');this.line([[-29,-57],[30,-57]],'#735b65',2);c.restore();
      }
    }else if(kind==='fossil'){
      this.shape([[-58,10],[-50,-42],[-20,-79],[24,-80],[56,-55],[62,-9],[36,13]],'#e4d5b0',3,'#655f51');
      this.shape([[-38,-28],[-21,-46],[-4,-33],[-11,-12],[-31,-10]],'#746f60',2,'#655f51');
      this.shape([[16,-39],[35,-48],[48,-27],[35,-12],[18,-15]],'#746f60',2,'#655f51');
      this.shape([[1,-10],[11,-10],[7,1]],'#746f60',1);
      for(let i=0;i<4;i++)this.line([[-27+i*20,11],[-25+i*20,24]],'#655f51',3);
      this.line([[-78,16],[-70,-8],[-77,-38]],'#dfcea8',9);
    }else if(kind==='clockwork'){
      this.shape([[-37,10],[-30,-103],[27,-103],[36,10]],'#7f9993',3,'#435951');
      this.shape([[-39,-104],[-27,-127],[23,-127],[38,-104]],'#b78966',2,'#435951');
      this.circle(0,-85,25,'#eee2b6','#435951',3);this.line([[0,-101],[0,-85],[12,-79]],'#435951',3);
      this.rect(-11,-36,22,46,8,'#425f55');
      for(const xx of [-25,27]){this.circle(xx,-13,14,'#bfa873','#435951',2);this.circle(xx,-13,5,'#435951');}
    }else{
      this.shape([[-49,10],[-56,-50],[-31,-84],[-13,-40],[-12,10]],'#a3c3c6',2,'#596b81');
      this.shape([[-12,10],[-18,-97],[11,-134],[39,-86],[27,10]],'#c0d8d1',2,'#596b81');
      this.line([[11,-129],[6,7]],'#f1ecd9',3);this.shape([[26,11],[35,-40],[55,-69],[68,-30],[59,11]],'#93acbf',2,'#596b81');
    }
    c.restore();
  }
  campaignScenery(m) {
    const c=this.ctx,w=this.w,base=m.bottom-78+m.scroll*m.gap;
    const themes=[
      {name:'瞪眼荒野',land:'#d9dcba',patch:'#bec99d',kind:'forest'},
      {name:'蘑菇秘境',land:'#ded1bf',patch:'#c7b1b7',kind:'mushroom'},
      {name:'白骨回声',land:'#dfd1ac',patch:'#c5b58f',kind:'fossil'},
      {name:'发条山谷',land:'#cdd3bb',patch:'#a5bbb0',kind:'clockwork'},
      {name:'晶簇迷途',land:'#d2d3d3',patch:'#b2bfce',kind:'crystal'}
    ];
    const chunk=4*m.gap,props=[],signs=[];
    const start=Math.max(0,Math.floor((base-m.bottom-200)/chunk)),end=Math.ceil((base-m.top+400)/chunk);
    for(let region=start;region<=end;region++){
      const theme=themes[region%themes.length],cy=base-region*chunk-230;
      // Contoured land masses overlap into a continuous, illustrated scroll.
      this.mapIsland(w*.51,cy+17,w*1.06,chunk+230,region,'#719e91');
      this.mapIsland(w*.5,cy,w*1.04,chunk+230,region,theme.land,'#75947c');
      this.mapIsland(w*.49,cy,w*.92,chunk+170,region,theme.land,'rgba(116,140,99,.24)');
      for(let j=0;j<5;j++){
        const xx=w*[.12,.86,.18,.81,.51][j],yy=cy-230+j*122;
        this.mapIsland(xx,yy,150+j%2*42,94,region+j,theme.patch);
        // Keep the illustrated objects clear of route badges.
        const choices=[{x:xx,y:yy+35},{x:xx-26,y:yy+65},{x:xx+28,y:yy-15}];
        const site=choices.find(p=>p.y>=m.top-140&&p.y<=m.bottom+140&&m.nodes.every(n=>Math.abs(n.x-p.x)>58||n.y<p.y-103||n.y>p.y+22));
        if(site)props.push({x:site.x,y:site.y,kind:theme.kind,scale:j===2?.9:.75});
      }
      // River ribbons and reed banks at the edge give regions a geographic boundary.
      const ry=cy-290;
      c.beginPath();c.moveTo(-20,ry+35);c.bezierCurveTo(w*.22,ry-36,w*.49,ry+70,w+20,ry-10);
      c.strokeStyle='#7fa99e';c.lineWidth=31;c.stroke();c.strokeStyle='#afd1c1';c.lineWidth=22;c.stroke();
      for(let k=0;k<7;k++){
        const xx=38+k*101,yy=cy+210+Math.sin(k*2+region)*31;
        if(m.nodes.some(n=>Math.hypot(n.x-xx,n.y-yy)<72))continue;
        this.line([[xx-5,yy+3],[xx-7,yy-5],[xx,yy+2],[xx+5,yy-7]],'#8a9b72',2);
      }
      // Small in-world chapter sign, not a fixed navigation strip.
      const sy=cy+chunk*.43;
      if(sy>m.top+25&&sy<m.bottom-30&&m.nodes.every(n=>Math.abs(n.y-sy)>43||Math.abs(n.x-w*.5)>125)){
        signs.push({name:theme.name,y:sy});
      }
    }
    // Paint landmarks after all overlapping land masses, so adjacent regions
    // cannot erase a forest or mushroom stand at their shared boundary.
    for(const prop of props)this.mapLandmark(prop.x,prop.y,prop.kind,prop.scale);
    for(const sign of signs){
      this.rect(w*.5-101,sign.y-15,202,35,12,'#f0e6c7');
      this.text(sign.name,w*.5,sign.y-8,22,'#677655',400,'center');
    }
    return themes;
  }
  campaign() {
    const g=this.g,h=this.h,c=this.ctx,m=this.campaignLayout(),{left,right,top,bottom,nodes}=m;
    this.campaignBackdrop();
    c.save();c.beginPath();c.rect(0,top-20,this.w,bottom-top+34);c.clip();
    this.campaignScenery(m);
    const curve=(a,b,color,width,dashed=false)=>{
      c.beginPath();c.moveTo(a.x,a.y);
      const bend=(a.y+b.y)/2,dx=b.x-a.x;
      c.bezierCurveTo(a.x+dx*.12+22,bend,b.x-dx*.12-22,bend,b.x,b.y);
      c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.setLineDash(dashed?[3,10]:[]);c.stroke();c.setLineDash([]);
    };
    for(const {a,b,lit,secondary,related} of this.campaignConnections(m)){
      if(secondary){curve(a,b,lit?'#7c8c60':'#a0aa94',3,true);continue;}
      curve(a,b,lit?'#6f8059':'#a6b098',17);
      curve(a,b,lit?'#f1e4b8':'#cdd0b7',12);
      curve(a,b,lit?(related?'#bd995a':'#b4ab7d'):'#aab39f',1.8,true);
    }
    for(const {i,x,y} of nodes){
      if(y<top-45||y>bottom+45)continue;
      const unlocked=stageUnlocked(g.save,i,g.mapSummary.frontier),clear=unlocked&&!!g.save.firstClears[i],selected=g.save.route===i;
      const size=selected?31:26;
      c.save();if(!unlocked)c.globalAlpha=.67;
      c.fillStyle='rgba(46,63,44,.2)';c.beginPath();c.ellipse(x,y+14,size+5,18,0,0,Math.PI*2);c.fill();
      const points=[[x,y-size],[x+size*.94,y-size*.48],[x+size*.85,y+size*.5],[x,y+size],[x-size*.85,y+size*.5],[x-size*.94,y-size*.48]];
      this.shape(points,selected?'#f2cf7e':clear?'#b2d37f':unlocked?'#f3ecd5':'#c1c4ad',2.4,unlocked?'#3c5741':'#7f8f77');
      const inner=points.map(([xx,yy])=>[x+(xx-x)*.78,y+(yy-y)*.78]);
      this.line(inner,selected?'#fff1c7':clear?'#d9e9ad':'#e7e6cf',2,true);
      const numberSize=Math.max(17,27-Math.max(0,String(i+1).length-2)*3);
      if(unlocked)this.text(i+1,x,y-numberSize/2,numberSize,INK,400,'center');
      else{this.icon('lock',x,y,21,'#71816b');this.text(i+1,x,y+35,17,'#71816b',400,'center');}
      if(clear)this.icon('check',x,y+size+16,19,'#537747');
      if(selected){
        this.line([[x+28,y-18],[x+28,y-68]],INK,3);
        this.shape([[x+29,y-67],[x+65,y-59],[x+29,y-47]],'#dc8e64',2);
        this.car(x-27,y-45,-.1,.34,g.save.vehicle,0);
      }
      c.restore();
      if(y>=top+48&&y<=bottom-44)this.hit('route:'+i,x-43,y-42,86,84);
    }
    for(const [a,b] of [[top-20,top+12],[bottom+14,bottom-16]]){
      const fade=c.createLinearGradient(0,a,0,b);fade.addColorStop(0,'#9fc7bd');fade.addColorStop(1,'rgba(159,199,189,0)');
      c.fillStyle=fade;c.fillRect(0,Math.min(a,b),this.w,Math.abs(a-b));
    }
    c.restore();
    this.text('关卡地图',left,top-68,32,INK,500);
    this.text('已通关 '+g.mapSummary.frontier+' 关 · 解锁至第 '+(g.mapSummary.frontier+1)+' 关',left,top-25,20,'#486759');
    this.textAction('records',this.w-right-132,top-39,132,47,'记录','clock');
    const selected=getRoute(g.save.route),safeBottom=g.platform.safe.bottom||0,fy=h-Math.max(212,safeBottom+190),fw=this.w-left-right;
    // 底部是贴边的信息栏，不再叠一个浮动的大卡片。
    this.rect(0,fy-15,this.w,h-fy+15,0,'#f1ecd7');this.line([[left,fy-15],[this.w-right,fy-15]],'#c5cfb5',1);
    const record=this.routeRecord();
    this.text(this.routeTitle(),left+4,fy+2,Math.min(28,570/this.routeTitle().length),INK,500);
    this.text((record.clear?'已通关 · ':'最远 ')+record.best+' / '+selected.goal+'m',left+4,fy+45,21,'#486759');
    this.text(record.percent+'%',this.w-right-8,fy+45,21,'#486759',500,'right');
    this.rect(left+4,fy+76,fw-8,4,2,'#d7ddc5');
    if(record.percent)this.rect(left+4,fy+76,(fw-8)*record.percent/100,4,2,'#809e53');
    this.icon('info',this.w-right-23,fy+18,23,'#596f5b');this.hit('routeInfo:'+g.save.route,this.w-right-46,fy-5,46,46);
    this.campaignButton('garage',left+4,fy+84,145,76,'车库');
    this.campaignButton('start',left+165,fy+84,fw-169,76,record.clear?'再玩一次':'出发',true);
  }
  routeInfoScreen() {
    const g=this.g,r=getRoute(g.infoRoute);if(!r)return;const {x,y}=this.overlay(650,510);
    this.text(this.routeTitle(g.infoRoute),x+33,y+30,Math.min(30,535/this.routeTitle(g.infoRoute).length));this.iconButton('close',x+574,y+20,52,52,'close');
    this.icon('flag',x+51,y+115,30);this.text('开到 '+r.goal+'m 即可过关',x+83,y+99,25);
    this.wrap(r.spec.expedition?'无补给 '+Math.round(r.spec.expedition.gap/10)+'m · '+(r.spec.expedition.climb?'长坡考验扭矩，坡后滑行省油':'储油决定能否到达下一站')+'；大补给固定加 90 格':r.spec.hint,x+33,y+151,580,22,'#526657');
    const record=this.routeRecord(g.infoRoute),last=(g.save.attemptHistory||[]).slice().reverse().find(a=>a.route===g.infoRoute);
    this.line([[x+33,y+226],[x+617,y+226]],'#bac8ab',1);
    this.text('最远 '+record.best+' / '+r.goal+'m',x+33,y+247,23,INK);
    this.text(record.percent+'%',x+614,y+247,23,'#526657',400,'right');
    this.rect(x+33,y+288,584,5,2,'#cbd5bc');if(record.percent)this.rect(x+33,y+288,584*record.percent/100,5,2,'#7b9853');
    this.text(record.clear?'已通关 · 最快 '+(record.time?record.time.toFixed(1)+' 秒':'暂无计时'):'未通关 · 到站解锁下一关',x+33,y+317,23,'#365747');
    this.wrap(last?'最近一趟 '+last.distance+'m · '+last.time.toFixed(1)+' 秒 · '+last.reason:'还没有本关驾驶记录',x+33,y+368,584,21,'#526657');
    this.text('首通 +'+r.firstReward+' · 每次到站 +'+r.masteryReward,x+33,y+456,20,'#526657');
  }
  recordsScreen() {
    const g=this.g,w=this.w,h=this.h,frontier=this.progressSummary().frontier,top=this.headerY()+91;
    this.rect(0,0,w,h,0,'#eee9d6');
    this.text('已通关 '+frontier+' 关',36,top,34,INK,500);
    this.text('当前解锁至第 '+(frontier+1)+' 关 · 记录自动保存',36,top+49,21,'#526657');
    const maxPage=Math.floor(frontier/6),page=clamp(g.recordsPage||0,0,maxPage),rowH=clamp((h-top-252)/6,74,145),start=page*6;
    for(let j=0;j<6&&start+j<=frontier;j++){
      const index=start+j,record=this.routeRecord(index),y=top+109+j*rowH;
      this.text(this.routeTitle(index),36,y,Math.min(25,490/this.routeTitle(index).length),INK,500);
      this.text(record.clear?'已通关':record.best?'未通关':'待挑战',w-36,y+2,20,record.clear?'#52753b':'#867558',400,'right');
      this.text('最远 '+record.best+' / '+record.goal+'m',36,y+38,20,'#526657');
      this.text(record.time?'最快 '+record.time.toFixed(1)+'s':record.percent+'%',w-36,y+38,20,'#526657',400,'right');
      this.rect(36,y+72,w-72,3,1,'#d0d6bd');if(record.percent)this.rect(36,y+72,(w-72)*record.percent/100,3,1,'#8baa60');
      this.hit('routeInfo:'+index,26,y-7,w-52,rowH-9);
    }
    const bottom=h-Math.max(80,(g.platform.safe.bottom||0)+62);
    if(page>0)this.textAction('recordsPage:'+(page-1),36,bottom-38,140,48,'上一页','back');
    if(page<maxPage)this.textAction('recordsPage:'+(page+1),w-176,bottom-38,140,48,'下一页','arrow');
    this.text((page+1)+' / '+(maxPage+1),w/2,bottom-22,20,'#526657',400,'center');
    this.text('累计行驶 '+Math.floor(g.save.lifetimeDistance||0)+'m · 共 '+g.save.runs+' 趟',w/2,h-Math.max(37,(g.platform.safe.bottom||0)+24),20,'#526657',400,'center');
  }
  workshopInfoScreen() {
    const g=this.g,v=VEHICLES[g.previewVehicle],build=previewBuild(g.save,g.previewVehicle),{x,y}=this.overlay(660,500);
    this.text(v.name+' · 改装方向',x+30,y+28,31);this.iconButton('close',x+585,y+18,50,50,'close');
    this.wrap(v.desc,x+30,y+98,600,23,'#365747');
    this.wrap(g.garageFocus?g.garageFocus.detail:'各车有不同长处。先选要挑战的关卡，再选部件和专精。',x+30,y+158,600,22);
    this.text('购车继承各部件已拥有的最高等级',x+30,y+258,23);
    this.text('动力 '+build.engine+' / 轮胎 '+build.tires+' / 悬挂 '+build.suspension+' / 油箱 '+build.tank,x+30,y+305,22,'#365747');
    this.wrap('继承不收费，之后各车独立升级。专精免费切换，有收益也有代价；点升级卡播放按钮可对比试车。',x+30,y+364,600,21,'#526657');
  }
  rewardInfoScreen() {
    const r=this.g.result,{x,y}=this.overlay(620,540);this.text('这一趟的收获',x+30,y+28,32);this.iconButton('close',x+544,y+18,50,50,'close');
    this.text('常规收入 · 可重复获得',x+30,y+100,25,'#365747');
    this.text('金币与技巧 '+(r.coins+r.bonus)+' / 里程 '+r.distanceReward,x+30,y+144,23);
    this.text('到站 '+r.goalReward+' / 完成奖励 '+r.completionReward,x+30,y+186,23);
    this.text('首次奖励 · 每项只领取一次',x+30,y+255,25,'#76617e');
    this.text('首通 '+r.firstReward,x+30,y+302,22);
    this.text('章节 '+r.chapterReward+' / 生涯里程 '+r.milestoneReward,x+30,y+344,23);
    this.wrap('开到指定距离，每次都有到站和完成奖励。首通、章节和生涯里程奖励只领取一次。金币收集和驾驶技巧不影响通关。',x+30,y+421,550,21,'#526657');
  }
  adventureWorld() {
    const g=this.g,m=g.mechanics,c=this.ctx;if(!m)return;
    if(m.flowTime>0){for(let i=0;i<7;i++){const d=(g.time*240+i*48)%310;this.line([[g.car.x-55-d,g.car.y-30+i*9],[g.car.x-86-d,g.car.y-30+i*9]],'#d7e589',3);}}
    if(!m.fogEnabled)return;
    const edge=m.fogX-g.camera.x;
    if(edge>-160){
      const x=m.fogX,top=g.camera.y;c.globalAlpha=.88;
      this.rect(g.camera.x-200,top-60,Math.max(0,edge+200),this.h+120,0,'#736578');
      for(let i=0;i<10;i++){const y=top+i*this.h/9;this.circle(x-30+Math.sin(g.time*2+i)*22,y,65+Math.sin(i)*17,'#736578');}
      c.globalAlpha=1;const yy=g.car.y-60;
      this.circle(x-40,yy,22,'#e6dfad',INK,2);this.circle(x-33,yy,8,INK);this.circle(x-70,yy-47,13,'#e6dfad',INK,2);this.circle(x-66,yy-46,5,INK);
    }
  }
  branchWorld(from,to) {
    const g=this.g,c=this.ctx,r=g.routeSpec();
    for(const b of g.terrain.verticalBranches||[]){
      if(b.end<from||b.decision>to)continue;
      const a=Math.max(b.decision,from),end=Math.min(b.end,to),cuts=[a,end];
      if(b.upperGap&&b.upperGap.end>a&&b.upperGap.x<end)cuts.push(Math.max(a,b.upperGap.x),Math.min(end,b.upperGap.end));cuts.sort((x,y)=>x-y);
      for(let i=0;i<cuts.length-1;i++){
        const start=cuts[i],finish=cuts[i+1];if(finish-start<2||b.upperGap&&(start+finish)/2>=b.upperGap.x&&(start+finish)/2<b.upperGap.end)continue;
        const pts=[];for(let x=start;x<finish;x+=12)pts.push([x,g.terrain.branchHeight(x,b)]);pts.push([finish,g.terrain.branchHeight(finish,b)]);
        const under=pts.slice().reverse().map(([x,y])=>[x,y+22]);
        this.line([...pts,...under],this.visualPattern('rock')||r.earth,1,true,true);this.line(pts.map(([x,y])=>[x,y-4]),g.visualPack?.ready?'#c5ee38':'#d9ef68',10);this.line(pts,INK,2);
      }
      for(let x=Math.ceil(a/280)*280;x<end-120;x+=280){if(b.upperGap&&x>=b.upperGap.x-35&&x<=b.upperGap.end+35)continue;const top=g.terrain.branchHeight(x,b)+21,bottom=g.terrain.height(x)-3;if(bottom-top>24){this.line([[x,top],[x,bottom]],'#8f806f',5);this.line([[x-17,bottom],[x+17,bottom]],'#8f806f',4);}}
      if(b.upperGap&&b.upperGap.end>=from&&b.upperGap.x<=to){
        for(const edge of [b.upperGap.x,b.upperGap.end]){const yy=g.terrain.branchHeight(edge,b);this.line([[edge,yy],[edge+(edge===b.upperGap.x?-8:8),yy+27]],INK,3);}
        const sx=b.upperGap.x-105,sy=g.terrain.branchHeight(sx,b);this.roadSign(sx,sy,'前方断口','','gap');
      }
      const sx=b.x-65;
      if(sx>=from&&sx<=to){
        this.visualPackSign(sx,g.terrain.height(sx),'上路 · 金币','下路 · 补给');
      }
      c.globalAlpha=1;
    }
  }
  drivingNotice(x,y,anchorX=null) {
    const g=this.g,c=g.car,m=g.mechanics;if(!m)return;
    // Only one contextual message at a time; a rescue countdown takes priority.
    if(c.crashTime>0||c.rollRisk>.38){this.balanceHint(x,y,24);return;}
    let notice=null;
    const fog=m.fogEnabled&&m.fogDelay<=0&&m.fogGap<55;
    if(fog&&m.fogGap<30)notice={icon:'fog',text:'怪雾逼近 · '+Math.max(0,Math.ceil(m.fogGap))+'m',color:'#a24d61'};
    else if(g.refueling)notice={icon:'fuel',text:({pumping:'正在加油 · 保持双踏板',brake:'按住双踏板加油',full:'油箱已满',empty:'本站已空'})[g.refueling.state]||'加油站',color:'#426638'};
    else if(fog)notice={icon:'fog',text:'怪雾逼近 · '+Math.ceil(m.fogGap)+'m',color:'#a24d61'};
    else if(c.fuel/c.fuelMax<.2){
      const end=START_X+g.goal*10;
      const next=fuelStops(g.terrain,c.x-115,end).find(s=>(!g.collected.has(s.id)||s.station&&g.stationRemaining(s)>.01)&&s.x>=c.x-115);
      const branch=(g.terrain.verticalBranches||[]).map(b=>({x:(b.decision+b.end)/2,id:'bf'+b.id})).find(b=>b.x>=c.x&&!g.collected.has(b.id)&&c.branchChoice!=='upper');
      const stop=branch&&(!next||branch.x<next.x)?branch:next;
      notice={icon:'fuel',text:'油量不足 · '+(stop?'补给 '+Math.max(0,Math.ceil((stop.x-c.x)/10))+'m':'松油滑行省油'),color:'#a75f48'};
    }else notice=this.roadNotice();
    if(!notice&&g.pop&&g.pop.until>g.time){
      const text=g.pop.text;
      // Button presses already animate their controls; do not repeat those actions.
      if(!/主动跳跃|晃了一下/.test(text))notice={icon:/稳落/.test(text)?'check':/油/.test(text)?'fuel':/跳/.test(text)?'air':'bolt',text,color:'#526657'};
    }
    if(!notice)return;
    let size=g.visualPack?.ready?(anchorX==null?26:23):23;
    this.ctx.font='600 '+size+'px '+(g.platform.fontUI||FONT);
    let width=this.ctx.measureText(notice.text).width;
    const maxText=anchorX==null?500:440;
    if(g.visualPack?.ready&&width>maxText){size=Math.max(18,size*maxText/width);this.ctx.font='600 '+size+'px '+(g.platform.fontUI||FONT);width=this.ctx.measureText(notice.text).width;}
    if(g.visualPack?.ready){
      const following=anchorX!=null,panelW=Math.min(548,width+68),cx=following?clamp(x,panelW/2+12,this.w-panelW/2-12):x;
      const bg='rgba(26,51,57,.86)',fg='#fff8e9',accent=notice.color==='#a24d61'?'#ef9a8a':'#cce690';
      const panelH=size+19;
      this.ctx.save();this.ctx.shadowColor='rgba(16,32,40,.22)';this.ctx.shadowBlur=7;this.ctx.shadowOffsetY=3;
      this.rect(cx-panelW/2,y-7,panelW,panelH,13,bg);this.ctx.restore();
      this.rect(cx-panelW/2+7,y+2,3,panelH-18,1,accent);
      this.icon(notice.icon,cx-panelW/2+29,y+size*.5+2,Math.min(25,size+1),accent);
      this.text(notice.text,cx+16,y,size,fg,700,'center');
    }else{
      this.icon(notice.icon,x-width/2-19,y+12,24,notice.color);
      this.text(notice.text,x+17,y,23,notice.color,500,'center');
    }
  }
  world() {
    const g=this.g,c=this.ctx,h=this.h,r=g.routeSpec(),camera=g.camera,t=g.time,z=g.viewZoom();
    this.background(true);
    // A tiny wheel-speed road pulse adds texture without moving the HUD or
    // obscuring the road. It only appears at fast, grounded cruising speed.
    const rumble=g.car.contacts?clamp((Math.abs(g.car.vx)-210)/310,0,1):0;
    const impact=g.mechanics?.impact||0;
    c.save();c.scale(z,z);c.translate(-camera.x+Math.sin(t*24)*rumble*1.15+Math.sin(t*57)*impact*11,-camera.y+g.landingKick*1.2+Math.sin(t*31)*rumble*.65+Math.cos(t*49)*impact*5);
    const from=Math.floor((camera.x-150)/195)*195,to=camera.x+this.w/z+150;
    // 视觉包使用与关卡节奏绑定的固定道具；普通主题保留原有生物群落网格。
    if(this.illustratedEnvironment())this.visualPackScenery(camera.x-150,to);
    else if(!this.paintedSceneActive)for(let x=Math.floor((camera.x-150-g.save.route*41)/340)*340+g.save.route*41;x<to;x+=340){
      const variation=hash(x+g.save.route*73),scale=.67+variation*.65;
      if(g.terrain.gapAt(x+30))continue;
      if(g.terrain.roadFeatures.some(f=>x+30>f.x-100&&x+30<f.end+100))continue;
      if(g.terrain.ruggedSections.some(f=>x+30>f.x-160&&x+30<f.end+100))continue;
      // 固定清空互动区域的装饰，避免随车辆移动出现消失闪烁。
      if(Math.abs((g.mechanics.looseStone?.x??-9999)-x)<300||Math.abs((g.mechanics.gum?.x??-9999)-x)<350||g.terrain.experiments.some(e=>Math.abs(e.x-x-30)<230)||g.terrain.verticalBranches.some(b=>x>b.x-300&&x<b.end))continue;
      if(r.scene!=='wild')this.sceneProp(x+30,g.terrain.height(x+30),scale,r.scene);
      else if(g.worldRoute()===1)this.cactus(x+30,g.terrain.height(x+30),scale);
      else this.tree(x+30,g.terrain.height(x+30),scale,variation>.5?'#8fa06b':'#a1b17e',g.worldRoute()===2);
    }
    const left=camera.x-20,right=camera.x+this.w/z+30,cuts=[left,right];
    for(const f of g.terrain.roadFeatures)if(f.kind==='gap'&&f.end>left&&f.x<right){cuts.push(Math.max(left,f.x),Math.min(right,f.end));}
    cuts.sort((a,b)=>a-b);
    for(const f of g.terrain.roadFeatures)if(f.kind==='gap'&&f.end>left&&f.x<right){
      this.line([[f.x,g.terrain.height(f.x)],[f.x-4,g.terrain.height(f.x)+35]],INK,3);
      this.line([[f.end,g.terrain.height(f.end)],[f.end+5,g.terrain.height(f.end)+35]],INK,3);
    }
    for(let i=0;i<cuts.length-1;i++){
      const a=cuts[i],b=cuts[i+1];if(b-a<1||g.terrain.gapAt((a+b)/2))continue;
      const pts=[];for(let x=a;x<b;x+=12)pts.push([x,g.terrain.height(x)]);pts.push([b,g.terrain.height(b)]);
      // The visual pack uses a real cliff face beneath the exact collision
      // line. Standard themes keep the original suspended strip. Gaps remain
      // omitted by the segment cuts above, so this never creates hidden floor.
      if(this.illustratedEnvironment()){
        const floor=camera.y+h/z+90;
        this.line([...pts,[b,floor],[a,floor]],this.visualPattern('rock')||r.earth,1,true,true);
      }else if(this.paintedSceneActive){
        const underside=pts.map(([x,y])=>[x,y+58+12*Math.sin(x*.019)+7*Math.sin(x*.047)]);
        this.themedRoadSegment(pts,a,b,underside,this.roadMaterial(r),r);
      }else{
        const underside=pts.map(([x,y])=>[x,y+58+12*Math.sin(x*.019)+7*Math.sin(x*.047)]);
        this.line([...pts,...underside.slice().reverse()],r.earth,1,true,true);
        this.line(underside,'rgba(35,40,48,.3)',2);
        const vein=pts.map(([x,y])=>[x,y+23+4*Math.sin(x*.031)]);
        this.line(vein,'rgba(245,225,190,.22)',3);
        for(let x=Math.ceil(a/95)*95;x<b-12;x+=95){
          const y=g.terrain.height(x)+38;
          this.line([[x-9,y],[x,y-4],[x+11,y+2]],'rgba(35,40,48,.24)',2);
          if(hash(x)>.5)this.line([[x,y+24],[x+6,y+48],[x-4,y+64]],r.earth,4);
        }
      }
      if(!this.paintedSceneActive){
        this.line(pts.map(p=>[p[0],p[1]-4]),this.illustratedEnvironment()?'#c5ee38':r.grass,11);
        this.line(pts,INK,2);
      }
    }
    for(let x=Math.floor(camera.x/130)*130;x<to;x+=130){
      if(g.terrain.gapAt(x))continue;
      const z=hash(x),yy=g.terrain.height(x)-5;
      if(z>.7&&g.save.route!==2)this.flower(x,yy,.6,Math.floor(x));
    }
    this.branchWorld(camera.x-120,to);this.roadMechanisms(camera.x-80,to);this.labWorld(camera.x-160,to);
    for(const station of fuelStops(g.terrain,camera.x+510,to+550).filter(s=>s.station)){
      const xx=station.x-550;if(g.terrain.gapAt(xx))continue;const yy=g.terrain.height(xx);
      this.roadSign(xx,yy,'前方补给','','fuel');
    }
    for(const item of collectibles(camera.x-40,to,g.terrain)){
      if(g.collected.has(item.id)&&!item.station)continue;
      const bob=item.station?0:Math.sin(t*3.2+item.x*.02)*4;
      c.save();c.translate(item.x,item.y+bob);
      if(item.type==='coin'){
        if(g.visualPack?.ready){const size=item.trail==='risk'?39:35;c.scale(.62+Math.abs(Math.cos(t*2+item.x*.01))*.38,1);this.drawVisual('coin',-size/2,-size/2,size,size);}
        else{c.scale(.6+Math.abs(Math.cos(t*2+item.x*.01))*.4,1);this.circle(0,0,item.trail==='risk'?14:12,'#eec666',item.trail==='risk'?'#c96752':'#aa893b',item.trail==='risk'?2.5:1.7);this.circle(0,0,item.trail==='risk'?10:8.5,null,'#fff2b6',1.2);this.star(0,0,5,'#fff0b9');}
      }else{
        if(item.station){
          const stock=g.stationRemaining(item),capacity=item.fuelUnits-item.quickFuel,active=g.refueling?.station.id===item.id&&g.refueling.state==='pumping';
          const strip=[];for(let dx=-115;dx<=115;dx+=23)strip.push([dx,g.terrain.height(item.x+dx)-item.y-3]);
          this.line(strip,active?'#9ccc8c':'#b2c69b',8);
          // Keep the dispenser ahead of the stopped car, not hidden behind its
          // body. The painted bay remains the actual interaction zone.
          c.save();c.translate(88,0);
          this.line([[-24,49],[25,49]],'#657e64',6);
          this.rect(-28,-46,56,81,9,stock>0?'#e5ecd1':'#a6b3a0',INK);
          this.rect(-20,-37,40,20,4,active?'#c5ec9c':'#a9c5b4');this.text(Math.ceil(stock),0,-35,18,INK,400,'center');
          this.icon('fuel',0,8,32,'#6f8050');
          this.rect(-19,26,38,5,2,'#b9c7a5');this.rect(-19,26,38*stock/capacity,5,2,'#789b55');
          if(!g.collected.has(item.id)){this.rect(-57,12,22,28,4,'#d87654',INK);this.icon('fuel',-46,25,14,'#fff2cc');}
          if(active){
            const tx=g.car.x-item.x-88,ty=g.car.y-item.y-7;
            c.beginPath();c.moveTo(28,-9);c.bezierCurveTo(63,44,tx-30,ty+37,tx,ty);c.strokeStyle='#506c57';c.lineWidth=5;c.stroke();
            this.circle(tx,ty,5,'#c2ed8d',INK,1);this.icon('drop',2,-65,16,'#759b51');
          }else this.line([[28,-9],[42,2],[42,28],[30,32]],'#506c57',4);
          this.icon(stock>0?'pause':'check',0,63,21,stock>0?'#657e64':'#93a58a');
          c.restore();
        }else{
        c.rotate(Math.sin(t*2)*.06);
        if(g.visualPack?.ready)this.drawVisual('fuelCan',-21,-25,42,45);
        else{this.shape([[-15,-15],[12,-16],[16,15],[-14,17]],'#d87654',1.8);this.shape([[-8,-17],[-8,-24],[6,-24],[6,-17]],'#d87654',1.5);this.icon('fuel',0,0,20,'#fff2cc');}
        }
      }c.restore();
      if(item.type==='coin'&&Math.sin(t*2+item.x)> .93)this.star(item.x+17,item.y-15,4,'#d2a94f');
    }
    for(let n=Math.max(1,Math.floor((camera.x-START_X)/1000));n*1000+START_X<to;n++){
      const x=n*1000+START_X,y=g.terrain.height(x);
      if(Math.abs(x-(START_X+g.goal*10))<90)continue;
      if(g.terrain.gapAt(x))continue;
      if(g.terrain.experiments.some(e=>Math.abs(e.x-x)<160))continue;
      const material=this.roadMaterial(r);
      this.line([[x,y-2],[x,y-52]],material.deep,5);
      this.rect(x-37,y-85,74,37,8,'#f7f1dc',material.deep);
      this.rect(x-33,y-81,3,29,1,material.rim);
      this.text(n*100+'m',x+3,y-78,20,'#284444',800,'center');
    }
    if(camera.x<220){
      const sy=g.terrain.height(90),wave=Math.sin(t*5)*4;
      this.line([[90,sy],[90,sy-119]],'#7e7951',3);
      this.shape([[90,sy-120],[151,sy-119+wave],[141,sy-86+wave],[90,sy-87]],'#dcad6b',1.3);
      this.icon('play',114,sy-102,24,'#766044');
    }
    const finishX=START_X+g.goal*10;
    if(finishX>camera.x-160&&finishX<to){
      const fy=g.terrain.height(finishX),left=finishX-88,right=finishX+88,tapeY=fy-91;
      // A marathon-style breakaway tape on two separate stakes; no overhead frame.
      this.line([[left,g.terrain.height(left)],[left,tapeY-17]],'#324b4c',7);
      this.line([[right,g.terrain.height(right)],[right,tapeY-17]],'#324b4c',7);
      this.circle(left,tapeY-18,8,'#f5dfbd','#324b4c',2);
      this.circle(right,tapeY-18,8,'#f5dfbd','#324b4c',2);
      const burst=g.finishRibbon,elapsed=burst?Math.max(0,g.time-burst.started):0,travel=Math.min(1,elapsed/burst?.duration||0);
      if(!burst){
        this.shape([[left,tapeY-8],[right,tapeY-8],[right,tapeY+8],[left,tapeY+8]],'#f2d7b6',2,'#963d4d');
        this.line([[left+3,tapeY],[right-3,tapeY]],'#c9505f',5);
      }else if(travel<1){
        const spread=travel*53,drop=travel*travel*92;
        this.shape([[left,tapeY-8],[finishX-5-spread,tapeY-8+drop*.35],[finishX-19-spread,tapeY+11+drop],[left,tapeY+8]],'#f2d7b6',2,'#963d4d');
        this.shape([[finishX+5+spread,tapeY-8+drop*.35],[right,tapeY-8],[right,tapeY+8],[finishX+19+spread,tapeY+11+drop]],'#f2d7b6',2,'#963d4d');
        this.line([[left+3,tapeY],[finishX-13-spread,tapeY+drop*.48]],'#c9505f',4);
        this.line([[finishX+13+spread,tapeY+drop*.48],[right-3,tapeY]],'#c9505f',4);
      }
      this.bunny(finishX+103,fy-5,.85,true);
    }
    for(const p of g.particles){
      c.globalAlpha=p.life/p.max;
      if(p.size<4)this.star(p.x,p.y,p.size,p.color);
      else this.circle(p.x,p.y,p.size,p.color,'rgba(132,115,77,.22)',.7);
    }c.globalAlpha=1;
    const car=g.car;
    if(g.input.gas&&car.contacts){
      for(let i=0;i<3;i++){const age=(t*2+i*.33)%1;c.globalAlpha=(1-age)*.3;this.circle(car.x-65-age*28,car.y-age*13,4+age*7,'#faf1d7','#b5ab8e',.6);}c.globalAlpha=1;
    }
    const speedFx=clamp((Math.abs(car.vx)-115)/420,0,1),rushing=(g.mechanics.landingSurge||0)>0||(g.mechanics.flowTime||0)>0;
    if(speedFx>0){
      const count=3+Math.ceil(speedFx*6)+(rushing?3:0),span=95+speedFx*115;
      for(let i=0;i<count;i++){
        const lane=i%5,phase=(t*(190+speedFx*210)+i*47)%span;
        const yy=car.y-86+lane*30+Math.sin(i*2.7)*7,len=18+speedFx*35+(rushing?18:0);
        c.globalAlpha=.16+speedFx*.42;this.line([[car.x-74-phase,yy],[car.x-74-phase-len,yy+1]],rushing?'#b8f23a':'#7e917d',1.1+speedFx*1.5);
      }
      c.globalAlpha=1;
    }
    const pose=g.renderPose();
    this.car(pose.x,pose.y,pose.angle,1,g.save.vehicle,pose.wheelSpin,pose.wheels.map(w=>w.compression));
    this.handsOnWorld();
    this.adventureWorld();
    c.restore();
    this.foregroundWeather(r);
    // Contextual road/reward messages follow the rider instead of occupying a
    // second fixed HUD row. Keep the bubble clear of the instrument cluster and
    // clamp its tail when the vehicle approaches either screen edge.
    if(g.visualPack?.ready){
      const riderX=(pose.x-camera.x)*z,riderY=(pose.y-camera.y)*z;
      const noticeFloor=290+Math.max(0,(this.threatMeterCount?.()||0)-1)*34;
      this.drivingNotice(riderX,clamp(riderY-205*z,noticeFloor,h-330),riderX);
    }
    // 金币沿弧线飞入钱包；坐标按当前相机换算，和地形运动一致。
    const hudLeft=Math.max(34,g.platform.safe.left+12),hudRight=Math.max(34,g.platform.safe.right+12,g.platform.menuInset||0);
    const targetX=this.portrait?602:hudLeft+Math.min(780,this.w-hudLeft-hudRight)-90;
    const targetY=this.portrait?Math.max(31,g.platform.safe.top+18)+(g.platform.native?66:0)+73:Math.max(22,g.platform.safe.top+8)+73;
    for(const f of g.flashes){
      const q=clamp((t-f.at)/.7,0,1),ease=1-Math.pow(1-q,3);
      const x=(f.x-camera.x)*z*(1-ease)+targetX*ease,y=(f.y-camera.y)*z*(1-ease)+targetY*ease-Math.sin(q*Math.PI)*70;
      c.globalAlpha=1-q*.5;this.icon('coin',x,y,18*(1-q*.3));
      if(q<.55)this.hand('+'+1,(f.x-camera.x)*z,(f.y-camera.y)*z-25-q*55,20,'#ab883f',-.08);
    }c.globalAlpha=1;
  }
  hud() {
    if(this.portrait)return this.hudPortrait();
    const g=this.g,car=g.car,h=this.h,s=g.platform.safe,left=Math.max(34,s.left+12),right=Math.max(34,s.right+12,g.platform.menuInset||0),top=Math.max(22,s.top+8);
    const barW=Math.min(780,this.w-left-right);
    this.runBar(left,top,barW);
    if(!g.visualPack?.ready)this.drivingNotice(left+barW/2,top+126);
    const py=h-Math.max(120,s.bottom+107),pw=204,ph=85;
    if(g.mechanics.onFoot){this.button('driver',this.w/2-105,py,210,ph,'上车',true,'car');return;}
    this.jumpControl(left+58,Math.min(py-78,h*.57),92);
    for(const [action,x,label,gas] of [['brake',left,'后退',false],['gas',this.w-Math.max(34,s.right+12)-pw,'油门',true]]){
      this.button(action,x,py,pw,ph,label,gas);
    }
    this.text((car.vx<-5?'R · ':'')+Math.round(Math.abs(car.vx)*.36)+' km/h',this.w/2,py+30,25,INK,400,'center');
  }
  balanceHint(x,y,size) {
    const c=this.g.car;if(c.crashTime<=0&&c.rollRisk<=.38)return;
    const color='#a54f49',fall=c.crashTime>0;
    this.icon(fall?'clock':'swap',x-142,y+10,28,color);
    this.text(fall?'倒地救车':'车身失衡',x-116,y-4,size,color);
    this.text(fall?Math.max(0,FALL_TIMEOUT-c.crashTime).toFixed(1)+'s':Math.round(c.rollRisk*100)+'%',x+140,y-4,size,color,600,'right');
  }
  jumpControl(cx,cy,size=104) {
    const g=this.g,c=g.car,remaining=Math.max(0,(g.jumpReadyAt||0)-g.time),airborne=c.contacts===0&&c.bodyContacts===0;
    const airReady=airborne&&c.airtime>=.12&&g.jumpChainActive&&!g.airJumpUsed,ready=airReady||remaining<=0&&c.canHop();
    this.circle(cx,cy,size/2,ready?'rgba(217,231,119,.9)':'rgba(238,232,214,.58)',INK,3);
    this.icon('air',cx,cy-8,size*.34,ready?'#53653f':'#948c82');
    const label=airReady?'二段跳':airborne&&c.airtime>=.12&&g.airJumpUsed?'二跳已用':remaining>0?remaining.toFixed(1)+'s':'跳跃';
    this.text(label,cx,cy+18,size*(label.length>4?.17:.2),airReady?'#344529':'#80786f',airReady?700:500,'center');
    if(g.screen==='playing')this.hit('jump',cx-size/2-8,cy-size/2-8,size+16,size+16);
  }
  labWorld(from,to) {
    const g=this.g,t=g.time;
    for(const e of g.terrain.experiments){
      if(e.kind!=='swamp'||e.end<from||e.x>to)continue;
      const pts=[];for(let x=e.x;x<=e.end;x+=10)pts.push([x,g.terrain.height(x)-5]);
      this.line([...pts,...pts.slice().reverse().map(([x,y])=>[x,y+29+Math.sin(x*.08)*6])],'#456c34',1,true,true);
      this.line(pts,'#b2ce58',9);this.line(pts.map(([x,y])=>[x,y+14]),'#78993e',8);
      for(let i=0;i<14;i++){const x=e.x+18+i*31,y=g.terrain.height(x)-8-Math.abs(Math.sin(t*1.8+i))*15;this.circle(x,y,3+(i%3),'#c5ee68',INK,1);}
    }
  }
  roadMechanisms(from,to) {
    const g=this.g;
    for(const e of g.terrain.events(from,to)){
      if(['wave','ribs','sponge','tilt','slick','heave'].includes(e.kind)){
        this.weirdRoad(e,from,to);
      }else if(e.kind==='surface'){
        const surface=g.terrain.surface((e.x+e.end)/2),pts=[];
        for(let x=e.x;x<=e.end;x+=12)pts.push([x,g.terrain.height(x)-3]);
        this.line(pts,surface.color,12);
        for(let x=e.x+15;x<e.end;x+=29){const y=g.terrain.height(x);this.line([[x,y+5],[x+9,y+8]],'#a2947c',1.8);}
      }else if(e.kind==='rock'){
        if(e.id===g.mechanics.looseStone?.id)continue;
        this.roadBlockRock(e,Math.max(12,g.terrain.profile.stone||14));
      }else if(e.kind==='jump'){
        const x=e.x-110,y=g.terrain.height(x);
        this.roadSign(x,y,'前方跳台','','jump');
        this.line([[e.x+160,g.terrain.height(e.x+160)-11],[e.x+194,g.terrain.height(e.x+194)-11]],'#faf0cf',5);
      }else if(['maw','eyes','fold'].includes(e.kind)){
        this.alienRoad(e,from,to);
      }else if(e.kind==='landing'){
        const [a,b]=e.landingZone||[e.x,e.end],pts=[];for(let x=a;x<=b;x+=12)pts.push([x,g.terrain.height(x)-5]);
        this.line(pts,'#f0c967',12);this.line([[a,g.terrain.height(a)-20],[a,g.terrain.height(a)+10]],'#fff1bd',4);this.line([[b,g.terrain.height(b)-20],[b,g.terrain.height(b)+10]],'#fff1bd',4);
      }else if(e.kind==='recovery'){
        const pts=[];for(let x=e.x;x<=e.end;x+=16)pts.push([x,g.terrain.height(x)-4]);this.line(pts,'#9ed6b4',8);
      }else if(['teeth','bowl','stairs','kicker'].includes(e.kind)){
        this.alienRoad({...e,kind:{teeth:'eyes',bowl:'maw',stairs:'fold',kicker:'fold'}[e.kind]},from,to);
      }else if(['gap','ridge','rough'].includes(e.kind)){
        const x=e.x-170,y=g.terrain.height(x);
        this.roadSign(x,y,{gap:'前方断路',ridge:'陡坡注意',rough:'碎石慢行'}[e.kind],'',e.kind);
      }
    }
  }
  alienRoad(e,from,to) {
    const g=this.g,c=this.ctx,t=g.terrain,a=Math.max(from,e.x),b=Math.min(to,e.end),pts=[];
    if(b<=a)return;
    for(let xx=a;xx<b;xx+=6)pts.push([xx,t.height(xx)]);pts.push([b,t.height(b)]);
    const palette={maw:['#975c86','#f2a3bc','#ebda8e'],eyes:['#528f82','#a4e2c4','#e1ebad'],fold:['#697da7','#aeb3e4','#e9dba5']}[e.kind];
    const [dark,light,edge]=palette;
    const bottom=pts.map(([xx,yy])=>[xx,yy+67+9*Math.sin(xx*.03)]);
    this.line([...pts,...bottom.slice().reverse()],dark,2,true,true);this.line(pts.map(([xx,yy])=>[xx,yy-3]),edge,10);this.line(pts,INK,2);
    if(e.kind==='maw'){
      this.line(pts.map(([xx,yy])=>[xx,yy+13]),light,13);
      for(let xx=e.x+24;xx<e.end-10;xx+=48){if(xx<from||xx>to)continue;const yy=t.height(xx);
        this.shape([[xx-9,yy+20],[xx+9,yy+20],[xx+2,yy+41]],'#f4e7bd',1.5,'#795969');
        c.beginPath();c.moveTo(xx,yy+64);c.bezierCurveTo(xx-25,yy+98,xx+23,yy+100,xx+Math.sin(g.time*1.4+xx)*8,yy+117);c.strokeStyle=light;c.lineWidth=5;c.stroke();
      }
      for(const f of [.24,.73]){const xx=e.x+(e.end-e.x)*f;if(xx>=from&&xx<=to)this.eye(xx,t.height(xx)+28,19,f*8,Math.sign(g.car.x-xx));}
    }else if(e.kind==='eyes'){
      for(const f of [.22,.54,.82]){const xx=e.x+(e.end-e.x)*f;if(xx<from-50||xx>to+50)continue;const yy=t.height(xx)+29;
        this.circle(xx,yy,31,light,INK,2);this.eye(xx,yy,26,f*7,clamp((g.car.x-xx)/160,-1,1));
        this.line([[xx-19,yy+34],[xx-12,yy+64],[xx-25,yy+75]],'#8ac4b0',5);
      }
      for(let xx=e.x+35;xx<e.end;xx+=56)if(xx>=from&&xx<=to){const yy=t.height(xx)+47;this.circle(xx,yy,4,'#b5ebc7',INK,1);}
    }else{
      for(let xx=e.x+15;xx<e.end;xx+=40)if(xx>=from&&xx<=to){const yy=t.height(xx);
        this.shape([[xx-16,yy+10],[xx+18,yy+31],[xx-13,yy+52],[xx+15,yy+68]],xx%80<40?light:'#8698c5',1.3,'#4c608a');
        this.line([[xx-10,yy+31],[xx+7,yy+36]],'#e9dbbb',1.8);
      }
      const xx=(e.x+e.end)/2,yy=t.height(xx)+99;
      if(xx>=from&&xx<=to){c.save();c.translate(xx,yy);c.rotate(Math.sin(g.time*.8)*.16);this.shape([[-24,0],[0,-24],[24,0],[0,24]],'#bec4e7',2);this.circle(0,0,7,'#e7d8a6',INK,1.5);c.restore();}
    }
    const sx=e.x-145,sy=t.height(sx),label={maw:'巨口峡谷',eyes:'眼球脊背',fold:'折叠维度'}[e.kind];
    if(sx>=from-70&&sx<=to)this.roadSign(sx,sy,label,'','alien');
  }
  weirdRoad(e,from,to) {
    const g=this.g,t=g.terrain,colors={wave:['#8ebbb4','#d6e9cf'],ribs:['#bcaa8b','#efe0bc'],sponge:['#ba84a7','#edb7d4'],tilt:['#aa8b69','#e3be80'],slick:['#7faab9','#d5f2ec'],heave:['#738ba8','#d8dce3']},[dark,light]=colors[e.kind];
    const a=Math.max(from,e.x),b=Math.min(to,e.end),pts=[];
    for(let x=a;x<b;x+=8)pts.push([x,t.height(x)]);pts.push([b,t.height(b)]);
    this.line([...pts,...pts.slice().reverse().map(([x,y])=>[x,y+28])],dark,1,true,true);this.line(pts.map(([x,y])=>[x,y-3]),light,10);this.line(pts,INK,1.5);
    for(let x=e.x+12;x<e.end-8;x+=e.kind==='ribs'?26:42){
      if(x<from||x>to)continue;const y=t.height(x);
      if(e.kind==='sponge'){this.circle(x,y+15,8,'#dcacc8','#aa789b',1);this.circle(x+12,y+7,3,'#f3d0e1');}
      else if(e.kind==='tilt'||e.kind==='heave'){this.line([[x,y+2],[x+4,y+23]],'#755f51',3);this.circle(x+13,y+8,2,'#f3d6a7');}
      else if(e.kind==='slick')this.shape([[x-13,y+23],[x+9,y+5],[x+22,y+22]],'#b9e6e2',.6,'#a9d2db');
      else if(e.kind==='ribs'){this.line([[x,y+4],[x+3,y+23]],'#ecddba',8);this.circle(x,y+4,5,'#eddfb8');}
      else this.line([[x-12,y+18],[x,y+9],[x+13,y+18]],'#cee4cf',2);
    }
    if(e.kind==='tilt'){const mid=(e.x+e.end)/2,y=t.height(mid)+28;this.shape([[mid-25,y+33],[mid,y],[mid+25,y+33]],'#827462',2);this.circle(mid,y+5,8,'#e4bd78',INK,1.5);}
    if(e.kind==='heave')for(const fraction of [.3,.7]){
      const xx=e.x+(e.end-e.x)*fraction,yy=t.height(xx)+27,base=t.baseHeight(xx)+95;
      this.line([[xx,yy],[xx,base]],'#334c58',12);this.line([[xx,yy+3],[xx,base]],'#b8c6c8',5);
      this.shape([[xx-22,base+9],[xx-15,base-6],[xx+15,base-6],[xx+22,base+9]],'#667d84',2);
      this.line([[xx-7,yy+12],[xx,yy+5],[xx+7,yy+12]],'#e5daa0',2);
    }
    const x=e.x-110,y=t.height(x);
    if(x>=from&&x<=to)this.roadSign(x,y,{wave:'波纹路',ribs:'连齿路',sponge:'海绵路',tilt:'摇摆桥',slick:'薄冰路',heave:'起伏路'}[e.kind],'',e.kind);
  }
  handsOnWorld() {
    const g=this.g,m=g.mechanics,c=this.ctx,car=g.car,a=m.gum,e=m.looseStone;
    if(a&&a.end>g.camera.x-100&&a.x<g.camera.x+this.w/g.viewZoom()+100){
      const pts=[];for(let x=a.x;x<=a.end;x+=9)pts.push([x,g.terrain.height(x)-2+Math.sin(x*.07+g.time*2)*2]);
      this.line(pts,a.cleared?'#c396ac':'#dd70a7',16);this.line(pts.map(([x,y])=>[x,y-4]),'#f6bddb',4);
      for(let i=0;i<7;i++){const x=a.x+15+i*24;this.circle(x,g.terrain.height(x)-4,5+(i%2)*3,'#ee9cc9','#b15b8d',1);}
      const signX=a.x-80,signY=g.terrain.height(signX);this.roadSign(signX,signY,'黏路减速','','gum');
      if(a.caught&&!a.cleared&&car.contacts>0&&car.x>=a.x&&car.x<=a.end){
        for(const side of [-1,1]){
          const hub=car.point(side*car.stats.wheelbase,14),anchor=a.anchor+side*22,y=g.terrain.height(anchor)-1;
          this.line([[anchor,y],[anchor+(hub.x-anchor)*.5,y-10-a.release*20],[hub.x,hub.y+car.stats.wheelRadius-3]],'#b6558c',9*(1-a.release*.7));
          this.line([[anchor,y-3],[hub.x,hub.y+car.stats.wheelRadius-5]],'#ffbde0',3);
        }
      }
    }
    if(!e)return;
    const s=m.stonePosition(),target=m.stoneTarget();
    if(e.x<g.camera.x-200||e.x>g.camera.x+this.w/g.viewZoom()+200)return;
    if(m.onFoot&&!m.stoneCleared){
      c.save();c.setLineDash([5,6]);this.shape([[-34,13],[-27,-5],[-7,-15],[24,-8],[36,13]].map(([x,y])=>[target.x+x,target.y+y]),'rgba(238,237,198,.35)',2,'#a1935b');this.line([[s.x+20,s.y-29],[target.x-25,target.y+20]],'#928650',2);c.restore();
      this.icon('arrow',target.x,target.y-33,28,'#827647');
    }
    const stone=m.stoneDrag||(m.stoneCleared?{x:target.x,y:g.terrain.groundHeight(target.x)-26}:s);
    c.save();c.translate(stone.x,stone.y);if(m.stoneCleared)c.scale(.6,.6);
    this.shape([[-49,10],[-30,-3],[-12,-12],[17,-8],[47,10]],m.stoneDrag?'#e4d3a3':'#bcb79f',2,'#747c6a');
    this.line([[-24,1],[-7,-6],[14,-2]],'#f3e7c7',2);c.restore();
    if(m.onFoot){
      const walk=m.walkTime,px=car.x+50+((m.stoneDrag?stone.x:s.x)-35-car.x-50)*walk,py=g.terrain.height(px)-4;
      const step=walk<1?Math.sin(g.time*18)*7:0;
      this.line([[px-6,py-20],[px-12-step,py],[px-22-step,py]],INK,4);this.line([[px+7,py-20],[px+14+step,py],[px+24+step,py]],INK,4);
      const character=CHARACTERS[g.save.character]||CHARACTERS[0];
      this.driverTorso(px,py-32,.88);
      this.driverHead(px,py-60,.9);
      const hand=m.stoneDrag?{x:stone.x-16,y:stone.y+2}:{x:px+24,y:py-32};
      this.line([[px+9,py-38],[px+26,py-27],[hand.x,hand.y]],INK,3);this.circle(hand.x,hand.y,4,character.skin,INK,1);
    }else if(!m.stoneCleared){this.line([[s.x-10,s.y-35],[s.x,s.y-27],[s.x+10,s.y-35]],'#eee5a4',3);}
  }
  handsOnHud() {
    const g=this.g,m=g.mechanics;if(g.screen!=='playing'||g.modal)return;
    const e=m.looseStone,z=g.viewZoom();
    if(m.onFoot&&!m.stoneCleared){
      const s=m.stonePosition(),x=(s.x-g.camera.x)*z,y=(s.y-g.camera.y)*z;
      this.hit('stoneDrag',x-64,y-55,128,95);
    }else if(e&&!m.stoneCleared&&e.x-g.car.x>55&&e.x-g.car.x<300){
      const x=clamp((g.car.x-g.camera.x)*z-68,20,this.w-156),y=(g.car.y-g.camera.y)*z-166;
      if(m.canExit())this.button('driver',x,y,136,52,'下车',true);
    }
  }
  roadNotice() {
    const g=this.g,names={swamp:'沼泽 · 保持速度',gap:'断路 · 提前起跳',ridge:'陡坡 · 控制车身',rough:'碎石 · 放慢速度',rock:'碎石 · 减速或跳过',branch:'上路金币 · 下路补给',jump:'跳台 · 提前起跳',teeth:'尖山 · 提前起跳',bowl:'深沟 · 调平车身',stairs:'阶梯 · 连续跳跃',kicker:'断崖 · 提前起跳',maw:'巨口 · 提前起跳',eyes:'眼球 · 连续跳跃',fold:'折叠断崖 · 提前起跳'};
    const range=clamp(Math.max(800,Math.abs(g.car.vx)*2.2),800,2000),authored=g.terrain.profile.authored;
    if(authored?.notices){
      const notice=authored.notices.find(n=>n.decisionX>g.car.x&&n.x-g.car.x<range);
      if(notice)return {icon:notice.icon,text:notice.text+' · '+Math.ceil((notice.decisionX-g.car.x)/10)+'m',color:'#526657'};
    }
    const target=[...g.terrain.experiments.filter(e=>!g.mechanics.labUsed.has(e.id)),...g.terrain.roadFeatures,...(g.terrain.verticalBranches||[]).map(b=>({...b,kind:'branch'})),...g.terrain.ruggedSections,g.mechanics.nextObstacle()]
      .filter(e=>e&&names[e.kind]&&e.x>g.car.x&&e.x-g.car.x<range).sort((a,b)=>a.x-b.x)[0];
    if(!target)return null;
    return {icon:target.kind==='branch'?'swap':target.kind==='swamp'?'drop':target.kind==='rough'?'wheel':'air',text:names[target.kind]+' · '+Math.ceil((target.x-g.car.x)/10)+'m',color:'#526657'};
  }
  headerPortrait() {
    const g=this.g,top=this.headerY();
    if(g.screen==='home')this.icon('mountain',49,top+20,36,'#89a979');
    else{this.icon('back',49,top+20,28);this.hit('home',18,top-12,68,68);}
    if(g.screen==='garage'||g.screen==='records')this.text(g.screen==='garage'?'车库':'关卡记录',98,top+4,29,INK,500);
    const yy=top,x=this.w-254;
    this.icon('coin',x+23,yy+22,23);this.text(g.save.coins,x+43,yy+10,23,INK);
    this.icon(g.save.sound?'sound':'mute',this.w-94,yy+21,26,INK);this.hit('sound',this.w-122,yy-9,56,60);
    this.icon('help',this.w-36,yy+21,26,INK);this.hit('help',this.w-63,yy-9,55,60);
  }
  title(x,y,size) {
    const c=this.ctx;
    ['怪路','实验室'].forEach((row,line)=>{
      const fontSize=size*(line===0?1.12:1),spacing=fontSize*1.04;
      [...row].forEach((ch,i)=>{
        c.save();c.translate(x+(i-(row.length-1)/2)*spacing,y+line*size*1.17+fontSize*.5);c.rotate((i%2?.025:-.025)*(line===0?1:-1));
        const homeHero=this.g.screen==='home'&&this.portrait;
        this.text(ch,5,-fontSize*.5+7,fontSize,homeHero?'#173c3c':'#b16b8d',400,'center','display');
        this.text(ch,0,-fontSize*.5,fontSize,homeHero?'#fff6d9':INK,400,'center','display');c.restore();
      });
    });
  }
  homePortrait() {
    const g=this.g,c=this.ctx,h=this.h,w=this.w,t=g.time,r=g.routeSpec();
    const top=Math.max(112,this.headerY()+84),titleSize=clamp((h-880)*.09+104,104,132),bottom=Math.max(28,(g.platform.safe.bottom||0)+18);
    this.title(w/2,top,titleSize);

    this.star(159,top+45,12,'#ecc779');this.star(602,top+titleSize*1.62,11,'#9dbe91');

    const groundY=Math.min(h-380,Math.max(h*.59,top+titleSize*2.17+185));
    const ground=x=>groundY+15*Math.sin(x/143)+7*Math.sin(x/55),points=[];
    for(let x=-12;x<=w+12;x+=12)points.push([x,ground(x)]);
    this.line([...points,[w+12,h],[-12,h]],r.earth,1,true,true);this.line(points.map(p=>[p[0],p[1]-4]),r.grass,13);this.line(points,'#9aaa7b',2);
    [[53,.87],[655,1.3]].forEach(([x,z])=>{if(g.worldRoute()===1)this.cactus(x,ground(x),z);else this.tree(x,ground(x),z,'#b6d49e',g.worldRoute()===2);});
    for(let i=0;i<5;i++){const x=i*156+13;this.flower(x,ground(x)-5,.67,i);}
    const carScale=clamp((groundY-top-titleSize*2.17-28)/132,1.3,2.4);
    const carX=347+Math.sin(t*.7)*4,carY=ground(carX)-35*carScale,hop=g.honkUntil>t?Math.sin((g.honkUntil-t)*16)*7:0;
    this.car(carX,carY+hop,Math.sin(t*2)*.017,carScale,g.save.vehicle,t*.13);
    this.hit('honk',carX-70*carScale,carY-75*carScale,140*carScale,110*carScale);
    this.bunny(605,ground(605)-5,.78,g.honkUntil>t);
    this.butterfly(552,carY-171,2,.8);
    if(g.honkUntil>t){this.hand('嘎嘎！',440,carY-232,33,'#bf8b70',.06);}
    this.modeCard(43,h-bottom-313,634,138,'stage');
    const navY=h-bottom-134;
    this.textAction('garage',63,navY,174,80,'车库','car');
    this.textAction('campaign',274,navY,186,80,'地图','mountain');
    this.textAction('records',500,navY,169,80,'记录','clock');
    this.text('已通关 '+this.progressSummary().frontier+' 关 · 累计 '+Math.floor(g.save.lifetimeDistance||0)+'m',w/2,h-bottom-27,21,'#e9ead7',400,'center');
  }
  modeCard(x,y,w,h) {
    const record=this.routeRecord(),title=this.routeTitle();
    this.line([[x,y],[x+w,y]],'rgba(244,239,219,.6)',1.5);
    this.text(title,x+4,y+18,Math.min(31,470/title.length),'#f7f0d8',500);
    this.text((record.clear?'已通关 · ':'最远 ')+record.best+' / '+record.goal+'m',x+4,y+64,22,'#e7e5cf');
    this.rect(x+4,y+110,w-146,4,2,'rgba(239,236,215,.3)');
    if(record.percent)this.rect(x+4,y+110,(w-146)*record.percent/100,4,2,'#d5e793');
    this.circle(x+w-56,y+61,44,'#c5e765');this.icon('play',x+w-54,y+61,33,INK);
    this.text('出发',x+w-56,y+114,22,'#f7f0d8',500,'center');this.hit('quickStart',x,y,w,h);
  }
  garagePortrait() {
    const g=this.g,h=this.h,c=this.ctx,v=VEHICLES[g.previewVehicle],build=previewBuild(g.save,g.previewVehicle);
    const owned=g.save.owned.includes(g.previewVehicle),active=g.save.vehicle===g.previewVehicle,part=g.garagePart||'engine';
    const top=Math.max(123,this.headerY()+78),footer=h-Math.max(96,g.platform.safe.bottom+80);
    const detailH=clamp(h*.28,285,420),detailY=footer-18-detailH,tabsY=detailY-78,equipY=tabsY-64,fleetY=equipY-110,sceneY=0,sceneH=fleetY-18;
    // 车间墙面铺满整屏，延伸到工具栏背后；不再把实车塞进有边距的小卡片。
    this.rect(0,0,720,h,0,'#b8cdba');
    this.rect(0,sceneY,720,sceneH,0,'#dce4ca');
    c.save();this.rect(0,sceneY,720,sceneH,0);c.clip();
    this.shape([[120,sceneY],[580,sceneY],[720,sceneY+sceneH],[0,sceneY+sceneH]],'#e9ebd2',1,'#e9ebd2');
    for(let row=0;row<4;row++)for(let col=0;col<5;col++)this.circle(58+col*18,top+70+row*20,2,'#becdb5');
    this.line([[618,0],[618,top+38],[600,top+50]],'#829581',3);
    this.shape([[586,top+49],[620,top+46],[633,top+62],[575,top+66]],'#789a87',2);
    this.line([[50,sceneY+sceneH-68],[672,sceneY+sceneH-68]],'#c5d0b7',1.5);
    this.rect(55,sceneY+sceneH-94,59,28,5,'#9fae85');this.line([[62,sceneY+sceneH-91],[105,sceneY+sceneH-91]],'#f1dfac',3);this.icon('engine',84,sceneY+sceneH-79,20,'#526a55');
    this.text(v.name,32,top,36,INK);
    this.icon('car',510,top+20,24,'#536e5b');this.text((g.previewVehicle+1)+' / '+VEHICLES.length,536,top+8,22,'#536e5b');
    this.circle(668,top+20,24,active?'#c6e78b':'#eee9d4');this.icon(active?'check':owned?'car':'lock',668,top+20,25,'#4b664b');
    const personal=['unicycle','skateboard','scooter'].includes(v.kind),liftY=sceneY+sceneH-54,clearance=(personal?185:v.kind==='bike'||v.kind==='trike'?146:139)+vehicleAppearance(build).bodyLift;
    const scale=clamp((liftY-top-57)/clearance,.78,2.9),carX=367,carY=liftY-(14+vehicleStats(build,g.previewVehicle).wheelRadius)*scale;
    this.shape([[175,liftY+9],[541,liftY+9],[559,liftY+25],[158,liftY+25]],'#8aa18b',1.5,'#728974');
    this.rect(161,liftY,393,12,5,'#526c5a');
    for(let i=0;i<12;i++)this.line([[170+i*31,liftY+3],[182+i*31,liftY+10]],'#d5dba9',3);
    this.car(carX,carY,-.018,scale,g.previewVehicle,0);
    const stats=vehicleStats(build,g.previewVehicle);
    [['engine',Math.round(stats.drive)],['wheel',stats.grip.toFixed(2)],['fuel',Math.round(stats.fuel/stats.burn)+'s']].forEach(([icon,value],i)=>{
      const xx=132+i*205;this.icon(icon,xx,liftY+39,19,'#657c5c');this.text(value,xx+23,liftY+29,21,INK);
    });c.restore();
    this.fleetPicker(26,fleetY,668,96);
    if(active){
      this.icon('check',58,equipY+25,25,'#54764c');this.text('已装备',82,equipY+13,22,'#54764c');
      this.iconButton('workshopInfo',635,equipY,54,50,'info',false);
    }else{
      this.button('equip',26,equipY,owned?599:438,50,owned?'使用这辆车':String(v.price)+' 购车',true,owned?'car':'coin');
      if(!owned)this.button('pinVehicle',478,equipY,147,50,g.save.goalVehicle===g.previewVehicle?'已设目标':'攒币目标',false);
      this.iconButton('workshopInfo',637,equipY,54,50,'info',false);
    }
    UPGRADES.forEach((u,i)=>{
      const xx=26+i*173,selected=part===u.id;
      this.icon(u.icon,xx+29,tabsY+27,25,selected?INK:'#5e795c');
      this.text(u.name,xx+50,tabsY+14,24,selected?INK:'#5e795c',selected?500:400);
      this.text('Lv.'+build[u.id],xx+82,tabsY+43,16,'#617b5b',400,'center');
      if(selected)this.rect(xx+18,tabsY+63,127,3,1,'#4d7154');
      this.hit('inspect:'+u.id,xx,tabsY,163,65);
    });
    this.workshopDetail(26,detailY,668,detailH,UPGRADES.find(u=>u.id===part)||UPGRADES[0]);
    this.button('characters',26,footer,168,62,'驾驶员',false,'person');
    this.button('start',210,footer,484,62,'开始游戏',true,'play');
  }
  fleetPicker(x,y,w,h) {
    const g=this.g,count=Math.ceil(VEHICLES.length/3),page=clamp(g.fleetPage||0,0,count-1),edge=44,gap=10,slot=(w-edge*2-gap*4)/3;
    for(const [step,xx,enabled] of [[-1,x,page>0],[1,x+w-edge,page<count-1]]){
      this.ctx.save();this.ctx.translate(xx+edge/2,y+h/2);if(step<0)this.ctx.rotate(Math.PI);this.icon('chevron',0,0,21,enabled?'#365642':'#7b9179');this.ctx.restore();
      if(enabled)this.hit('fleet:'+step,xx,y,edge,h);
    }
    for(let j=0;j<3;j++){
      const i=page*3+j,v=VEHICLES[i];if(!v)break;
      const xx=x+edge+gap+j*(slot+gap),selected=g.previewVehicle===i,has=g.save.owned.includes(i);
      if(selected)this.rect(xx+slot*.18,y+h-3,slot*.64,3,1,'#5c7c4f');
      this.vehicleStamp(xx+slot/2,y+h*.4,i,has?1:.65);
      this.text(v.name,xx+slot/2,y+h-27,Math.min(18,(slot-10)/v.name.length),selected?INK:'#57705a',400,'center');
      this.icon(has?'check':'lock',xx+slot-16,y+14,12,'#62825d');this.hit('vehicle:'+i,xx,y,slot,h);
    }
  }
  vehicleStamp(x,y,index,alpha=1) {
    const c=this.ctx;c.save();c.globalAlpha*=alpha;
    // 缩略图直接复用实车，不维护第二套近似造型；不改变装备或角色。
    this.car(x,y+4,0,.47,index,0,[],{},false);c.restore();
  }
  workshopDetail(x,y,w,h,u) {
    const g=this.g,build=previewBuild(g.save,g.previewVehicle),info=upgradePreview(u.id,build,g.previewVehicle),owned=g.save.owned.includes(g.previewVehicle),gate=upgradeGate(g.save,info.level);
    const mod=selectedSpecialization(build,u.id),available=SPECIALIZATIONS[u.id].filter(m=>!specializationGate(g.save,g.previewVehicle,u.id,m));
    this.rect(0,y,this.w,h,0,'#e8e9d1');
    this.line([[x+20,y],[x+w-20,y]],'#bbc9aa',1);
    this.icon(u.icon,x+40,y+33,29,INK);this.text(u.name+'改装',x+67,y+22,24,INK,500);this.text('Lv.'+info.level+' / '+MAX_LEVEL,x+w-24,y+22,22,'#697f58',400,'right');
    for(let i=0;i<MAX_LEVEL;i++)this.rect(x+23+i*(w-46)/MAX_LEVEL,y+57,(w-46)/MAX_LEVEL-4,5,2,i<info.level?'#8faa56':'#d4dcc1');
    const statsY=y+79,statsH=h-199;
    this.workshopPart(x+95,statsY+statsH/2,Math.min(1,statsH/117),u.id,info.level);
    info.rows.slice(0,2).forEach(([label,a,b,unit],i)=>{
      const yy=statsY+i*statsH/2,icons={engine:['engine','speed'],tires:['wheel','mountain'],suspension:['shield','spring'],tank:['fuel','clock']};this.icon(icons[u.id][i],x+202,yy+14,25,'#6a7b5c');
      this.text(label,x+225,yy+4,19,'#526657');
      this.text(a+' → '+b+unit,x+w-23,yy+22,27,INK,400,'right');
    });
    const my=y+h-105;
    this.line([[x+22,my-10],[x+w-22,my-10]],'#d8ddc3',1.5);
    this.icon('swap',x+35,my+14,20,'#5a7752');
    if(mod)this.text(mod.name,x+57,my+3,20,'#516b4d');
    else this.text(available.length?'专精 · '+available.length+' 项可选':'专精 · 未解锁',x+57,my+3,20,'#516b4d');
    this.icon('chevron',x+w-29,my+14,20,'#5a7752');this.hit('branch:'+u.id,x+18,my-3,w-36,37);
    this.button('test:'+u.id,x+20,y+h-59,155,45,'试车',false,'speed');
    const cost=upgradeCost(info.level),can=owned&&!gate&&g.save.coins>=cost;
    this.rect(x+189,y+h-59,w-209,45,12,can?'#b6f04b':'#d5dfbd');
    const cx=x+189+(w-209)/2,maxed=info.level>=MAX_LEVEL;
    this.icon(maxed?'check':!owned||gate?'lock':'coin',!maxed&&owned&&!gate?cx-42:x+213,y+h-36,24,'#536d4e');
    if(!maxed&&owned&&!gate){this.text('升级',x+215,y+h-48,21,INK);this.text(cost,cx+13,y+h-48,23,INK,400,'center');this.icon('plus',cx+77,y+h-36,23,INK);}
    else this.text(maxed?'已满级':!owned?'先购车':gate,x+238,y+h-48,20,'#536d4e');
    this.hit('upgrade:'+u.id,x+189,y+h-59,w-209,45);
  }
  workshopPart(x,y,scale,part,level) {
    const c=this.ctx;c.save();c.translate(x,y);c.scale(scale,scale);c.rotate(-.12);
    this.circle(0,0,50,'#d0daba');
    if(part==='engine'){
      this.line([[-29,-20],[-36,-39],[-22,-39]],INK,6);this.line([[30,8],[44,8],[44,-13]],INK,5);
      this.rect(-30,-27,61,49,7,'#819e87',INK);this.rect(-35,-32,70,10,3,'#c6bc87',INK);
      for(let i=0;i<4;i++)this.line([[-24,-16+i*8],[4,-16+i*8]],'#d9dfb2',3);
      this.circle(22,13,20,'#e1b677',INK,2);this.circle(22,13,11,'#637f72',INK,2);this.circle(22,13,4,'#dfe4c0',INK);
      this.line([[-21,26],[-21,36],[18,36],[18,31]],INK,4);
      if(level>=5)this.rect(-8,-46,27,13,3,'#e5dbaa',INK);
    }else if(part==='tires'){
      this.circle(0,0,45,'#324b40',INK,3);this.circle(0,0,30,'#d6bf80',INK,2);this.circle(0,0,21,'#89a797',INK,2);
      for(let i=0;i<12;i++){const a=i*Math.PI/6;this.line([[Math.cos(a)*36,Math.sin(a)*36],[Math.cos(a+.16)*42,Math.sin(a+.16)*42]],'#bdce96',4);}
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;this.line([[Math.cos(a)*8,Math.sin(a)*8],[Math.cos(a)*21,Math.sin(a)*21]],INK,4);}
      this.circle(0,0,8,'#e7d79f',INK,2);
    }else if(part==='suspension'){
      c.rotate(.3);this.line([[0,-48],[0,48]],INK,14);this.line([[0,-43],[0,43]],'#a9b9a7',6);
      this.rect(-14,-33,28,58,5,'#7eb2a3',INK);
      this.line([[-18,-29],[18,-20],[-18,-11],[18,-2],[-18,7],[18,16],[-18,25],[18,33]],'#e4bd76',6);
      this.circle(0,-44,10,'#bccba8',INK,3);this.circle(0,-44,4,INK);this.circle(0,45,10,'#bccba8',INK,3);this.circle(0,45,4,INK);
    }else{
      this.rect(-25,-47,34,15,4,null,INK);this.rect(16,-43,13,9,2,'#5b7661',INK);
      this.shape([[-29,-31],[20,-34],[33,-21],[33,38],[-31,38]],'#d5b26d',2);
      this.line([[-19,-17],[19,23],[-19,23],[20,-17]],'#a28550',4);this.rect(-27,-23,7,53,2,'#eee0ab');
      this.rect(27,-13,11,38,3,'#eff0cc',INK);this.rect(29,2,7,21,2,'#8bac61');
    }
    c.restore();
  }
  vehicleMetrics(x,y,gap) {
    const g=this.g,s=vehicleStats(previewBuild(g.save,g.previewVehicle),g.previewVehicle);
    [['engine',Math.round(s.drive)],['wheel',s.grip.toFixed(2)],['fuel',Math.round(s.fuel/s.burn)+'s']].forEach(([icon,value],i)=>{
      this.rect(x-14+i*gap,y-6,gap-16,32,12,'#cbdac3');this.icon(icon,x+i*gap,y+10,21,'#526657');this.text(value,x+25+i*gap,y,21,INK);
    });
  }
  trialScreen() {
    const g=this.g,t=g.trial;if(!t)return;
    const hh=Math.min(750,this.h-40),{x,y}=this.overlay(650,hh),elapsed=(g.time-g.trialStart)%5;
    this.icon('speed',x+51,y+48,40,INK);this.icon('close',x+606,y+46,28);this.hit('close',x+576,y+15,57,60);
    this.icon(UPGRADES.find(u=>u.id===t.id).icon,x+325,y+96,35,'#526657');
    const trackH=(hh-280)/2,maxX=Math.max(...t.runs.map(r=>r.frames[r.frames.length-1].x),100),scale=Math.min(1,490/maxX);
    t.runs.forEach((run,i)=>{
      const yy=y+129+i*(trackH+18),frame=run.frames[Math.min(run.frames.length-1,Math.floor(Math.min(4,elapsed)*30))];
      this.rect(x+25,yy,600,trackH,17,i?'#d0d2a9':'#d6cad1');this.icon(i?'plus':'check',x+56,yy+27,25,INK);this.text(t.values[i],x+603,yy+13,27,i?'#799b67':'#a68d6d',400,'right');
      const base=yy+trackH-27,pts=[];for(let k=-40;k<=540;k+=10)pts.push([x+66+k,base+(run.terrain.height(160+k/scale)-420)*scale]);
      this.line(pts,'#a3b58c',4);
      const ground=run.terrain.height(160+frame.x);
      this.car(x+66+frame.x*scale,base+(ground-420)*scale+(frame.y-ground)*.68,frame.angle,.68,t.vehicle,frame.spin,frame.wheels,i?t.info.next:previewBuild(g.save,t.vehicle));
      if(t.id==='tank'){this.rect(x+50,yy+trackH-14,535,6,3,'#dedbc3');this.rect(x+50,yy+trackH-14,535*frame.fuel,6,3,'#a3bb82');}
    });
    this.icon('coin',x+305,y+hh-96,22,'#526657');this.text(0,x+330,y+hh-106,21,'#526657');
    this.button('testAgain',x+37,y+hh-71,190,43,'重播',false);this.button('upgrade:'+t.id,x+245,y+hh-71,365,43,!g.save.owned.includes(g.previewVehicle)?'先购车':upgradeGate(g.save,t.info.level)||upgradeCost(t.info.level)+' 升级',!upgradeGate(g.save,t.info.level)&&g.save.owned.includes(g.previewVehicle));
  }
  hudPortrait() {
    if(this.g.visualPack?.ready)return this.visualPackHud();
    const g=this.g,car=g.car,h=this.h,s=g.platform.safe,top=Math.max(31,s.top+18),bottom=Math.max(25,s.bottom+14);
    const y=top+(g.platform.native?66:0),py=h-bottom-164;
    this.runBar(28,y,664);
    this.drivingNotice(360,y+126);
    this.text((car.vx<-5?'R · ':'')+Math.round(Math.abs(car.vx)*.36)+' km/h',360,py-60,28,INK,400,'center');
    if(g.mechanics.onFoot){this.button('driver',245,py+20,230,95,'上车',true,'car');return;}
    this.jumpControl(75,Math.min(py-188,h*.58),108);
    [['brake',28,'后退',false],['gas',506,'油门',true]].forEach(([action,x,label,gas])=>{
      const pressed=g.input[action],yy=py+(pressed?6:0);this.rect(x,yy,186,128,27,gas?(pressed?'rgba(190,197,88,.94)':'rgba(207,219,115,.68)'):(pressed?'rgba(234,225,210,.94)':'rgba(234,225,210,.65)'),INK);
      for(let i=0;i<3;i++)this.line([[x+43+i*19,yy+24],[x+38+i*19,yy+41]],gas?'#d0aa70':'#c3bea5',3);
      this.icon(gas?'arrow':'back',x+93,yy+63,36,INK);
      this.text(label,x+93,yy+91,26,INK,500,'center');
      if(g.screen==='playing')this.hit(action,x,py,186,137);
    });
  }
  visualPackHud() {
    const g=this.g,car=g.car,h=this.h,ink='#153947',paper='#fffaf0',fuel=clamp(car.fuel/car.fuelMax,0,1);
    const held=action=>Array.from(g.pointers.values()).some(p=>p.action===action);
    const top=Math.max(24,g.platform.native?(g.platform.safe.top||0)+18:24);
    this.visualHudTop=top;
    const c=this.ctx,progress=clamp(car.distance/g.goal,0,1);
    const wash=c.createLinearGradient(0,0,0,top+230);
    wash.addColorStop(0,'rgba(210,235,247,.69)');wash.addColorStop(.66,'rgba(210,235,247,.23)');wash.addColorStop(1,'rgba(210,235,247,0)');
    this.rect(0,0,720,top+230,0,wash);
    c.save();c.shadowColor='rgba(244,251,255,.94)';c.shadowBlur=7;
    const routeName=g.routeSpec().name.split(' · ').at(-1);
    const title='第 '+(g.save.route+1)+' 关 · '+routeName;
    c.font='800 29px '+(g.platform.fontUI||FONT);
    const titleSize=Math.min(29,Math.floor(29*435/Math.max(435,c.measureText(title).width)));
    this.text(title,23,top+1,titleSize,ink,800);
    this.text(Math.min(g.goal,Math.floor(car.distance))+' / '+g.goal+' m',22,top+46,45,ink,900);
    this.circle(527,top+23,15,'#f9c04b','#9e6b25',2.5);this.circle(527,top+23,10,null,'#fff0ac',2);
    this.icon('coin',527,top+23,19,'#b17626');
    this.text(g.runCoins+(g.airBonus||0)+(g.mechanics?.bonus||0),553,top+7,27,ink,800);
    const pausePressed=held('pause');
    this.circle(662,top+28,31,pausePressed?'#d7e4df':'#fff9e9','#78919a',2.5);
    this.icon('pause',662,top+28,27,ink);
    this.rect(22,top+112,568,7,3.5,'rgba(34,68,85,.38)');
    if(progress>0)this.rect(22,top+112,568*progress,7,3.5,'#3d7890');
    this.line([[592,top+89],[592,top+125]],ink,2.5);
    for(let row=0;row<3;row++)for(let col=0;col<3;col++)if((row+col)%2===0)this.rect(594+col*6,top+90+row*6,6,6,0,ink);
    this.text(Math.floor(progress*100)+'%',668,top+98,26,ink,800,'right');
    const statusY=top+143+(this.threatMeterCount?.()||0)*35;
    const route=g.routeSpec(),focus=route.spec.focus||({cruise:'学会控车与落地',sprint:'借坡提速，落地调平',air:'断口前起跳，空中调姿',grip:'碎路控速，保持抓地',fuel:'留油过长坡',chase:'稳落后甩开怪雾'})[route.type]||'开到终点';
    const activePop=g.pop?.until>g.time?g.pop.text:null;
    const message=fuel<.15?'油量低 · 寻找补给':activePop||focus;
    this.icon(fuel<.15?'fuel':activePop?'check':'flag',29,statusY+13,20,ink);
    this.text(message,48,statusY,Math.min(21,Math.max(16,Math.floor(600/message.length))),ink,activePop||fuel<.15?800:650);
    c.restore();
    const pedalY=h-226;
    this.metalPedal('brake',32,pedalY,172,138,'刹车');
    this.metalPedal('gas',550,pedalY-8,140,146,'油门');
    const jumpY=h-337,jumpPressed=held('jump');
    const jumpFill=c.createLinearGradient(0,jumpY-57,0,jumpY+57);
    jumpFill.addColorStop(0,'#f4f7f7');jumpFill.addColorStop(1,'#96b0bd');
    c.save();c.shadowColor='rgba(7,34,52,.5)';c.shadowBlur=12;
    this.circle(100,jumpY,57,jumpFill,'#142d3a',4);c.restore();
    this.circle(100,jumpY,49,null,'rgba(255,255,255,.8)',2);
    this.icon('air',100,jumpY,47,jumpPressed?'#2d657d':ink);
    this.text('跳跃',100,jumpY+66,22,paper,800,'center');
    if(g.screen==='playing')this.hit('jump',34,jumpY-65,132,150);
    c.save();c.shadowColor='rgba(10,29,43,.8)';c.shadowBlur=5;
    this.text((car.vx<-5?'R · ':'')+Math.round(Math.abs(car.vx)*.36)+' km/h',360,h-128,32,'#fff',800,'center');c.restore();
    this.hit('pause',621,top-9,82,78);
  }
  metalPedal(action,x,y,w,h,label) {
    const c=this.ctx,g=this.g,pressed=!!g.input[action],yy=y+(pressed?7:0),gas=action==='gas',ink='#193642';
    this.rect(x+w*.43,yy+h-3,w*.14,this.h-yy-h+18,5,'#19303b');
    this.line([[x+w*.48,yy+h+5],[x+w*.48,this.h+8]],'rgba(190,211,217,.25)',3);
    c.save();c.shadowColor='rgba(5,23,34,.48)';c.shadowBlur=13;c.shadowOffsetY=6;
    this.rect(x,yy+8,w,h,24,'#213945','#091d27');c.restore();
    const face=c.createLinearGradient(x,yy,x+w,yy+h);
    face.addColorStop(0,pressed?'#91a9b2':'#f4f8f8');face.addColorStop(.4,pressed?'#b2c6ca':'#cbdce0');face.addColorStop(1,'#79939f');
    this.rect(x+3,yy,w-6,h-13,23,face,'#102934');
    this.line([[x+18,yy+15],[x+w-22,yy+15]],'rgba(255,255,255,.85)',3);
    if(gas){for(let i=0;i<4;i++)this.rect(x+23+i*(w-46)/4,yy+20,12,h-53,7,'#3b515b');}
    else for(const [dx,dy,r] of [[.24,.28,12],[.51,.28,12],[.78,.28,12],[.31,.56,11],[.52,.56,11],[.73,.56,11],[.52,.42,8]]){
      this.circle(x+w*dx,yy+h*dy,r,'#2f4853','#728c99',2);
    }
    c.save();c.shadowColor='rgba(7,27,39,.8)';c.shadowBlur=4;
    this.text(label,x+w/2,yy+h+21,25,'#fff',800,'center');c.restore();
    if(g.screen==='playing')this.hit(action,x-12,y-10,w+24,h+80);
  }
  runBar(x,y,w) {
    const g=this.g,c=g.car,ratio=clamp(c.fuel/c.fuelMax,0,1),progress=clamp(c.distance/g.goal,0,1);
    // 固定两行，里程为主、资源为辅；圆角半透明底提高复杂山形上的对比。
    this.rect(x,y,w,108,8,'rgba(245,241,220,.91)');
    this.icon('flag',x+33,y+29,23,'#566b50');this.text(this.routeTitle(),x+55,y+18,Math.min(20,290/this.routeTitle().length),'#566b50');
    const fuelX=x+w-293,fuelColor=ratio<.2?'#ca674f':'#779649';
    this.icon('fuel',fuelX,y+29,23,fuelColor);
    this.rect(fuelX+23,y+22,118,14,7,'#d8ddc7');
    if(ratio>0)this.rect(fuelX+23,y+22,118*ratio,14,7,fuelColor);
    this.text(Math.ceil(ratio*100)+'%',fuelX+153,y+18,21,fuelColor);
    this.circle(x+w-39,y+29,26,'#e5e9d1');this.icon('pause',x+w-39,y+29,23,INK);
    this.hit('pause',x+w-72,y,66,59);
    this.text(Math.min(g.goal,Math.floor(c.distance))+' / '+g.goal+'m',x+22,y+57,27,INK,600);
    const income=g.runCoins+(g.airBonus||0)+(g.mechanics?.bonus||0),pulse=1+(g.coinPulse||0)*.15;
    this.icon('coin',x+w-90,y+73,22*pulse);this.text(income,x+w-70,y+62,20*pulse,INK);
    const trackX=x+22,trackW=w-44;
    this.rect(trackX,y+92,trackW,6,3,'#d4ddbd');
    if(progress>0)this.rect(trackX,y+92,trackW*progress,6,3,'#87a448');
    this.circle(trackX+trackW*progress,y+95,4,'#5b773a');
  }
  helpPortrait() {
    const hh=Math.min(692,this.h-36),{x,y}=this.overlay(620,hh);
    this.text('怎么玩',x+34,y+30,35,INK);this.icon('close',x+574,y+45,28);this.hit('close',x+544,y+15,60,60);
    const rows=[['car','油门向前 · 后退反向同动力'],['air','空中油门抬头 · 后退压头'],['air','左侧跳跃 · 主动越过碎石断口'],['clock','倒地满2秒失败 · 扶正清零'],['leaf','下坡松油滑行 · 留速度爬坡'],['fuel','站内双踏板驻车加油 · 怪雾不停'],['wheel','反向踏板减速 · 双踏板驻车']];
    rows.forEach(([icon,label],i)=>{const yy=y+104+i*(hh-270)/rows.length;this.icon(icon,x+59,yy+22,32,'#615773');this.text(label,x+101,yy+11,25,INK);});
    this.button('audioTest',x+34,y+hh-120,552,56,'开启声音 · 试听金币',false,'sound');
    this.text('手机媒体音量需开启',x+310,y+hh-44,20,'#65745d',400,'center');
  }
  damageGoal(x,y) {
    const g=this.g,limit=g.routeSpec().hitLimit;if(limit===null)return;
    const failed=g.mechanics.hits>limit,color=failed?'#b45d63':'#697c42';
    this.icon('shield',x,y,20,color);this.text(g.mechanics.hits+'/'+limit,x+18,y-10,19,color);
  }
  overlay(w,h) {
    this.g.buttons=[];this.rect(0,0,this.w,this.h,0,'rgba(37,27,48,.64)');const x=(this.w-w)/2,y=(this.h-h)/2;this.panel(x,y,w,h,'#e7dfce',24);return {x,y};
  }
  pauseScreen() {
    const {x,y}=this.overlay(480,340);this.icon('pause',x+240,y+64,46,INK);
    this.button('resume',x+46,y+119,388,68,'继续',true,'play');this.button('home',x+46,y+211,388,59,'返回主页',false,'home');
  }
  finishRibbonEffect() {
    const g=this.g,c=this.ctx,t=clamp((g.time-g.finishRibbon.started)/g.finishRibbon.duration,0,1);
    const x=(START_X+g.goal*10-g.camera.x)*g.viewZoom();
    const y=(g.terrain.height(START_X+g.goal*10)-91-g.camera.y)*g.viewZoom();
    c.save();
    for(let i=0;i<16;i++){
      const angle=i*Math.PI*2/16,reach=28+116*t*(.65+(i%4)*.12),px=x+Math.cos(angle)*reach,py=y+Math.sin(angle)*reach+30*t*t;
      c.globalAlpha=(1-t)*(.6+(i%3)*.13);
      this.star(px,py,i%3===0?7:4,i%2?'#f5d26e':'#fff4d1');
    }
    c.globalAlpha=clamp(Math.min(t*5,(1-t)*5),0,1);
    this.rect(this.w/2-112,Math.max(90,this.h*.18),224,65,18,'rgba(22,48,52,.88)','#fff1d1');
    this.text('冲线！',this.w/2,Math.max(106,this.h*.18)+8,39,'#fff1d1',800,'center');
    c.restore();
  }
  resultScreen() {
    const g=this.g,r=g.result,route=getRoute(r.route);
    const w=560,h=510,x=(this.w-w)/2,y=(this.h-h)/2,next=g.resultAction(),color=r.complete?'#547b4b':'#a57360';
    g.buttons=[];this.rect(0,0,this.w,this.h,0,'rgba(26,46,39,.48)');
    this.rect(x,y,w,h,12,'#f5f1df');
    this.iconButton('campaign',x+w-58,y+16,42,42,'close',false);
    this.circle(x+w/2,y+67,31,r.complete?'#d8e9bd':'#ecd7c6');this.icon(r.complete?'flag':'mountain',x+w/2,y+67,33,color);
    this.icon(r.complete?'check':/怪雾/.test(r.reason)?'fog':/油箱/.test(r.reason)?'fuel':'close',x+w/2-72,y+138,45,color);
    this.text(r.complete?'到站啦':/翻车|倒地/.test(r.reason)?'翻车了':/怪雾/.test(r.reason)?'被追上了':/油箱/.test(r.reason)?'油箱空了':'本趟结束',x+w/2+24,y+118,31,color,500,'center');
    this.text(this.routeTitle(r.route),x+w/2,y+173,Math.min(23,510/this.routeTitle(r.route).length),'#526657',400,'center');
    this.text(Math.min(route.goal,r.distance)+' / '+route.goal+'m',x+w/2,y+218,37,INK,500,'center');
    this.rect(x+48,y+272,w-96,7,4,'#dce3cc');
    if(r.distance>0)this.rect(x+48,y+272,(w-96)*clamp(r.distance/route.goal,0,1),7,4,r.complete?'#86a755':'#c69b77');
    const record=this.routeRecord(r.route);
    this.text(r.complete?(r.personalBest?'新纪录 · ':'用时 ')+r.time.toFixed(1)+'s':'本关最远 '+record.best+'m · '+record.percent+'%',x+w/2,y+296,21,'#526657',400,'center');
    this.icon('coin',x+w/2-53,y+356,24,'#b69749');this.text('+'+r.total,x+w/2-29,y+338,32,INK);this.icon('info',x+w/2+76,y+357,18,'#819075');
    this.hit('rewardInfo',x+w/2-82,y+329,180,52);
    this.text(r.complete?'下一关已解锁':'还差 '+Math.max(0,route.goal-r.distance)+'m 到站',x+w/2,y+391,20,'#526657',400,'center');
    this.button('tune',x+28,y+434,147,54,'改装',false);
    this.button(r.complete?next:'retry',x+189,y+434,343,54,r.complete?(next==='next'?'下一关':'返回地图'):'再试一次',true,'play');
  }
  help() { this.helpPortrait(); }

}
module.exports = { Renderer };
