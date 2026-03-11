/**
 * Manages season background music and horde alert sound.
 * Seasons: spring.mp3, summer.mp3, autumn.mp3, winter.mp3 — all loop until the season ends.
 * Also: horde.mp3 (loop), horde_attack.mp3 (on attack), wood.mp3, building.mp3 (loop until build done), dead.mp3, hunt.mp3, shelter.mp3 (to shelter), leave.mp3 (leave shelter).
 * Empty or missing files are ignored (decode error caught).
 * Paths use import.meta.env.BASE_URL so they work on GitHub Pages (e.g. /CozyGame/).
 * Volumes are read from game-balance.json (sounds section).
 */
import { getConfig } from '../data/ConfigLoader';

const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
const path = (p: string) => (base.endsWith('/') ? base + p : base + p.replace(/^\\.?\\//, ''));

const DEFAULT_VOL: Record<string, number> = {
  season: 0.4, horde: 0.6, hordeAttack: 0.65, wood: 0.7, building: 0.6,
  dead: 0.8, hunt: 0.7, shelter: 0.7, leave: 0.7, hungry: 0.7,
};
function vol(key: string): number {
  const v = getConfig().sounds?.[key as keyof NonNullable<ReturnType<typeof getConfig>['sounds']>];
  return typeof v === 'number' && v >= 0 && v <= 1 ? v : (DEFAULT_VOL[key] ?? 0.7);
}

const SEASON_FILES: Record<string, string> = {
  spring: path('assets/sounds/spring.mp3'),
  summer: path('assets/sounds/summer.mp3'),
  autumn: path('assets/sounds/autumn.mp3'),
  winter: path('assets/sounds/winter.mp3'),
};
const HORDE_FILE = path('assets/sounds/horde.mp3');
const HORDE_ATTACK_FILE = path('assets/sounds/horde_attack.mp3');
const WOOD_FILE = path('assets/sounds/wood.mp3');
const BUILDING_FILE = path('assets/sounds/building.mp3');
const DEAD_FILE = path('assets/sounds/dead.mp3');
const HUNT_FILE = path('assets/sounds/hunt.mp3');
const SHELTER_FILE = path('assets/sounds/shelter.mp3');
const LEAVE_FILE = path('assets/sounds/leave.mp3');
const HUNGRY_FILE = path('assets/sounds/hungry.mp3');

const WOOD_THROTTLE_MS = 450;
const BUILDING_THROTTLE_MS = 500;
const HORDE_ATTACK_THROTTLE_MS = 280;
const MAX_CONCURRENT_WOOD = 2;

export class SoundManager {
  private soundEnabled = true;
  private currentSeason: string | null = null;
  private seasonAudio: HTMLAudioElement | null = null;
  private hordeAudio: HTMLAudioElement | null = null;
  private buildingAudio: HTMLAudioElement | null = null;
  private lastWoodTime = 0;
  private lastBuildingTime = 0;
  private woodPlaying: HTMLAudioElement[] = [];
  private lastHordeAttackTime = 0;

  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  toggleSound(): boolean {
    this.soundEnabled = !this.soundEnabled;
    if (!this.soundEnabled) {
      if (this.seasonAudio) {
        this.seasonAudio.pause();
        this.seasonAudio.currentTime = 0;
      }
      this.stopHordeLoop();
    } else if (this.currentSeason) {
      this.playSeason(this.currentSeason);
    }
    return this.soundEnabled;
  }

  playSeason(season: string): void {
    this.currentSeason = season;
    if (!this.soundEnabled) return;

    const src = SEASON_FILES[season];
    if (!src) return;

    if (this.seasonAudio) {
      this.seasonAudio.pause();
      this.seasonAudio = null;
    }

    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = vol('season');
    audio.play().catch(() => {});
    audio.addEventListener('error', () => {});
    this.seasonAudio = audio;
  }

  playHorde(): void {
    if (!this.soundEnabled) return;

    if (this.hordeAudio) {
      this.hordeAudio.pause();
      this.hordeAudio = null;
    }

    const audio = new Audio(HORDE_FILE);
    audio.volume = vol('horde');
    audio.play().catch(() => {});
    audio.addEventListener('error', () => {});
    audio.addEventListener('ended', () => {
      this.hordeAudio = null;
    });
    this.hordeAudio = audio;
  }

  /** Start looping horde.mp3 when first enemies appear. Stops when stopHordeLoop() is called. */
  startHordeLoop(): void {
    if (!this.soundEnabled) return;
    if (this.hordeAudio) return;

    const audio = new Audio(HORDE_FILE);
    audio.loop = true;
    audio.volume = vol('horde');
    audio.play().catch(() => {});
    audio.addEventListener('error', () => {
      this.hordeAudio = null;
    });
    this.hordeAudio = audio;
  }

  stopHordeLoop(): void {
    if (this.hordeAudio) {
      this.hordeAudio.pause();
      this.hordeAudio.currentTime = 0;
      this.hordeAudio = null;
    }
  }

  playHordeAttack(): void {
    if (!this.soundEnabled) return;
    const now = Date.now();
    if (now - this.lastHordeAttackTime < HORDE_ATTACK_THROTTLE_MS) return;
    this.lastHordeAttackTime = now;
    const audio = new Audio(HORDE_ATTACK_FILE);
    audio.volume = vol('hordeAttack');
    audio.play().catch(() => {});
    audio.addEventListener('error', () => {});
  }

  playWood(): void {
    if (!this.soundEnabled) return;
    const now = Date.now();
    if (now - this.lastWoodTime < WOOD_THROTTLE_MS) return;
    this.woodPlaying = this.woodPlaying.filter(a => !a.ended);
    if (this.woodPlaying.length >= MAX_CONCURRENT_WOOD) return;
    this.lastWoodTime = now;
    const audio = new Audio(WOOD_FILE);
    audio.volume = vol('wood');
    const remove = () => {
      this.woodPlaying = this.woodPlaying.filter(x => x !== audio);
    };
    audio.addEventListener('ended', remove);
    audio.addEventListener('error', remove);
    this.woodPlaying.push(audio);
    audio.play().catch(remove);
  }

  stopWood(): void {
    for (const a of this.woodPlaying) {
      a.pause();
      a.currentTime = 0;
    }
    this.woodPlaying = [];
  }

  playBuilding(): void {
    if (!this.soundEnabled) return;
    const now = Date.now();
    if (now - this.lastBuildingTime < BUILDING_THROTTLE_MS) return;
    this.lastBuildingTime = now;
    if (this.buildingAudio) return;
    const audio = new Audio(BUILDING_FILE);
    audio.loop = true;
    audio.volume = vol('building');
    audio.addEventListener('error', () => {
      this.buildingAudio = null;
    });
    this.buildingAudio = audio;
    audio.play().catch(() => {
      this.buildingAudio = null;
    });
  }

  stopBuildingSound(): void {
    if (this.buildingAudio) {
      this.buildingAudio.pause();
      this.buildingAudio.currentTime = 0;
      this.buildingAudio = null;
    }
    this.lastBuildingTime = 0;
  }

  playDead(): void {
    if (!this.soundEnabled) return;
    const audio = new Audio(DEAD_FILE);
    audio.volume = vol('dead');
    audio.play().catch(() => {});
    audio.addEventListener('error', () => {});
  }

  playHunt(): void {
    if (!this.soundEnabled) return;
    const audio = new Audio(HUNT_FILE);
    audio.volume = vol('hunt');
    audio.play().catch(() => {});
    audio.addEventListener('error', () => {});
  }

  playShelter(): void {
    if (!this.soundEnabled) return;
    const audio = new Audio(SHELTER_FILE);
    audio.volume = vol('shelter');
    audio.play().catch(() => {});
    audio.addEventListener('error', () => {});
  }

  playLeaveShelter(): void {
    if (!this.soundEnabled) return;
    const audio = new Audio(LEAVE_FILE);
    audio.volume = vol('leave');
    audio.play().catch(() => {});
    audio.addEventListener('error', () => {});
  }

  playHungry(): void {
    if (!this.soundEnabled) return;
    const audio = new Audio(HUNGRY_FILE);
    audio.volume = vol('hungry');
    audio.play().catch(() => {});
    audio.addEventListener('error', () => {});
  }
}
