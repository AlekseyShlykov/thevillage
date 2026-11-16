import { HealthState, Season, VillagerData, VillagerState } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { ResourceSystem } from './ResourceSystem';
import { TechnologySystem } from './TechnologySystem';

export const hasTool = (v: VillagerData): boolean => v.health !== HealthState.Dead;
export const hasCoat = (v: VillagerData): boolean => (v.clothingWintersLeft ?? 0) > 0;
export function workerProductivity(v: VillagerData, tech: TechnologySystem): number {
  const cfg = getConfig();
  return v.health === HealthState.Injured ? cfg.villagers.injuredWorkPenalty : 1;
}

/** Every resident owns permanent work tools. Only individual fur coats wear out. */
export class EquipmentSystem {
  update(dt: number, people: VillagerData[], resources: ResourceSystem, season: Season): void {
    const cfg = getConfig(), alive = people.filter(v => v.health !== HealthState.Dead);
    for (const v of alive) {
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
    }
  }
}
