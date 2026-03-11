import { ResourceState } from '../types';
import { getConfig } from '../data/ConfigLoader';

export class ResourceSystem {
  public resources: ResourceState;
  public capacity: { wood: number; food: number; fur: number; tools: number };
  private onCapacityReached: (resource: string) => void = () => {};

  constructor() {
    const cfg = getConfig().resources;
    const storageCfg = getConfig().storage;
    this.resources = {
      wood: cfg.startingWood,
      food: cfg.startingFood,
      fur: cfg.startingFur,
      tools: cfg.startingTools,
      techPoints: cfg.startingTechPoints,
    };
    this.capacity = {
      wood: storageCfg.baseWoodCapacity,
      food: storageCfg.baseFoodCapacity,
      fur: storageCfg.baseFurCapacity,
      tools: storageCfg.baseToolCapacity,
    };
  }

  /** Reset to initial resources and capacity (for new game). */
  reset(): void {
    const cfg = getConfig().resources;
    const storageCfg = getConfig().storage;
    this.resources = {
      wood: cfg.startingWood,
      food: cfg.startingFood,
      fur: cfg.startingFur,
      tools: cfg.startingTools,
      techPoints: cfg.startingTechPoints,
    };
    this.capacity = {
      wood: storageCfg.baseWoodCapacity,
      food: storageCfg.baseFoodCapacity,
      fur: storageCfg.baseFurCapacity,
      tools: storageCfg.baseToolCapacity,
    };
  }

  addWood(amount: number): void {
    if (amount > 0 && this.resources.wood >= this.capacity.wood) {
      this.onCapacityReached('wood');
    }
    this.resources.wood = Math.min(this.resources.wood + amount, this.capacity.wood);
  }

  addFood(amount: number): void {
    if (amount > 0 && this.resources.food >= this.capacity.food) {
      this.onCapacityReached('food');
    }
    this.resources.food = Math.min(this.resources.food + amount, this.capacity.food);
  }

  addFur(amount: number): void {
    if (amount > 0 && this.resources.fur >= this.capacity.fur) {
      this.onCapacityReached('fur');
    }
    this.resources.fur = Math.min(this.resources.fur + amount, this.capacity.fur);
  }

  addTools(amount: number): void {
    if (amount > 0 && this.resources.tools >= this.capacity.tools) {
      this.onCapacityReached('tools');
    }
    this.resources.tools = Math.min(this.resources.tools + amount, this.capacity.tools);
  }

  addTechPoints(amount: number): void {
    this.resources.techPoints += amount;
  }

  consumeFood(amount: number): boolean {
    if (this.resources.food >= amount) {
      this.resources.food -= amount;
      return true;
    }
    this.resources.food = 0;
    return false;
  }

  consumeWood(amount: number): boolean {
    if (this.resources.wood >= amount) {
      this.resources.wood -= amount;
      return true;
    }
    return false;
  }

  consumeTools(amount: number): boolean {
    if (this.resources.tools >= amount) {
      this.resources.tools -= amount;
      return true;
    }
    return false;
  }

  canAfford(wood: number, tools: number): boolean {
    return this.resources.wood >= wood && this.resources.tools >= tools;
  }

  setOnCapacityReached(cb: (resource: string) => void): void {
    this.onCapacityReached = cb;
  }

  updateStorageCapacity(bonuses: { wood: number; food: number; fur: number; tools: number }): void {
    const storageCfg = getConfig().storage;
    this.capacity.wood = storageCfg.baseWoodCapacity + bonuses.wood;
    this.capacity.food = storageCfg.baseFoodCapacity + bonuses.food;
    this.capacity.fur = storageCfg.baseFurCapacity + bonuses.fur;
    this.capacity.tools = storageCfg.baseToolCapacity + bonuses.tools;
  }

  serialize(): ResourceState {
    return { ...this.resources };
  }

  deserialize(data: ResourceState): void {
    this.resources = { ...data };
  }
}
