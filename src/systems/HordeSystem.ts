import { EnemyData } from '../types';
import { TileType } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { TileMap } from '../world/TileMap';
import { findPath } from '../utils/Pathfinding';

let nextEnemyId = 1;

export class HordeSystem {
  public enemies: EnemyData[] = [];
  public isActive = false;
  private waveTimer = 0;
  private currentWave = 0;
  private wavesThisWinter = 0;
  private waveSpawned = false;
  private winterYear = 1;
  private winterLevel = 1;
  /** Gate IDs that are open — enemies can walk through */
  public openGateIds: Set<string> = new Set();
  /** Palisade IDs that are not yet built — enemies can walk through */
  public unbuiltPalisadeIds: Set<string> = new Set();

  private tileMap: TileMap;

  constructor(tileMap: TileMap) {
    this.tileMap = tileMap;
  }

  startWinter(year: number, level: number): void {
    const cfg = getConfig().horde;
    const wavesArr = cfg.wavesPerWinter as number[];
    this.wavesThisWinter = wavesArr[Math.min(level - 1, wavesArr.length - 1)];
    this.currentWave = 0;
    this.waveTimer = (cfg.delayAfterWinterStart as number) ?? 2;
    this.waveSpawned = false;
    this.isActive = true;
    this.winterYear = year;
    this.winterLevel = level;
  }

  endWinter(): void {
    this.isActive = false;
    for (const e of this.enemies) {
      e.state = 'dead';
    }
    this.enemies = [];
  }

  update(
    dt: number,
    villageCenterX: number,
    villageCenterY: number,
    detectionBuildings: { x: number; y: number; radius: number }[],
    housingTiles: { x: number; y: number }[],
    outsideVillagers: { id: string; x: number; y: number }[],
    attackableBuildingTiles: { x: number; y: number; buildingId: string }[],
    isHouseBuilding: (buildingId: string) => boolean,
    onAttackBuilding: (buildingId: string, damage: number) => void,
    onVillagerKilledByHorde: (villagerId: string) => void,
    winterRetreatPhase: boolean,
  ): void {
    if (!this.isActive) return;

    const cfg = getConfig().horde;

    this.waveTimer -= dt;
    if (this.waveTimer <= 0 && !this.waveSpawned) {
      this.spawnWave(villageCenterX, villageCenterY);
      this.waveSpawned = true;
    }

    const allDead = this.enemies.length === 0 || this.enemies.every(e => e.state === 'dead');
    if (allDead && this.waveSpawned) {
      this.currentWave++;
      this.waveSpawned = false;
      this.waveTimer = (cfg.timeBetweenWaves as number) || 30;
      this.enemies = [];
    }

    const housingSet = new Set(housingTiles.map(p => `${p.x},${p.y}`));

    for (const e of this.enemies) {
      if (e.state === 'dead') continue;

      this.updateVisibility(e, villageCenterX, villageCenterY, detectionBuildings);

      if (!winterRetreatPhase) {
        const killRadius = 1.2;
        for (const v of outsideVillagers) {
          const dist = Math.sqrt((e.x - v.x) ** 2 + (e.y - v.y) ** 2);
          if (dist < killRadius) {
            onVillagerKilledByHorde(v.id);
            break;
          }
        }
      }

      if (winterRetreatPhase) {
        this.updateEnemyRetreat(e, dt, housingTiles, cfg);
        continue;
      }

      switch (e.state) {
        case 'patrolling':
          this.updatePatrol(e, dt, cfg, outsideVillagers, attackableBuildingTiles, housingSet);
          break;
        case 'approaching':
          this.updateApproaching(e, dt, cfg, outsideVillagers, attackableBuildingTiles, housingSet, isHouseBuilding, villageCenterX, villageCenterY);
          break;
        case 'attacking':
          this.updateAttacking(e, dt, cfg, isHouseBuilding, onAttackBuilding, attackableBuildingTiles);
          break;
      }
    }
  }

  // ---- State handlers ----

  private updatePatrol(
    e: EnemyData, dt: number, cfg: Record<string, unknown>,
    outsideVillagers: { id: string; x: number; y: number }[],
    attackableBuildingTiles: { x: number; y: number; buildingId: string }[],
    housingSet: Set<string>,
  ): void {
    const chaseDistance = (cfg.villagerChaseDistance as number) ?? 25;
    const nearestOutside = this.findNearestOutsideVillager(e.x, e.y, outsideVillagers, chaseDistance);

    if (nearestOutside) {
      let goalX = Math.floor(nearestOutside.x);
      let goalY = Math.floor(nearestOutside.y);
      if (housingSet.has(`${goalX},${goalY}`)) {
        const walkable = (x: number, y: number) => this.isEnemyWalkable(x, y, housingSet);
        const fallback = this.findNearestWalkableToCenter(goalX, goalY, housingSet, walkable);
        goalX = fallback.x;
        goalY = fallback.y;
      }
      this.pathAndMove(e, dt, goalX, goalY, housingSet, cfg);
      e.patrolTimer = 0;
      return;
    }

    e.patrolTimer = (e.patrolTimer ?? 0) + dt;
    const patrolDuration = (cfg.patrolDuration as number) ?? 20;

    if (e.patrolTimer >= patrolDuration && attackableBuildingTiles.length > 0) {
      e.state = 'approaching';
      e.patrolTimer = 0;
      e.path = [];
      e.patrolTarget = null;
      return;
    }

    if (!e.patrolTarget || this.reachedTile(e, e.patrolTarget.x, e.patrolTarget.y)) {
      const clearTiles = this.tileMap.getClearZoneTiles();
      if (clearTiles.length > 0) {
        e.patrolTarget = clearTiles[Math.floor(Math.random() * clearTiles.length)];
        e.path = [];
      }
    }

    if (e.patrolTarget) {
      this.pathAndMove(e, dt, e.patrolTarget.x, e.patrolTarget.y, housingSet, cfg);
    }
  }

  private updateApproaching(
    e: EnemyData, dt: number, cfg: Record<string, unknown>,
    outsideVillagers: { id: string; x: number; y: number }[],
    attackableBuildingTiles: { x: number; y: number; buildingId: string }[],
    housingSet: Set<string>,
    isHouseBuilding: (buildingId: string) => boolean,
    villageCenterX: number, villageCenterY: number,
  ): void {
    const chaseDistance = (cfg.villagerChaseDistance as number) ?? 25;
    const nearestOutside = this.findNearestOutsideVillager(e.x, e.y, outsideVillagers, chaseDistance);

    let goalX: number;
    let goalY: number;

    if (nearestOutside) {
      goalX = Math.floor(nearestOutside.x);
      goalY = Math.floor(nearestOutside.y);
      if (housingSet.has(`${goalX},${goalY}`)) {
        const walkable = (x: number, y: number) => this.isEnemyWalkable(x, y, housingSet);
        const fallback = this.findNearestWalkableToCenter(goalX, goalY, housingSet, walkable);
        goalX = fallback.x;
        goalY = fallback.y;
      }
    } else {
      const nearestBuilding = this.findNearestAttackableBuilding(e.x, e.y, attackableBuildingTiles);
      if (nearestBuilding) {
        goalX = nearestBuilding.x;
        goalY = nearestBuilding.y;
      } else {
        e.state = 'patrolling';
        e.patrolTimer = 0;
        e.path = [];
        return;
      }
    }

    this.pathAndMove(e, dt, goalX, goalY, housingSet, cfg);

    const ex = Math.floor(e.x);
    const ey = Math.floor(e.y);
    const tile = this.tileMap.getTile(ex, ey);
    if (tile && tile.buildingId && (tile.type === TileType.Palisade || tile.type === TileType.Building)) {
      if (isHouseBuilding(tile.buildingId)) {
        e.path = [];
      } else {
        e.state = 'attacking';
        e.targetBuildingId = tile.buildingId;
      }
    }
  }

  private updateAttacking(
    e: EnemyData, dt: number, cfg: Record<string, unknown>,
    isHouseBuilding: (buildingId: string) => boolean,
    onAttackBuilding: (buildingId: string, damage: number) => void,
    attackableBuildingTiles: { x: number; y: number; buildingId: string }[],
  ): void {
    if (e.targetBuildingId && isHouseBuilding(e.targetBuildingId)) {
      e.state = 'patrolling';
      e.targetBuildingId = null;
      e.path = [];
      e.patrolTimer = 0;
      return;
    }

    if (e.targetBuildingId) {
      const exists = attackableBuildingTiles.some(t => t.buildingId === e.targetBuildingId);
      if (!exists) {
        e.state = 'patrolling';
        e.targetBuildingId = null;
        e.path = [];
        e.patrolTimer = 0;
        return;
      }
    }

    e.attackCooldown -= dt;
    if (e.attackCooldown <= 0) {
      e.attackCooldown = (cfg.enemyAttackRate as number) || 2;
      if (e.targetBuildingId) {
        const dmg = ((cfg.buildingDamagePerAttack as number) || 15) / 10;
        onAttackBuilding(e.targetBuildingId, dmg);
      }
    }
  }

  // ---- Movement helpers ----

  private isEnemyWalkable(x: number, y: number, housingSet: Set<string>): boolean {
    if (housingSet.has(`${x},${y}`)) return false;
    const tile = this.tileMap.getTile(x, y);
    if (!tile) return false;
    if (tile.type === TileType.Building) return false;
    if (tile.type === TileType.Palisade) {
      if (tile.buildingId && this.openGateIds.has(tile.buildingId)) return true;
      if (tile.buildingId && this.unbuiltPalisadeIds.has(tile.buildingId)) return true;
      return false;
    }
    return true;
  }

  private reachedTile(e: EnemyData, tx: number, ty: number): boolean {
    return Math.floor(e.x) === tx && Math.floor(e.y) === ty && e.path.length === 0;
  }

  private pathAndMove(
    e: EnemyData, dt: number,
    goalX: number, goalY: number,
    housingSet: Set<string>,
    cfg: Record<string, unknown>,
  ): void {
    if (e.path.length === 0 || this.pathGoalMismatch(e, goalX, goalY)) {
      const walkable = (x: number, y: number) =>
        this.isEnemyWalkable(x, y, housingSet) && !this.isTileOccupiedByOtherEnemy(e.id, x, y);
      e.path = findPath(
        Math.floor(e.x), Math.floor(e.y), goalX, goalY,
        walkable, this.tileMap.width, this.tileMap.height, 500
      );
    }
    this.stepEnemy(e, dt, cfg, housingSet);
  }

  private stepEnemy(
    e: EnemyData, dt: number,
    cfg: Record<string, unknown>,
    housingSet: Set<string>,
  ): void {
    if (e.path.length === 0) return;

    const next = e.path[0];
    const dx = next.x - e.x;
    const dy = next.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.15) {
      const nextTx = Math.floor(next.x);
      const nextTy = Math.floor(next.y);

      if (housingSet.has(`${nextTx},${nextTy}`)) {
        e.path.shift();
        return;
      }

      const currentlyNearOther = this.isTileAdjacentToOtherEnemy(e.id, Math.floor(e.x), Math.floor(e.y));
      const adjacencyBlocked = !currentlyNearOther && this.isTileAdjacentToOtherEnemy(e.id, nextTx, nextTy);

      const blocked =
        this.isTileOccupiedByOtherEnemy(e.id, nextTx, nextTy) ||
        adjacencyBlocked ||
        (this.isTileReservedByOtherEnemy(e.id, nextTx, nextTy) && !this.hasPriorityForTile(e.id, nextTx, nextTy));

      if (blocked) {
        e.path.shift();
        return;
      }

      e.x = next.x;
      e.y = next.y;
      e.path.shift();
    } else {
      const speed = (cfg.enemySpeed as number) || 0.8;
      e.x += (dx / dist) * speed * dt;
      e.y += (dy / dist) * speed * dt;
    }
  }

  private pathGoalMismatch(e: EnemyData, goalX: number, goalY: number): boolean {
    if (e.path.length === 0) return true;
    const last = e.path[e.path.length - 1];
    return Math.floor(last.x) !== goalX || Math.floor(last.y) !== goalY;
  }

  /** Chebyshev distance < 2 to any other living enemy. */
  private isTileAdjacentToOtherEnemy(excludeId: string, tx: number, ty: number): boolean {
    for (const o of this.enemies) {
      if (o.id === excludeId || o.state === 'dead') continue;
      const dist = Math.max(Math.abs(Math.floor(o.x) - tx), Math.abs(Math.floor(o.y) - ty));
      if (dist < 2) return true;
    }
    return false;
  }

  // ---- Retreat ----

  private updateEnemyRetreat(
    e: EnemyData,
    dt: number,
    housingTiles: { x: number; y: number }[],
    cfg: Record<string, unknown>,
  ): void {
    if (e.state === 'attacking') {
      e.state = 'patrolling';
      e.targetBuildingId = null;
      e.path = [];
    }

    const housingSet = new Set(housingTiles.map(p => `${p.x},${p.y}`));
    const walkable = (x: number, y: number) =>
      this.isEnemyWalkable(x, y, housingSet) && !this.isTileOccupiedByOtherEnemy(e.id, x, y);

    const edgeTiles = this.tileMap.getForestEdgeTiles();
    const target = this.findNearestForestEdgeTile(e.x, e.y, edgeTiles);
    if (!target) return;

    const goalX = target.x;
    const goalY = target.y;

    if (e.path.length === 0 || this.pathGoalMismatch(e, goalX, goalY)) {
      e.path = findPath(
        Math.floor(e.x), Math.floor(e.y),
        goalX, goalY,
        walkable,
        this.tileMap.width, this.tileMap.height,
        500
      );
    }

    if (e.path.length > 0) {
      const next = e.path[0];
      const dx = next.x - e.x;
      const dy = next.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.15) {
        e.x = next.x;
        e.y = next.y;
        e.path.shift();
      } else {
        const speed = (cfg.enemySpeed as number) || 0.8;
        e.x += (dx / dist) * speed * dt;
        e.y += (dy / dist) * speed * dt;
      }
    }
  }

  private findNearestForestEdgeTile(ex: number, ey: number, edgeTiles: { x: number; y: number }[]): { x: number; y: number } | null {
    if (edgeTiles.length === 0) return null;
    let best = edgeTiles[0];
    let bestDist = Math.sqrt((ex - best.x) ** 2 + (ey - best.y) ** 2);
    for (const t of edgeTiles) {
      const d = Math.sqrt((ex - t.x) ** 2 + (ey - t.y) ** 2);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  // ---- Tile helpers ----

  private isTileOccupiedByOtherEnemy(excludeId: string, tx: number, ty: number): boolean {
    const txi = Math.floor(tx);
    const tyi = Math.floor(ty);
    for (const o of this.enemies) {
      if (o.id === excludeId || o.state === 'dead') continue;
      if (Math.floor(o.x) === txi && Math.floor(o.y) === tyi) return true;
    }
    return false;
  }

  private isTileReservedByOtherEnemy(excludeId: string, tx: number, ty: number): boolean {
    const txi = Math.floor(tx);
    const tyi = Math.floor(ty);
    for (const o of this.enemies) {
      if (o.id === excludeId || o.state === 'dead') continue;
      if (!o.path || o.path.length === 0) continue;
      const next = o.path[0];
      if (Math.floor(next.x) === txi && Math.floor(next.y) === tyi) return true;
    }
    return false;
  }

  private hasPriorityForTile(enemyId: string, tx: number, ty: number): boolean {
    const txi = Math.floor(tx);
    const tyi = Math.floor(ty);
    let minId: string | null = null;
    for (const o of this.enemies) {
      if (o.state === 'dead' || !o.path || o.path.length === 0) continue;
      const next = o.path[0];
      if (Math.floor(next.x) !== txi || Math.floor(next.y) !== tyi) continue;
      if (minId === null || o.id < minId) minId = o.id;
    }
    return minId === enemyId;
  }

  // ---- Search helpers ----

  private findNearestOutsideVillager(
    ex: number, ey: number,
    outsideVillagers: { id: string; x: number; y: number }[],
    maxDist: number,
  ): { id: string; x: number; y: number } | null {
    let best: { id: string; x: number; y: number } | null = null;
    let bestDist = maxDist;
    for (const v of outsideVillagers) {
      const d = Math.sqrt((ex - v.x) ** 2 + (ey - v.y) ** 2);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    return best;
  }

  private findNearestAttackableBuilding(
    ex: number, ey: number,
    tiles: { x: number; y: number; buildingId: string }[],
  ): { x: number; y: number; buildingId: string } | null {
    if (tiles.length === 0) return null;
    let best = tiles[0];
    let bestDist = Math.sqrt((ex - best.x) ** 2 + (ey - best.y) ** 2);
    for (const t of tiles) {
      const d = Math.sqrt((ex - t.x) ** 2 + (ey - t.y) ** 2);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  private findNearestWalkableToCenter(
    cx: number, cy: number,
    housingSet: Set<string>,
    walkable: (x: number, y: number) => boolean,
  ): { x: number; y: number } {
    const icx = Math.floor(cx);
    const icy = Math.floor(cy);
    if (walkable(icx, icy)) return { x: icx, y: icy };
    const maxRadius = 15;
    for (let r = 1; r <= maxRadius; r++) {
      let best: { x: number; y: number } | null = null;
      let bestDist = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = icx + dx;
          const y = icy + dy;
          if (x < 0 || x >= this.tileMap.width || y < 0 || y >= this.tileMap.height) continue;
          if (!walkable(x, y)) continue;
          const d = dx * dx + dy * dy;
          if (d < bestDist) {
            bestDist = d;
            best = { x, y };
          }
        }
      }
      if (best) return best;
    }
    return { x: icx, y: icy };
  }

  // ---- Spawning ----

  private spawnWave(villageCenterX: number, villageCenterY: number): void {
    const cfg = getConfig().horde;
    const base = (cfg.baseEnemyCount as number) || 5;
    const perLevel = (cfg.enemyCountPerLevel as number) || 3;
    const count = base + perLevel * (this.winterLevel - 1) + Math.floor(this.winterYear * 0.5) + this.currentWave;
    const edgeTiles = this.tileMap.getForestEdgeTiles();
    if (edgeTiles.length === 0) return;

    for (let i = 0; i < count; i++) {
      const spawn = edgeTiles[Math.floor(Math.random() * edgeTiles.length)];
      const enemy: EnemyData = {
        id: `e_${nextEnemyId++}`,
        x: spawn.x,
        y: spawn.y,
        hp: (cfg.enemyHP as number) || 30,
        maxHp: (cfg.enemyHP as number) || 30,
        speed: (cfg.enemySpeed as number) || 0.8,
        damage: (cfg.enemyDamage as number) || 10,
        attackCooldown: 0,
        targetX: villageCenterX,
        targetY: villageCenterY,
        path: [],
        visible: false,
        state: 'patrolling',
        targetBuildingId: null,
        patrolTarget: null,
        patrolTimer: 0,
      };
      this.enemies.push(enemy);
    }
  }

  // ---- Visibility ----

  private updateVisibility(
    enemy: EnemyData,
    villageCenterX: number,
    villageCenterY: number,
    detectionBuildings: { x: number; y: number; radius: number }[]
  ): void {
    const cfg = getConfig().horde;
    const baseDist = (cfg.visibilityDistance as number) || 5;

    const distToVillage = Math.sqrt(
      (enemy.x - villageCenterX) ** 2 + (enemy.y - villageCenterY) ** 2
    );
    if (distToVillage <= baseDist) {
      enemy.visible = true;
      return;
    }

    for (const d of detectionBuildings) {
      const dist = Math.sqrt((enemy.x - d.x) ** 2 + (enemy.y - d.y) ** 2);
      if (dist <= d.radius) {
        enemy.visible = true;
        return;
      }
    }

    enemy.visible = false;
  }

  // ---- Public API ----

  damageEnemy(enemyId: string, damage: number): void {
    const e = this.enemies.find(e => e.id === enemyId);
    if (!e) return;
    e.hp -= damage;
    if (e.hp <= 0) {
      e.state = 'dead';
    }
  }

  getActiveEnemies(): EnemyData[] {
    return this.enemies.filter(e => e.state !== 'dead');
  }

  serialize(): EnemyData[] {
    return this.enemies.map(e => ({ ...e, path: [] }));
  }

  deserialize(data: EnemyData[]): void {
    this.enemies = data;
  }
}
