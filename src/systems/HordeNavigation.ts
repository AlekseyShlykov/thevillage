import { EnemyData, Position } from '../types';
import { TileMap } from '../world/TileMap';
import { ProtectionSystem } from './ProtectionSystem';
import { findPath } from '../utils/Pathfinding';
import { getConfig } from '../data/ConfigLoader';

export interface AttackTile extends Position { buildingId: string }
const neighbours = [[0,-1],[1,0],[0,1],[-1,0]];

/** Enemies path to a walkable attack position, never into a building or ward. */
export class HordeNavigation {
  public openGateIds = new Set<string>();
  public unbuiltPalisadeIds = new Set<string>();
  constructor(private map: TileMap, private protection: ProtectionSystem) {}
  walkable(x: number, y: number): boolean {
    return !this.protection.blocksTile(x, y) && this.map.isWalkable(x, y, this.openGateIds, this.unbuiltPalisadeIds);
  }
  path(e: EnemyData, goal: Position): Position[] {
    // findPath allows an occupied goal; enemy navigation must explicitly reject it.
    if (!this.walkable(goal.x, goal.y)) return [];
    const path = findPath(Math.floor(e.x), Math.floor(e.y), goal.x, goal.y,
      (x, y) => this.walkable(x, y), this.map.width, this.map.height, getConfig().horde.pathMaxIterations as number);
    if (path.length) path.shift(); return path;
  }
  approach(e: EnemyData, tiles: AttackTile[], others: EnemyData[]): { tile: AttackTile; goal: Position; path: Position[] } | null {
    const candidates = tiles.flatMap(tile => neighbours.map(([dx, dy]) => ({ tile, goal: { x: tile.x + dx, y: tile.y + dy } })))
      .filter(c => this.walkable(c.goal.x, c.goal.y) && !others.some(o => o.id !== e.id && o.state !== 'dead' &&
        (Math.hypot(o.x-c.goal.x,o.y-c.goal.y) < (getConfig().horde.enemySeparation as number) ||
          (o.targetBuildingId && o.targetX === c.goal.x && o.targetY === c.goal.y))))
      .sort((a, b) => Math.hypot(a.goal.x - e.x, a.goal.y - e.y) - Math.hypot(b.goal.x - e.x, b.goal.y - e.y));
    const tried = new Set<string>();
    for (const c of candidates) {
      const key = `${c.goal.x},${c.goal.y}`; if (tried.has(key)) continue; tried.add(key);
      if (Math.hypot(c.goal.x - e.x, c.goal.y - e.y) < .01) return { ...c, path: [] };
      const path = this.path(e, c.goal);
      if (path.length) return { ...c, path };
    }
    return null;
  }
  step(e: EnemyData, dt: number, others: EnemyData[]): void {
    const next = e.path[0]; if (!next) return;
    if (!this.walkable(next.x, next.y)) { e.path = []; e.repathTimer = 0; return; }
    if (others.some(o => o.id !== e.id && o.state !== 'dead' && (o.id < e.id || !o.path.length) &&
      Math.hypot(o.x - next.x, o.y - next.y) < (getConfig().horde.enemySeparation as number))) {
      e.blockedTimer = (e.blockedTimer ?? 0) + dt;
      if (e.blockedTimer >= (getConfig().horde.targetRepathSeconds as number)) { e.path = []; e.repathTimer = 0; e.blockedTimer = 0; }
      return;
    }
    e.blockedTimer = 0;
    const tile=this.map.getTile(Math.floor(e.x+.5),Math.floor(e.y+.5));
    const slowdown=tile?.type==='moat' && tile.moatDug ? getConfig().buildings.moat.enemySpeedMultiplier! : 1;
    const dx = next.x - e.x, dy = next.y - e.y, distance = Math.hypot(dx, dy), step = Math.min(distance, e.speed * dt * slowdown);
    if (!distance) { e.path.shift(); return; }
    const x = e.x + dx / distance * step, y = e.y + dy / distance * step;
    if (this.protection.blocksPoint(x, y)) { e.path = []; e.repathTimer = 0; return; }
    e.x = x; e.y = y;
    if (step >= distance) e.path.shift();
  }
}
