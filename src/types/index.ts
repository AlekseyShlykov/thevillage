export enum TileType {
  Forest = 'forest',
  Clear = 'clear',
  Building = 'building',
  Farm = 'farm',
  Palisade = 'palisade',
  Path = 'path',
  Moat = 'moat',
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

export type BuildingCategory = 'housing' | 'food' | 'production' | 'resource' | 'defense' | 'detection' | 'comfort' | 'terrain';

export interface Position {
  x: number;
  y: number;
}

export interface TileData {
  type: TileType;
  buildingId: string | null;
  markedForClearing: boolean;
  clearingProgress: number;
  /** Explicit tree selection order; absent for automatic nearest-tree work. */
  clearingQueueOrder?: number;
  moatDug?: boolean;
}

export interface ResourceState {
  wood: number;
  food: number;
  fur: number;
  tools: number;
  techPoints: number;
  herbs: number;
  clothing: number;
}

export interface BuildingUpgradeConfig {
  name: string;
  technology: string;
  requiresBuildings?: string[];
  costWood: number;
  buildTime: number;
  targetId?: string;
  hpMultiplier?: number;
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
  /** Chebyshev radius: protects this tile and N tiles in each cardinal direction. */
  protectionRadius?: number;
  storageBonus?: { wood: number; food: number; fur: number; tools: number };
  maxCount?: number;
  indestructible?: boolean;
  enemySpeedMultiplier?: number;
  towerRange?: number;
  towerDamage?: number;
  towerAttackInterval?: number;
  upgradeOnly?: boolean;
  upgrade?: BuildingUpgradeConfig;
  /** Types allowed to touch this building, in either placement order. */
  adjacentBuildingExceptions?: string[];
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
  productionProgress?: number;
  cropState?: 'empty' | 'growing' | 'ripe' | 'withered';
  sowingProgress?: number;
  harvestProgress?: number;
  harvestRemaining?: number;
  wardFuelSeconds?: number;
  wardActive?: boolean;
  towerAttackCooldown?: number;
  /** Existing structures remain functional while a builder upgrades them. */
  upgradeProgress?: number;
  upgraded?: boolean;
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
  /** A direct Stop/Move order keeps this villager out of automatic job dispatch. */
  holdPosition?: boolean;
  /** A direct release/order affects one resident while everyone else stays sheltered. */
  shelterExempt?: boolean;
  repeatClearing?: boolean;
  queuedExpedition?: 'hunt' | 'herbs' | 'chop';
  resumeAnnualAfterDelivery?: boolean;
  annualJob?: { task: string; buildingId?: string; target?: Position; progress?: number };
  /** Seconds spent outside during winter (resets when entering housing). */
  timeOutsideInWinter?: number;
  /** Failed attempts to reach current task goal; after 2, villager is sent to shelter. */
  taskAttempts?: number;
  /** Seconds the villager has been idle/stuck on the same tile without productive work. */
  stuckTimer?: number;
  lastStuckTileX?: number;
  lastStuckTileY?: number;
  toolDurability?: number;
  clothingWintersLeft?: number;
  coldExposure?: number;
  cargo?: { food: number; fur: number; herbs: number };
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
  villagerAttackCooldown?: number;
  targetX: number | null;
  targetY: number | null;
  path: Position[];
  visible: boolean;
  state: 'approaching' | 'attacking' | 'dead' | 'patrolling';
  targetBuildingId: string | null;
  patrolTarget: { x: number; y: number } | null;
  patrolTimer: number;
  repathTimer?: number;
  blockedTimer?: number;
}

export interface TechConfig {
  prerequisites?:string[];
  /** Show a locked research card before all purchase requirements are met. */
  visibleAfter?: string[];
  requiresBuildings?:string[];
  id: string;
  name: string;
  tier: number;
  cost: number;
  unlocks: string[];
  description: string;
  effect?: Record<string, number>;
}

export interface ResearchOption extends TechConfig {
  blockedReason: string | null;
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
  rendering: { tileWidth: number; tileHeight: number; zoom: number; minZoom: number; maxZoom: number; cropStageThresholds: number[]; towerShotSeconds: number; towerArrowLength: number; towerArrowArc: number };
  tutorial: { lastYear:number; minimumFoodReserve: number; winterReserveMultiplier: number };
  gameplay: { automaticGardenWorkers:number; demoWinters: number; foodWarningSeconds: number; foodComfortPerVillager: number; defenseComfortHP: number; refundFraction: number; shelterMinimumHomeResidents: number; shelterHomeReserveFraction: number };
  resources: Record<string, number>;
  villagers: Record<string, number>;
  buildings: Record<string, BuildingConfig>;
  retiredBuildings: Record<string, { refundWood: number; refundTools: number; refundResearch: number; replacement?: string; replacementResearchCost?:number }>;
  herbs: { capacity: number; perWinter: number; gatherSeconds: number; searchRadius: number; minimumForestDepth: number; maximumForestDepth: number; deathChance: number };
  equipment: { clothingLifetimeWinters: number };
  heating: { woodPerShelterPerWinter: number; unheatedExposureMultiplier: number; buildingIds: string[] };
  cold: { unclothedSurvivalSeconds: number; clothedExposureMultiplier: number; snowstormExposureMultiplier: number; warmupMultiplier: number; warningFraction: number };
  farming: { growthSeasons: number; sowingWorkSeconds: number; harvestWorkSeconds: number; harvestFood: number };
  forecast: { foodReserveBuffer: number };
  storage: Record<string, number>;
  horde: Record<string, unknown>;
  comfort: Record<string, number>;
  fur: Record<string, number>;
  weather: Record<string, number>;
  technology: {
    firstWinterRewardCount: number;
    earlyWinterStars: number;
    laterWinterStars: number;
    initialTechs: string[];
    initialBuildings: string[];
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
    herbs?:number;
    shelter?: number;
    leave?: number;
    hungry?: number;
  };
  demoEnd?: { emailSubmitUrl?: string };
  analytics?: { analyticsUrl?: string };
}
