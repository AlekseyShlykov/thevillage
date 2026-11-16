import { Camera } from '../core/Camera';
import { BuildingInstance, Season } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { footprint, polygon } from './IsometricArt';

/** Connected sunken earth, dark water and exposed banks share the terrain palette. */
export function drawMoat(ctx:CanvasRenderingContext2D,camera:Camera,b:BuildingInstance,all:BuildingInstance[],season:Season):void {
  const z=camera.zoom,ts=getConfig().map.tileSize;
  const p=(x:number,y:number)=>camera.worldToScreen((b.tileX+x)*ts,(b.tileY+y)*ts);
  const full=footprint(camera,b.tileX,b.tileY);
  polygon(ctx,full,season===Season.Winter?'#8f9785':'#846346','#b19b6d');
  const inner=[p(.08,.08),p(.92,.08),p(.92,.92),p(.08,.92)];
  polygon(ctx,inner,'#352e27');
  const water=inner.map(q=>({x:q.x,y:q.y+4*z}));
  polygon(ctx,water,season===Season.Winter?'#526d68':'#354f48');
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]) if(all.some(o=>o.configId==='moat'&&o.built&&o.tileX===b.tileX+dx&&o.tileY===b.tileY+dy)) {
    const center=p(.5,.5),edge=p(.5+dx*.52,.5+dy*.52);
    ctx.strokeStyle='#354f48';ctx.lineWidth=12*z;ctx.beginPath();ctx.moveTo(center.x,center.y+3*z);ctx.lineTo(edge.x,edge.y+3*z);ctx.stroke();
  }
  ctx.strokeStyle=season===Season.Winter?'#a8b9aa88':'#8aa18a66';ctx.lineWidth=z;
  for(let i=0;i<3;i++){const a=p(.2+i*.17,.3),c=p(.28+i*.17,.45);ctx.beginPath();ctx.moveTo(a.x,a.y+3*z);ctx.lineTo(c.x,c.y+3*z);ctx.stroke();}
}
