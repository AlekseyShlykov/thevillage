import { BuildingConfig, BuildingInstance, Position, Season } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { ResourceSystem } from './ResourceSystem';

export interface ProtectionZone extends Position { radius: number; buildingId: string }
export function protectionZones(buildings: BuildingInstance[], configs: Record<string, BuildingConfig>): ProtectionZone[] {
  return buildings.filter(b => b.built && b.hp > 0 && b.wardActive && (configs[b.configId]?.protectionRadius ?? 0) > 0)
    .map(b => ({ x: b.tileX, y: b.tileY, radius: configs[b.configId].protectionRadius!, buildingId: b.id }));
}

/** A ward is a square of actual blocked enemy tiles, not only a visual effect.
 * Overlapping wards form a union. Rebuild only when the active fires change. */
export class ProtectionSystem {
  public zones: ProtectionZone[] = [];
  public revision = 0;
  private tiles = new Set<string>();
  private key = '';
  advance(dt: number, buildings: BuildingInstance[], resources: ResourceSystem, season: Season): void {
    const cfg = getConfig(), fires = buildings.filter(b => b.configId === 'herbalFire');
    for (const [index, fire] of fires.entries()) {
      if (index || !fire.built || fire.hp <= 0 || season !== Season.Winter) { fire.wardActive = false; continue; }
      let left = dt;
      while (left > 0) {
        if ((fire.wardFuelSeconds ?? 0) <= 0) {
          if (resources.resources.herbs < 1) break;
          resources.resources.herbs--; fire.wardFuelSeconds = cfg.seasons.winterDuration / cfg.herbs.perWinter;
        }
        const burned = Math.min(left, fire.wardFuelSeconds!);
        fire.wardFuelSeconds = Math.max(0, fire.wardFuelSeconds! - burned); left -= burned;
      }
      fire.wardActive = (fire.wardFuelSeconds ?? 0) > 0 || resources.resources.herbs > 0;
    }
    this.update(buildings);
  }
  update(buildings: BuildingInstance[]): void {
    const zones = protectionZones(buildings, getConfig().buildings);
    const key = zones.map(z => `${z.buildingId}:${z.x}:${z.y}:${z.radius}`).join('|');
    if (key === this.key) return;
    this.key = key; this.zones = zones; this.tiles.clear(); this.revision++;
    for (const z of zones) for (let y = z.y - z.radius; y <= z.y + z.radius; y++)
      for (let x = z.x - z.radius; x <= z.x + z.radius; x++) this.tiles.add(`${x},${y}`);
  }
  blocksTile(x: number, y: number): boolean { return this.tiles.has(`${x},${y}`); }
  blocksPoint(x: number, y: number): boolean { return this.blocksTile(Math.floor(x + .5), Math.floor(y + .5)); }
  /** A newly lit fire repels an enemy already inside, including overlapping wards. */
  nearestOutside(x: number, y: number, walkable: (x: number, y: number) => boolean): Position | null {
    const map = getConfig().map, candidates: Position[] = [];
    for (const z of this.zones) {
      const r = z.radius + 1;
      for (let d = -r; d <= r; d++) candidates.push(
        { x: z.x + d, y: z.y - r }, { x: z.x + d, y: z.y + r },
        { x: z.x - r, y: z.y + d }, { x: z.x + r, y: z.y + d });
    }
    return candidates.filter(p => p.x >= 0 && p.y >= 0 && p.x < map.mapWidth && p.y < map.mapHeight && !this.blocksTile(p.x, p.y) && walkable(p.x, p.y))
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0] ?? null;
  }
}
