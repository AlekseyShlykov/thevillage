/** Run against `npm run dev` and a dedicated Chrome --remote-debugging-port=9461.
 * Requires Node 22+. No browser automation packages or production debug hooks.
 */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173/';
const endpoint = process.env.CHROME_URL ?? 'http://127.0.0.1:9461';
const output = '.qa';
await fs.mkdir(output, { recursive: true });
const targets = await (await fetch(endpoint + '/json/list')).json();
const target = targets.find(t => t.type === 'page');
assert(target, 'Open a dedicated test Chrome first.');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
let id = 0; const pending = new Map(), exceptions = [], checks = [];
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
  const r = await ev(`(() => {let elapsed=0;while(!(${expression}) && elapsed<${seconds} && !g.gameOver){g.update(.05);elapsed+=.05;}g.updateUI();g.render();return {pass:!!(${expression}),elapsed,food:g.resourceSystem.resources.food,pop:g.villagerSystem.getAliveCount(),season:g.seasonSystem.season,year:g.seasonSystem.year};})()`);
  assert(r.pass, `Timed out: ${expression} ${JSON.stringify(r)}`); return r;
}
async function check(name, fn) { try { const detail = await fn(); checks.push({ name, pass: true, detail }); console.log('PASS', name, JSON.stringify(detail ?? '')); } catch (e) { checks.push({ name, pass: false, error: e.message }); console.log('FAIL', name, e.message); await shot('failure-' + checks.length).catch(() => {}); await fs.writeFile(`${output}/failure-state-${checks.length}.json`,JSON.stringify(await ev('g.serializeState()'),null,2)).catch(()=>{}); } }
try {
  await call('Page.enable'); await call('Runtime.enable'); await call('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: base }); await wait('document.getElementById("intro-screen")?.style.display === "flex"');
  await ev(`(async()=>{const gameUrl=performance.getEntriesByType('resource').filter(r=>r.name.includes('/src/game/Game.ts')).at(-1)?.name ?? '/src/game/Game.ts';const {Game}=await import(gameUrl);const original=Game.prototype.start;Game.prototype.start=function(){window.g=this;original.call(this);};document.getElementById('intro-start-btn').click();})()`);
  await wait('!!window.g'); await ev('g.gameLoop.stop();g.updateUI();g.render()'); await shot('spring-desktop');
  await check('custom interface artwork loads and buttons keep accessible labels', async()=>{
    const result=await ev(`(async()=>{const url=performance.getEntriesByType('resource').filter(r=>r.name.includes('/src/ui/icons.ts')).at(-1).name;const {iconNames,iconMarkup}=await import(url);const loaded=await Promise.all(iconNames.map(name=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve({name,ok:img.naturalWidth===48});img.onerror=()=>resolve({name,ok:false});img.src='./assets/ui/icons/'+name+'.svg';})));const icons=[...document.querySelectorAll('[data-ui-icon]')];const emoji=[...document.querySelector('#ui-overlay').textContent].filter(c=>{const n=c.codePointAt(0);return n>=0x1f000&&n<=0x1faff||n>=0x2600&&n<=0x27ff});const unlabeled=[...document.querySelectorAll('button')].filter(b=>!b.getAttribute('aria-label')&&!b.textContent.trim()).length;const preview=document.createElement('div');preview.id='qa-icon-sheet';preview.dataset.ui='true';preview.style.cssText='position:fixed;inset:0;z-index:2000;background:#21382d;padding:40px;color:#ecdfbf;font:14px Trebuchet MS';preview.innerHTML='<div style="font:32px Georgia;margin-bottom:10px">Before Night Falls</div><div style="color:#b5bd9b;margin-bottom:25px">Timber · parchment · aged iron</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:22px">'+iconNames.map(name=>'<div style="height:112px;border:1px solid #d3b57626;border-radius:10px;background:#50614326;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px">'+iconMarkup(name)+'<span>'+name+'</span></div>').join('')+'</div>';preview.querySelectorAll('img').forEach(img=>{img.style.width='56px';img.style.height='56px'});document.body.appendChild(preview);await new Promise(requestAnimationFrame);return{loaded,visibleIcons:icons.length,emoji:emoji.length,unlabeled}})()`);
    const preview=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile(output+'/interface-icon-sheet.png',Buffer.from(preview.data,'base64'));await ev('document.getElementById("qa-icon-sheet").remove()');
    assert(result.loaded.every(i=>i.ok));assert(result.visibleIcons>=20);assert.equal(result.emoji,0);assert.equal(result.unlabeled,0);return{assets:result.loaded.length,visibleIcons:result.visibleIcons};
  });
  await check('projection and zoom round-trip', async () => {
    const result = await ev(`(()=>{const c=g.camera,old=c.zoom;let error=0;for(const z of [.6,1,1.5]){c.setZoom(z);for(const [x,y]of[[.25,.7],[40.5,30.5],[79.1,59.9]]){const p=c.worldToScreen(x*48,y*48),q=c.screenToWorld(p.x,p.y);error=Math.max(error,Math.abs(q.x-x*48),Math.abs(q.y-y*48));}}c.setZoom(old);return error;})()`); assert(result < 1e-8); return result;
  });
  await check('first year through visible controls', async () => {
    await ev('g.restart();g.gameLoop.stop();g.updateUI();g.render()');
    console.log('PLAY clearing and hunting');
    await button('Clear'); for (const y of [28.5,29.5,30.5,31.5]) await tile(34.5,y); await button('Clear');
    const p=await ev('(()=>{const v=g.villagerSystem.villagers[0],p=g.camera.worldToScreen((v.x+.5)*48,(v.y+.5)*48);return{x:p.x,y:p.y-18};})()'); await mouse(p.x,p.y); await button('Hunt');
    assert(await ev('g.villagerSystem.villagers.some(v=>v.currentTask==="hunting")'));
    console.log('PLAY hut');
    await button('Build'); await clickSelector('[data-building-id="hut"]'); await tile(42.2,27.2);
    await until('g.buildingSystem.buildings.filter(b=>b.configId==="hut"&&b.built).length===2');
    await until('g.resourceSystem.resources.techPoints>=2 && g.resourceSystem.resources.wood>=10');
    console.log('PLAY garden research');
    await button('Tech'); await clickSelector('[data-tech-id="garden"]'); await ev('g.ui.closePanels()');
    await button('Build'); await clickSelector('[data-building-id="garden"]'); await tile(37.2,32.2);
    await until('g.buildingSystem.buildings.some(b=>b.configId==="garden"&&b.built)');
    await ev('g.selectedVillagerId=null;g.ui.hideInfo();g.ui.hideActionMenu()');
    console.log('PLAY farmer');
    const garden=await ev('g.buildingSystem.buildings.find(b=>b.configId==="garden")'); await tile(garden.tileX+1,garden.tileY+1); await button('Assign a free villager');
    await until('g.resourceSystem.resources.food>=g.getWinterFoodTarget()', 70);
    const before=await ev('({year:g.seasonSystem.year,season:g.seasonSystem.season,food:g.resourceSystem.resources.food,pop:g.villagerSystem.getAliveCount(),garden:g.buildingSystem.buildings.find(b=>b.configId==="garden")})');
    assert(before.garden.assignedWorkers.length > 0); await shot('village-established');
    console.log('PLAY winter');
    await button('Shelter'); await until('g.villagerSystem.getAliveVillagers().every(v=>g.isVillagerInShelter(v.id))', 30);
    await until('g.seasonSystem.season==="winter"',150); assert.equal(await ev('g.tutorialSystem.getObjective(g.resourceSystem.resources.food)'),null); await shot('winter-desktop');
    await until('g.seasonSystem.year===2',130);
    assert(await ev('g.saveSystem.hasAutosave()')); await button('Resume');
    await until('g.villagerSystem.villagers.some(v=>v.currentTask==="farming"&&v.state==="working")',30);
    return {before,spring:await ev('({population:g.villagerSystem.getAliveCount(),year:g.seasonSystem.year,food:g.resourceSystem.resources.food})')};
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
  await check('selected villager receives exact tree, hunt and farm orders', async () => {
    await ev('g.restart();g.gameLoop.stop();g.tutorialSystem.skip();g.updateUI();g.render()');
    const p = await ev('(()=>{const v=g.villagerSystem.villagers[0],p=g.camera.worldToScreen((v.x+.5)*48,(v.y+.5)*48);return{x:p.x,y:p.y-18,id:v.id,other:JSON.stringify(g.villagerSystem.villagers[1])};})()');
    await mouse(p.x,p.y); assert.equal(await ev('g.selectedVillagerId'),p.id);
    await clickSelector('[data-villager-order="chop"]'); await tile(34.5,28.5);
    assert(await ev('(()=>{const v=g.villagerSystem.villagers[0];return v.currentTask==="clearing"&&v.targetX===34&&v.targetY===28})()'));
    await clickSelector('[data-villager-order="farm"]'); await tile(34.5,30.5);
    assert.equal(await ev('g.pendingOrder'),'farm'); assert.equal(await ev('g.villagerSystem.villagers[0].currentTask'),'clearing');
    await clickSelector('[data-villager-order="hunt"]'); await tile(34.5,30.5);
    assert(await ev('(()=>{const v=g.villagerSystem.villagers[0];return v.currentTask==="hunting"&&v.targetX===34&&v.targetY===30})()'));
    assert.equal(await ev('JSON.stringify(g.villagerSystem.villagers[1])'),p.other);
    const garden = await ev('g.buildingSystem.placeStartingBuilding("garden",42,27)'); assert(garden);
    await clickSelector('[data-villager-order="farm"]'); await tile(43,28);
    assert.equal(await ev('g.villagerSystem.villagers[0].assignedBuildingId'),garden.id);
    await until('g.villagerSystem.villagers[0].currentTask==="farming"&&g.villagerSystem.villagers[0].state==="working"',20);
    await shot('villager-farming');
    await clickSelector('[data-villager-order="chop"]'); await tile(34.5,31.5);
    assert.equal(await ev(`g.buildingSystem.buildings.find(b=>b.id===${JSON.stringify(garden.id)}).assignedWorkers.length`),0);
    await clickSelector('[data-villager-order="stop"]');
    const stopped = await ev('(()=>{const v=g.villagerSystem.villagers[0];for(let i=0;i<30;i++)g.update(.05);return{task:v.currentTask,path:v.path.length,hold:v.holdPosition,assigned:v.assignedBuildingId}})()');
    assert.deepEqual(stopped,{task:null,path:0,hold:true,assigned:null});
    await clickSelector('[data-villager-order="move"]'); await tile(37.5,27.5);
    await until('g.villagerSystem.villagers[0].path.length===0',20);
    assert(await ev('(()=>{const v=g.villagerSystem.villagers[0];return v.x===37&&v.y===27&&v.holdPosition})()'));
    const camp=await ev('g.buildingSystem.placeStartingBuilding("lumberCamp",37,32)');assert(camp);
    await clickSelector('[data-villager-order="work"]');await tile(38,33);
    assert.equal(await ev('g.villagerSystem.villagers[0].assignedBuildingId'),camp.id);
    await clickSelector('[data-villager-order="move"]');await tile(36.5,27.5);
    assert.equal(await ev(`g.buildingSystem.buildings.find(b=>b.id===${JSON.stringify(camp.id)}).assignedWorkers.length`),0);
    await clickSelector('[data-villager-order="stop"]');
    const saved=await ev('(()=>{const id=g.selectedVillagerId,state=g.serializeState();g.deserializeState(state);return g.villagerSystem.getVillagerById(id).holdPosition})()');assert(saved);
    return {chosen:p.id,exactHunt:[34,30],farm:garden.id,stop:stopped};
  });
  await check('selected worker builds and repairs without stealing other workers',async()=>{
    await ev('g.restart();g.gameLoop.stop();g.tutorialSystem.skip();g.resourceSystem.resources.wood=50;g.resourceSystem.resources.food=100;g.updateUI();g.render()');
    const p=await ev('(()=>{const v=g.villagerSystem.villagers[0],p=g.camera.worldToScreen((v.x+.5)*48,(v.y+.5)*48);return{x:p.x,y:p.y-18,id:v.id}})()');await mouse(p.x,p.y);
    const site=await ev('g.buildingSystem.placeBuilding("hut",42,27)');assert(site);
    await clickSelector('[data-villager-order="build"]');await tile(43,28);
    assert.equal(await ev('g.villagerSystem.villagers[0].currentTask'),'building');
    await until(`g.buildingSystem.buildings.find(b=>b.id===${JSON.stringify(site.id)}).built`,30);
    await ev(`g.buildingSystem.buildings.find(b=>b.id===${JSON.stringify(site.id)}).hp-=20`);
    await clickSelector('[data-villager-order="repair"]');await tile(43,28);
    assert.equal(await ev('g.villagerSystem.villagers[0].currentTask'),'repairing');
    await until(`(()=>{const b=g.buildingSystem.buildings.find(b=>b.id===${JSON.stringify(site.id)});return b.hp===b.maxHp})()`,30);
    return {builder:p.id,building:site.id};
  });
  await check('tools animate distinct work poses and freeze while paused',async()=>{
    const result=await ev(`(async()=>{const url=performance.getEntriesByType('resource').filter(r=>r.name.includes('/src/render/VillagerArt.ts')).at(-1).name;const {VillagerArt}=await import(url);const art=new VillagerArt(g.camera,g.renderer.assets);const canvas=document.createElement('canvas');canvas.width=576;canvas.height=480;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#6b8050';ctx.fillRect(0,0,576,480);const tasks=['clearing','farming','building','hunting'],poses=[];for(let row=0;row<tasks.length;row++){const v={...g.villagerSystem.villagers[0],path:[],state:'working',currentTask:tasks[row],assignedBuildingId:null};const p=g.camera.worldToScreen((v.x+.5)*48,(v.y+.5)*48);const samples=[];for(let col=0;col<4;col++){ctx.save();ctx.translate(col*144+72,row*120+92);ctx.scale(2,2);ctx.translate(-p.x,-p.y);art.draw(ctx,v,'spring',col*.2,false);ctx.restore();ctx.fillStyle='#f4e7c5';ctx.font='12px system-ui';ctx.fillText(tasks[row],col*144+12,row*120+17);samples.push([...ctx.getImageData(col*144,row*120,144,120).data].reduce((sum,n,i)=>(sum+Math.imul(n,i+1))>>>0,0));}poses.push(new Set(samples).size);}const speed=g.gameLoop.gameSpeed;g.gameLoop.gameSpeed=0;g.render();const before=g.renderer.time,pixels=g.renderer.ctx.canvas.toDataURL();g.renderer.lastFrameTime-=200;g.render();const frozen=before===g.renderer.time&&pixels===g.renderer.ctx.canvas.toDataURL();g.gameLoop.gameSpeed=1;g.renderer.lastFrameTime-=120;g.render();const advances=g.renderer.time>before;g.gameLoop.gameSpeed=speed;return{poses,frozen,advances,image:canvas.toDataURL()}})()`);
    await fs.writeFile(output+'/work-poses.png',Buffer.from(result.image.split(',')[1],'base64'));delete result.image;
    assert(result.poses.every(n=>n===4));assert(result.frozen);assert(result.advances);return result;
  });
  await check('production persists and workshop respects its recipe timer', async()=>{
    const result=await ev(`(()=>{g.restart();g.gameLoop.stop();const b=g.buildingSystem.placeStartingBuilding('workshop',42,27);const v=g.villagerSystem.villagers[0];v.x=42;v.y=29;g.resourceSystem.resources.wood=50;g.villagerSystem.assignVillagerToBuilding(v.id,b.id,g.buildingSystem.buildings);for(let i=0;i<100;i++)g.update(.05);const early=g.resourceSystem.resources.tools;for(let i=0;i<240;i++)g.update(.05);return{early,late:g.resourceSystem.resources.tools,workers:b.assignedWorkers.length,wood:g.resourceSystem.resources.wood};})()`); assert.equal(result.early,0);assert(result.late>0);assert.equal(result.workers,1);return result;
  });
  await check('horde wave limit is enforced',async()=>{
    const r=await ev(`(()=>{g.hordeSystem.startWinter(1,1);const update=()=>g.hordeSystem.update(31,40,30,[],g.buildingSystem.getHousingTiles(),[],[],()=>false,()=>{},()=>{},false);update();let count=g.hordeSystem.enemies.length;g.hordeSystem.enemies.forEach(e=>e.state='dead');update();update();return{count,remaining:g.hordeSystem.enemies.length,waves:g.hordeSystem.serialize().currentWave};})()`);assert(r.count>0);assert.equal(r.remaining,0);return r;
  });
  await check('50 visible villagers render within a playable frame budget',async()=>{
    await ev(`g.restart();g.gameLoop.stop();g.tutorialSystem.skip();g.villagerSystem.villagers=[];for(let y=26;y<34;y++)for(let x=36;x<44;x++)if(!g.tileMap.getTile(x,y).buildingId&&g.villagerSystem.getAliveCount()<55)g.villagerSystem.spawnVillager(x,y);g.updateUI();g.render()`);
    const r=await ev(`(async()=>{const samples=[];for(let i=0;i<40;i++){await new Promise(requestAnimationFrame);const t=performance.now();g.update(1/60);g.render();samples.push(performance.now()-t)}return{population:g.villagerSystem.getAliveCount(),meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:samples.sort((a,b)=>a-b)[Math.floor(samples.length*.95)]};})()`);await shot('population-55');assert(r.population>=50);assert(r.meanMs<33.4);return r;
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
    assert.equal(await ev('g.pendingOrder'),'chop');
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});assert.equal(await ev('g.pendingOrder'),null);assert.equal(await ev('g.selectedVillagerId'),person.id);
    await ev('g.deselectVillager();g.updateUI()');
    await button('Build');await shot('build-mobile');await clickSelector('[data-building-id="hut"]');
    const before=await ev('({x:g.camera.x,y:g.camera.y})');
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:370}]});await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:245,y:395}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const after=await ev('({x:g.camera.x,y:g.camera.y})');assert(Math.abs(after.x-before.x)>20);
    const layout=await ev(`({canvas:document.querySelector('canvas').width,css:document.querySelector('canvas').clientWidth,dpr:devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('#game-bottom-bar button')].every(b=>b.getBoundingClientRect().height>=44)})`);assert(!layout.overflow);assert(layout.buttons);assert.equal(layout.canvas,layout.css*layout.dpr);return layout;
  });
  await check('existing researched buildings appear in the build menu',async()=>{
    await ev("g.ui.closePanels();g.restart();g.gameLoop.stop();g.techSystem.unlockTech('smokehouse');g.refreshBuildPanel()");
    assert(await ev("!!document.querySelector('[data-building-id=\"smokehouse\"]')"));return 'tier 3 is reachable after research';
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
    const r=await ev(`(()=>{g.restart();g.gameLoop.stop();const b=g.buildingSystem.placeStartingBuilding('garden',42,27),v=g.villagerSystem.villagers[0];g.villagerSystem.assignVillagerToBuilding(v.id,b.id,g.buildingSystem.buildings);for(let i=0;i<160;i++)g.update(.05);const before=b.productionProgress;v.state='defending';for(let i=0;i<20;i++)g.update(.05);return{before,after:b.productionProgress,state:v.state};})()`);assert.equal(r.state,'working');assert(r.after>r.before);return r;
  });
  await check('repair keeps research bonuses and clears maintenance warnings',async()=>{
    const r=await ev(`(()=>{g.restart();g.gameLoop.stop();g.techSystem.unlockTech('reinforcedPalisade');const b=g.buildingSystem.placeStartingBuilding('palisadeWall',42,27);g.update(.05);const upgraded=b.maxHp;b.hp-=10;g.buildingSystem.repairBuilding(b.id);b.needsRepair=true;g.resourceSystem.resources.wood=50;g.repairAll();for(let i=0;i<300;i++)g.update(.05);return{upgraded,hp:b.hp,max:b.maxHp,needsRepair:b.needsRepair};})()`);assert.equal(r.upgraded,120);assert.equal(r.hp,r.max);assert(!r.needsRepair);return r;
  });
  await check('older winter saves remain playable',async()=>{
    const r=await ev(`(()=>{g.restart();g.gameLoop.stop();g.seasonSystem.season='winter';g.hordeSystem.startWinter(1,1);g.update(8.1);const data=JSON.parse(JSON.stringify(g.serializeState()));data.enemies=data.enemies.enemies;delete data.cameraZoom;delete data.simulation;data.level=3;g.restart();g.deserializeState(data);g.update(.05);return{active:g.hordeSystem.isActive,enemies:g.hordeSystem.enemies.length,year:g.seasonSystem.year,level:g.hordeSystem.serialize().winterLevel};})()`);assert(r.active);assert(r.enemies>0);assert.equal(r.level,3);return r;
  });
  await check('all winter weather types can occur and cooldown saves correctly',async()=>{
    const r=await ev(`(()=>{const random=Math.random;const types=[];let restored;try{for(const sequence of [[0,.5,.5],[1,0,.5,.5],[1,1,0,.5,.5]]){Math.random=()=>sequence.shift()??.5;const weather=new g.weatherSystem.constructor();weather.update(10,'winter');types.push(weather.currentEvent?.type);weather.update(100,'winter');const state=weather.serialize();weather.reset();weather.deserialize(state);restored=weather.serialize().eventCooldown;}}finally{Math.random=random;}return{types,cooldown:restored};})()`);assert.deepEqual(r.types,['snowstorm','fog','strongWind']);assert.equal(r.cooldown,20);return r;
  });
  await check('no unhandled browser exceptions'   ,()=>{assert.equal(exceptions.length,0,JSON.stringify(exceptions));return 0;});
} finally {
  await ev('g?.gameLoop.stop()').catch(()=>{});
  await fs.writeFile(output+'/results.json',JSON.stringify({checks,exceptions},null,2));
  await call('Fetch.disable').catch(()=>{});ws.close();
}
console.log(`${checks.filter(c=>c.pass).length}/${checks.length} checks passed. Screenshots: ${output}/`);
process.exitCode=checks.some(c=>!c.pass)?1:0;
