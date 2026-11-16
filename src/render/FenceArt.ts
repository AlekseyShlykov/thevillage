import { Camera } from '../core/Camera';
import { BuildingInstance, Season } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { fenceAxis, fenceConnections } from '../world/FenceConnections';
import { hash, Point, polygon } from './IsometricArt';

/** Connected timber panels share the same centreline and posts in both axes.
 * Grain, rounded log caps, lashings and winter snow match the illustrated village. */
export class FenceArt {
  constructor(private camera: Camera) {}
  private point(x: number, y: number): Point { const ts = getConfig().map.tileSize; return this.camera.worldToScreen(x * ts, y * ts); }
  draw(ctx: CanvasRenderingContext2D, b: BuildingInstance, buildings: BuildingInstance[], season: Season): void {
    const x = b.tileX + .5, y = b.tileY + .5, z = this.camera.zoom;
    if (b.configId === 'palisadeGate') {
      const [dx,dy] = fenceAxis(b, buildings), a = this.point(x - dx * .5, y - dy * .5), c = this.point(x + dx * .5, y + dy * .5);
      // Open leaves swing around their posts on the ground plane, preserving hinges.
      const angle = b.gateOpen ? Math.PI * .43 : 0, cos = Math.cos(angle), sin = Math.sin(angle);
      const left = this.point(x - dx * .5 + (dx * cos - dy * sin) * .49, y - dy * .5 + (dx * sin + dy * cos) * .49);
      const right = this.point(x + dx * .5 - (dx * cos + dy * sin) * .49, y + dy * .5 - (-dx * sin + dy * cos) * .49);
      this.gateLeaf(ctx, a, left, season); this.gateLeaf(ctx, c, right, season);
      this.log(ctx, a, 36, 7, hash(b.tileX, b.tileY), season); this.log(ctx, c, 36, 7, hash(b.tileX + 1, b.tileY), season);
      if (!b.gateOpen) {
        const p = this.point(x, y); ctx.strokeStyle = '#536052'; ctx.lineWidth = 3 * z;
        ctx.beginPath(); ctx.moveTo(p.x - 7 * z, p.y - 17 * z); ctx.lineTo(p.x + 7 * z, p.y - 17 * z); ctx.stroke();
      }
      return;
    }
    let dirs = fenceConnections(b, buildings);
    if (!dirs.length) { const axis = fenceAxis(b, buildings); dirs = [axis, [-axis[0], -axis[1]]]; }
    const centre = this.point(x, y);
    for (const [dx,dy] of dirs.slice().sort((a,c) => a[0]+a[1]-c[0]-c[1])) {
      const end = this.point(x + dx * .5, y + dy * .5);
      this.rail(ctx, centre, end, 11); this.rail(ctx, centre, end, 23);
      for (let i = 1; i <= 3; i++) {
        const t = i / 3, p = { x: centre.x + (end.x - centre.x) * t, y: centre.y + (end.y - centre.y) * t };
        this.log(ctx, p, 25 + hash(b.tileX * 7 + dx * i, b.tileY * 7 + dy * i) % 5, 5.4, hash(b.tileX * 13 + i, b.tileY + dx + dy), season);
      }
    }
    this.log(ctx, centre, 32, 6.5, hash(b.tileX, b.tileY), season);
  }
  private log(ctx: CanvasRenderingContext2D, p: Point, height: number, width: number, seed: number, season: Season): void {
    const z = this.camera.zoom, w = width * z, h = height * z;
    const grain = ctx.createLinearGradient(p.x - w / 2, 0, p.x + w / 2, 0);
    grain.addColorStop(0, '#594b34'); grain.addColorStop(.28, seed % 2 ? '#b79661' : '#c0a171'); grain.addColorStop(.65, '#907343'); grain.addColorStop(1, '#654f34');
    polygon(ctx, [{x:p.x-w/2,y:p.y},{x:p.x-w/2,y:p.y-h+2*z},{x:p.x-w*.15,y:p.y-h},{x:p.x+w/2,y:p.y-h+2*z},{x:p.x+w/2,y:p.y}], '#8c7049', '#574a34');
    ctx.fillStyle = grain; ctx.fillRect(p.x - w / 2 + z, p.y - h + 3 * z, w - 2 * z, h - 3 * z);
    ctx.strokeStyle = '#e0c38a77'; ctx.lineWidth = .7 * z; ctx.beginPath(); ctx.moveTo(p.x - w * .2, p.y - h + 5 * z); ctx.lineTo(p.x - w * .15, p.y - 4 * z); ctx.stroke();
    ctx.strokeStyle = '#604e3688'; ctx.beginPath(); ctx.ellipse(p.x + w * .1, p.y - h * .55, w * .17, 2.2 * z, .1, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = season === Season.Winter ? '#dce2ce' : '#bd9d66'; ctx.beginPath(); ctx.ellipse(p.x, p.y - h + 2 * z, w / 2, 1.6 * z, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#59704799'; ctx.fillRect(p.x - w * .4, p.y - 2 * z, w * .8, 2 * z);
  }
  private rail(ctx: CanvasRenderingContext2D, a: Point, b: Point, height: number): void {
    const z = this.camera.zoom;
    ctx.strokeStyle = '#5d4b33'; ctx.lineWidth = 4 * z; ctx.beginPath(); ctx.moveTo(a.x, a.y - height * z); ctx.lineTo(b.x, b.y - height * z); ctx.stroke();
    ctx.strokeStyle = '#c3a372'; ctx.lineWidth = 1.4 * z; ctx.beginPath(); ctx.moveTo(a.x, a.y - (height + 1) * z); ctx.lineTo(b.x, b.y - (height + 1) * z); ctx.stroke();
  }
  private gateLeaf(ctx: CanvasRenderingContext2D, a: Point, b: Point, season: Season): void {
    const z = this.camera.zoom;
    for (let i = 1; i <= 4; i++) {
      const t = i / 4; this.log(ctx, { x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t }, 27 + i % 2, 5.7, i, season);
    }
    this.rail(ctx, a, b, 8); this.rail(ctx, a, b, 23);
    ctx.strokeStyle = '#6f6f51'; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.moveTo(a.x, a.y - 8 * z); ctx.lineTo(b.x, b.y - 23 * z); ctx.stroke();
  }
}
