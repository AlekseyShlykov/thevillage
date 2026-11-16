import { BuildingSystem } from './BuildingSystem';
import { ResourceSystem } from './ResourceSystem';
import { VillagerSystem } from './VillagerSystem';
import { TechnologySystem } from './TechnologySystem';
import { getConfig } from '../data/ConfigLoader';
import { HealthState, VillagerState } from '../types';
import { TileMap } from '../world/TileMap';
import { workerProductivity } from './EquipmentSystem';

/** Production is time-based, uses workers actually on site, and survives saving. */
export class ProductionSystem {
  update(dt: number, buildings: BuildingSystem, villagers: VillagerSystem, resources: ResourceSystem,
    tech: TechnologySystem, map: TileMap, onHarvest: (amount: number) => void, onClothing: (amount: number) => void): void {
    const cfg = getConfig(), rates = cfg.resources;
    for (const b of buildings.buildings) {
      if (!b.built) continue;
      b.assignedWorkers = b.assignedWorkers.filter(id => {
        const v = villagers.getVillagerById(id);
        return v && v.health !== HealthState.Dead && v.assignedBuildingId === b.id;
      });
      const arrival = new Set(buildings.getArrivalTiles(b).map(t => `${t.x},${t.y}`));
      const workers = b.assignedWorkers.map(id => villagers.getVillagerById(id)!).filter(v =>
        v.state === VillagerState.Working && arrival.has(`${Math.floor(v.x)},${Math.floor(v.y)}`));
      const work = workers.reduce((sum, v) => sum + workerProductivity(v, tech), 0) * dt;
      if (work <= 0) continue;
      switch (b.configId) {
        case 'lumberCamp': {
          const radius = cfg.buildings.lumberCamp.boostRadius!;
          let forest = false;
          for (let dy = -radius; dy <= radius && !forest; dy++) for (let dx = -radius; dx <= radius; dx++) {
            if (map.getTile(b.tileX + dx, b.tileY + dy)?.type === 'forest') { forest = true; break; }
          }
          if (forest) resources.addWood(rates.lumberCampWoodPerSecond * work);
          break;
        }
        case 'workshop':
        case 'furWorkshop': {
          const isTools = b.configId === 'workshop', duration = isTools ? rates.workshopToolProductionTime : rates.furWorkshopProcessTime;
          if(isTools ? resources.resources.wood<rates.workshopToolCostWood || resources.resources.tools>=resources.capacity.tools : resources.resources.fur<rates.furPerClothing) break;
          b.productionProgress = Math.min(duration, (b.productionProgress ?? 0) + work);
          if (b.productionProgress < duration) break;
          if (isTools && resources.resources.tools < resources.capacity.tools && resources.consumeWood(rates.workshopToolCostWood)) {
            resources.addTools(1); b.productionProgress -= duration;
          } else if (!isTools && resources.resources.fur >= rates.furPerClothing) {
            resources.resources.fur -= rates.furPerClothing; onClothing(1); b.productionProgress -= duration;
          }
          break;
        }
      }
    }
  }
}
