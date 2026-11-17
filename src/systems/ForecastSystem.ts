import { Season } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { SeasonSystem } from './SeasonSystem';
import { ResourceSystem } from './ResourceSystem';
import { BuildingSystem } from './BuildingSystem';
import { VillagerSystem } from './VillagerSystem';
import { heatedShelters } from './HeatingSystem';
import { hasCoat } from './EquipmentSystem';

const order = [Season.Spring, Season.Summer, Season.Autumn, Season.Winter];
function durations() { const c = getConfig().seasons; return [c.springDuration, c.summerDuration, c.autumnDuration, c.winterDuration]; }
export function untilWinter(seasons: SeasonSystem): number {
  if (seasons.isWinter()) return 0;
  const times = durations(), index = order.indexOf(seasons.season);
  return times.slice(index, -1).reduce((a, b) => a + b, 0) - seasons.seasonTimer;
}
export function cropSecondsToRipe(progress: number, seasons: SeasonSystem): number {
  if (seasons.isWinter()) return Infinity;
  let remaining = (1 - progress) * getConfig().farming.growthSeasons, seconds = 0;
  const times = durations(), index = order.indexOf(seasons.season);
  for (let i = index; i < order.length - 1; i++) {
    const fraction = i === index ? Math.max(0, 1 - seasons.seasonTimer / times[i]) : 1;
    const used = Math.min(fraction, remaining); seconds += used * times[i]; remaining -= used;
    if (remaining <= 1e-8) return seconds;
  }
  return Infinity;
}
export function makeForecast(seasons: SeasonSystem, resources: ResourceSystem, buildings: BuildingSystem, villagers: VillagerSystem) {
  const cfg = getConfig(), people = villagers.getAliveVillagers(), population = people.length;
  const beforeWinter = untilWinter(seasons), winterLeft = seasons.isWinter() ? Math.max(0, cfg.seasons.winterDuration - seasons.seasonTimer) : cfg.seasons.winterDuration;
  const winterFood = population * cfg.villagers.foodConsumptionPerSecond * cfg.villagers.winterFoodConsumptionMultiplier * winterLeft;
  const beforeFood = population * cfg.villagers.foodConsumptionPerSecond * beforeWinter;
  const crops = buildings.getBuildingsOfType('garden').filter(b => b.cropState === 'growing' || b.cropState === 'ripe').map(b => {
    const seconds = b.cropState === 'ripe' ? 0 : cropSecondsToRipe(b.farmingProgress ?? 0, seasons);
    const farmers = people.filter(v => v.assignedBuildingId === b.id && v.currentTask === 'farming').length;
    const harvestSeconds = Math.max(0, cfg.farming.harvestWorkSeconds - (b.harvestProgress ?? 0)) / Math.max(1, farmers);
    return { id: b.id, seconds, farmers, harvestSeconds, amount: b.harvestRemaining ?? cfg.farming.harvestFood };
  });
  const expectedHarvest = crops.filter(c => c.farmers > 0 && c.seconds + c.harvestSeconds < beforeWinter).reduce((n, c) => n + c.amount, 0);
  const fire = buildings.getBuildingsOfType('herbalFire')[0];
  const herbSeconds = cfg.seasons.winterDuration / cfg.herbs.perWinter;
  const fuel = fire?.wardFuelSeconds ?? 0;
  const houses=heatedShelters(buildings.buildings),heatingWoodNeeded=houses.length*cfg.heating.woodPerShelterPerWinter*winterLeft/cfg.seasons.winterDuration;
  const coats = people.filter(hasCoat).length;
  const exposed = people.filter(v => (v.coldExposure ?? 0) >= cfg.cold.warningFraction * cfg.cold.unclothedSurvivalSeconds).length;
  return { heatedShelters:houses.length,heatingWoodNeeded,woodBalance:resources.resources.wood-heatingWoodNeeded,unheatedShelters:seasons.isWinter()&&resources.resources.wood<=0?houses.length:0,population, food: resources.resources.food, winterFood, beforeFood, expectedHarvest,
    reserve: winterFood * (1 + cfg.forecast.foodReserveBuffer),
    springBalance: resources.resources.food + expectedHarvest - beforeFood - winterFood,
    nextHarvestSeconds: crops.length ? Math.min(...crops.map(c => c.seconds)) : null,
    dyingCrops: crops.filter(c => !Number.isFinite(c.seconds)).length,
    coats, coatsStored: resources.resources.clothing, exposed,
    herbs: resources.resources.herbs, herbCapacity: cfg.herbs.capacity,
    herbsInTransit: people.reduce((n, v) => n + (v.cargo?.herbs ?? 0), 0),
    herbsNeeded: Math.ceil(Math.max(0, winterLeft - fuel) / herbSeconds - 1e-8),
    wardSeconds: fire ? fuel + resources.resources.herbs * herbSeconds : 0, hasWard: !!fire,
    nextStars: seasons.year <= cfg.technology.firstWinterRewardCount ? cfg.technology.earlyWinterStars : cfg.technology.laterWinterStars };
}
export type EconomyForecast = ReturnType<typeof makeForecast>;
