import { AssetLoader } from './AssetLoader';

/** Generated stone hearth with seven flame poses; construction uses the unlit pose. */
export class WardFireArt {
  constructor(private assets: AssetLoader) {}
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, time: number, burning: boolean): boolean {
    const atlas = this.assets.getWardAtlas();
    if (!atlas) return false;
    if (burning) {
      const radius = 58 * zoom, glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, `rgba(241,190,89,${.14 + Math.sin(time * 5) * .025})`);
      glow.addColorStop(1, 'rgba(196,204,132,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    const frame = burning ? 1 + Math.floor(time * 7) % 7 : 0;
    const cw = atlas.width / 4, ch = atlas.height / 2, size = 98 * zoom;
    ctx.drawImage(atlas, frame % 4 * cw, Math.floor(frame / 4) * ch, cw, ch,
      x - size / 2, y + 17 * zoom - size * .94, size, size);
    return true;
  }
}
