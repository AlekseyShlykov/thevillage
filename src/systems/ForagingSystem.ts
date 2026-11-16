import { HealthState, Position, TileType, VillagerData, VillagerState } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { TileMap } from '../world/TileMap';
import { BuildingSystem } from './BuildingSystem';
import { ResourceSystem } from './ResourceSystem';
import { VillagerSystem } from './VillagerSystem';
import { TechnologySystem } from './TechnologySystem';
import { TutorialSystem } from './TutorialSystem';
import { workerProductivity } from './EquipmentSystem';

/** Outbound expeditions reserve herb capacity; only a living carrier at home delivers loot. */
export class ForagingSystem {
  constructor(private map: TileMap) {}
  reservedHerbs(villagers: VillagerSystem): number {
    return villagers.getAliveVillagers().reduce((n, v) => n + (v.cargo?.herbs ?? 0) + Number(v.currentTask === 'gatheringHerbs'), 0);
  }
  gather(id: string, villagers: VillagerSystem, resources: ResourceSystem, requested?: Position): boolean {
    const v = villagers.getVillagerById(id), cfg = getConfig().herbs;
    if (!v || v.health === HealthState.Dead || v.currentTask === 'gatheringHerbs' || Object.values(v.cargo ?? {}).some(n => n > 0) ||
      resources.resources.herbs + this.reservedHerbs(villagers) >= cfg.capacity) return false;
    if (requested && this.map.getTile(requested.x, requested.y)?.type !== TileType.Forest) return false;
    const candidates = villagers.huntingGrounds.candidates(v, requested, {
      minimum: cfg.minimumForestDepth, maximum: cfg.maximumForestDepth, searchRadius: cfg.searchRadius,
    }).filter(p => !villagers.getAliveVillagers().some(o => o.id !== id && o.currentTask === 'gatheringHerbs' && o.targetX === p.x && o.targetY === p.y));
    const depth = cfg.minimumForestDepth + Math.floor(Math.random() * (cfg.maximumForestDepth - cfg.minimumForestDepth + 1));
    candidates.sort((a, b) => Math.abs(villagers.huntingGrounds.depthAt(a.x, a.y) - depth) - Math.abs(villagers.huntingGrounds.depthAt(b.x, b.y) - depth));
    for (const p of candidates) if (villagers.assignPath(v, p.x, p.y)) {
      v.currentTask = 'gatheringHerbs'; v.taskProgress = 0; return true;
    }
    return false;
  }
  update(dt: number, villagers: VillagerSystem, buildings: BuildingSystem, resources: ResourceSystem,
    tech: TechnologySystem, tutorial: TutorialSystem, notify: (s: string) => void): void {
    const cfg = getConfig(), homes: Position[] = [];
    for (const b of buildings.buildings) {
      const spec = buildings.getBuildingConfig(b.configId);
      if (!b.built || spec?.category !== 'housing') continue;
      for (let y = b.tileY; y < b.tileY + spec.height; y++) for (let x = b.tileX; x < b.tileX + spec.width; x++) homes.push({ x, y });
    }
    const homeKeys = new Set(homes.map(p => `${p.x},${p.y}`));
    for (const v of villagers.getAliveVillagers()) {
      if (v.currentTask === 'hunting' && v.state === VillagerState.Working && !v.path.length) {
        v.taskProgress += dt * workerProductivity(v, tech);
        if (v.taskProgress >= cfg.villagers.freeHuntDuration) {
          if (!tutorial.isProtectedHunter(v.id) && Math.random() < cfg.villagers.freeHuntDeathChance) {
            villagers.damageVillager(v, v.maxHp); notify('A hunter died in the forest. Their supplies were lost.');
          } else {
            v.cargo = { food: cfg.villagers.freeHuntFoodAmount, fur: cfg.villagers.freeHuntFurAmount, herbs: 0 };
            v.currentTask = 'returnHome'; v.path = []; v.state = VillagerState.Idle;
          }
          tutorial.onHuntResolved(v.id);
        }
      } else if (v.currentTask === 'gatheringHerbs' && v.state === VillagerState.Working && !v.path.length) {
        v.taskProgress += dt * workerProductivity(v, tech);
        if (v.taskProgress >= cfg.herbs.gatherSeconds) {
          if (Math.random() < cfg.herbs.deathChance) {
            villagers.damageVillager(v, v.maxHp); notify('A herb gatherer died deep in the forest. Their supplies were lost.'); continue;
          }
          v.cargo = { food: 0, fur: 0, herbs: resources.resources.herbs + this.reservedHerbs(villagers) <= cfg.herbs.capacity ? 1 : 0 };
          v.currentTask = 'returnHome'; v.path = []; v.state = VillagerState.Idle;
        }
      }
      if (v.health === HealthState.Dead || !Object.values(v.cargo ?? {}).some(n => n > 0)) continue;
      if (homeKeys.has(`${Math.floor(v.x)},${Math.floor(v.y)}`)) {
        const cargo = v.cargo!; resources.addFood(cargo.food); resources.addFur(cargo.fur); resources.addHerbs(cargo.herbs);
        notify(cargo.herbs ? `Protective herbs delivered: ${resources.resources.herbs}/${cfg.herbs.capacity}` : `Hunt delivered: +${cargo.food} food, +${cargo.fur} pelts`);
        v.cargo = undefined;
        if (v.currentTask === 'returnHome') { v.currentTask = null; v.taskProgress = 0; v.path = []; v.state = VillagerState.Idle; }
      } else if (!v.path.length && v.currentTask === 'returnHome') {
        for (const p of homes.slice().sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y)))
          if (villagers.assignPath(v, p.x, p.y)) { v.currentTask = 'returnHome'; break; }
      }
    }
  }
}
