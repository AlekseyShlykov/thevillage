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
  constructor(private camera: Camera, private assets: AssetLoader) {}
  draw(ctx: CanvasRenderingContext2D, v: VillagerData, season: Season, time: number, selected: boolean, building?: BuildingInstance): void {
    const ts = getConfig().map.tileSize, p = this.camera.worldToScreen((v.x + .5) * ts, (v.y + .5) * ts), z = this.camera.zoom;
    const moving = v.path.length > 0 && (v.stuckTimer ?? 0) < .1;
    const phase = actionPhase(v, time), working = isWorking(v), swing = Math.sin(phase * Math.PI * 2);
    const tool = v.currentTask === 'clearing' || building?.configId === 'lumberCamp' ? 'axe' :
      v.currentTask === 'hunting' || building?.configId === 'hunterHut' ? 'bow' : v.currentTask === 'farming' ? 'hoe' : 'hammer';
    const next = v.path[0];
    const cfg = building && getConfig().buildings[building.configId];
    const dx = (next?.x ?? (building && cfg ? building.tileX + cfg.width / 2 : v.targetX) ?? v.x + 1) - v.x;
    const dy = (next?.y ?? (building && cfg ? building.tileY + cfg.height / 2 : v.targetY) ?? v.y) - v.y;
    const facing = dx - dy < 0 ? -1 : 1;
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
    const bob = moving ? Math.abs(Math.sin(time * 12 + phase)) * 1.8 : working ? Math.max(0, swing) * 1.3 : Math.sin(time * 2 + phase) * .35;
    ctx.translate(0, -bob);
    if (working && tool !== 'bow') ctx.rotate(swing * .045);
    const spriteKey = v.health === HealthState.Injured ? 'injured' : moving ? `walk_${Math.floor(time * 6 + phase) % 2 + 1}` : season === Season.Winter ? 'winter' : 'idle';
    const sprite = this.assets.getVillager(spriteKey);
    if (sprite) ctx.drawImage(sprite, -24, -40, 48, 48);
    else { ctx.fillStyle = '#c99962'; ctx.fillRect(-6, -26, 12, 21); ctx.fillStyle = '#ecd0a1'; ctx.beginPath(); ctx.arc(0, -30, 6, 0, Math.PI * 2); ctx.fill(); }
    if (working) this.tool(ctx, tool, phase);
    ctx.restore();
    if (working && tool !== 'bow') this.particles(ctx, phase, facing, tool === 'axe' ? '#dbc18a' : tool === 'hoe' ? '#ab9972' : '#e4cba0');
    ctx.restore();
  }
  private tool(ctx: CanvasRenderingContext2D, tool: string, phase: number): void {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2;
    const swing = Math.sin(phase * Math.PI * 2);
    ctx.translate(7, -20);
    if (tool === 'bow') {
      ctx.strokeStyle = '#d0ab70'; ctx.beginPath(); ctx.arc(3, 0, 10, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = '#ecddae'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(6.6, -9.3); ctx.lineTo(1 - Math.max(0, swing) * 4, 0); ctx.lineTo(6.6, 9.3); ctx.stroke();
      if (phase < .7) { ctx.strokeStyle = '#bfa679'; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(17, 0); ctx.stroke(); ctx.fillStyle = '#d7ddd0'; ctx.fillRect(15, -1, 4, 2); }
    } else {
      ctx.rotate(tool === 'hoe' ? .6 + swing * .55 : -.9 + swing * 1.2);
      ctx.strokeStyle = '#c29460'; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(tool === 'hoe' ? 22 : 15, 0); ctx.stroke();
      ctx.fillStyle = '#c2c7b5'; ctx.strokeStyle = '#48594f'; ctx.lineWidth = 1;
      if (tool === 'axe') { ctx.beginPath(); ctx.moveTo(12, -5); ctx.lineTo(20, -3); ctx.lineTo(19, 4); ctx.lineTo(12, 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else if (tool === 'hoe') { ctx.fillRect(19, -1, 4, 7); ctx.strokeRect(19, -1, 4, 7); }
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
