import { VillagerData, VillagerState, HealthState, Position, BuildingInstance, TileType } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { TileMap } from '../world/TileMap';
import { findPath } from '../utils/Pathfinding';

let nextVillagerId = 1;
const key = (x: number, y: number) => `${Math.floor(x)},${Math.floor(y)}`;

/** Explicit orders persist until completion. Idle is a valid state, not a deadlock. */
export class VillagerSystem {
  public villagers: VillagerData[] = [];
  public openGateIds = new Set<string>();
  public unbuiltPalisadeIds = new Set<string>();
  private shelterTiles = new Set<string>();
  private onVillagerDeath: (() => void) | null = null;
  constructor(private tileMap: TileMap) {}
  setOnVillagerDeath(callback: () => void): void { this.onVillagerDeath = callback; }
  private walkable(x: number, y: number): boolean {
    return this.shelterTiles.has(key(x, y)) || this.tileMap.isWalkable(x, y, this.openGateIds, this.unbuiltPalisadeIds);
  }
  setShelters(tiles: Position[]): void { this.shelterTiles = new Set(tiles.map(t => key(t.x, t.y))); }
  spawnVillager(x: number, y: number): VillagerData {
    const v: VillagerData = { id: `v_${nextVillagerId++}`, x, y, state: VillagerState.Idle, health: HealthState.Healthy,
      hp: getConfig().villagers.maxHP, maxHp: getConfig().villagers.maxHP, targetX: null, targetY: null, path: [], assignedBuildingId: null, currentTask: null, taskProgress: 0 };
    this.villagers.push(v); return v;
  }
  spawnInitialVillagers(cx: number, cy: number, count: number): void {
    const tiles: Position[] = [];
    for (let r = 1; tiles.length < count && r < this.tileMap.width; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !this.tileMap.isWalkable(cx + dx, cy + dy)) continue;
        tiles.push({ x: cx + dx, y: cy + dy });
      }
    }
    tiles.slice(0, count).forEach(p => this.spawnVillager(p.x, p.y));
  }
  reset(): void { this.villagers = []; this.shelterTiles.clear(); nextVillagerId = 1; }
  getAliveVillagers(): VillagerData[] { return this.villagers.filter(v => v.health !== HealthState.Dead); }
  getAliveCount(): number { return this.villagers.reduce((n, v) => n + Number(v.health !== HealthState.Dead), 0); }
  getVillagerById(id: string): VillagerData | null { return this.villagers.find(v => v.id === id) ?? null; }
  getVillagerAt(tx: number, ty: number): VillagerData | null { return this.getAliveVillagers().find(v => key(v.x, v.y) === key(tx, ty)) ?? null; }
  findClosestIdleVillager(x: number, y: number): VillagerData | null {
    return this.getAliveVillagers().filter(v => v.state === VillagerState.Idle && !v.currentTask && !v.assignedBuildingId && !v.holdPosition)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0] ?? null;
  }
  isTileAlreadyBeingClearedByOther(id: string, x: number, y: number): boolean {
    return this.villagers.some(v => v.id !== id && v.health !== HealthState.Dead && v.currentTask === 'clearing' && v.targetX === x && v.targetY === y);
  }
  assignPath(v: VillagerData, gx: number, gy: number): boolean {
    if (!this.walkable(gx, gy)) return false;
    const path = findPath(Math.floor(v.x), Math.floor(v.y), gx, gy, (x, y) => this.walkable(x, y), this.tileMap.width, this.tileMap.height);
    if (!path.length) return false;
    path.shift(); v.path = path; v.targetX = gx; v.targetY = gy; v.stuckTimer = 0;
    v.holdPosition = false;
    v.state = path.length ? VillagerState.Moving : VillagerState.Idle;
    return true;
  }
  sendVillagerToTile(id: string, x: number, y: number): boolean {
    const v = this.getVillagerById(id); if (!v || v.health === HealthState.Dead || !this.assignPath(v, x, y)) return false;
    v.currentTask = null; v.holdPosition = true; return true;
  }
  sendVillagerToChop(id: string, x: number, y: number): boolean {
    const v = this.getVillagerById(id), tile = this.tileMap.getTile(x, y);
    if (!v || !tile || v.health === HealthState.Dead || tile.type !== TileType.Forest || this.isTileAlreadyBeingClearedByOther(id, x, y)) return false;
    if (!this.assignPath(v, x, y)) return false;
    tile.markedForClearing = true; v.currentTask = 'clearing'; return true;
  }
  sendVillagerToHunt(id: string, target?: Position): boolean {
    const v = this.getVillagerById(id); if (!v || v.health === HealthState.Dead || (!target && v.currentTask === 'hunting')) return false;
    if (target) {
      if (this.tileMap.getTile(target.x, target.y)?.type !== TileType.Forest || this.villagers.some(o => o.id !== id && o.health !== HealthState.Dead && o.currentTask === 'hunting' && o.targetX === target.x && o.targetY === target.y)) return false;
      if (!this.assignPath(v, target.x, target.y)) return false;
      v.currentTask = 'hunting'; v.taskProgress = 0; return true;
    }
    const cfg = getConfig().villagers, candidates: Position[] = [];
    const radius = cfg.huntMaxDistance;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const distance = Math.hypot(dx, dy), x = Math.floor(v.x) + dx, y = Math.floor(v.y) + dy;
      if (distance < cfg.huntMinDistance || distance > radius || this.tileMap.getTile(x, y)?.type !== TileType.Forest) continue;
      if (this.villagers.some(o => o.id !== id && o.currentTask === 'hunting' && o.targetX === x && o.targetY === y)) continue;
      candidates.push({ x, y });
    }
    candidates.sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y));
    for (const p of candidates) if (this.assignPath(v, p.x, p.y)) { v.currentTask = 'hunting'; v.taskProgress = 0; return true; }
    return false;
  }
  assignVillagerToBuilding(id: string, buildingId: string, buildings: BuildingInstance[]): boolean {
    const v = this.getVillagerById(id), b = buildings.find(b => b.id === buildingId);
    if (!v || v.health === HealthState.Dead || !b?.built) return false;
    const cfg = getConfig().buildings[b.configId];
    b.assignedWorkers = b.assignedWorkers.filter(id => this.getVillagerById(id)?.health !== HealthState.Dead);
    if (b.assignedWorkers.includes(id)) return true;
    if (b.assignedWorkers.length >= cfg.maxWorkers || cfg.maxWorkers === 0) return false;
    const tiles: Position[] = [];
    for (let dx = 0; dx < cfg.width; dx++) tiles.push({ x: b.tileX + dx, y: b.tileY + cfg.height }, { x: b.tileX + dx, y: b.tileY - 1 });
    for (let dy = 0; dy < cfg.height; dy++) tiles.push({ x: b.tileX - 1, y: b.tileY + dy }, { x: b.tileX + cfg.width, y: b.tileY + dy });
    tiles.sort((a, c) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(c.x - v.x, c.y - v.y));
    for (const t of tiles) {
      if (this.villagers.some(o => o.id !== id && o.health !== HealthState.Dead && ((Math.floor(o.x) === t.x && Math.floor(o.y) === t.y) || (o.assignedBuildingId === buildingId && o.targetX === t.x && o.targetY === t.y)))) continue;
      if (!this.assignPath(v, t.x, t.y)) continue;
      for (const old of buildings) old.assignedWorkers = old.assignedWorkers.filter(i => i !== id);
      b.assignedWorkers.push(id); v.assignedBuildingId = buildingId;
      v.currentTask = b.configId === 'garden' ? 'farming' : 'working'; v.taskProgress = 0;
      return true;
    }
    return false;
  }
  sendVillagerToHousing(id: string, x: number, y: number): boolean {
    const v = this.getVillagerById(id); if (!v || v.health === HealthState.Dead || !this.assignPath(v, x, y)) return false;
    v.currentTask = 'returnHome'; v.assignedBuildingId = null; return true;
  }
  assignAllReturnHome(tiles: Position[]): number {
    this.setShelters(tiles); if (!tiles.length) return 0;
    const available = [...tiles]; let assigned = 0;
    for (const v of this.getAliveVillagers()) {
      const choices = (available.length ? available : tiles).slice().sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y));
      for (const p of choices) if (this.sendVillagerToHousing(v.id, p.x, p.y)) {
        const index = available.indexOf(p); if (index >= 0) available.splice(index, 1); assigned++; break;
      }
    }
    return assigned;
  }
  update(dt: number, buildings: BuildingInstance[], isWinter: boolean, housingTiles: Position[], stayInShelterMode = false): void {
    this.setShelters(housingTiles);
    const cfg = getConfig().villagers;
    const occupied = new Map<string, string>();
    for (const v of this.getAliveVillagers()) occupied.set(key(v.x, v.y), v.id);
    for (const v of this.villagers) {
      if (v.health === HealthState.Dead) continue;
      // Combat is a temporary animation/state, not a permanent job replacement.
      if (v.state === VillagerState.Defending) v.state = v.path.length ? VillagerState.Moving : v.currentTask ? VillagerState.Working : VillagerState.Idle;
      const inside = this.shelterTiles.has(key(v.x, v.y));
      if (v.assignedBuildingId && !buildings.some(b => b.id === v.assignedBuildingId)) {
        v.assignedBuildingId = null; v.currentTask = null; v.path = []; v.state = VillagerState.Idle;
      }
      if (v.state === VillagerState.Moving && !v.path.length && v.targetX !== null && v.targetY !== null) this.assignPath(v, v.targetX, v.targetY);
      if (v.path.length) {
        const next = v.path[0], nextKey = key(next.x, next.y), oldKey = key(v.x, v.y);
        const blocked = !this.shelterTiles.has(nextKey) && occupied.has(nextKey) && occupied.get(nextKey) !== v.id;
        if (blocked) {
          v.stuckTimer = (v.stuckTimer ?? 0) + dt;
          if (v.stuckTimer >= cfg.stuckRepathSeconds && v.targetX !== null && v.targetY !== null) {
            const path = findPath(Math.floor(v.x), Math.floor(v.y), v.targetX, v.targetY,
              (x, y) => this.walkable(x, y) && (!occupied.has(key(x, y)) || occupied.get(key(x, y)) === v.id || this.shelterTiles.has(key(x, y))), this.tileMap.width, this.tileMap.height);
            if (path.length > 1) { path.shift(); v.path = path; }
            v.stuckTimer = 0;
          }
        } else {
          const dx = next.x - v.x, dy = next.y - v.y, distance = Math.hypot(dx, dy);
          const step = Math.min(cfg.moveSpeed * dt, distance);
          if (distance > 0) { v.x += dx / distance * step; v.y += dy / distance * step; }
          if (step >= distance) { v.x = next.x; v.y = next.y; v.path.shift(); }
          if (occupied.get(oldKey) === v.id) occupied.delete(oldKey);
          occupied.set(key(v.x, v.y), v.id); v.stuckTimer = 0;
        }
      }
      if (!v.path.length && (v.state === VillagerState.Moving || v.state === VillagerState.Idle)) {
        if (v.currentTask === 'returnHome') { v.currentTask = null; v.state = VillagerState.Idle; }
        else if (v.currentTask === 'building') v.state = VillagerState.Building;
        else if (v.currentTask) v.state = VillagerState.Working;
        else v.state = VillagerState.Idle;
      }
      if (stayInShelterMode && inside) { v.path = []; v.currentTask = null; v.state = VillagerState.Idle; }
      v.timeOutsideInWinter = isWinter && !inside ? (v.timeOutsideInWinter ?? 0) + dt : 0;
      if (v.health === HealthState.Injured) {
        v.hp = Math.min(v.maxHp, v.hp + cfg.healRate * dt);
        if (v.hp >= v.maxHp / 2) { v.health = HealthState.Healthy; if (v.state === VillagerState.Injured) v.state = VillagerState.Idle; }
      }
    }
  }
  damageVillager(v: VillagerData, damage: number): void {
    if (v.health === HealthState.Dead) return;
    v.hp = Math.max(0, v.hp - damage);
    if (v.hp <= 0) { v.health = HealthState.Dead; v.state = VillagerState.Dead; v.path = []; this.onVillagerDeath?.(); }
    else v.health = HealthState.Injured;
  }
  serialize(): VillagerData[] { return this.villagers.map(v => ({ ...v, path: v.path.map(p => ({ ...p })) })); }
  deserialize(data: VillagerData[]): void {
    this.villagers = data.map(v => ({ ...v, path: (v.path ?? []).map(p => ({ ...p })) }));
    nextVillagerId = Math.max(0, ...data.map(v => Number(v.id.replace('v_', '')) || 0)) + 1;
  }
}
