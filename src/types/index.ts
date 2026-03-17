export enum TileType {
  Forest = 'forest',
  Clear = 'clear',
  Building = 'building',
  Farm = 'farm',
  Palisade = 'palisade',
  Path = 'path',
}

export enum Season {
  Spring = 'spring',
  Summer = 'summer',
  Autumn = 'autumn',
  Winter = 'winter',
}

export enum VillagerState {
  Idle = 'idle',
  Moving = 'moving',
  Working = 'working',
  Building = 'building',
  Defending = 'defending',
  Injured = 'injured',
  Dead = 'dead',
}

export enum HealthState {
  Healthy = 'healthy',
  Injured = 'injured',
  Dead = 'dead',
}

export type BuildingCategory = 'housing' | 'food' | 'production' | 'resource' | 'defense' | 'detection' | 'comfort';

export interface Position {
  x: number;
  y: number;
}

export interface TileData {
  type: TileType;
  buildingId: string | null;
  markedForClearing: boolean;
  clearingProgress: number;
}

export interface ResourceState {
  wood: number;
  food: number;
  fur: number;
  tools: number;
  techPoints: number;
}

export interface BuildingConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  costWood: number;
  costTools: number;
  buildTime: number;
  capacity: number;
  category: BuildingCategory;
  tier: number;
  maxWorkers: number;
  hp: number;
  description: string;
  comfortBonus?: number;
  lightRadius?: number;
  detectionRadius?: number;
  boostRadius?: number;
  canPlaceInForest?: boolean;
  storageBonus?: { wood: number; food: number; fur: number; tools: number };
}

export interface BuildingInstance {
  id: string;
  configId: string;
  tileX: number;
  tileY: number;
  built: boolean;
  buildProgress: number;
  hp: number;
  maxHp: number;
  assignedWorkers: string[];
  wintersSinceRepair: number;
  needsRepair: boolean;
  /** 0 = horizontal (default), 90 = vertical orientation */
  rotation?: number;
  /** 0..1 progress of growing food (garden), set while villager is farming */
  farmingProgress?: number;
  /** Gate open/closed state (only for palisadeGate) */
  gateOpen?: boolean;
}

export interface VillagerData {
  id: string;
  x: number;
  y: number;
  state: VillagerState;
  health: HealthState;
  hp: number;
  maxHp: number;
  targetX: number | null;
  targetY: number | null;
  path: Position[];
  assignedBuildingId: string | null;
  currentTask: string | null;
  taskProgress: number;
  /** Seconds spent outside during winter (resets when entering housing). */
  timeOutsideInWinter?: number;
  /** Failed attempts to reach current task goal; after 2, villager is sent to shelter. */
  taskAttempts?: number;
  /** Seconds the villager has been idle/stuck on the same tile without productive work. */
  stuckTimer?: number;
  lastStuckTileX?: number;
  lastStuckTileY?: number;
}

export interface EnemyData {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  targetX: number | null;
  targetY: number | null;
  path: Position[];
  visible: boolean;
  state: 'approaching' | 'attacking' | 'dead' | 'patrolling';
  targetBuildingId: string | null;
  patrolTarget: { x: number; y: number } | null;
  patrolTimer: number;
}

export interface TechConfig {
  id: string;
  name: string;
  tier: number;
  cost: number;
  unlocks: string[];
  description: string;
  effect?: Record<string, number>;
}

export interface WeatherEvent {
  type: 'snowstorm' | 'fog' | 'strongWind';
  remainingDuration: number;
  intensity: number;
}

export interface GameState {
  year: number;
  season: Season;
  seasonTimer: number;
  level: number;
  resources: ResourceState;
  villagers: VillagerData[];
  buildings: BuildingInstance[];
  enemies: EnemyData[];
  unlockedTechs: string[];
  unlockedBuildings: string[];
  weatherEvent: WeatherEvent | null;
  furAges: number[];
  gameSpeed: number;
  cameraX: number;
  cameraY: number;
}

export interface GameBalanceConfig {
  seasons: {
    summerDuration: number;
    autumnDuration: number;
    winterDuration: number;
    springDuration: number;
    order: string[];
  };
  map: {
    tileSize: number;
    mapWidth: number;
    mapHeight: number;
    viewportTilesX: number;
    viewportTilesY: number;
    startClearingSize: number;
  };
  resources: Record<string, number>;
  villagers: Record<string, number>;
  buildings: Record<string, BuildingConfig>;
  storage: Record<string, number>;
  horde: Record<string, unknown>;
  comfort: Record<string, number>;
  fur: Record<string, number>;
  weather: Record<string, number>;
  technology: {
    techPointsPerBuildingBuilt: number;
    techPointsPerWinterSurvived: number;
    techPointsPerLevelReached: number;
    techs: Record<string, TechConfig>;
  };
  levels: Record<string, { populationThreshold: number; availableTiers: number[] }>;
  repair: Record<string, number>;
  gameSpeed: Record<string, number>;
  sounds?: {
    season?: number;
    horde?: number;
    hordeAttack?: number;
    wood?: number;
    building?: number;
    dead?: number;
    hunt?: number;
    shelter?: number;
    leave?: number;
    hungry?: number;
  };
  demoEnd?: { emailSubmitUrl?: string };
  analytics?: { analyticsUrl?: string };
}
