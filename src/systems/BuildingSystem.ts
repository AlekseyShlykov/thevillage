import { BuildingInstance, BuildingConfig, TileType } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { TileMap } from '../world/TileMap';

let nextBuildingId = 1;

export class BuildingSystem {
  public buildings: BuildingInstance[] = [];
  private tileMap: TileMap;

  constructor(tileMap: TileMap) {
    this.tileMap = tileMap;
  }

  getBuildingConfig(configId: string): BuildingConfig | null {
    return getConfig().buildings[configId] || null;
  }

  /** Tiles just south of the building (where workers stand to build). */
  getArrivalTiles(b: BuildingInstance): { x: number; y: number }[] {
    const cfg = this.getBuildingConfig(b.configId);
    if (!cfg) return [];
    const out: { x: number; y: number }[] = [];
    const row = b.tileY + cfg.height;
    for (let dx = 0; dx < cfg.width; dx++) {
      out.push({ x: b.tileX + dx, y: row });
    }
    return out;
  }

  /** Returns unbuilt building for which (tx, ty) is one of the arrival tiles (worker standing there = on site). */
  getUnbuiltBuildingForArrivalTile(tx: number, ty: number): BuildingInstance | null {
    for (const b of this.buildings) {
      if (b.built) continue;
      const cfg = this.getBuildingConfig(b.configId);
      if (!cfg) continue;
      const arrivalRow = b.tileY + cfg.height;
      if (ty !== arrivalRow || tx < b.tileX || tx >= b.tileX + cfg.width) continue;
      return b;
    }
    return null;
  }

  getAllBuildingConfigs(): Record<string, BuildingConfig> {
    return getConfig().buildings;
  }

  canPlace(configId: string, tx: number, ty: number): boolean {
    const cfg = this.getBuildingConfig(configId);
    if (!cfg) return false;
    if (!this.tileMap.canPlaceBuilding(tx, ty, cfg.width, cfg.height, cfg.canPlaceInForest)) return false;

    const isPalisade = cfg.category === 'defense';

    const newTiles = new Set<string>();
    for (let dy = 0; dy < cfg.height; dy++) {
      for (let dx = 0; dx < cfg.width; dx++) {
        newTiles.add(`${tx + dx},${ty + dy}`);
      }
    }

    if (!isPalisade && !this.hasWalkablePerimeter(tx, ty, cfg.width, cfg.height, newTiles)) {
      return false;
    }

    for (const b of this.buildings) {
      const bIsPalisade = b.configId === 'palisadeWall' || b.configId === 'palisadeGate';
      if (bIsPalisade && isPalisade) continue;
      const bcfg = this.getBuildingConfig(b.configId);
      if (!bcfg) continue;

      if (!isPalisade && !bIsPalisade && this.buildingsTouch(tx, ty, cfg.width, cfg.height, b.tileX, b.tileY, bcfg.width, bcfg.height)) {
        return false;
      }

      if (!bIsPalisade && !this.hasWalkablePerimeter(b.tileX, b.tileY, bcfg.width, bcfg.height, newTiles)) {
        return false;
      }
    }

    return true;
  }

  private buildingsTouch(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
    for (let dy = 0; dy < ah; dy++) {
      for (let dx = 0; dx < aw; dx++) {
        const nx = ax + dx;
        const ny = ay + dy;
        for (let by2 = 0; by2 < bh; by2++) {
          for (let bx2 = 0; bx2 < bw; bx2++) {
            const ox = bx + bx2;
            const oy = by + by2;
            if (Math.abs(nx - ox) <= 1 && Math.abs(ny - oy) <= 1) return true;
          }
        }
      }
    }
    return false;
  }

  private hasWalkablePerimeter(bx: number, by: number, w: number, h: number, blockedTiles: Set<string>): boolean {
    for (let dx = 0; dx < w; dx++) {
      const x = bx + dx;
      if (!blockedTiles.has(`${x},${by - 1}`) && this.tileMap.isWalkable(x, by - 1)) return true;
      if (!blockedTiles.has(`${x},${by + h}`) && this.tileMap.isWalkable(x, by + h)) return true;
    }
    for (let dy = 0; dy < h; dy++) {
      const y = by + dy;
      if (!blockedTiles.has(`${bx - 1},${y}`) && this.tileMap.isWalkable(bx - 1, y)) return true;
      if (!blockedTiles.has(`${bx + w},${y}`) && this.tileMap.isWalkable(bx + w, y)) return true;
    }
    return false;
  }

  placeBuilding(configId: string, tx: number, ty: number): BuildingInstance | null {
    const cfg = this.getBuildingConfig(configId);
    if (!cfg) return null;
    if (!this.canPlace(configId, tx, ty)) return null;

    const id = `b_${nextBuildingId++}`;
    const building: BuildingInstance = {
      id,
      configId,
      tileX: tx,
      tileY: ty,
      built: false,
      buildProgress: 0,
      hp: cfg.hp,
      maxHp: cfg.hp,
      assignedWorkers: [],
      wintersSinceRepair: 0,
      needsRepair: false,
    };

    const tileType = cfg.category === 'defense' ? TileType.Palisade : TileType.Building;
    this.tileMap.placeBuilding(tx, ty, cfg.width, cfg.height, id, tileType);
    this.buildings.push(building);
    return building;
  }

  placeStartingBuilding(configId: string, tx: number, ty: number): BuildingInstance | null {
    const b = this.placeBuilding(configId, tx, ty);
    if (b) {
      b.built = true;
      b.buildProgress = 1;
    }
    return b;
  }

  demolishBuilding(buildingId: string): void {
    const idx = this.buildings.findIndex(b => b.id === buildingId);
    if (idx === -1) return;

    const b = this.buildings[idx];
    const cfg = this.getBuildingConfig(b.configId);
    if (cfg) {
      this.tileMap.removeBuilding(b.tileX, b.tileY, cfg.width, cfg.height);
    }
    this.buildings.splice(idx, 1);
  }

  /** Clear all buildings and reset for new game (does not modify tileMap - call tileMap.reset() first). */
  reset(): void {
    this.buildings = [];
    nextBuildingId = 1;
  }

  updateConstruction(dt: number, getBuildersOnSite: (buildingId: string) => number, onBuildProgress?: () => void, onBuildingCompleted?: (building: BuildingInstance) => void): void {
    const unbuilt = this.buildings.filter(b => !b.built);
    if (unbuilt.length === 0) return;

    const cfg = getConfig();
    const buildSpeed = cfg.villagers.buildSpeed;

    for (const b of unbuilt) {
      const onSite = getBuildersOnSite(b.id);
      if (onSite <= 0) continue;

      const bcfg = this.getBuildingConfig(b.configId);
      if (!bcfg) continue;

      const progressPerSecond = (buildSpeed * onSite) / bcfg.buildTime;
      b.buildProgress += progressPerSecond * dt;
      onBuildProgress?.();

      if (b.buildProgress >= 1) {
        b.buildProgress = 1;
        b.built = true;
        onBuildingCompleted?.(b);
      }
    }
  }

  damageBuilding(buildingId: string, damage: number): void {
    const b = this.buildings.find(b => b.id === buildingId);
    if (!b) return;
    b.hp -= damage;
    if (b.hp <= 0) {
      this.demolishBuilding(buildingId);
    }
  }

  repairBuilding(buildingId: string): void {
    const b = this.buildings.find(b => b.id === buildingId);
    if (!b) return;
    const cfg = this.getBuildingConfig(b.configId);
    if (!cfg) return;
    b.hp = cfg.hp;
    b.maxHp = cfg.hp;
    b.wintersSinceRepair = 0;
    b.needsRepair = false;
  }

  advanceWinterRepairCounters(): void {
    const repairCfg = getConfig().repair;
    for (const b of this.buildings) {
      if (!b.built) continue;
      b.wintersSinceRepair++;
      if (b.wintersSinceRepair >= repairCfg.repairNeededAfterWinters) {
        b.needsRepair = true;
      }
      if (b.wintersSinceRepair >= repairCfg.collapseAfterWinters) {
        this.demolishBuilding(b.id);
      }
    }
  }

  getHousingCapacity(): number {
    return this.buildings
      .filter(b => b.built)
      .reduce((sum, b) => {
        const cfg = this.getBuildingConfig(b.configId);
        return sum + (cfg?.capacity || 0);
      }, 0);
  }

  /** Tiles that count as "inside" for winter (hut, house, largeHouse, campFire). */
  getHousingTiles(): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    const housingIds = new Set(['hut', 'house', 'largeHouse', 'campFire']);
    for (const b of this.buildings) {
      if (!b.built) continue;
      const cfg = this.getBuildingConfig(b.configId);
      if (!cfg || !housingIds.has(b.configId)) continue;
      for (let dy = 0; dy < cfg.height; dy++) {
        for (let dx = 0; dx < cfg.width; dx++) {
          out.push({ x: b.tileX + dx, y: b.tileY + dy });
        }
      }
    }
    return out;
  }

  /** Tiles of buildings that can be attacked by horde (not hut, house, largeHouse, campFire). */
  getAttackableBuildingTiles(): { x: number; y: number; buildingId: string }[] {
    const out: { x: number; y: number; buildingId: string }[] = [];
    const housingIds = new Set(['hut', 'house', 'largeHouse', 'campFire']);
    for (const b of this.buildings) {
      if (!b.built) continue;
      if (housingIds.has(b.configId)) continue;
      const cfg = this.getBuildingConfig(b.configId);
      if (!cfg) continue;
      for (let dy = 0; dy < cfg.height; dy++) {
        for (let dx = 0; dx < cfg.width; dx++) {
          out.push({ x: b.tileX + dx, y: b.tileY + dy, buildingId: b.id });
        }
      }
    }
    return out;
  }

  getStorageBonuses(): { wood: number; food: number; fur: number; tools: number } {
    const bonus = { wood: 0, food: 0, fur: 0, tools: 0 };
    for (const b of this.buildings) {
      if (!b.built) continue;
      const cfg = this.getBuildingConfig(b.configId);
      if (cfg?.storageBonus) {
        bonus.wood += cfg.storageBonus.wood;
        bonus.food += cfg.storageBonus.food;
        bonus.fur += cfg.storageBonus.fur;
        bonus.tools += cfg.storageBonus.tools;
      }
    }
    return bonus;
  }

  getBuildingsOfType(configId: string): BuildingInstance[] {
    return this.buildings.filter(b => b.configId === configId && b.built);
  }

  /** True if (tx, ty) is within boostRadius of any built lumberCamp. */
  isTileInLumberCampRadius(tx: number, ty: number): boolean {
    for (const b of this.buildings) {
      if (!b.built || b.configId !== 'lumberCamp') continue;
      const bcfg = this.getBuildingConfig(b.configId);
      if (!bcfg?.boostRadius) continue;
      const r = bcfg.boostRadius;
      const cx = b.tileX + (bcfg.width - 1) / 2;
      const cy = b.tileY + (bcfg.height - 1) / 2;
      if (Math.max(Math.abs(tx - cx), Math.abs(ty - cy)) <= r) return true;
    }
    return false;
  }

  getComfortBonus(): number {
    return this.buildings
      .filter(b => b.built)
      .reduce((sum, b) => {
        const cfg = this.getBuildingConfig(b.configId);
        return sum + (cfg?.comfortBonus || 0);
      }, 0);
  }

  getDetectionBuildings(): { x: number; y: number; radius: number }[] {
    const result: { x: number; y: number; radius: number }[] = [];
    for (const b of this.buildings) {
      if (!b.built) continue;
      const cfg = this.getBuildingConfig(b.configId);
      if (cfg?.detectionRadius) {
        result.push({
          x: b.tileX,
          y: b.tileY,
          radius: cfg.detectionRadius,
        });
      }
    }
    return result;
  }

  getPalisadeHP(): number {
    return this.buildings
      .filter(b => b.built && (b.configId === 'palisadeWall' || b.configId === 'palisadeGate'))
      .reduce((sum, b) => sum + b.hp, 0);
  }

  findNearestPalisade(tx: number, ty: number): BuildingInstance | null {
    let best: BuildingInstance | null = null;
    let bestDist = Infinity;
    for (const b of this.buildings) {
      if (!b.built) continue;
      if (b.configId !== 'palisadeWall' && b.configId !== 'palisadeGate') continue;
      const dist = Math.abs(b.tileX - tx) + Math.abs(b.tileY - ty);
      if (dist < bestDist) {
        bestDist = dist;
        best = b;
      }
    }
    return best;
  }

  findNearestBuilding(tx: number, ty: number): BuildingInstance | null {
    let best: BuildingInstance | null = null;
    let bestDist = Infinity;
    for (const b of this.buildings) {
      if (!b.built) continue;
      const dist = Math.abs(b.tileX - tx) + Math.abs(b.tileY - ty);
      if (dist < bestDist) {
        bestDist = dist;
        best = b;
      }
    }
    return best;
  }

  serialize(): BuildingInstance[] {
    return this.buildings.map(b => ({ ...b, assignedWorkers: [...b.assignedWorkers] }));
  }

  deserialize(data: BuildingInstance[]): void {
    for (const b of data) {
      const cfg = this.getBuildingConfig(b.configId);
      if (cfg) {
        const tileType = cfg.category === 'defense' ? TileType.Palisade : TileType.Building;
        this.tileMap.placeBuilding(b.tileX, b.tileY, cfg.width, cfg.height, b.id, tileType);
      }
    }
    this.buildings = data;
    nextBuildingId = Math.max(...data.map(b => parseInt(b.id.replace('b_', '')) || 0)) + 1;
  }
}
