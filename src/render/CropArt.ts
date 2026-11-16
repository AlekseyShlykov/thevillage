import { BuildingConfig, BuildingInstance, Season } from '../types';
import { Camera } from '../core/Camera';
import { getConfig } from '../data/ConfigLoader';
import { footprint, hash, polygon } from './IsometricArt';
import { AssetLoader } from './AssetLoader';

const stages = ['Prepared soil', 'Sown', 'Sprouting', 'Young plants', 'Flowering', 'Ripening', 'Ready to harvest'];
export function cropStage(progress: number): number { return Math.min(stages.length - 1, getConfig().rendering.cropStageThresholds.filter(t => progress >= t).length); }
export function cropStageName(progress: number): string { return stages[cropStage(progress)]; }
/** Seven visible stages driven by the real saved harvest progress. */
export class CropArt {
  constructor(private camera: Camera, private assets: AssetLoader) {}
  draw(ctx: CanvasRenderingContext2D, b: BuildingInstance, cfg: BuildingConfig, season: Season, time: number): void {
    const z = this.camera.zoom, ts = getConfig().map.tileSize, progress = b.farmingProgress ?? 0, stage = cropStage(progress);
    const atlas = this.assets.getGardenAtlas();
    if (atlas) {
      const pts = footprint(this.camera, b.tileX, b.tileY, cfg.width, cfg.height);
      const frame = season === Season.Winter && stage === 0 ? 7 : stage;
      const cw = atlas.width / 4, ch = atlas.height / 2;
      const width = (cfg.width + cfg.height) * this.camera.tileWidth / 2 * 1.07, height = width * .82;
      const x = (pts[0].x + pts[2].x) / 2, y = pts[2].y + 2 * z;
      ctx.drawImage(atlas, frame % 4 * cw, Math.floor(frame / 4) * ch, cw, ch,
        x - width / 2, y - height * .92, width, height);
      return;
    }
    polygon(ctx, footprint(this.camera, b.tileX, b.tileY, cfg.width, cfg.height), season === Season.Winter ? '#9b9f86' : '#634d37', '#b59d6a');
    for (let row = 0; row < 4; row++) {
      const wy = b.tileY + .26 + row * .48;
      const a = this.camera.worldToScreen((b.tileX + .13) * ts, wy * ts), c = this.camera.worldToScreen((b.tileX + cfg.width - .13) * ts, wy * ts);
      ctx.lineWidth = 5 * z; ctx.strokeStyle = '#423f2c88'; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(c.x,c.y); ctx.stroke();
      ctx.lineWidth = 1.3 * z; ctx.strokeStyle = season === Season.Winter ? '#c8cab4' : '#a38656'; ctx.beginPath(); ctx.moveTo(a.x,a.y+2*z); ctx.lineTo(c.x,c.y+2*z); ctx.stroke();
      for (let col = 0; col < 6; col++) {
        const n = hash(col, row), p = this.camera.worldToScreen((b.tileX + .24 + col * .3) * ts, wy * ts);
        if (!stage) continue;
        if (stage === 1) { ctx.fillStyle = '#c4a16a'; ctx.fillRect(p.x-z,p.y-z,2*z,z); continue; }
        const height = (3 + (stage - 2) * 3 + n % 3) * z, sway = Math.sin(time * 1.4 + col + row) * z * .55;
        ctx.strokeStyle = stage >= 5 ? '#b5a15b' : '#76914a'; ctx.lineWidth = 1.2 * z;
        ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.quadraticCurveTo(p.x-sway,p.y-height*.6,p.x+sway,p.y-height); ctx.stroke();
        for (let leaf = 0; leaf < Math.min(4, stage); leaf++) {
          const side = leaf % 2 ? 1 : -1, y = p.y - height * (.25 + leaf * .15);
          ctx.fillStyle = stage >= 5 ? (leaf % 2 ? '#b8ac65' : '#cebc77') : leaf % 2 ? '#8fa855' : '#638446';
          ctx.beginPath(); ctx.ellipse(p.x+side*2*z,y, (stage>=3?4:2)*z,1.5*z,side*-.5,0,Math.PI*2); ctx.fill();
        }
        if (stage >= 4) {
          ctx.fillStyle = stage === 4 ? '#e0d8a1' : stage === 5 ? '#c4b66a' : '#e5c46e';
          for (let grain = 0; grain < (stage === 4 ? 2 : 4); grain++) {
            ctx.beginPath(); ctx.ellipse(p.x+sway+(grain%2?1:-1)*1.2*z,p.y-height+grain*1.4*z,1.5*z,2*z,grain%2?.5:-.5,0,Math.PI*2); ctx.fill();
          }
        }
      }
    }
  }
}
