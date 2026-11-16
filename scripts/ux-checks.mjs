import assert from 'node:assert/strict';

export async function runUXChecks({check,ev,shot,clickSelector,button,tile,until,mouse,call}) {
  await call('Emulation.setTouchEmulationEnabled',{enabled:false});
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await ev('g.renderer.resize();econReset();g.update(.05);g.updateUI();g.render()');
  await check('background clicks dismiss selection and every auxiliary menu',async()=>{
    await ev('g.selectedVillagerId=g.villagerSystem.villagers[0].id;g.updateUI()');
    await clickSelector('[data-villager-order="chop"]');await mouse(600,700);
    assert.equal(await ev('g.selectedVillagerId'),null);assert.equal(await ev('g.villagerSystem.villagers[0].currentTask'),'clearing');
    await button('Build');await mouse(600,700);assert.equal(await ev('g.ui.isBuildPanelOpen()'),false);
    await button('Tech');await mouse(600,700);assert.equal(await ev('g.ui.isTechPanelOpen()'),false);
    await clickSelector('#game-forecast summary');await mouse(600,700);assert.equal(await ev('document.getElementById("game-forecast").open'),false);
    return 'jobs continue; selection, build, technology and forecast panels close';
  });
  await check('herbs unlock only after a completed ward; tools never clutter resources',async()=>{
    const r=await ev(`(()=>{econReset();g.updateUI();const hidden=document.querySelector('[data-stat=herbs]').hidden,planBefore=document.querySelector('#game-forecast').textContent,heading=!!document.querySelector('.game-heading');g.resourceSystem.resources.clothing=2;g.equipmentSystem.issue(g.villagerSystem.getAliveVillagers(),g.resourceSystem);g.resourceSystem.resources.herbs=4;g.buildingSystem.placeStartingBuilding('herbalFire',42,27);g.updateUI();const coats=document.querySelector('[data-stat=clothing] [data-value]').textContent,herbs=document.querySelector('[data-stat=herbs] [data-value]').textContent;return{hidden,planBefore,heading,coats,herbs,unlocked:!document.querySelector('[data-stat=herbs]').hidden,tools:!!document.querySelector('[data-stat=tools]')};})()`);
    assert(r.hidden&&!r.heading&&r.unlocked&&!r.tools);assert(!r.planBefore.toLowerCase().includes('herb'));assert.equal(r.coats,'2');assert.equal(r.herbs,'4');await shot('resources-coats-herbs');return r;
  });
  await check('construction offers one cancel action and a distinct close control',async()=>{
    await ev('econReset();g.buildingSystem.placeBuilding("hut",42,27);g.updateUI();g.render()');await tile(43,28);
    const labels=await ev('[...document.querySelectorAll(".action-menu button")].map(b=>b.textContent.trim())');
    assert.equal(labels.filter(s=>s.toLowerCase().includes('cancel')).length,1);assert(labels.includes('Close'));
    await button('Cancel construction');assert.equal(await ev('g.buildingSystem.buildings.length'),1);return labels;
  });
  await check('a garden builder becomes its farmer and harvested food enters storage',async()=>{
    await ev('econReset();g.resourceSystem.resources.food=50;g.buildingSystem.placeBuilding("garden",42,27)');
    await until('g.buildingSystem.getBuildingsOfType("garden").length===1',60);
    assert(await ev('(()=>{const b=g.buildingSystem.getBuildingsOfType("garden")[0];return b.assignedWorkers.length===1&&g.villagerSystem.getVillagerById(b.assignedWorkers[0]).currentTask==="farming"})()'));
    await ev('const plot=g.buildingSystem.getBuildingsOfType("garden")[0];plot.cropState="ripe";plot.farmingProgress=1;plot.harvestProgress=0;plot.harvestRemaining=45;g.resourceSystem.resources.food=0;g.updateUI();g.render()');await shot('ripe-harvest-ready');
    await until('g.buildingSystem.getBuildingsOfType("garden")[0].cropState==="empty"',6);
    const food=await ev('g.resourceSystem.resources.food');assert(food>44&&food<=45);return{food};
  });
  await check('a fur workshop builder sews wearable coats and the resource survives loading',async()=>{
    await ev('econReset();g.resourceSystem.resources.food=50;g.resourceSystem.resources.fur=2;g.buildingSystem.placeBuilding("furWorkshop",42,27)');
    await until('g.buildingSystem.getBuildingsOfType("furWorkshop").length===1',60);
    assert(await ev('(()=>{const b=g.buildingSystem.getBuildingsOfType("furWorkshop")[0];return b.assignedWorkers.length===1&&g.villagerSystem.getVillagerById(b.assignedWorkers[0]).currentTask==="working"})()'));
    await until('g.villagerSystem.getAliveVillagers().some(v=>(v.clothingWintersLeft??0)>0)',30);
    const r=await ev('(()=>{const before=document.querySelector("[data-stat=clothing] [data-value]").textContent;g.deserializeState(g.serializeState());g.updateUI();return{before,after:document.querySelector("[data-stat=clothing] [data-value]").textContent,pelts:g.resourceSystem.resources.fur}})()');
    assert(Number(r.before)>=1);assert.equal(r.after,r.before);assert(r.pelts<2);await shot('fur-workshop-coat-produced');return r;
  });
  await check('food and lethal cold warnings remain visible until the danger is resolved',async()=>{
    await ev('econReset();g.updateUI()');assert(await ev('!!document.querySelector("[data-warning=food]")'));
    await ev('g.seasonSystem.season="winter";g.resourceSystem.resources.food=50;g.villagerSystem.villagers[0].coldExposure=16;g.updateUI();g.render()');
    const text=await ev('document.querySelector("#cold-warning").textContent');assert(text.includes('Shelter')&&text.includes('14s'));const style=await ev('(()=>{const el=document.getElementById("cold-warning"),r=el.getBoundingClientRect();return{color:getComputedStyle(el).color,cx:r.x+r.width/2,cy:r.y+r.height/2,w:innerWidth,h:innerHeight}})()');assert.equal(style.color,'rgb(255, 102, 92)');assert(Math.abs(style.cx-style.w/2)<1&&Math.abs(style.cy-style.h/2)<1);await shot('cold-danger-warning');
    await button('Shelter');await until('g.villagerSystem.getAliveVillagers().every(v=>g.isVillagerInShelter(v.id))',15);
    assert.equal(await ev('!document.querySelector("#cold-warning").hidden'),false);return{text};
  });
  await check('herb gathering goes ten to thirty forest tiles deep and can be fatal',async()=>{
    const r=await ev(`(()=>{econReset();const v=g.villagerSystem.villagers[0],random=Math.random;let depth;try{Math.random=()=>0;g.gatherHerbs(v.id);depth=g.villagerSystem.huntingGrounds.depthAt(v.targetX,v.targetY);Object.assign(v,{x:v.targetX,y:v.targetY,path:[],state:'working',taskProgress:balance.herbs.gatherSeconds});forageTick(.01);}finally{Math.random=random;}return{depth,dead:v.health==='dead',stock:g.resourceSystem.resources.herbs,reserved:g.foragingSystem.reservedHerbs(g.villagerSystem)};})()`);
    assert(r.depth>=10&&r.depth<=30);assert(r.dead);assert.equal(r.stock,0);assert.equal(r.reserved,0);return r;
  });
  await check('spring automatically releases residents and restores their saved jobs',async()=>{
    await ev(`econReset();g.resourceSystem.resources.food=50;g.resourceSystem.resources.fur=2;
      const a=g.buildingSystem.placeStartingBuilding('garden',42,27),b=g.buildingSystem.placeStartingBuilding('furWorkshop',35,32);
      g.villagerSystem.assignVillagerToBuilding(g.villagerSystem.villagers[0].id,a.id,g.buildingSystem.buildings);
      g.villagerSystem.assignVillagerToBuilding(g.villagerSystem.villagers[1].id,b.id,g.buildingSystem.buildings);
      g.villagerSystem.spawnVillager(38,27);g.villagerSystem.sendVillagerToHunt(g.villagerSystem.villagers[2].id);g.returnHome();`);
    await until('g.villagerSystem.getAliveVillagers().every(v=>g.isVillagerInShelter(v.id))',20);
    const r=await ev(`(()=>{const saved=JSON.parse(JSON.stringify(g.serializeState()));g.deserializeState(saved);g.seasonSystem.season='winter';g.seasonSystem.seasonTimer=balance.seasons.winterDuration-.01;g.seasonSystem.update(.02);return{sheltered:g.stayInShelterMode,tasks:g.villagerSystem.getAliveVillagers().map(v=>v.currentTask),paths:g.villagerSystem.getAliveVillagers().map(v=>v.path.length),autosave:g.saveSystem.loadAutosave().stayInShelterMode};})()`);
    assert(!r.sheltered&&!r.autosave);assert.deepEqual(r.tasks,['farming','working',null]);assert(r.paths.every(n=>n>0));return r;
  });
  await check('a monster takes much longer to destroy a building',async()=>{
    const r=await ev(`(()=>{econReset();const h=g.hordeSystem,house=g.buildingSystem.buildings[0];h.startWinter(2,1);h.waveSpawned=true;h.waveTimer=999;h.enemies=[{id:'slow-test',x:38,y:29,hp:30,maxHp:30,speed:1,damage:10,attackCooldown:0,targetX:null,targetY:null,path:[],visible:true,state:'attacking',targetBuildingId:house.id,patrolTarget:null,patrolTimer:0}];for(let i=0;i<240;i++)h.update(.05,40,30,[],[],[],g.buildingSystem.getAttackableBuildingTiles(),()=>false,(id,damage)=>g.buildingSystem.damageBuilding(id,damage),()=>{},false);return{damage:house.maxHp-house.hp,alive:house.hp>0,interval:balance.horde.buildingAttackInterval};})()`);
    assert(r.damage>0&&r.damage<=10&&r.alive);return r;
  });
  await check('generated rake, axe and hammer load with distinct animated work poses',async()=>{
    const result=await ev('({loaded:["rake","axe","hammer"].map(n=>!!g.renderer.assets.getTool(n)),paths:["rake","axe","hammer"].map(n=>g.renderer.assets.getTool(n)?.src)})');
    assert(result.loaded.every(Boolean));assert.equal(new Set(result.paths).size,3);return result;
  });
  await check('expanded resources and job cards fit phone, tablet and desktop screens',async()=>{
    const layouts=[];
    for(const width of [390,768,900,1024,1280]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:width===390?2:1,mobile:width===390});
      await ev('g.renderer.resize();econReset();g.buildingSystem.placeStartingBuilding("herbalFire",42,27);g.updateUI();g.render()');
      const r=await ev(`(()=>{const bar=document.getElementById('game-top-bar'),forecast=document.getElementById('game-forecast');return{width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth||bar.scrollWidth>bar.clientWidth+2,below:getComputedStyle(forecast).display==='none'||forecast.getBoundingClientRect().top>=bar.getBoundingClientRect().bottom,buttons:[...document.querySelectorAll('#game-bottom-bar button')].every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})};})()`);
      assert(!r.overflow&&r.below&&r.buttons,JSON.stringify(r));layouts.push(r);
      if(width===390||width===1280) { await ev('g.selectedVillagerId=g.villagerSystem.villagers[0].id;g.updateUI()');await shot('ux-jobs-'+width); }
    }
    return layouts;
  });
}
