import { Season } from '../types';
import { getConfig } from '../data/ConfigLoader';

export class SeasonSystem {
  public season: Season = Season.Spring;
  public seasonTimer = 0;
  public year = 1;
  public seasonProgress = 0;

  private seasonDurations: Record<Season, number> = {} as Record<Season, number>;
  private onSeasonChange: ((season: Season, year: number) => void) | null = null;

  constructor() {
    this.loadDurations();
  }

  private loadDurations(): void {
    const cfg = getConfig().seasons;
    this.seasonDurations = {
      [Season.Spring]: cfg.springDuration,
      [Season.Summer]: cfg.summerDuration,
      [Season.Autumn]: cfg.autumnDuration,
      [Season.Winter]: cfg.winterDuration,
    };
  }

  setOnSeasonChange(cb: (season: Season, year: number) => void): void {
    this.onSeasonChange = cb;
  }

  getCurrentDuration(): number {
    return this.seasonDurations[this.season];
  }

  update(dt: number): void {
    this.seasonTimer += dt;
    const duration = this.getCurrentDuration();
    this.seasonProgress = Math.min(this.seasonTimer / duration, 1);

    if (this.seasonTimer >= duration) {
      this.seasonTimer -= duration;
      this.advanceSeason();
    }
  }

  private advanceSeason(): void {
    const order: Season[] = [Season.Spring, Season.Summer, Season.Autumn, Season.Winter];
    const idx = order.indexOf(this.season);
    const nextIdx = (idx + 1) % order.length;
    this.season = order[nextIdx];

    if (this.season === Season.Spring) {
      this.year++;
    }

    this.seasonProgress = 0;
    if (this.onSeasonChange) {
      this.onSeasonChange(this.season, this.year);
    }
  }

  /** Reset to Spring, Year 1 (for new game). */
  reset(): void {
    this.season = Season.Spring;
    this.seasonTimer = 0;
    this.year = 1;
    this.seasonProgress = 0;
  }

  isWinter(): boolean {
    return this.season === Season.Winter;
  }

  getSeasonDisplayName(): string {
    return this.season.charAt(0).toUpperCase() + this.season.slice(1);
  }

  serialize(): { season: Season; seasonTimer: number; year: number } {
    return { season: this.season, seasonTimer: this.seasonTimer, year: this.year };
  }

  deserialize(data: { season: Season; seasonTimer: number; year: number }): void {
    this.season = data.season;
    this.seasonTimer = data.seasonTimer;
    this.year = data.year;
  }
}
