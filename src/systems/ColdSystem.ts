import { HealthState, Position, Season, VillagerData } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { hasCoat } from './EquipmentSystem';

/** Only worn fur clothing protects outdoors; raw pelts have no warming effect. */
export class ColdSystem {
  update(dt: number, people: VillagerData[], shelters: Position[], season: Season, snowstorm: boolean,
    onDeath: (v: VillagerData) => void): void {
    const cfg = getConfig().cold, inside = new Set(shelters.map(p => `${p.x},${p.y}`));
    for (const v of people) {
      if (v.health === HealthState.Dead) continue;
      if (season !== Season.Winter) { v.coldExposure = 0; v.timeOutsideInWinter = 0; continue; }
      if (inside.has(`${Math.floor(v.x)},${Math.floor(v.y)}`)) {
        v.coldExposure = Math.max(0, (v.coldExposure ?? 0) - dt * cfg.warmupMultiplier); v.timeOutsideInWinter = 0;
      } else {
        v.timeOutsideInWinter = (v.timeOutsideInWinter ?? 0) + dt;
        v.coldExposure = (v.coldExposure ?? 0) + dt * (hasCoat(v) ? cfg.clothedExposureMultiplier : 1) *
          (snowstorm ? cfg.snowstormExposureMultiplier : 1);
        if (v.coldExposure >= cfg.unclothedSurvivalSeconds) onDeath(v);
      }
    }
  }
}
