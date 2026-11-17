import assert from 'node:assert/strict';

export async function runFenceGateChecks({check,ev,shot,call,mouse,button,until}) {
  await call('Emulation.setTouchEmulationEnabled',{enabled:false});
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await ev('g.renderer.resize()');

  await check('an upgraded House actually shelters six residents',async()=>{
    await ev(`econReset();g.techSystem.unlockTech('house');g.resourceSystem.resources.wood=50;g.resourceSystem.resources.food=50;const home=g.buildingSystem.buildings[0];g.upgradeBuilding(home.id);g.buildingSystem.updateConstruction(1000,()=>1);g.releaseBuildersFromCompletedBuildings();for(let i=0;i<4;i++)g.villagerSystem.spawnVillager(37+i%2,28+Math.floor(i/2));g.returnHome()`);
    await until('g.villagerSystem.getAliveVillagers().every(v=>g.isVillagerInShelter(v.id))',25);
    const r=await ev(`({capacity:g.buildingSystem.getHousingCapacity(),population:g.villagerSystem.getAliveCount(),inside:g.villagerSystem.getAliveVillagers().filter(v=>g.isVillagerInShelter(v.id)).length})`);
    assert.deepEqual(r,{capacity:6,population:6,inside:6});await shot('six-residents-in-upgraded-house');return r;
  });

  await check('only towers can touch fences and gates, in either construction order; overlap and other spacing stay blocked',async()=>{
    const r=await ev(`(()=>{const cases=[];for(const fence of ['palisadeWall','palisadeGate']){econReset();const b=g.buildingSystem.placeStartingBuilding(fence,44,27);cases.push({name:'tower beside '+fence,ok:g.buildingSystem.canPlace('watchtower',43,27),overlap:g.buildingSystem.canPlace('watchtower',44,27),ordinary:g.buildingSystem.canPlace('hut',42,27)});econReset();g.buildingSystem.placeStartingBuilding('watchtower',42,27);cases.push({name:fence+' beside tower',ok:g.buildingSystem.canPlace(fence,43,27),ordinary:g.buildingSystem.canPlace('storage',43,27)});econReset();g.buildingSystem.placeStartingBuilding('hut',42,27);cases.push({name:fence+' beside Hut',blocked:!g.buildingSystem.canPlace(fence,44,27)});}econReset();for(const [x,y]of [[42,26],[43,27],[42,28],[41,27]])g.buildingSystem.placeStartingBuilding('palisadeWall',x,y);return{cases,enclosed:g.buildingSystem.canPlace('watchtower',42,27)};})()`);
    assert(!r.enclosed);for(const c of r.cases){if('blocked'in c)assert(c.blocked,c.name);else{assert(c.ok,c.name);assert(!c.ordinary,c.name);if('overlap'in c)assert(!c.overlap,c.name);}}return r;
  });

  await check('gate menu opens and closes immediately while paused and sheltered',async()=>{
    const p=await ev(`(()=>{econReset();window.menuGate=g.buildingSystem.placeStartingBuilding('palisadeGate',44,27);g.gameLoop.gameSpeed=0;g.stayInShelterMode=true;const box=g.renderer.art.buildingBounds(menuGate,balance.buildings.palisadeGate);g.render();return{x:box.centerX,y:box.baseline-45};})()`);
    await mouse(p.x,p.y);await button('Open gate');
    assert(await ev('menuGate.gateOpen&&g.villagerSystem.openGateIds.has(menuGate.id)&&g.stayInShelterMode&&g.gameLoop.gameSpeed===0'));
    await shot('painted-gate-open');await mouse(p.x,p.y);await button('Close gate');
    assert(await ev('!menuGate.gateOpen&&!g.villagerSystem.openGateIds.has(menuGate.id)&&g.stayInShelterMode'));
    await shot('painted-gate-closed');return 'both controls change gate state without assigning a worker';
  });

  await check('closing a gate removes routes through it and save loading restores gate routing without a simulation tick',async()=>{
    const r=await ev(`(()=>{econReset();const v=g.villagerSystem.villagers[0];Object.assign(v,{x:30,y:20});let gate;for(let y=18;y<=22;y++)for(let x=28;x<=32;x++){if(x!==28&&x!==32&&y!==18&&y!==22)continue;g.tileMap.setTileType(x,y,'clear');const b=g.buildingSystem.placeStartingBuilding(x===32&&y===20?'palisadeGate':'palisadeWall',x,y);if(b.configId==='palisadeGate')gate=b;}g.toggleGate(gate.id);const assigned=g.villagerSystem.assignPath(v,34,20),through=v.path.some(p=>p.x===32&&p.y===20);const opened=JSON.parse(JSON.stringify(g.serializeState()));g.toggleGate(gate.id);const removed=!v.path.some(p=>p.x===32&&p.y===20),blocked=!g.villagerSystem.canReach(v,34,20),closed=JSON.parse(JSON.stringify(g.serializeState()));g.deserializeState(opened);const restoredOpen=g.villagerSystem.canReach(g.villagerSystem.getVillagerById(v.id),34,20);g.deserializeState(closed);const restoredClosed=!g.villagerSystem.canReach(g.villagerSystem.getVillagerById(v.id),34,20);return{assigned,through,removed,blocked,restoredOpen,restoredClosed};})()`);
    assert(Object.values(r).every(Boolean));return r;
  });

  await check('painted reinforced panels and all four gate images load with alpha and change with season and gate state',async()=>{
    const r=await ev(`(()=>{econReset();const assets=g.renderer.assets,images=[assets.getReinforcedFence('summer'),assets.getReinforcedFence('winter'),...['summer','winter'].flatMap(s=>[assets.getPalisadeGate(s,false),assets.getPalisadeGate(s,true)])];const samples=images.map(img=>{if(!img)return{loaded:false};const c=document.createElement('canvas');c.width=c.height=40;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,40,40);const d=ctx.getImageData(0,0,40,40).data;let alpha=0,snow=0;for(let i=0;i<d.length;i+=4){alpha+=d[i+3]===0;snow+=d[i+3]>100&&d[i]>190&&d[i+1]>190&&d[i+2]>185;}return{loaded:true,alpha,snow,src:img.src};});return{samples,unique:new Set(images.map(i=>i?.src)).size};})()`);
    assert.equal(r.unique,6);assert(r.samples.every(s=>s.loaded&&s.alpha>100));assert(r.samples[1].snow>r.samples[0].snow+10);assert(r.samples[4].snow>r.samples[2].snow+10);assert(r.samples[5].snow>r.samples[3].snow+10);return r;
  });

  await check('painted palisade renders all sixteen joins and native missing-image fallbacks',async()=>{
    const r=await ev(`(()=>{econReset();const art=g.renderer.art.fences,assets=g.renderer.assets,c=document.createElement('canvas');c.width=1000;c.height=620;const ctx=c.getContext('2d');ctx.fillStyle='#62734a';ctx.fillRect(0,0,c.width,c.height);const base=g.camera.worldToScreen(40.5*48,30.5*48),hashes=[];for(let mask=0;mask<16;mask++){const b={id:'centre',configId:'palisadeWall',tileX:40,tileY:30,built:true,upgraded:true},neighbours=[[0,-1],[1,0],[0,1],[-1,0]].flatMap(([dx,dy],i)=>mask&(1<<i)?[{...b,id:'n'+i,tileX:40+dx,tileY:30+dy}]:[]);ctx.save();ctx.translate(120+(mask%4)*240-base.x,120+Math.floor(mask/4)*145-base.y);for(const p of [b,...neighbours].sort((a,b)=>a.tileX+a.tileY-b.tileX-b.tileY))art.draw(ctx,p,[b,...neighbours],mask>=8?'winter':'summer');ctx.restore();const pixels=ctx.getImageData(mask%4*240,Math.floor(mask/4)*145,240,145).data;hashes.push(pixels.reduce((s,n,i)=>(s+Math.imul(n,i+1))>>>0,0));}const post=assets.getReinforcedFence,gate=assets.getPalisadeGate;let fallback;try{assets.getReinforcedFence=()=>null;assets.getPalisadeGate=()=>null;const f=document.createElement('canvas');f.width=f.height=200;const p=f.getContext('2d');p.translate(100-base.x,140-base.y);art.draw(p,{id:'f',configId:'palisadeWall',tileX:40,tileY:30,built:true,upgraded:true},[],'winter');art.draw(p,{id:'g',configId:'palisadeGate',tileX:41,tileY:30,built:true,gateOpen:true},[],'winter');fallback=Array.from(p.getImageData(0,0,200,200).data).some((n,i)=>i%4===3&&n>0);}finally{assets.getReinforcedFence=post;assets.getPalisadeGate=gate;}return{unique:new Set(hashes).size,fallback,image:c.toDataURL()};})()`);
    assert.equal(r.unique,16);assert(r.fallback);const fs=await import('node:fs/promises');await fs.writeFile('.qa/reinforced-fence-joins.png',Buffer.from(r.image.split(',')[1],'base64'));return{unique:r.unique,fallback:r.fallback};
  });

  await check('generated open gates show a transparent passage in both axes and both seasons',async()=>{
    const r=await ev(`(()=>{const sprites=g.renderer.art.fences.sprites,grid=document.createElement('canvas');grid.width=960;grid.height=360;const out=grid.getContext('2d'),frames=[];let i=0;for(const season of ['summer','winter'])for(const open of [false,true])for(const axis of [1,-1]){const c=document.createElement('canvas');c.width=240;c.height=180;const ctx=c.getContext('2d');ctx.translate(axis>0?80:160,110);ctx.scale(2,2);sprites.gate(ctx,{x:0,y:0},{x:40*axis,y:20},season,open,true);ctx.setTransform(1,0,0,1,0,0);const alpha=ctx.getImageData(120,82,1,1).data[3],image=c.toDataURL();frames.push({season,open,axis,alpha,image});ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#62734a';ctx.fillRect(0,0,240,180);out.drawImage(c,i%4*240,Math.floor(i/4)*180);i++;}return{frames:frames.map(({image,...f})=>f),unique:new Set(frames.map(f=>f.image)).size,image:grid.toDataURL()};})()`);
    assert.equal(r.unique,8);assert(r.frames.filter(f=>f.open).every(f=>f.alpha<20),JSON.stringify(r.frames));assert(r.frames.filter(f=>!f.open).every(f=>f.alpha>200),JSON.stringify(r.frames));const fs=await import('node:fs/promises');await fs.writeFile('.qa/gates-season-state-axes.png',Buffer.from(r.image.split(',')[1],'base64'));return{frames:r.frames,unique:r.unique};
  });

  await check('a phone can open a gate using a touch-sized context action',async()=>{
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await call('Emulation.setTouchEmulationEnabled',{enabled:true});
    const p=await ev(`(()=>{econReset();g.renderer.resize();window.phoneGate=g.buildingSystem.placeStartingBuilding('palisadeGate',42,27);g.camera.centerOn(42.5*48,27.5*48);g.gameLoop.gameSpeed=0;g.render();const box=g.renderer.art.buildingBounds(phoneGate,balance.buildings.palisadeGate);return{x:box.centerX,y:box.baseline-45};})()`);
    await mouse(p.x,p.y);const point=await ev(`(()=>{const b=[...document.querySelectorAll('.action-menu button')].find(b=>b.textContent.includes('Open gate')),r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,height:r.height,right:r.right};})()`);
    assert(point.height>=44&&point.right<=390);await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(await ev('phoneGate.gateOpen'));await shot('painted-gate-mobile');return point;
  });
}
