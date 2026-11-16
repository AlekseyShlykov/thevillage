import { getConfig } from '../data/ConfigLoader';

/** Logical tile coordinates stay orthogonal; only the camera projects them. */
export class Camera {
  public x = 0;
  public y = 0;
  public viewportWidth = 1200;
  public viewportHeight = 864;
  public zoom = getConfig().rendering.zoom;

  get tileWidth(): number { return getConfig().rendering.tileWidth * this.zoom; }
  get tileHeight(): number { return getConfig().rendering.tileHeight * this.zoom; }

  private project(wx: number, wy: number) {
    const ts = getConfig().map.tileSize;
    return { x: (wx - wy) / ts * this.tileWidth / 2, y: (wx + wy) / ts * this.tileHeight / 2 };
  }

  clamp(): void {
    const cfg = getConfig().map;
    const margin = this.tileWidth * 2;
    this.x = Math.max(-cfg.mapHeight * this.tileWidth / 2 - margin, Math.min(this.x, cfg.mapWidth * this.tileWidth / 2 - this.viewportWidth + margin));
    this.y = Math.max(-margin, Math.min(this.y, (cfg.mapWidth + cfg.mapHeight) * this.tileHeight / 2 - this.viewportHeight + margin));
  }

  centerOn(wx: number, wy: number): void {
    const p = this.project(wx, wy);
    this.x = p.x - this.viewportWidth / 2;
    this.y = p.y - this.viewportHeight / 2;
    this.clamp();
  }

  setZoom(value: number, sx = this.viewportWidth / 2, sy = this.viewportHeight / 2): void {
    const world = this.screenToWorld(sx, sy);
    const cfg = getConfig().rendering;
    this.zoom = Math.max(cfg.minZoom, Math.min(cfg.maxZoom, value));
    const p = this.project(world.x, world.y);
    this.x = p.x - sx;
    this.y = p.y - sy;
    this.clamp();
  }

  worldToScreen(wx: number, wy: number) { const p = this.project(wx, wy); return { x: p.x - this.x, y: p.y - this.y }; }

  screenToWorld(sx: number, sy: number) {
    const px = (sx + this.x) / (this.tileWidth / 2), py = (sy + this.y) / (this.tileHeight / 2);
    const ts = getConfig().map.tileSize;
    return { x: (px + py) / 2 * ts, y: (py - px) / 2 * ts };
  }

  screenToTile(sx: number, sy: number) {
    const p = this.screenToWorld(sx, sy), ts = getConfig().map.tileSize;
    return { tx: Math.floor(p.x / ts), ty: Math.floor(p.y / ts) };
  }
}
