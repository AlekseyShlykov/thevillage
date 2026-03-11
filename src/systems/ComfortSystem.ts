import { getConfig } from '../data/ConfigLoader';

export interface ComfortInputs {
  foodRatio: number;
  warmthRatio: number;
  housingRatio: number;
  healthRatio: number;
  defenseScore: number;
  buildingComfortBonus: number;
}

export class ComfortSystem {
  public comfort = 0.5;

  update(inputs: ComfortInputs): void {
    const cfg = getConfig().comfort;

    const foodScore = Math.min(inputs.foodRatio, 1) * cfg.baseFoodWeight;
    const warmthScore = Math.min(inputs.warmthRatio, 1) * cfg.warmthWeight;
    const housingScore = Math.min(inputs.housingRatio, 1) * cfg.housingWeight;
    const healthScore = Math.min(inputs.healthRatio, 1) * cfg.healthWeight;
    const defenseScore = Math.min(inputs.defenseScore, 1) * cfg.defenseWeight;

    const base = foodScore + warmthScore + housingScore + healthScore + defenseScore;
    const bonus = inputs.buildingComfortBonus * 0.01;
    this.comfort = Math.min(Math.max(base + bonus, 0), 1);
  }

  getProductivityMultiplier(): number {
    const cfg = getConfig().comfort;
    return 1 + (this.comfort - 0.5) * cfg.comfortProductivityBonus;
  }

  canGrow(): boolean {
    const cfg = getConfig().comfort;
    return this.comfort >= cfg.comfortGrowthThreshold;
  }

  serialize(): number {
    return this.comfort;
  }

  deserialize(data: number): void {
    this.comfort = data;
  }
}
