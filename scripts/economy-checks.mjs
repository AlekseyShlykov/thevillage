import assert from 'node:assert/strict';

/** Economy scenarios run in the same silent browser as the main playthrough. */
export async function runEconomyChecks({ check, ev, shot, clickSelector, until }) {
  await ev(`(async()=>{
    const source=part=>performance.getEntriesByType('resource').filter(r=>r.name.includes(part)).at(-1).name;
    window.balance=(await import(source('/src/data/ConfigLoader.ts'))).getConfig();
    window.forecast=(await import(source('/src/systems/ForecastSystem.ts'))).makeForecast;
    window.econReset=()=>{g.restart();g.gameLoop.stop();g.tutorialSystem.skip();};
    window.forageTick=dt=>g.foragingSystem.update(dt,g.villagerSystem,g.buildingSystem,g.resourceSystem,g.techSystem,g.tutorialSystem,()=>{});
    window.cropTick=(dt,season='spring')=>g.cropSystem.update(dt,season,balance.seasons[season+'Duration'],g.buildingSystem,g.villagerSystem,g.resourceSystem,g.techSystem,()=>{});
    window.farmer=()=>{const b=g.buildingSystem.placeStartingBuilding('garden',42,27),v=g.villagerSystem.villagers[0],p=g.buildingSystem.getArrivalTiles(b)[0];Object.assign(v,{x:p.x,y:p.y,state:'working',currentTask:'farming',assignedBuildingId:b.id,path:[]});b.assignedWorkers=[v.id];return{b,v};};
  })()`);

  await check('herb orders reserve at most five supplies including expeditions', async()=>{
    await ev('econReset();g.buildingSystem.placeStartingBuilding("herbalFire",42,27);g.updateUI()');await clickSelector('[data-gather-herbs]');
    assert.equal(await ev('g.villagerSystem.villagers.filter(v=>v.currentTask==="gatheringHerbs").length'),1);
    const r=await ev(`(()=>{for(let i=0;i<6;i++)g.villagerSystem.spawnVillager(39,27);const accepted=g.villagerSystem.villagers.filter(v=>!v.currentTask).map(v=>g.gatherHerbs(v.id));const reserved=g.foragingSystem.reservedHerbs(g.villagerSystem);const victim=g.villagerSystem.villagers.find(v=>v.currentTask==='gatheringHerbs');g.villagerSystem.damageVillager(victim,victim.maxHp);const spare=g.villagerSystem.villagers.find(v=>v.health!=='dead'&&!v.currentTask),replacement=g.gatherHerbs(spare.id);return{accepted,reserved,replacement,after:g.foragingSystem.reservedHerbs(g.villagerSystem),stock:g.resourceSystem.resources.herbs};})()`);
    assert.equal(r.reserved,5);assert.equal(r.accepted.filter(Boolean).length,4);assert(r.replacement);assert.equal(r.after,5);assert.equal(r.stock,0);return r;
  });
  await check('gathered herbs arrive only when a living gatherer reaches home',async()=>{
    await ev('econReset();g.gatherHerbs(g.villagerSystem.villagers[0].id)');
    await until('g.villagerSystem.villagers[0].state==="working"',60);
    const before=await ev(`(()=>{const v=g.villagerSystem.villagers[0];const random=Math.random;try{Math.random=()=>1;forageTick(balance.herbs.gatherSeconds);}finally{Math.random=random;}return{stock:g.resourceSystem.resources.herbs,cargo:v.cargo,returning:v.currentTask,path:v.path.length};})()`);
    assert.equal(before.stock,0);assert.equal(before.cargo.herbs,1);assert.equal(before.returning,'returnHome');assert(before.path>0);
    await until('!g.villagerSystem.villagers[0].cargo',60);
    assert.equal(await ev('g.resourceSystem.resources.herbs'),1);
    const cap=await ev('g.resourceSystem.addHerbs(100);g.resourceSystem.resources.herbs');assert.equal(cap,5);return{before,cap};
  });
  await check('one ward per village includes unfinished construction and survives saving',async()=>{
    const r=await ev(`(()=>{econReset();const b=g.buildingSystem.placeBuilding('herbalFire',42,27);const unfinished=g.buildingSystem.canPlace('herbalFire',35,32);b.built=true;b.buildProgress=1;const built=g.buildingSystem.canPlace('herbalFire',35,32);g.resourceSystem.resources.herbs=4;g.seasonSystem.season='winter';g.protectionSystem.advance(7,g.buildingSystem.buildings,g.resourceSystem,'winter');const fuel=b.wardFuelSeconds;const state=g.serializeState();g.deserializeState(state);const restored=g.buildingSystem.getBuildingsOfType('herbalFire')[0];return{unfinished,built,fuel,restoredFuel:restored.wardFuelSeconds,stock:g.resourceSystem.resources.herbs,active:restored.wardActive};})()`);
    assert(!r.unfinished&&!r.built);assert.equal(r.fuel,23);assert.equal(r.restoredFuel,23);assert.equal(r.stock,3);assert(r.active);return r;
  });
  await check('four herbs fuel exactly a winter and an empty fire provides no field',async()=>{
    const r=await ev(`(()=>{econReset();const b=g.buildingSystem.placeStartingBuilding('herbalFire',42,27),ward=g.protectionSystem;ward.advance(0,g.buildingSystem.buildings,g.resourceSystem,'winter');const empty=ward.zones.length;g.resourceSystem.resources.herbs=4;ward.advance(balance.seasons.winterDuration-.1,g.buildingSystem.buildings,g.resourceSystem,'winter');const last={active:b.wardActive,fuel:b.wardFuelSeconds,stock:g.resourceSystem.resources.herbs};ward.advance(.11,g.buildingSystem.buildings,g.resourceSystem,'winter');const exhausted=!b.wardActive&&ward.zones.length===0;g.resourceSystem.resources.herbs=5;b.wardFuelSeconds=0;ward.advance(balance.seasons.winterDuration,g.buildingSystem.buildings,g.resourceSystem,'winter');const spare=g.resourceSystem.resources.herbs;ward.advance(10,g.buildingSystem.buildings,g.resourceSystem,'summer');return{empty,last,exhausted,spare,warmActive:b.wardActive};})()`);
    assert.equal(r.empty,0);assert(r.last.active&&r.last.fuel>0);assert.equal(r.last.stock,0);assert(r.exhausted);assert.equal(r.spare,1);assert(!r.warmActive);return r;
  });
  await check('permanent personal tools require no workshop, stock or replacement',async()=>{
    const r=await ev(`(()=>{econReset();const people=g.villagerSystem.villagers;g.resourceSystem.resources.tools=0;for(const v of people)Object.assign(v,{state:'working',currentTask:'working',toolDurability:0});g.equipmentSystem.update(1000,people,g.resourceSystem,'summer');return{removed:!balance.buildings.workshop&&!balance.technology.techs.workshop&&!balance.technology.techs.betterTools,costs:Object.values(balance.buildings).map(b=>b.costTools),stock:g.resourceSystem.resources.tools};})()`);
    assert(r.removed);assert(r.costs.every(n=>n===0));assert.equal(r.stock,0);return r;
  });
  await check('all healthy farmers work at full speed without spare tools',async()=>{
    const r=await ev(`(()=>{econReset();const {b,v}=farmer(),other=g.villagerSystem.villagers[1];Object.assign(other,{...v,id:other.id,toolDurability:0});v.toolDurability=100;const measure=person=>{g.villagerSystem.villagers=[person];b.cropState='empty';b.sowingProgress=0;cropTick(1);return b.sowingProgress;};return{equipped:measure(v),bare:measure(other)};})()`);
    assert.equal(r.bare,1);assert.equal(r.equipped,r.bare);return r;
  });
  await check('raw pelts must be crafted and clothing wears by winters per person',async()=>{
    const r=await ev(`(()=>{econReset();const people=g.villagerSystem.villagers;g.resourceSystem.resources.fur=20;g.equipmentSystem.issue(people,g.resourceSystem);const rawWarm=people.some(v=>(v.clothingWintersLeft??0)>0);g.resourceSystem.resources.clothing=1;g.equipmentSystem.issue(people,g.resourceSystem);const coverage=people.filter(v=>(v.clothingWintersLeft??0)>0).length;g.resourceSystem.resources.clothing=2;g.equipmentSystem.update(balance.seasons.winterDuration,[people[0]],g.resourceSystem,'winter');return{rawWarm,coverage,left:people[0].clothingWintersLeft,stored:g.resourceSystem.resources.clothing,lifetime:balance.equipment.clothingLifetimeWinters};})()`);
    assert(!r.rawWarm);assert.equal(r.coverage,1);assert.equal(r.left,r.lifetime-1);assert.equal(r.stored,2);return r;
  });
  await check('cold kills unclothed residents, shelter warms them and worn coats protect',async()=>{
    const r=await ev(`(()=>{econReset();g.villagerSystem.spawnVillager(38,27);g.resourceSystem.resources.fur=100;const [bare,coated,warming]=g.villagerSystem.villagers;Object.assign(bare,{x:30,y:30,coldExposure:0});Object.assign(coated,{x:30,y:31,coldExposure:0,clothingWintersLeft:3});Object.assign(warming,{x:39,y:29,coldExposure:20});const dead=[];const kill=v=>{dead.push(v.id);g.villagerSystem.damageVillager(v,v.maxHp);};g.coldSystem.update(balance.cold.unclothedSurvivalSeconds+.1,[bare],[],'winter',false,kill);g.coldSystem.update(balance.seasons.winterDuration,[coated],[],'winter',false,kill);g.coldSystem.update(5,[warming],[{x:39,y:29}],'winter',false,kill);return{dead,bareId:bare.id,coatExposure:coated.coldExposure,coatAlive:coated.health!=='dead',warmExposure:warming.coldExposure};})()`);
    assert.deepEqual(r.dead,[r.bareId]);assert(r.coatAlive);assert.equal(r.coatExposure,12);assert.equal(r.warmExposure,5);return r;
  });
  await check('crops ripen after 1.125 calendar seasons, 25% faster',async()=>{
    const r=await ev(`(()=>{econReset();const {b,v}=farmer();cropTick(balance.farming.sowingWorkSeconds);v.toolDurability=200;cropTick(balance.seasons.springDuration);const afterSpring=b.farmingProgress;v.currentTask=null;cropTick(balance.seasons.summerDuration*(balance.farming.growthSeasons-1-.001),'summer');const beforeRipe=b.cropState;cropTick(balance.seasons.summerDuration*.002,'summer');const ripe=b.cropState;return{afterSpring,beforeRipe,ripe,food:g.resourceSystem.resources.food,growth:balance.farming.growthSeasons};})()`);
    assert(Math.abs(r.afterSpring-1/r.growth)<1e-8);assert.equal(r.beforeRipe,'growing');assert.equal(r.ripe,'ripe');return r;
  });
  await check('winter destroys every unharvested crop and sowing resumes only in spring',async()=>{
    const r=await ev(`(()=>{econReset();const {b}=farmer();b.cropState='ripe';b.farmingProgress=1;b.harvestRemaining=45;g.cropSystem.winter(g.buildingSystem.buildings);cropTick(100,'winter');const frozen={state:b.cropState,progress:b.farmingProgress,sown:b.sowingProgress};cropTick(balance.farming.sowingWorkSeconds,'spring');return{frozen,spring:b.cropState};})()`);
    assert.deepEqual(r.frozen,{state:'withered',progress:0,sown:0});assert.equal(r.spring,'growing');return r;
  });
  await check('ripe crops wait for storage and partial harvests cannot duplicate food',async()=>{
    const r=await ev(`(()=>{econReset();const {b}=farmer();b.cropState='ripe';b.farmingProgress=1;b.harvestRemaining=balance.farming.harvestFood;g.resourceSystem.resources.food=g.resourceSystem.capacity.food;cropTick(balance.farming.harvestWorkSeconds);const full=b.harvestRemaining;g.resourceSystem.resources.food-=10;cropTick(1);const partial=b.harvestRemaining,food=g.resourceSystem.resources.food;const state=g.serializeState();g.deserializeState(state);const restored=g.buildingSystem.getBuildingsOfType('garden')[0];cropTick(1);return{full,partial,food,afterLoad:restored.harvestRemaining,afterFood:g.resourceSystem.resources.food,capacity:g.resourceSystem.capacity.food};})()`);
    assert.equal(r.full,45);assert.equal(r.partial,35);assert.equal(r.food,r.capacity);assert.equal(r.afterLoad,35);assert.equal(r.afterFood,r.capacity);return r;
  });
  await check('science comes only from survived winters: five single stars then doubles',async()=>{
    const r=await ev(`(()=>{econReset();const initial=g.resourceSystem.resources.techPoints;g.buildingSystem.placeStartingBuilding('garden',42,27);for(let i=0;i<8;i++)g.villagerSystem.spawnVillager(38,27);g.checkLevelUp();const afterBuildLevel=g.resourceSystem.resources.techPoints,rewards=[];for(let year=1;year<=7;year++){g.gameOver=false;g.seasonSystem.season='winter';g.seasonSystem.year=year;g.seasonSystem.seasonTimer=balance.seasons.winterDuration-.01;const before=g.resourceSystem.resources.techPoints;g.seasonSystem.update(.02);rewards.push(g.resourceSystem.resources.techPoints-before);}const data=g.serializeState();g.deserializeState(data);const afterLoad=g.resourceSystem.resources.techPoints;return{initial,afterBuildLevel,rewards,afterLoad,last:g.lastRewardedWinter};})()`);
    assert.equal(r.initial,0);assert.equal(r.afterBuildLevel,0);assert.deepEqual(r.rewards,[1,1,1,1,1,2,2]);assert.equal(r.afterLoad,9);assert.equal(r.last,7);return r;
  });
  await check('hunting cargo persists without aliasing or early deposits and death loses it',async()=>{
    const r=await ev(`(()=>{econReset();const v=g.villagerSystem.villagers[0];Object.assign(v,{x:20,y:20,path:[],state:'idle',currentTask:'returnHome',cargo:{food:15,fur:2,herbs:0}});const food=g.resourceSystem.resources.food,fur=g.resourceSystem.resources.fur,saved=g.serializeState();v.cargo.food=1;const independent=saved.villagers[0].cargo.food===15;g.deserializeState(saved);const restored=g.villagerSystem.villagers[0];restored.cargo.fur=3;const loadIndependent=saved.villagers[0].cargo.fur===2;forageTick(0);const noEarly=g.resourceSystem.resources.food===food&&g.resourceSystem.resources.fur===fur;g.villagerSystem.damageVillager(restored,restored.maxHp);forageTick(0);return{independent,loadIndependent,noEarly,food:g.resourceSystem.resources.food,fur:g.resourceSystem.resources.fur,expectedFood:food,expectedFur:fur};})()`);
    assert(r.independent&&r.loadIndependent&&r.noEarly);assert.equal(r.food,r.expectedFood);assert.equal(r.fur,r.expectedFur);return r;
  });
  await check('a stranded carrier retries delivery after a house is rebuilt',async()=>{
    const r=await ev(`(()=>{econReset();const v=g.villagerSystem.villagers[0];Object.assign(v,{x:35,y:29,path:[],state:'idle',currentTask:'returnHome',cargo:{food:15,fur:2,herbs:0}});g.buildingSystem.demolishBuilding(g.buildingSystem.buildings[0].id);g.villagerSystem.update(.05,g.buildingSystem.buildings,false,[]);forageTick(0);const waiting=v.currentTask;g.buildingSystem.placeStartingBuilding('hut',39,29);g.villagerSystem.setShelters(g.buildingSystem.getHousingTiles());forageTick(0);g.returnHome();g.leaveShelter();return{waiting,returning:v.currentTask,path:v.path.length,cargo:v.cargo};})()`);
    assert.equal(r.waiting,'returnHome');assert.equal(r.returning,'returnHome');assert(r.path>0);assert.equal(r.cargo.food,15);return r;
  });
  await check('winter forecasts distinguish clothes, cargo and crops that cannot mature',async()=>{
    const r=await ev(`(()=>{econReset();while(g.villagerSystem.getAliveCount()<10)g.villagerSystem.spawnVillager(38,27);g.resourceSystem.resources.fur=100;const {b,v}=farmer();b.cropState='growing';b.farmingProgress=.1;g.seasonSystem.season='autumn';g.seasonSystem.seasonTimer=0;v.cargo={food:15,fur:2,herbs:1};const f=forecast(g.seasonSystem,g.resourceSystem,g.buildingSystem,g.villagerSystem);g.updateUI();return{...f,nextHarvestSeconds:Number.isFinite(f.nextHarvestSeconds)?f.nextHarvestSeconds:'after-winter'};})()`);
    assert(Math.abs(r.winterFood-72)<1e-8);assert.equal(r.coats,0);assert.equal(r.herbsNeeded,4);assert.equal(r.herbsInTransit,1);assert.equal(r.expectedHarvest,0);assert.equal(r.dyingCrops,1);assert.equal(r.nextStars,1);
    await clickSelector('#game-forecast summary');assert(await ev('document.getElementById("game-forecast").open'));await shot('economy-forecast');
    const late=await ev(`(()=>{const b=g.buildingSystem.getBuildingsOfType('garden')[0];b.cropState='ripe';b.farmingProgress=1;b.harvestProgress=0;g.seasonSystem.seasonTimer=balance.seasons.autumnDuration-1;return forecast(g.seasonSystem,g.resourceSystem,g.buildingSystem,g.villagerSystem).expectedHarvest;})()`);
    assert.equal(late,0);return r;
  });
}
