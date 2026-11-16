import { BuildingInstance, HealthState, Season, VillagerState } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { BuildingSystem } from './BuildingSystem';
import { ResourceSystem } from './ResourceSystem';
import { VillagerSystem } from './VillagerSystem';
import { TechnologySystem } from './TechnologySystem';
import { workerProductivity } from './EquipmentSystem';

/** Biological growth uses calendar seasons, unaffected by worker count or tools. */
export class CropSystem {
  winter(buildings: BuildingInstance[]): void {
    for (const b of buildings.filter(b => b.configId === 'garden')) {
      b.cropState = 'withered'; b.farmingProgress = 0; b.sowingProgress = 0;
      b.harvestProgress = 0; b.harvestRemaining = 0; b.productionProgress = 0;
    }
  }
  update(dt: number, season: Season, seasonDuration: number, buildings: BuildingSystem, villagers: VillagerSystem,
    resources: ResourceSystem, tech: TechnologySystem, onHarvest: (amount: number) => void): void {
    if (season === Season.Winter) return;
    const cfg = getConfig().farming;
    for (const b of buildings.buildings.filter(b => b.built && b.configId === 'garden')) {
      b.cropState ??= (b.farmingProgress ?? 0) > 0 ? 'growing' : 'empty';
      const arrivals = new Set(buildings.getArrivalTiles(b).map(p => `${p.x},${p.y}`));
      const workers = villagers.villagers.filter(v => v.health !== HealthState.Dead && v.assignedBuildingId === b.id &&
        v.currentTask === 'farming' && v.state === VillagerState.Working && !v.path.length && arrivals.has(`${Math.floor(v.x)},${Math.floor(v.y)}`));
      const work = workers.reduce((n, v) => n + workerProductivity(v, tech), 0) * dt;
      if (b.cropState === 'empty' || b.cropState === 'withered') {
        b.sowingProgress = (b.sowingProgress ?? 0) + work;
        if (b.sowingProgress < cfg.sowingWorkSeconds) continue;
        b.cropState = 'growing'; b.farmingProgress = 0; b.harvestProgress = 0; b.harvestRemaining = cfg.harvestFood;
        continue;
      }
      if (b.cropState === 'growing') {
        b.farmingProgress = Math.min(1, (b.farmingProgress ?? 0) + dt / seasonDuration / cfg.growthSeasons);
        if (b.farmingProgress < 1) continue;
        b.cropState = 'ripe';
      }
      if (!work) continue;
      b.harvestProgress = Math.min(cfg.harvestWorkSeconds, (b.harvestProgress ?? 0) + work);
      if (b.harvestProgress < cfg.harvestWorkSeconds) continue;
      const amount = Math.min(b.harvestRemaining ?? cfg.harvestFood, Math.max(0, resources.capacity.food - resources.resources.food));
      const firstDelivery=(b.harvestRemaining??cfg.harvestFood)===cfg.harvestFood;
      resources.addFood(amount); b.harvestRemaining = (b.harvestRemaining ?? cfg.harvestFood) - amount;
      if(firstDelivery && amount>0) onHarvest(amount);
      if (b.harvestRemaining <= 0) {
        b.cropState = 'empty'; b.farmingProgress = 0; b.sowingProgress = 0; b.harvestProgress = 0;
      }
    }
  }
}
