import assert from 'node:assert/strict';

/** Regression scenarios for direct orders, annual work, generated cargo and winter defenses. */
export async function runDefenseChecks({check,ev,shot,button,until,call}) {
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await ev('g.renderer.resize()');
  await check('global Hunt and Herbs interrupt employed workers immediately',async()=>{
    const r=await ev(`(()=>{econReset();const garden=g.buildingSystem.placeStartingBuilding('garden',42,27),fur=g.buildingSystem.placeStartingBuilding('furWorkshop',35,32);const [a,b]=g.villagerSystem.villagers;g.villagerSystem.assignVillagerToBuilding(a.id,garden.id,g.buildingSystem.buildings);g.villagerSystem.assignVillagerToBuilding(b.id,fur.id,g.buildingSystem.buildings);g.selectedVillagerId=null;g.goHunting();g.gatherHerbs();return{tasks:[a.currentTask,b.currentTask],rosters:[garden.assignedWorkers.length,fur.assignedWorkers.length],paths:[a.path.length,b.path.length]};})()`);
    assert.deepEqual(new Set(r.tasks),new Set(['hunting','gatheringHerbs']));assert.deepEqual(r.rosters,[0,0]);assert(r.paths.every(n=>n>0));return r;
  });
  await check('Clear immediately finds the nearest tree and continues with the next one',async()=>{
    const r=await ev(`(()=>{econReset();g.toggleClearMode();const v=g.villagerSystem.getAliveVillagers().find(v=>v.currentTask==='clearing');const first={x:v.targetX,y:v.targetY};const d=Math.hypot(v.x-first.x,v.y-first.y);const minimum=Math.min(...g.tileMap.tiles.flatMap((row,y)=>row.flatMap((t,x)=>t.type==='forest'?[Math.hypot(v.x-x,v.y-y)]:[])));Object.assign(v,{x:first.x,y:first.y,path:[],state:'working'});g.updateForestClearing(balance.villagers.clearForestTime+.1);g.updateForestClearing(balance.villagers.clearingDispatchInterval+.1);return{d,minimum,mode:g.mode,next:v.currentTask,firstCleared:g.tileMap.getTile(first.x,first.y).type==='clear',repeat:v.repeatClearing};})()`);
    assert.equal(r.d,r.minimum);assert.equal(r.mode,'clear');assert(r.firstCleared&&r.repeat);assert.equal(r.next,'clearing');return r;
  });
  await check('one resident leaves shelter and receives a job while everyone else stays inside',async()=>{
    await ev('econReset();g.resourceSystem.resources.food=50;g.returnHome()');
    await until('g.villagerSystem.getAliveVillagers().every(v=>g.isVillagerInShelter(v.id))',15);
    await button('Release one');
    const r=await ev(`(()=>{const v=g.villagerSystem.getVillagerById(g.selectedVillagerId),other=g.villagerSystem.getAliveVillagers().find(o=>o.id!==v.id);const selected=v.id,exempt=v.shelterExempt,job=g.jobsFor(v.id).find(j=>j.kind==='chop');g.executeVillagerJob(job.key);for(let i=0;i<30;i++)g.update(.05);return{selected,exempt,task:v.currentTask,path:v.path.length,global:g.stayInShelterMode,otherInside:g.isVillagerInShelter(other.id),otherTask:other.currentTask};})()`);
    assert(r.exempt&&r.global&&r.otherInside);assert.equal(r.task,'clearing');assert.equal(r.otherTask,null);return r;
  });
  await check('a carrier completes delivery before a queued manual hunting order',async()=>{
    const r=await ev(`(()=>{econReset();const people=g.villagerSystem.getAliveVillagers();for(const v of people)Object.assign(v,{x:39,y:29,path:[],currentTask:'returnHome',cargo:{food:5,fur:1,herbs:0}});const food=g.resourceSystem.resources.food;g.goHunting();const queued=people.filter(v=>v.queuedExpedition==='hunt').length;forageTick(0);g.updateQueuedOrders();return{queued,food:g.resourceSystem.resources.food-food,hunters:people.filter(v=>v.currentTask==='hunting').length,cargo:people.some(v=>v.cargo)};})()`);
    assert.equal(r.queued,1);assert.equal(r.food,10);assert.equal(r.hunters,1);assert(!r.cargo);return r;
  });
  await check('annual farming, clearing and unfinished construction resume but expeditions do not',async()=>{
    const r=await ev(`(()=>{econReset();const garden=g.buildingSystem.placeStartingBuilding('garden',42,27),site=g.buildingSystem.placeBuilding('hut',35,32);const [farmer,chopper]=g.villagerSystem.villagers,builder=g.villagerSystem.spawnVillager(38,27),hunter=g.villagerSystem.spawnVillager(38,27);g.villagerSystem.assignVillagerToBuilding(farmer.id,garden.id,g.buildingSystem.buildings);g.startNearestClearing(chopper.id);g.dispatchBuilder(builder.id,site.id);g.villagerSystem.sendVillagerToHunt(hunter.id);g.returnHome();const saved=JSON.parse(JSON.stringify(g.serializeState()));g.deserializeState(saved);g.seasonSystem.season='winter';g.seasonSystem.seasonTimer=balance.seasons.winterDuration-.01;g.seasonSystem.update(.02);return{tasks:g.villagerSystem.getAliveVillagers().map(v=>v.currentTask),annual:g.villagerSystem.getAliveVillagers().map(v=>v.annualJob?.task??null),sheltered:g.stayInShelterMode};})()`);
    assert.deepEqual(r.tasks,['farming','clearing','building',null]);assert(!r.sheltered);return r;
  });
  await check('injured residents regenerate past the healthy threshold up to full HP',async()=>{
    const r=await ev(`(()=>{econReset();const v=g.villagerSystem.villagers[0];v.hp=45;v.health='injured';g.villagerSystem.update(20,g.buildingSystem.buildings,false,g.buildingSystem.getHousingTiles());const intermediate=v.hp;g.villagerSystem.update(1000,g.buildingSystem.buildings,false,g.buildingSystem.getHousingTiles());return{intermediate,hp:v.hp,max:v.maxHp,health:v.health};})()`);
    assert(r.intermediate>45);assert.equal(r.hp,r.max);assert.equal(r.health,'healthy');return r;
  });
  await check('finished moat is walkable and slows monsters exactly sixfold; unfinished ditch does not',async()=>{
    const r=await ev(`(async()=>{econReset();const {HordeNavigation}=await import('/src/systems/HordeNavigation.ts');const moat=g.buildingSystem.placeStartingBuilding('moat',42,27),nav=new HordeNavigation(g.tileMap,g.protectionSystem),make=(x,y)=>({id:'moat-test',x,y,path:[{x:x+1,y}],hp:30,maxHp:30,speed:1,state:'approaching'});const wet=make(42,27),dry=make(42,26);nav.step(wet,.1,[wet]);nav.step(dry,.1,[dry]);const factor=(dry.x-42)/(wet.x-42);const targets=g.buildingSystem.getAttackableBuildingTiles().some(t=>t.buildingId===moat.id);const saved=g.serializeState();g.deserializeState(saved);const restored=g.tileMap.getTile(42,27).moatDug,walkable=g.tileMap.isWalkable(42,27);g.buildingSystem.demolishBuilding(moat.id);const unfinished=g.buildingSystem.placeBuilding('moat',42,27),before=make(42,27);nav.step(before,.1,[before]);return{factor,targets,restored,walkable,unfinished:before.x-42,buildTime:balance.buildings.moat.buildTime};})()`);
    assert(Math.abs(r.factor-6)<1e-8);assert(!r.targets&&r.restored&&r.walkable);assert(Math.abs(r.unfinished-.1)<1e-8);return r;
  });
  await check('only an occupied tower fires; its occupants shelter from cold and retain upgraded durability',async()=>{
    const r=await ev(`(()=>{econReset();const tower=g.buildingSystem.placeStartingBuilding('watchtower',42,27),h=g.hordeSystem;g.villagerSystem.setShelters(g.buildingSystem.getHousingTiles());h.startWinter(2,1);h.enemies=[{id:'tower-target',x:45,y:27,hp:100,maxHp:100,speed:1,state:'approaching',path:[],visible:true}];g.towerCombatSystem.update(.1,g.buildingSystem,g.villagerSystem,h);const empty=h.enemies[0].hp,v=g.villagerSystem.villagers[0];Object.assign(v,{x:42,y:27,path:[],currentTask:null,coldExposure:20});g.towerCombatSystem.update(.1,g.buildingSystem,g.villagerSystem,h);const occupied=h.enemies[0].hp;g.coldSystem.update(5,[v],g.buildingSystem.getHousingTiles(),'winter',false,()=>{throw Error('tower failed shelter');});const cold=v.coldExposure,shots=g.towerCombatSystem.shots.length;const saved=g.serializeState(),old=saved.buildings.find(b=>b.id===tower.id);old.hp=60;old.maxHp=120;g.deserializeState(saved);const restored=g.buildingSystem.buildings.find(b=>b.id===tower.id);return{empty,occupied,cold,shots,max:restored.maxHp,hp:restored.hp,capacity:balance.buildings.watchtower.capacity};})()`);
    assert.equal(r.empty,100);assert.equal(r.occupied,82);assert.equal(r.cold,5);assert.equal(r.shots,1);assert.equal(r.max,360);assert.equal(r.hp,180);assert.equal(r.capacity,3);return r;
  });
  await check('garrison commands send different residents into a tower while the settlement shelters',async()=>{
    await ev(`econReset();g.resourceSystem.resources.food=50;g.buildingSystem.placeStartingBuilding('watchtower',42,27);g.returnHome();`);
    await until('g.villagerSystem.getAliveVillagers().every(v=>g.isVillagerInShelter(v.id))',15);
    await ev(`const tower=g.buildingSystem.getBuildingsOfType('watchtower')[0];g.garrisonTower(tower.id);g.garrisonTower(tower.id);`);
    await until('g.villagerSystem.getAliveVillagers().every(v=>Math.floor(v.x)===42&&Math.floor(v.y)===27)',20);
    const r=await ev('({sheltered:g.stayInShelterMode,residents:g.villagerSystem.getAliveCount(),occupants:g.villagerSystem.getAliveVillagers().filter(v=>Math.floor(v.x)===42&&Math.floor(v.y)===27).length})');
    assert(r.sheltered);assert.equal(r.occupants,r.residents);return r;
  });
  await check('moats can surround every side of a house without blocking residents',async()=>{
    const r=await ev(`(()=>{econReset();const house=g.buildingSystem.buildings[0],tiles=g.buildingSystem.getArrivalTiles(house);let dug=0;for(const p of tiles)if(g.buildingSystem.placeStartingBuilding('moat',p.x,p.y))dug++;const exits=g.buildingSystem.getArrivalTiles(house).length;g.returnHome();return{dug,expected:tiles.length,exits,paths:g.villagerSystem.getAliveVillagers().map(v=>v.path.length)};})()`);
    assert.equal(r.dug,r.expected);assert.equal(r.exits,r.expected);assert(r.paths.every(n=>n>0));return r;
  });
  await check('a spring delivery resumes last year farming rather than another expedition',async()=>{
    const r=await ev(`(()=>{econReset();const {b,v}=farmer();v.annualJob={task:'farming',buildingId:b.id};g.villagerSystem.sendVillagerToHunt(v.id);g.detachVillagerFromPreviousWork(v.id);Object.assign(v,{x:20,y:20,path:[],currentTask:'returnHome',cargo:{food:15,fur:2,herbs:0}});g.leaveShelter();const pending=v.resumeAnnualAfterDelivery;Object.assign(v,{x:39,y:29,path:[]});forageTick(0);g.updateQueuedOrders();return{pending,task:v.currentTask,cargo:v.cargo??null,assigned:v.assignedBuildingId===b.id};})()`);
    assert(r.pending&&r.assigned);assert.equal(r.task,'farming');assert.equal(r.cargo,null);return r;
  });
  await check('garden construction is four times quicker and crops another quarter quicker',async()=>{
    const r=await ev(`(()=>{econReset();const b=g.buildingSystem.placeBuilding('garden',42,27);g.buildingSystem.updateConstruction(5.49/balance.villagers.buildSpeed,()=>1);const before=b.built;g.buildingSystem.updateConstruction(.02/balance.villagers.buildSpeed,()=>1);return{before,built:b.built,buildTime:balance.buildings.garden.buildTime,growth:balance.farming.growthSeasons};})()`);
    assert(!r.before&&r.built);assert.equal(r.buildTime,22/4);assert.equal(r.growth,1.5*.75);return r;
  });
  await check('generated cargo and tower artwork load; ward stock is drawn directly on the fire',async()=>{
    const r=await ev(`(()=>{econReset();g.buildingSystem.placeStartingBuilding('watchtower',42,27);const fire=g.buildingSystem.placeStartingBuilding('herbalFire',35,32);g.buildingSystem.placeStartingBuilding('moat',42,32);g.buildingSystem.placeStartingBuilding('moat',43,32);g.resourceSystem.resources.herbs=3;const [a,b]=g.villagerSystem.villagers;Object.assign(a,{x:40,y:27,currentTask:'returnHome',cargo:{food:0,fur:0,herbs:1}});Object.assign(b,{x:40,y:28,currentTask:'returnHome',cargo:{food:15,fur:2,herbs:0}});const ctx=g.renderer.ctx,original=ctx.fillText,labels=[];ctx.fillText=function(text,...args){labels.push(text);return original.call(this,text,...args);};try{g.updateUI();g.render();}finally{ctx.fillText=original;}const assets=g.renderer.assets;return{loaded:[!!assets.getCargo('herbs'),!!assets.getCargo('hunt'),!!assets.getTower()],different:assets.getCargo('herbs').src!==assets.getCargo('hunt').src,label:labels.some(t=>t==='Herbs 3/4 for winter')};})()`);
    assert(r.loaded.every(Boolean)&&r.different&&r.label);await shot('tower-moat-cargo');return r;
  });
}
