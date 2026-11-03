// Browser level lab and Node checks share the same route analysis.
const {getRoute,MAX_ROUTE,defaultSave,VEHICLES,MAX_LEVEL}=require('./config');
const PARTS=['engine','tires','suspension','tank'];
const clampLab=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(+value)?Math.floor(+value):min));

function createLabSave(stage,variant=0,vehicle=6,build=0){
 const index=clampLab(stage,0,MAX_ROUTE),chosen=clampLab(vehicle,0,VEHICLES.length-1),level=clampLab(build,0,MAX_LEVEL);
 const save=defaultSave();
 save.route=index;save.vehicle=chosen;save.owned=[0,6,chosen];save.sound=false;
 save.firstClears=Array(index+1).fill(true);save.firstClears[index]=false;
 save.roadVariants[index]=clampLab(variant,0,3);
 for(const part of PARTS)save.builds[chosen][part]=level;
 save.upgrades=save.builds[chosen];
 return save;
}

function levelProfile(index){
 const r=getRoute(index);if(!r)return null;
 const spec=r.spec,features=spec.authored?.features?.length??spec.featureCount??0;
 const gap=spec.expedition?.gap||0;
 // An editorial comparison index, not a measured clear rate. Each component
 // is visible so a designer can challenge its weight after playtests.
 const components={distance:Math.round(r.goal/300),terrain:Math.round((spec.lift||0)/12),
  features:features*2,hazards:(spec.hazardCount||0)*3,
  chase:spec.tutorial?.fog===false?0:r.type==='chase'?8:spec.tutorial?.fog?3:2,
  endurance:gap?Math.round(gap/3600):0};
 const score=Object.values(components).reduce((a,b)=>a+b,0);
 return {index,route:r,score,components,features,generated:!!r.generated};
}
module.exports={createLabSave,levelProfile};
