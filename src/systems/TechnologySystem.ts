import { TechConfig } from '../types';
import { getConfig } from '../data/ConfigLoader';

export class TechnologySystem {
  public unlockedTechs: Set<string> = new Set();
  public unlockedBuildings: Set<string> = new Set(['hut', 'palisadeWall', 'palisadeGate']);

  getAllTechs(): Record<string, TechConfig> {
    return getConfig().technology.techs;
  }

  getAvailableTechs(currentLevel: number): TechConfig[] {
    const allTechs = this.getAllTechs();
    const levels = getConfig().levels;
    const levelData = levels[String(currentLevel)];
    if (!levelData) return [];

    const availableTiers = new Set(levelData.availableTiers);
    const result: TechConfig[] = [];

    for (const tech of Object.values(allTechs)) {
      if (this.unlockedTechs.has(tech.id)) continue;
      if (!availableTiers.has(tech.tier)) continue;
      result.push(tech);
    }

    return result;
  }

  canUnlock(techId: string, techPoints: number, currentLevel: number): boolean {
    const tech = this.getAllTechs()[techId];
    if (!tech) return false;
    if (this.unlockedTechs.has(techId)) return false;

    const levels = getConfig().levels;
    const levelData = levels[String(currentLevel)];
    if (!levelData) return false;
    if (!levelData.availableTiers.includes(tech.tier)) return false;

    return techPoints >= tech.cost;
  }

  unlockTech(techId: string): string[] {
    const tech = this.getAllTechs()[techId];
    if (!tech) return [];

    this.unlockedTechs.add(techId);
    const newBuildings: string[] = [];
    for (const buildingId of tech.unlocks) {
      this.unlockedBuildings.add(buildingId);
      newBuildings.push(buildingId);
    }
    return newBuildings;
  }

  /** Reset tech to initial state (for new game). */
  reset(): void {
    this.unlockedTechs = new Set();
    this.unlockedBuildings = new Set(['hut']);
  }

  isTechUnlocked(techId: string): boolean {
    return this.unlockedTechs.has(techId);
  }

  isBuildingUnlocked(buildingId: string): boolean {
    return this.unlockedBuildings.has(buildingId);
  }

  getEffect(effectName: string): number | null {
    const allTechs = this.getAllTechs();
    for (const techId of this.unlockedTechs) {
      const tech = allTechs[techId];
      if (tech?.effect && effectName in tech.effect) {
        return tech.effect[effectName];
      }
    }
    return null;
  }

  serialize(): { unlockedTechs: string[]; unlockedBuildings: string[] } {
    return {
      unlockedTechs: Array.from(this.unlockedTechs),
      unlockedBuildings: Array.from(this.unlockedBuildings),
    };
  }

  deserialize(data: { unlockedTechs: string[]; unlockedBuildings: string[] }): void {
    this.unlockedTechs = new Set(data.unlockedTechs);
    this.unlockedBuildings = new Set(data.unlockedBuildings);
  }
}
