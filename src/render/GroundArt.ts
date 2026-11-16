import { Camera } from '../core/Camera';
import { Season, TileType } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { TileMap } from '../world/TileMap';
import { hash } from './IsometricArt';

export interface GroundBounds { x0: number; y0: number; x1: number; y1: number }
const palettes = {
  spring: { base: '#6b8050', light: '#a4ae68', dark: '#425e3e', blade: '#78904c', tip: '#adb879', soil: '#8b805e' },
  summer: { base: '#71834f', light: '#aab16d', dark: '#465f3b', blade: '#84964d', tip: '#b7be7c', soil: '#968063' },
  autumn: { base: '#88805a', light: '#b6a674', dark: '#595f40', blade: '#9a915e', tip: '#d1bc7d', soil: '#9c7c5a' },
  winter: { base: '#c0cec6', light: '#e3e6d9', dark: '#91aaa3', blade: '#9bac9f', tip: '#edf0e2', soil: '#acb9ac' },
};
// Avalanche the coordinate hash: neighbouring tufts must not form diagonal rows.
function noise(x: number, y: number): number {
  let n = hash(x, y); n = Math.imul(n ^ n >>> 16, 0x7feb352d);
  n = Math.imul(n ^ n >>> 15, 0x846ca68b); return (n ^ n >>> 16) >>> 0;
}

/** World-anchored meadow patches and reusable tuft stamps, drawn into the terrain cache.
 * There are no visible tile borders; forest shade blends into the clearing. */
export class GroundArt {
  private stamps = new Map<string, HTMLCanvasElement>();
  constructor(private camera: Camera) {}
  private point(x: number, y: number) {
    const ts = getConfig().map.tileSize;
    return this.camera.worldToScreen(x * ts, y * ts);
  }
  private patch(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, opacity: number): void {
    const p = this.point(x, y), r = radius * this.camera.tileWidth;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, this.camera.tileHeight / this.camera.tileWidth);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    gradient.addColorStop(0, color); gradient.addColorStop(1, color + '00');
    ctx.globalAlpha = opacity; ctx.fillStyle = gradient; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
  }
  private stamp(season: Season, variant: number): HTMLCanvasElement {
    const key = `${season}:${variant}`;
    if (this.stamps.has(key)) return this.stamps.get(key)!;
    const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 24;
    const ctx = canvas.getContext('2d')!, colors = palettes[season];
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const n = noise(i, variant), x = 8 + n % 25, y = 15 + (n >>> 5) % 5, height = 2 + (n >>> 8) % 5;
      ctx.strokeStyle = i % 3 ? colors.blade : colors.tip; ctx.lineWidth = i % 2 ? 1 : 1.3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 1, y - height * .6, x - 3 + n % 7, y - height); ctx.stroke();
    }
    if (variant === 3 && season !== Season.Winter) {
      for (let i = 0; i < 3; i++) {
        const x = 11 + i * 7, y = 9 + i % 2 * 3;
        ctx.fillStyle = season === Season.Autumn ? '#c6a16a' : '#e4dcaf';
        ctx.fillRect(x - 1, y - 2, 2, 5); ctx.fillRect(x - 2, y - 1, 4, 2);
        ctx.fillStyle = '#d5b561'; ctx.fillRect(x, y, 1, 1);
      }
    }
    if (variant === 4) {
      ctx.fillStyle = season === Season.Winter ? '#d8e1d4' : season === Season.Autumn ? '#b89960' : '#647e49';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(9 + i * 4, 16 - i % 3 * 2, 2.8, 1.4, i, 0, Math.PI * 2); ctx.fill(); }
    }
    this.stamps.set(key, canvas); return canvas;
  }
  draw(ctx: CanvasRenderingContext2D, map: TileMap, season: Season, bounds: GroundBounds): void {
    const colors = palettes[season], z = this.camera.zoom;
    ctx.fillStyle = colors.base; ctx.fillRect(0, 0, this.camera.viewportWidth, this.camera.viewportHeight);
    // Large overlapping patches break up repetition independently of the tile grid.
    for (let y = bounds.y0 - 4; y <= bounds.y1 + 4; y += 3) for (let x = bounds.x0 - 4; x <= bounds.x1 + 4; x += 3) {
      // Anchor sampling to world cells even when the visible bounds change.
      const wx = Math.floor(x / 3) * 3, wy = Math.floor(y / 3) * 3, n = noise(wx, wy);
      this.patch(ctx, wx + (n % 100) / 70, wy + ((n >>> 8) % 100) / 70, 1.2 + n % 7 / 10, n % 3 ? colors.light : colors.dark, .38);
    }
    for (let y = bounds.y0; y <= bounds.y1; y++) for (let x = bounds.x0; x <= bounds.x1; x++) {
      const tile = map.getTile(x, y)!, n = noise(x, y), forest = tile.type === TileType.Forest;
      if (forest) this.patch(ctx, x + .5, y + .5, .7, colors.dark, .38);
      else if (tile.buildingId) this.patch(ctx, x + .5, y + .5, .7, colors.soil, .55);
      const count = forest ? 2 : tile.buildingId ? 1 : 5;
      for (let i = 0; i < count; i++) {
        const seed = noise(x * 7 + i, y * 11 + i), p = this.point(x + .08 + seed % 100 / 120, y + .08 + (seed >>> 9) % 100 / 120);
        if (p.x < -30 || p.y < -30 || p.x > this.camera.viewportWidth + 30 || p.y > this.camera.viewportHeight + 30) continue;
        const flowerPatch = noise(Math.floor(x / 3), Math.floor(y / 3)) % 5 === 0;
        const variant = flowerPatch && seed % 7 === 0 ? 3 : seed % 3 === 0 ? 4 : seed % 3;
        ctx.globalAlpha = forest ? .55 : season === Season.Winter ? .35 : .72;
        ctx.drawImage(this.stamp(season, variant), p.x - 20 * z, p.y - 19 * z, 40 * z, 24 * z);
      }
      ctx.globalAlpha = 1;
      if (n % 19 === 0 && !tile.buildingId) {
        const p = this.point(x + .7, y + .3);
        ctx.fillStyle = season === Season.Winter ? '#dce3d9' : '#909581';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 4 * z, 2.3 * z, -.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#344c382e'; ctx.fillRect(p.x - 3 * z, p.y + z, 6 * z, z);
      }
    }
  }

  /** Only a few foreground tufts sway each frame; the detailed meadow stays cached. */
  breeze(ctx: CanvasRenderingContext2D, map: TileMap, season: Season, bounds: GroundBounds, time: number): void {
    if (season === Season.Winter) return;
    const z = this.camera.zoom; ctx.lineWidth = z; ctx.strokeStyle = palettes[season].tip; ctx.globalAlpha = .45;
    ctx.beginPath();
    for (let y = bounds.y0; y <= bounds.y1; y++) for (let x = bounds.x0; x <= bounds.x1; x++) {
      if (map.getTile(x, y)?.type !== TileType.Clear || noise(x, y) % 5 !== 0) continue;
      const n = noise(x, y), p = this.point(x + (n % 70) / 100, y + (n >>> 9) % 70 / 100);
      const sway = Math.sin(time * 1.6 + x * .4 + y * .7) * 1.5;
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(p.x + i * 3 * z, p.y);
        ctx.quadraticCurveTo(p.x + (i * 3 + sway) * z, p.y - 2 * z, p.x + (i * 3 + 1 + sway) * z, p.y - (3 + i % 2) * z);
      }
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
}
