import assert from 'node:assert/strict';

/** Phone noise reduction must preserve commands, failures and urgent information. */
export async function runNotificationChecks({check,ev,shot,call,clickSelector,tile}) {
  const desktop=async()=>{await call('Emulation.setTouchEmulationEnabled',{enabled:false});await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await ev('(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);g.renderer.resize();})()');};
  const phone=async()=>{await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await ev('(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);g.renderer.resize();})()');};
  await check('desktop and mobile omit the status ribbon and its headings in every interaction mode',async()=>{
    const layouts=[];
    for(const width of [390,768,900,1280]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<=768});
      const r=await ev(`(()=>{econReset();g.renderer.resize();const missing=[];for(const mode of ['normal','clear','build','palisadeDraw','demolish','order']){g.mode=mode;g.updateUI();const overlay=document.getElementById('ui-overlay');missing.push(!document.getElementById('status-ribbon')&&!/A little care goes a long way|Make room for your village|Find a place to call home|Time to make a plan|Food for \\d+s|free villagers/.test(overlay.textContent));}g.mode='normal';g.updateUI();return{width:innerWidth,missing,mode:document.getElementById('ui-overlay').dataset.mode};})()`);
      assert(r.missing.every(Boolean));assert.equal(r.mode,'normal');layouts.push(r);
    }
    return layouts;
  });
  await phone();
  await check('phone commands and tree queue work without success toasts; failures remain visible',async()=>{
    await ev('econReset();g.camera.centerOn(36*48,29*48);g.updateUI();g.render()');await clickSelector('[data-global-clear]');
    assert(await ev('g.villagerSystem.villagers.some(v=>v.currentTask==="clearing")&&document.querySelector("[data-notification-el]").hidden'));
    for(const y of [27,28,29])await tile(34.5,y+.5);
    const r=await ev(`(()=>{const button=document.querySelector('[data-global-clear]'),toast=document.querySelector('[data-notification-el]'),silent=toast.hidden,label=button.textContent;g.resourceSystem.resources.wood=0;g.selectedBuildingId='hut';g.handleBuildClick(42,27);return{silent,label,errorShown:!toast.hidden,error:toast.textContent};})()`);
    assert(r.silent);assert(r.label.includes('Clear (3)'));assert(r.errorShown&&r.error.includes('Not enough resources'));await shot('phone-quiet-queue');return r;
  });
  await check('phone deliveries and crafted coats update resources without routine popups',async()=>{
    const r=await ev(`(()=>{econReset();const [v,worker]=g.villagerSystem.villagers,home=g.buildingSystem.buildings[0],before=g.resourceSystem.resources.food;Object.assign(v,{x:home.tileX,y:home.tileY,currentTask:'returnHome',path:[],cargo:{food:15,fur:2,herbs:0}});g.updateHunting(0);const food=g.resourceSystem.resources.food-before,deliveryHidden=document.querySelector('[data-notification-el]').hidden,workshop=g.buildingSystem.placeStartingBuilding('furWorkshop',42,27);const arrival=g.buildingSystem.getArrivalTiles(workshop)[0];Object.assign(worker,{x:arrival.x,y:arrival.y,state:'working',currentTask:'working',path:[],assignedBuildingId:workshop.id});workshop.assignedWorkers=[worker.id];g.updateResourceProduction(balance.resources.furWorkshopProcessTime+.1);const clothing=g.resourceSystem.resources.clothing;g.resourceSystem.addFood(999);return{food,deliveryHidden,clothing,coatHidden:document.querySelector('[data-notification-el]').hidden};})()`);
    assert.equal(r.food,15);assert(r.deliveryHidden&&r.coatHidden);assert(r.clothing>=1);return r;
  });
  await check('phone shows one warning with urgent heating first and cold suppresses duplicates',async()=>{
    const r=await ev(`(()=>{econReset();window.noticeSet=[{id:'coats',text:'Warm clothing needed'},{id:'food',text:'Food is low'},{id:'wood',text:'Need wood'},{id:'heating',urgent:true,text:'Shelters are unheated'}];g.ui.updateWarnings(noticeSet);const first=[...document.querySelectorAll('[data-warning]')].map(el=>el.dataset.warning);g.ui.updateWarnings([{id:'cold',urgent:true,text:'Residents are freezing'},...noticeSet]);return{first,ordinary:document.querySelectorAll('[data-warning]').length,cold:!document.getElementById('cold-warning').hidden};})()`);
    assert.deepEqual(r.first,['heating']);assert.equal(r.ordinary,0);assert(r.cold);return r;
  });
  await check('dismissing the leading phone warning reveals the next without restoring dismissed warnings',async()=>{
    await ev('g.ui.resetNotifications();g.ui.updateWarnings(noticeSet)');
    // Direct click keeps this synthetic warning scenario independent from Game.updateUI.
    const r=await ev(`(()=>{document.querySelector('[data-dismiss-notice=heating]').click();const next=[...document.querySelectorAll('[data-warning]')].map(el=>el.dataset.warning);g.ui.updateWarnings(noticeSet.map(w=>({...w,text:w.text+' updated'})));const stable=[...document.querySelectorAll('[data-warning]')].map(el=>el.dataset.warning);g.ui.updateWarnings([]);g.ui.updateWarnings(noticeSet);return{next,stable,reset:[...document.querySelectorAll('[data-warning]')].map(el=>el.dataset.warning)};})()`);
    assert.deepEqual(r.next,['food']);assert.deepEqual(r.stable,['food']);assert.deepEqual(r.reset,['heating']);return r;
  });
  await check('phone Tech reward defers ordinary warnings and remains accessible until acknowledged',async()=>{
    const r=await ev(`(()=>{g.ui.resetNotifications();g.ui.updateWarnings(noticeSet);g.ui.notifyResearchStars(2);g.ui.notify('Routine feedback',1,'routine');const toast=document.querySelector('[data-research-award]'),award=!!toast&&!toast.hidden,ordinary=document.querySelectorAll('[data-warning]').length,text=toast?.textContent;g.ui.notifications.acknowledgeResearch();return{award,ordinary,text,after:[...document.querySelectorAll('[data-warning]')].map(el=>el.dataset.warning)};})()`);
    assert(r.award&&r.text.includes('+2 new Tech stars'));assert.equal(r.ordinary,0);assert.deepEqual(r.after,['heating']);return r;
  });
  await check('desktop keeps routine feedback and switching to touch mode immediately compacts notices',async()=>{
    await desktop();await ev("econReset();g.ui.updateWarnings(noticeSet);g.ui.notify('Worker assigned',10000,'routine')");
    assert(await ev('document.querySelectorAll("[data-warning]").length===4&&!document.querySelector("[data-notification-el]").hidden'));
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await new Promise(r=>setTimeout(r,100));
    await ev('g.ui.updateWarnings(noticeSet)');
    const compact=await ev('document.querySelectorAll("[data-warning]").length===1&&document.querySelector("[data-notification-el]").hidden');assert(compact);
    await desktop();await new Promise(r=>setTimeout(r,100));assert(await ev('document.querySelectorAll("[data-warning]").length===4'));
    return{compact};
  });
  await phone();await ev('econReset();g.resourceSystem.resources.food=50;g.updateUI();g.render()');await shot('phone-clean-play-area');
  await desktop();await ev('econReset();g.updateUI();g.render()');await shot('desktop-without-status-text');
}
