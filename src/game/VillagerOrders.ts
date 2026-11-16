import { BuildingConfig, BuildingInstance, TileData, VillagerData } from '../types';

export const villagerOrders = {
  chop: { label: 'Chop', icon: 'axe', hint: 'Choose a tree to chop.' },
  hunt: { label: 'Hunt here', icon: 'bow', hint: 'Choose a forest tile to hunt in.' },
  farm: { label: 'Farm', icon: 'wheat', hint: 'Choose a finished garden.' },
  build: { label: 'Build', icon: 'hammer', hint: 'Choose an unfinished construction site.' },
  repair: { label: 'Repair', icon: 'repair', hint: 'Choose a damaged building.' },
  work: { label: 'Work', icon: 'work', hint: 'Choose a garden, camp or workshop with a free place.' },
  move: { label: 'Move', icon: 'move', hint: 'Choose a walkable place to go.' },
  stop: { label: 'Stop', icon: 'stop', hint: 'Release this villager from their current job.' },
} as const;
export type VillagerOrder = keyof typeof villagerOrders;
export type TargetedVillagerOrder = Exclude<VillagerOrder, 'stop'>;
export function validJobTarget(order: TargetedVillagerOrder, tile: TileData | null, building: BuildingInstance | null, cfg: BuildingConfig | null, villagerId: string): boolean {
  if (order === 'chop' || order === 'hunt') return tile?.type === 'forest';
  if (order === 'move') return !!tile && !tile.buildingId;
  if (!building || !cfg) return false;
  if (order === 'build') return !building.built && (!building.assignedWorkers.length || building.assignedWorkers.includes(villagerId));
  if (order === 'repair') return building.built && (building.hp < building.maxHp || !!building.needsRepair);
  return building.built && (order !== 'farm' || building.configId === 'garden') && cfg.maxWorkers > 0 &&
    (building.assignedWorkers.length < cfg.maxWorkers || building.assignedWorkers.includes(villagerId));
}
const taskNames: Record<string, string> = {
  clearing: 'Chopping wood', hunting: 'Hunting', farming: 'Tending crops',
  building: 'Building', repairing: 'Repairing', working: 'Working', returnHome: 'Going to shelter',
};
export function villagerActivity(v: VillagerData): string {
  const task = v.currentTask ? taskNames[v.currentTask] ?? 'Working' : v.holdPosition ? 'Waiting for orders' : 'Ready for work';
  return v.path.length ? v.currentTask === 'returnHome' ? task : `On the way · ${v.currentTask ? task.toLowerCase() : 'moving'}` : task;
}
