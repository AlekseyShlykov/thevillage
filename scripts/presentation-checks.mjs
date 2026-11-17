import assert from 'node:assert/strict';

export async function runPresentationChecks({check,ev,shot,call,clickSelector}) {
  await check('season changes avoid calendar toasts and preserve the new Tech star announcement',async()=>{
    const r=await ev(`(()=>{econReset();g.ui.notify('Previous temporary message',15);const messages=[],notify=g.ui.notify;g.ui.notify=function(text,...args){messages.push(text);return notify.call(this,text,...args);};try{for(let i=0;i<4;i++){g.seasonSystem.seasonTimer=g.seasonSystem.getCurrentDuration()-.01;g.seasonSystem.update(.02);}}finally{g.ui.notify=notify;}g.updateUI();return{messages,year:g.seasonSystem.year,stars:g.resourceSystem.resources.techPoints,pending:g.tutorialSystem.isAwaitingAcknowledgement(),text:document.querySelector('[data-notification-el] [data-notice-message]').textContent};})()`);
    assert.equal(r.year,2);assert.equal(r.stars,1);assert(!r.pending);assert(r.messages.every(t=>!/of Year|Spring! Autosaved|Winter has killed/.test(t)));
    assert(r.text.includes('+1 new Tech star')&&r.text.includes('choose a new building'));
    await ev('g.ui.notify("Routine action feedback",1)');await new Promise(r=>setTimeout(r,30));
    assert(await ev('!document.querySelector("[data-research-award]").hidden&&document.querySelector("[data-notice-message]").textContent.includes("+1 new Tech star")'));
    await shot('tech-star-announcement');await clickSelector('[data-research-open]');
    assert(await ev('g.ui.isTechPanelOpen()&&document.querySelector("[data-notification-el]").hidden'));return r;
  });
  await check('later winter rewards announce two stars and loading cannot announce or award them twice',async()=>{
    const r=await ev(`(()=>{econReset();g.seasonSystem.season='autumn';g.seasonSystem.year=6;g.seasonSystem.seasonTimer=balance.seasons.autumnDuration-.01;g.seasonSystem.update(.02);g.updateUI();const text=document.querySelector('[data-notice-message]').textContent,saved=JSON.parse(JSON.stringify(g.serializeState()));g.deserializeState(saved);const loaded=g.resourceSystem.resources.techPoints,afterLoad=!!document.querySelector('[data-research-award]');g.seasonSystem.season='autumn';g.seasonSystem.year=6;g.seasonSystem.seasonTimer=balance.seasons.autumnDuration-.01;g.seasonSystem.update(.02);return{text,loaded,afterLoad,after:g.resourceSystem.resources.techPoints,repeated:!!document.querySelector('[data-research-award]')};})()`);
    assert(r.text.includes('+2 new Tech stars'));assert.equal(r.loaded,2);assert.equal(r.after,2);assert(!r.afterLoad&&!r.repeated);return r;
  });
  await check('Winter plan is absent on phones, tablets and desktop',async()=>{
    const layouts=[];await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    for(const [width,height]of [[390,844],[844,390],[1024,768]]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});
      await ev('g.renderer.resize();econReset();g.updateUI();g.render()');
      const r=await ev(`(()=>{const plan=document.getElementById('game-forecast'),bar=document.getElementById('game-top-bar'),warnings=document.getElementById('settlement-warnings');return{width:innerWidth,coarse:matchMedia('(pointer:coarse)').matches,planAbsent:!plan,gap:warnings.getBoundingClientRect().top-bar.getBoundingClientRect().bottom};})()`);
      assert(r.planAbsent);if(width===390)assert(r.gap<=12);layouts.push(r);
      if(width===390)await shot('mobile-without-winter-plan');
    }
    await call('Emulation.setTouchEmulationEnabled',{enabled:false});await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await ev('g.renderer.resize();g.updateUI()');
    assert(await ev('!document.getElementById("game-forecast")'));return layouts;
  });
  await check('mobile Tech star notice opens Tech or closes with a touch-sized dismiss button',async()=>{
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    await ev(`g.renderer.resize();econReset();g.resourceSystem.resources.food=50;g.seasonSystem.season='autumn';g.seasonSystem.seasonTimer=balance.seasons.autumnDuration-.01;g.seasonSystem.update(.02);g.updateUI();g.render()`);
    async function tap(selector){const p=await ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return{x,y,height:r.height,accessible:!!hit&&(el===hit||el.contains(hit))};})()`);assert(p.accessible&&p.height>=44,JSON.stringify(p));await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await new Promise(r=>setTimeout(r,80));}
    await shot('tech-star-announcement-mobile');await tap('[data-research-open]');assert(await ev('g.ui.isTechPanelOpen()&&document.querySelector("[data-notification-el]").hidden'));
    await ev(`g.ui.closePanels();g.seasonSystem.season='autumn';g.seasonSystem.year=2;g.seasonSystem.seasonTimer=balance.seasons.autumnDuration-.01;g.seasonSystem.update(.02);g.updateUI();g.render()`);
    await tap('[data-dismiss-notice=notification]');assert(await ev('document.querySelector("[data-notification-el]").hidden'));
    await ev('g.ui.notify("Ordinary feedback still works")');assert(await ev('!document.querySelector("[data-notification-el]").hidden&&!document.querySelector("[data-research-award]")'));
    await call('Emulation.setTouchEmulationEnabled',{enabled:false});await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await ev('g.renderer.resize()');return 'Open Tech and dismiss both work by touch';
  });
}
