import assert from 'node:assert/strict';

export async function runSeasonHeatingChecks({check,ev,shot,call,clickSelector}) {
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await ev('g.renderer.resize()');
  await check('Spring briefing highlights Hunt and Build and gates simulation until Got it',async()=>{
    await ev('restartWithBriefings();g.gameLoop.stop();g.updateUI();g.render()');
    const r=await ev(`(()=>{const before=JSON.stringify(g.serializeState());for(let i=0;i<20;i++)g.update(1);const buttons=[...document.querySelectorAll('.tutorial-highlight')];return{unchanged:before===JSON.stringify(g.serializeState()),pending:g.tutorialSystem.isAwaitingAcknowledgement(),title:document.querySelector('#season-tutorial h2').textContent,targets:buttons.map(b=>b.hasAttribute('data-global-hunt')?'hunt':b.hasAttribute('data-build-toggle')?'build':'wrong'),old:!!document.querySelector('[data-tutorial-panel]'),focus:document.activeElement.hasAttribute('data-tutorial-acknowledge')};})()`);
    assert(r.unchanged&&r.pending&&r.focus&&!r.old);assert.deepEqual(new Set(r.targets),new Set(['build','hunt']));
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space'});
    assert(await ev('g.tutorialSystem.isAwaitingAcknowledgement()&&g.gameLoop.gameSpeed===1'));
    await shot('season-briefing-spring');await clickSelector('[data-tutorial-acknowledge]');
    assert(await ev('!g.tutorialSystem.isAwaitingAcknowledgement()&&document.getElementById("season-tutorial").hidden'));
    const seconds=await ev('g.update(.1);g.seasonSystem.seasonTimer');assert(seconds>0);return r;
  });
  await check('only first-year season changes require acknowledgement and matching controls',async()=>{
    await ev('restartWithBriefings();g.gameLoop.stop();g.acknowledgeTutorial()');
    const details=[];
    for(const [season,targets,words]of [['summer',['clear','herbs'],['4 wood','herbs']],['autumn',['tech'],['Tech','Fur Workshop']],['winter',['shelter'],['cold','monsters','firewood']]]) {
      await ev('g.seasonSystem.seasonTimer=g.seasonSystem.getCurrentDuration()-.01;g.update(.02);g.updateUI()');
      const r=await ev(`(()=>{const b=g.tutorialSystem.getBriefing(),before=g.seasonSystem.seasonTimer;g.update(20);return{season:b.season,controls:b.controls,text:b.text,paused:before===g.seasonSystem.seasonTimer,highlights:document.querySelectorAll('.tutorial-highlight').length,herbPreview:!document.querySelector('[data-gather-herbs]').hidden,herbStat:document.querySelector('[data-stat=herbs]').hidden};})()`);
      assert.equal(r.season,season);assert.deepEqual(r.controls,targets);assert(r.paused);assert.equal(r.highlights,targets.length);for(const word of words)assert(r.text.includes(word));
      if(season==='summer'){assert(r.herbPreview&&r.herbStat);await shot('season-briefing-summer');}
      await clickSelector('[data-tutorial-acknowledge]');
      assert(await ev('document.querySelector("[data-gather-herbs]").hidden'));details.push(r);
    }
    await ev('g.seasonSystem.seasonTimer=g.seasonSystem.getCurrentDuration()-.01;g.update(.02);g.updateUI()');
    assert(await ev('g.seasonSystem.year===2&&!g.tutorialSystem.isAwaitingAcknowledgement()&&g.tutorialSystem.getBriefing()===null'));
    assert(await ev('(()=>{const before=g.seasonSystem.seasonTimer;g.update(.1);return g.seasonSystem.seasonTimer>before;})()'));return details;
  });
  await check('season acknowledgement, pending modal and Skip tutorial survive save loading',async()=>{
    await ev('restartWithBriefings();g.gameLoop.stop();g.updateUI()');
    const r=await ev(`(()=>{const pending=JSON.parse(JSON.stringify(g.serializeState()));g.deserializeState(pending);const restored=g.tutorialSystem.getBriefing()?.key;g.acknowledgeTutorial();const ack=JSON.parse(JSON.stringify(g.serializeState()));g.deserializeState(ack);const repeated=g.tutorialSystem.isAwaitingAcknowledgement();return{restored,repeated};})()`);
    assert.equal(r.restored,'1:spring');assert(!r.repeated);
    await ev('g.tutorialSystem.enterSeason("summer",1);g.updateUI()');await clickSelector('[data-tutorial-skip]');
    const skipped=await ev(`(()=>{const saved=JSON.parse(JSON.stringify(g.serializeState()));g.deserializeState(saved);for(const s of ['spring','summer','autumn','winter'])g.tutorialSystem.enterSeason(s,3);g.updateUI();return{pending:g.tutorialSystem.isAwaitingAcknowledgement(),hidden:document.getElementById('season-tutorial').hidden,enabled:g.tutorialSystem.serialize().enabled,targets:document.querySelectorAll('.tutorial-highlight').length};})()`);
    assert.deepEqual(skipped,{pending:false,hidden:true,enabled:false,targets:0});return{...r,skipped};
  });
  await check('old second-year tutorial saves load without a modal or simulation gate',async()=>{
    const r=await ev(`(()=>{econReset();const saved=JSON.parse(JSON.stringify(g.serializeState()));saved.season.year=2;saved.tutorial={version:2,enabled:true,acknowledged:[],pending:{season:'spring',year:2},protectedHunterId:null,firstHuntUsed:false};g.deserializeState(saved);for(const year of [2,3,10])for(const season of ['spring','summer','autumn','winter']){g.tutorialSystem.enterSeason(season,year);if(g.tutorialSystem.isAwaitingAcknowledgement())throw Error('Repeated tutorial');}g.updateUI();return{pending:g.tutorialSystem.getBriefing(),hidden:document.getElementById('season-tutorial').hidden,enabled:g.tutorialSystem.serialize().enabled};})()`);
    assert.deepEqual(r,{pending:null,hidden:true,enabled:false});return r;
  });
  await check('mobile season modal keeps Got it and Skip reachable in portrait and landscape',async()=>{
    const layouts=[];
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    for(const [width,height]of [[390,844],[844,390]]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});
      await ev('g.renderer.resize();restartWithBriefings();g.gameLoop.stop();g.tutorialSystem.acknowledge();g.tutorialSystem.enterSeason("summer",1);g.updateUI();g.render()');
      await new Promise(r=>setTimeout(r,120));
      const layout=await ev(`(()=>{const dialog=document.querySelector('#season-tutorial section').getBoundingClientRect();return{width:innerWidth,height:innerHeight,dialog:{top:dialog.top,bottom:dialog.bottom},textHeight:document.getElementById('season-tutorial-text').clientHeight,overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('#season-tutorial button')].map(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return{x,y,height:r.height,reachable:!!hit&&(el===hit||el.contains(hit))};})};})()`);
      assert(!layout.overflow&&layout.dialog.top>=0&&layout.dialog.bottom<=height,JSON.stringify(layout));
      assert(layout.buttons.every(b=>b.height>=44&&b.reachable)&&layout.textHeight>=42,JSON.stringify(layout));
      await shot('season-briefing-'+(width===390?'mobile':'landscape'));
      const p=layout.buttons[0];await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await new Promise(r=>setTimeout(r,100));assert.equal(await ev('g.tutorialSystem.isAwaitingAcknowledgement()'),false);layouts.push(layout);
    }
    await call('Emulation.setTouchEmulationEnabled',{enabled:false});
    await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await ev('g.renderer.resize()');return layouts;
  });
  await check('heating consumes exactly four wood per completed shelter per winter',async()=>{
    const r=await ev(`(()=>{econReset();g.buildingSystem.placeStartingBuilding('watchtower',42,27);g.buildingSystem.placeBuilding('hut',35,32);g.resourceSystem.resources.wood=20;const h=g.heatingSystem,b=g.buildingSystem.buildings,res=g.resourceSystem;
      for(const season of ['spring','summer','autumn'])h.update(120,b,res,season);const summer=res.resources.wood;
      for(let i=0;i<1200;i++)h.update(balance.seasons.winterDuration/1200,b,res,'winter');const used=summer-res.resources.wood;
      res.resources.wood=0;h.update(1,b,res,'winter');const cold=h.at(42,27);res.addWood(1);h.update(1,b,res,'winter');const warm=h.at(42,27);
      return{summer,used,cold,warm,remaining:res.resources.wood};})()`);
    assert.equal(r.summer,20);assert(Math.abs(r.used-8)<1e-9);assert.equal(r.cold,0);assert.equal(r.warm,1);assert(r.remaining>=0);return r;
  });
  await check('unheated shelters slow hypothermia while fuel restores warming',async()=>{
    const r=await ev(`(()=>{econReset();const home=g.buildingSystem.buildings[0],[bare,coated]=g.villagerSystem.villagers;for(const v of [bare,coated])Object.assign(v,{x:home.tileX,y:home.tileY,coldExposure:0});coated.clothingWintersLeft=3;g.resourceSystem.resources.wood=0;g.heatingSystem.update(1,g.buildingSystem.buildings,g.resourceSystem,'winter');const dead=[];const warmth=(x,y)=>g.heatingSystem.at(x,y);g.coldSystem.update(balance.cold.unclothedSurvivalSeconds/balance.heating.unheatedExposureMultiplier+.1,[bare,coated],g.buildingSystem.getHousingTiles(),'winter',false,v=>dead.push(v.id),warmth);const exposure=coated.coldExposure;g.resourceSystem.resources.wood=1;g.heatingSystem.update(1,g.buildingSystem.buildings,g.resourceSystem,'winter');g.coldSystem.update(5,[coated],g.buildingSystem.getHousingTiles(),'winter',false,()=>{},warmth);return{dead,bare:bare.id,exposure,warmed:coated.coldExposure};})()`);
    assert.deepEqual(r.dead,[r.bare]);assert(r.exposure>0&&r.exposure<30);assert(r.warmed<r.exposure);return r;
  });
  await check('winter forecast and warnings include remaining firewood and indoor hypothermia',async()=>{
    const r=await ev(`(async()=>{econReset();g.seasonSystem.season='winter';g.seasonSystem.seasonTimer=balance.seasons.winterDuration/2;g.resourceSystem.resources.wood=0;const v=g.villagerSystem.villagers[0],b=g.buildingSystem.buildings[0];Object.assign(v,{x:b.tileX,y:b.tileY,coldExposure:25});g.heatingSystem.update(0,g.buildingSystem.buildings,g.resourceSystem,'winter');const plan=forecast(g.seasonSystem,g.resourceSystem,g.buildingSystem,g.villagerSystem),{settlementWarnings}=await import('/src/systems/WarningSystem.ts');const warnings=settlementWarnings(plan,[v],'winter',()=>true,false,()=>0);g.updateUI();return{needed:plan.heatingWoodNeeded,balance:plan.woodBalance,warnings,display:document.querySelector('[data-forecast-body]').textContent};})()`);
    assert.equal(r.needed,2);assert.equal(r.balance,-2);assert(r.warnings.some(w=>w.id==='wood'));assert(r.warnings.some(w=>w.id==='heating'));assert(r.warnings.some(w=>w.id==='cold'&&w.text.includes('Gather wood')));assert(r.display.includes('Winter firewood'));return r;
  });
  await check('midwinter save loading charges only the remaining winter fuel',async()=>{
    const r=await ev(`(()=>{econReset();g.seasonSystem.season='winter';g.seasonSystem.seasonTimer=balance.seasons.winterDuration/2;g.resourceSystem.resources.wood=4;g.heatingSystem.update(balance.seasons.winterDuration/2,g.buildingSystem.buildings,g.resourceSystem,'winter');const before=g.resourceSystem.resources.wood,saved=JSON.parse(JSON.stringify(g.serializeState()));g.deserializeState(saved);const loaded=g.resourceSystem.resources.wood;g.heatingSystem.update(balance.seasons.winterDuration/2,g.buildingSystem.buildings,g.resourceSystem,'winter');return{before,loaded,after:g.resourceSystem.resources.wood};})()`);
    assert.deepEqual(r,{before:2,loaded:2,after:0});return r;
  });
}
