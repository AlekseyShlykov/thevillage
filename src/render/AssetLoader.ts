const BUILDING_SPRITE_MAP: Record<string, string> = {
  hut: 'buildings/hut.png',
  garden: 'buildings/garden.png',
  hunterHut: 'buildings/hunter_hut.png',
  bonfire: 'buildings/bonfire.png',
  workshop: 'buildings/workshop.png',
  lumberCamp: 'buildings/lumber_camp.png',
  storage: 'buildings/storage.png',
  palisadeWall: 'buildings/palisade_wall.png',
  palisadeGate: 'buildings/palisade_gate.png',
  palisadeCorner: 'buildings/palisade_90.png',
  campFire: 'buildings/bonfire.png',
  scoutFire: 'buildings/scout_fire.png',
  furWorkshop: 'buildings/fur_workshop.png',
  smokehouse: 'buildings/smokehouse.png',
  watchtower: 'buildings/watchtower.png',
  house: 'buildings/house.png',
  largeHouse: 'buildings/large_house.png',
};

const TILE_SPRITE_MAP: Record<string, string[]> = {
  forest: ['tiles/forest_tile_1.png', 'tiles/forest_tile_2.png', 'tiles/forest_tile_3.png'],
  clear_summer: ['tiles/ground_grass.png'],
  clear_spring: ['tiles/ground_spring.png'],
  clear_autumn: ['tiles/ground_autumn.png'],
  clear_winter: ['tiles/ground_winter.png'],
  garden_empty: ['tiles/garden_empty.png'],
  garden_growing_1: ['tiles/garden_growing_1.png'],
  garden_growing_2: ['tiles/garden_growing_2.png'],
  garden_ready: ['tiles/garden_ready.png'],
};

const VILLAGER_SPRITE_MAP: Record<string, string> = {
  idle: 'villagers/villager_idle.png',
  walk_1: 'villagers/villager_walk_1.png',
  walk_2: 'villagers/villager_walk_2.png',
  builder: 'villagers/villager_builder.png',
  hunter: 'villagers/villager_hunter.png',
  lumberjack: 'villagers/villager_lumberjack.png',
  winter: 'villagers/villager_winter.png',
  injured: 'villagers/villager_injured.png',
};

const ENEMY_SPRITE_MAP: Record<string, string> = {
  eyes: 'enemies/horde_eyes.png',
  walk_1: 'enemies/horde_creature_walk_1.png',
  walk_2: 'enemies/horde_creature_walk_2.png',
  attack: 'enemies/horde_creature_attack.png',
};

export class AssetLoader {
  private images: Map<string, HTMLImageElement> = new Map();
  private loaded = false;

  async loadAll(): Promise<void> {
    const allPaths: string[] = [];

    for (const p of Object.values(BUILDING_SPRITE_MAP)) allPaths.push(p);
    for (const arr of Object.values(TILE_SPRITE_MAP)) allPaths.push(...arr);
    for (const p of Object.values(VILLAGER_SPRITE_MAP)) allPaths.push(p);
    for (const p of Object.values(ENEMY_SPRITE_MAP)) allPaths.push(p);

    const unique = [...new Set(allPaths)];
    const promises = unique.map(p => this.loadImage(p));
    await Promise.allSettled(promises);
    this.loaded = true;
  }

  private loadImage(path: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(path, img);
        resolve();
      };
      img.onerror = () => {
        resolve();
      };
      img.src = `./assets/${path}`;
    });
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getBuilding(configId: string): HTMLImageElement | null {
    const path = BUILDING_SPRITE_MAP[configId];
    if (!path) return null;
    return this.images.get(path) ?? null;
  }

  getTile(key: string, variant = 0): HTMLImageElement | null {
    const paths = TILE_SPRITE_MAP[key];
    if (!paths || paths.length === 0) return null;
    const idx = variant % paths.length;
    return this.images.get(paths[idx]) ?? null;
  }

  getForestTile(tx: number, ty: number): HTMLImageElement | null {
    const variant = ((tx * 73 + ty * 137) & 0x7fffffff) % 3;
    return this.getTile('forest', variant);
  }

  getGroundTile(season: string): HTMLImageElement | null {
    const key = `clear_${season}`;
    return this.getTile(key) ?? this.getTile('clear_summer');
  }

  getVillager(key: string): HTMLImageElement | null {
    const path = VILLAGER_SPRITE_MAP[key];
    if (!path) return null;
    return this.images.get(path) ?? null;
  }

  getEnemy(key: string): HTMLImageElement | null {
    const path = ENEMY_SPRITE_MAP[key];
    if (!path) return null;
    return this.images.get(path) ?? null;
  }
}
