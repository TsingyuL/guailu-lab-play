(async()=>{
  const $=id=>document.getElementById(id),modules={};
  for(const name of ['config']){
    const response=await fetch('./js/'+name+'.js',{cache:'no-store'});
    if(!response.ok)throw new Error('无法加载关卡数据');
    const module={exports:{}};
    new Function('module','exports','require',await response.text())(module,module.exports,id=>modules[id.replace('./','')]);
    modules[name]=module.exports;
  }
  const {getRoute,VEHICLES,MAX_ROUTE}=modules.config;
  const limit=MAX_ROUTE+1,params=new URLSearchParams(location.search);
  const bound=value=>Math.min(limit,Math.max(1,Number.isFinite(Number(value))?Math.floor(Number(value)):1));
  let stage=bound(params.get('stage')||1),page=Math.floor((stage-1)/18),seenResult=null;
  const vehicle=$('vehicle');
  VEHICLES.forEach((item,index)=>{const option=document.createElement('option');option.value=index;option.textContent=item.name;vehicle.append(option)});
  vehicle.value='6';
  const gameUrl=()=>{
    const query=new URLSearchParams({labStage:String(stage-1),labVehicle:vehicle.value,labBuild:$('build').value,labVariant:'0'});
    return './index.html?'+query;
  };
  const play=()=>{
    seenResult=null;$('status').textContent='驾驶中：到达终点或失败后会显示本次结果。';
    const url=gameUrl();$('game-frame').src=url;$('fullscreen').href=url;
  };
  const render=()=>{
    const route=getRoute(stage-1),first=page*18+1,last=Math.min(limit,first+17);
    $('stage-number').value=stage;$('playing-title').textContent=`第 ${stage} 关 · ${route.name}`;
    $('play-meta').textContent=`${route.goal}m · ${stage<=18?'手工关卡':'生成关卡'} · ${route.spec.hint||'抵达终点'}`;
    $('chapter-title').textContent=first===1?'手工关卡':first<=54?'主题关卡':'生成关卡';
    $('chapter-range').textContent=`第 ${first}–${last} 关 / 共 ${limit} 关`;
    $('stage-cards').replaceChildren();
    for(let number=first;number<=last;number++){
      const item=getRoute(number-1),button=document.createElement('button');button.className='stage'+(number===stage?' selected':'');button.type='button';button.setAttribute('aria-current',number===stage?'true':'false');
      const title=document.createElement('b'),detail=document.createElement('small');title.textContent=`${number}. ${item.name.split(' · ').pop()}`;detail.textContent=`${item.goal}m · ${number<=18?'手工关卡':'生成关卡'}`;
      button.append(title,detail);button.onclick=()=>select(number);$('stage-cards').append(button);
    }
    $('page-previous').disabled=page===0;$('page-next').disabled=last===limit;
  };
  const select=value=>{
    stage=bound(value);page=Math.floor((stage-1)/18);
    history.replaceState(null,'','?stage='+stage);render();play();
    if(innerWidth<=940)$('play').scrollIntoView({behavior:'smooth',block:'start'});
  };
  $('go').onclick=()=>select($('stage-number').value);
  $('stage-number').onkeydown=event=>{if(event.key==='Enter')select($('stage-number').value)};
  $('previous').onclick=()=>select(stage-1);$('next').onclick=()=>select(stage+1);
  $('page-previous').onclick=()=>select(Math.max(1,(page-1)*18+1));
  $('page-next').onclick=()=>select(Math.min(limit,(page+1)*18+1));
  document.querySelectorAll('[data-jump]').forEach(button=>button.onclick=()=>select(button.dataset.jump));
  $('restart').onclick=play;$('retry').onclick=play;vehicle.onchange=play;$('build').onchange=play;
  setInterval(()=>{
    const game=$('game-frame').contentWindow?.wildroad,result=game?.result;
    if(!result||result===seenResult||game.save.route!==stage-1)return;
    seenResult=result;
    $('status').textContent=`${result.complete?'挑战成功':'挑战结束'} · ${result.distance}/${game.goal}m · ${result.time.toFixed(1)} 秒${result.complete?'':' · '+result.reason}`;
  },500);
  render();play();
})().catch(error=>{document.getElementById('error').textContent='关卡入口加载失败：'+error.message;console.error(error)});
