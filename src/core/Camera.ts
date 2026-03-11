import { getConfig } from '../data/ConfigLoader';

export class Camera {
  public x = 0;
  public y = 0;
  public viewportWidth = 1200;
  public viewportHeight = 864;

  clamp(): void {
    const cfg = getConfig().map;
    const maxX = cfg.mapWidth * cfg.tileSize - this.viewportWidth;
    const maxY = cfg.mapHeight * cfg.tileSize - this.viewportHeight;
    this.x = Math.max(0, Math.min(this.x, maxX));
    this.y = Math.max(0, Math.min(this.y, maxY));
  }

  centerOn(worldX: number, worldY: number): void {
    this.x = worldX - this.viewportWidth / 2;
    this.y = worldY - this.viewportHeight / 2;
    this.clamp();
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx - this.x, y: wy - this.y };
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: sx + this.x, y: sy + this.y };
  }

  screenToTile(sx: number, sy: number): { tx: number; ty: number } {
    const world = this.screenToWorld(sx, sy);
    const tileSize = getConfig().map.tileSize;
    return {
      tx: Math.floor(world.x / tileSize),
      ty: Math.floor(world.y / tileSize),
    };
  }
}
