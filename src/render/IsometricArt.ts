import { Camera } from '../core/Camera';
import { AssetLoader } from './AssetLoader';
import { BuildingConfig, BuildingInstance, Season } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { FenceArt } from './FenceArt';
import { CropArt } from './CropArt';
import { chimneySmoke } from './BuildingEffects';
import { MoatArt } from './MoatArt';
import { WardFireArt } from './WardFireArt';

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
  private fences: FenceArt;
  private crops: CropArt;
  private ward: WardFireArt;
  private moats: MoatArt;
  constructor(private camera: Camera, private assets: AssetLoader) {
    this.fences = new FenceArt(camera); this.crops = new CropArt(camera, assets); this.ward = new WardFireArt(assets);this.moats=new MoatArt(camera,assets);
  }
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
    if(b.configId==='watchtower') {const w=118*this.camera.zoom,h=172*this.camera.zoom;return {x:centerX-w/2,y:baseline-h,width:w,height:h,centerX,baseline,pts};}
    return { x: centerX - size / 2, y: baseline - size * .92, width: size, height: size, centerX, baseline, pts };
  }
  building(ctx: CanvasRenderingContext2D, b: BuildingInstance, cfg: BuildingConfig, season: Season, time: number, buildings: BuildingInstance[] = [], occupants = 0): void {
    const { centerX: x, baseline: y, width: size, pts } = this.buildingBounds(b, cfg), z = this.camera.zoom;
    ctx.save();
    if (!b.built) { ctx.globalAlpha = .45 + b.buildProgress * .4; polygon(ctx, pts, 'rgba(181,142,79,.16)', '#e4bf75'); }
    if (b.configId === 'garden') this.crops.draw(ctx, b, cfg, season, time);
    else if(b.configId==='moat')this.moats.draw(ctx,b,buildings,season);
    else if(b.configId==='watchtower') {
      const tower=this.assets.getTower?.(),h=this.buildingBounds(b,cfg).height;
      if(tower) {ctx.imageSmoothingEnabled=true;ctx.drawImage(tower,x-size/2,y-h,size,h);}
      else {
        ctx.fillStyle='#79563d';ctx.fillRect(x-size*.28,y-h*.75,size*.56,h*.75);
        ctx.fillStyle='#a98150';ctx.fillRect(x-size*.4,y-h*.72,size*.8,h*.13);
        polygon(ctx,[{x:x-size*.5,y:y-h*.78},{x,y:y-h},{x:x+size*.5,y:y-h*.78}],'#bda568','#69533c');
        ctx.fillStyle='#302f24';ctx.fillRect(x-size*.12,y-h*.7,size*.24,h*.12);
      }
    }
    else if (b.configId==='furWorkshop') {
      const workshop=this.assets.getFurWorkshop?.(season);
      if(workshop) {ctx.imageSmoothingEnabled=true;ctx.drawImage(workshop,x-size/2,y-size*.9,size,size);}
      else {
        // A recognisable open work bay remains available when the painted asset is missing.
        polygon(ctx,[pts[0],pts[1],pts[2],pts[3]],'#826345');
        for(const p of [pts[1],pts[2],pts[3]]) {ctx.fillStyle='#735037';ctx.fillRect(p.x-3*z,p.y-38*z,6*z,38*z);}
        polygon(ctx,pts.map(p=>({x:p.x,y:p.y-40*z})),season===Season.Winter?'#e5ebdf':'#987549','#523d2d');
        ctx.fillStyle='#ccad7a';ctx.fillRect(x-12*z,y-21*z,24*z,8*z);
      }
    }
    else if (cfg.category === 'defense') this.fences.draw(ctx, b, buildings, season);
    else if (b.configId === 'campFire' || b.configId === 'herbalFire') {
      const py = (pts[0].y + pts[2].y) / 2;
      const burning = b.built && (b.configId !== 'herbalFire' || !!b.wardActive);
      if (b.configId !== 'herbalFire' || !this.ward.draw(ctx, x, py, z, time, burning)) this.fire(ctx, x, py, z, time, b.configId === 'herbalFire', burning);
    }
    else {
      const index = b.configId === 'storage' ? 4 : b.configId === 'lumberCamp' ? 5 : 3;
      if (!this.sprite(ctx, index, x, y, size, season)) {
        const raised = pts.map(p => ({ x: p.x, y: p.y - 32 * z }));
        polygon(ctx, [pts[1], pts[2], raised[2], raised[1]], '#6c4932', '#453a29');
        polygon(ctx, [pts[2], pts[3], raised[3], raised[2]], '#96724c', '#453a29');
        polygon(ctx, raised, '#b99a55', '#6c5533');
      }
      if (b.built && cfg.category === 'housing' && occupants > 0) chimneySmoke(ctx, x, y, size, time);
    }
    ctx.restore();
  }
  private fire(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, t: number, herbal = false, burning = true): void {
    ctx.save();
    const glow = ctx.createRadialGradient(x, y, 1, x, y, 55 * z); glow.addColorStop(0, 'rgba(255,192,87,.2)'); glow.addColorStop(1, 'rgba(255,192,87,0)');
    if (burning) { ctx.fillStyle = glow; ctx.fillRect(x - 55 * z, y - 55 * z, 110 * z, 110 * z); }
    ctx.strokeStyle = '#614631'; ctx.lineWidth = 6 * z; ctx.beginPath(); ctx.moveTo(x - 13 * z, y + 4 * z); ctx.lineTo(x + 13 * z, y - 4 * z); ctx.moveTo(x - 13 * z, y - 4 * z); ctx.lineTo(x + 13 * z, y + 4 * z); ctx.stroke();
    if (herbal) {
      ctx.fillStyle = '#7d8870'; ctx.strokeStyle = '#4b5947'; ctx.lineWidth = z;
      ctx.beginPath(); ctx.ellipse(x,y+3*z,19*z,9*z,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#303f31'; ctx.beginPath(); ctx.ellipse(x,y-1*z,16*z,6*z,0,0,Math.PI*2); ctx.fill();
      for (let i=0;i<6;i++) {
        const angle=i/6*Math.PI*2,px=x+Math.cos(angle)*18*z,py=y+Math.sin(angle)*7*z;
        ctx.fillStyle=i%2?'#a6ad8a':'#859177';ctx.beginPath();ctx.ellipse(px,py,4*z,3*z,angle,0,Math.PI*2);ctx.fill();
      }
      for (let i=0;i<5;i++) {
        ctx.fillStyle=i%2?'#b3bc83':'#71966a';ctx.beginPath();ctx.ellipse(x+(i-2)*4*z,y-4*z,3*z,8*z,(i-2)*.35,0,Math.PI*2);ctx.fill();
      }
      for (let i=0;burning && i<4;i++) {
        const age=(t*.23+i/4)%1;ctx.globalAlpha=(1-age)*.35;ctx.fillStyle='#c5d3a2';
        ctx.beginPath();ctx.arc(x+Math.sin(age*4+i)*9*z,y-(18+age*35)*z,(2+age*3)*z,0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha=1;
    }
    if (!burning) { ctx.restore(); return; }
    const flicker = Math.sin(t * 8) * 3;
    polygon(ctx, [{ x: x - 10 * z, y }, { x: x - 4 * z, y: y - 15 * z }, { x: x + 2 * z, y: y - (27 + flicker) * z }, { x: x + 10 * z, y }], '#ed943e');
    polygon(ctx, [{ x: x - 5 * z, y }, { x: x + 2 * z, y: y - 17 * z }, { x: x + 6 * z, y }], '#f7d984');
    ctx.restore();
  }
}
