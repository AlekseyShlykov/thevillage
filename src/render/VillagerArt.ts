import { Camera } from '../core/Camera';
import { AssetLoader } from './AssetLoader';
import { BuildingInstance, HealthState, Season, VillagerData, VillagerState } from '../types';
import { getConfig } from '../data/ConfigLoader';

/** Stable offsets keep a group of workers from swinging their tools in unison. */
export function actionPhase(v: VillagerData, time: number): number {
  return (time * 1.15 + (Number(v.id.replace('v_', '')) || 0) * .37) % 1;
}
export function isWorking(v: VillagerData): boolean {
  return !v.path.length && !!v.currentTask && (v.state === VillagerState.Working || v.state === VillagerState.Building);
}

/** Small sprite poses plus Canvas tools and particles. All effects are cosmetic;
 * the simulation remains the authority for whether the villager is working. */
export class VillagerArt {
  private poses = new Map<string, { x: number; y: number; time: number; phase: number; stride: number; facing: number }>();
  constructor(private camera: Camera, private assets: AssetLoader) {}
  hide(id: string): void { this.poses.delete(id); }
  draw(ctx: CanvasRenderingContext2D, v: VillagerData, season: Season, time: number, selected: boolean, building?: BuildingInstance): void {
    const ts = getConfig().map.tileSize, z = this.camera.zoom;
    let pose = this.poses.get(v.id);
    if (!pose || Math.hypot(pose.x - v.x, pose.y - v.y) > 2) {
      pose = { x: v.x, y: v.y, time, phase: 0, stride: 0, facing: 1 }; this.poses.set(v.id, pose);
    }
    const dt = Math.max(0, Math.min(.1, time - pose.time)), blend = 1 - Math.exp(-18 * dt);
    const oldX = pose.x, oldY = pose.y;
    pose.x += (v.x - pose.x) * blend; pose.y += (v.y - pose.y) * blend; pose.time = time;
    const travelled = Math.hypot(pose.x - oldX, pose.y - oldY);
    pose.phase += travelled * Math.PI * 2;
    pose.stride += ((v.path.length && (v.stuckTimer ?? 0) < .1 ? 1 : 0) - pose.stride) * (1 - Math.exp(-12 * dt));
    const p = this.camera.worldToScreen((pose.x + .5) * ts, (pose.y + .5) * ts);
    const moving = v.path.length > 0 && (v.stuckTimer ?? 0) < .1;
    const phase = actionPhase(v, time), working = isWorking(v), swing = Math.sin(phase * Math.PI * 2);
    const tool = v.currentTask === 'clearing' || building?.configId === 'lumberCamp' ? 'axe' :
      v.currentTask === 'hunting' ? 'bow' : v.currentTask === 'gatheringHerbs' ? 'herbs' : v.currentTask === 'farming' ? 'rake' : 'hammer';
    const next = v.path[0];
    const cfg = building && getConfig().buildings[building.configId];
    const dx = (next?.x ?? (building && cfg ? building.tileX + cfg.width / 2 : v.targetX) ?? v.x + 1) - v.x;
    const dy = (next?.y ?? (building && cfg ? building.tileY + cfg.height / 2 : v.targetY) ?? v.y) - v.y;
    if (Math.abs(dx - dy) > .1) pose.facing = dx - dy < 0 ? -1 : 1;
    const facing = pose.facing;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(z, z);
    ctx.fillStyle = '#142a2340'; ctx.beginPath(); ctx.ellipse(0, 0, 11, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    if (selected) {
      ctx.strokeStyle = '#f1d694'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f1d694'; ctx.beginPath(); ctx.moveTo(-3, -46); ctx.lineTo(3, -46); ctx.lineTo(0, -41); ctx.fill();
    }
    if (moving && season !== Season.Winter) {
      const walkPhase = (time * 2.4 + phase) % 1;
      ctx.globalAlpha = (1 - walkPhase) * .25; ctx.fillStyle = '#d4c69a';
      ctx.beginPath(); ctx.ellipse(-facing * (4 + walkPhase * 10), 1, 1 + walkPhase * 4, 1 + walkPhase * 1.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.save(); ctx.scale(facing, 1);
    const bob = pose.stride * (1 - Math.cos(pose.phase * 2)) * .45 + (working ? Math.max(0, swing) * 1.3 : Math.sin(time * 2 + phase) * .25);
    ctx.translate(0, -bob);
    if (working && tool !== 'bow') ctx.rotate(swing * .045);
    const spriteKey = v.health === HealthState.Injured ? 'injured' : season === Season.Winter && (v.clothingWintersLeft ?? 0) > 0 ? 'winter' : 'idle';
    const sprite = this.assets.getVillager(spriteKey);
    if (sprite && pose.stride > .01) {
      // Keep head/torso stable. Feet move continuously instead of flipping between
      // two different whole-body drawings, which made walking appear to flicker.
      for (const side of [-1, 1]) {
        ctx.save(); ctx.beginPath(); ctx.rect(side < 0 ? -24 : 0, -9, 24, 17); ctx.clip();
        const step = Math.sin(pose.phase) * side * pose.stride;
        ctx.drawImage(sprite, -24 + step * 1.3, -40 - Math.max(0, step) * 1.1, 48, 48); ctx.restore();
      }
      ctx.save(); ctx.beginPath(); ctx.rect(-24, -40, 48, 31); ctx.clip(); ctx.drawImage(sprite, -24, -40, 48, 48); ctx.restore();
    } else if (sprite) ctx.drawImage(sprite, -24, -40, 48, 48);
    else { ctx.fillStyle = '#c99962'; ctx.fillRect(-6, -26, 12, 21); ctx.fillStyle = '#ecd0a1'; ctx.beginPath(); ctx.arc(0, -30, 6, 0, Math.PI * 2); ctx.fill(); }
    if (working) this.tool(ctx, tool, phase);
    if (Object.values(v.cargo ?? {}).some(n => n > 0)) { ctx.fillStyle = '#b39664'; ctx.strokeStyle = '#5a4c35'; ctx.fillRect(-13,-21,7,10); ctx.strokeRect(-13,-21,7,10); }
    ctx.restore();
    if (working && tool !== 'bow') this.particles(ctx, phase, facing, tool === 'axe' ? '#dbc18a' : tool === 'rake' ? '#ab9972' : '#e4cba0');
    ctx.restore();
  }
  private tool(ctx: CanvasRenderingContext2D, tool: string, phase: number): void {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2;
    const swing = Math.sin(phase * Math.PI * 2);
    ctx.translate(7, -20);
    const sprite=this.assets.getTool?.(tool);
    if(sprite) {
      ctx.rotate(tool==='rake'?2.25+swing*.28:-.8+swing*1.1);
      ctx.drawImage(sprite,-19,-30,38,38);
      ctx.fillStyle='#dfbd87';ctx.beginPath();ctx.arc(0,0,2.5,0,Math.PI*2);ctx.fill();
    } else if (tool === 'herbs') {
      ctx.translate(1, 7 + swing * 4); ctx.strokeStyle = '#71884e';
      for (let i=0;i<3;i++) { ctx.beginPath();ctx.moveTo(0,6);ctx.lineTo(i*3-3,-5);ctx.stroke();ctx.fillStyle='#a7b575';ctx.beginPath();ctx.ellipse(i*3-3,-5,2,4,i*.3,0,Math.PI*2);ctx.fill(); }
      ctx.fillStyle='#dfbd87';ctx.beginPath();ctx.arc(0,3,2.5,0,Math.PI*2);ctx.fill();
    } else if (tool === 'bow') {
      ctx.strokeStyle = '#d0ab70'; ctx.beginPath(); ctx.arc(3, 0, 10, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = '#ecddae'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(6.6, -9.3); ctx.lineTo(1 - Math.max(0, swing) * 4, 0); ctx.lineTo(6.6, 9.3); ctx.stroke();
      if (phase < .7) { ctx.strokeStyle = '#bfa679'; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(17, 0); ctx.stroke(); ctx.fillStyle = '#d7ddd0'; ctx.fillRect(15, -1, 4, 2); }
    } else {
      ctx.rotate(tool === 'rake' ? .6 + swing * .55 : -.9 + swing * 1.2);
      ctx.strokeStyle = '#c29460'; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(tool === 'rake' ? 22 : 15, 0); ctx.stroke();
      ctx.fillStyle = '#c2c7b5'; ctx.strokeStyle = '#48594f'; ctx.lineWidth = 1;
      if (tool === 'axe') { ctx.beginPath(); ctx.moveTo(12, -5); ctx.lineTo(20, -3); ctx.lineTo(19, 4); ctx.lineTo(12, 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else if (tool === 'rake') { ctx.fillRect(19, -6, 2, 12);for(let i=-6;i<=6;i+=3)ctx.fillRect(20,i,4,1); }
      else { ctx.fillRect(12, -5, 5, 10); ctx.strokeRect(12, -5, 5, 10); }
      ctx.fillStyle = '#dfbd87'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  private particles(ctx: CanvasRenderingContext2D, phase: number, facing: number, color: string): void {
    const age = (phase + .16) % 1;
    if (age > .48) return;
    ctx.fillStyle = color;
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = Math.max(0, 1 - age * 2.1);
      const x = facing * (13 + age * (14 + i * 9)), y = -4 - Math.sin(age * Math.PI * 2) * (6 + i * 3) + age * i;
      ctx.fillRect(x, y, i % 2 + 1.2, 1.4);
    }
    ctx.globalAlpha = 1;
  }
}
