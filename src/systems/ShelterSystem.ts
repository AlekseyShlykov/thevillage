import { BuildingInstance, Position, VillagerData } from '../types';
import { getConfig } from '../data/ConfigLoader';
import type { VillagerSystem } from './VillagerSystem';

/** Reserve a home group, fill reachable tower places, then shelter everybody else at home. */
export function assignSettlementShelters(villagers: VillagerSystem, tiles: Position[], buildings: BuildingInstance[]): number {
  villagers.setShelters(tiles);
  if (!tiles.length) return 0;
  const cfg = getConfig(), people = villagers.getAliveVillagers();
  const towers = buildings.filter(b => b.built && b.configId === 'watchtower');
  const towerTiles = new Set(towers.map(b => `${b.tileX},${b.tileY}`));
  const homes = tiles.filter(p => !towerTiles.has(`${p.x},${p.y}`));
  const unusedHomes = [...homes], assigned = new Set<string>();
  const distance = (v: VillagerData, p: Position) => Math.hypot(v.x - p.x, v.y - p.y);
  const nearest = (v: VillagerData, destinations: Position[]) => Math.min(...destinations.map(p => distance(v, p)));
  const sendHome = (v: VillagerData): boolean => {
    const choices = (unusedHomes.length ? unusedHomes : homes).slice().sort((a, b) => distance(v, a) - distance(v, b));
    for (const p of choices) if (villagers.sendVillagerToHousing(v.id, p.x, p.y)) {
      const index = unusedHomes.indexOf(p); if (index >= 0) unusedHomes.splice(index, 1);
      assigned.add(v.id); return true;
    }
    // A free doorway may be disconnected even though an occupied home tile is reachable.
    if (unusedHomes.length) for (const p of homes) if (villagers.sendVillagerToHousing(v.id, p.x, p.y)) {
      assigned.add(v.id); return true;
    }
    return false;
  };

  const homeReserve = homes.length ? Math.min(people.length, Math.max(cfg.gameplay.shelterMinimumHomeResidents,
    Math.ceil(people.length * cfg.gameplay.shelterHomeReserveFraction))) : 0;
  for (const v of people.slice().sort((a, b) => nearest(a, homes) - nearest(b, homes))) {
    if (assigned.size >= homeReserve) break;
    sendHome(v);
  }

  const places = new Map(towers.map(b => [b.id, cfg.buildings[b.configId].capacity]));
  const towerPositions = towers.map(b => ({ x: b.tileX, y: b.tileY }));
  for (const v of people.filter(v => !assigned.has(v.id)).sort((a, b) => nearest(a, towerPositions) - nearest(b, towerPositions))) {
    const choices = towers.slice().sort((a, b) => distance(v, { x: a.tileX, y: a.tileY }) - distance(v, { x: b.tileX, y: b.tileY }));
    for (const tower of choices) {
      if (!places.get(tower.id)) continue;
      if (!villagers.sendVillagerToHousing(v.id, tower.tileX, tower.tileY)) continue;
      places.set(tower.id, places.get(tower.id)! - 1); assigned.add(v.id); break;
    }
  }
  for (const v of people) if (!assigned.has(v.id)) sendHome(v);
  return assigned.size;
}
