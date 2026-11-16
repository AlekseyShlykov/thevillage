import { Camera } from '../core/Camera';
import { AssetLoader } from './AssetLoader';
import { BuildingConfig, BuildingInstance, Season } from '../types';
import { getConfig } from '../data/ConfigLoader';

export type Point = { x: number; y: number };
export function polygon(ctx: CanvasRenderingContext2D, points: Point[], fill: string, stroke?: string): void {
  ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
export function footprint(camera: Camera, x: number, y: number, w = 1, h = 1): Point[] {
  const ts = getConfig().map.tileSize;
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([tx, ty]) => camera.worldToScreen(tx * ts, ty * ts));
}
export const hash = (x: number, y: number) => ((Math.imul(x + 23, 374761393) ^ Math.imul(y + 71, 668265263)) >>> 0);

/** Upright illustrated props, layered over a diamond ground plane. */
export class IsometricArt {
  private seasonalAtlas = new Map<Season, HTMLCanvasElement>();
  constructor(private camera: Camera, private assets: AssetLoader) {}
  atlas(season: Season): CanvasImageSource | null {
    const image = this.assets.getAtlas(season); if (!image) return null;
    if (!this.seasonalAtlas.has(season)) {
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d')!;
      ctx.filter = season === Season.Winter ? 'saturate(0.9)' : season === Season.Autumn ? 'sepia(0.23) saturate(0.8)' : 'saturate(0.78)';
      ctx.drawImage(image, 0, 0); this.seasonalAtlas.set(season, canvas);
    }
    return this.seasonalAtlas.get(season)!;
  }
  private sprite(ctx: CanvasRenderingContext2D, index: number, x: number, baseline: number, size: number, season: Season): boolean {
    const atlas = this.atlas(season); if (!atlas) return false;
    const cw = (atlas as HTMLCanvasElement).width / 3, ch = (atlas as HTMLCanvasElement).height / 2;
    ctx.drawImage(atlas, index % 3 * cw, Math.floor(index / 3) * ch, cw, ch, x - size / 2, baseline - size * 0.92, size, size);
    return true;
  }
  tree(ctx: CanvasRenderingContext2D, x: number, y: number, season: Season, alpha: number, shake = 0): void {
    const ts = getConfig().map.tileSize, n = hash(x, y), z = this.camera.zoom;
    const p = this.camera.worldToScreen((x + 0.35 + (n % 21) / 70) * ts, (y + 0.4 + ((n >> 5) % 17) / 70) * ts);
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(shake * z, 0);
    ctx.fillStyle = 'rgba(13,30,20,.15)'; ctx.beginPath(); ctx.ellipse(p.x + 10 * z, p.y + 1, 25 * z, 9 * z, -.15, 0, Math.PI * 2); ctx.fill();
    const size = (118 + n % 27) * z;
    if (!this.sprite(ctx, n % 11 === 0 ? 2 : n % 2, p.x, p.y, size, season)) {
      ctx.fillStyle = '#73533c'; ctx.fillRect(p.x - 3 * z, p.y - 28 * z, 6 * z, 29 * z);
      for (let i = 0; i < 3; i++) polygon(ctx, [{ x: p.x, y: p.y - (86 - i * 18) * z }, { x: p.x + (24 + i * 4) * z, y: p.y - (36 - i * 13) * z }, { x: p.x - (24 + i * 4) * z, y: p.y - (36 - i * 13) * z }], season === Season.Winter ? ['#9eb7ab', '#78978a', '#5b7e70'][i] : ['#547554', '#416548', '#32543c'][i]);
    }
    ctx.restore();
  }
  buildingBounds(b: BuildingInstance, cfg: BuildingConfig) {
    const pts = footprint(this.camera, b.tileX, b.tileY, cfg.width, cfg.height);
    const size = (cfg.width + cfg.height) * this.camera.tileWidth / 2 * 1.12;
    const centerX = (pts[0].x + pts[2].x) / 2, baseline = pts[2].y;
    return { x: centerX - size / 2, y: baseline - size * .92, width: size, height: size, centerX, baseline, pts };
  }
  building(ctx: CanvasRenderingContext2D, b: BuildingInstance, cfg: BuildingConfig, season: Season, time: number): void {
    const { centerX: x, baseline: y, width: size, pts } = this.buildingBounds(b, cfg), z = this.camera.zoom;
    ctx.save();
    if (!b.built) { ctx.globalAlpha = .45 + b.buildProgress * .4; polygon(ctx, pts, 'rgba(181,142,79,.16)', '#e4bf75'); }
    if (b.configId === 'garden') this.garden(ctx, b, cfg, season);
    else if (cfg.category === 'defense') this.palisade(ctx, b, time);
    else if (['bonfire', 'campFire', 'scoutFire'].includes(b.configId)) this.fire(ctx, (pts[0].x + pts[2].x) / 2, (pts[0].y + pts[2].y) / 2, z, time);
    else {
      ctx.fillStyle = 'rgba(20,30,20,.18)'; ctx.beginPath(); ctx.ellipse(x + 10 * z, y - 12 * z, size * .39, size * .12, 0, 0, Math.PI * 2); ctx.fill();
      const index = b.configId === 'storage' ? 4 : b.configId === 'lumberCamp' ? 5 : 3;
      if (!this.sprite(ctx, index, x, y, size, season)) {
        const raised = pts.map(p => ({ x: p.x, y: p.y - 32 * z }));
        polygon(ctx, [pts[1], pts[2], raised[2], raised[1]], '#6c4932', '#453a29');
        polygon(ctx, [pts[2], pts[3], raised[3], raised[2]], '#96724c', '#453a29');
        polygon(ctx, raised, '#b99a55', '#6c5533');
      }
      if (b.configId === 'watchtower') { ctx.fillStyle = '#c7a473'; ctx.fillRect(x - 6 * z, y - size * .85, 12 * z, size * .4); }
    }
    ctx.restore();
  }
  private garden(ctx: CanvasRenderingContext2D, b: BuildingInstance, cfg: BuildingConfig, season: Season): void {
    const pts = footprint(this.camera, b.tileX, b.tileY, cfg.width, cfg.height), z = this.camera.zoom;
    polygon(ctx, pts, season === Season.Winter ? '#a1a995' : '#68513c', '#b8a273');
    const p = b.farmingProgress ?? 0, ts = getConfig().map.tileSize;
    for (let row = 0; row < 4; row++) {
      const a = this.camera.worldToScreen((b.tileX + .18) * ts, (b.tileY + .25 + row * .43) * ts);
      const c = this.camera.worldToScreen((b.tileX + cfg.width - .18) * ts, (b.tileY + .25 + row * .43) * ts);
      ctx.strokeStyle = season === Season.Winter ? '#c1c7b8' : '#8b6b48'; ctx.lineWidth = 4 * z;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
      for (let col = 0; col < 5 && p > 0; col++) {
        const q = this.camera.worldToScreen((b.tileX + .25 + col * .36) * ts, (b.tileY + .25 + row * .43) * ts);
        ctx.fillStyle = p > .65 ? '#d6b65d' : '#95ad5d'; ctx.beginPath(); ctx.ellipse(q.x, q.y - 4 * z * p, 3 * z, (2 + 6 * p) * z, -.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  private palisade(ctx: CanvasRenderingContext2D, b: BuildingInstance, _time: number): void {
    const pts = footprint(this.camera, b.tileX, b.tileY), z = this.camera.zoom;
    const a = b.rotation === 90 ? pts[0] : pts[3], c = b.rotation === 90 ? pts[3] : pts[2];
    for (let i = 0; i <= 5; i++) {
      if (b.configId === 'palisadeGate' && b.gateOpen && i > 0 && i < 5) continue;
      const x = a.x + (c.x - a.x) * i / 5, y = a.y + (c.y - a.y) * i / 5, h = (b.configId === 'palisadeGate' ? 30 : 24) * z;
      polygon(ctx, [{ x: x - 3 * z, y }, { x: x - 3 * z, y: y - h }, { x, y: y - h - 5 * z }, { x: x + 4 * z, y: y - h }, { x: x + 4 * z, y }], i % 2 ? '#95744f' : '#ac8a5c', '#5c4936');
    }
  }
  private fire(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, t: number): void {
    const glow = ctx.createRadialGradient(x, y, 1, x, y, 55 * z); glow.addColorStop(0, 'rgba(255,192,87,.2)'); glow.addColorStop(1, 'rgba(255,192,87,0)');
    ctx.fillStyle = glow; ctx.fillRect(x - 55 * z, y - 55 * z, 110 * z, 110 * z);
    ctx.strokeStyle = '#614631'; ctx.lineWidth = 6 * z; ctx.beginPath(); ctx.moveTo(x - 13 * z, y + 4 * z); ctx.lineTo(x + 13 * z, y - 4 * z); ctx.moveTo(x - 13 * z, y - 4 * z); ctx.lineTo(x + 13 * z, y + 4 * z); ctx.stroke();
    const flicker = Math.sin(t * 8) * 3;
    polygon(ctx, [{ x: x - 10 * z, y }, { x: x - 4 * z, y: y - 15 * z }, { x: x + 2 * z, y: y - (27 + flicker) * z }, { x: x + 10 * z, y }], '#ed943e');
    polygon(ctx, [{ x: x - 5 * z, y }, { x: x + 2 * z, y: y - 17 * z }, { x: x + 6 * z, y }], '#f7d984');
  }
}
