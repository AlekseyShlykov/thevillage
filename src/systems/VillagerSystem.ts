import { VillagerData, VillagerState, HealthState, Position, BuildingInstance, TileType } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { TileMap } from '../world/TileMap';
import { findPath } from '../utils/Pathfinding';

let nextVillagerId = 1;

export class VillagerSystem {
  public villagers: VillagerData[] = [];
  private tileMap: TileMap;
  public openGateIds: Set<string> = new Set();
  public unbuiltPalisadeIds: Set<string> = new Set();
  private onVillagerDeath: (() => void) | null = null;

  constructor(tileMap: TileMap) {
    this.tileMap = tileMap;
  }

  setOnVillagerDeath(callback: () => void): void {
    this.onVillagerDeath = callback;
  }

  private isVillagerWalkable(x: number, y: number): boolean {
    return this.tileMap.isWalkable(x, y, this.openGateIds, this.unbuiltPalisadeIds);
  }

  spawnVillager(x: number, y: number): VillagerData {
    const v: VillagerData = {
      id: `v_${nextVillagerId++}`,
      x, y,
      state: VillagerState.Idle,
      health: HealthState.Healthy,
      hp: 100,
      maxHp: 100,
      targetX: null,
      targetY: null,
      path: [],
      assignedBuildingId: null,
      currentTask: null,
      taskProgress: 0,
      taskAttempts: 0,
    };
    this.villagers.push(v);
    return v;
  }

  spawnInitialVillagers(centerX: number, centerY: number, count: number): void {
    const hutTiles = new Set(['-1,-1', '0,-1', '-1,0', '0,0']);
    const offsets: [number, number][] = [];
    for (let ox = -2; ox <= 2; ox++) {
      for (let oy = -2; oy <= 2; oy++) {
        if (hutTiles.has(`${ox},${oy}`)) continue;
        offsets.push([ox, oy]);
      }
    }
    for (let i = offsets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [offsets[i], offsets[j]] = [offsets[j], offsets[i]];
    }
    for (let i = 0; i < count && i < offsets.length; i++) {
      const [ox, oy] = offsets[i];
      this.spawnVillager(centerX + ox, centerY + oy);
    }
  }

  getAliveVillagers(): VillagerData[] {
    return this.villagers.filter(v => v.health !== HealthState.Dead);
  }

  getAliveCount(): number {
    return this.getAliveVillagers().length;
  }

  getVillagerAt(tx: number, ty: number): VillagerData | null {
    for (const v of this.villagers) {
      if (v.health === HealthState.Dead) continue;
      if (Math.floor(v.x) === tx && Math.floor(v.y) === ty) return v;
    }
    return null;
  }

  findClosestIdleVillager(tx: number, ty: number): VillagerData | null {
    let best: VillagerData | null = null;
    let bestDist = Infinity;
    for (const v of this.villagers) {
      if (v.health === HealthState.Dead || v.state === VillagerState.Dead) continue;
      if (v.state !== VillagerState.Idle) continue;
      const dist = Math.abs(v.x - tx) + Math.abs(v.y - ty);
      if (dist < bestDist) {
        bestDist = dist;
        best = v;
      }
    }
    return best;
  }

  /** Clear all villagers and reset id counter for new game. */
  reset(): void {
    this.villagers = [];
    nextVillagerId = 1;
  }

  getVillagerById(id: string): VillagerData | null {
    return this.villagers.find(v => v.id === id) ?? null;
  }

  /** True if another villager (not excludeId) is at (tx, ty). */
  isTileOccupiedByOther(excludeId: string, tx: number, ty: number): boolean {
    const txi = Math.floor(tx);
    const tyi = Math.floor(ty);
    for (const v of this.villagers) {
      if (v.id === excludeId || v.health === HealthState.Dead) continue;
      if (Math.floor(v.x) === txi && Math.floor(v.y) === tyi) return true;
    }
    return false;
  }

  /** True if another villager (not excludeId) has (tx, ty) as their next path step — so they're about to step there. */
  isTileReservedByOther(excludeId: string, tx: number, ty: number): boolean {
    const txi = Math.floor(tx);
    const tyi = Math.floor(ty);
    for (const v of this.villagers) {
      if (v.id === excludeId || v.health === HealthState.Dead) continue;
      if (v.path.length === 0) continue;
      const next = v.path[0];
      if (Math.floor(next.x) === txi && Math.floor(next.y) === tyi) return true;
    }
    return false;
  }

  /** Find a walkable adjacent tile (tx,ty) that no other villager occupies or is pathing to as goal. Checks all 8 directions. */
  findAdjacentFreeTile(excludeId: string, tx: number, ty: number): { x: number; y: number } | null {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [dx, dy] of dirs) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (!this.isVillagerWalkable(nx, ny)) continue;
      if (this.isTileOccupiedByOther(excludeId, nx, ny)) continue;
      if (this.isTileTargetedByOther(excludeId, nx, ny)) continue;
      return { x: nx, y: ny };
    }
    return null;
  }

  /** True if another villager has (tx, ty) as their path goal (targetX, targetY). */
  isTileTargetedByOther(excludeId: string, tx: number, ty: number): boolean {
    for (const v of this.villagers) {
      if (v.id === excludeId || v.health === HealthState.Dead) continue;
      if (v.targetX === tx && v.targetY === ty) return true;
    }
    return false;
  }

  /** True if villagerId has the smallest id among all villagers whose next step is (tx, ty) — used to break ties so one can step. */
  hasPriorityForNextTile(villagerId: string, tx: number, ty: number): boolean {
    const txi = Math.floor(tx);
    const tyi = Math.floor(ty);
    let minId: string | null = null;
    for (const v of this.villagers) {
      if (v.health === HealthState.Dead || v.path.length === 0) continue;
      const next = v.path[0];
      if (Math.floor(next.x) !== txi || Math.floor(next.y) !== tyi) continue;
      if (minId === null || v.id < minId) minId = v.id;
    }
    return minId === villagerId;
  }

  /** True if another worker on the same task is within Chebyshev distance 1 of (tx, ty) — enforces 1-tile gap. */
  isTileNearOtherWorkerOnTask(excludeId: string, tx: number, ty: number, task: string): boolean {
    for (const v of this.villagers) {
      if (v.id === excludeId || v.health === HealthState.Dead) continue;
      if (v.currentTask !== task) continue;
      const vx = v.targetX ?? Math.floor(v.x);
      const vy = v.targetY ?? Math.floor(v.y);
      const dist = Math.max(Math.abs(tx - vx), Math.abs(ty - vy));
      if (dist < 2) return true;
    }
    return false;
  }

  /** True if some other villager is already assigned to clear (tx, ty). */
  isTileAlreadyBeingClearedByOther(excludeId: string, tx: number, ty: number): boolean {
    for (const v of this.villagers) {
      if (v.id === excludeId || v.health === HealthState.Dead) continue;
      if (v.currentTask === 'clearing' && v.targetX === tx && v.targetY === ty) return true;
    }
    return false;
  }

  /** Send one villager to hunt. Returns true if assigned. Only one hunter per forest tile. */
  sendVillagerToHunt(villagerId: string): boolean {
    const v = this.getVillagerById(villagerId);
    if (!v || v.health === HealthState.Dead || v.state === VillagerState.Dead) return false;
    if (v.currentTask === 'hunting') return true;
    const forestTiles = this.tileMap.getForestEdgeTiles();
    const occupiedByHunter = new Set<string>();
    for (const o of this.villagers) {
      if (o.health === HealthState.Dead || o.currentTask !== 'hunting') continue;
      if (o.targetX != null && o.targetY != null) occupiedByHunter.add(`${o.targetX},${o.targetY}`);
    }
    const available = forestTiles.filter(t =>
      !occupiedByHunter.has(`${t.x},${t.y}`) &&
      !this.isTileNearOtherWorkerOnTask(v.id, t.x, t.y, 'hunting')
    );
    if (available.length === 0) return false;
    const t = available[Math.floor(Math.random() * available.length)];
    if (this.isTileOccupiedByOther(v.id, t.x, t.y)) return false;
    if (!this.assignPath(v, t.x, t.y)) return false;
    v.currentTask = 'hunting';
    v.taskAttempts = 0;
    return true;
  }

  /** Send one villager to chop this tile. Only one worker per tile, 1-tile gap enforced. */
  sendVillagerToChop(villagerId: string, tx: number, ty: number): boolean {
    const v = this.getVillagerById(villagerId);
    if (!v || v.health === HealthState.Dead) return false;
    const tile = this.tileMap.getTile(tx, ty);
    if (!tile || tile.type !== TileType.Forest) return false;
    if (this.isTileAlreadyBeingClearedByOther(villagerId, tx, ty)) return false;
    if (this.isTileNearOtherWorkerOnTask(villagerId, tx, ty, 'clearing')) return false;
    if (this.isTileOccupiedByOther(villagerId, tx, ty)) return false;
    tile.markedForClearing = true;
    if (!this.assignPath(v, tx, ty)) return false;
    v.currentTask = 'clearing';
    v.taskAttempts = 0;
    return true;
  }

  /** Send one villager to walk to tile. */
  sendVillagerToTile(villagerId: string, tx: number, ty: number): boolean {
    const v = this.getVillagerById(villagerId);
    if (!v || v.health === HealthState.Dead) return false;
    if (!this.isVillagerWalkable(tx, ty)) return false;
    if (!this.assignPath(v, tx, ty)) return false;
    v.currentTask = null;
    return true;
  }

  /** Assign one villager to a building (for work). */
  assignVillagerToBuilding(villagerId: string, buildingId: string, buildings: BuildingInstance[]): boolean {
    const v = this.getVillagerById(villagerId);
    if (!v || v.health === HealthState.Dead) return false;
    const building = buildings.find(b => b.id === buildingId);
    if (!building || !building.built) return false;
    const cfg = getConfig().buildings[building.configId] as { maxWorkers?: number } | undefined;
    if (!cfg || (cfg.maxWorkers ?? 0) <= 0) return false;
    if (building.assignedWorkers.length >= (cfg.maxWorkers ?? 0)) return false;
    v.assignedBuildingId = buildingId;
    building.assignedWorkers.push(villagerId);
    const bx = building.tileX;
    const by = building.tileY + 1;
    this.assignPath(v, bx, by);
    v.taskAttempts = 0;
    return true;
  }

  /** Send one villager to a housing tile (shelter / return home). */
  sendVillagerToHousing(villagerId: string, hx: number, hy: number): boolean {
    const v = this.getVillagerById(villagerId);
    if (!v || v.health === HealthState.Dead) return false;
    if (!this.assignPath(v, hx, hy)) return false;
    v.currentTask = 'returnHome';
    v.assignedBuildingId = null;
    v.taskAttempts = 0;
    return true;
  }

  /** Send villager to nearest shelter tile; used when task fails after 2 attempts. Picks a tile not already targeted by another villager so paths don't cross. */
  sendVillagerToNearestShelter(v: VillagerData, housingTiles: { x: number; y: number }[]): boolean {
    if (housingTiles.length === 0) return false;
    const targetedKeys = new Set<string>();
    for (const o of this.villagers) {
      if (o.id === v.id || o.health === HealthState.Dead) continue;
      if (o.currentTask === 'returnHome' && o.targetX != null && o.targetY != null) {
        targetedKeys.add(`${o.targetX},${o.targetY}`);
      }
    }
    const available = housingTiles.filter(t => !targetedKeys.has(`${t.x},${t.y}`));
    const tilesToUse = available.length > 0 ? available : housingTiles;
    let best = tilesToUse[0];
    let bestDist = Math.abs(v.x - best.x) + Math.abs(v.y - best.y);
    for (const t of tilesToUse) {
      const dist = Math.abs(v.x - t.x) + Math.abs(v.y - t.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = t;
      }
    }
    if (!this.assignPath(v, best.x, best.y)) return false;
    v.currentTask = 'returnHome';
    v.assignedBuildingId = null;
    v.targetX = best.x;
    v.targetY = best.y;
    v.taskAttempts = 0;
    return true;
  }

  assignPath(v: VillagerData, goalX: number, goalY: number): boolean {
    const startX = Math.floor(v.x);
    const startY = Math.floor(v.y);
    const isWalkable = (x: number, y: number) => this.isVillagerWalkable(x, y);
    const path = findPath(
      startX, startY,
      goalX, goalY,
      isWalkable,
      this.tileMap.width, this.tileMap.height
    );
    if (path.length > 0 && path[0].x === startX && path[0].y === startY) {
      path.shift();
    }
    if (path.length > 0) {
      v.path = path;
      v.targetX = goalX;
      v.targetY = goalY;
      v.state = VillagerState.Moving;
      return true;
    }
    return false;
  }

  update(dt: number, buildings: BuildingInstance[], isWinter: boolean, housingTiles: { x: number; y: number }[], stayInShelterMode = false): void {
    const cfg = getConfig().villagers;
    const moveSpeed = cfg.moveSpeed;

    const housingSet = new Set(housingTiles.map(p => `${p.x},${p.y}`));

    for (const v of this.villagers) {
      if (v.health === HealthState.Dead) continue;

      if (v.state === VillagerState.Building && v.currentTask === 'building') {
        const stillAssigned = buildings.some(b => !b.built && b.assignedWorkers.includes(v.id));
        if (!stillAssigned) {
          v.state = VillagerState.Idle;
          v.currentTask = null;
          v.path = [];
          v.targetX = null;
          v.targetY = null;
        }
      }

      if (v.state === VillagerState.Idle && v.assignedBuildingId) {
        const building = buildings.find(b => b.id === v.assignedBuildingId);
        if (!building) {
          v.assignedBuildingId = null;
        }
      }

      if (isWinter) {
        const key = `${Math.floor(v.x)},${Math.floor(v.y)}`;
        if (housingSet.has(key)) {
          v.timeOutsideInWinter = 0;
        }
      } else {
        v.timeOutsideInWinter = 0;
      }

      const cx = Math.floor(v.x);
      const cy = Math.floor(v.y);
      const onHousingTile = housingSet.has(`${cx},${cy}`);
      const onSharedTile = this.isTileOccupiedByOther(v.id, cx, cy);
      const pathLeadsOffTile = v.state === VillagerState.Moving && v.path.length > 0 &&
        (Math.floor(v.path[0].x) !== cx || Math.floor(v.path[0].y) !== cy);
      if (onSharedTile && !pathLeadsOffTile && !(stayInShelterMode && onHousingTile)) {
        if (v.currentTask != null && v.targetX != null && v.targetY != null) {
          this.assignPath(v, v.targetX, v.targetY);
        } else {
          const adj = this.findAdjacentFreeTile(v.id, cx, cy);
          if (adj) {
            this.assignPath(v, adj.x, adj.y);
          }
        }
      } else if (v.state === VillagerState.Moving && v.path.length > 0) {
        const next = v.path[0];
        const dx = next.x - v.x;
        const dy = next.y - v.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const nextTx = Math.floor(next.x);
        const nextTy = Math.floor(next.y);

        if (dist < 0.1) {
          const occupied = this.isTileOccupiedByOther(v.id, nextTx, nextTy);
          const reserved = this.isTileReservedByOther(v.id, nextTx, nextTy);
          const canStep = !occupied && (!reserved || this.hasPriorityForNextTile(v.id, nextTx, nextTy));
          if (!canStep) {
            // Wait in place — the blocking villager will move; stuck timer handles deadlocks
          } else {
            v.x = next.x;
            v.y = next.y;
            v.path.shift();
            if (v.path.length === 0) {
              if (v.currentTask === 'hunting') {
                v.state = VillagerState.Working;
                v.taskProgress = 0;
              } else if (v.currentTask === 'returnHome') {
                v.currentTask = null;
                v.state = VillagerState.Idle;
              } else if (v.currentTask === 'building') {
                v.state = VillagerState.Building;
              } else if (v.currentTask) {
                v.state = VillagerState.Working;
              } else {
                v.state = VillagerState.Idle;
              }
            }
          }
        } else {
          const step = moveSpeed * dt;
          v.x += (dx / dist) * Math.min(step, dist);
          v.y += (dy / dist) * Math.min(step, dist);
        }
      } else if (v.state === VillagerState.Moving && v.path.length === 0) {
        v.state = VillagerState.Idle;
      }

      if (v.state === VillagerState.Idle && v.path.length === 0 && v.currentTask != null && v.targetX != null && v.targetY != null) {
        if (this.assignPath(v, v.targetX, v.targetY)) {
          v.taskAttempts = 0;
        } else {
          const attempts = (v.taskAttempts ?? 0) + 1;
          v.taskAttempts = attempts;
          if (attempts >= 2 && housingTiles.length > 0 && this.sendVillagerToNearestShelter(v, housingTiles)) {
            // sent to shelter
          } else if (attempts >= 2) {
            v.currentTask = null;
            v.targetX = null;
            v.targetY = null;
            v.taskAttempts = 0;
          }
        }
      }

      const stuckCx = Math.floor(v.x);
      const stuckCy = Math.floor(v.y);
      const isProductiveWork = v.state === VillagerState.Working || v.state === VillagerState.Building || v.state === VillagerState.Defending;
      const isRestingInShelter = stayInShelterMode && housingSet.has(`${stuckCx},${stuckCy}`);
      if (!isProductiveWork && !isRestingInShelter) {
        if (v.lastStuckTileX === stuckCx && v.lastStuckTileY === stuckCy) {
          v.stuckTimer = (v.stuckTimer ?? 0) + dt;
          if (v.stuckTimer >= 3) {
            v.stuckTimer = 0;
            let unstuck = false;
            if (housingTiles.length > 0) {
              unstuck = this.sendVillagerToNearestShelter(v, housingTiles);
            }
            if (!unstuck) {
              const adj = this.findAdjacentFreeTile(v.id, stuckCx, stuckCy);
              if (adj && this.assignPath(v, adj.x, adj.y)) {
                v.currentTask = null;
              } else {
                v.currentTask = null;
                v.path = [];
                v.state = VillagerState.Idle;
                v.targetX = null;
                v.targetY = null;
              }
            }
          }
        } else {
          v.lastStuckTileX = stuckCx;
          v.lastStuckTileY = stuckCy;
          v.stuckTimer = 0;
        }
      } else {
        v.stuckTimer = 0;
        v.lastStuckTileX = stuckCx;
        v.lastStuckTileY = stuckCy;
      }

      if (v.health === HealthState.Injured) {
        v.hp = Math.min(v.hp + cfg.healRate * dt, v.maxHp);
        if (v.hp >= v.maxHp * 0.5) {
          v.health = HealthState.Healthy;
          if (v.state === VillagerState.Injured) {
            v.state = VillagerState.Idle;
          }
        }
      }

      if (v.state === VillagerState.Idle && v.assignedBuildingId) {
        const building = buildings.find(b => b.id === v.assignedBuildingId);
        if (!building) {
          v.assignedBuildingId = null;
        } else {
          if (stayInShelterMode && housingSet.has(`${Math.floor(v.x)},${Math.floor(v.y)}`)) {
            // In shelter mode and on housing tile: do not send out to work building
          } else {
            const bx = building.tileX;
            const by = building.tileY + 1;
            if (Math.floor(v.x) !== bx || Math.floor(v.y) !== by) {
              if (this.assignPath(v, bx, by)) {
                v.taskAttempts = 0;
              } else {
                const attempts = (v.taskAttempts ?? 0) + 1;
                v.taskAttempts = attempts;
                if (attempts >= 2) {
                  v.assignedBuildingId = null;
                  const idx = building.assignedWorkers.indexOf(v.id);
                  if (idx !== -1) building.assignedWorkers.splice(idx, 1);
                  v.taskAttempts = 0;
                }
              }
            }
          }
        }
      }
    }
  }

  /** Assign idle villagers to go chop marked forest tiles (one worker per tile). */
  assignAllToChop(markedTiles: Position[]): number {
    if (markedTiles.length === 0) return 0;
    const used = new Set<string>();
    for (const v of this.villagers) {
      if (v.health === HealthState.Dead || v.currentTask !== 'clearing') continue;
      if (v.targetX != null && v.targetY != null) used.add(`${v.targetX},${v.targetY}`);
    }
    const idles = this.villagers.filter(
      v => v.health !== HealthState.Dead && v.state === VillagerState.Idle && v.currentTask !== 'clearing'
    );
    let assigned = 0;
    for (const v of idles) {
      let best: Position | null = null;
      let bestDist = Infinity;
      for (const t of markedTiles) {
        const key = `${t.x},${t.y}`;
        if (used.has(key)) continue;
        if (this.isTileNearOtherWorkerOnTask(v.id, t.x, t.y, 'clearing')) continue;
        const dist = Math.abs(v.x - t.x) + Math.abs(v.y - t.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = t;
        }
      }
      if (best && this.assignPath(v, best.x, best.y)) {
        v.currentTask = 'clearing';
        v.taskAttempts = 0;
        used.add(`${best.x},${best.y}`);
        assigned++;
      }
    }
    return assigned;
  }

  /** Return one villager that can be sent home (alive, not already returning). */
  findOneVillagerToSendHome(housingTiles: { x: number; y: number }[]): VillagerData | null {
    if (housingTiles.length === 0) return null;
    for (const v of this.villagers) {
      if (v.health === HealthState.Dead) continue;
      if (v.currentTask === 'returnHome') continue;
      return v;
    }
    return null;
  }

  /** Send all villagers to shelter: distribute them across all shelter tiles (hut, house, large house), one per tile when possible, so paths do not cross. */
  assignAllReturnHome(housingTiles: { x: number; y: number }[]): number {
    if (housingTiles.length === 0) return 0;

    const targetedKeys = new Set<string>();
    for (const v of this.villagers) {
      if (v.health === HealthState.Dead) continue;
      if (v.currentTask === 'returnHome' && v.targetX != null && v.targetY != null) {
        targetedKeys.add(`${v.targetX},${v.targetY}`);
      }
    }
    let availableTiles = housingTiles.filter(t => !targetedKeys.has(`${t.x},${t.y}`));
    if (availableTiles.length === 0) availableTiles = [...housingTiles];

    const toSend = this.villagers.filter(
      v => v.health !== HealthState.Dead && v.currentTask !== 'returnHome'
    );
    let count = 0;
    for (const v of toSend) {
      if (availableTiles.length === 0) availableTiles = [...housingTiles];
      let bestIdx = 0;
      let bestDist = Math.abs(v.x - availableTiles[0].x) + Math.abs(v.y - availableTiles[0].y);
      for (let i = 1; i < availableTiles.length; i++) {
        const t = availableTiles[i];
        const dist = Math.abs(v.x - t.x) + Math.abs(v.y - t.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      const tile = availableTiles[bestIdx];
      if (this.assignPath(v, tile.x, tile.y)) {
        v.currentTask = 'returnHome';
        v.assignedBuildingId = null;
        v.taskAttempts = 0;
        targetedKeys.add(`${tile.x},${tile.y}`);
        availableTiles.splice(bestIdx, 1);
        count++;
      }
    }
    return count;
  }

  /** Send idle villagers to hunt in forest (one villager per tile; they go to forest tile, then Game resolves after duration). */
  sendIdleToHunt(forestTiles: Position[], _centerX: number, _centerY: number): number {
    const used = new Set<string>();
    for (const v of this.villagers) {
      if (v.health === HealthState.Dead || v.currentTask !== 'hunting') continue;
      if (v.targetX != null && v.targetY != null) used.add(`${v.targetX},${v.targetY}`);
    }
    const idles = this.villagers.filter(
      v => v.health !== HealthState.Dead && v.state === VillagerState.Idle && v.currentTask !== 'hunting'
    );
    if (forestTiles.length === 0 || idles.length === 0) return 0;
    let assigned = 0;
    for (const v of idles) {
      let best: Position | null = null;
      let bestDist = Infinity;
      for (const t of forestTiles) {
        const key = `${t.x},${t.y}`;
        if (used.has(key)) continue;
        if (this.isTileNearOtherWorkerOnTask(v.id, t.x, t.y, 'hunting')) continue;
        const dist = Math.abs(v.x - t.x) + Math.abs(v.y - t.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = t;
        }
      }
      if (best && this.assignPath(v, best.x, best.y)) {
        v.currentTask = 'hunting';
        v.taskAttempts = 0;
        used.add(`${best.x},${best.y}`);
        assigned++;
      }
    }
    return assigned;
  }

  damageVillager(v: VillagerData, damage: number): void {
    v.hp -= damage;
    if (v.hp <= 0) {
      v.hp = 0;
      v.health = HealthState.Dead;
      v.state = VillagerState.Dead;
      this.onVillagerDeath?.();
    } else {
      v.health = HealthState.Injured;
      v.state = VillagerState.Injured;
    }
  }

  removeDeadVillagers(): void {
    this.villagers = this.villagers.filter(v => v.health !== HealthState.Dead);
  }

  serialize(): VillagerData[] {
    return this.villagers.map(v => ({ ...v, path: [] }));
  }

  deserialize(data: VillagerData[]): void {
    this.villagers = data;
    for (const v of this.villagers) {
      if (v.health === HealthState.Dead) v.state = VillagerState.Dead;
    }
    nextVillagerId = Math.max(...data.map(v => parseInt(v.id.replace('v_', '')) || 0)) + 1;
  }
}
