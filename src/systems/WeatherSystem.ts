import { WeatherEvent, Season } from '../types';
import { getConfig } from '../data/ConfigLoader';

export class WeatherSystem {
  public currentEvent: WeatherEvent | null = null;
  private eventCooldown = 0;

  update(dt: number, season: Season): void {
    if (this.currentEvent) {
      this.currentEvent.remainingDuration -= dt;
      if (this.currentEvent.remainingDuration <= 0) {
        this.currentEvent = null;
        this.eventCooldown = 20;
      }
      return;
    }

    if (this.eventCooldown > 0) {
      this.eventCooldown -= dt;
      return;
    }

    if (season === Season.Spring) return;

    const cfg = getConfig().weather;
    const roll = Math.random();
    const checkInterval = 10;
    const chance = dt / checkInterval;

    if (season === Season.Winter || season === Season.Autumn) {
      if (roll < cfg.snowstormChance * chance) {
        this.startEvent('snowstorm');
        return;
      }
    }
    if (roll < cfg.fogChance * chance) {
      this.startEvent('fog');
      return;
    }
    if (roll < cfg.strongWindChance * chance) {
      this.startEvent('strongWind');
    }
  }

  private startEvent(type: WeatherEvent['type']): void {
    const cfg = getConfig().weather;
    const duration = cfg.eventMinDuration + Math.random() * (cfg.eventMaxDuration - cfg.eventMinDuration);
    this.currentEvent = {
      type,
      remainingDuration: duration,
      intensity: 0.6 + Math.random() * 0.4,
    };
  }

  /** Clear weather event (for new game). */
  reset(): void {
    this.currentEvent = null;
  }

  getWorkSpeedMultiplier(): number {
    if (!this.currentEvent) return 1;
    const cfg = getConfig().weather;
    switch (this.currentEvent.type) {
      case 'snowstorm': return 1 - cfg.snowstormWorkPenalty * this.currentEvent.intensity;
      case 'fog': return 1;
      case 'strongWind': return 1 - cfg.strongWindWorkPenalty * this.currentEvent.intensity;
    }
  }

  getVisibilityMultiplier(): number {
    if (!this.currentEvent) return 1;
    if (this.currentEvent.type === 'fog') {
      const cfg = getConfig().weather;
      return 1 - cfg.fogVisibilityReduction * this.currentEvent.intensity;
    }
    return 1;
  }

  serialize(): WeatherEvent | null {
    return this.currentEvent ? { ...this.currentEvent } : null;
  }

  deserialize(data: WeatherEvent | null): void {
    this.currentEvent = data;
  }
}
