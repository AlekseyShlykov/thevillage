import { BuildingInstance, EnemyData, TileType } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { TileMap } from '../world/TileMap';
import { ProtectionSystem } from './ProtectionSystem';
import { AttackTile, HordeNavigation } from './HordeNavigation';

let nextEnemyId = 1;

/** Finite winter waves. Intact defenses are always destroyed before buildings. */
export class HordeSystem {
  public enemies: EnemyData[] = [];
  public isActive = false;
  public visibilityMultiplier = 1;
  public openGateIds = new Set<string>();
  public unbuiltPalisadeIds = new Set<string>();
  public towerDefenseUnlocked = false;
  private waveTimer = 0;
  private currentWave = 0;
  private wavesThisWinter = 0;
  private waveSpawned = false;
  private winterYear = 1;
  private winterLevel = 1;
  private enemiesSpawnedThisWinter = 0;
  private worldKey = '';
  private retreating = false;
  private navigation: HordeNavigation;
  constructor(private tileMap: TileMap, public protection = new ProtectionSystem()) {
    this.navigation = new HordeNavigation(tileMap, protection);
  }
  startWinter(year: number, level: number): void {
    const cfg = getConfig().horde, waves = cfg.wavesPerWinter as number[];
    this.winterYear = year; this.winterLevel = level;
    this.wavesThisWinter = Math.min(waves[Math.min(level - 1, waves.length - 1)], this.winterEnemyLimit());
    this.currentWave = 0; this.waveTimer = cfg.delayAfterWinterStart as number;
    this.waveSpawned = false; this.isActive = true;
    this.enemies = []; this.enemiesSpawnedThisWinter = 0;
    this.retreating = false;
  }
  /** The last configured winter count also caps every subsequent year. */
  private winterEnemyLimit(): number {
    const counts = getConfig().horde.enemiesPerWinter as number[];
    return counts[Math.min(Math.max(0, this.winterYear - 1), counts.length - 1)];
  }
  endWinter(): void { this.isActive = false; this.enemies = []; }

  /** The first completed tower permanently enables defense and toughens living/current and future enemies. */
  observeTowerConstruction(buildings: BuildingInstance[]): void {
    if (this.towerDefenseUnlocked || !buildings.some(b => b.built && b.configId === 'watchtower')) return;
    this.towerDefenseUnlocked = true;
    const multiplier = getConfig().horde.enemyHealthAfterTowerMultiplier as number;
    for (const enemy of this.getActiveEnemies()) {
      enemy.hp *= multiplier; enemy.maxHp *= multiplier;
    }
  }

  canVillagersDamage(): boolean {
    return this.towerDefenseUnlocked || getConfig().horde.requireTowerForVillagerDamage === false;
  }

  reset(): void {
    this.endWinter(); this.towerDefenseUnlocked = false;
    this.waveTimer=0; this.currentWave=0; this.wavesThisWinter=0; this.waveSpawned=false;
    this.winterYear=1; this.winterLevel=1; this.enemiesSpawnedThisWinter=0;
    this.worldKey=''; this.retreating=false;
  }
  update(dt: number, cx: number, cy: number,
    detection: { x: number; y: number; radius: number }[], _housing: { x: number; y: number }[],
    outside: { id: string; x: number; y: number }[], tiles: AttackTile[], _isHouse: (id: string) => boolean,
    onBuilding: (id: string, damage: number) => void, onVillager: (id: string) => void, retreat: boolean): void {
    if (!this.isActive) return;
    const cfg = getConfig().horde;
    this.waveTimer -= dt;
    if (this.waveSpawned && (this.waveTimer <= 0 || this.enemies.every(e => e.state === 'dead'))) {
      this.currentWave++; this.waveSpawned = false;
      this.enemies = this.enemies.filter(e => e.state !== 'dead');
    }
    if (!retreat && this.waveTimer <= 0 && !this.waveSpawned && this.currentWave < this.wavesThisWinter) {
      this.spawnWave(cx, cy); this.waveSpawned = true;
      this.waveTimer = cfg.timeBetweenWaves as number;
    }
    this.navigation.openGateIds = this.openGateIds; this.navigation.unbuiltPalisadeIds = this.unbuiltPalisadeIds;
    const key = `${this.tileMap.revision}:${this.protection.revision}`;
    if (key !== this.worldKey || (retreat && !this.retreating)) {
      this.worldKey = key; for (const e of this.enemies) { e.path = []; e.repathTimer = 0; }
    }
    this.retreating = retreat;
    const defenses = tiles.filter(t => this.tileMap.getTile(t.x, t.y)?.type === TileType.Palisade && !this.protection.blocksTile(t.x, t.y));
    const targets = (defenses.length ? defenses : tiles).filter(t => !this.protection.blocksTile(t.x, t.y));
    const people = outside.filter(v => !this.protection.blocksPoint(v.x, v.y));
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      this.updateVisibility(e, cx, cy, detection);
      e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      e.villagerAttackCooldown = Math.max(0, (e.villagerAttackCooldown ?? 0) - dt);
      e.repathTimer = Math.max(0, (e.repathTimer ?? 0) - dt);
      if (this.protection.blocksPoint(e.x, e.y)) {
        const exit = this.protection.nearestOutside(e.x, e.y, (x, y) => this.navigation.walkable(x, y));
        if (exit) { e.x = exit.x; e.y = exit.y; }
        else { e.state = 'dead'; e.path = []; continue; }
        e.path = []; e.targetBuildingId = null; e.repathTimer = 0; e.state = 'approaching';
        continue;
      }
      if (retreat) { this.retreat(e, dt); continue; }
      if (defenses.length && e.targetBuildingId && !defenses.some(t => t.buildingId === e.targetBuildingId)) {
        e.targetBuildingId = null; e.path = []; e.repathTimer = 0;
      }
      // Attacks are checked against current live tiles, not a stale path or saved target.
      const target = targets.find(t => t.buildingId === e.targetBuildingId && Math.hypot(t.x - e.x, t.y - e.y) <= (cfg.buildingAttackReach as number));
      if (target) {
        e.state = 'attacking'; e.path = [];
        if (e.attackCooldown <= 0) {
          const multiplier = this.winterYear === 1 ? cfg.firstWinterBuildingDamageMultiplier as number : 1;
          onBuilding(target.buildingId, (cfg.buildingDamagePerAttack as number) * multiplier);
          e.attackCooldown = cfg.buildingAttackInterval as number;
        }
        continue;
      }
      if (!defenses.length) {
        const victim = people.find(v => Math.hypot(v.x - e.x, v.y - e.y) <= (cfg.villagerAttackReach as number));
        if (victim && e.villagerAttackCooldown <= 0) { onVillager(victim.id); e.villagerAttackCooldown = cfg.enemyAttackRate as number; }
      }
      if (e.path.length && e.targetBuildingId && !targets.some(t => t.buildingId === e.targetBuildingId)) { e.path = []; e.repathTimer = 0; }
      if (!e.path.length && e.repathTimer <= 0) {
        e.state = 'approaching'; e.targetBuildingId = null;
        const nearest = !defenses.length ? people.slice().sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))[0] : null;
        if (nearest && Math.hypot(nearest.x - e.x, nearest.y - e.y) <= (cfg.villagerChaseDistance as number)) {
          e.path = this.navigation.path(e, { x: Math.floor(nearest.x), y: Math.floor(nearest.y) });
        }
        if (!e.path.length) {
          const approach = this.navigation.approach(e, targets, this.enemies);
          if (approach) {
            e.path = approach.path; e.targetBuildingId = approach.tile.buildingId;
            e.targetX = approach.goal.x; e.targetY = approach.goal.y;
          }
        }
        e.repathTimer = cfg.targetRepathSeconds as number;
      }
      this.navigation.step(e, dt, this.enemies);
    }
  }
  private retreat(e: EnemyData, dt: number): void {
    e.state = 'patrolling'; e.targetBuildingId = null;
    if (!e.path.length && e.repathTimer === 0) {
      const edge = this.tileMap.getForestEdgeTiles().filter(p => this.navigation.walkable(p.x, p.y))
        .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y));
      for (const p of edge) { e.path = this.navigation.path(e, p); if (e.path.length) break; }
      e.repathTimer = getConfig().horde.targetRepathSeconds as number;
    }
    this.navigation.step(e, dt, this.enemies);
  }

  private spawnWave(villageCenterX: number, villageCenterY: number): void {
    const cfg = getConfig().horde;
    const hp = (cfg.enemyHP as number) * (this.towerDefenseUnlocked ? cfg.enemyHealthAfterTowerMultiplier as number : 1);
    const remaining = Math.max(0, this.winterEnemyLimit() - this.enemiesSpawnedThisWinter);
    const count = Math.ceil(remaining / (this.wavesThisWinter - this.currentWave));
    const edgeTiles = this.tileMap.getForestEdgeTiles().filter(p => !this.protection.blocksTile(p.x, p.y));
    if (edgeTiles.length === 0) return;

    for (let i = 0; i < count; i++) {
      const spawn = edgeTiles[Math.floor(Math.random() * edgeTiles.length)];
      const enemy: EnemyData = {
        id: `e_${nextEnemyId++}`,
        x: spawn.x,
        y: spawn.y,
        hp,
        maxHp: hp,
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
      this.enemiesSpawnedThisWinter++;
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
    if (distToVillage <= baseDist * this.visibilityMultiplier) {
      enemy.visible = true;
      return;
    }

    for (const d of detectionBuildings) {
      const dist = Math.sqrt((enemy.x - d.x) ** 2 + (enemy.y - d.y) ** 2);
      if (dist <= d.radius * this.visibilityMultiplier) {
        enemy.visible = true;
        return;
      }
    }

    enemy.visible = false;
  }

  // ---- Public API ----

  damageEnemy(enemyId: string, damage: number): void {
    if (!this.canVillagersDamage()) return;
    const e = this.enemies.find(e => e.id === enemyId);
    if (!e || e.state === 'dead') return;
    e.hp = Math.max(0, e.hp - damage);
    if (e.hp <= 0) {
      e.state = 'dead';
    }
  }

  getActiveEnemies(): EnemyData[] {
    return this.enemies.filter(e => e.state !== 'dead');
  }

  serialize() {
    return { enemies: this.enemies.map(e => ({ ...e, path: e.path.map(p => ({ ...p })) })),
      isActive: this.isActive, waveTimer: this.waveTimer, currentWave: this.currentWave,
      wavesThisWinter: this.wavesThisWinter, waveSpawned: this.waveSpawned,
      winterYear: this.winterYear, winterLevel: this.winterLevel,
      towerDefenseUnlocked: this.towerDefenseUnlocked,
      enemiesSpawnedThisWinter: this.enemiesSpawnedThisWinter };
  }

  deserialize(data: EnemyData[] | ReturnType<HordeSystem['serialize']>, winter = false, year = 1, level = 1): void {
    this.towerDefenseUnlocked = !Array.isArray(data) && data.towerDefenseUnlocked === true;
    if (Array.isArray(data)) {
      if (winter) this.startWinter(year, level); else this.endWinter();
      this.enemies = data; this.waveSpawned = data.length > 0;
      this.enemiesSpawnedThisWinter = data.length;
    } else {
      this.enemies = data.enemies ?? []; this.isActive = data.isActive;
      this.waveTimer = data.waveTimer; this.currentWave = data.currentWave;
      this.wavesThisWinter = data.wavesThisWinter; this.waveSpawned = data.waveSpawned;
      this.winterYear = data.winterYear; this.winterLevel = data.winterLevel;
      // Older saves have no seasonal counter. Keep their existing enemies and
      // conservatively account for completed waves instead of replenishing them.
      const waves = Math.max(1, this.wavesThisWinter), limit = this.winterEnemyLimit();
      const accountedWaves = Math.min(waves, this.currentWave + (this.waveSpawned ? 1 : 0));
      const legacyCount = Math.floor(limit / waves) * accountedWaves + Math.min(accountedWaves, limit % waves);
      this.enemiesSpawnedThisWinter = Math.max(this.enemies.length, data.enemiesSpawnedThisWinter ?? legacyCount);
    }
    // Migration may scale health next. Never mutate the caller's saved snapshot.
    this.enemies = this.enemies.map(e => ({...e, path: e.path.map(p => ({...p}))}));
    nextEnemyId = Math.max(0, ...this.enemies.map(e => Number(e.id.replace('e_', '')) || 0)) + 1;
  }
}
