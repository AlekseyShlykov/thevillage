import { Camera } from '../core/Camera';
import { TileMap } from '../world/TileMap';
import { queuedForestTiles } from '../world/ForestClearingQueue';
import { BuildingConfig, BuildingInstance, VillagerData, EnemyData, Season, WeatherEvent, Position, HealthState } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { AssetLoader } from './AssetLoader';
import { IsometricArt, footprint, polygon, hash } from './IsometricArt';
import { GroundArt } from './GroundArt';
import { VillagerArt, actionPhase, isWorking } from './VillagerArt';
import { villagerActivity } from '../game/VillagerOrders';
import { cropStageName } from './CropArt';
import { ProjectileArt } from './ProjectileArt';
import { TowerShot } from '../systems/TowerCombatSystem';
import { protectionZones } from '../systems/ProtectionSystem';

interface SceneItem { depth: number; draw: () => void }
/** Depth-sorted 2.5D Canvas renderer. All picking uses the same projection as drawing. */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private art: IsometricArt;
  private groundArt: GroundArt;
  private villagerArt: VillagerArt;
  private projectileArt: ProjectileArt;
  private hiddenVillagers = new Set<string>();
  private lastFrameTime = performance.now();
  private dpr = 1;
  private terrain = document.createElement('canvas');
  private terrainKey = '';
  private time = 0;
  constructor(private canvas: HTMLCanvasElement, private camera: Camera, private assets: AssetLoader) {
    this.ctx = canvas.getContext('2d')!; this.art = new IsometricArt(camera, assets);
    this.groundArt = new GroundArt(camera); this.villagerArt = new VillagerArt(camera, assets); this.projectileArt=new ProjectileArt(camera,assets);
  }
  resize(): void {
    const center = this.camera.screenToWorld(this.camera.viewportWidth / 2, this.camera.viewportHeight / 2);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.canvas.clientWidth * this.dpr); this.canvas.height = Math.round(this.canvas.clientHeight * this.dpr);
    this.camera.viewportWidth = this.canvas.clientWidth; this.camera.viewportHeight = this.canvas.clientHeight;
    this.camera.centerOn(center.x, center.y);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.ctx.imageSmoothingEnabled = false; this.terrainKey = '';
  }
  private point(x: number, y: number) { const ts = getConfig().map.tileSize; return this.camera.worldToScreen(x * ts, y * ts); }
  private visible(x: number, y: number, padding = 170): boolean { return x > -padding && y > -padding && x < this.camera.viewportWidth + padding && y < this.camera.viewportHeight + padding; }
  private bounds(map: TileMap) {
    const ts = getConfig().map.tileSize, w = this.camera.viewportWidth, h = this.camera.viewportHeight;
    const points = [[-150, -150], [w + 150, -150], [w + 150, h + 240], [-150, h + 240]].map(([x, y]) => this.camera.screenToWorld(x, y));
    return { x0: Math.max(0, Math.floor(Math.min(...points.map(p => p.x / ts)))), y0: Math.max(0, Math.floor(Math.min(...points.map(p => p.y / ts)))), x1: Math.min(map.width - 1, Math.ceil(Math.max(...points.map(p => p.x / ts)))), y1: Math.min(map.height - 1, Math.ceil(Math.max(...points.map(p => p.y / ts)))) };
  }
  renderWorld(map: TileMap, season: Season, buildings: BuildingInstance[], configs: Record<string, BuildingConfig>, villagers: VillagerData[], enemies: EnemyData[], selected: string | null, hover: { mouseX: number; mouseY: number; tileX: number; tileY: number }, weather: WeatherEvent | null, paused: boolean, herbs=0, shots:TowerShot[]=[]): void {
    const ctx = this.ctx, w = this.camera.viewportWidth, h = this.camera.viewportHeight;
    const now = performance.now();
    if (!paused) this.time += Math.min(.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const bounds = this.bounds(map);
    this.renderGround(map, season, bounds);
    this.groundArt.breeze(ctx, map, season, bounds, this.time);
    for (const field of protectionZones(buildings, configs)) {
      const r = field.radius, pts = footprint(this.camera, field.x - r, field.y - r, r * 2 + 1, r * 2 + 1);
      polygon(ctx, pts, 'rgba(183,204,135,.055)', 'rgba(202,217,158,.45)');
    }
    const chosen = villagers.find(v => v.id === selected);
    if (chosen?.path.length) {
      ctx.strokeStyle = '#efcf8f'; ctx.lineWidth = 2; ctx.setLineDash([3, 6]); ctx.beginPath();
      const p = this.point(chosen.x + .5, chosen.y + .5); ctx.moveTo(p.x, p.y);
      for (const step of chosen.path) { const q = this.point(step.x + .5, step.y + .5); ctx.lineTo(q.x, q.y); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (chosen && chosen.targetX !== null && chosen.targetY !== null && (chosen.path.length || chosen.currentTask)) {
      const destination = this.point(chosen.targetX + .5, chosen.targetY + .5);
      ctx.strokeStyle = '#efd391'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(destination.x, destination.y, 12 * this.camera.zoom, 6 * this.camera.zoom, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const scene: SceneItem[] = [];
    const clearingQueue=new Map(queuedForestTiles(map).map((p,i)=>[`${p.x},${p.y}`,i+1]));
    const active = villagers.filter(v => v.health !== HealthState.Dead);
    const choppers = new Map(active.filter(v => v.currentTask === 'clearing' && isWorking(v)).map(v => [`${v.targetX},${v.targetY}`, v]));
    const shelterIds = new Set(buildings.filter(b => b.built && ['hut', 'house', 'largeHouse', 'campFire', 'watchtower'].includes(b.configId)).map(b => b.id));
    for (let y = bounds.y0; y <= bounds.y1; y++) for (let x = bounds.x0; x <= bounds.x1; x++) {
      const tile = map.getTile(x, y)!; if (tile.type !== 'forest') continue;
      const p = this.point(x + .5, y + .5); if (!this.visible(p.x, p.y)) continue;
      if (hash(x, y) % 13 === 0 && !tile.markedForClearing) continue;
      const nearWorker = active.some(v => Math.hypot(v.x - x, v.y - y) < 1.6);
      const nearCursor = Math.hypot(hover.tileX - x, hover.tileY - y) < 1;
      const chopper = choppers.get(`${x},${y}`);
      const shake = chopper ? Math.max(0, Math.sin(actionPhase(chopper, this.time) * Math.PI * 2)) * 1.8 : 0;
      scene.push({ depth: p.y, draw: () => this.art.tree(ctx, x, y, season, nearWorker || nearCursor || tile.markedForClearing ? .4 : 1, shake) });
      if (tile.markedForClearing) {
        polygon(ctx, footprint(this.camera, x, y), 'rgba(231,187,100,.16)', '#e7bb64');
        const order=clearingQueue.get(`${x},${y}`);
        if(order)scene.push({depth:p.y+.1,draw:()=>this.label(p.x,p.y-8,`#${order}`)});
        if (tile.clearingProgress > 0) this.bar(p.x, p.y + 7, 34, tile.clearingProgress, '#ebcc83');
      }
    }
    const hovered = this.pickBuilding(hover.mouseX, hover.mouseY, buildings, configs);
    for (const b of buildings) {
      const cfg = configs[b.configId]; if (!cfg) continue;
      const box = this.art.buildingBounds(b, cfg); if (!this.visible(box.centerX, box.baseline, box.height)) continue;
      const occupied = active.filter(v => map.getTile(Math.floor(v.x), Math.floor(v.y))?.buildingId === b.id).length;
      const depth=b.configId==='garden'?Math.min(...box.pts.map(p=>p.y))-this.camera.tileHeight*.4:box.baseline-this.camera.tileHeight*(b.configId==='moat'?2:.4);
      scene.push({ depth, draw: () => {
        if (hovered?.id === b.id) polygon(ctx, box.pts, 'rgba(237,211,151,.16)', '#edcf8e');
        this.art.building(ctx, b, cfg, season, this.time, buildings, occupied);
        if (!b.built) { this.bar(box.centerX, box.baseline + 7, 66, b.buildProgress, '#e8c781'); this.label(box.centerX, box.y - 3, `${cfg.name} · ${Math.round(b.buildProgress * 100)}%`); }
        else if (b.configId==='garden' && b.cropState==='ripe') this.label(box.centerX,box.y+8,`Harvest ready · ${Math.ceil(b.harvestRemaining??getConfig().farming.harvestFood)} food`);
        else if (hovered?.id === b.id) this.label(box.centerX, box.y + 8, `${cfg.name}${b.configId === 'garden' ? ` · ${b.cropState==='growing'?cropStageName(b.farmingProgress ?? 0):'Ready to sow'}` : cfg.maxWorkers ? ` · ${b.assignedWorkers.length}/${cfg.maxWorkers}` : cfg.protectionRadius ? ` · ${cfg.protectionRadius} tile ward` : ''}`);
        if (b.built && cfg.maxWorkers && b.configId !== 'garden' && hovered?.id !== b.id) this.label(box.centerX, box.baseline - 8, `${cfg.name} · ${b.assignedWorkers.length}/${cfg.maxWorkers}`, true);
        if(b.built && b.configId==='herbalFire')this.label(box.centerX,box.baseline+18,`Herbs ${herbs}/${getConfig().herbs.perWinter} for winter`,true);
        if (occupied && shelterIds.has(b.id)) this.label(box.centerX, box.baseline - 8, `${occupied} sheltered`, true);
        if (b.built && b.configId === 'garden' && b.farmingProgress !== undefined) this.bar(box.centerX, box.baseline + 3, 64, b.farmingProgress, '#a8bc74');
        if (b.hp < b.maxHp) this.bar(box.centerX, box.y + 2, 54, b.hp / b.maxHp, '#da8a6b');
      } });
    }
    this.hiddenVillagers.clear();
    for (const v of active) {
      if (shelterIds.has(map.getTile(Math.floor(v.x), Math.floor(v.y))?.buildingId ?? '')) { this.hiddenVillagers.add(v.id); this.villagerArt.hide(v.id); continue; }
      const p = this.point(v.x + .5, v.y + .5); if (!this.visible(p.x, p.y)) continue;
      scene.push({ depth: p.y, draw: () => this.villager(v, v.id === selected, season, buildings.find(b => b.id === v.assignedBuildingId)) });
    }
    for (const e of enemies) {
      if (e.state === 'dead') continue; const p = this.point(e.x + .5, e.y + .5); if (!this.visible(p.x, p.y)) continue;
      scene.push({ depth: p.y, draw: () => this.enemy(e) });
    }
    scene.sort((a, b) => a.depth - b.depth).forEach(item => item.draw());
    for(const shot of shots)this.projectileArt.draw(ctx,shot);
    if (season === Season.Winter) this.winterLight(buildings, configs);
    this.renderWeather(weather);
    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .25, w / 2, h / 2, Math.max(w, h) * .72);
    vignette.addColorStop(0, 'rgba(15,29,24,0)'); vignette.addColorStop(1, 'rgba(15,29,24,.32)'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
  }
  private renderGround(map: TileMap, season: Season, bounds: ReturnType<Renderer['bounds']>): void {
    const key = [this.camera.x, this.camera.y, this.camera.zoom, this.canvas.width, this.canvas.height, season, map.revision].join(':');
    if (this.terrainKey !== key) {
      this.terrain.width = this.canvas.width; this.terrain.height = this.canvas.height;
      const ctx = this.terrain.getContext('2d')!; ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.groundArt.draw(ctx, map, season, bounds);
      this.terrainKey = key;
    }
    this.ctx.drawImage(this.terrain, 0, 0, this.camera.viewportWidth, this.camera.viewportHeight);
  }
  private villager(v: VillagerData, selected: boolean, season: Season, building?: BuildingInstance): void {
    this.villagerArt.draw(this.ctx, v, season, this.time, selected, building);
    const p = this.point(v.x + .5, v.y + .5), z = this.camera.zoom;
    if (selected) this.label(p.x, p.y + 20 * z, villagerActivity(v), true);
    if (v.hp < v.maxHp) this.bar(p.x, p.y - 49 * z, 30, v.hp / v.maxHp, '#e4a078');
  }
  private enemy(e: EnemyData): void {
    const ctx = this.ctx, p = this.point(e.x + .5, e.y + .5), z = this.camera.zoom;
    const sprite = this.assets.getEnemy(e.visible ? (e.state === 'attacking' ? 'attack' : `walk_${Math.floor(this.time * 3) % 2 + 1}`) : 'eyes');
    if (sprite) ctx.drawImage(sprite, p.x - 25 * z, p.y - 38 * z, 50 * z, 50 * z);
    else { ctx.fillStyle = '#e8895b'; ctx.fillRect(p.x - 5, p.y - 10, 3, 3); ctx.fillRect(p.x + 3, p.y - 10, 3, 3); }
    if (e.hp < e.maxHp && e.visible) this.bar(p.x, p.y - 42 * z, 32, e.hp / e.maxHp, '#d98972');
  }
  private bar(x: number, y: number, width: number, progress: number, color: string): void {
    const ctx = this.ctx; ctx.fillStyle = 'rgba(23,34,29,.8)'; ctx.fillRect(x - width / 2 - 1, y - 1, width + 2, 5);
    ctx.fillStyle = color; ctx.fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, progress)), 3);
  }
  private label(x: number, y: number, text: string, small = false): void {
    const ctx = this.ctx; ctx.font = `${small ? 10 : 11}px "PT Sans", sans-serif`; ctx.textAlign = 'center';
    const width = ctx.measureText(text).width + 14; ctx.fillStyle = 'rgba(28,40,33,.9)'; ctx.fillRect(x - width / 2, y - 11, width, 18);
    ctx.fillStyle = '#ecdfc2'; ctx.fillText(text, x, y + 1);
  }
  private winterLight(buildings: BuildingInstance[], configs: Record<string, BuildingConfig>): void {
    const ctx = this.ctx; ctx.fillStyle = 'rgba(23,39,65,.24)'; ctx.fillRect(0, 0, this.camera.viewportWidth, this.camera.viewportHeight);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const b of buildings) {
      const cfg = configs[b.configId]; if (!b.built || !cfg || (!cfg.lightRadius && cfg.category !== 'housing')) continue;
      const p = this.point(b.tileX + cfg.width / 2, b.tileY + cfg.height / 2), radius = (cfg.lightRadius ?? 2) * this.camera.tileWidth * .62;
      const grad = ctx.createRadialGradient(p.x, p.y - 20, 0, p.x, p.y - 20, radius); grad.addColorStop(0, 'rgba(250,179,82,.28)'); grad.addColorStop(1, 'rgba(250,179,82,0)');
      ctx.fillStyle = grad; ctx.fillRect(p.x - radius, p.y - radius - 20, radius * 2, radius * 2);
    }
    ctx.restore();
  }
  private renderWeather(weather: WeatherEvent | null): void {
    if (!weather) return; const ctx = this.ctx, w = this.camera.viewportWidth, h = this.camera.viewportHeight;
    if (weather.type === 'snowstorm') {
      ctx.fillStyle = `rgba(231,239,238,${weather.intensity * .1})`; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(248,250,241,.75)';
      for (let i = 0; i < 90; i++) { const n = hash(i, 10); const x = (n % 1000 / 1000 * w + this.time * (15 + i % 25)) % w, y = ((n >> 10) % 1000 / 1000 * h + this.time * (20 + i % 30)) % h; ctx.fillRect(x, y, 2, 2); }
    } else if (weather.type === 'fog') { ctx.fillStyle = `rgba(204,214,206,${weather.intensity * .22})`; ctx.fillRect(0, 0, w, h); }
    else { ctx.strokeStyle = 'rgba(225,233,214,.18)'; for (let i = 0; i < 14; i++) { const x = (i * 137 + this.time * 95) % w, y = (i * 89) % h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 22, y - 4); ctx.stroke(); } }
  }
  renderBuildPreview(tx: number, ty: number, w: number, h: number, valid: boolean): void {
    polygon(this.ctx, footprint(this.camera, tx, ty, w, h), valid ? 'rgba(177,209,145,.3)' : 'rgba(221,132,107,.3)', valid ? '#d6e9ad' : '#e9a486');
  }
  renderProtectionPreview(tx: number, ty: number, radius: number, valid: boolean): void {
    polygon(this.ctx, footprint(this.camera, tx-radius, ty-radius, radius*2+1, radius*2+1),
      valid ? 'rgba(183,204,135,.08)' : 'rgba(221,132,107,.06)', valid ? '#d3dda3' : '#cf9a7b');
  }
  renderPalisadePreview(tiles: Position[], map: TileMap): void { for (const p of tiles) this.renderBuildPreview(p.x, p.y, 1, 1, map.isBuildable(p.x, p.y)); }
  renderSelectionBox(x: number, y: number): void { if (x >= 0 && y >= 0) polygon(this.ctx, footprint(this.camera, x, y), 'rgba(245,223,167,.06)', 'rgba(245,223,167,.45)'); }
  pickVillager(sx: number, sy: number, villagers: VillagerData[], _map: TileMap): VillagerData | null {
    return villagers.filter(v => v.health !== HealthState.Dead && !this.hiddenVillagers.has(v.id)).sort((a, b) => b.x + b.y - a.x - a.y).find(v => {
      const p = this.point(v.x + .5, v.y + .5), z = this.camera.zoom; return Math.abs(sx - p.x) < 20 * z && sy < p.y + 8 * z && sy > p.y - 39 * z;
    }) ?? null;
  }
  pickBuilding(sx: number, sy: number, buildings: BuildingInstance[], configs: Record<string, BuildingConfig>): BuildingInstance | null {
    const tile = this.camera.screenToTile(sx, sy);
    return buildings.slice().sort((a, b) => b.tileX + b.tileY + configs[b.configId].width + configs[b.configId].height - a.tileX - a.tileY - configs[a.configId].width - configs[a.configId].height).find(b => {
      const cfg = configs[b.configId]; if (!cfg) return false;
      if (tile.tx >= b.tileX && tile.tx < b.tileX + cfg.width && tile.ty >= b.tileY && tile.ty < b.tileY + cfg.height) return true;
      if (cfg.category === 'defense' || b.configId === 'garden' || cfg.width === 1) return false;
      const box = this.art.buildingBounds(b, cfg);
      return sx > box.x + box.width * .15 && sx < box.x + box.width * .85 && sy > box.y + box.height * .24 && sy < box.baseline;
    }) ?? null;
  }
}
