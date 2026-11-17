import { BuildingInstance, ResourceState, TileData, TileType, VillagerData, VillagerState } from '../types';
import { getConfig } from '../data/ConfigLoader';

/** Remove retired jobs and footprints once; subsequent saves contain the current catalogue. */
export function migrateRetiredBuildings(saved: Record<string, unknown>): Record<string, unknown> {
  const cfg = getConfig(), retired = cfg.retiredBuildings;
  const buildings = (saved.buildings ?? []) as BuildingInstance[];
  const technology = saved.technology as { unlockedTechs: string[]; unlockedBuildings: string[] } | undefined;
  const needsMigration = buildings.some(b => retired[b.configId] || (b.built && b.assignedWorkers.length && !cfg.buildings[b.configId]?.maxWorkers)) ||
    technology?.unlockedTechs.some(id => retired[id]) || technology?.unlockedBuildings.some(id => retired[id]);
  if (!needsMigration) return saved;

  const techs = new Set(technology?.unlockedTechs ?? []);
  const unlocked = new Set(technology?.unlockedBuildings ?? ['hut']);
  let wood = 0, tools = 0, research = 0;
  for (const [id, rule] of Object.entries(retired)) {
    unlocked.delete(id);
    if (!techs.delete(id)) continue;
    research += rule.refundResearch;
    if (rule.replacement && !techs.has(rule.replacement)) {
      techs.add(rule.replacement); unlocked.add(rule.replacement);
      research -= rule.replacementResearchCost??cfg.technology.techs[rule.replacement].cost;
    }
  }

  const removed = new Set<string>(), released = new Set<string>();
  const current: BuildingInstance[] = [];
  for (const b of buildings) {
    const rule = retired[b.configId];
    if (rule && !rule.replacement) {
      removed.add(b.id); released.add(b.id);
      wood += rule.refundWood; tools += rule.refundTools;
      continue;
    }
    const configId = rule?.replacement ?? b.configId, next = cfg.buildings[configId];
    const passive = b.built && !next?.maxWorkers;
    if (rule || passive) released.add(b.id);
    current.push({ ...b, configId, assignedWorkers: rule || passive ? [] : [...b.assignedWorkers],
      ...(rule && next ? { maxHp: next.hp, hp: Math.min(next.hp, next.hp * b.hp / b.maxHp) } : {}) });
  }
  const capacity = (resource: 'wood' | 'tools') => cfg.storage[resource === 'wood' ? 'baseWoodCapacity' : 'baseToolCapacity'] +
    current.reduce((sum, b) => sum + (b.built ? cfg.buildings[b.configId]?.storageBonus?.[resource] ?? 0 : 0), 0);
  const resources = saved.resources as ResourceState;
  const villagers = ((saved.villagers ?? []) as VillagerData[]).map(v => released.has(v.assignedBuildingId ?? '') ?
    { ...v, assignedBuildingId: null, currentTask: null, path: [], targetX: null, targetY: null, state: VillagerState.Idle, taskProgress: 0 } : v);
  const tileMap = (saved.tileMap as TileData[][] | undefined)?.map(row => row.map(t => removed.has(t.buildingId ?? '') ?
    { ...t, buildingId: null, type: TileType.Clear, markedForClearing: false, clearingProgress: 0 } : { ...t }));
  const jobs = (saved.shelteredJobs ?? []) as { buildingId?: string }[];
  return { ...saved, buildings: current, villagers, tileMap,
    technology: { unlockedTechs: [...techs], unlockedBuildings: [...unlocked] },
    shelteredJobs: jobs.filter(j => !released.has(j.buildingId ?? '')),
    resources: { ...resources, wood: Math.min(resources.wood + wood, Math.max(resources.wood, capacity('wood'))),
      tools: Math.min(resources.tools + tools, Math.max(resources.tools, capacity('tools'))), techPoints: resources.techPoints + research } };
}
