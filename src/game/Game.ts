import { GameLoop } from '../core/GameLoop';
import { Camera } from '../core/Camera';
import { InputManager } from '../input/InputManager';
import { TileMap } from '../world/TileMap';
import { Renderer } from '../render/Renderer';
import { AssetLoader } from '../render/AssetLoader';
import { SeasonSystem } from '../systems/SeasonSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { VillagerSystem } from '../systems/VillagerSystem';
import { BuildingSystem } from '../systems/BuildingSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { HordeSystem } from '../systems/HordeSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { ComfortSystem } from '../systems/ComfortSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { SoundManager } from '../audio/SoundManager';
import { UIManager, UICallbacks } from '../ui/UIManager';
import { getConfig } from '../data/ConfigLoader';
import { Season, TileType, VillagerState, HealthState, Position, BuildingConfig } from '../types';

type InteractionMode = 'normal' | 'build' | 'clear' | 'demolish' | 'palisadeDraw';

export class Game {
  private gameLoop: GameLoop;
  private camera: Camera;
  private input: InputManager;
  private tileMap: TileMap;
  private renderer: Renderer;

  private seasonSystem: SeasonSystem;
  private resourceSystem: ResourceSystem;
  private villagerSystem: VillagerSystem;
  private buildingSystem: BuildingSystem;
  private techSystem: TechnologySystem;
  private hordeSystem: HordeSystem;
  private weatherSystem: WeatherSystem;
  private comfortSystem: ComfortSystem;
  private saveSystem: SaveSystem;
  private soundManager: SoundManager;
  private ui: UIManager;

  private mode: InteractionMode = 'normal';
  private selectedBuildingId: string | null = null;
  private selectedVillagerId: string | null = null;
  private level = 1;
  private furAges: number[] = [];

  private foodConsumptionAccum = 0;
  private productionAccum = 0;
  private growthAccum = 0;
  private furClothingProduced = 0;

  private palisadeStart: Position | null = null;
  private palisadePreview: Position[] = [];
  private uiUpdateCounter = 0;
  private clearModeHintCount = 0;
  private gameOver = false;
  private stayInShelterMode = false;
  private demoMessageShown = false;
  private foodLowSoundPlayed = false;

  constructor(canvas: HTMLCanvasElement, assets: AssetLoader) {
    this.camera = new Camera();
    this.input = new InputManager(canvas, this.camera);
    this.tileMap = new TileMap();
    this.renderer = new Renderer(canvas, this.camera, assets);
    this.gameLoop = new GameLoop();

    this.seasonSystem = new SeasonSystem();
    this.resourceSystem = new ResourceSystem();
    this.villagerSystem = new VillagerSystem(this.tileMap);
    this.buildingSystem = new BuildingSystem(this.tileMap);
    this.techSystem = new TechnologySystem();
    this.hordeSystem = new HordeSystem(this.tileMap);
    this.weatherSystem = new WeatherSystem();
    this.comfortSystem = new ComfortSystem();
    this.saveSystem = new SaveSystem();
    this.soundManager = new SoundManager();
    this.villagerSystem.setOnVillagerDeath(() => this.soundManager.playDead());

    const callbacks: UICallbacks = {
      onSpeedChange: (s) => this.setSpeed(s),
      onBuildSelect: (id) => this.startBuildMode(id),
      onBuildCancel: () => this.cancelBuild(),
      onBuildPanelOpen: () => this.refreshBuildPanel(),
      onDemolish: () => this.toggleDemolishMode(),
      onTechUnlock: (id) => this.unlockTech(id),
      onSave: () => this.manualSave(),
      onLoad: () => this.manualLoad(),
      onToggleClearMode: () => this.toggleClearMode(),
      onGoHunting: () => this.goHunting(),
      onSendAllToChop: () => this.sendAllToChop(),
      onReturnHome: () => this.returnHome(),
      onLeaveShelter: () => this.leaveShelter(),
      onRepairAll: () => this.repairAll(),
      onRestart: () => this.restart(),
      onSoundToggle: () => this.soundManager.toggleSound(),
    };
    this.ui = new UIManager(callbacks);

    this.resourceSystem.setOnCapacityReached((resource) => {
      const names: Record<string, string> = { wood: 'wood', food: 'food', fur: 'fur', tools: 'tools' };
      this.ui.notify(`Capacity reached for ${names[resource] ?? resource}. Build a storage.`);
    });

    this.setupSeasonCallbacks();
    this.initWorld();
    // Season music is started in start() after user click (required for autoplay policy).

    this.renderer.resize();
    window.addEventListener('resize', () => this.renderer.resize());

    const center = this.tileMap.getClearingCenter();
    const ts = getConfig().map.tileSize;
    this.camera.centerOn(center.x * ts, center.y * ts);

    this.gameLoop.onUpdate = (dt) => this.update(dt);
    this.gameLoop.onRender = () => this.render();
  }

  start(): void {
    this.soundManager.playSeason(this.seasonSystem.season);
    this.gameLoop.start();
  }

  private initWorld(): void {
    const cfg = getConfig();
    const center = this.tileMap.getClearingCenter();

    this.buildingSystem.placeStartingBuilding('hut', center.x - 1, center.y - 1);

    this.villagerSystem.spawnInitialVillagers(center.x, center.y, cfg.villagers.startingCount);
  }

  private setupSeasonCallbacks(): void {
    this.seasonSystem.setOnSeasonChange((season, year) => {
      this.soundManager.playSeason(season);
      this.ui.notify(`${season.charAt(0).toUpperCase() + season.slice(1)} of Year ${year}`);

      if (season === Season.Winter) {
        this.hordeSystem.startWinter(year, this.level);
        this.buildingSystem.advanceWinterRepairCounters();
        this.ageFurs();
        const cfg = getConfig().technology;
        this.resourceSystem.addTechPoints(cfg.techPointsPerWinterSurvived);
      }

      if (season === Season.Spring) {
        this.hordeSystem.endWinter();
        this.soundManager.stopHordeLoop();
        this.saveSystem.autosave(this.serializeState());
        this.ui.notify('Spring! Autosaved.');
        this.checkLevelUp();
        if (year > 8) {
          this.gameOver = true;
          this.gameLoop.gameSpeed = 0;
          this.ui.showDemoEnd(getConfig().demoEnd?.emailSubmitUrl);
        }
      }
    });
  }

  private update(dt: number): void {
    if (this.gameOver) return;

    if (this.villagerSystem.getAliveCount() === 0) {
      this.gameOver = true;
      this.gameLoop.gameSpeed = 0;
      this.ui.showGameOver(getConfig().demoEnd?.emailSubmitUrl);
      return;
    }

    this.seasonSystem.update(dt);
    this.weatherSystem.update(dt, this.seasonSystem.season);

    const weatherMult = this.weatherSystem.getWorkSpeedMultiplier();
    const comfortMult = this.comfortSystem.getProductivityMultiplier();
    const effectiveDt = dt * weatherMult * comfortMult;

    this.updateResourceProduction(effectiveDt);
    this.updateFoodConsumption(dt);
    this.updateForestClearing(effectiveDt);
    this.updatePopulationGrowth(dt);

    this.buildingSystem.updateConstruction(effectiveDt, (buildingId) => this.getBuildersOnSite(buildingId), undefined, (building) => {
      const isDefense = building.configId === 'palisadeWall' || building.configId === 'palisadeGate';
      if (!isDefense) {
        this.resourceSystem.addTechPoints(getConfig().technology.techPointsPerBuildingBuilt);
      }
    });
    this.releaseBuildersFromCompletedBuildings();

    const isWinter = this.seasonSystem.isWinter();
    const housingTiles = this.buildingSystem.getHousingTiles();

    this.villagerSystem.openGateIds = new Set(
      this.buildingSystem.buildings.filter(b => b.configId === 'palisadeGate' && b.gateOpen).map(b => b.id)
    );
    this.villagerSystem.unbuiltPalisadeIds = new Set(
      this.buildingSystem.buildings.filter(b => (b.configId === 'palisadeWall' || b.configId === 'palisadeGate') && !b.built).map(b => b.id)
    );

    this.villagerSystem.update(dt, this.buildingSystem.buildings, isWinter, housingTiles, this.stayInShelterMode);
    this.updateHunting(dt);
    this.updateRepair(dt);
    this.updateFarming(dt);
    this.updateToggleGate(dt);
    this.assignWorkersToUnbuiltBuildingsOnArrival();

    if (this.hasAnyoneBuildingOrRepairing()) {
      this.soundManager.playBuilding();
    } else {
      this.soundManager.stopBuildingSound();
    }

    this.assignIdleVillagers();

    const alive = this.villagerSystem.getAliveCount();
    if (!this.demoMessageShown && alive >= 10) {
      this.demoMessageShown = true;
      this.ui.notify(
        "If you liked the game — leave your email on the game over or demo end screen; we'll notify you when the full version is out.",
        10000
      );
    }

    const center = this.tileMap.getClearingCenter();
    const housingSet = new Set(housingTiles.map(p => `${p.x},${p.y}`));
    const outsideVillagers = this.villagerSystem.getAliveVillagers()
      .filter(v => !housingSet.has(`${Math.floor(v.x)},${Math.floor(v.y)}`))
      .map(v => ({ id: v.id, x: v.x, y: v.y }));
    const retreatSec = (getConfig().horde as Record<string, number>).retreatSecondsBeforeWinterEnd ?? 10;
    const winterRetreatPhase = this.seasonSystem.isWinter() &&
      (this.seasonSystem.getCurrentDuration() - this.seasonSystem.seasonTimer <= retreatSec);
    this.hordeSystem.openGateIds = this.villagerSystem.openGateIds;
    this.hordeSystem.unbuiltPalisadeIds = this.villagerSystem.unbuiltPalisadeIds;
    this.hordeSystem.update(
      dt, center.x, center.y,
      this.buildingSystem.getDetectionBuildings(),
      housingTiles,
      outsideVillagers,
      this.buildingSystem.getAttackableBuildingTiles(),
      (buildingId) => this.isHouseBuilding(buildingId),
      (bId, dmg) => {
        this.buildingSystem.damageBuilding(bId, dmg);
        this.soundManager.playHordeAttack();
      },
      (villagerId) => this.killVillagerByHorde(villagerId),
      winterRetreatPhase,
    );

    if (this.hordeSystem.isActive && this.hordeSystem.enemies.length > 0) {
      this.soundManager.startHordeLoop();
    } else {
      this.soundManager.stopHordeLoop();
    }
    this.updateCombat(dt);

    const storageBonuses = this.buildingSystem.getStorageBonuses();
    this.resourceSystem.updateStorageCapacity(storageBonuses);

    this.updateComfort();

    this.handleInput();
    this.updateUI();
  }

  private render(): void {
    this.renderer.clear();
    this.renderer.renderTiles(this.tileMap, this.seasonSystem.season);
    this.renderer.renderBuildings(this.buildingSystem.buildings, this.buildingSystem.getAllBuildingConfigs());
    this.renderer.renderVillagers(this.villagerSystem.villagers, this.selectedVillagerId, this.seasonSystem.season);
    this.renderer.renderEnemies(this.hordeSystem.enemies, this.seasonSystem.season);
    this.renderer.renderWinterDarkness(this.seasonSystem.season, this.buildingSystem.buildings, this.buildingSystem.getAllBuildingConfigs());
    this.renderer.renderWeather(this.weatherSystem.currentEvent);

    if (this.mode === 'build' && this.selectedBuildingId) {
      const state = this.input.state;
      const cfg = this.buildingSystem.getBuildingConfig(this.selectedBuildingId);
      if (cfg) {
        if (this.selectedBuildingId === 'palisadeWall' && this.palisadePreview.length > 0) {
          this.renderer.renderPalisadePreview(this.palisadePreview, this.tileMap);
        } else {
          const valid = this.buildingSystem.canPlace(this.selectedBuildingId, state.tileX, state.tileY);
          this.renderer.renderBuildPreview(state.tileX, state.tileY, cfg.width, cfg.height, valid);
        }
      }
    }

    if (this.mode === 'normal' || this.mode === 'clear') {
      this.renderer.renderSelectionBox(this.input.state.tileX, this.input.state.tileY);
    }
  }

  private handleInput(): void {
    if (this.input.consumeClick()) {
      const { tileX, tileY } = this.input.state;

      switch (this.mode) {
        case 'normal':
          this.handleNormalClick(tileX, tileY);
          break;
        case 'build':
          this.handleBuildClick(tileX, tileY);
          break;
        case 'clear':
          this.handleClearClick(tileX, tileY);
          break;
        case 'demolish':
          this.handleDemolishClick(tileX, tileY);
          break;
      }
    }

    if (this.input.consumeRightClick()) {
      this.cancelBuild();
      this.mode = 'normal';
      this.ui.hideInfo();
    }
  }

  private handleNormalClick(tx: number, ty: number): void {
    const villager = this.villagerSystem.getVillagerAt(tx, ty);
    if (villager) {
      this.selectedVillagerId = villager.id;
      this.ui.showInfo([
        `Villager ${villager.id}`,
        `HP: ${Math.floor(villager.hp)}/${villager.maxHp}`,
        `State: ${villager.state}`,
        `Health: ${villager.health}`,
        villager.assignedBuildingId ? `Assigned: ${villager.assignedBuildingId}` : 'Unassigned',
      ]);
      this.ui.hideActionMenu();
      return;
    }

    const tile = this.tileMap.getTile(tx, ty);
    const building = tile?.buildingId
      ? this.buildingSystem.buildings.find(b => b.id === tile.buildingId)
      : null;
    const cfg = building ? this.buildingSystem.getBuildingConfig(building.configId) : null;

    if (this.selectedVillagerId) {
      const ts = getConfig().map.tileSize;
      const screen = this.camera.worldToScreen(tx * ts + ts / 2, ty * ts + ts / 2);
      const actions: { label: string; callback: () => void }[] = [];

      if (tile?.type === TileType.Forest) {
        actions.push({ label: '🦌 Hunt', callback: () => this.villagerActionHunt(this.selectedVillagerId!) });
        actions.push({ label: '🪓 Chop here', callback: () => this.villagerActionChop(this.selectedVillagerId!, tx, ty) });
      } else if (building && cfg) {
        const housingIds = new Set(['hut', 'house', 'largeHouse', 'campFire']);
        if (!building.built) {
          actions.push({ label: '🔨 Send to build', callback: () => this.villagerActionSendToBuild(this.selectedVillagerId!, building.id) });
        } else {
          if (housingIds.has(building.configId)) {
            actions.push({ label: '🏠 Shelter here', callback: () => this.villagerActionShelter(this.selectedVillagerId!, building) });
          }
          if (building.configId === 'palisadeGate') {
            const gateLabel = building.gateOpen ? '🔒 Close gate' : '🔓 Open gate';
            actions.push({ label: gateLabel, callback: () => this.sendVillagerToToggleGate(this.selectedVillagerId!, building.id) });
          }
          if (building.configId === 'garden') {
            actions.push({ label: '🌾 Grow food', callback: () => this.sendVillagerToFarm(this.selectedVillagerId!, building.id) });
          }
          if ((cfg.maxWorkers ?? 0) > 0 && building.assignedWorkers.length < (cfg.maxWorkers ?? 0)) {
            actions.push({ label: '👷 Work here', callback: () => this.villagerActionWork(this.selectedVillagerId!, building.id) });
          }
        }
        actions.push({ label: '🚶 Go here', callback: () => this.villagerActionGo(this.selectedVillagerId!, tx, ty) });
      }

      if (actions.length > 0) {
        this.ui.showActionMenu(screen.x, screen.y, actions);
        return;
      }
    }

    if (building && cfg) {
      const ts2 = getConfig().map.tileSize;
      const screen2 = this.camera.worldToScreen(tx * ts2 + ts2 / 2, ty * ts2 + ts2 / 2);
      const actions: { label: string; callback: () => void }[] = [];

      if (!building.built) {
        actions.push({ label: '❌ Cancel', callback: () => this.cancelBuilding(building.id) });
      } else {
        if (building.hp < building.maxHp || building.needsRepair) {
          actions.push({ label: '🔧 Repair', callback: () => this.sendRepairToBuilding(building.id) });
        }
        actions.push({ label: '💥 Demolish', callback: () => this.startDemolish(building.id) });
      }

      this.ui.showInfo([
        cfg?.name || building.configId,
        `HP: ${Math.floor(building.hp)}/${building.maxHp}`,
        building.built ? 'Built' : `Building: ${Math.round(building.buildProgress * 100)}%`,
        `Workers: ${building.assignedWorkers.length}/${cfg?.maxWorkers || 0}`,
        building.needsRepair ? '⚠ Needs repair' : '',
        building.configId === 'palisadeGate' && building.built ? (building.gateOpen ? '🔓 Open' : '🔒 Closed') : '',
      ].filter(Boolean));

      if (actions.length > 0) {
        this.ui.showActionMenu(screen2.x, screen2.y, actions);
      }
      return;
    }

    this.selectedVillagerId = null;
    this.ui.hideInfo();
    this.ui.hideActionMenu();
  }

  private villagerActionHunt(villagerId: string): void {
    if (this.stayInShelterMode && this.isVillagerInShelter(villagerId)) {
      this.ui.notify('Villagers are staying in shelter. Press "Leave shelter" first.');
      return;
    }
    if (this.villagerSystem.sendVillagerToHunt(villagerId)) {
      this.soundManager.playHunt();
      this.ui.notify('Villager went hunting. Risk in the forest!');
    } else {
      this.ui.notify('Cannot send this villager to hunt.');
    }
  }

  private villagerActionChop(villagerId: string, tx: number, ty: number): void {
    if (this.stayInShelterMode && this.isVillagerInShelter(villagerId)) {
      this.ui.notify('Villagers are staying in shelter. Press "Leave shelter" first.');
      return;
    }
    if (this.villagerSystem.sendVillagerToChop(villagerId, tx, ty)) {
      this.ui.notify('Villager will chop this tile.');
    } else {
      this.ui.notify('Cannot chop here.');
    }
  }

  private villagerActionGo(villagerId: string, tx: number, ty: number): void {
    if (this.stayInShelterMode && this.isVillagerInShelter(villagerId)) {
      const housingSet = new Set(this.buildingSystem.getHousingTiles().map(p => `${p.x},${p.y}`));
      if (!housingSet.has(`${tx},${ty}`)) {
        this.ui.notify('Villagers are staying in shelter. Press "Leave shelter" first.');
        return;
      }
    }
    if (this.villagerSystem.sendVillagerToTile(villagerId, tx, ty)) {
      this.ui.notify('Villager going there.');
    } else {
      this.ui.notify('Cannot go there.');
    }
  }

  /** Send villager to unbuilt building's arrival tile; only one builder per building. */
  private villagerActionSendToBuild(villagerId: string, buildingId: string): void {
    if (this.stayInShelterMode && this.isVillagerInShelter(villagerId)) {
      this.ui.notify('Villagers are staying in shelter. Press "Leave shelter" first.');
      return;
    }
    const building = this.buildingSystem.buildings.find(b => b.id === buildingId);
    if (!building || building.built) {
      this.ui.notify('Not a construction site.');
      return;
    }
    if (building.assignedWorkers.length > 0) {
      this.ui.notify('Another villager is already building this.');
      return;
    }
    const arrivalTiles = this.buildingSystem.getArrivalTiles(building);
    if (arrivalTiles.length === 0) {
      this.ui.notify('Cannot send worker there.');
      return;
    }
    const v = this.villagerSystem.getVillagerById(villagerId);
    if (!v || v.health === HealthState.Dead) {
      this.ui.notify('Villager unavailable.');
      return;
    }
    const tx = arrivalTiles[0].x;
    const ty = arrivalTiles[0].y;
    if (this.villagerSystem.assignPath(v, tx, ty)) {
      v.currentTask = 'building';
      v.taskAttempts = 0;
      this.ui.notify('Villager going to construction site.');
    } else {
      this.ui.notify('No path to construction site.');
    }
  }

  private villagerActionWork(villagerId: string, buildingId: string): void {
    if (this.villagerSystem.assignVillagerToBuilding(villagerId, buildingId, this.buildingSystem.buildings)) {
      const cfg = this.buildingSystem.getBuildingConfig(
        this.buildingSystem.buildings.find(b => b.id === buildingId)!.configId
      );
      this.ui.notify(`Assigned to ${cfg?.name ?? buildingId}`);
    } else {
      this.ui.notify('Cannot assign here.');
    }
  }

  private villagerActionShelter(villagerId: string, building: { tileX: number; tileY: number; configId: string }): void {
    const bcfg = this.buildingSystem.getBuildingConfig(building.configId);
    if (!bcfg) return;
    const hx = building.tileX + Math.floor(bcfg.width / 2);
    const hy = building.tileY + Math.floor(bcfg.height / 2);
    if (this.villagerSystem.sendVillagerToHousing(villagerId, hx, hy)) {
      this.ui.notify('Villager returning to shelter.');
    }
  }

  private tryAssignWorker(buildingId: string): void {
    const building = this.buildingSystem.buildings.find(b => b.id === buildingId);
    if (!building || !building.built) return;
    const cfg = this.buildingSystem.getBuildingConfig(building.configId);
    if (!cfg || cfg.maxWorkers <= 0) return;
    if (building.assignedWorkers.length >= cfg.maxWorkers) return;

    const idle = this.villagerSystem.findClosestIdleVillager(building.tileX, building.tileY);
    if (idle) {
      idle.assignedBuildingId = buildingId;
      building.assignedWorkers.push(idle.id);
      this.ui.notify(`Assigned villager to ${cfg.name}`);
    }
  }

  private handleBuildClick(tx: number, ty: number): void {
    if (!this.selectedBuildingId) return;
    const cfg = this.buildingSystem.getBuildingConfig(this.selectedBuildingId);
    if (!cfg) return;

    if (!this.resourceSystem.canAfford(cfg.costWood, cfg.costTools)) {
      this.ui.notify('Not enough resources!');
      return;
    }

    if (this.selectedBuildingId === 'palisadeWall') {
      this.handlePalisadeClick(tx, ty, cfg);
      return;
    }

    if (!this.buildingSystem.canPlace(this.selectedBuildingId, tx, ty)) {
      this.ui.notify('Cannot place here!');
      return;
    }

    this.resourceSystem.consumeWood(cfg.costWood);
    this.resourceSystem.consumeTools(cfg.costTools);
    const b = this.buildingSystem.placeBuilding(this.selectedBuildingId, tx, ty);
    if (b) {
      if (b.configId === 'palisadeGate') {
        b.rotation = this.detectPalisadeOrientation(tx, ty) ? 90 : 0;
      }
      this.ui.notify(`Placed ${cfg.name}`);
    }
  }

  /** Returns true if the palisade context around (tx,ty) is vertical. */
  private detectPalisadeOrientation(tx: number, ty: number): boolean {
    const above = this.buildingSystem.buildings.find(
      b => (b.configId === 'palisadeWall' || b.configId === 'palisadeGate') && b.tileX === tx && b.tileY === ty - 1
    );
    const below = this.buildingSystem.buildings.find(
      b => (b.configId === 'palisadeWall' || b.configId === 'palisadeGate') && b.tileX === tx && b.tileY === ty + 1
    );
    return !!(above || below);
  }

  private handlePalisadeClick(tx: number, ty: number, cfg: BuildingConfig): void {
    if (!this.palisadeStart) {
      this.palisadeStart = { x: tx, y: ty };
      this.palisadePreview = [{ x: tx, y: ty }];
      this.ui.notify('Click end point to draw palisade line');
      return;
    }

    const start = this.palisadeStart;
    const tiles = this.getPalisadeLine(start, { x: tx, y: ty });
    const isVertical = Math.abs(ty - start.y) > Math.abs(tx - start.x);

    let placed = 0;
    for (const t of tiles) {
      if (this.resourceSystem.canAfford(cfg.costWood, cfg.costTools) && this.buildingSystem.canPlace('palisadeWall', t.x, t.y)) {
        this.resourceSystem.consumeWood(cfg.costWood);
        this.resourceSystem.consumeTools(cfg.costTools);
        const b = this.buildingSystem.placeBuilding('palisadeWall', t.x, t.y);
        if (b) {
          b.rotation = isVertical ? 90 : 0;
          placed++;
        }
      }
    }
    if (placed > 0) {
      this.ui.notify(`Placed ${placed} palisade segments (need builders!)`);
    }
    this.palisadeStart = null;
    this.palisadePreview = [];
  }

  private getPalisadeLine(start: Position, end: Position): Position[] {
    const tiles: Position[] = [];
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const sx = start.x < end.x ? 1 : -1;
    const sy = start.y < end.y ? 1 : -1;
    let err = dx - dy;
    let cx = start.x;
    let cy = start.y;

    while (true) {
      tiles.push({ x: cx, y: cy });
      if (cx === end.x && cy === end.y) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
    }
    return tiles;
  }

  private handleClearClick(tx: number, ty: number): void {
    const tile = this.tileMap.getTile(tx, ty);
    if (tile && tile.type === TileType.Forest && !tile.markedForClearing) {
      tile.markedForClearing = true;
      this.ui.notify('Marked tile for clearing');
    }
  }

  private handleDemolishClick(tx: number, ty: number): void {
    const tile = this.tileMap.getTile(tx, ty);
    if (tile && tile.buildingId) {
      const building = this.buildingSystem.buildings.find(b => b.id === tile.buildingId);
      if (building) {
        const workerIds = [...(building.assignedWorkers || [])];
        const cfg = this.buildingSystem.getBuildingConfig(building.configId);
        this.buildingSystem.demolishBuilding(building.id);
        for (const vid of workerIds) {
          const v = this.villagerSystem.getVillagerById(vid);
          if (v && v.health !== HealthState.Dead) {
            v.state = VillagerState.Idle;
            v.currentTask = null;
            v.path = [];
            v.targetX = null;
            v.targetY = null;
          }
        }
        if (cfg) {
          this.resourceSystem.addWood(Math.floor(cfg.costWood * 0.3));
        }
        this.ui.notify('Building demolished');
      }
    }
    this.mode = 'normal';
  }

  private updateForestClearing(dt: number): void {
    const cfg = getConfig().villagers;
    const housingTiles = this.buildingSystem.getHousingTiles();
    const housingSet = new Set(housingTiles.map(p => `${p.x},${p.y}`));
    let anyChoppingThisFrame = false;
    for (let y = 0; y < this.tileMap.height; y++) {
      for (let x = 0; x < this.tileMap.width; x++) {
        const tile = this.tileMap.getTile(x, y);
        if (!tile || !tile.markedForClearing || tile.type !== TileType.Forest) continue;

        const nearbyVillager = this.findNearbyIdleOrWorking(x, y, 2, this.stayInShelterMode ? housingSet : null);
        if (nearbyVillager) {
          if (nearbyVillager.state === VillagerState.Idle) {
            if (this.villagerSystem.isTileAlreadyBeingClearedByOther(nearbyVillager.id, x, y)) continue;
            nearbyVillager.currentTask = 'clearing';
            this.villagerSystem.assignPath(nearbyVillager, x, y);
          }
          if (Math.floor(nearbyVillager.x) === x && Math.floor(nearbyVillager.y) === y) {
            nearbyVillager.state = VillagerState.Working;
            nearbyVillager.currentTask = 'clearing';
            tile.clearingProgress += dt / cfg.clearForestTime;
            anyChoppingThisFrame = true;
            this.soundManager.playWood();
            if (tile.clearingProgress >= 1) {
              tile.type = TileType.Clear;
              tile.markedForClearing = false;
              tile.clearingProgress = 0;
              const baseWood = getConfig().resources.woodPerForestTile ?? 2;
              const wood = this.buildingSystem.isTileInLumberCampRadius(x, y) ? 4 : baseWood;
              this.resourceSystem.addWood(wood);
              nearbyVillager.state = VillagerState.Idle;
              nearbyVillager.currentTask = null;
            }
          }
        }
      }
    }
    if (!anyChoppingThisFrame) this.soundManager.stopWood();
  }

  private findNearbyIdleOrWorking(tx: number, ty: number, radius: number, excludeHousingTiles?: Set<string> | null) {
    for (const v of this.villagerSystem.villagers) {
      if (v.health === HealthState.Dead) continue;
      if (v.state !== VillagerState.Idle && v.currentTask !== 'clearing') continue;
      if (v.currentTask === 'clearing' && (v.targetX !== tx || v.targetY !== ty)) continue;
      if (excludeHousingTiles && excludeHousingTiles.has(`${Math.floor(v.x)},${Math.floor(v.y)}`)) continue;
      const dist = Math.abs(Math.floor(v.x) - tx) + Math.abs(Math.floor(v.y) - ty);
      if (dist <= radius) return v;
    }
    const idle = this.villagerSystem.findClosestIdleVillager(tx, ty);
    if (idle && idle.currentTask === 'clearing' && (idle.targetX !== tx || idle.targetY !== ty)) return null;
    if (idle && excludeHousingTiles && excludeHousingTiles.has(`${Math.floor(idle.x)},${Math.floor(idle.y)}`)) return null;
    return idle;
  }

  private updateHunting(dt: number): void {
    const cfg = getConfig().villagers;
    const duration = (cfg as Record<string, number>).freeHuntDuration ?? 12;
    const foodAmount = (cfg as Record<string, number>).freeHuntFoodAmount ?? 8;
    const deathChance = (cfg as Record<string, number>).freeHuntDeathChance ?? 0.08;
    const center = this.tileMap.getClearingCenter();
    const housingTiles = this.buildingSystem.getHousingTiles();

    for (const v of this.villagerSystem.villagers) {
      if (v.health === HealthState.Dead) continue;
      if (v.currentTask !== 'hunting' || v.state !== VillagerState.Working) continue;

      v.taskProgress += dt;
      if (v.taskProgress < duration) continue;

      v.currentTask = null;
      v.state = VillagerState.Idle;
      if (Math.random() < deathChance) {
        this.villagerSystem.damageVillager(v, 100);
        this.ui.notify('A villager died in the forest...');
      } else {
        this.resourceSystem.addFood(foodAmount);
        this.ui.notify('Hunters returned with food!');
        let home = center;
        if (housingTiles.length > 0) {
          let bestDist = Infinity;
          for (const t of housingTiles) {
            const d = Math.abs(v.x - t.x) + Math.abs(v.y - t.y);
            if (d < bestDist) {
              bestDist = d;
              home = t;
            }
          }
        }
        this.villagerSystem.assignPath(v, home.x, home.y);
        v.currentTask = 'returnHome';
      }
    }
  }

  private updateResourceProduction(dt: number): void {
    this.productionAccum += dt;
    if (this.productionAccum < 1) return;
    this.productionAccum = 0;

    const cfg = getConfig().resources;
    const toolBonus = this.techSystem.getEffect('toolProductivityBonus') || cfg.toolProductivityBonus;
    const hasTools = this.resourceSystem.resources.tools > 0;
    const toolMult = hasTools ? toolBonus : 1;

    for (const b of this.buildingSystem.buildings) {
      if (!b.built) continue;
      const workers = b.assignedWorkers.length;
      if (workers === 0) continue;

      switch (b.configId) {
        case 'garden':
          this.resourceSystem.addFood(cfg.gardenFoodPerSecond * workers * toolMult);
          break;
        case 'hunterHut': {
          this.resourceSystem.addFood(cfg.hunterFoodPerSecond * workers * toolMult);
          this.resourceSystem.addFur(cfg.hunterFurPerSecond * workers);
          if (Math.random() < cfg.huntingDeathChance * 0.01) {
            const workerId = b.assignedWorkers[Math.floor(Math.random() * workers)];
            const v = this.villagerSystem.villagers.find(v => v.id === workerId);
            if (v) {
              this.villagerSystem.damageVillager(v, 40);
              this.ui.notify('A hunter was injured!');
            }
          }
          break;
        }
        case 'workshop': {
          if (this.resourceSystem.resources.wood >= cfg.workshopToolCostWood) {
            this.resourceSystem.consumeWood(cfg.workshopToolCostWood);
            this.resourceSystem.addTools(1);
          }
          break;
        }
        case 'lumberCamp': {
          const nearby = this.countNearbyForest(b.tileX, b.tileY, 5);
          if (nearby > 0) {
            this.resourceSystem.addWood(0.5 * workers * toolMult);
          }
          break;
        }
        case 'smokehouse': {
          break;
        }
        case 'furWorkshop': {
          if (this.resourceSystem.resources.fur >= 0.1) {
            this.resourceSystem.resources.fur = Math.max(0, this.resourceSystem.resources.fur - 0.05 * workers);
            this.furClothingProduced += 0.05 * workers;
          }
          break;
        }
      }
    }
  }

  private countNearbyForest(tx: number, ty: number, radius: number): number {
    let count = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tile = this.tileMap.getTile(tx + dx, ty + dy);
        if (tile && tile.type === TileType.Forest) count++;
      }
    }
    return count;
  }

  private updateFoodConsumption(dt: number): void {
    const cfg = getConfig().villagers;
    const alive = this.villagerSystem.getAliveCount();
    const winterMult = this.seasonSystem.isWinter() ? cfg.winterFoodConsumptionMultiplier : 1;
    const smokehouseBonus = this.buildingSystem.getBuildingsOfType('smokehouse').length > 0
      ? getConfig().resources.smokehouseFoodEfficiencyBonus : 1;

    const consumption = cfg.foodConsumptionPerSecond * alive * winterMult * dt / smokehouseBonus;
    this.resourceSystem.consumeFood(consumption);

    if (this.resourceSystem.resources.food <= 0) {
      this.foodConsumptionAccum += dt;
      const starvationDelay = 10;
      const starvationInterval = 20;
      if (this.foodConsumptionAccum >= starvationDelay) {
        const timeSinceDelay = this.foodConsumptionAccum - starvationDelay;
        const kills = Math.floor(timeSinceDelay / starvationInterval);
        const prevKills = Math.floor((timeSinceDelay - dt) / starvationInterval);
        if (kills > prevKills) {
          const villagers = this.villagerSystem.getAliveVillagers();
          if (villagers.length > 0) {
            const victim = villagers[Math.floor(Math.random() * villagers.length)];
            this.villagerSystem.damageVillager(victim, 100);
            this.ui.notify('A villager died from starvation!');
          }
        }
      }
    } else {
      this.foodConsumptionAccum = 0;
    }
  }

  private updatePopulationGrowth(dt: number): void {
    if (this.seasonSystem.season === Season.Winter) return;

    const cfg = getConfig().comfort;
    this.growthAccum += dt;
    if (this.growthAccum < cfg.growthCheckInterval) return;
    this.growthAccum = 0;

    if (!this.comfortSystem.canGrow()) return;

    const alive = this.villagerSystem.getAliveCount();
    const housing = this.buildingSystem.getHousingCapacity();
    if (alive >= housing) return;

    if (Math.random() < cfg.populationGrowthChance) {
      const center = this.tileMap.getClearingCenter();
      this.villagerSystem.spawnVillager(center.x, center.y);
      this.ui.notify('A new villager has arrived!');
      this.checkLevelUp();
    }
  }

  private updateComfort(): void {
    const alive = this.villagerSystem.getAliveCount();
    const healthy = this.villagerSystem.villagers.filter(v => v.health === HealthState.Healthy).length;
    const housing = this.buildingSystem.getHousingCapacity();
    const palisadeHP = this.buildingSystem.getPalisadeHP();

    const furCfg = getConfig().fur;
    const rawFurWarmth = this.resourceSystem.resources.fur * furCfg.warmthPerFur;
    const clothingWarmth = this.furClothingProduced * furCfg.warmthPerFur * 3;
    const warmth = Math.min(rawFurWarmth + clothingWarmth, furCfg.maxWarmthFromFur);
    const foodRatio = this.resourceSystem.resources.food > 0 ? Math.min(this.resourceSystem.resources.food / (alive * 10), 1) : 0;

    this.comfortSystem.update({
      foodRatio,
      warmthRatio: this.seasonSystem.isWinter() ? warmth : 1,
      housingRatio: alive > 0 ? Math.min(housing / alive, 1) : 1,
      healthRatio: alive > 0 ? healthy / alive : 1,
      defenseScore: Math.min(palisadeHP / 200, 1),
      buildingComfortBonus: this.buildingSystem.getComfortBonus(),
    });
  }

  private updateCombat(dt: number): void {
    if (!this.hordeSystem.isActive) return;

    const cfg = getConfig().horde;
    const toolDmg = this.techSystem.getEffect('toolDefenseBonus') || (cfg.villagerToolDamage as number);
    const baseDmg = cfg.villagerBaseDamage as number;
    const hasTools = this.resourceSystem.resources.tools > 0;

    for (const enemy of this.hordeSystem.getActiveEnemies()) {
      if (enemy.state !== 'attacking') continue;

      for (const v of this.villagerSystem.getAliveVillagers()) {
        const dist = Math.abs(v.x - enemy.x) + Math.abs(v.y - enemy.y);
        if (dist < 2) {
          v.state = VillagerState.Defending;
          const dmg = hasTools ? toolDmg : baseDmg;
          this.hordeSystem.damageEnemy(enemy.id, dmg * dt);
        }
      }
    }
  }

  private isHouseBuilding(buildingId: string): boolean {
    const b = this.buildingSystem.buildings.find(x => x.id === buildingId);
    if (!b) return false;
    return ['hut', 'house', 'largeHouse'].includes(b.configId);
  }

  /** Called when an enemy from the horde reaches a villager who is outside (not in hut/house/largeHouse). */
  private killVillagerByHorde(villagerId: string): void {
    const v = this.villagerSystem.getVillagerById(villagerId);
    if (v && v.health !== HealthState.Dead) {
      this.soundManager.playHordeAttack();
      this.villagerSystem.damageVillager(v, 100);
    }
  }

  /** Called when the horde reaches the village: kill all villagers not standing on a housing tile. */
  private killVillagersOutside(): void {
    const housingTiles = this.buildingSystem.getHousingTiles();
    const housingSet = new Set(housingTiles.map(p => `${p.x},${p.y}`));
    for (const v of this.villagerSystem.getAliveVillagers()) {
      const key = `${Math.floor(v.x)},${Math.floor(v.y)}`;
      if (!housingSet.has(key)) {
        this.villagerSystem.damageVillager(v, 100);
      }
    }
  }

  private damageRandomVillager(damage: number): void {
    const alive = this.villagerSystem.getAliveVillagers();
    const minSurvivors = getConfig().horde.minSurvivors as number;
    if (alive.length <= minSurvivors) return;

    const victim = alive[Math.floor(Math.random() * alive.length)];
    this.villagerSystem.damageVillager(victim, damage);
  }

  private assignIdleVillagers(): void {
    // No auto-assign of builders: construction starts only when a worker steps on the building's arrival tile.
  }

  private getAvailableBuilders(): number {
    return this.villagerSystem.villagers.filter(
      v => v.health !== HealthState.Dead && (v.state === VillagerState.Building || v.state === VillagerState.Idle)
    ).length;
  }

  /** Number of workers currently standing on this building's arrival tiles (construction only progresses when > 0). */
  private getBuildersOnSite(buildingId: string): number {
    const b = this.buildingSystem.buildings.find(x => x.id === buildingId);
    if (!b || b.built) return 0;
    const arrivalTiles = this.buildingSystem.getArrivalTiles(b);
    const tileSet = new Set(arrivalTiles.map(p => `${p.x},${p.y}`));
    let count = 0;
    for (const vid of b.assignedWorkers) {
      const v = this.villagerSystem.getVillagerById(vid);
      if (!v || v.health === HealthState.Dead) continue;
      const key = `${Math.floor(v.x)},${Math.floor(v.y)}`;
      if (tileSet.has(key)) count++;
    }
    return count;
  }

  /** True if at least one villager is on site building (unbuilt) or on site repairing. */
  private hasAnyoneBuildingOrRepairing(): boolean {
    for (const b of this.buildingSystem.buildings) {
      if (!b.built && this.getBuildersOnSite(b.id) > 0) return true;
    }
    for (const v of this.villagerSystem.villagers) {
      if (v.health === HealthState.Dead || v.currentTask !== 'repairing') continue;
      const building = this.buildingSystem.buildings.find(x => x.id === v.assignedBuildingId);
      if (!building) continue;
      const arrivalTiles = this.buildingSystem.getArrivalTiles(building);
      const atBuilding = arrivalTiles.some(t => Math.floor(v.x) === t.x && Math.floor(v.y) === t.y);
      if (atBuilding) return true;
    }
    return false;
  }

  /** When a villager arrives on an unbuilt building's arrival tile, assign them — max 1 builder per building. */
  private assignWorkersToUnbuiltBuildingsOnArrival(): void {
    if (this.stayInShelterMode) return;
    for (const v of this.villagerSystem.villagers) {
      if (v.health === HealthState.Dead) continue;
      const tx = Math.floor(v.x);
      const ty = Math.floor(v.y);
      const building = this.buildingSystem.getUnbuiltBuildingForArrivalTile(tx, ty);
      if (!building || building.assignedWorkers.includes(v.id)) continue;
      if (building.assignedWorkers.length >= 1) continue;
      building.assignedWorkers.push(v.id);
      v.state = VillagerState.Building;
      v.currentTask = 'building';
    }
  }

  /** When a building is completed, release its builders so they become Idle again. */
  private releaseBuildersFromCompletedBuildings(): void {
    for (const b of this.buildingSystem.buildings) {
      if (!b.built || b.assignedWorkers.length === 0) continue;
      for (const villagerId of b.assignedWorkers) {
        const v = this.villagerSystem.getVillagerById(villagerId);
        if (v && v.health !== HealthState.Dead) {
          v.state = VillagerState.Idle;
          v.currentTask = null;
          v.path = [];
          v.targetX = null;
          v.targetY = null;
        }
      }
      b.assignedWorkers = [];
    }
  }

  private ageFurs(): void {
    const lifetime = getConfig().fur.lifetimeWinters;
    this.furAges.push(Math.floor(this.resourceSystem.resources.fur));
    if (this.furAges.length > lifetime) {
      const expired = this.furAges.shift()!;
      this.resourceSystem.resources.fur = Math.max(0, this.resourceSystem.resources.fur - expired * 0.2);
    }
  }

  private checkLevelUp(): void {
    const alive = this.villagerSystem.getAliveCount();
    const levels = getConfig().levels;
    let newLevel = 1;
    for (const [lvl, data] of Object.entries(levels)) {
      if (alive >= data.populationThreshold) {
        newLevel = Math.max(newLevel, parseInt(lvl));
      }
    }
    if (newLevel > this.level) {
      this.level = newLevel;
      this.resourceSystem.addTechPoints(getConfig().technology.techPointsPerLevelReached);
      this.ui.notify(`Level up! Village is now Level ${this.level}. New technologies available!`);
    }
  }

  private startBuildMode(buildingId: string): void {
    this.mode = 'build';
    this.selectedBuildingId = buildingId;
    this.palisadeStart = null;
    this.palisadePreview = [];

    if (buildingId === 'palisadeWall') {
      this.mode = 'build';
    }
  }

  private refreshBuildPanel(): void {
    this.ui.updateBuildPanel(
      this.buildingSystem.getAllBuildingConfigs(),
      this.techSystem.unlockedBuildings,
      (w, t) => this.resourceSystem.canAfford(w, t),
      2,
    );
  }

  private cancelBuild(): void {
    this.mode = 'normal';
    this.selectedBuildingId = null;
    this.palisadeStart = null;
    this.palisadePreview = [];
    this.ui.closePanels();
  }

  private cancelBuilding(buildingId: string): void {
    const building = this.buildingSystem.buildings.find(b => b.id === buildingId);
    if (!building || building.built) return;
    const cfg = this.buildingSystem.getBuildingConfig(building.configId);
    if (cfg) {
      this.resourceSystem.addWood(Math.floor(cfg.costWood * 0.5));
    }
    for (const vid of building.assignedWorkers) {
      const v = this.villagerSystem.getVillagerById(vid);
      if (v) {
        v.state = VillagerState.Idle;
        v.currentTask = null;
        v.assignedBuildingId = null;
        v.path = [];
      }
    }
    this.buildingSystem.demolishBuilding(buildingId);
    this.ui.notify('Construction cancelled. 50% wood refunded.');
    this.ui.hideInfo();
    this.ui.hideActionMenu();
  }

  private startDemolish(buildingId: string): void {
    const building = this.buildingSystem.buildings.find(b => b.id === buildingId);
    if (!building || !building.built) return;
    for (const vid of building.assignedWorkers) {
      const v = this.villagerSystem.getVillagerById(vid);
      if (v) {
        v.state = VillagerState.Idle;
        v.currentTask = null;
        v.assignedBuildingId = null;
        v.path = [];
      }
    }
    const cfg = this.buildingSystem.getBuildingConfig(building.configId);
    this.buildingSystem.demolishBuilding(buildingId);
    this.ui.notify(`${cfg?.name ?? 'Building'} demolished.`);
    this.ui.hideInfo();
    this.ui.hideActionMenu();
  }

  private sendRepairToBuilding(buildingId: string): void {
    const building = this.buildingSystem.buildings.find(b => b.id === buildingId);
    if (!building || !building.built) {
      this.ui.notify('Nothing to repair.');
      return;
    }
    if (building.hp >= building.maxHp && !building.needsRepair) {
      this.ui.notify('Building is fine.');
      return;
    }
    const repairCfg = getConfig().repair;
    const bcfg = this.buildingSystem.getBuildingConfig(building.configId);
    const woodCost = Math.ceil((bcfg?.costWood ?? 10) * (repairCfg.repairCostWoodPercent ?? 0.3));
    if (this.resourceSystem.resources.wood < woodCost) {
      this.ui.notify(`Need ${woodCost} wood to repair.`);
      return;
    }
    const idle = this.villagerSystem.findClosestIdleVillager(building.tileX, building.tileY);
    if (!idle) {
      this.ui.notify('No idle villager available.');
      return;
    }
    const arrivalTiles = this.buildingSystem.getArrivalTiles(building);
    if (arrivalTiles.length === 0) {
      this.ui.notify('Cannot reach building.');
      return;
    }
    if (this.villagerSystem.assignPath(idle, arrivalTiles[0].x, arrivalTiles[0].y)) {
      this.resourceSystem.consumeWood(woodCost);
      idle.currentTask = 'repairing';
      idle.assignedBuildingId = building.id;
      idle.taskProgress = 0;
      idle.taskAttempts = 0;
      this.ui.notify(`Repairing ${bcfg?.name ?? 'building'}... (-${woodCost} wood)`);
    } else {
      this.ui.notify('No path to building.');
    }
    this.ui.hideActionMenu();
  }

  private toggleClearMode(): void {
    this.mode = this.mode === 'clear' ? 'normal' : 'clear';
    if (this.mode === 'clear') {
      this.clearModeHintCount++;
      if (this.clearModeHintCount === 1 || (this.clearModeHintCount - 1) % 5 === 0) {
        this.ui.notify('Click forest tiles to mark for clearing, then press "Send to chop"');
      }
    }
  }

  private goHunting(): void {
    if (this.stayInShelterMode) {
      this.ui.notify('Villagers are staying in shelter. Press "Leave shelter" first.');
      return;
    }
    const forestTiles = this.tileMap.getForestEdgeTiles();
    if (forestTiles.length === 0) {
      this.ui.notify('No forest nearby to hunt.');
      return;
    }
    const center = this.tileMap.getClearingCenter();
    const villagerId = this.selectedVillagerId ?? this.villagerSystem.findClosestIdleVillager(center.x, center.y)?.id ?? null;
    if (!villagerId) {
      this.ui.notify('Select a villager or have an idle one.');
      return;
    }
    if (this.villagerSystem.sendVillagerToHunt(villagerId)) {
      this.soundManager.playHunt();
      this.ui.notify('One villager went hunting. Risk in the forest!');
    } else {
      this.ui.notify('This villager cannot hunt (already hunting or busy).');
    }
  }

  private sendAllToChop(): void {
    if (this.stayInShelterMode) {
      this.ui.notify('Villagers are staying in shelter. Press "Leave shelter" first.');
      return;
    }
    const marked = this.tileMap.getMarkedClearingTiles();
    if (marked.length === 0) {
      this.clearModeHintCount++;
      if (this.clearModeHintCount === 1 || (this.clearModeHintCount - 1) % 5 === 0) {
        this.ui.notify('First mark forest tiles for clearing (🪓 Clear mode).');
      }
      return;
    }
    let villagerId: string | null = this.selectedVillagerId;
    if (!villagerId) {
      const idle = this.villagerSystem.findClosestIdleVillager(marked[0].x, marked[0].y);
      villagerId = idle?.id ?? null;
    }
    if (!villagerId) {
      this.ui.notify('Select a villager or have an idle one.');
      return;
    }
    const v = this.villagerSystem.getVillagerById(villagerId);
    const tile = v ? this.getClosestMarkedTile(v.x, v.y, marked) : marked[0];
    if (this.villagerSystem.sendVillagerToChop(villagerId, tile.x, tile.y)) {
      this.ui.notify('One villager sent to chop.');
    } else {
      this.ui.notify('Cannot send this villager to chop.');
    }
  }

  private getClosestMarkedTile(vx: number, vy: number, marked: { x: number; y: number }[]): { x: number; y: number } {
    let best = marked[0];
    let bestDist = Math.abs(vx - best.x) + Math.abs(vy - best.y);
    for (const t of marked) {
      const d = Math.abs(vx - t.x) + Math.abs(vy - t.y);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  private returnHome(): void {
    const housingTiles = this.buildingSystem.getHousingTiles();
    if (housingTiles.length === 0) {
      this.ui.notify('No housing built yet.');
      return;
    }
    this.soundManager.playShelter();
    this.stayInShelterMode = true;

    for (const b of this.buildingSystem.buildings) {
      b.assignedWorkers = [];
    }
    for (const v of this.villagerSystem.getAliveVillagers()) {
      v.assignedBuildingId = null;
      v.currentTask = null;
      v.path = [];
      v.state = VillagerState.Idle;
      v.targetX = null;
      v.targetY = null;
    }

    const n = this.villagerSystem.assignAllReturnHome(housingTiles);
    this.ui.notify(n > 0 ? `Everyone going to shelter (${n}). Stay in shelter mode on.` : 'Stay in shelter mode on.');
  }

  private leaveShelter(): void {
    this.soundManager.playLeaveShelter();
    this.stayInShelterMode = false;
    this.ui.notify('Villagers may leave shelter again.');
  }

  private repairAll(): void {
    const damaged = this.buildingSystem.buildings.filter(b => b.built && b.hp < b.maxHp);
    if (damaged.length === 0) {
      this.ui.notify('No buildings need repair.');
      return;
    }
    const repairCfg = getConfig().repair;
    const repairCostPct = (repairCfg as Record<string, number>).repairCostWoodPercent ?? 0.3;
    const assignedBuildings = new Set<string>();
    for (const v of this.villagerSystem.villagers) {
      if (v.health === HealthState.Dead) continue;
      if (v.currentTask === 'repairing' && v.assignedBuildingId) assignedBuildings.add(v.assignedBuildingId);
    }

    let assigned = 0;
    for (const b of damaged) {
      if (assignedBuildings.has(b.id)) continue;
      const cfg = this.buildingSystem.getBuildingConfig(b.configId);
      if (!cfg) continue;
      const woodCost = Math.ceil(cfg.costWood * repairCostPct);
      if (!this.resourceSystem.canAfford(woodCost, 0)) continue;

      const idle = this.villagerSystem.findClosestIdleVillager(b.tileX, b.tileY);
      if (!idle) break;

      const arrivalTiles = this.buildingSystem.getArrivalTiles(b);
      if (arrivalTiles.length === 0) continue;

      if (this.villagerSystem.assignPath(idle, arrivalTiles[0].x, arrivalTiles[0].y)) {
        this.resourceSystem.consumeWood(woodCost);
        idle.currentTask = 'repairing';
        idle.assignedBuildingId = b.id;
        idle.taskProgress = 0;
        idle.taskAttempts = 0;
        assignedBuildings.add(b.id);
        assigned++;
      }
    }
    this.ui.notify(assigned > 0 ? `${assigned} villager(s) sent to repair.` : 'No idle villagers or resources to repair.');
  }

  private updateRepair(dt: number): void {
    const repairCfg = getConfig().repair;
    const repairTime = (repairCfg as Record<string, number>).repairTime ?? 8;

    for (const v of this.villagerSystem.villagers) {
      if (v.health === HealthState.Dead || v.currentTask !== 'repairing') continue;
      if (v.state !== VillagerState.Working && v.state !== VillagerState.Idle) {
        if (v.state !== VillagerState.Moving) continue;
        continue;
      }

      const building = this.buildingSystem.buildings.find(b => b.id === v.assignedBuildingId);
      if (!building) {
        v.currentTask = null;
        v.assignedBuildingId = null;
        v.state = VillagerState.Idle;
        continue;
      }

      const arrivalTiles = this.buildingSystem.getArrivalTiles(building);
      const atBuilding = arrivalTiles.some(
        t => Math.floor(v.x) === t.x && Math.floor(v.y) === t.y
      );
      if (!atBuilding) continue;

      v.state = VillagerState.Working;
      v.taskProgress += dt;

      if (v.taskProgress >= repairTime) {
        this.buildingSystem.repairBuilding(building.id);
        const bcfg = this.buildingSystem.getBuildingConfig(building.configId);
        this.ui.notify(`${bcfg?.name ?? 'Building'} repaired!`);
        v.currentTask = null;
        v.assignedBuildingId = null;
        v.state = VillagerState.Idle;
        v.taskProgress = 0;
      }
    }
  }

  private updateFarming(dt: number): void {
    const cfg = getConfig().villagers;
    const duration = (cfg as Record<string, number>).farmingDuration ?? 50;
    const harvestFood = (cfg as Record<string, number>).farmingHarvestFood ?? 45;

    for (const b of this.buildingSystem.buildings) {
      if (b.configId === 'garden') b.farmingProgress = undefined;
    }

    for (const v of this.villagerSystem.villagers) {
      if (v.health === HealthState.Dead || v.currentTask !== 'farming') continue;
      if (v.state === VillagerState.Moving) continue;

      const building = this.buildingSystem.buildings.find(b => b.id === v.assignedBuildingId);
      if (!building) {
        v.currentTask = null;
        v.assignedBuildingId = null;
        v.state = VillagerState.Idle;
        continue;
      }

      const arrivalTiles = this.buildingSystem.getArrivalTiles(building);
      const atBuilding = arrivalTiles.some(
        t => Math.floor(v.x) === t.x && Math.floor(v.y) === t.y
      );
      if (!atBuilding) continue;

      v.state = VillagerState.Working;
      v.taskProgress += dt;

      if (building.configId === 'garden') {
        building.farmingProgress = Math.min(1, v.taskProgress / duration);
      }

      if (v.taskProgress >= duration) {
        this.resourceSystem.addFood(harvestFood);
        this.ui.notify('Garden harvest! +' + harvestFood + ' food');
        v.taskProgress = 0;
      }
    }
  }

  private updateToggleGate(dt: number): void {
    for (const v of this.villagerSystem.villagers) {
      if (v.health === HealthState.Dead || v.currentTask !== 'toggleGate') continue;
      const building = this.buildingSystem.buildings.find(b => b.id === v.assignedBuildingId);
      if (!building || building.configId !== 'palisadeGate') {
        v.currentTask = null;
        v.assignedBuildingId = null;
        continue;
      }
      const arrivalTiles = this.buildingSystem.getArrivalTiles(building);
      const atGate = arrivalTiles.some(t => Math.floor(v.x) === t.x && Math.floor(v.y) === t.y);
      if (!atGate) continue;
      building.gateOpen = !building.gateOpen;
      this.ui.notify(building.gateOpen ? 'Gate opened.' : 'Gate closed.');
      v.currentTask = null;
      v.assignedBuildingId = null;
      v.state = VillagerState.Idle;
    }
  }

  private sendVillagerToFarm(villagerId: string, buildingId: string): void {
    if (this.stayInShelterMode && this.isVillagerInShelter(villagerId)) {
      this.ui.notify('Villagers are staying in shelter. Press "Leave shelter" first.');
      return;
    }
    const building = this.buildingSystem.buildings.find(b => b.id === buildingId);
    if (!building || !building.built || building.configId !== 'garden') {
      this.ui.notify('Not a garden.');
      return;
    }
    const hasFarmer = this.villagerSystem.villagers.some(
      v => v.health !== HealthState.Dead && v.currentTask === 'farming' && v.assignedBuildingId === buildingId
    );
    if (hasFarmer) {
      this.ui.notify('Someone is already farming here.');
      return;
    }
    const v = this.villagerSystem.getVillagerById(villagerId);
    if (!v || v.health === HealthState.Dead) {
      this.ui.notify('Villager unavailable.');
      return;
    }
    const arrivalTiles = this.buildingSystem.getArrivalTiles(building);
    if (arrivalTiles.length === 0) {
      this.ui.notify('Cannot reach the garden.');
      return;
    }
    if (this.villagerSystem.assignPath(v, arrivalTiles[0].x, arrivalTiles[0].y)) {
      v.currentTask = 'farming';
      v.assignedBuildingId = buildingId;
      v.taskProgress = 0;
      v.taskAttempts = 0;
      this.ui.notify('Villager sent to grow food.');
    } else {
      this.ui.notify('No path to the garden.');
    }
  }

  private sendVillagerToToggleGate(villagerId: string, buildingId: string): void {
    if (this.stayInShelterMode && this.isVillagerInShelter(villagerId)) {
      this.ui.notify('Villagers are staying in shelter. Press "Leave shelter" first.');
      return;
    }
    const building = this.buildingSystem.buildings.find(b => b.id === buildingId);
    if (!building || !building.built || building.configId !== 'palisadeGate') {
      this.ui.notify('Not a gate.');
      return;
    }
    const v = this.villagerSystem.getVillagerById(villagerId);
    if (!v || v.health === HealthState.Dead) {
      this.ui.notify('Villager unavailable.');
      return;
    }
    const arrivalTiles = this.buildingSystem.getArrivalTiles(building);
    if (arrivalTiles.length === 0) {
      this.ui.notify('Cannot reach the gate.');
      return;
    }
    if (this.villagerSystem.assignPath(v, arrivalTiles[0].x, arrivalTiles[0].y)) {
      v.currentTask = 'toggleGate';
      v.assignedBuildingId = buildingId;
      v.taskAttempts = 0;
      this.ui.notify('Villager going to gate.');
    } else {
      this.ui.notify('No path to the gate.');
    }
  }

  /** Restart game from scratch (new map, villagers, resources). */
  private restart(): void {
    this.tileMap.reset();
    this.buildingSystem.reset();
    this.villagerSystem.reset();
    this.resourceSystem.reset();
    this.seasonSystem.reset();
    this.techSystem.reset();
    this.hordeSystem.endWinter();
    this.weatherSystem.reset();

    this.mode = 'normal';
    this.selectedBuildingId = null;
    this.selectedVillagerId = null;
    this.level = 1;
    this.furAges = [];
    this.foodConsumptionAccum = 0;
    this.productionAccum = 0;
    this.growthAccum = 0;
    this.furClothingProduced = 0;
    this.palisadeStart = null;
    this.palisadePreview = [];
    this.gameOver = false;
    this.stayInShelterMode = false;
    this.demoMessageShown = false;
    this.foodLowSoundPlayed = false;
    this.clearModeHintCount = 0;

    this.initWorld();

    this.gameLoop.gameSpeed = 1;
    this.ui.hideGameOver();

    const center = this.tileMap.getClearingCenter();
    const ts = getConfig().map.tileSize;
    this.camera.centerOn(center.x * ts, center.y * ts);

    this.ui.notify('New game started.');
  }

  private isVillagerInShelter(villagerId: string): boolean {
    const v = this.villagerSystem.getVillagerById(villagerId);
    if (!v) return false;
    const housingTiles = this.buildingSystem.getHousingTiles();
    const key = `${Math.floor(v.x)},${Math.floor(v.y)}`;
    return housingTiles.some(t => `${t.x},${t.y}` === key);
  }

  private toggleDemolishMode(): void {
    this.mode = this.mode === 'demolish' ? 'normal' : 'demolish';
    if (this.mode === 'demolish') {
      this.ui.notify('Click a building to demolish it');
    }
  }

  private setSpeed(speed: number): void {
    this.gameLoop.gameSpeed = speed;
  }

  private unlockTech(techId: string): void {
    if (!this.techSystem.canUnlock(techId, this.resourceSystem.resources.techPoints, this.level)) {
      this.ui.notify('Cannot unlock this technology');
      return;
    }
    const tech = this.techSystem.getAllTechs()[techId];
    if (!tech) return;

    this.resourceSystem.resources.techPoints -= tech.cost;
    const newBuildings = this.techSystem.unlockTech(techId);
    this.ui.notify(`Unlocked: ${tech.name}`);
    if (newBuildings.length > 0) {
      this.ui.notify(`New buildings: ${newBuildings.join(', ')}`);
    }
  }

  private updateUI(): void {
    const alive = this.villagerSystem.getAliveCount();
    const cfg = getConfig().villagers;
    const winterMult = this.seasonSystem.isWinter() ? cfg.winterFoodConsumptionMultiplier : 1;
    const smokehouseBonus = this.buildingSystem.getBuildingsOfType('smokehouse').length > 0
      ? getConfig().resources.smokehouseFoodEfficiencyBonus : 1;
    const foodConsumptionPerSecond = cfg.foodConsumptionPerSecond * alive * winterMult / smokehouseBonus;
    const foodLow = foodConsumptionPerSecond > 0 &&
      this.resourceSystem.resources.food < 40 * foodConsumptionPerSecond;

    if (foodLow) {
      if (!this.foodLowSoundPlayed) {
        this.foodLowSoundPlayed = true;
        this.soundManager.playHungry();
      }
    } else {
      this.foodLowSoundPlayed = false;
    }

    this.ui.updateTopBar({
      resources: this.resourceSystem.resources,
      season: this.seasonSystem.season,
      seasonProgress: this.seasonSystem.seasonProgress,
      comfort: this.comfortSystem.comfort,
      year: this.seasonSystem.year,
      level: this.level,
      population: alive,
      housing: this.buildingSystem.getHousingCapacity(),
      fps: this.gameLoop.getFPS(),
      soundOn: this.soundManager.isSoundEnabled(),
      gameSpeed: this.gameLoop.gameSpeed,
      foodLow,
    });

    this.uiUpdateCounter++;
    if (this.uiUpdateCounter % 15 === 0) {
      if (!this.ui.isBuildPanelOpen()) {
        this.ui.updateBuildPanel(
          this.buildingSystem.getAllBuildingConfigs(),
          this.techSystem.unlockedBuildings,
          (w, t) => this.resourceSystem.canAfford(w, t),
          2,
        );
      }
      this.ui.updateTechPanel(
        this.techSystem.getAvailableTechs(this.level),
        this.techSystem.unlockedTechs,
        this.resourceSystem.resources.techPoints,
        this.level,
      );
    }

    if (this.mode === 'build' && this.selectedBuildingId === 'palisadeWall' && this.palisadeStart) {
      const { tileX, tileY } = this.input.state;
      this.palisadePreview = this.getPalisadeLine(this.palisadeStart, { x: tileX, y: tileY });
    }
  }

  private manualSave(): void {
    const saved = this.saveSystem.save(this.serializeState());
    this.ui.notify(saved ? 'Game saved!' : 'Save failed!');
  }

  private manualLoad(): void {
    const data = this.saveSystem.load();
    if (data) {
      this.deserializeState(data);
      this.gameOver = false;
      this.foodLowSoundPlayed = false;
      this.clearModeHintCount = 0;
      this.gameLoop.gameSpeed = 1;
      this.ui.hideGameOver();
      this.ui.notify('Game loaded!');
    } else {
      const autoData = this.saveSystem.loadAutosave();
      if (autoData) {
        this.deserializeState(autoData);
        this.gameOver = false;
        this.foodLowSoundPlayed = false;
        this.clearModeHintCount = 0;
        this.gameLoop.gameSpeed = 1;
        this.ui.hideGameOver();
        this.ui.notify('Loaded autosave!');
      } else {
        this.ui.notify('No save found');
      }
    }
  }

  private serializeState(): Record<string, unknown> {
    return {
      season: this.seasonSystem.serialize(),
      resources: this.resourceSystem.serialize(),
      villagers: this.villagerSystem.serialize(),
      buildings: this.buildingSystem.serialize(),
      technology: this.techSystem.serialize(),
      enemies: this.hordeSystem.serialize(),
      weather: this.weatherSystem.serialize(),
      comfort: this.comfortSystem.serialize(),
      tileMap: this.tileMap.serialize(),
      level: this.level,
      furAges: [...this.furAges],
      furClothingProduced: this.furClothingProduced,
      stayInShelterMode: this.stayInShelterMode,
      cameraX: this.camera.x,
      cameraY: this.camera.y,
    };
  }

  private deserializeState(data: Record<string, unknown>): void {
    if (data.tileMap) {
      this.tileMap.deserialize(data.tileMap as any);
    }
    if (data.season) {
      this.seasonSystem.deserialize(data.season as any);
    }
    if (data.resources) {
      this.resourceSystem.deserialize(data.resources as any);
    }
    if (data.buildings) {
      this.buildingSystem.buildings = [];
      this.buildingSystem.deserialize(data.buildings as any);
    }
    if (data.villagers) {
      this.villagerSystem.deserialize(data.villagers as any);
    }
    if (data.technology) {
      this.techSystem.deserialize(data.technology as any);
    }
    if (data.enemies) {
      this.hordeSystem.deserialize(data.enemies as any);
    }
    if (data.weather) {
      this.weatherSystem.deserialize(data.weather as any);
    }
    if (data.comfort !== undefined) {
      this.comfortSystem.deserialize(data.comfort as number);
    }
    if (data.level !== undefined) {
      this.level = data.level as number;
    }
    if (data.furAges) {
      this.furAges = data.furAges as number[];
    }
    if (data.furClothingProduced !== undefined) {
      this.furClothingProduced = data.furClothingProduced as number;
    }
    if (data.stayInShelterMode !== undefined) {
      this.stayInShelterMode = data.stayInShelterMode as boolean;
    }
    if (data.cameraX !== undefined && data.cameraY !== undefined) {
      this.camera.x = data.cameraX as number;
      this.camera.y = data.cameraY as number;
    }
  }
}
