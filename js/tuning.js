const { Car, STEP } = require('./physics');
const { upgradePreview } = require('./config');
function testTerrain(id) {
  return {
    height(x) { return 420; },
    slope() { return 0; }
  };
}
function benchmark(id,upgrades,vehicle) {
  const terrain=testTerrain(id),car=new Car(terrain,upgrades,vehicle),frames=[];
  for(let i=0;i<72;i++)car.step(STEP,{});
  car.fuel=car.fuelMax;
  const startX=car.x,startY=terrain.height(car.x);
  if(id==='tires')car.vx=400;
  if(id==='suspension'){car.y-=105;car.vy=0;}
  let reached=null,stable=0,elapsed=0,touched=false,rebound=0;
  const limit=id==='tank'?car.fuelMax/car.stats.burn+5:6;
  for(let i=0;i<limit/STEP;i++) {
    car.gripScale=id==='tires'?.48*car.stats.softGrip:1;
    car.step(STEP,{gas:id!=='suspension'&&id!=='tires',brake:id==='tires',park:id==='tires'});elapsed+=STEP;
    if(i%4===0&&elapsed<=4.05)frames.push({x:car.x-startX,y:car.y,angle:car.angle,spin:car.wheelSpin,fuel:car.fuel/car.fuelMax,wheels:car.wheels.map(w=>w.compression)});
    if(id==='engine')reached=Math.max(reached||0,car.vx*.36);
    if(id==='suspension') {
      if(car.contacts>0)touched=true;if(touched&&car.vy<0)rebound-=car.vy*STEP;
      const settled=car.contacts===car.stats.wheelOffsets.length&&Math.abs(car.vy)<5&&Math.abs(car.omega)<.12;
      stable=settled?stable+STEP:0;if(stable>.25&&reached===null)reached=elapsed-.25;
    }
    if(id==='tires'&&reached===null&&car.vx<=15)reached=(car.x-startX)/10;
    if(id==='tank'&&car.fuel<=0){reached=elapsed;break;}
  }
  return {frames,value:id==='suspension'?rebound/10:reached,terrain};
}
function compareUpgrade(id,upgrades,vehicle) {
  const info=upgradePreview(id,upgrades,vehicle),a=benchmark(id,upgrades,vehicle),b=benchmark(id,info.next,vehicle);
  const label={engine:'平路 6 秒最高车速',tires:'泥地同速制动距离',suspension:'同一落差的回弹距离',tank:'满油全油门续航'}[id];
  const unit=id==='engine'?'km/h':['tires','suspension'].includes(id)?'m':'s';
  const format=v=>v===null?'未达到':v.toFixed(2)+unit;
  return {id,vehicle,info,label,values:[format(a.value),format(b.value)],runs:[a,b],duration:4};
}
module.exports={benchmark,compareUpgrade,testTerrain};
