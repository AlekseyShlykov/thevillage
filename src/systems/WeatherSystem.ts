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
        this.eventCooldown = getConfig().weather.eventCooldown;
      }
      return;
    }

    if (this.eventCooldown > 0) {
      this.eventCooldown -= dt;
      return;
    }

    if (season === Season.Spring) return;

    const cfg = getConfig().weather;
    const checkInterval = cfg.checkInterval;
    const chance = dt / checkInterval;

    if (season === Season.Winter || season === Season.Autumn) {
      if (Math.random() < cfg.snowstormChance * chance) {
        this.startEvent('snowstorm');
        return;
      }
    }
    if (Math.random() < cfg.fogChance * chance) {
      this.startEvent('fog');
      return;
    }
    if (Math.random() < cfg.strongWindChance * chance) {
      this.startEvent('strongWind');
    }
  }

  private startEvent(type: WeatherEvent['type']): void {
    const cfg = getConfig().weather;
    const duration = cfg.eventMinDuration + Math.random() * (cfg.eventMaxDuration - cfg.eventMinDuration);
    this.currentEvent = {
      type,
      remainingDuration: duration,
      intensity: cfg.eventMinIntensity + Math.random() * (cfg.eventMaxIntensity - cfg.eventMinIntensity),
    };
  }

  /** Clear weather event (for new game). */
  reset(): void {
    this.currentEvent = null;
    this.eventCooldown = 0;
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

  serialize(): { currentEvent: WeatherEvent | null; eventCooldown: number } {
    return { currentEvent: this.currentEvent ? { ...this.currentEvent } : null, eventCooldown: this.eventCooldown };
  }

  deserialize(data: WeatherEvent | ReturnType<WeatherSystem['serialize']> | null): void {
    if (data && 'currentEvent' in data) {
      this.currentEvent = data.currentEvent; this.eventCooldown = data.eventCooldown;
    } else { this.currentEvent = data; this.eventCooldown = 0; }
  }
}
