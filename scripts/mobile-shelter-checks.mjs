import assert from 'node:assert/strict';

export async function runMobileShelterChecks({check,ev,shot,call,until}) {
  async function tap(selector) {
    const p=await ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return{x,y,reachable:!!hit&&(hit===el||el.contains(hit)),height:r.height};})()`);
    assert(p.reachable&&p.height>=44,JSON.stringify(p));
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
    await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await ev('(async()=>{await new Promise(r=>setTimeout(r,60));g.updateUI();})()');
  }
  await check('mobile toasts and warnings close with touch and stay dismissed during the same danger',async()=>{
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    await ev('econReset();g.renderer.resize();g.selectedVillagerId=g.villagerSystem.villagers[0].id;g.updateUI();g.ui.notify("Mobile notification can be dismissed",10000)');
    await shot('mobile-notices-before');
    await tap('[data-dismiss-notice=notification]');
    assert(await ev('document.querySelector("[data-notification-el]").hidden'));
    await tap('[data-dismiss-notice=food]');
    assert.equal(await ev('document.querySelector("[data-warning=food]")'),null);
    const r=await ev(`(()=>{for(let i=0;i<10;i++){g.resourceSystem.resources.food-=.01;g.updateUI();}return{hidden:!document.querySelector('[data-warning=food]'),selection:g.selectedVillagerId===g.villagerSystem.villagers[0].id,height:getComputedStyle(document.getElementById('ui-overlay')).getPropertyValue('--warnings-height')};})()`);
    assert(r.hidden&&r.selection);assert.equal(r.height,'0px');
    await shot('mobile-notices-dismissed');
    const again=await ev('g.resourceSystem.resources.food=50;g.updateUI();g.resourceSystem.resources.food=0;g.updateUI();!!document.querySelector("[data-warning=food]")');
    assert(again);return{...r,newDangerShown:again};
  });
  await check('cold takes priority on mobile; dismissed warnings still return for greater urgency',async()=>{
    await tap('[data-dismiss-notice=food]');
    const escalated=await ev('g.seasonSystem.season="winter";g.updateUI();!document.getElementById("cold-warning").hidden&&!document.querySelector("[data-warning=food]")');assert(escalated);
    await tap('[data-dismiss-notice=cold]');assert(await ev('!!document.querySelector("[data-warning=food].warning-urgent")'));
    await ev('for(const v of g.villagerSystem.getAliveVillagers()){v.x=39;v.y=29;}g.updateUI();g.villagerSystem.villagers[0].x=38;');
    await ev('g.resourceSystem.resources.food=50;g.villagerSystem.villagers[0].coldExposure=16;g.updateUI()');
    await tap('[data-dismiss-notice=cold]');
    assert(await ev('document.getElementById("cold-warning").hidden'));
    await ev('g.villagerSystem.villagers[0].coldExposure=20;g.updateUI()');assert(await ev('document.getElementById("cold-warning").hidden'));
    await ev('for(const v of g.villagerSystem.getAliveVillagers()){v.x=39;v.y=29;}g.updateUI();g.villagerSystem.villagers[0].x=38;g.updateUI()');
    assert(await ev('!document.getElementById("cold-warning").hidden'));return{escalated,coldDismissedUntilNewDanger:true};
  });
  await check('both mobile toolbar rows have identical edges for every resource and shelter state',async()=>{
    await call('Emulation.setTouchEmulationEnabled',{enabled:false});
    const layouts=[];
    for(const width of [320,360,390,430,600,768,900,1280])for(const state of ['initial','herbs','shelter']) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<=768});
      const r=await ev(`(async()=>{econReset();g.renderer.resize();if('${state}'!=='initial')g.buildingSystem.placeStartingBuilding('herbalFire',42,27);g.stayInShelterMode='${state}'==='shelter';g.updateUI();await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const buttons=[...document.querySelectorAll('#game-bottom-bar button')].filter(b=>!b.hidden);const rows=new Map();let fits=true,touch=true;for(const b of buttons){const r=b.getBoundingClientRect(),top=Math.round(r.top);if(!rows.has(top))rows.set(top,[]);rows.get(top).push({left:r.left,right:r.right});fits&&=r.left>=0&&r.right<=innerWidth+.1&&b.scrollWidth<=b.clientWidth+1;touch&&=r.height>=44;}return{width:innerWidth,state:'${state}',count:buttons.length,rows:[...rows.values()].map(row=>({left:Math.min(...row.map(r=>r.left)),right:Math.max(...row.map(r=>r.right))})),fits,touch};})()`);
      assert(r.fits,JSON.stringify(r));if(width<=768) {assert(r.touch);assert(await ev('[...document.querySelectorAll("#game-bottom-bar button.icon-button")].filter(b=>!b.hidden).every(b=>getComputedStyle(b).display==="flex"&&getComputedStyle(b).flexDirection==="column")'));assert.equal(r.rows.length,2,JSON.stringify(r));assert(Math.abs(r.rows[0].left-r.rows[1].left)<.5&&Math.abs(r.rows[0].right-r.rows[1].right)<.5,JSON.stringify(r));}
      layouts.push(r);if(width===390&&state==='shelter')await shot('mobile-toolbar-aligned');
    }
    return layouts;
  });
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await check('Shelter fills tower places first and keeps a configured home reserve',async()=>{
    const r=await ev(`(()=>{const results=[];for(const [population,towerCount] of [[1,1],[2,1],[8,1],[8,2],[8,0]]){econReset();while(g.villagerSystem.getAliveCount()<population)g.villagerSystem.spawnVillager(38,27);g.villagerSystem.villagers=g.villagerSystem.villagers.slice(0,population);if(towerCount)g.buildingSystem.placeStartingBuilding('watchtower',42,27);if(towerCount>1)g.buildingSystem.placeStartingBuilding('watchtower',35,32);g.returnHome();const towers=g.buildingSystem.getBuildingsOfType('watchtower');const targetCount=t=>g.villagerSystem.getAliveVillagers().filter(v=>v.targetX===t.tileX&&v.targetY===t.tileY).length;const counts=towers.map(targetCount);results.push({population,towerCount,counts,inTowers:counts.reduce((a,b)=>a+b,0),inHomes:g.villagerSystem.getAliveCount()-counts.reduce((a,b)=>a+b,0),tasks:g.villagerSystem.getAliveVillagers().map(v=>v.currentTask)});}return results;})()`);
    for(const s of r){const reserve=Math.max(1,Math.ceil(s.population*.25));assert.equal(s.inTowers,Math.min(s.towerCount*3,s.population-reserve));assert(s.inHomes>=reserve);assert(s.counts.every(n=>n<=3));assert(s.tasks.every(t=>t==='returnHome'));}return r;
  });
  await check('recall moves residents already inside a house into both towers and keeps the home group',async()=>{
    await ev(`econReset();g.resourceSystem.resources.food=50;g.buildingSystem.placeStartingBuilding('watchtower',42,27);g.buildingSystem.placeStartingBuilding('watchtower',35,32);while(g.villagerSystem.getAliveCount()<8)g.villagerSystem.spawnVillager(39,29);for(const v of g.villagerSystem.getAliveVillagers()){v.x=39;v.y=29;}g.returnHome();`);
    await until('g.villagerSystem.getAliveVillagers().filter(v=>["42,27","35,32"].includes(Math.floor(v.x)+","+Math.floor(v.y))).length===6 && g.villagerSystem.getAliveVillagers().every(v=>!v.path.length)',20);
    const r=await ev('({inside:g.villagerSystem.getAliveVillagers().every(v=>g.isVillagerInShelter(v.id)),homes:g.villagerSystem.getAliveVillagers().filter(v=>g.tileMap.getTile(Math.floor(v.x),Math.floor(v.y)).buildingId===g.buildingSystem.buildings[0].id).length})');
    assert(r.inside);assert.equal(r.homes,2);await shot('tower-priority-shelter');return r;
  });
  await check('unreachable towers fall back to homes; tower-only settlements still use free places',async()=>{
    const r=await ev(`(()=>{econReset();const tower=g.buildingSystem.placeStartingBuilding('watchtower',42,27);for(const [x,y]of[[42,26],[43,27],[42,28],[41,27]])g.tileMap.setTileType(x,y,'building');g.returnHome();const blocked=g.villagerSystem.getAliveVillagers().every(v=>v.targetX!==42||v.targetY!==27);econReset();g.buildingSystem.placeStartingBuilding('watchtower',42,27);g.buildingSystem.demolishBuilding(g.buildingSystem.buildings.find(b=>b.configId==='hut').id);g.returnHome();return{blocked,towerOnly:g.villagerSystem.getAliveVillagers().every(v=>v.targetX===42&&v.targetY===27)};})()`);
    assert(r.blocked&&r.towerOnly);return r;
  });
  await check('monster damage cannot destroy a finished moat or unfinished ditch, but manual demolition works',async()=>{
    const r=await ev(`(()=>{econReset();const dug=g.buildingSystem.placeStartingBuilding('moat',42,27),site=g.buildingSystem.placeBuilding('moat',43,27);for(let i=0;i<3;i++){g.buildingSystem.damageBuilding(dug.id,10000);g.buildingSystem.damageBuilding(site.id,10000);g.buildingSystem.advanceWinterRepairCounters();}const protectedBoth=[dug,site].every(b=>g.buildingSystem.buildings.includes(b)&&b.hp===b.maxHp),notTargeted=g.buildingSystem.getAttackableBuildingTiles().every(t=>t.buildingId!==dug.id&&t.buildingId!==site.id);g.buildingSystem.demolishBuilding(dug.id);return{protectedBoth,notTargeted,demolished:!g.buildingSystem.buildings.includes(dug),clear:g.tileMap.getTile(42,27).type==='clear'};})()`);
    assert(r.protectedBoth&&r.notTargeted&&r.demolished&&r.clear);return r;
  });
}
