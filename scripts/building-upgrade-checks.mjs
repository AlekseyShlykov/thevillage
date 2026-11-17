import assert from 'node:assert/strict';

/** In-place upgrades, research previews and migration through the running game. */
export async function runBuildingUpgradeChecks({check,ev,shot,call,clickSelector,button,until,mouse}) {
  await call('Emulation.setTouchEmulationEnabled',{enabled:false});
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await ev('g.renderer.resize()');

  await check('the compact catalogue removes surplus research and keeps House out of the build menu',async()=>{
    const r=await ev(`(()=>{econReset();for(const id of Object.keys(balance.technology.techs))g.techSystem.unlockTech(id);g.refreshBuildPanel();return{buildings:Object.keys(balance.buildings),techs:Object.keys(balance.technology.techs),menu:[...document.querySelectorAll('[data-building-id]')].map(el=>el.dataset.buildingId)};})()`);
    for(const id of ['smokehouse','largeHouse','hearth','reinforcedPalisade'])assert(!r.buildings.includes(id)&&!r.techs.includes(id)&&!r.menu.includes(id));
    assert(r.techs.includes('house')&&!r.menu.includes('house'));
    for(const id of ['hut','garden','moat','storage','furWorkshop','herbalFire','lumberCamp','watchtower','campFire','palisadeWall','palisadeGate'])assert(r.menu.includes(id),id);
    return r;
  });

  await check('tower appears beside Sawmill but cannot be researched until the mill is completed',async()=>{
    await ev(`econReset();for(const id of ['storage','furWorkshop','palisade','herbalFire'])g.techSystem.unlockTech(id);g.resourceSystem.resources.techPoints=20;g.updateUI()`);
    await button('Tech');
    const initial=await ev(`(()=>{const tower=document.querySelector('[data-tech-id=watchtower]');return{visible:!!tower,mill:!!document.querySelector('[data-tech-id=lumberCamp]'),disabled:tower.getAttribute('aria-disabled'),title:tower.title,text:tower.textContent};})()`);
    assert(initial.visible&&initial.mill);assert.equal(initial.disabled,'true');assert.match(initial.title,/Research Sawmill/);
    await clickSelector('[data-tech-id=watchtower]');
    assert(await ev('g.resourceSystem.resources.techPoints===20&&!g.techSystem.isTechUnlocked("watchtower")&&g.ui.isTechPanelOpen()'));
    await shot('tower-locked-beside-sawmill');await clickSelector('[data-tech-id=lumberCamp]');
    await ev("window.testMill=g.buildingSystem.placeBuilding('lumberCamp',42,27);g.updateUI()");await button('Tech');
    assert.match(await ev("document.querySelector('[data-tech-id=watchtower]').title"),/Complete a Sawmill/);
    assert.equal(await ev("document.querySelector('[data-tech-id=watchtower]').getAttribute('aria-disabled')"),'true');
    await ev('testMill.built=true;testMill.buildProgress=1;g.updateUI()');
    assert.equal(await ev("document.querySelector('[data-tech-id=watchtower]').getAttribute('aria-disabled')"),'false');
    await clickSelector('[data-tech-id=watchtower]');
    assert(await ev('g.techSystem.isTechUnlocked("watchtower")&&g.resourceSystem.resources.techPoints===15&&!g.ui.isTechPanelOpen()'));
    return initial;
  });

  await check('a real Hut action starts an on-site upgrade while residents keep their shelter',async()=>{
    const pos=await ev(`(()=>{econReset();g.techSystem.unlockTech('house');g.resourceSystem.resources.wood=50;g.resourceSystem.resources.food=50;g.gameLoop.gameSpeed=0;window.testHome=g.buildingSystem.buildings[0];const p=g.renderer.art.buildingBounds(testHome,balance.buildings.hut);return{x:p.centerX,y:p.y+p.height*.48};})()`);
    await mouse(pos.x,pos.y);await button('Upgrade to House');
    const start=await ev(`(()=>{const resident=g.villagerSystem.villagers.find(v=>v.currentTask!=='building');Object.assign(resident,{x:testHome.tileX,y:testHome.tileY,currentTask:'returnHome',state:'idle',path:[]});window.shelteredResident=resident.id;return{wood:g.resourceSystem.resources.wood,id:testHome.id,built:testHome.built,progress:testHome.upgradeProgress,capacity:g.buildingSystem.getHousingCapacity(),workers:testHome.assignedWorkers.length,inside:g.isVillagerInShelter(resident.id),position:[testHome.tileX,testHome.tileY]};})()`);
    assert.equal(start.wood,25);assert(start.built&&start.inside);assert.equal(start.progress,0);assert.equal(start.capacity,4);assert.equal(start.workers,1);
    await ev('g.upgradeBuilding(testHome.id)');assert.equal(await ev('g.resourceSystem.resources.wood'),25);
    await until('testHome.configId==="house"',80);
    const done=await ev(`({id:testHome.id,position:[testHome.tileX,testHome.tileY],capacity:g.buildingSystem.getHousingCapacity(),hp:testHome.maxHp,built:testHome.built,inside:g.isVillagerInShelter(shelteredResident),workers:testHome.assignedWorkers.length,finished:testHome.upgradeProgress===undefined,tiles:g.buildingSystem.getHousingTiles().length})`);
    assert.equal(done.id,start.id);assert.deepEqual(done.position,start.position);assert.equal(done.capacity,6);assert.equal(done.hp,200);assert.equal(done.tiles,4);assert(done.built&&done.inside&&done.finished);assert.equal(done.workers,0);
    await shot('warm-house-upgraded');return{start,done};
  });

  await check('unfinished upgrades save their worker and progress, then resume after shelter release',async()=>{
    const r=await ev(`(()=>{econReset();g.techSystem.unlockTech('house');g.resourceSystem.resources.wood=50;const home=g.buildingSystem.buildings[0];g.upgradeBuilding(home.id);home.upgradeProgress=.4;const worker=home.assignedWorkers[0],saved=JSON.parse(JSON.stringify(g.serializeState())),original=JSON.stringify(saved);g.deserializeState(saved);const loaded=g.buildingSystem.buildings.find(b=>b.id===home.id),assignment=g.villagerSystem.getVillagerById(worker).assignedBuildingId,progress=loaded.upgradeProgress;g.returnHome();const sheltered=loaded.assignedWorkers.length;g.leaveShelter();return{progress,assignment,worker,home:home.id,sheltered,resumed:loaded.assignedWorkers.includes(worker),unchanged:JSON.stringify(saved)===original,wood:g.resourceSystem.resources.wood};})()`);
    assert.equal(r.progress,.4);assert.equal(r.assignment,r.home);assert.equal(r.sheltered,0);assert(r.resumed&&r.unchanged);assert.equal(r.wood,25);return r;
  });

  await check('cancelling an upgrade refunds once and keeps the original house and occupants',async()=>{
    const r=await ev(`(()=>{econReset();g.techSystem.unlockTech('house');g.resourceSystem.resources.wood=50;const home=g.buildingSystem.buildings[0];g.upgradeBuilding(home.id);home.upgradeProgress=.3;g.cancelBuilding(home.id);g.cancelBuilding(home.id);return{wood:g.resourceSystem.resources.wood,id:home.configId,built:home.built,progress:home.upgradeProgress??null,capacity:g.buildingSystem.getHousingCapacity(),exists:g.buildingSystem.buildings.includes(home),workers:home.assignedWorkers.length,tasks:g.villagerSystem.villagers.map(v=>v.currentTask)};})()`);
    assert.equal(r.wood,37);assert.equal(r.id,'hut');assert(r.built&&r.exists);assert.equal(r.capacity,4);assert.equal(r.progress,null);assert.equal(r.workers,0);assert(r.tasks.every(t=>t!=='building'));return r;
  });

  await check('palisade and gate upgrades require a sawmill, double individual HP and preserve their connections',async()=>{
    const r=await ev(`(()=>{econReset();g.resourceSystem.resources.wood=50;const wall=g.buildingSystem.placeStartingBuilding('palisadeWall',42,27),gate=g.buildingSystem.placeStartingBuilding('palisadeGate',43,27);gate.gateOpen=true;gate.rotation=90;g.upgradeBuilding(wall.id);const blocked=wall.upgradeProgress===undefined;g.techSystem.unlockTech('lumberCamp');const mill=g.buildingSystem.placeBuilding('lumberCamp',35,32);g.upgradeBuilding(wall.id);const unfinished=wall.upgradeProgress===undefined;mill.built=true;mill.buildProgress=1;wall.hp=30;g.upgradeBuilding(wall.id);const usable=wall.built;g.buildingSystem.updateConstruction(1000,id=>id===wall.id?1:0);g.releaseBuildersFromCompletedBuildings();g.upgradeBuilding(gate.id);g.buildingSystem.updateConstruction(1000,id=>id===gate.id?1:0);g.releaseBuildersFromCompletedBuildings();const before=g.resourceSystem.resources.wood;g.upgradeBuilding(wall.id);const saved=JSON.parse(JSON.stringify(g.serializeState()));g.deserializeState(saved);const loaded=g.buildingSystem.buildings.filter(b=>b.id===wall.id||b.id===gate.id);return{blocked,unfinished,usable,wood:before,again:g.resourceSystem.resources.wood,wall:{id:wall.configId,upgraded:wall.upgraded,hp:wall.hp,max:wall.maxHp},gate:{id:gate.configId,upgraded:gate.upgraded,max:gate.maxHp,open:gate.gateOpen,rotation:gate.rotation},loaded:loaded.map(b=>({upgraded:b.upgraded,max:b.maxHp})),workers:loaded.map(b=>b.assignedWorkers.length)};})()`);
    assert(r.blocked&&r.unfinished&&r.usable);assert.equal(r.wood,38);assert.equal(r.again,38);assert.deepEqual(r.wall,{id:'palisadeWall',upgraded:true,hp:60,max:120});assert.deepEqual(r.gate,{id:'palisadeGate',upgraded:true,max:240,open:true,rotation:90});assert(r.loaded.every(b=>b.upgraded));assert.deepEqual(r.workers,[0,0]);await shot('reinforced-palisade-and-gate');return r;
  });

  await check('retired buildings and research migrate once without ghost footprints or lost fence upgrades',async()=>{
    const r=await ev(`(()=>{econReset();const data=JSON.parse(JSON.stringify(g.serializeState()));delete data.buildingUpgradeVersion;data.resources.wood=0;data.resources.techPoints=0;data.technology.unlockedTechs.push('smokehouse','largeHouse','hearth','reinforcedPalisade');data.technology.unlockedBuildings.push('smokehouse','largeHouse');const create=(id,configId,x,y,width,height,hp)=>{data.buildings.push({id,configId,tileX:x,tileY:y,built:true,buildProgress:1,hp:hp/2,maxHp:hp,assignedWorkers:[],wintersSinceRepair:0,needsRepair:false});for(let dy=0;dy<height;dy++)for(let dx=0;dx<width;dx++)Object.assign(data.tileMap[y+dy][x+dx],{type:configId==='palisadeWall'?'palisade':'building',buildingId:id});};create('old-smoke','smokehouse',44,27,2,2,70);create('old-large','largeHouse',35,32,3,3,150);create('old-wall','palisadeWall',43,30,1,1,120);const original=JSON.stringify(data);g.deserializeState(data);const house=g.buildingSystem.buildings.find(b=>b.id==='old-large'),wall=g.buildingSystem.buildings.find(b=>b.id==='old-wall'),first={wood:g.resourceSystem.resources.wood,stars:g.resourceSystem.resources.techPoints};const state=JSON.parse(JSON.stringify(g.serializeState()));g.deserializeState(state);return{first,again:{wood:g.resourceSystem.resources.wood,stars:g.resourceSystem.resources.techPoints},house:{id:house.configId,hp:house.hp,max:house.maxHp},wall:{upgraded:wall.upgraded,hp:wall.hp,max:wall.maxHp},clear:[[44,27],[45,28],[37,32],[35,34],[37,34]].every(([x,y])=>g.tileMap.getTile(x,y).type==='clear'&&!g.tileMap.getTile(x,y).buildingId),unchanged:JSON.stringify(data)===original,techs:g.techSystem.serialize().unlockedTechs};})()`);
    assert.deepEqual(r.first,{wood:20,stars:6});assert.deepEqual(r.again,r.first);assert.deepEqual(r.house,{id:'house',hp:100,max:200});assert.deepEqual(r.wall,{upgraded:true,hp:60,max:120});assert(r.clear&&r.unchanged);assert(r.techs.includes('house'));assert(!r.techs.includes('reinforcedPalisade'));return r;
  });

  await check('warm house sprites are seasonal, smoke animates only with residents and fallback remains usable',async()=>{
    const r=await ev(`(()=>{econReset();const home=g.buildingSystem.buildings[0];home.configId='house';home.hp=home.maxHp=200;const art=g.renderer.art,assets=g.renderer.assets,cfg=balance.buildings.house,box=art.buildingBounds(home,cfg),summer=assets.getWarmHouse('summer'),winter=assets.getWarmHouse('winter');const paint=(season,occupied,time)=>{const c=document.createElement('canvas');c.width=c.height=300;const ctx=c.getContext('2d');ctx.translate(150-box.centerX,270-box.baseline);art.building(ctx,home,cfg,season,time,g.buildingSystem.buildings,occupied);return c.toDataURL();};const emptyA=paint('summer',0,.1),emptyB=paint('summer',0,.8),occupiedA=paint('summer',1,.1),occupiedB=paint('summer',1,.8),winterFrame=paint('winter',0,.1),method=assets.getWarmHouse;let fallback;try{assets.getWarmHouse=()=>null;fallback=paint('summer',0,.1)!==emptyA;}finally{assets.getWarmHouse=method;}const alpha=image=>{const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');ctx.drawImage(image,0,0,32,32);return Array.from(ctx.getImageData(0,0,32,32).data).filter((n,i)=>i%4===3&&n===0).length;};g.seasonSystem.season='winter';return{loaded:!!summer&&!!winter,distinct:summer.src!==winter.src,alpha:[alpha(summer),alpha(winter)],emptyStable:emptyA===emptyB,smokeAnimated:occupiedA!==occupiedB,seasonal:emptyA!==winterFrame,fallback};})()`);
    assert(r.loaded&&r.distinct&&r.emptyStable&&r.smokeAnimated&&r.seasonal&&r.fallback);assert(r.alpha.every(n=>n>100));await shot('warm-house-winter');return r;
  });

  await check('route rejection updates when gates open, construction finishes or a wall is demolished',async()=>{
    const r=await ev(`(()=>{econReset();const v=g.villagerSystem.villagers[0];Object.assign(v,{x:30,y:20});let gate;for(let y=18;y<=22;y++)for(let x=28;x<=32;x++){if(x!==28&&x!==32&&y!==18&&y!==22)continue;g.tileMap.setTileType(x,y,'clear');const b=g.buildingSystem.placeStartingBuilding(x===32&&y===20?'palisadeGate':'palisadeWall',x,y);if(b.configId==='palisadeGate')gate=b;}const reachable=()=>g.villagerSystem.canReach(v,34,20),closed=reachable();g.villagerSystem.openGateIds.add(gate.id);const open=reachable();g.villagerSystem.openGateIds.clear();const closedAgain=reachable();gate.built=false;g.villagerSystem.unbuiltPalisadeIds.add(gate.id);const unfinished=reachable();gate.built=true;g.villagerSystem.unbuiltPalisadeIds.clear();const finished=reachable();g.buildingSystem.demolishBuilding(gate.id);return{closed,open,closedAgain,unfinished,finished,demolished:reachable()};})()`);
    assert.deepEqual(r,{closed:false,open:true,closedAgain:false,unfinished:true,finished:false,demolished:true});return r;
  });

  await check('mobile upgrade actions and the locked tower requirement remain within the viewport',async()=>{
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await call('Emulation.setTouchEmulationEnabled',{enabled:true});
    const pos=await ev(`(()=>{econReset();g.renderer.resize();g.techSystem.unlockTech('house');g.resourceSystem.resources.wood=50;g.updateUI();g.render();const home=g.buildingSystem.buildings[0],box=g.renderer.art.buildingBounds(home,balance.buildings.hut);return{x:box.centerX,y:box.y+box.height*.48};})()`);
    await mouse(pos.x,pos.y);const menu=await ev(`(()=>{const b=[...document.querySelectorAll('.action-menu button')].find(b=>b.textContent.includes('Upgrade to House')),r=b.getBoundingClientRect();return{exists:!!b,x:r.x,right:r.right,bottom:r.bottom};})()`);
    assert(menu.exists&&menu.x>=0&&menu.right<=390&&menu.bottom<=844);await shot('warm-house-upgrade-mobile');await ev('g.ui.hideActionMenu();g.ui.hideInfo();for(const id of ["storage","furWorkshop","palisade","herbalFire"])g.techSystem.unlockTech(id);g.refreshTechPanel()');await button('Tech');
    const tower=await ev(`(()=>{const el=document.querySelector('[data-tech-id=watchtower]');el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();return{right:r.right,x:r.x,text:el.querySelector('.research-requirement').textContent,disabled:el.getAttribute('aria-disabled')};})()`);
    assert(tower.x>=0&&tower.right<=390);assert.match(tower.text,/Sawmill/);assert.equal(tower.disabled,'true');await shot('tower-locked-mobile');await ev('g.ui.closePanels()');return{menu,tower};
  });
}
