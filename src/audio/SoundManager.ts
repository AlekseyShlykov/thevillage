/**
 * Manages season background music and horde alert sound.
 * Seasons: spring.wav, summer.wav, autumn.mp3, winter.mp3 — all loop until the season ends.
 * Also: horde.wav (loop), horde_attack.wav (on attack), wood.mp3, building.wav (loop until build done), dead.wav, hunt.wav, shelter.mp3 (to shelter), leave.mp3 (leave shelter).
 * Empty or missing files are ignored (decode error caught).
 */
const SEASON_FILES: Record<string, string> = {
  spring: './assets/sounds/spring.wav',
  summer: './assets/sounds/summer.wav',
  autumn: './assets/sounds/autumn.mp3',
  winter: './assets/sounds/winter.mp3',
};
const HORDE_FILE = './assets/sounds/horde.wav';
const HORDE_ATTACK_FILE = './assets/sounds/horde_attack.wav';
const WOOD_FILE = './assets/sounds/wood.mp3';
const BUILDING_FILE = './assets/sounds/building.wav';
const DEAD_FILE = './assets/sounds/dead.wav';
const HUNT_FILE = './assets/sounds/hunt.wav';
const SHELTER_FILE = './assets/sounds/shelter.mp3';
const LEAVE_FILE = './assets/sounds/leave.mp3';

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
    audio.volume = 0.4;
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
    audio.volume = 0.6;
    audio.play().catch(() => {});
    audio.addEventListener('error', () => {});
    audio.addEventListener('ended', () => {
      this.hordeAudio = null;
    });
    this.hordeAudio = audio;
  }

  /** Start looping horde.wav when first enemies appear. Stops when stopHordeLoop() is called. */
  startHordeLoop(): void {
    if (!this.soundEnabled) return;
    if (this.hordeAudio) return;

    const audio = new Audio(HORDE_FILE);
    audio.loop = true;
    audio.volume = 0.6;
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
    audio.volume = 0.65;
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
    audio.volume = 0.7;
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
    audio.volume = 0.6;
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
    audio.volume = 0.8;
    audio.play().catch(() => {});
    audio.addEventListener('error', () => {});
  }

  playHunt(): void {
    if (!this.soundEnabled) return;
    const audio = new Audio(HUNT_FILE);
    audio.volume = 0.7;
    audio.play().catch(() => {});
    audio.addEventListener('error', () => {});
  }

  playShelter(): void {
    if (!this.soundEnabled) return;
    const audio = new Audio(SHELTER_FILE);
    audio.volume = 0.7;
    audio.play().catch(() => {});
    audio.addEventListener('error', () => {});
  }

  playLeaveShelter(): void {
    if (!this.soundEnabled) return;
    const audio = new Audio(LEAVE_FILE);
    audio.volume = 0.7;
    audio.play().catch(() => {});
    audio.addEventListener('error', () => {});
  }
}
