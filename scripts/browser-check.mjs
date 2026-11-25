/** Run against `npm run dev` and a dedicated Chrome --headless=new --mute-audio --remote-debugging-port=9461.
 * Requires Node 22+. No browser automation packages or production debug hooks.
 * Silent by default. CHECK_AUDIO=1 is reserved for explicitly requested sound checks.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173/';
const endpoint = process.env.CHROME_URL ?? 'http://127.0.0.1:9461';
const output = '.qa';
const checkAudio = process.env.CHECK_AUDIO === '1';
await fs.mkdir(output, { recursive: true });
const targets = await (await fetch(endpoint + '/json/list')).json();
const target = targets.find(t => t.type === 'page');
assert(target, 'Open a dedicated test Chrome first.');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
let id = 0; const pending = new Map(), exceptions = [], checks = [];
let startupRequestId = null;
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const key = ++id, timer = setTimeout(() => { pending.delete(key); reject(new Error('Timed out: ' + method)); }, 45000);
    pending.set(key, { resolve, reject, timer }); ws.send(JSON.stringify({ id: key, method, params }));
  });
}
ws.addEventListener('message', event => {
  const m = JSON.parse(event.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); clearTimeout(p.timer); pending.delete(m.id); m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result); }
  else if (m.method === 'Fetch.requestPaused') {
    const local = m.params.request.url.startsWith(base) || m.params.request.url.startsWith('data:');
    // Hold config loading while installing the test hook, before automatic start.
    if (!startupRequestId && m.params.request.url === new URL('data/game-balance.json', base).href) {
      startupRequestId = m.params.requestId;
      return;
    }
    call(local ? 'Fetch.continueRequest' : 'Fetch.failRequest', { requestId: m.params.requestId, ...(local ? {} : { errorReason: 'BlockedByClient' }) }).catch(() => {});
  } else if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails);
});
async function ev(expression) { const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
const delay = n => new Promise(r => setTimeout(r, n));
async function wait(expression) { for (let i = 0; i < 150; i++) { if (await ev(expression)) return; await delay(100); } throw Error('Not ready: ' + expression); }
async function shot(name) { await ev('g.updateUI();g.render()'); const r = await call('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(`${output}/${name}.png`, Buffer.from(r.data, 'base64')); }
async function mouse(x, y) { await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); await ev('g.handleInput();g.updateUI();g.render()'); }
async function clickSelector(selector) {
  const p = await ev(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw Error('Missing ${selector}'); const r=el.getBoundingClientRect();el.scrollIntoView({block:'nearest'}); const q=el.getBoundingClientRect();const hit=document.elementFromPoint(q.x+q.width/2,q.y+q.height/2); return {x:q.x+q.width/2,y:q.y+q.height/2,accessible:!!hit&&(el===hit||el.contains(hit))}; })()`);
  assert(p.accessible, 'Control is covered: ' + selector); await mouse(p.x, p.y);
}
async function button(text) { const selector = await ev(`(() => {const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)}));if(!b)throw Error('Missing button: '+${JSON.stringify(text)});b.dataset.qa='target';return '[data-qa="target"]';})()`); await clickSelector(selector); await ev('document.querySelector(\'[data-qa="target"]\')?.removeAttribute("data-qa")'); }
async function tile(x, y) { const p = await ev(`g.camera.worldToScreen(${x}*48,${y}*48)`); await mouse(p.x, p.y); }
async function until(expression, seconds = 90) {
  const r = await ev(`(() => {let elapsed=0;while(!(${expression}) && elapsed<${seconds} && !g.gameOver){if(g.tutorialSystem.isAwaitingAcknowledgement())g.acknowledgeTutorial();g.update(.05);elapsed+=.05;}g.updateUI();g.render();return {pass:!!(${expression}),elapsed,food:g.resourceSystem.resources.food,pop:g.villagerSystem.getAliveCount(),season:g.seasonSystem.season,year:g.seasonSystem.year};})()`);
  assert(r.pass, `Timed out: ${expression} ${JSON.stringify(r)}`); return r;
}
async function check(name, fn) { try { const detail = await fn(); checks.push({ name, pass: true, detail }); console.log('PASS', name, JSON.stringify(detail ?? '')); } catch (e) { checks.push({ name, pass: false, error: e.message }); console.log('FAIL', name, e.message); await shot('failure-' + checks.length).catch(() => {}); await fs.writeFile(`${output}/failure-state-${checks.length}.json`,JSON.stringify(await ev('g.serializeState()'),null,2)).catch(()=>{}); } }
try {
  await call('Page.enable'); await call('Page.bringToFront');
  // Reusing a dedicated browser must not replay exceptions from an earlier run.
  await call('Runtime.discardConsoleEntries');
  await call('Runtime.enable'); await call('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  if (!checkAudio) {
    // Also mute media in the page, even if Chrome was launched without --mute-audio.
    await call('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{const originalPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){this.muted=true;return originalPlay.apply(this,args);};})();` });
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: base });
  for (let i = 0; i < 150 && !startupRequestId; i++) await delay(100);
  assert(startupRequestId, 'Configuration request did not arrive.');
  await check('launch shows the current title and loading bar without a Start button', async()=>{
    const r=await ev(`({title:document.querySelector('#loading-screen h1')?.textContent,visible:getComputedStyle(document.getElementById('loading-screen')).display!=='none',progress:document.getElementById('loading-progress')?.value,intro:!!document.querySelector('#intro-screen,#intro-start-btn')})`);
    assert.equal(r.title,'Before Winter Comes');assert(r.visible);assert.equal(r.progress,0);assert(!r.intro);
    const image=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile(output+'/loading-desktop.png',Buffer.from(image.data,'base64'));return r;
  });
  await ev(`(async()=>{const gameUrl=performance.getEntriesByType('resource').filter(r=>r.name.includes('/src/game/Game.ts')).at(-1)?.name ?? new URL('src/game/Game.ts',location.href).href;const {Game}=await import(gameUrl);const original=Game.prototype.start;Game.prototype.start=function(){window.g=this;if(!${checkAudio}&&this.soundManager.isSoundEnabled())this.soundManager.toggleSound();original.call(this);};})()`);
  await ev(`window.loadingSamples=[];window.loadingObserver=new MutationObserver(()=>{const p=document.getElementById('loading-progress');window.loadingSamples.push(p.value/p.max);});window.loadingObserver.observe(document.getElementById('loading-progress'),{attributes:true});`);
  await call('Fetch.continueRequest', { requestId: startupRequestId });
  await wait('!!window.g && document.getElementById("loading-screen").style.display === "none"');
  await check('loading completes and the game starts without user input', async()=>{
    const r=await ev(`(()=>{window.loadingObserver.disconnect();return{complete:document.getElementById('loading-progress').value===document.getElementById('loading-progress').max,villagers:g.villagerSystem.getAliveCount(),briefing:g.tutorialSystem.isAwaitingAcknowledgement(),samples:window.loadingSamples};})()`);
    assert(r.complete);assert(r.villagers>0);assert(r.briefing);assert(r.samples.some(p=>p>0&&p<1));assert(r.samples.every((p,i,a)=>p>=0&&p<=1&&(!i||p>=a[i-1])));return r;
  });
  await wait('!!window.g'); await ev('g.gameLoop.stop();window.restartWithBriefings=g.restart.bind(g);g.restart=function(){window.restartWithBriefings();this.tutorialSystem.skip();this.updateUI();};g.tutorialSystem.skip();g.updateUI();g.render()'); await shot('spring-desktop');
  await check('custom interface artwork loads and buttons keep accessible labels', async()=>{
    const result=await ev(`(async()=>{const url=performance.getEntriesByType('resource').filter(r=>r.name.includes('/src/ui/icons.ts')).at(-1).name;const {iconNames,iconMarkup}=await import(url);const loaded=await Promise.all(iconNames.map(name=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve({name,ok:img.naturalWidth===48});img.onerror=()=>resolve({name,ok:false});img.src='./assets/ui/icons/'+name+'.svg';})));const icons=[...document.querySelectorAll('[data-ui-icon]')];const emoji=[...document.querySelector('#ui-overlay').textContent].filter(c=>{const n=c.codePointAt(0);return n>=0x1f000&&n<=0x1faff||n>=0x2600&&n<=0x27ff});const unlabeled=[...document.querySelectorAll('button')].filter(b=>!b.getAttribute('aria-label')&&!b.textContent.trim()).length;const preview=document.createElement('div');preview.id='qa-icon-sheet';preview.dataset.ui='true';preview.style.cssText='position:fixed;inset:0;z-index:2000;background:#21382d;padding:40px;color:#ecdfbf;font:14px Trebuchet MS';preview.innerHTML='<div style="font:32px Georgia;margin-bottom:10px">Before Winter Comes</div><div style="color:#b5bd9b;margin-bottom:25px">Timber · parchment · aged iron</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:22px">'+iconNames.map(name=>'<div style="height:112px;border:1px solid #d3b57626;border-radius:10px;background:#50614326;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px">'+iconMarkup(name)+'<span>'+name+'</span></div>').join('')+'</div>';preview.querySelectorAll('img').forEach(img=>{img.style.width='56px';img.style.height='56px'});document.body.appendChild(preview);await new Promise(requestAnimationFrame);return{loaded,visibleIcons:icons.length,emoji:emoji.length,unlabeled}})()`);
    const preview=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile(output+'/interface-icon-sheet.png',Buffer.from(preview.data,'base64'));await ev('document.getElementById("qa-icon-sheet").remove()');
    assert(result.loaded.every(i=>i.ok));assert(result.visibleIcons>=20);assert.equal(result.emoji,0);assert.equal(result.unlabeled,0);return{assets:result.loaded.length,visibleIcons:result.visibleIcons};
  });
  await check('projection and zoom round-trip', async () => {
    const result = await ev(`(()=>{const c=g.camera,old=c.zoom;let error=0;for(const z of [.6,1,1.5]){c.setZoom(z);for(const [x,y]of[[.25,.7],[40.5,30.5],[79.1,59.9]]){const p=c.worldToScreen(x*48,y*48),q=c.screenToWorld(p.x,p.y);error=Math.max(error,Math.abs(q.x-x*48),Math.abs(q.y-y*48));}}c.setZoom(old);return error;})()`); assert(result < 1e-8); return result;
  });
  await check('first year through visible controls', async () => {
    await ev('window.restartWithBriefings();g.gameLoop.stop();g.updateUI();g.render()');
    await clickSelector('[data-tutorial-acknowledge]');
    await button('Clear');
    const p=await ev('(()=>{const v=g.villagerSystem.villagers[0],p=g.camera.worldToScreen((v.x+.5)*48,(v.y+.5)*48);return{x:p.x,y:p.y-18}})()');await mouse(p.x,p.y);await button('Hunt');
    await button('Build');await clickSelector('[data-building-id="garden"]');await tile(42.2,27.2);
    await until('g.buildingSystem.buildings.some(b=>b.configId==="garden"&&b.built)',65);
    assert(await ev('g.buildingSystem.buildings.find(b=>b.configId==="garden").assignedWorkers.length===1'));await ev('g.deselectVillager()');
    await until('g.buildingSystem.buildings.find(b=>b.configId==="garden").cropState==="growing"',15);
    assert.equal(await ev('g.resourceSystem.resources.techPoints'),0);
    await until('g.resourceSystem.resources.food>=g.getWinterFoodTarget()',130);
    const before=await ev('({year:g.seasonSystem.year,season:g.seasonSystem.season,food:g.resourceSystem.resources.food,pop:g.villagerSystem.getAliveCount(),garden:g.buildingSystem.buildings.find(b=>b.configId==="garden")})');
    assert.equal(before.year,1);assert(before.garden.assignedWorkers.length>0);await shot('village-established');
    await button('Shelter');await until('g.villagerSystem.getAliveVillagers().every(v=>g.isVillagerInShelter(v.id))',20);
    await until('g.seasonSystem.season==="winter"',150);await shot('winter-desktop');await until('g.seasonSystem.year===2',130);
    assert(await ev('g.saveSystem.hasAutosave()'));assert.equal(await ev('g.resourceSystem.resources.techPoints'),1);
    assert.equal(await ev('g.stayInShelterMode'),false);await until('g.villagerSystem.villagers.some(v=>v.currentTask==="farming"&&v.state==="working")',30);
    return{before,spring:await ev('({population:g.villagerSystem.getAliveCount(),year:g.seasonSystem.year,food:g.resourceSystem.resources.food,stars:g.resourceSystem.resources.techPoints})')};
  });
  await check('winter save restores active wave and timers', async () => {
    const result=await ev(`(()=>{g.restart();g.gameLoop.stop();g.resourceSystem.resources.food=50;g.seasonSystem.season='winter';g.hordeSystem.startWinter(1,1);g.update(8.1);const state=g.hordeSystem.serialize();g.manualSave();g.restart();g.manualLoad();g.gameLoop.stop();const after=g.hordeSystem.serialize();return {before:state,after};})()`);
    assert(result.after.isActive); assert.equal(result.after.enemies.length,result.before.enemies.length); assert.equal(result.after.waveTimer,result.before.waveTimer); return {enemies:result.after.enemies.length,timer:result.after.waveTimer};
  });
  await check('pause accepts villager orders immediately', async () => {
    await ev('g.restart();g.ui.closePanels();g.tutorialSystem.skip();g.gameLoop.start()'); await delay(100); await clickSelector('[data-speed="0"]');
    const p=await ev('(()=>{const v=g.villagerSystem.villagers[0],p=g.camera.worldToScreen((v.x+.5)*48,(v.y+.5)*48);return{x:p.x,y:p.y-18,id:v.id};})()');
    await call('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1}); await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1}); await delay(180);
    const state=await ev('({selected:g.selectedVillagerId,queued:g.input.state.clicked,speed:g.gameLoop.gameSpeed})');await ev('g.gameLoop.stop()'); assert.equal(state.selected,p.id);assert.equal(state.speed,0);assert(!state.queued);return state;
  });
  await check('selected villager sees available jobs and starts them immediately', async()=>{
    await ev('g.restart();g.gameLoop.stop();g.tutorialSystem.skip();g.villagerSystem.setShelters(g.buildingSystem.getHousingTiles());g.updateUI();g.render()');
    const p=await ev('(()=>{const v=g.villagerSystem.villagers[0],p=g.camera.worldToScreen((v.x+.5)*48,(v.y+.5)*48);return{x:p.x,y:p.y-18,id:v.id,other:JSON.stringify(g.villagerSystem.villagers[1])}})()');await mouse(p.x,p.y);
    const initial=await ev('[...document.querySelectorAll("[data-villager-order]")].map(b=>b.dataset.villagerOrder)');assert(!initial.includes('farm')&&!initial.includes('build')&&!initial.includes('repair')&&!initial.includes('work'));
    await clickSelector('[data-villager-order="chop"]');assert.equal(await ev('g.villagerSystem.villagers[0].currentTask'),'clearing');assert.equal(await ev('g.pendingOrder'),null);
    await clickSelector('[data-villager-order="hunt"]');const depth=await ev('(()=>{const v=g.villagerSystem.villagers[0];return g.villagerSystem.huntingGrounds.depthAt(v.targetX,v.targetY)})()');assert(depth>=10&&depth<=20);assert.equal(await ev('g.villagerSystem.villagers[0].currentTask'),'hunting');
    assert.equal(await ev('JSON.stringify(g.villagerSystem.villagers[1])'),p.other);
    const garden=await ev('g.buildingSystem.placeStartingBuilding("garden",42,27)');await ev('g.updateUI()');await clickSelector('[data-villager-order="farm"]');assert.equal(await ev('g.villagerSystem.villagers[0].assignedBuildingId'),garden.id);assert.equal(await ev('g.pendingOrder'),null);await shot('villager-farming-order');
    await clickSelector('[data-villager-order="stop"]');const stopped=await ev('(()=>{const v=g.villagerSystem.villagers[0];for(let i=0;i<30;i++)g.update(.05);return{task:v.currentTask,path:v.path.length,hold:v.holdPosition,assigned:v.assignedBuildingId}})()');assert.deepEqual(stopped,{task:null,path:0,hold:true,assigned:null});
    const saved=await ev('(()=>{const id=g.selectedVillagerId,state=g.serializeState();g.deserializeState(state);return g.villagerSystem.getVillagerById(id).holdPosition})()');assert(saved);return{initial,depth,stopped};
  });
  await check('selected worker builds and repairs without stealing other workers',async()=>{
    await ev('g.restart();g.gameLoop.stop();g.tutorialSystem.skip();g.resourceSystem.resources.wood=50;g.resourceSystem.resources.food=100;g.updateUI();g.render()');
    const p=await ev('(()=>{const v=g.villagerSystem.villagers[0],p=g.camera.worldToScreen((v.x+.5)*48,(v.y+.5)*48);return{x:p.x,y:p.y-18,id:v.id}})()');await mouse(p.x,p.y);
    const site=await ev('g.buildingSystem.placeBuilding("hut",42,27)');assert(site);
    await ev('g.updateUI()');await clickSelector('[data-villager-order="build"]');
    assert.equal(await ev('g.villagerSystem.villagers[0].currentTask'),'building');
    await until(`g.buildingSystem.buildings.find(b=>b.id===${JSON.stringify(site.id)}).built`,30);
    await ev(`g.buildingSystem.buildings.find(b=>b.id===${JSON.stringify(site.id)}).hp-=20`);
    await ev('g.updateUI()');await clickSelector('[data-villager-order="repair"]');
    assert.equal(await ev('g.villagerSystem.villagers[0].currentTask'),'repairing');
    await until(`(()=>{const b=g.buildingSystem.buildings.find(b=>b.id===${JSON.stringify(site.id)});return b.hp===b.maxHp})()`,30);
    return {builder:p.id,building:site.id};
  });
  await check('tools animate distinct work poses and freeze while paused',async()=>{
    const result=await ev(`(async()=>{const url=performance.getEntriesByType('resource').filter(r=>r.name.includes('/src/render/VillagerArt.ts')).at(-1).name;const {VillagerArt}=await import(url);const art=new VillagerArt(g.camera,g.renderer.assets);const canvas=document.createElement('canvas');canvas.width=576;canvas.height=480;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#6b8050';ctx.fillRect(0,0,576,480);const tasks=['clearing','farming','building','hunting'],poses=[];for(let row=0;row<tasks.length;row++){const v={...g.villagerSystem.villagers[0],path:[],state:'working',currentTask:tasks[row],assignedBuildingId:null};const p=g.camera.worldToScreen((v.x+.5)*48,(v.y+.5)*48);const samples=[];for(let col=0;col<4;col++){ctx.save();ctx.translate(col*144+72,row*120+92);ctx.scale(2,2);ctx.translate(-p.x,-p.y);art.draw(ctx,v,'spring',col*.2,false);ctx.restore();ctx.fillStyle='#f4e7c5';ctx.font='12px system-ui';ctx.fillText(tasks[row],col*144+12,row*120+17);samples.push([...ctx.getImageData(col*144,row*120,144,120).data].reduce((sum,n,i)=>(sum+Math.imul(n,i+1))>>>0,0));}poses.push(new Set(samples).size);}const speed=g.gameLoop.gameSpeed;g.gameLoop.gameSpeed=0;g.render();const before=g.renderer.time,pixels=g.renderer.ctx.canvas.toDataURL();g.renderer.lastFrameTime-=200;g.render();const frozen=before===g.renderer.time&&pixels===g.renderer.ctx.canvas.toDataURL();g.gameLoop.gameSpeed=1;g.renderer.lastFrameTime-=120;g.render();const advances=g.renderer.time>before;g.gameLoop.gameSpeed=speed;return{poses,frozen,advances,image:canvas.toDataURL()}})()`);
    await fs.writeFile(output+'/work-poses.png',Buffer.from(result.image.split(',')[1],'base64'));delete result.image;
    assert(result.poses.every(n=>n===4));assert(result.frozen);assert(result.advances);return result;
  });
  await check('walking uses continuous steps with eased starts and stops',async()=>{
    const result=await ev(`(async()=>{const url=performance.getEntriesByType('resource').filter(r=>r.name.includes('/src/render/VillagerArt.ts')).at(-1).name;const {VillagerArt}=await import(url),art=new VillagerArt(g.camera,g.renderer.assets);const v={...g.villagerSystem.villagers[0],id:'walk-preview',x:40,y:30,path:[{x:43,y:30}],currentTask:null,assignedBuildingId:null,state:'moving'};const c=document.createElement('canvas');c.width=768;c.height=140;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#607849';ctx.fillRect(0,0,c.width,c.height);let previous=0,continuous=true;const strides=[];for(let i=0;i<8;i++){v.x+=.15;const p=g.camera.worldToScreen((v.x+.5)*48,(v.y+.5)*48);ctx.save();ctx.translate(i*96+48-p.x*2,115-p.y*2);ctx.scale(2,2);art.draw(ctx,v,'spring',i*.08,false);ctx.restore();const pose=art.poses.get(v.id);if(i&&pose.phase<=previous)continuous=false;previous=pose.phase;strides.push(pose.stride)}v.path=[];art.draw(ctx,v,'spring',.576,false);const easedStop=art.poses.get(v.id).stride>0&&art.poses.get(v.id).stride<strides.at(-1);return{continuous,strides,easedStop,image:c.toDataURL()}})()`);
    await fs.writeFile(output+'/walking-poses.png',Buffer.from(result.image.split(',')[1],'base64'));delete result.image;
    assert(result.continuous);assert(result.strides[0]===0&&result.strides[1]>0&&result.strides[1]<1);assert(result.easedStop);return result;
  });
  await check('retired buildings migrate without ghost tiles or lost research',async()=>{
    const r=await ev(`(()=>{
      g.restart();g.gameLoop.stop();g.tutorialSystem.skip();
      const hut=g.buildingSystem.placeStartingBuilding('garden',42,27),fire=g.buildingSystem.placeStartingBuilding('campFire',37,32),scout=g.buildingSystem.placeStartingBuilding('campFire',34,26),tower=g.buildingSystem.placeStartingBuilding('watchtower',43,30);
      const data=JSON.parse(JSON.stringify(g.serializeState()));
      for(const [id,configId]of [[hut.id,'hunterHut'],[fire.id,'bonfire'],[scout.id,'scoutFire']])data.buildings.find(b=>b.id===id).configId=configId;
      data.villagers[0].assignedBuildingId=hut.id;data.villagers[0].currentTask='working';data.buildings.find(b=>b.id===hut.id).assignedWorkers=[data.villagers[0].id];
      data.villagers[1].assignedBuildingId=tower.id;data.villagers[1].currentTask='working';data.buildings.find(b=>b.id===tower.id).assignedWorkers=[data.villagers[1].id];
      data.technology={unlockedTechs:['hunterHut','scoutFire'],unlockedBuildings:['hut','hunterHut','scoutFire','bonfire']};data.resources={...data.resources,wood:5,tools:0,techPoints:1};
      data.shelteredJobs=[{villagerId:data.villagers[0].id,buildingId:hut.id}];const original=JSON.stringify(data);g.deserializeState(data);
      const migrated=JSON.parse(JSON.stringify(g.serializeState())),state={wood:migrated.resources.wood,research:migrated.resources.techPoints};g.deserializeState(migrated);
      return{removed:!g.buildingSystem.buildings.some(b=>['hunterHut','scoutFire','bonfire'].includes(b.configId)),clear:[g.tileMap.getTile(42,27),g.tileMap.getTile(43,28)].every(t=>t.type==='clear'&&!t.buildingId),fires:g.buildingSystem.getBuildingsOfType('campFire').length,released:g.villagerSystem.villagers.every(v=>!v.assignedBuildingId&&!v.currentTask),tech:g.techSystem.serialize(),state,again:{wood:g.resourceSystem.resources.wood,research:g.resourceSystem.resources.techPoints},originalUnchanged:JSON.stringify(data)===original,shelteredJobs:g.shelteredJobs.length};
    })()`);
    assert(r.removed&&r.clear&&r.released&&r.originalUnchanged);assert.equal(r.fires,2);assert.equal(r.shelteredJobs,0);assert.deepEqual(r.state,{wood:25,research:7});assert.deepEqual(r.again,r.state);assert.deepEqual(r.tech.unlockedTechs,['campFire','garden']);assert(!r.tech.unlockedBuildings.includes('hunterHut'));return r;
  });
  await check('hunters reach ten to twenty tiles inside forest and bring back fur',async()=>{
    await ev(`g.restart();g.gameLoop.stop();g.tutorialSystem.skip();g.villagerActionHunt(g.villagerSystem.villagers[0].id);
      const oldHunt=JSON.parse(JSON.stringify(g.serializeState()));Object.assign(oldHunt.villagers[0],{x:34,y:30,targetX:34,targetY:30,path:[],state:'working'});g.deserializeState(oldHunt);`);
    await until('g.villagerSystem.villagers[0].currentTask==="hunting"&&g.villagerSystem.villagers[0].state==="working"',60);
    const r=await ev(`(()=>{const v=g.villagerSystem.villagers[0],depth=g.villagerSystem.huntingGrounds.depthAt(v.x,v.y),before=g.resourceSystem.resources.fur;
      v.taskProgress=30;const random=Math.random;try{Math.random=()=>1;g.update(.05);}finally{Math.random=random;}
      return{depth,fur:g.resourceSystem.resources.fur-before,returning:v.currentTask==='returnHome',forestPath:v.path.length>0};})()`);
    assert(r.depth>=10&&r.depth<=20);assert.equal(r.fur,0);assert(r.returning&&r.forestPath);await until('g.resourceSystem.resources.fur>=2&&!g.villagerSystem.villagers[0].cargo',40);return{...r,delivered:await ev('g.resourceSystem.resources.fur')};
  });
  await check('retired workshop refunds once and releases its workers on load', async()=>{
    const result=await ev(`(()=>{g.restart();g.gameLoop.stop();const saved=g.serializeState(),v=saved.villagers[0];saved.buildings.push({id:'old-workshop',configId:'workshop',tileX:42,tileY:27,built:true,buildProgress:1,hp:80,maxHp:80,assignedWorkers:[v.id],needsRepair:false});saved.tileMap[27][42].buildingId='old-workshop';saved.tileMap[27][42].type='building';v.assignedBuildingId='old-workshop';v.currentTask='working';saved.resources.wood=5;saved.resources.techPoints=0;saved.technology.unlockedTechs.push('workshop','betterTools');saved.technology.unlockedBuildings.push('workshop');g.deserializeState(saved);const first=g.serializeState();g.deserializeState(first);return{removed:!g.buildingSystem.buildings.some(b=>b.configId==='workshop'),wood:g.resourceSystem.resources.wood,stars:g.resourceSystem.resources.techPoints,task:g.villagerSystem.villagers[0].currentTask,unlocked:g.techSystem.unlockedBuildings.has('workshop')};})()`);
    assert(result.removed&&!result.unlocked);assert.equal(result.wood,35);assert.equal(result.stars,3);assert.equal(result.task,null);return result;
  });
  await check('remaining production and passive buildings provide useful effects',async()=>{
    const r=await ev(`(()=>{
      g.restart();g.gameLoop.stop();g.tutorialSystem.skip();const v=g.villagerSystem.villagers[0],camp=g.buildingSystem.placeStartingBuilding('lumberCamp',42,27);
      const arrive=b=>{const p=g.buildingSystem.getArrivalTiles(b)[0];Object.assign(v,{x:p.x,y:p.y,assignedBuildingId:b.id,currentTask:'working',state:'working',path:[]});b.assignedWorkers=[v.id];};
      arrive(camp);const wood=g.resourceSystem.resources.wood;g.updateResourceProduction(10);const woodGain=g.resourceSystem.resources.wood-wood;
      g.buildingSystem.demolishBuilding(camp.id);const f=g.buildingSystem.placeStartingBuilding('furWorkshop',42,27);arrive(f);g.resourceSystem.resources.fur=2;g.updateResourceProduction(21);const clothes=g.furClothingProduced,fur=g.resourceSystem.resources.fur;
      g.resourceSystem.resources.food=30;g.updateFoodConsumption(10);const consumption=30-g.resourceSystem.resources.food;g.buildingSystem.demolishBuilding(f.id);
      const storage=g.buildingSystem.placeStartingBuilding('storage',42,27),workerRejected=!g.villagerSystem.assignVillagerToBuilding(v.id,storage.id,g.buildingSystem.buildings);g.resourceSystem.updateStorageCapacity(g.buildingSystem.getStorageBonuses());
      const outpost=g.buildingSystem.placeStartingBuilding('campFire',33,29),tower=g.buildingSystem.placeStartingBuilding('watchtower',43,30);
      return{woodGain,clothes,fur,consumption,workerRejected,capacity:g.resourceSystem.capacity,forestOutpost:!!outpost,detection:g.buildingSystem.getDetectionBuildings().map(p=>p.radius),comfort:g.buildingSystem.getComfortBonus(),towerWorkers:g.buildingSystem.getBuildingConfig(tower.configId).maxWorkers};
    })()`);
    assert(r.woodGain>0);assert.equal(r.clothes,1);assert.equal(r.fur,1);assert(Math.abs(r.consumption-.8)<1e-6);assert(r.workerRejected&&r.forestOutpost);assert.equal(r.capacity.wood,100);assert.deepEqual(r.detection,[5,8]);assert.equal(r.comfort,5);assert.equal(r.towerWorkers,0);return r;
  });
  await check('winter totals grow gradually from one to twenty-five independently of village level and reloads',async()=>{
    const r=await ev(`(()=>{const totals=[],restoredTotals=[],legacyTotals=[];const cfg=(g.hordeSystem.constructor),map=g.tileMap;const simulate=(year,level,reload,legacy=false)=>{let h=new cfg(map);h.startWinter(year,level);let count=0;const waves=[];for(let i=0;i<16;i++){h.update(100,40,30,[],[],[],[],()=>false,()=>{},()=>{},false);const spawned=h.enemies.length;count+=spawned;if(spawned){waves.push(spawned);const state=JSON.parse(JSON.stringify(h.serialize()));if(legacy)delete state.enemiesSpawnedThisWinter;if(reload){h=new cfg(map);h.deserialize(state);}h.enemies.forEach(e=>e.state='dead');h.update(0,40,30,[],[],[],[],()=>false,()=>{},()=>{},false);if(reload){const state=JSON.parse(JSON.stringify(h.serialize()));if(legacy)delete state.enemiesSpawnedThisWinter;h=new cfg(map);h.deserialize(state);}}}return{year,level,count,waves,remaining:h.getActiveEnemies().length}};for(const year of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,20])for(const level of [1,3,5]){totals.push(simulate(year,level,false));restoredTotals.push(simulate(year,level,true));legacyTotals.push(simulate(year,level,true,true));}const old=new cfg(map);old.startWinter(18,5);old.update(100,40,30,[],[],[],[],()=>false,()=>{},()=>{},false);const oldEnemies=JSON.parse(JSON.stringify(old.enemies));const restored=new cfg(map);restored.deserialize(oldEnemies,true,18,5);let legacyArrayTotal=oldEnemies.length;for(let i=0;i<16;i++){restored.enemies.forEach(e=>e.state='dead');restored.update(100,40,30,[],[],[],[],()=>false,()=>{},()=>{},false);restored.update(100,40,30,[],[],[],[],()=>false,()=>{},()=>{},false);legacyArrayTotal+=restored.enemies.length;}return{totals,restoredTotals,legacyTotals,legacyArrayTotal};})()`);
    for(const runs of [r.totals,r.restoredTotals,r.legacyTotals])for(const run of runs){assert.equal(run.count,[1,2,3,4,6,7,8,10,11,12,14,15,16,17,20,21,22,25][Math.min(run.year-1,17)],JSON.stringify(run));assert.equal(run.remaining,0);assert(run.waves.every(n=>n>0));}
    assert.equal(r.legacyArrayTotal,25);return{totals:r.totals.filter(t=>t.level===5),reloadCases:r.restoredTotals.length,legacyCases:r.legacyTotals.length+1};
  });
  await check('all scheduled winter enemies arrive while earlier waves survive',async()=>{
    const result=await ev(`(()=>{
      const h=new g.hordeSystem.constructor(g.tileMap),arrivals=[],ids=new Set();h.startWinter(18,5);
      for(let elapsed=1;elapsed<=120;elapsed++){
        if(elapsed===40){const state=JSON.parse(JSON.stringify(h.serialize()));h.deserialize(state);}
        h.update(1,40,30,[],[],[],[],()=>false,()=>{},()=>{},elapsed>110);
        const newcomers=h.enemies.filter(e=>!ids.has(e.id));
        if(newcomers.length)arrivals.push({elapsed,count:newcomers.length});
        h.enemies.forEach(e=>ids.add(e.id));
      }
      return{arrivals,total:ids.size,alive:h.getActiveEnemies().length,spawned:h.serialize().enemiesSpawnedThisWinter};
    })()`);
    assert.deepEqual(result.arrivals,[{elapsed:8,count:9},{elapsed:38,count:8},{elapsed:68,count:8}]);
    assert.equal(result.total,25);assert.equal(result.alive,25);assert.equal(result.spawned,25);return result;
  });
  await check('one shelter button recalls and releases everyone with resident-only smoke', async()=>{
    await ev(`g.restart();g.gameLoop.stop();g.tutorialSystem.skip();window.shelterButton=document.querySelector('[data-shelter-toggle]');window.smokeLog=[];window.originalBuilding=g.renderer.art.building;g.renderer.art.building=function(...args){if(args[2].category==='housing')window.smokeLog.push(args[6]);return window.originalBuilding.apply(this,args)};g.updateUI();g.render()`);
    assert.equal(await ev('document.querySelectorAll("[data-shelter-toggle]").length'),1);
    assert.equal(await ev('window.smokeLog.at(-1)'),0);
    await clickSelector('[data-shelter-toggle]');assert.equal(await ev('g.stayInShelterMode'),true);
    await until('g.villagerSystem.getAliveVillagers().every(v=>g.isVillagerInShelter(v.id))',20);await shot('occupied-house-smoke');
    assert(await ev('window.smokeLog.at(-1)>0'));assert(await ev('window.shelterButton===document.querySelector("[data-shelter-toggle]")'));
    await clickSelector('[data-shelter-toggle]');assert.equal(await ev('g.stayInShelterMode'),false);
    await until('g.villagerSystem.getAliveVillagers().every(v=>!g.isVillagerInShelter(v.id))',20);await shot('empty-house-no-smoke');
    assert.equal(await ev('window.smokeLog.at(-1)'),0);
    await ev('g.renderer.art.building=window.originalBuilding');return 'same button; 0 -> occupied -> 0 smoke emitters';
  });
  await check('smoke animates only in occupied houses and crops show seven stages', async()=>{
    const result=await ev(`(async()=>{const url=performance.getEntriesByType('resource').filter(r=>r.name.includes('/src/render/CropArt.ts')).at(-1).name;const {CropArt,cropStage}=await import(url);const house=g.buildingSystem.buildings.find(b=>b.configId==='hut'),cfg=g.buildingSystem.getBuildingConfig('hut'),box=g.renderer.art.buildingBounds(house,cfg);const paint=(occupied,time)=>{const c=document.createElement('canvas');c.width=260;c.height=260;const ctx=c.getContext('2d');ctx.translate(130-box.centerX,235-box.baseline);g.renderer.art.building(ctx,house,cfg,'spring',time,g.buildingSystem.buildings,occupied);return c.toDataURL()};const emptyA=paint(0,.1),emptyB=paint(0,.8),occupiedA=paint(1,.1),occupiedB=paint(1,.8);const canvas=document.createElement('canvas');canvas.width=1120;canvas.height=200;const ctx=canvas.getContext('2d');ctx.fillStyle='#536845';ctx.fillRect(0,0,1120,200);const crop=new CropArt(g.camera,g.renderer.assets),garden={...house,configId:'garden',tileX:40,tileY:30};const cfgGarden=g.buildingSystem.getBuildingConfig('garden'),p=g.camera.worldToScreen(41*48,31*48),values=[0,.08,.23,.4,.6,.8,.97],hashes=[];for(let i=0;i<values.length;i++){garden.farmingProgress=values[i];ctx.save();ctx.translate(i*160+80-p.x,115-p.y);crop.draw(ctx,garden,cfgGarden,'spring',0);ctx.restore();ctx.fillStyle='#efdfba';ctx.font='11px system-ui';ctx.fillText(['Soil','Sown','Sprouts','Young plants','Flowering','Ripening','Ripe'][i],i*160+20,180);hashes.push([...ctx.getImageData(i*160,0,160,200).data].reduce((s,n,j)=>(s+Math.imul(n,j+1))>>>0,0))}return{emptyStable:emptyA===emptyB,occupiedAnimated:occupiedA!==occupiedB,stages:values.map(cropStage),unique:new Set(hashes).size,image:canvas.toDataURL()}})()`);
    await fs.writeFile(output+'/crop-stages.png',Buffer.from(result.image.split(',')[1],'base64'));delete result.image;
    assert(result.emptyStable);assert(result.occupiedAnimated);assert.deepEqual(result.stages,[0,1,2,3,4,5,6]);assert.equal(result.unique,7);return result;
  });
  await check('generated garden and ward sprites render, animate and retain shape fallbacks',async()=>{
    const r=await ev(`(()=>{
      const art=g.renderer.art,assets=g.renderer.assets,garden=g.buildingSystem.placeStartingBuilding('garden',42,27)??g.buildingSystem.buildings.find(b=>b.configId==='garden'),fire=g.buildingSystem.placeStartingBuilding('herbalFire',37,32);
      const paint=(b,time)=>{const c=document.createElement('canvas');c.width=240;c.height=220;const ctx=c.getContext('2d'),cfg=g.buildingSystem.getBuildingConfig(b.configId),bounds=art.buildingBounds(b,cfg);ctx.translate(120-bounds.centerX,190-bounds.baseline);art.building(ctx,b,cfg,'spring',time);return c.toDataURL()};
      fire.wardActive=true;const animated=paint(fire,.1)!==paint(fire,.3),paused=paint(fire,.3)===paint(fire,.3);fire.built=false;const unlit=paint(fire,.1)===paint(fire,.3);fire.built=true;
      const atlasGarden=assets.getGardenAtlas(),atlasWard=assets.getWardAtlas();garden.farmingProgress=.97;const illustrated=paint(garden,0);assets.images.delete('isometric/garden-growth-atlas.png');assets.images.delete('isometric/herbal-fire-atlas.png');let fallback;
      try{fallback=paint(garden,0)!==illustrated&&paint(fire,.1).length>1000;}finally{assets.images.set('isometric/garden-growth-atlas.png',atlasGarden);assets.images.set('isometric/herbal-fire-atlas.png',atlasWard);}
      const sheet=document.createElement('canvas');sheet.width=720;sheet.height=300;const ctx=sheet.getContext('2d');ctx.fillStyle='#526d45';ctx.fillRect(0,0,720,300);const cfgGarden=g.buildingSystem.getBuildingConfig('garden'),cfgFire=g.buildingSystem.getBuildingConfig('herbalFire');
      for(const [b,cfg,x]of [[garden,cfgGarden,180],[fire,cfgFire,530]]){const bounds=art.buildingBounds(b,cfg);ctx.save();ctx.translate(x-bounds.centerX*1.7,240-bounds.baseline*1.7);ctx.scale(1.7,1.7);art.building(ctx,b,cfg,'spring',.3);ctx.restore();}
      return{gardenLoaded:!!atlasGarden,wardLoaded:!!atlasWard,animated,paused,unlit,fallback,image:sheet.toDataURL()};
    })()`);
    await fs.writeFile(output+'/generated-garden-and-ward.png',Buffer.from(r.image.split(',')[1],'base64'));delete r.image;
    assert(r.gardenLoaded&&r.wardLoaded&&r.animated&&r.paused&&r.unlit&&r.fallback);await shot('illustrated-garden-ward-village');return r;
  });
  await check('fence corners connect in both axes and gates have open and closed models',async()=>{
    const result=await ev(`(async()=>{g.restart();g.gameLoop.stop();g.tutorialSystem.skip();const url=performance.getEntriesByType('resource').filter(r=>r.name.includes('/src/world/FenceConnections.ts')).at(-1).name;const {fenceConnections,fenceAxis}=await import(url);const points=g.getPalisadeLine({x:35,y:25},{x:39,y:28});for(const p of points)g.buildingSystem.placeStartingBuilding(p.x===37&&p.y===25?'palisadeGate':'palisadeWall',p.x,p.y);for(const p of g.getPalisadeLine({x:39,y:28},{x:43,y:28}).slice(1))g.buildingSystem.placeStartingBuilding('palisadeWall',p.x,p.y);const corner=g.buildingSystem.buildings.find(b=>b.tileX===39&&b.tileY===25),gate=g.buildingSystem.buildings.find(b=>b.configId==='palisadeGate');g.updateUI();g.render();return{points,connections:fenceConnections(corner,g.buildingSystem.buildings),axis:fenceAxis(gate,g.buildingSystem.buildings),gate:gate.id}})()`);
    assert(result.points.every((p,i,a)=>!i||Math.abs(p.x-a[i-1].x)+Math.abs(p.y-a[i-1].y)===1));assert.equal(result.connections.length,2);assert.deepEqual(result.axis,[1,0]);
    await shot('connected-fence-gate-closed');await ev('g.buildingSystem.buildings.find(b=>b.configId==="palisadeGate").gateOpen=true');await shot('connected-fence-gate-open');return result;
  });
  await check('monsters destroy all defenses before gardens and houses', async()=>{
    const result=await ev(`(()=>{g.restart();g.gameLoop.stop();g.protectionSystem.update(g.buildingSystem.buildings);const house=g.buildingSystem.buildings[0],garden=g.buildingSystem.placeStartingBuilding('garden',42,27),walls=[g.buildingSystem.placeStartingBuilding('palisadeWall',35,27),g.buildingSystem.placeStartingBuilding('palisadeWall',36,27),g.buildingSystem.placeStartingBuilding('palisadeGate',37,27)];walls.forEach(b=>b.hp=4);g.hordeSystem.startWinter(2,2);g.hordeSystem.waveSpawned=true;g.hordeSystem.waveTimer=999;g.hordeSystem.enemies=[0,1,2].map(i=>({id:'e_'+i,x:42+i,y:25+i,hp:30,maxHp:30,speed:2,damage:10,attackCooldown:0,targetX:null,targetY:null,path:[],visible:true,state:'approaching',targetBuildingId:null,patrolTarget:null,patrolTimer:0}));const hits=[],ids=new Set(walls.map(b=>b.id));let wrong=false;const update=()=>g.hordeSystem.update(.05,40,30,[],[],[],g.buildingSystem.getAttackableBuildingTiles(),()=>false,(id,damage)=>{if(!ids.has(id)&&g.buildingSystem.buildings.some(b=>ids.has(b.id)))wrong=true;hits.push(id);g.buildingSystem.damageBuilding(id,damage)},()=>{},false);for(let i=0;i<2400&&garden.hp===garden.maxHp;i++)update();const gardenHit=garden.hp<garden.maxHp;g.buildingSystem.demolishBuilding(garden.id);for(let i=0;i<600&&house.hp===house.maxHp;i++)update();return{wrong,hits,wallIds:[...ids],allWallsGone:!g.buildingSystem.buildings.some(b=>ids.has(b.id)),gardenHit,houseHit:house.hp<house.maxHp}})()`);
    assert(!result.wrong);assert(result.allWallsGone);assert(result.gardenHit);assert(result.houseHit);return result;
  });
  await check('herbal ward unlocks through research and blocks an eleven by eleven square', async()=>{
    await ev('g.restart();g.gameLoop.stop();g.tutorialSystem.skip();g.villagerSystem.spawnVillager(37,27);g.villagerSystem.spawnVillager(38,27);g.checkLevelUp();g.resourceSystem.resources.techPoints=5;g.resourceSystem.resources.wood=50;g.resourceSystem.resources.food=100;g.updateUI()');
    await button('Tech');await clickSelector('[data-tech-id="storage"]');await button('Tech');await clickSelector('[data-tech-id="herbalFire"]');await ev('g.ui.closePanels()');await button('Build');await clickSelector('[data-building-id="herbalFire"]');await tile(42.5,27.5);
    await until('g.buildingSystem.buildings.some(b=>b.configId==="herbalFire"&&b.built)',35);await shot('herbal-ward-spring');
    const result=await ev(`(()=>{const fire=g.buildingSystem.buildings.find(b=>b.configId==='herbalFire'),ward=g.protectionSystem;g.seasonSystem.season='winter';g.resourceSystem.resources.herbs=4;ward.advance(0,g.buildingSystem.buildings,g.resourceSystem,'winter');const radius=ward.zones[0].radius,outsideGarden=g.buildingSystem.placeStartingBuilding('garden',35,25);g.buildingSystem.placeStartingBuilding('palisadeWall',40,26);g.hordeSystem.startWinter(2,2);g.hordeSystem.waveSpawned=true;g.hordeSystem.waveTimer=999;g.hordeSystem.enemies=[{id:'e_1',x:42,y:29,hp:30,maxHp:30,speed:2,damage:10,attackCooldown:0,targetX:39,targetY:29,path:[{x:42,y:28}],visible:true,state:'attacking',targetBuildingId:g.buildingSystem.buildings[0].id,patrolTarget:null,patrolTimer:0},{id:'e_2',x:35,y:27,hp:30,maxHp:30,speed:2,damage:10,attackCooldown:0,targetX:null,targetY:null,path:[],visible:true,state:'approaching',targetBuildingId:null,patrolTarget:null,patrolTimer:0}];let entered=false,protectedHit=false,outsideHit=false;for(let i=0;i<300;i++){g.hordeSystem.update(.05,40,30,[],[],[],g.buildingSystem.getAttackableBuildingTiles(),()=>false,(id)=>{if(id===outsideGarden.id)outsideHit=true;const b=g.buildingSystem.buildings.find(b=>b.id===id);if(b&&ward.blocksTile(b.tileX,b.tileY))protectedHit=true},()=>{},false);if(g.hordeSystem.enemies.some(e=>ward.blocksPoint(e.x,e.y)))entered=true;}const state=g.serializeState();g.deserializeState(state);ward.update(g.buildingSystem.buildings);const restored=ward.zones.length;const corner=ward.blocksTile(fire.tileX-radius,fire.tileY-radius)&&ward.blocksTile(fire.tileX+radius,fire.tileY+radius),outside=!ward.blocksTile(fire.tileX+radius+1,fire.tileY);g.buildingSystem.demolishBuilding(fire.id);ward.update(g.buildingSystem.buildings);let returned=false;for(let i=0;i<500&&!returned;i++){g.hordeSystem.update(.05,40,30,[],[],[],g.buildingSystem.getAttackableBuildingTiles(),()=>false,()=>{},()=>{},false);returned=g.hordeSystem.enemies.some(e=>Math.max(Math.abs(Math.floor(e.x+.5)-fire.tileX),Math.abs(Math.floor(e.y+.5)-fire.tileY))<=radius);}return{radius,corner,outside,entered,protectedHit,outsideHit,restored,removed:ward.zones.length===0,returned}})()`);
    assert.equal(result.radius,5);assert(result.corner&&result.outside);assert(!result.entered&&!result.protectedHit);assert(result.outsideHit);assert.equal(result.restored,1);assert(result.removed&&result.returned);return result;
  });
  await check('top bar tooltips remain stable while values update and all interface corners are square',async()=>{
    await ev('g.restart();g.gameLoop.stop();g.ui.closePanels();g.updateUI();g.render();window.woodAnchor=document.querySelector("[data-stat=wood]")');
    const p=await ev('(()=>{const r=window.woodAnchor.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
    await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});await delay(80);
    assert(await ev('!document.getElementById("topbar-tooltip").hidden'));await ev('g.resourceSystem.resources.wood+=1;g.updateUI()');
    assert(await ev('window.woodAnchor===document.querySelector("[data-stat=wood]")&&!document.getElementById("topbar-tooltip").hidden'));await shot('topbar-wood-tooltip');
    await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:640,y:400});assert(await ev('document.getElementById("topbar-tooltip").hidden'));
    await ev('document.querySelector("[data-stat=food]").focus()');assert(await ev('document.getElementById("topbar-tooltip").textContent.includes("per second")'));await shot('topbar-food-tooltip');
    await button('Build');const bad=await ev('[...document.querySelectorAll("#ui-overlay button,[data-build-panel],[data-info-panel],#loading-progress")].filter(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius)!==0).map(el=>el.tagName)');assert.deepEqual(bad,[]);await ev('g.ui.closePanels()');return 'hover, focus, live updates; no rounded corners';
  });
  await check('50 visible villagers render within a playable frame budget',async()=>{
    await ev(`g.restart();g.gameLoop.stop();g.tutorialSystem.skip();g.villagerSystem.villagers=[];for(let y=26;y<34;y++)for(let x=36;x<44;x++)if(!g.tileMap.getTile(x,y).buildingId&&g.villagerSystem.getAliveCount()<55)g.villagerSystem.spawnVillager(x,y);g.updateUI();g.render()`);
    const r=await ev(`(async()=>{const samples=[];for(let i=0;i<40;i++){await new Promise(requestAnimationFrame);const t=performance.now();g.update(1/60);g.render();samples.push(performance.now()-t)}return{population:g.villagerSystem.getAliveCount(),meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:samples.sort((a,b)=>a-b)[Math.floor(samples.length*.95)]};})()`);await shot('population-55');assert(r.population>=50);assert(r.meanMs<33.4);return r;
  });
  await check('winter remains playable with 55 villagers, a connected fence and 14 monsters',async()=>{
    await ev(`g.restart();g.gameLoop.stop();g.tutorialSystem.skip();g.villagerSystem.villagers=[];for(let y=26;y<34;y++)for(let x=36;x<44;x++)if(!g.tileMap.getTile(x,y).buildingId&&g.villagerSystem.getAliveCount()<55)g.villagerSystem.spawnVillager(x,y);for(let x=35;x<=44;x++){g.buildingSystem.placeStartingBuilding('palisadeWall',x,25);g.buildingSystem.placeStartingBuilding('palisadeWall',x,34)}for(let y=26;y<34;y++){g.buildingSystem.placeStartingBuilding('palisadeWall',35,y);g.buildingSystem.placeStartingBuilding('palisadeWall',44,y)}g.seasonSystem.season='winter';g.resourceSystem.resources.food=100;g.hordeSystem.startWinter(2,3);g.hordeSystem.waveSpawned=true;g.hordeSystem.waveTimer=999;g.hordeSystem.enemies=Array.from({length:14},(_,i)=>({id:'e_'+i,x:30+i%2,y:24+i,hp:30,maxHp:30,speed:.8,damage:10,attackCooldown:0,targetX:null,targetY:null,path:[],visible:true,state:'approaching',targetBuildingId:null,patrolTarget:null,patrolTimer:0}));for(let i=0;i<200;i++)g.update(.05);g.updateUI();g.render()`);
    const result=await ev(`(async()=>{const samples=[];for(let i=0;i<50;i++){await new Promise(requestAnimationFrame);const t=performance.now();g.update(1/60);g.render();samples.push(performance.now()-t)}return{villagers:g.villagerSystem.getAliveCount(),monsters:g.hordeSystem.getActiveEnemies().length,walls:g.buildingSystem.buildings.filter(b=>b.configId==='palisadeWall').length,meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:samples.sort((a,b)=>a-b)[Math.floor(samples.length*.95)]}})()`);
    await shot('winter-fence-stress');assert.equal(result.villagers,55);assert.equal(result.monsters,14);assert(result.walls>20);assert(result.meanMs<33.4,JSON.stringify(result));return result;
  });
  await check('mobile menus remain reachable and touch camera works',async()=>{
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    await ev('g.renderer.resize();g.restart();g.gameLoop.stop();g.updateUI();g.render()'); await shot('spring-mobile');
    const person=await ev('(()=>{const v=g.villagerSystem.villagers[0],p=g.camera.worldToScreen((v.x+.5)*48,(v.y+.5)*48);return{x:p.x,y:p.y-18,id:v.id}})()');
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:person.x,y:person.y}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await ev('g.handleInput();g.updateUI();g.render()');
    assert.equal(await ev('g.selectedVillagerId'),person.id);
    await shot('villager-orders-mobile');
    assert(await ev('[...document.querySelectorAll("[data-villager-order]")].every(b=>b.getBoundingClientRect().height>=44)'));
    const command=await ev('(()=>{const r=document.querySelector("[data-villager-order=chop]").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[command]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(100);
    assert.equal(await ev('g.villagerSystem.getVillagerById(g.selectedVillagerId).currentTask'),'clearing');
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});assert.equal(await ev('g.pendingOrder'),null);assert.equal(await ev('g.selectedVillagerId'),null);
    await ev('g.deselectVillager();g.updateUI()');
    await button('Build');await shot('build-mobile');await clickSelector('[data-building-id="hut"]');
    const before=await ev('({x:g.camera.x,y:g.camera.y})');
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:370}]});await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:245,y:395}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const after=await ev('({x:g.camera.x,y:g.camera.y})');assert(Math.abs(after.x-before.x)>20);
    const layout=await ev(`({canvas:document.querySelector('canvas').width,css:document.querySelector('canvas').clientWidth,dpr:devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('#game-bottom-bar button')].filter(b=>!b.hidden).every(b=>b.getBoundingClientRect().height>=44)})`);assert(!layout.overflow);assert(layout.buttons);assert.equal(layout.canvas,layout.css*layout.dpr);return layout;
  });
  await check('existing researched buildings appear in the build menu',async()=>{
    await ev("g.ui.closePanels();g.restart();g.gameLoop.stop();g.techSystem.unlockTech('furWorkshop');g.refreshBuildPanel()");
    assert(await ev("!!document.querySelector('[data-building-id=\"furWorkshop\"]')"));return 'Fur Workshop is reachable after research';
  });
  await check('an open build menu updates when resources arrive',async()=>{
    await ev("g.ui.closePanels();g.resourceSystem.resources.wood=0;g.ui.updateBuildPanel(g.buildingSystem.getAllBuildingConfigs(),g.techSystem.unlockedBuildings,(w,t)=>g.resourceSystem.canAfford(w,t))");
    assert.equal(await ev("document.querySelector('[data-building-id=\"hut\"]').dataset.affordable"),'false');
    await button('Build');await ev('g.resourceSystem.resources.wood=20;g.updateUI()');
    assert.equal(await ev("document.querySelector('[data-building-id=\"hut\"]').dataset.affordable"),'true');await ev('g.ui.closePanels()');return true;
  });
  await check('missing artwork still renders a usable world' ,async()=>{
    const result=await ev(`(async()=>{const url=performance.getEntriesByType('resource').filter(r=>r.name.includes('/src/render/Renderer.ts')).at(-1).name;const {Renderer}=await import(url);const missing={getAtlas:()=>null,getVillager:()=>null,getEnemy:()=>null};const r=new Renderer(document.querySelector('canvas'),g.camera,missing);r.resize();r.renderWorld(g.tileMap,'spring',g.buildingSystem.buildings,g.buildingSystem.getAllBuildingConfigs(),g.villagerSystem.villagers,[],null,g.input.state,null,true);g.render();return true;})()`);assert(result);return result;
  });
  await check('a defending worker resumes their production job',async()=>{
    const r=await ev(`(()=>{g.restart();g.gameLoop.stop();const b=g.buildingSystem.placeStartingBuilding('garden',42,27),v=g.villagerSystem.villagers[0];g.villagerSystem.assignVillagerToBuilding(v.id,b.id,g.buildingSystem.buildings);for(let i=0;i<160;i++)g.update(.05);const before=b.farmingProgress??0;v.state='defending';for(let i=0;i<20;i++)g.update(.05);return{before,after:b.farmingProgress,state:v.state};})()`);assert.equal(r.state,'working');assert(r.after>r.before);return r;
  });
  await check('repair keeps individual palisade upgrades and clears maintenance warnings',async()=>{
    const r=await ev(`(()=>{g.restart();g.gameLoop.stop();const b=g.buildingSystem.placeStartingBuilding('palisadeWall',42,27);b.upgraded=true;b.hp=b.maxHp=120;const upgraded=b.maxHp;b.hp-=10;g.buildingSystem.repairBuilding(b.id);b.needsRepair=true;g.resourceSystem.resources.wood=50;g.repairAll();for(let i=0;i<300;i++)g.update(.05);return{upgraded,hp:b.hp,max:b.maxHp,needsRepair:b.needsRepair};})()`);assert.equal(r.upgraded,120);assert.equal(r.hp,r.max);assert(!r.needsRepair);return r;
  });
  await check('older winter saves remain playable',async()=>{
    const r=await ev(`(()=>{g.restart();g.gameLoop.stop();g.seasonSystem.season='winter';g.hordeSystem.startWinter(1,1);g.update(8.1);const data=JSON.parse(JSON.stringify(g.serializeState()));data.enemies=data.enemies.enemies;delete data.cameraZoom;delete data.simulation;data.level=3;g.restart();g.deserializeState(data);g.update(.05);return{active:g.hordeSystem.isActive,enemies:g.hordeSystem.enemies.length,year:g.seasonSystem.year,level:g.hordeSystem.serialize().winterLevel};})()`);assert(r.active);assert(r.enemies>0);assert.equal(r.level,3);return r;
  });
  await check('all winter weather types can occur and cooldown saves correctly',async()=>{
    const r=await ev(`(()=>{const random=Math.random;const types=[];let restored;try{for(const sequence of [[0,.5,.5],[1,0,.5,.5],[1,1,0,.5,.5]]){Math.random=()=>sequence.shift()??.5;const weather=new g.weatherSystem.constructor();weather.update(10,'winter');types.push(weather.currentEvent?.type);weather.update(100,'winter');const state=weather.serialize();weather.reset();weather.deserialize(state);restored=weather.serialize().eventCooldown;}}finally{Math.random=random;}return{types,cooldown:restored};})()`);assert.deepEqual(r.types,['snowstorm','fog','strongWind']);assert.equal(r.cooldown,20);return r;
  });
  await (await import('./economy-checks.mjs')).runEconomyChecks({check,ev,shot,clickSelector,button,tile,until,call});
  await (await import('./ux-checks.mjs')).runUXChecks({check,ev,shot,clickSelector,button,tile,until,mouse,call});
  await (await import('./defense-checks.mjs')).runDefenseChecks({check,ev,shot,button,until,call});
  await (await import('./mobile-shelter-checks.mjs')).runMobileShelterChecks({check,ev,shot,call,until});
  await (await import('./moat-art-checks.mjs')).runMoatArtChecks({check,ev,shot,call});
  await (await import('./season-heating-checks.mjs')).runSeasonHeatingChecks({check,ev,shot,call,clickSelector});
  await (await import('./forest-clearing-checks.mjs')).runForestClearingChecks({check,ev,shot,call,clickSelector,tile,until});
  await (await import('./presentation-checks.mjs')).runPresentationChecks({check,ev,shot,call,clickSelector});
  await (await import('./workforce-tech-checks.mjs')).runWorkforceTechChecks({check,ev,shot,call,clickSelector,button});
  await (await import('./notification-checks.mjs')).runNotificationChecks({check,ev,shot,call,clickSelector,tile});
  await (await import('./tower-progression-checks.mjs')).runTowerProgressionChecks({check,ev,shot,call});
  await (await import('./building-upgrade-checks.mjs')).runBuildingUpgradeChecks({check,ev,shot,call,clickSelector,button,tile,until,mouse});
  await (await import('./fence-gate-checks.mjs')).runFenceGateChecks({check,ev,shot,call,mouse,button,until});
  await (await import('./audio-checks.mjs')).runAudioChecks({check,ev});
  await check('no unhandled browser exceptions'   ,()=>{assert.equal(exceptions.length,0,JSON.stringify(exceptions));return 0;});
} finally {
  await ev('g?.gameLoop.stop()').catch(()=>{});
  await fs.writeFile(output+'/results.json',JSON.stringify({audioMode:checkAudio?'enabled':'muted',checks,exceptions},null,2));
  await call('Fetch.disable').catch(()=>{});ws.close();
}
console.log(`${checks.filter(c=>c.pass).length}/${checks.length} checks passed. Screenshots: ${output}/`);
process.exitCode=checks.some(c=>!c.pass)?1:0;
