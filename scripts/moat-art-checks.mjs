import assert from 'node:assert/strict';

export async function runMoatArtChecks({check,ev,shot,call}) {
  await call('Emulation.setTouchEmulationEnabled',{enabled:false});
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await ev(`(async()=>{g.renderer.resize();g.restart();g.gameLoop.stop();window.moatModule=await import('/src/world/MoatConnections.ts');window.moatArt=g.renderer.art.moats;})()`);
  await check('painted moat covers all sixteen adjacency patterns with matching open mouths',async()=>{
    const r=await ev(`(()=>{const art=moatArt,atlas=g.renderer.assets.getMoatAtlas(),counts=[0,0,0,0,0,0],patterns=[];
      const center={tileX:40,tileY:30,configId:'moat'};
      for(let mask=0;mask<16;mask++){
        const others=moatModule.moatDirections.flatMap(([dx,dy],i)=>mask&(1<<i)?[{tileX:40+dx,tileY:30+dy,configId:'moat',built:i%2===0}]:[]);
        others.push({tileX:41,tileY:31,configId:'moat'},{tileX:38,tileY:30,configId:'moat'},{tileX:40,tileY:30,configId:'palisadeWall'});
        const actual=moatModule.moatConnectionMask(center,others),sprite=moatModule.moatSprite(actual);counts[sprite.frame]++;
        const canvas=art.makeTile(mask,'spring',true,atlas),c=canvas.getContext('2d');
        const mouths=[[65,1],[128,65],[65,128],[1,65]].map(([x,y])=>Array.from(c.getImageData(x,y,1,1).data));
        patterns.push({mask,actual,mouths});
      }
      return{size:[atlas.width,atlas.height],counts,patterns};})()`);
    assert.deepEqual(r.size,[1536,1024]);assert.deepEqual(r.counts,[1,4,2,4,4,1]);
    for(const p of r.patterns){assert.equal(p.actual,p.mask);for(let i=0;i<4;i++)if(p.mask&(1<<i)){const [red,green,blue,alpha]=p.mouths[i];assert(alpha>200&&green>red+8&&blue>red+5,JSON.stringify(p));}}
    return{patterns:r.patterns.length,shapeVariants:r.counts};
  });
  await check('moat joins refresh after construction, demolition and save loading',async()=>{
    const r=await ev(`(()=>{g.restart();const a=g.buildingSystem.placeStartingBuilding('moat',42,27),b=g.buildingSystem.placeStartingBuilding('moat',43,27),c=g.buildingSystem.placeBuilding('moat',43,28);
      const mask=()=>moatModule.moatConnectionMask(g.buildingSystem.buildings.find(o=>o.id===b.id),g.buildingSystem.buildings);
      const elbow=mask();g.buildingSystem.demolishBuilding(a.id);const cap=mask();const saved=JSON.parse(JSON.stringify(g.serializeState()));g.deserializeState(saved);const restored=mask();
      return{elbow,cap,restored,unfinished:c.built};})()`);
    assert.deepEqual(r,{elbow:12,cap:4,restored:4,unfinished:false});return r;
  });
  await check('moat artwork renders bends, junctions, winter and missing-asset fallback',async()=>{
    await ev(`(()=>{g.restart();g.camera.setZoom(1.5);g.camera.centerOn(41*48,29*48);
      const points=[];for(let x=36;x<=45;x++){points.push([x,25],[x,33]);}for(let y=26;y<33;y++){points.push([36,y],[45,y]);}for(let y=25;y<=33;y++)points.push([40,y]);for(let x=40;x<=45;x++)points.push([x,29]);
      for(const [x,y]of points)if(!g.tileMap.getTile(x,y).buildingId)g.buildingSystem.placeStartingBuilding('moat',x,y);
      g.updateUI();g.render();})()`);
    await shot('moat-connected-spring');
    await ev(`g.seasonSystem.season='winter';g.updateUI();g.render()`);await shot('moat-connected-winter');
    const r=await ev(`(()=>{const art=moatArt,atlas=g.renderer.assets.getMoatAtlas();let fallbackPixels=0;for(let m=0;m<16;m++){for(const built of [true,false])for(const season of ['spring','winter']){const tile=art.makeTile(m,season,built,atlas);if(tile.width!==130)throw Error('Wrong padded tile size');}const c=art.makeTile(m,'spring',true,null);fallbackPixels+=c.getContext('2d').getImageData(65,65,1,1).data[3]>0?1:0;}return{fallbackPixels,cache:art.tiles.size,tiles:g.buildingSystem.getBuildingsOfType('moat').length};})()`);
    assert.equal(r.fallbackPixels,16);assert(r.tiles>30);assert(r.cache<=128);return r;
  });
}
