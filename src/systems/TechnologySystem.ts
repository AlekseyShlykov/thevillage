import { BuildingInstance, TechConfig } from '../types';
import { getConfig } from '../data/ConfigLoader';

export class TechnologySystem {
  public unlockedTechs: Set<string> = new Set(getConfig().technology.initialTechs);
  public unlockedBuildings: Set<string> = this.getInitialBuildings();

  private getInitialBuildings(): Set<string> {
    return new Set(getConfig().technology.initialBuildings);
  }

  getAllTechs(): Record<string, TechConfig> {
    return getConfig().technology.techs;
  }

  getAvailableTechs(_currentLevel: number,buildings:BuildingInstance[]=[]): TechConfig[] {
    return Object.values(this.getAllTechs()).filter(t=>!this.unlockedTechs.has(t.id)&&this.requirementsMet(t,buildings));
  }

  private requirementsMet(tech:TechConfig,buildings:BuildingInstance[]):boolean {
    return (tech.prerequisites??[]).every(id=>this.unlockedTechs.has(id))&&
      (tech.requiresBuildings??[]).every(id=>buildings.some(b=>b.built&&b.configId===id));
  }
  canUnlock(techId: string, techPoints: number, _currentLevel: number,buildings:BuildingInstance[]=[]): boolean {
    const tech = this.getAllTechs()[techId];
    if (!tech) return false;
    if (this.unlockedTechs.has(techId)) return false;

    return this.requirementsMet(tech,buildings)&&techPoints>=tech.cost;
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
    this.unlockedTechs = new Set(getConfig().technology.initialTechs);
    this.unlockedBuildings = this.getInitialBuildings();
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
