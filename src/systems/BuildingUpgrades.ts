import { BuildingInstance, BuildingUpgradeConfig } from '../types';
import { getConfig } from '../data/ConfigLoader';

export function isConstructionSite(b: BuildingInstance): boolean {
  return !b.built || b.upgradeProgress !== undefined;
}

export function buildingUpgrade(b: BuildingInstance): BuildingUpgradeConfig | null {
  return b.built && !b.upgraded ? getConfig().buildings[b.configId]?.upgrade ?? null : null;
}

export function upgradeRequirement(b: BuildingInstance, technologies: Set<string>, buildings: BuildingInstance[]): string | null {
  const upgrade = buildingUpgrade(b);
  if (!upgrade) return 'This building is already fully upgraded.';
  const cfg = getConfig();
  if (!technologies.has(upgrade.technology)) return `Research ${cfg.technology.techs[upgrade.technology]?.name ?? upgrade.technology} first.`;
  const missing = upgrade.requiresBuildings?.find(id => !buildings.some(other => other.built && other.configId === id));
  return missing ? `Complete a ${cfg.buildings[missing].name} first.` : null;
}

/** Keep the original identity, footprint, residents, damage fraction and gate state. */
export function completeUpgrade(b: BuildingInstance): void {
  const upgrade = buildingUpgrade(b);
  if (!upgrade) { delete b.upgradeProgress; return; }
  const fraction = b.hp / b.maxHp;
  if (upgrade.targetId) b.configId = upgrade.targetId;
  else b.upgraded = true;
  b.maxHp = getConfig().buildings[b.configId].hp * (b.upgraded ? upgrade.hpMultiplier ?? 1 : 1);
  b.hp = b.maxHp * fraction;
  delete b.upgradeProgress;
}
