import { HealthState, Season, VillagerData, VillagerState } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { ResourceSystem } from './ResourceSystem';
import { TechnologySystem } from './TechnologySystem';

export const hasTool = (v: VillagerData): boolean => (v.toolDurability ?? 0) > 0;
export const hasCoat = (v: VillagerData): boolean => (v.clothingWintersLeft ?? 0) > 0;
export function workerProductivity(v: VillagerData, tech: TechnologySystem): number {
  const cfg = getConfig();
  return (v.health === HealthState.Injured ? cfg.villagers.injuredWorkPenalty : 1) *
    (hasTool(v) ? tech.getEffect('toolProductivityBonus') ?? cfg.resources.toolProductivityBonus : 1);
}

/** Stored equipment is issued to individuals. Work wears tools; winters wear coats. */
export class EquipmentSystem {
  update(dt: number, people: VillagerData[], resources: ResourceSystem, season: Season): void {
    const cfg = getConfig(), alive = people.filter(v => v.health !== HealthState.Dead);
    for (const v of alive) {
      if (hasTool(v) && v.currentTask && !v.path.length && [VillagerState.Working, VillagerState.Building, VillagerState.Defending].includes(v.state))
        v.toolDurability = Math.max(0, v.toolDurability! - dt);
      if (hasCoat(v) && season === Season.Winter)
        v.clothingWintersLeft = Math.max(0, v.clothingWintersLeft! - dt / cfg.seasons.winterDuration);
    }
    this.issue(alive, resources);
  }
  issue(people: VillagerData[], resources: ResourceSystem): void {
    const cfg = getConfig();
    for (const v of people.filter(v => v.health !== HealthState.Dead)) {
      if (!hasCoat(v) && resources.resources.clothing >= 1) {
        resources.resources.clothing--; v.clothingWintersLeft = cfg.equipment.clothingLifetimeWinters;
      }
      if (!hasTool(v) && v.currentTask && v.currentTask !== 'returnHome' && resources.consumeTools(1))
        v.toolDurability = cfg.equipment.toolWorkSeconds;
    }
  }
}
