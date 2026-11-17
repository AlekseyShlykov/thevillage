import assert from 'node:assert/strict';

/** Real Clear-button/canvas interaction, queue priorities, persistence and touch input. */
export async function runForestClearingChecks({check,ev,shot,call,clickSelector,tile,until}) {
  await call('Emulation.setTouchEmulationEnabled',{enabled:false});
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await ev(`(async()=>{g.renderer.resize();window.clearingQueue=await import('/src/world/ForestClearingQueue.ts');})()`);
  await check('Clear redirects a busy non-farmer and accepts many tree clicks without duplicates',async()=>{
    await ev(`econReset();g.resourceSystem.resources.food=100;const garden=g.buildingSystem.placeStartingBuilding('garden',42,27);g.villagerSystem.assignVillagerToBuilding(g.villagerSystem.villagers[0].id,garden.id,g.buildingSystem.buildings);const workshop=g.buildingSystem.placeStartingBuilding('furWorkshop',35,32);g.villagerSystem.assignVillagerToBuilding(g.villagerSystem.villagers[1].id,workshop.id,g.buildingSystem.buildings);g.updateUI();g.render()`);
    await clickSelector('[data-global-clear]');
    const started=await ev(`(()=>{const v=g.villagerSystem.villagers.find(v=>v.currentTask==='clearing');window.queueChopper=v.id;window.queueStart={x:v.targetX,y:v.targetY};window.treeClicks=Array.from({length:8},(_,i)=>({x:34,y:26+i})).filter(p=>p.x!==v.targetX||p.y!==v.targetY).sort((a,b)=>Math.hypot(b.x-v.x,b.y-v.y)-Math.hypot(a.x-v.x,a.y-v.y)).slice(0,6);return{task:v.currentTask,path:v.path.length,mode:g.mode,other:g.villagerSystem.villagers.filter(v=>v.currentTask==='farming').length};})()`);
    assert.equal(started.task,'clearing');assert(started.path>0);assert.equal(started.mode,'clear');assert.equal(started.other,1);
    const points=await ev('treeClicks');for(const p of points)await tile(p.x+.5,p.y+.5);await tile(points[0].x+.5,points[0].y+.5);
    const queued=await ev(`({points:clearingQueue.queuedForestTiles(g.tileMap),mode:g.mode,pressed:document.querySelector('[data-global-clear]').getAttribute('aria-pressed'),hint:document.getElementById('status-ribbon').textContent})`);
    assert.deepEqual(queued.points,points);assert.equal(queued.mode,'clear');assert.equal(queued.pressed,'true');assert(queued.hint.includes('6 trees queued'));
    await shot('forest-clearing-queue');return{started,queued:queued.points.length};
  });
  await check('queued trees are chopped in click order before automatic nearby trees',async()=>{
    const r=await ev(`(()=>{const v=g.villagerSystem.getVillagerById(queueChopper),log=[],wood=g.resourceSystem.resources.wood;
      for(const expected of [queueStart,...treeClicks]){
        if(v.targetX!==expected.x||v.targetY!==expected.y)throw Error('Queue order changed: '+JSON.stringify({actual:[v.targetX,v.targetY],expected}));
        Object.assign(v,{x:v.targetX,y:v.targetY,path:[],state:'working'});g.updateForestClearing(balance.villagers.clearForestTime+.01);
        log.push({x:expected.x,y:expected.y,clear:g.tileMap.getTile(expected.x,expected.y).type==='clear',order:g.tileMap.getTile(expected.x,expected.y).clearingQueueOrder??null});
        g.updateForestClearing(balance.villagers.clearingDispatchInterval+.01);
      }
      return{log,remaining:clearingQueue.queuedForestTiles(g.tileMap).length,wood:g.resourceSystem.resources.wood-wood,task:v.currentTask};})()`);
    assert.equal(r.log.length,7);assert(r.log.every(p=>p.clear&&p.order===null));assert.equal(r.remaining,0);assert.equal(r.wood,14);assert.equal(r.task,'clearing');return r;
  });
  await check('clearing queue survives loading and spring recall; workers reserve distinct targets',async()=>{
    const r=await ev(`(()=>{econReset();for(let y=20;y<25;y++)for(let x=30;x<35;x++)clearingQueue.queueForestTile(g.tileMap,x,y);
      const before=clearingQueue.queuedForestTiles(g.tileMap);g.startNearestClearing(g.villagerSystem.villagers[0].id);g.startNearestClearing(g.villagerSystem.villagers[1].id);
      const distinct=new Set(g.villagerSystem.villagers.map(v=>v.targetX+','+v.targetY)).size;const saved=JSON.parse(JSON.stringify(g.serializeState()));g.deserializeState(saved);const restored=clearingQueue.queuedForestTiles(g.tileMap);
      g.returnHome();const held=g.villagerSystem.villagers.map(v=>v.currentTask);g.seasonSystem.season='winter';g.seasonSystem.seasonTimer=balance.seasons.winterDuration-.01;g.seasonSystem.update(.02);
      return{before,restored,distinct,held,after:g.villagerSystem.villagers.map(v=>({task:v.currentTask,target:{x:v.targetX,y:v.targetY}})),spring:g.seasonSystem.season};})()`);
    assert.equal(r.before.length,25);assert.deepEqual(r.restored,r.before);assert.equal(r.distinct,2);assert(r.held.every(task=>task==='returnHome'));assert.equal(r.spring,'spring');
    assert(r.after.every(v=>v.task==='clearing'));assert.deepEqual(r.after.map(v=>v.target),r.before.slice(0,2));return{queued:r.before.length,distinct:r.distinct,spring:r.spring};
  });
  await check('unreachable queued trees do not block reachable work and older marks still work',async()=>{
    const r=await ev(`(()=>{econReset();const blocked={x:30,y:20},reachable={x:34,y:27};clearingQueue.queueForestTile(g.tileMap,blocked.x,blocked.y);clearingQueue.queueForestTile(g.tileMap,reachable.x,reachable.y);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)g.tileMap.setTileType(blocked.x+dx,blocked.y+dy,'building');
      const v=g.villagerSystem.villagers[0];g.startNearestClearing(v.id);const selected={x:v.targetX,y:v.targetY},queued=clearingQueue.queuedForestTiles(g.tileMap);
      const legacy={x:34,y:29};g.tileMap.getTile(legacy.x,legacy.y).markedForClearing=true;const second=g.villagerSystem.villagers[1];g.startNearestClearing(second.id,true);
      return{selected,queued,legacy:{x:second.targetX,y:second.targetY}};})()`);
    assert.deepEqual(r.selected,{x:34,y:27});assert.equal(r.queued.length,2);assert.deepEqual(r.legacy,{x:34,y:29});return r;
  });
  await check('Clear, Escape, right-click and background exit selection without deleting queued work',async()=>{
    await ev(`econReset();g.resourceSystem.resources.food=100;g.villagerSystem.villagers[1].holdPosition=true;g.updateUI()`);
    await clickSelector('[data-global-clear]');await tile(34.5,27.5);await clickSelector('[data-global-clear]');
    assert(await ev('g.mode==="normal"&&clearingQueue.queuedForestTiles(g.tileMap).length===1&&g.villagerSystem.villagers[0].currentTask==="clearing"'));
    await clickSelector('[data-global-clear]');await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});assert.equal(await ev('g.mode'),'normal');
    await clickSelector('[data-global-clear]');await ev('g.input.state.rightClicked=true;g.handleInput()');assert.equal(await ev('g.mode'),'normal');
    await clickSelector('[data-global-clear]');await tile(41.5,31.5);assert.equal(await ev('g.mode'),'normal');
    assert.equal(await ev('clearingQueue.queuedForestTiles(g.tileMap).length'),1);return 'selection ends; current chopping and queue remain';
  });
  await check('mobile Clear starts chopping, taps queue trees and camera drags do not add work',async()=>{
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    await ev('g.renderer.resize();econReset();g.camera.centerOn(36*48,29*48);g.updateUI();g.render()');
    async function tap(p){await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await ev('g.handleInput();g.updateUI();g.render()');}
    const button=await ev('(()=>{const r=document.querySelector("[data-global-clear]").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()');await tap(button);
    assert(await ev('g.mode==="clear"&&g.villagerSystem.villagers.some(v=>v.currentTask==="clearing")'));
    for(const [x,y]of [[34.5,27.5],[34.5,28.5],[34.5,29.5]])await tap(await ev(`g.camera.worldToScreen(${x}*48,${y}*48)`));
    assert.equal(await ev('clearingQueue.queuedForestTiles(g.tileMap).length'),3);
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:210,y:380}]});await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:250,y:410}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await ev('g.handleInput();g.updateUI();g.render()');
    assert.equal(await ev('clearingQueue.queuedForestTiles(g.tileMap).length'),3);await shot('forest-clearing-queue-mobile');
    await until('g.tileMap.getTile(34,27).type==="clear"',30);
    await call('Emulation.setTouchEmulationEnabled',{enabled:false});await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await ev('g.renderer.resize()');return{marked:3,dragAdded:0};
  });
  await check('120 automatic cuts with real path movement expand all sides of the village without tunnels',async()=>{
    const r=await ev(`(()=>{econReset();const [v,other]=g.villagerSystem.villagers;other.holdPosition=true;g.toggleClearMode();const center=g.tileMap.getClearingCenter(),cuts=[];let elapsed=0,frontier=true;
      while(cuts.length<120&&elapsed<2400){
        const target=v.currentTask==='clearing'?{x:v.targetX,y:v.targetY}:null;
        const wasForest=target&&g.tileMap.getTile(target.x,target.y)?.type==='forest';
        if(wasForest)frontier=frontier&&[[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>{const t=g.tileMap.getTile(target.x+dx,target.y+dy);return t&&t.type!=='forest';});
        g.villagerSystem.update(.1,g.buildingSystem.buildings,false,g.buildingSystem.getHousingTiles());g.updateForestClearing(.1);elapsed+=.1;
        if(wasForest&&g.tileMap.getTile(target.x,target.y).type==='clear')cuts.push(target);
      }
      const sectors=Array(8).fill(0),radii=cuts.map(p=>{const dx=p.x+.5-center.x,dy=p.y+.5-center.y;sectors[Math.floor(((Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2))/(Math.PI/4))]++;return Math.hypot(dx,dy);});
      g.cancelBuild();g.ui.resetNotifications();g.camera.setZoom(.85);g.camera.centerOn(center.x*48,center.y*48);g.updateUI();g.render();
      return{cuts:cuts.length,elapsed,sectors,maxRadius:Math.max(...radii),unique:new Set(cuts.map(p=>p.x+','+p.y)).size,frontier};})()`);
    assert.equal(r.cuts,120);assert.equal(r.unique,120);assert(r.maxRadius<11,JSON.stringify(r));assert(r.sectors.every(n=>n>=6),JSON.stringify(r));assert(r.frontier);
    await shot('village-clearing-expanded');return r;
  });
  await check('a loaded old corridor draws workers back around the village while explicit distant clicks still win',async()=>{
    const r=await ev(`(()=>{econReset();for(let x=45;x<=77;x++)g.tileMap.setTileType(x,29,'clear');const v=g.villagerSystem.villagers[0];Object.assign(v,{x:77,y:29,state:'idle',path:[],currentTask:null});const saved=JSON.parse(JSON.stringify(g.serializeState()));g.deserializeState(saved);const loaded=g.villagerSystem.villagers[0],job=g.jobsFor(loaded.id).find(j=>j.kind==='chop');g.startNearestClearing(loaded.id);const automatic={x:loaded.targetX,y:loaded.targetY},center=g.tileMap.getClearingCenter();clearingQueue.queueForestTile(g.tileMap,78,29);g.startNearestClearing(loaded.id);return{automatic,personalJob:job.target,radius:Math.hypot(automatic.x+.5-center.x,automatic.y+.5-center.y),manual:{x:loaded.targetX,y:loaded.targetY},manualPath:loaded.path.length};})()`);
    assert(r.radius<7,JSON.stringify(r));assert.deepEqual(r.personalJob,r.automatic);assert.deepEqual(r.manual,{x:78,y:29});assert(r.manualPath>0);return r;
  });
  await check('multiple woodcutters reserve distinct trees and keep a broad clearing after 120 cuts',async()=>{
    const r=await ev(`(()=>{econReset();g.villagerSystem.spawnVillager(38,27);g.villagerSystem.spawnVillager(39,27);const people=g.villagerSystem.getAliveVillagers(),cuts=[];for(const v of people)g.startNearestClearing(v.id);let distinct=true;
      for(let i=0;i<30;i++){const targets=people.map(v=>({x:v.targetX,y:v.targetY}));distinct=distinct&&new Set(targets.map(p=>p.x+','+p.y)).size===people.length;for(const v of people)Object.assign(v,{x:v.targetX,y:v.targetY,path:[],state:'working'});g.updateForestClearing(balance.villagers.clearForestTime+.1);cuts.push(...targets);g.updateForestClearing(balance.villagers.clearingDispatchInterval+.1);}
      const center=g.tileMap.getClearingCenter(),sectors=Array(4).fill(0);for(const p of cuts)sectors[(p.x+.5>=center.x?1:0)+(p.y+.5>=center.y?2:0)]++;
      return{cuts:cuts.length,distinct,unique:new Set(cuts.map(p=>p.x+','+p.y)).size,maxRadius:Math.max(...cuts.map(p=>Math.hypot(p.x+.5-center.x,p.y+.5-center.y))),sectors};})()`);
    assert.equal(r.cuts,120);assert.equal(r.unique,120);assert(r.distinct&&r.maxRadius<11,JSON.stringify(r));assert(r.sectors.every(n=>n>=15));return r;
  });
}
