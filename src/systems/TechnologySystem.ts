import { BuildingInstance, ResearchOption, TechConfig } from '../types';
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

  getAvailableTechs(_currentLevel: number,buildings:BuildingInstance[]=[]): ResearchOption[] {
    return Object.values(this.getAllTechs())
      .filter(t=>!this.unlockedTechs.has(t.id) && (t.visibleAfter
        ? t.visibleAfter.every(id=>this.unlockedTechs.has(id)) : this.requirementsMet(t,buildings)))
      .map(t=>({...t,blockedReason:this.getBlockedReason(t,buildings)}));
  }

  private getBlockedReason(tech: TechConfig, buildings: BuildingInstance[]): string | null {
    const missingTech = tech.prerequisites?.find(id=>!this.unlockedTechs.has(id));
    if (missingTech) return `Research ${this.getAllTechs()[missingTech]?.name ?? missingTech} first.${tech.requiresBuildings?.includes(missingTech) ? ' Then complete the building.' : ''}`;
    const missingBuilding = tech.requiresBuildings?.find(id=>!buildings.some(b=>b.built&&b.configId===id));
    return missingBuilding ? `Complete a ${getConfig().buildings[missingBuilding].name} before researching ${tech.name}.` : null;
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
