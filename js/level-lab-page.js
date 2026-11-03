(async()=>{
 const $=id=>document.getElementById(id);
 const modules={};
 for(const name of ['config','level-lab']){
  const response=await fetch('./js/'+name+'.js',{cache:'no-store'});
  if(!response.ok)throw new Error('无法加载 '+name);
  const module={exports:{}};
  new Function('module','exports','require',await response.text())(module,module.exports,id=>modules[id.replace('./','')]);
  modules[name]=module.exports;
 }
 const {getRoute,VEHICLES,MAX_ROUTE}=modules.config;
 const {levelProfile}=modules['level-lab'];
 const roleNames={cruise:'热身',sprint:'疾驰',air:'飞越',grip:'技术',fuel:'续航',chase:'追逐'};
 const params=new URLSearchParams(location.search);
 let stage=Math.max(0,Math.min(MAX_ROUTE,(Number(params.get('stage'))||1)-1));
 let stagePage=Math.min(2,Math.floor(stage/18));
 let seenResult=null;
 const records=(()=>{try{return JSON.parse(localStorage.getItem('wildroad-level-lab-v1')||'{}')}catch{return {}}})();
 const vehicle=$('vehicle');
 VEHICLES.forEach((v,i)=>{const option=document.createElement('option');option.value=i;option.textContent=v.name;vehicle.append(option)});
 vehicle.value='6';
 const text=(id,value)=>{$(id).textContent=value};
 const choose=index=>{stage=Math.max(0,Math.min(MAX_ROUTE,index));stagePage=Math.min(2,Math.floor(stage/18));$('stage-number').value=stage+1;history.replaceState(null,'','?stage='+(stage+1));render();run();if(innerWidth<=900)document.querySelector('.viewer').scrollIntoView({behavior:'smooth',block:'start'})};
 const card=(index,container)=>{
  const p=levelProfile(index),button=document.createElement('button');button.className='stage'+(index===stage?' active':'');
  const record=records[index];
  const title=document.createElement('strong');title.textContent=`${index+1}. ${p.route.name}`;
  const detail=document.createElement('small');detail.textContent=`${roleNames[p.route.type]||p.route.type} · ${p.route.goal}m · 指标 ${p.score}${record?' · '+(record.complete?'已通过':'最近失败'):''}`;
  button.append(title,detail);button.onclick=()=>choose(index);container.append(button);
 };
 const render=()=>{
  const p=levelProfile(stage),r=p.route;
  $('stage-number').value=stage+1;
  text('playing-title',`第 ${stage+1} 关`);text('route-name',`第 ${stage+1} 关 · ${r.name}`);
  const authored=r.spec.authored;
  text('route-hint',(r.spec.hint||'抵达终点')+(authored?`。另有 ${authored.rugged?.length||0} 段手工坡面、${authored.branches?.length||0} 处分叉，未计入简化指标。`:''));
  const labels={distance:'路程',terrain:'坡度',features:'怪路',hazards:'危险',chase:'追雾',endurance:'续航'};
  $('metrics').replaceChildren();
  for(const [key,label] of Object.entries(labels)){
   const div=document.createElement('div');div.className='metric';
   const value=document.createElement('b');value.textContent=p.components[key];
   const caption=document.createElement('span');caption.textContent=label;div.append(value,caption);$('metrics').append(div);
  }
  $('stage-pages').replaceChildren();
  for(let page=0;page<3;page++){const button=document.createElement('button');button.textContent=`${page*18+1}–${page*18+18} 关`;button.setAttribute('aria-pressed',String(page===stagePage));button.style.background=page===stagePage?'#ed936a':'';button.onclick=()=>{stagePage=page;render()};$('stage-pages').append(button)}
  const pageStart=stagePage*18,scores=Array.from({length:18},(_,i)=>levelProfile(pageStart+i).score),max=Math.max(...scores);
  $('chart').replaceChildren();scores.forEach((score,i)=>{const index=pageStart+i,bar=document.createElement('button');bar.className='bar'+(index===stage?' active':'');bar.style.height=Math.max(7,score/max*100)+'%';bar.dataset.title=`第 ${index+1} 关 · ${score}`;bar.title=bar.dataset.title;bar.setAttribute('aria-label',bar.title);bar.onclick=()=>choose(index);$('chart').append(bar)});
  $('stages').replaceChildren();for(let i=pageStart;i<pageStart+18;i++)card(i,$('stages'));
  $('nearby').replaceChildren();const first=Math.max(18,Math.min(MAX_ROUTE-11,stage>=18?stage-5:18));
  for(let i=first;i<=Math.min(MAX_ROUTE,first+11);i++)card(i,$('nearby'));
 };
 const run=()=>{
  seenResult=null;text('result','驾驶中；结束后在这里显示结果。');
  const query=new URLSearchParams({labStage:String(stage),labVariant:$('variant').value,labVehicle:vehicle.value,labBuild:$('build').value});
  $('game-frame').src='./index.html?'+query;
 };
 $('go').onclick=()=>choose((Number($('stage-number').value)||1)-1);
 $('stage-number').onkeydown=e=>{if(e.key==='Enter')$('go').click()};
 $('previous').onclick=()=>choose(stage-1);$('next').onclick=()=>choose(stage+1);
 $('clear-record').onclick=()=>{delete records[stage];try{localStorage.setItem('wildroad-level-lab-v1',JSON.stringify(records))}catch{}render();text('result','已清除本关测试记录；当前试玩可继续。')};
 $('restart').onclick=run;for(const id of ['vehicle','build','variant'])$(id).onchange=run;
 setInterval(()=>{
  const game=$('game-frame').contentWindow?.wildroad,result=game?.result;
  if(!result||result===seenResult)return;
  seenResult=result;
  const resultStage=game.save.route;
  if(resultStage!==stage)return;
  records[resultStage]={complete:result.complete,distance:result.distance,time:result.time,reason:result.reason};
  try{localStorage.setItem('wildroad-level-lab-v1',JSON.stringify(records))}catch{}
  text('result',`${result.complete?'已通关':'未通关'} · ${result.distance}/${game.goal}m · ${result.time.toFixed(1)}秒${result.complete?'':' · '+result.reason}`);
  render();
 },500);
 render();run();
})().catch(error=>{document.getElementById('error').textContent='测试台加载失败：'+error.message;console.error(error)});
