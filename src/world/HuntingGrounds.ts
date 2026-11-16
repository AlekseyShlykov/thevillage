import { Position, TileType } from '../types';
import { TileMap } from './TileMap';
import { getConfig } from '../data/ConfigLoader';

/** Distance from the edge of every clearing, cached for the current map revision. */
export class HuntingGrounds {
  private revision = -1;
  private depths = new Uint16Array();
  constructor(private map: TileMap) {}
  depthAt(x: number, y: number): number { this.refresh(); return this.depths[y * this.map.width + x] ?? 0; }
  candidates(origin: Position, requested?: Position, limits?: { minimum: number; maximum: number; searchRadius: number }): Position[] {
    this.refresh(); const cfg = getConfig().villagers, out: Position[] = [];
    for (let y = 0; y < this.map.height; y++)
      for (let x = 0; x < this.map.width; x++) {
        const depth = this.depths[y * this.map.width + x];
        if (depth < (limits?.minimum ?? cfg.huntForestDepth) || depth > (limits?.maximum ?? cfg.huntMaxForestDepth)) continue;
        if (requested && Math.hypot(x - requested.x, y - requested.y) > (limits?.searchRadius ?? cfg.huntTargetSearchRadius)) continue;
        if (this.map.getTile(x, y)?.type === TileType.Forest) out.push({ x, y });
      }
    const target = requested ?? origin;
    return out.sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y));
  }
  private refresh(): void {
    if (this.revision === this.map.revision) return;
    this.revision = this.map.revision;
    const w = this.map.width, h = this.map.height, queue: number[] = [];
    this.depths = new Uint16Array(w * h); this.depths.fill(w + h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (this.map.getTile(x, y)?.type !== TileType.Forest) {
      const i = y * w + x; this.depths[i] = 0; queue.push(i);
    }
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head], x = i % w, y = Math.floor(i / w);
      for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0],[-1,-1],[1,-1],[1,1],[-1,1]]) {
        const nx = x + dx, ny = y + dy, j = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || this.depths[j] <= this.depths[i] + 1) continue;
        this.depths[j] = this.depths[i] + 1; queue.push(j);
      }
    }
  }
}
