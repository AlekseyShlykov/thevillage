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
import { AnalyticsSystem } from '../systems/AnalyticsSystem';
import { TutorialSystem, TutorialState } from '../systems/TutorialSystem';
import { ProductionSystem } from '../systems/ProductionSystem';
import { ProtectionSystem } from '../systems/ProtectionSystem';
import { EquipmentSystem, hasTool, hasCoat, workerProductivity } from '../systems/EquipmentSystem';
import { ColdSystem } from '../systems/ColdSystem';
import { CropSystem } from '../systems/CropSystem';
import { ForagingSystem } from '../systems/ForagingSystem';
import { makeForecast } from '../systems/ForecastSystem';
import { availableJobs } from './VillagerJobs';
import { settlementWarnings } from '../systems/WarningSystem';
import { migrateRetiredBuildings } from '../systems/SaveMigration';
import { SoundManager } from '../audio/SoundManager';
import { UIManager, UICallbacks, UIAction } from '../ui/UIManager';
import { getConfig } from '../data/ConfigLoader';
import { VillagerOrder, TargetedVillagerOrder, villagerOrders, validJobTarget } from './VillagerOrders';
import { Season, TileType, VillagerState, HealthState, Position, BuildingConfig, BuildingInstance } from '../types';

type InteractionMode = 'normal' | 'build' | 'clear' | 'demolish' | 'palisadeDraw' | 'order';

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
  private analytics: AnalyticsSystem;
  private tutorialSystem: TutorialSystem;
  private soundManager: SoundManager;
  private ui: UIManager;

  private mode: InteractionMode = 'normal';
  private selectedBuildingId: string | null = null;
  private selectedVillagerId: string | null = null;
  private pendingOrder: TargetedVillagerOrder | null = null;
  private level = 1;
  private furAges: number[] = [];

  private foodConsumptionAccum = 0;
  private productionAccum = 0;
  private clearingAssignTimer = 0;
  private productionSystem = new ProductionSystem();
  private protectionSystem = new ProtectionSystem();
  private uiFrameTime = 0;
  private growthAccum = 0;
  private furClothingProduced = 0;
  private equipmentSystem = new EquipmentSystem();
  private coldSystem = new ColdSystem();
  private cropSystem = new CropSystem();
  private foragingSystem: ForagingSystem;
  private lastRewardedWinter = 0;

  private palisadeStart: Position | null = null;
  private palisadePreview: Position[] = [];
  private uiUpdateCounter = 0;
  private clearModeHintCount = 0;
  private gameOver = false;
  private stayInShelterMode = false;
  private shelteredJobs: { villagerId: string; buildingId?: string; task?: string; target?: Position; progress?: number }[] = [];
  private demoMessageShown = false;
  private foodLowSoundPlayed = false;

  constructor(canvas: HTMLCanvasElement, assets: AssetLoader) {
    this.camera = new Camera();
    this.input = new InputManager(canvas, this.camera);
    this.tileMap = new TileMap();
    this.foragingSystem = new ForagingSystem(this.tileMap);
    this.renderer = new Renderer(canvas, this.camera, assets);
    this.gameLoop = new GameLoop();

    this.seasonSystem = new SeasonSystem();
    this.resourceSystem = new ResourceSystem();
    this.villagerSystem = new VillagerSystem(this.tileMap);
    this.buildingSystem = new BuildingSystem(this.tileMap);
    this.techSystem = new TechnologySystem();
    this.hordeSystem = new HordeSystem(this.tileMap, this.protectionSystem);
    this.weatherSystem = new WeatherSystem();
    this.comfortSystem = new ComfortSystem();
    this.saveSystem = new SaveSystem();
    this.analytics = new AnalyticsSystem();
    this.tutorialSystem = new TutorialSystem();
    this.soundManager = new SoundManager();
    this.villagerSystem.setOnVillagerDeath(() => this.soundManager.playDead());

    const callbacks: UICallbacks = {
      onVillagerOrder: (order) => this.chooseVillagerOrder(order),
      onVillagerDeselect: () => this.deselectVillager(),
      onVillagerJob: key => this.executeVillagerJob(key),
      onSpeedChange: (s) => this.setSpeed(s),
      onBuildSelect: (id) => this.startBuildMode(id),
      onBuildCancel: () => this.cancelBuild(),
      onBuildPanelOpen: () => { this.pendingOrder = null; if (this.mode === 'order') this.mode = 'normal'; this.refreshBuildPanel(); },
      onTechPanelOpen: () => { this.pendingOrder = null; if (this.mode === 'order') this.mode = 'normal'; this.refreshTechPanel(); },
      onDemolish: () => this.toggleDemolishMode(),
      onTechUnlock: (id) => this.unlockTech(id),
      onSave: () => this.manualSave(),
      onLoad: () => this.manualLoad(),
      onToggleClearMode: () => this.toggleClearMode(),
      onGoHunting: () => this.goHunting(),
      onGatherHerbs: () => this.gatherHerbs(),
      onSendAllToChop: () => this.sendAllToChop(),
      onToggleShelter: () => { if (this.stayInShelterMode) this.leaveShelter(); else this.returnHome(); this.updateUI(); },
      onRepairAll: () => this.repairAll(),
      onRestart: () => this.restart(),
      onTutorialSkip: () => this.tutorialSystem.skip(),
      onSoundToggle: () => this.soundManager.toggleSound(),
      onEmailSubmitted: () => this.analytics.trackEmailSubmitted(),
      onCameraZoom: (factor) => this.camera.setZoom(this.camera.zoom * factor),
      onCameraHome: () => { const c = this.tileMap.getClearingCenter(), ts = getConfig().map.tileSize; this.camera.centerOn(c.x * ts, c.y * ts); },
    };
    this.ui = new UIManager(callbacks);

    this.resourceSystem.setOnCapacityReached((resource) => {
      const names: Record<string, string> = { wood: 'wood', food: 'food', fur: 'fur', tools: 'tools' };
      this.ui.notify(`Capacity reached for ${names[resource] ?? resource}. Build a storage.`);
    });

    window.addEventListener('keydown', e => {
      if ((e.target as HTMLElement)?.matches('input, textarea') || (e.code !== 'Escape' && (e.target as HTMLElement)?.matches('button'))) return;
      if (e.code === 'Space') { e.preventDefault(); this.setSpeed(this.gameLoop.gameSpeed ? 0 : 1); }
      if (e.code === 'Escape') { if (this.pendingOrder) { this.pendingOrder = null; this.mode = 'normal'; this.updateUI(); } else { this.cancelBuild(); this.deselectVillager(); } }
    });
    this.setupSeasonCallbacks();
    this.initWorld();
    // Season music is started in start() after user click (required for autoplay policy).

    this.renderer.resize();
    window.addEventListener('resize', () => this.renderer.resize());

    const center = this.tileMap.getClearingCenter();
    const ts = getConfig().map.tileSize;
    this.camera.centerOn(center.x * ts, center.y * ts);

    this.gameLoop.onFrame = (dt) => {
      this.handleInput();
      this.uiFrameTime += dt;
      if (this.uiFrameTime >= 0.15) { this.uiFrameTime = 0; this.updateUI(); }
    };
    this.gameLoop.onUpdate = (dt) => this.update(dt);
    this.gameLoop.onRender = () => this.render();
  }

  trackSiteOpen(): void {
    this.analytics.trackSiteOpen();
  }

  start(): void {
    this.analytics.trackGameStart();
    this.soundManager.playSeason(this.seasonSystem.season);
    this.gameLoop.start();
  }

  private getBuildingsCount(): number {
    return this.buildingSystem.buildings.filter((b) => b.built).length;
  }

  private initWorld(): void {
    const cfg = getConfig();
    const center = this.tileMap.getClearingCenter();

    this.buildingSystem.placeStartingBuilding('hut', center.x - 1, center.y - 1);

    this.villagerSystem.spawnInitialVillagers(center.x, center.y, cfg.villagers.startingCount);
    this.villagerSystem.setShelters(this.buildingSystem.getHousingTiles());
  }

  private setupSeasonCallbacks(): void {
    this.seasonSystem.setOnSeasonChange((season, year) => {
      const buildingsCount = this.getBuildingsCount();
      this.analytics.trackSeasonChange({
        season,
        year,
        buildings_count: buildingsCount,
        outcome: 'playing',
      });

      this.soundManager.playSeason(season);
      this.ui.notify(`${season.charAt(0).toUpperCase() + season.slice(1)} of Year ${year}`);

      if (season === Season.Winter) {
        this.cropSystem.winter(this.buildingSystem.buildings);
        this.ui.notify('Winter has killed all unharvested crops. Unclothed residents must shelter.');
        this.hordeSystem.startWinter(year, this.level);
        this.buildingSystem.advanceWinterRepairCounters();
        this.ageFurs();

      }

      if (season === Season.Spring) {
        if (year - 1 > this.lastRewardedWinter) {
          const rewards = getConfig().technology;
          const stars = year - 1 <= rewards.firstWinterRewardCount ? rewards.earlyWinterStars : rewards.laterWinterStars;
          this.resourceSystem.addTechPoints(stars); this.lastRewardedWinter = year - 1;
          this.ui.notify(`Winter survived: +${stars} research star(s).`);
        }
        for (const b of this.buildingSystem.buildings) { b.wardActive = false; b.wardFuelSeconds = 0; }
        this.hordeSystem.endWinter();
        this.soundManager.stopHordeLoop();
        if (this.stayInShelterMode) this.leaveShelter();
        this.saveSystem.autosave(this.serializeState());
        this.ui.notify('Spring! Autosaved.');
        this.checkLevelUp();
        if (year > getConfig().gameplay.demoWinters) {
          this.analytics.trackDemoEnd({
            season: 'spring',
            year,
            buildings_count: buildingsCount,
          });
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
      this.analytics.trackGameOver({
        season: this.seasonSystem.season,
        year: this.seasonSystem.year,
        buildings_count: this.getBuildingsCount(),
      });
      this.gameOver = true;
      this.gameLoop.gameSpeed = 0;
      this.ui.showGameOver(getConfig().demoEnd?.emailSubmitUrl);
      return;
    }

    this.seasonSystem.update(dt);
    this.weatherSystem.update(dt, this.seasonSystem.season);
    this.equipmentSystem.update(dt, this.villagerSystem.villagers, this.resourceSystem, this.seasonSystem.season);

    const weatherMult = this.weatherSystem.getWorkSpeedMultiplier();
    const comfortMult = this.comfortSystem.getProductivityMultiplier();
    const effectiveDt = dt * weatherMult * comfortMult * (this.seasonSystem.isWinter() ? getConfig().resources.winterProductionMultiplier : 1);

    this.updateFoodConsumption(dt);
    this.updateForestClearing(effectiveDt);
    this.updatePopulationGrowth(dt);

    this.buildingSystem.updateConstruction(effectiveDt, (buildingId) => this.getBuildersOnSite(buildingId), undefined, (building) => {
      this.tutorialSystem.onBuildingCompleted(building.id, building.configId);
    });
    this.releaseBuildersFromCompletedBuildings();

    const isWinter = this.seasonSystem.isWinter();
    const housingTiles = this.buildingSystem.getHousingTiles();
    const wallMultiplier = this.techSystem.getEffect('palisadeHPMultiplier') ?? 1;
    for (const b of this.buildingSystem.buildings) {
      if (b.configId !== 'palisadeWall' && b.configId !== 'palisadeGate') continue;
      const maxHp = this.buildingSystem.getBuildingConfig(b.configId)!.hp * wallMultiplier;
      if (maxHp !== b.maxHp) { b.hp *= maxHp / b.maxHp; b.maxHp = maxHp; }
    }

    this.villagerSystem.openGateIds = new Set(
      this.buildingSystem.buildings.filter(b => b.configId === 'palisadeGate' && b.gateOpen).map(b => b.id)
    );
    this.villagerSystem.unbuiltPalisadeIds = new Set(
      this.buildingSystem.buildings.filter(b => (b.configId === 'palisadeWall' || b.configId === 'palisadeGate') && !b.built).map(b => b.id)
    );

    this.villagerSystem.update(dt, this.buildingSystem.buildings, isWinter, housingTiles, this.stayInShelterMode);
    this.updateHunting(dt);
    this.updateRepair(dt);
    this.updateResourceProduction(effectiveDt);
    this.cropSystem.update(dt, this.seasonSystem.season, this.seasonSystem.getCurrentDuration(), this.buildingSystem, this.villagerSystem, this.resourceSystem, this.techSystem, amount => this.ui.notify(`Harvest stored: +${Math.round(amount)} food`));
    this.equipmentSystem.issue(this.villagerSystem.getAliveVillagers(), this.resourceSystem);
    this.coldSystem.update(dt, this.villagerSystem.villagers, housingTiles, this.seasonSystem.season, this.weatherSystem.currentEvent?.type === 'snowstorm', v => {
      this.villagerSystem.damageVillager(v, v.maxHp); this.ui.notify('A resident died from hypothermia. Fur coats or shelter are needed.');
    });
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
    this.hordeSystem.visibilityMultiplier = this.weatherSystem.getVisibilityMultiplier();
    this.hordeSystem.openGateIds = this.villagerSystem.openGateIds;
    this.hordeSystem.unbuiltPalisadeIds = this.villagerSystem.unbuiltPalisadeIds;
    this.protectionSystem.advance(dt, this.buildingSystem.buildings, this.resourceSystem, this.seasonSystem.season);
    this.hordeSystem.update(
      dt, center.x, center.y,
      this.buildingSystem.getDetectionBuildings(),
      housingTiles,
      outsideVillagers,
      this.buildingSystem.getAttackableBuildingTiles(),
      (buildingId) => this.isHouseBuilding(buildingId),
      (bId, dmg) => {
        const building = this.buildingSystem.buildings.find(b => b.id === bId);
        this.buildingSystem.damageBuilding(bId, dmg);
        if (building && !this.buildingSystem.buildings.includes(building)) this.ui.notify(`${this.buildingSystem.getBuildingConfig(building.configId)?.name ?? 'Building'} was destroyed. It can be rebuilt in spring.`);
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
    this.tutorialSystem.update(
      this.resourceSystem.resources.food,
      this.seasonSystem.season,
      this.seasonSystem.year,
      this.getWinterFoodTarget(),
    );
    if (this.stayInShelterMode) this.tutorialSystem.onShelterCalled();

  }

  private render(): void {
    this.renderer.renderWorld(this.tileMap, this.seasonSystem.season, this.buildingSystem.buildings,
      this.buildingSystem.getAllBuildingConfigs(), this.villagerSystem.villagers, this.hordeSystem.enemies,
      this.selectedVillagerId, this.input.state, this.weatherSystem.currentEvent, this.gameLoop.gameSpeed === 0);

    if (this.mode === 'build' && this.selectedBuildingId) {
      const state = this.input.state;
      const cfg = this.buildingSystem.getBuildingConfig(this.selectedBuildingId);
      if (cfg) {
        if (this.selectedBuildingId === 'palisadeWall' && this.palisadePreview.length > 0) {
          this.renderer.renderPalisadePreview(this.palisadePreview, this.tileMap);
        } else {
          const valid = this.buildingSystem.canPlace(this.selectedBuildingId, state.tileX, state.tileY);
          if (cfg.protectionRadius) this.renderer.renderProtectionPreview(state.tileX, state.tileY, cfg.protectionRadius, valid);
          this.renderer.renderBuildPreview(state.tileX, state.tileY, cfg.width, cfg.height, valid);
        }
      }
    }

    if (this.mode === 'normal' || this.mode === 'clear') {
      this.renderer.renderSelectionBox(this.input.state.tileX, this.input.state.tileY);
    }
    if (this.pendingOrder && this.selectedVillagerId) {
      const { tileX, tileY } = this.input.state, target = this.getOrderTarget(tileX, tileY);
      this.renderer.renderBuildPreview(target.building?.tileX ?? tileX, target.building?.tileY ?? tileY,
        target.cfg?.width ?? 1, target.cfg?.height ?? 1, target.valid);
    }
  }

  private handleInput(): void {
    if (this.selectedVillagerId) {
      const v = this.villagerSystem.getVillagerById(this.selectedVillagerId);
      if (!v || v.health === HealthState.Dead) {
        this.deselectVillager();
      }
    }

    if (this.input.consumeClick()) {
      const { tileX, tileY } = this.input.state;
      if(this.ui.isBuildPanelOpen() || this.ui.isTechPanelOpen()) {
        this.cancelBuild();this.deselectVillager();this.ui.closePanels();this.ui.closeForecast();this.updateUI();return;
      }

      switch (this.mode) {
        case 'order':
          this.handleVillagerOrder(tileX, tileY);
          break;
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
      this.pendingOrder = null; this.cancelBuild(); this.ui.hideActionMenu();
      if (!this.selectedVillagerId) this.ui.hideInfo();
      this.updateUI();
    }
  }

  private handleNormalClick(tx: number, ty: number): void {
    const villager = this.renderer.pickVillager(this.input.state.mouseX, this.input.state.mouseY, this.villagerSystem.villagers, this.tileMap);
    if (villager) {
      this.selectedVillagerId = villager.id;
      this.pendingOrder = null; this.ui.closePanels(); this.updateUI();
      this.ui.hideActionMenu();
      return;
    }

    const tile = this.tileMap.getTile(tx, ty);
    const building = this.renderer.pickBuilding(this.input.state.mouseX, this.input.state.mouseY,
      this.buildingSystem.buildings, this.buildingSystem.getAllBuildingConfigs());
    const cfg = building ? this.buildingSystem.getBuildingConfig(building.configId) : null;

    this.deselectVillager(); this.ui.closePanels(); this.ui.closeForecast();

    if (building && cfg) {
      const ts2 = getConfig().map.tileSize;
      const screen2 = this.camera.worldToScreen(tx * ts2 + ts2 / 2, ty * ts2 + ts2 / 2);
      const actions: UIAction[] = [];

      if (!building.built) {
        actions.push({ label: 'Cancel construction', icon: 'close', callback: () => this.cancelBuilding(building.id) });
      } else {
        if (building.hp < building.maxHp || building.needsRepair) {
          actions.push({ label: 'Repair', icon: 'repair', callback: () => this.sendRepairToBuilding(building.id) });
        }
        if (cfg.maxWorkers > 0) {
          if (building.assignedWorkers.length < cfg.maxWorkers && !(building.configId === 'garden' && this.seasonSystem.isWinter())) actions.push({ label: building.configId === 'garden' && building.cropState === 'ripe' ? 'Harvest food' : 'Assign a free villager', icon: 'villagers', callback: () => {
            const idle = this.villagerSystem.findClosestIdleVillager(building.tileX, building.tileY);
            if (idle) this.villagerActionWork(idle.id, building.id); else this.ui.notify('No free villagers. Select a worker to change their job.');
          } });
          if (building.assignedWorkers.length) actions.push({ label: 'Release workers', icon: 'release', callback: () => {
            for (const id of [...building.assignedWorkers]) {
              const v = this.villagerSystem.getVillagerById(id); if (!v) continue;
              this.detachVillagerFromPreviousWork(id); v.currentTask = null; v.path = []; v.state = VillagerState.Idle;
            }
          } });
        }
        actions.push({ label: 'Demolish', icon: 'demolish', callback: () => this.startDemolish(building.id) });
      }

      this.ui.showInfo([
        cfg?.name || building.configId,
        `HP: ${Math.floor(building.hp)}/${building.maxHp}`,
        building.built ? 'Built' : `Building: ${Math.round(building.buildProgress * 100)}%`,
        building.configId === 'garden' && building.built ? this.gardenStatus(building) : '',
        building.configId === 'furWorkshop' && building.built ? `1 pelt → 1 fur coat. ${this.resourceSystem.resources.fur >= getConfig().resources.furPerClothing ? 'Assign a worker to sew coats.' : 'Needs pelts: send a resident hunting.'}` : '',
        `Workers: ${building.assignedWorkers.length}/${cfg?.maxWorkers || 0}`,
        building.needsRepair ? { text: 'Needs repair', icon: 'warning' as const } : '',
        building.configId === 'palisadeGate' && building.built ? { text: building.gateOpen ? 'Open' : 'Closed', icon: building.gateOpen ? 'gateOpen' as const : 'gateClosed' as const } : '',
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

  private deselectVillager(): void {
    this.selectedVillagerId = null; this.pendingOrder = null;
    if (this.mode === 'order') this.mode = 'normal';
    this.ui.hideInfo(); this.ui.hideActionMenu();
  }

  private jobsFor(id: string) {
    const v = this.villagerSystem.getVillagerById(id);
    return v ? availableJobs(v,this.tileMap,this.buildingSystem,this.villagerSystem,this.resourceSystem,this.foragingSystem,this.seasonSystem.season,this.stayInShelterMode) : [];
  }

  private executeVillagerJob(key: string): void {
    const id = this.selectedVillagerId;
    if (!id) return;
    const job = this.jobsFor(id).find(j=>j.key===key);
    if (!job) { this.ui.notify('This job is no longer available.'); this.updateUI(); return; }
    this.pendingOrder=null; this.mode='normal'; this.ui.hideActionMenu();
    switch(job.kind) {
      case 'chop': this.villagerActionChop(id,job.target!.x,job.target!.y); break;
      case 'hunt': this.villagerActionHunt(id); break;
      case 'herbs': this.gatherHerbs(id); break;
      case 'farm': case 'work': this.villagerActionWork(id,job.buildingId!); break;
      case 'build': this.villagerActionSendToBuild(id,job.buildingId!); break;
      case 'repair': this.sendRepairToBuilding(job.buildingId!,id); break;
      case 'shelter': case 'deliver': {
        const old=this.villagerSystem.getVillagerById(id)?.assignedBuildingId;
        if(this.villagerSystem.sendVillagerToHousing(id,job.target!.x,job.target!.y)) this.detachVillagerFromPreviousWork(id,old);
        break;
      }
      case 'stop': this.chooseVillagerOrder('stop'); break;
    }
    this.updateUI();this.render();
  }

  private gardenStatus(b: BuildingInstance): string {
    if(this.seasonSystem.isWinter()) return 'Frozen soil · sowing resumes in spring';
    if(b.cropState==='ripe') return `Ready to harvest: ${Math.ceil(b.harvestRemaining??getConfig().farming.harvestFood)} food · ${this.resourceSystem.resources.food>=this.resourceSystem.capacity.food?'food storage full':'a farmer collects it automatically'}`;
    return b.cropState==='growing'?`Growing: ${Math.floor((b.farmingProgress??0)*100)}% · ${getConfig().farming.growthSeasons} seasons to mature`:'Ready to sow · assign a farmer';
  }

  private chooseVillagerOrder(order: VillagerOrder): void {
    const v = this.selectedVillagerId && this.villagerSystem.getVillagerById(this.selectedVillagerId);
    if (!v || v.health === HealthState.Dead) return;
    this.ui.hideActionMenu(); this.ui.closePanels();
    if (order === 'stop') {
      this.detachVillagerFromPreviousWork(v.id);
      v.currentTask = null; v.path = []; v.targetX = null; v.targetY = null;
      v.taskProgress = 0; v.state = VillagerState.Idle; v.holdPosition = true;
      this.pendingOrder = null; this.mode = 'normal';
      this.ui.notify(`Villager ${v.id.replace('v_', '')} is waiting for orders.`);
    } else {
      if (this.stayInShelterMode) { this.ui.notify('Press Resume before giving a work order.'); return; }
      this.pendingOrder = this.pendingOrder === order ? null : order;
      this.mode = this.pendingOrder ? 'order' : 'normal';
    }
    this.updateUI(); this.render();
  }

  private getOrderTarget(tx: number, ty: number) {
    const tile = this.tileMap.getTile(tx, ty);
    const needsBuilding = this.pendingOrder && !['chop', 'hunt', 'herbs', 'move'].includes(this.pendingOrder);
    const building = needsBuilding ? this.renderer.pickBuilding(this.input.state.mouseX, this.input.state.mouseY,
      this.buildingSystem.buildings, this.buildingSystem.getAllBuildingConfigs()) : null;
    const cfg = building ? this.buildingSystem.getBuildingConfig(building.configId) : null;
    const valid = !!this.pendingOrder && validJobTarget(this.pendingOrder, tile, building, cfg, this.selectedVillagerId ?? '') &&
      (this.pendingOrder !== 'move' || this.tileMap.isWalkable(tx, ty, this.villagerSystem.openGateIds, this.villagerSystem.unbuiltPalisadeIds)) &&
      !(building?.configId === 'garden' && this.seasonSystem.isWinter() && ['farm', 'work'].includes(this.pendingOrder ?? ''));
    return { building, cfg, valid };
  }

  private handleVillagerOrder(tx: number, ty: number): void {
    const id = this.selectedVillagerId, order = this.pendingOrder;
    if (!id || !order) return;
    const target = this.getOrderTarget(tx, ty);
    if (!target.valid) { this.ui.notify(villagerOrders[order].hint); return; }
    let success = false;
    switch (order) {
      case 'chop': success = this.villagerActionChop(id, tx, ty); break;
      case 'hunt': success = this.villagerActionHunt(id, { x: tx, y: ty }); break;
      case 'herbs': success = this.gatherHerbs(id, { x: tx, y: ty }); break;
      case 'move': success = this.villagerActionGo(id, tx, ty); break;
      case 'farm': case 'work': success = this.villagerActionWork(id, target.building!.id); break;
      case 'build': success = this.villagerActionSendToBuild(id, target.building!.id); break;
      case 'repair': success = this.sendRepairToBuilding(target.building!.id, id); break;
    }
    if (success) { this.pendingOrder = null; this.mode = 'normal'; }
    this.updateUI();
  }

  private villagerActionHunt(villagerId: string, target?: Position): boolean {
    if (this.stayInShelterMode) {
      this.ui.notify('Villagers are staying in shelter. Press "Resume" first.');
      return false;
    }
    if (this.villagerSystem.sendVillagerToHunt(villagerId, target)) {
      this.detachVillagerFromPreviousWork(villagerId);
      this.soundManager.playHunt();
      this.tutorialSystem.onHuntStarted(villagerId);
      this.ui.notify('Villager went hunting. Risk in the forest!');
      return true;
    } else {
      this.ui.notify('Cannot send this villager to hunt.');
    }
    return false;
  }

  private villagerActionChop(villagerId: string, tx: number, ty: number): boolean {
    if (this.stayInShelterMode) {
      this.ui.notify('Villagers are staying in shelter. Press "Resume" first.');
      return false;
    }
    if (this.villagerSystem.sendVillagerToChop(villagerId, tx, ty)) {
      this.detachVillagerFromPreviousWork(villagerId);
      this.ui.notify('Villager will chop this tile.');
      return true;
    } else {
      this.ui.notify('Cannot chop here.');
    }
    return false;
  }

  private villagerActionGo(villagerId: string, tx: number, ty: number): boolean {
    if (this.stayInShelterMode) {
      const housingSet = new Set(this.buildingSystem.getHousingTiles().map(p => `${p.x},${p.y}`));
      if (!housingSet.has(`${tx},${ty}`)) {
        this.ui.notify('Villagers are staying in shelter. Press "Resume" first.');
        return false;
      }
    }
    if (this.villagerSystem.sendVillagerToTile(villagerId, tx, ty)) {
      this.detachVillagerFromPreviousWork(villagerId);
      this.ui.notify('Villager going there.');
      return true;
    } else {
      this.ui.notify('Cannot go there.');
    }
    return false;
  }

  /** Send villager to unbuilt building's arrival tile; only one builder per building. */
  private villagerActionSendToBuild(villagerId: string, buildingId: string): boolean {
    if (this.stayInShelterMode) {
      this.ui.notify('Villagers are staying in shelter. Press "Resume" first.');
      return false;
    }
    const building = this.buildingSystem.buildings.find(b => b.id === buildingId);
    if (!building || building.built) {
      this.ui.notify('Not a construction site.');
      return false;
    }
    if (building.assignedWorkers.length > 0) {
      if (building.assignedWorkers.includes(villagerId)) return true;
      this.ui.notify('Another villager is already building this.');
      return false;
    }
    const v = this.villagerSystem.getVillagerById(villagerId);
    if (!v || v.health === HealthState.Dead) {
      this.ui.notify('Villager unavailable.');
      return false;
    }
    if (this.dispatchBuilder(villagerId, buildingId)) {
      this.ui.notify('Villager going to construction site.');
      return true;
    } else {
      this.ui.notify('No path to construction site.');
    }
    return false;
  }

  /** Reserve a construction site immediately, then send its builder to an arrival tile. */
  private dispatchBuilder(villagerId: string, buildingId: string): boolean {
    const building = this.buildingSystem.buildings.find(b => b.id === buildingId);
    const villager = this.villagerSystem.getVillagerById(villagerId);
    if (!building || building.built || !villager || villager.health === HealthState.Dead) return false;
    if (building.assignedWorkers.length > 0) return false;

    const arrivalTiles = this.buildingSystem.getArrivalTiles(building);
    for (const tile of arrivalTiles) {
      if (!this.villagerSystem.assignPath(villager, tile.x, tile.y)) continue;
      this.detachVillagerFromPreviousWork(villager.id);
      building.assignedWorkers.push(villager.id);
      villager.assignedBuildingId = building.id;
      villager.currentTask = 'building';
      villager.taskAttempts = 0;
      return true;
    }
    return false;
  }

  private villagerActionWork(villagerId: string, buildingId: string): boolean {
    if (this.seasonSystem.isWinter() && this.buildingSystem.buildings.find(b => b.id === buildingId)?.configId === 'garden') {
      this.ui.notify('Sowing is closed in winter. Crops cannot survive the frost.'); return false;
    }
    if (this.stayInShelterMode) { this.ui.notify('Press Resume to resume work.'); return false; }
    if (this.villagerSystem.assignVillagerToBuilding(villagerId, buildingId, this.buildingSystem.buildings)) {
      const cfg = this.buildingSystem.getBuildingConfig(
        this.buildingSystem.buildings.find(b => b.id === buildingId)!.configId
      );
      if (cfg?.id === 'garden') this.tutorialSystem.onGardenWorkerAssigned();
      this.ui.notify(`Assigned to ${cfg?.name ?? buildingId}`);
      return true;
    } else {
      this.ui.notify('Cannot assign here.');
    }
    return false;
  }

  private villagerActionShelter(villagerId: string, building: { tileX: number; tileY: number; configId: string }): void {
    const bcfg = this.buildingSystem.getBuildingConfig(building.configId);
    if (!bcfg) return;
    const hx = building.tileX + Math.floor(bcfg.width / 2);
    const hy = building.tileY + Math.floor(bcfg.height / 2);
    const previousBuildingId = this.villagerSystem.getVillagerById(villagerId)?.assignedBuildingId ?? null;
    if (this.villagerSystem.sendVillagerToHousing(villagerId, hx, hy)) {
      this.detachVillagerFromPreviousWork(villagerId, previousBuildingId);
      this.ui.notify('Villager returning to shelter.');
    }
  }

  /** Remove a villager from a former production/construction roster after a new order succeeds. */
  private detachVillagerFromPreviousWork(villagerId: string, buildingId?: string | null): void {
    const villager = this.villagerSystem.getVillagerById(villagerId);
    const previousId = buildingId === undefined ? villager?.assignedBuildingId : buildingId;
    if (previousId) {
      const previous = this.buildingSystem.buildings.find(b => b.id === previousId);
      if (previous) previous.assignedWorkers = previous.assignedWorkers.filter(id => id !== villagerId);
    }
    if (villager && villager.assignedBuildingId === previousId) villager.assignedBuildingId = null;
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
      this.tutorialSystem.onBuildingPlaced(b.id, b.configId);
      this.ui.notify(`Placed ${cfg.name}`);
      this.cancelBuild();
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
    const out: Position[] = [{ ...start }]; let x = start.x, y = start.y;
    const horizontalFirst = Math.abs(end.x - x) >= Math.abs(end.y - y);
    const horizontal = () => { while (x !== end.x) { x += Math.sign(end.x-x); out.push({x,y}); } };
    const vertical = () => { while (y !== end.y) { y += Math.sign(end.y-y); out.push({x,y}); } };
    if (horizontalFirst) { horizontal(); vertical(); } else { vertical(); horizontal(); }
    return out;
  }

  private handleClearClick(tx: number, ty: number): void {
    const tile = this.tileMap.getTile(tx, ty);
    if (tile && tile.type === TileType.Forest && !tile.markedForClearing) {
      tile.markedForClearing = true;
      this.tutorialSystem.onForestMarked();
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
    const cfg = getConfig(), villagers = this.villagerSystem;
    this.clearingAssignTimer += dt;
    if (!this.stayInShelterMode && this.clearingAssignTimer >= cfg.villagers.clearingDispatchInterval) {
      this.clearingAssignTimer = 0;
      const marked = this.tileMap.getMarkedClearingTiles();
      for (const v of villagers.getAliveVillagers()) {
        if (v.state !== VillagerState.Idle || v.currentTask || v.assignedBuildingId || v.holdPosition) continue;
        const targets = marked.filter(t => !villagers.isTileAlreadyBeingClearedByOther(v.id, t.x, t.y))
          .sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y));
        for (const t of targets) if (villagers.sendVillagerToChop(v.id, t.x, t.y)) break;
      }
    }
    let chopping = false;
    for (const v of villagers.villagers) {
      if (v.health === HealthState.Dead || v.currentTask !== 'clearing' || v.state !== VillagerState.Working || v.targetX === null || v.targetY === null) continue;
      const x = v.targetX, y = v.targetY, tile = this.tileMap.getTile(x, y);
      if (!tile || tile.type !== TileType.Forest || !tile.markedForClearing) { v.currentTask = null; v.state = VillagerState.Idle; continue; }
      if (Math.floor(v.x) !== x || Math.floor(v.y) !== y) continue;
      const health = workerProductivity(v, this.techSystem);
      tile.clearingProgress += dt * health / cfg.villagers.clearForestTime; chopping = true;
      if (tile.clearingProgress >= 1) {
        this.tileMap.setTileType(x, y, TileType.Clear); tile.markedForClearing = false; tile.clearingProgress = 0;
        this.resourceSystem.addWood(cfg.resources.woodPerForestTile *
          (this.buildingSystem.isTileInLumberCampRadius(x, y) ? cfg.resources.lumberCampWoodBonus : 1));
        v.currentTask = null; v.state = VillagerState.Idle;
      }
    }
    if (chopping) this.soundManager.playWood(); else this.soundManager.stopWood();
  }

  private updateHunting(dt: number): void {
    this.foragingSystem.update(dt, this.villagerSystem, this.buildingSystem, this.resourceSystem, this.techSystem, this.tutorialSystem, message => this.ui.notify(message));
  }

  private updateResourceProduction(dt: number): void {
    this.productionSystem.update(dt, this.buildingSystem, this.villagerSystem, this.resourceSystem,
      this.techSystem, this.tileMap,
      amount => this.ui.notify(`Harvest gathered! +${amount} food`),
      amount => { this.furClothingProduced += amount; this.resourceSystem.addClothing(amount); this.ui.notify('Fur coat sewn. Issued automatically to a resident who needs one.'); });
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
      const starvationDelay = cfg.starvationDelay;
      const starvationInterval = cfg.starvationInterval;
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
    if (this.resourceSystem.resources.food < (alive + 1) * cfg.minimumFoodForArrival) return;

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
    const warmth = alive > 0 ? this.villagerSystem.getAliveVillagers().filter(hasCoat).length / alive : 1;
    const foodRatio = this.resourceSystem.resources.food > 0 ? Math.min(this.resourceSystem.resources.food / (alive * getConfig().gameplay.foodComfortPerVillager), 1) : 0;

    this.comfortSystem.update({
      foodRatio,
      warmthRatio: this.seasonSystem.isWinter() ? warmth : 1,
      housingRatio: alive > 0 ? Math.min(housing / alive, 1) : 1,
      healthRatio: alive > 0 ? healthy / alive : 1,
      defenseScore: Math.min(palisadeHP / getConfig().gameplay.defenseComfortHP, 1),
      buildingComfortBonus: this.buildingSystem.getComfortBonus() + (this.techSystem.getEffect('comfortBonus') ?? 0),
    });
  }

  private updateCombat(dt: number): void {
    if (!this.hordeSystem.isActive) return;

    const cfg = getConfig().horde;
    const toolDmg = (cfg.villagerToolDamage as number) * (this.techSystem.getEffect('toolDefenseBonus') ?? 1);
    const baseDmg = cfg.villagerBaseDamage as number;


    for (const enemy of this.hordeSystem.getActiveEnemies()) {
      if (enemy.state !== 'attacking') continue;

      for (const v of this.villagerSystem.getAliveVillagers()) {
        const dist = Math.abs(v.x - enemy.x) + Math.abs(v.y - enemy.y);
        if (dist < 2) {
          v.state = VillagerState.Defending;
          const dmg = hasTool(v) ? toolDmg : baseDmg;
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
      const damage = getConfig().horde.villagerDamagePerAttack as number;
      const safeDamage = this.villagerSystem.getAliveCount() <= (getConfig().horde.minSurvivors as number)
        ? Math.min(damage, Math.max(0, v.hp - 1)) : damage;
      this.villagerSystem.damageVillager(v, safeDamage);
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
    if (this.stayInShelterMode) return;
    for (const building of this.buildingSystem.buildings) {
      if (building.built) continue;
      building.assignedWorkers = building.assignedWorkers.filter((villagerId) => {
        const villager = this.villagerSystem.getVillagerById(villagerId);
        return !!villager && villager.health !== HealthState.Dead &&
          villager.assignedBuildingId === building.id && villager.currentTask === 'building';
      });
      if (building.assignedWorkers.length > 0) continue;
      const idle = this.villagerSystem.findClosestIdleVillager(building.tileX, building.tileY);
      if (!idle) return;
      this.dispatchBuilder(idle.id, building.id);
    }
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
      if (tileSet.has(key)) count += workerProductivity(v, this.techSystem);
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
      if (v.currentTask || v.assignedBuildingId || v.state !== VillagerState.Idle) continue;
      const tx = Math.floor(v.x);
      const ty = Math.floor(v.y);
      const building = this.buildingSystem.getUnbuiltBuildingForArrivalTile(tx, ty);
      if (!building || building.assignedWorkers.includes(v.id)) continue;
      if (building.assignedWorkers.length >= 1) continue;
      building.assignedWorkers.push(v.id);
      v.assignedBuildingId = building.id;
      v.state = VillagerState.Building;
      v.currentTask = 'building';
    }
  }

  /** Keep the builder at a new garden or fur workshop as its first worker. */
  private releaseBuildersFromCompletedBuildings(): void {
    for (const b of this.buildingSystem.buildings) {
      if (!b.built || b.assignedWorkers.length === 0) continue;
      for (const villagerId of [...b.assignedWorkers]) {
        const v = this.villagerSystem.getVillagerById(villagerId);
        if (v && v.health !== HealthState.Dead && v.currentTask === 'building') {
          if (b.configId === 'garden' || b.configId === 'furWorkshop') {
            v.state = VillagerState.Working;
            v.currentTask = b.configId === 'garden' ? 'farming' : 'working';
            v.taskProgress = 0;
            if (b.configId === 'garden') this.tutorialSystem.onGardenWorkerAssigned();
            continue;
          }
          v.state = VillagerState.Idle;
          v.currentTask = null;
          v.assignedBuildingId = null;
          v.path = [];
          v.targetX = null;
          v.targetY = null;
          b.assignedWorkers = b.assignedWorkers.filter(id => id !== villagerId);
        }
      }
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
      this.ui.notify(`Level up! Village is now Level ${this.level}. New technologies available!`);
    }
  }

  private startBuildMode(buildingId: string): void {
    this.deselectVillager();
    this.mode = 'build';
    this.ui.closePanels();
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
      (w, t, id) => this.resourceSystem.canAfford(w, t) && (!id || !getConfig().buildings[id].maxCount || this.buildingSystem.buildings.filter(b => b.configId === id).length < getConfig().buildings[id].maxCount!),
      Number.MAX_SAFE_INTEGER,
    );
  }

  private refreshTechPanel(): void {
    this.ui.updateTechPanel(this.techSystem.getAvailableTechs(this.level), this.techSystem.unlockedTechs,
      this.resourceSystem.resources.techPoints, this.level);
  }

  private cancelBuild(): void {
    this.pendingOrder = null;
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
      this.resourceSystem.addWood(Math.floor(cfg.costWood * getConfig().gameplay.refundFraction));
    }
    const assignedIds = new Set([
      ...building.assignedWorkers,
      ...this.villagerSystem.villagers
        .filter(v => v.assignedBuildingId === buildingId)
        .map(v => v.id),
    ]);
    for (const vid of assignedIds) {
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

  private sendRepairToBuilding(buildingId: string, villagerId?: string): boolean {
    if (this.stayInShelterMode) { this.ui.notify('Press Resume to resume work.'); return false; }
    const building = this.buildingSystem.buildings.find(b => b.id === buildingId);
    if (!building?.built || (building.hp >= building.maxHp && !building.needsRepair)) {
      this.ui.notify('Nothing to repair.'); return false;
    }
    const repairing = this.villagerSystem.getAliveVillagers().find(v => v.currentTask === 'repairing' && v.assignedBuildingId === buildingId);
    if (repairing) {
      if (repairing.id === villagerId) return true;
      this.ui.notify('Another villager is already repairing this.'); return false;
    }
    const bcfg = this.buildingSystem.getBuildingConfig(building.configId)!;
    const woodCost = Math.ceil(bcfg.costWood * getConfig().repair.repairCostWoodPercent);
    if (this.resourceSystem.resources.wood < woodCost) {
      this.ui.notify(`Need ${woodCost} wood to repair.`); return false;
    }
    const worker = villagerId ? this.villagerSystem.getVillagerById(villagerId) : this.villagerSystem.findClosestIdleVillager(building.tileX, building.tileY);
    if (!worker || worker.health === HealthState.Dead) { this.ui.notify('No villager available.'); return false; }
    const tiles = this.buildingSystem.getArrivalTiles(building).sort((a, b) => Math.hypot(a.x - worker.x, a.y - worker.y) - Math.hypot(b.x - worker.x, b.y - worker.y));
    for (const tile of tiles) {
      if (!this.villagerSystem.assignPath(worker, tile.x, tile.y)) continue;
      this.detachVillagerFromPreviousWork(worker.id);
      this.resourceSystem.consumeWood(woodCost);
      worker.currentTask = 'repairing'; worker.assignedBuildingId = building.id;
      worker.taskProgress = 0; worker.taskAttempts = 0;
      this.ui.notify(`Repairing ${bcfg.name}... (-${woodCost} wood)`);
      this.ui.hideActionMenu(); return true;
    }
    this.ui.notify('No path to building.'); return false;
  }

  private toggleClearMode(): void {
    this.deselectVillager();
    this.mode = this.mode === 'clear' ? 'normal' : 'clear';
    if (this.mode === 'clear') {
      this.clearModeHintCount++;
      if (this.clearModeHintCount === 1 || (this.clearModeHintCount - 1) % 5 === 0) {
        this.ui.notify('Mark forest tiles. Free villagers will clear them automatically.');
      }
    }
  }

  private goHunting(): void {
    if (this.stayInShelterMode) {
      this.ui.notify('Villagers are staying in shelter. Press "Resume" first.');
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
      this.detachVillagerFromPreviousWork(villagerId);
      this.soundManager.playHunt();
      this.tutorialSystem.onHuntStarted(villagerId);
      this.ui.notify('One villager went hunting. Risk in the forest!');
    } else {
      this.ui.notify('This villager cannot hunt (already hunting or busy).');
    }
  }

  private gatherHerbs(id?: string, target?: Position): boolean {
    if (this.stayInShelterMode) { this.ui.notify('Press Resume before gathering herbs.'); return false; }
    const c = this.tileMap.getClearingCenter();
    const villagerId = id ?? this.selectedVillagerId ?? this.villagerSystem.findClosestIdleVillager(c.x, c.y)?.id;
    if (!villagerId || !this.foragingSystem.gather(villagerId, this.villagerSystem, this.resourceSystem, target)) {
      this.ui.notify(`Cannot gather: select an available resident. Herb capacity, including expeditions: ${getConfig().herbs.capacity}.`); return false;
    }
    this.detachVillagerFromPreviousWork(villagerId); this.ui.notify('Gatherer sent for protective herbs. Supplies count when delivered home.'); return true;
  }

  private sendAllToChop(): void {
    if (this.stayInShelterMode) {
      this.ui.notify('Villagers are staying in shelter. Press "Resume" first.');
      return;
    }
    const marked = this.tileMap.getMarkedClearingTiles();
    if (marked.length === 0) {
      this.clearModeHintCount++;
      if (this.clearModeHintCount === 1 || (this.clearModeHintCount - 1) % 5 === 0) {
        this.ui.notify('First mark forest tiles for clearing (Clear mode).');
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
    this.pendingOrder = null; if (this.mode === 'order') this.mode = 'normal'; this.ui.hideActionMenu();
    const housingTiles = this.buildingSystem.getHousingTiles();
    if (housingTiles.length === 0) {
      this.ui.notify('No housing built yet.');
      return;
    }
    this.soundManager.playShelter();
    if (!this.stayInShelterMode) this.shelteredJobs = this.villagerSystem.getAliveVillagers()
      .filter(v => v.currentTask && v.currentTask!=='returnHome')
      .map(v => ({ villagerId:v.id,buildingId:v.assignedBuildingId??undefined,task:v.currentTask!,
        target:v.targetX!==null&&v.targetY!==null?{x:v.targetX,y:v.targetY}:undefined,progress:v.taskProgress }));
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
    this.tutorialSystem.onShelterCalled();
    this.ui.notify(n > 0 ? `Everyone going to shelter (${n}). Stay in shelter mode on.` : 'Stay in shelter mode on.');
  }

  private leaveShelter(): void {
    this.soundManager.playLeaveShelter();
    this.stayInShelterMode = false;
    let resumed = 0;
    for (const job of this.shelteredJobs) {
      const v=this.villagerSystem.getVillagerById(job.villagerId);
      if(!v || v.health===HealthState.Dead || Object.values(v.cargo??{}).some(n=>n>0)) continue;
      let restored=false;
      const building=this.buildingSystem.buildings.find(b=>b.id===job.buildingId);
      if(job.task==='building' && building && !building.built) restored=this.dispatchBuilder(v.id,building.id);
      else if(job.task==='repairing' && building && (building.hp<building.maxHp||building.needsRepair)) {
        for(const p of this.buildingSystem.getArrivalTiles(building)) if(this.villagerSystem.assignPath(v,p.x,p.y)) {
          v.currentTask='repairing';v.assignedBuildingId=building.id;restored=true;break;
        }
      } else if(job.task==='clearing' && job.target) restored=this.villagerSystem.sendVillagerToChop(v.id,job.target.x,job.target.y);
      else if(job.task==='hunting') restored=this.villagerSystem.sendVillagerToHunt(v.id,job.target);
      else if(job.task==='gatheringHerbs') restored=this.foragingSystem.gather(v.id,this.villagerSystem,this.resourceSystem,job.target);
      else if(building?.built) restored=this.villagerSystem.assignVillagerToBuilding(v.id,building.id,this.buildingSystem.buildings);
      if(restored) { v.taskProgress=job.progress??0;resumed++; }
    }
    const occupied = new Set(this.villagerSystem.getAliveVillagers().flatMap(v => [`${Math.floor(v.x)},${Math.floor(v.y)}`, `${v.targetX},${v.targetY}`]));
    for (const v of this.villagerSystem.getAliveVillagers()) {
      if (v.assignedBuildingId || (v.currentTask && v.currentTask!=='returnHome')) continue;
      if (Object.values(v.cargo ?? {}).some(n => n > 0)) { v.currentTask = 'returnHome'; continue; }
      if (v.currentTask === 'returnHome') { v.currentTask = null; v.path = []; v.state = VillagerState.Idle; }
      const houseId = this.tileMap.getTile(Math.floor(v.x), Math.floor(v.y))?.buildingId;
      const house = this.buildingSystem.buildings.find(b => b.id === houseId);
      if (!house || !this.isVillagerInShelter(v.id)) continue;
      const exits = this.buildingSystem.getArrivalTiles(house).filter(p => !occupied.has(`${p.x},${p.y}`))
        .sort((a,b) => Math.hypot(a.x-v.x,a.y-v.y)-Math.hypot(b.x-v.x,b.y-v.y));
      for (const p of exits) if (this.villagerSystem.assignPath(v,p.x,p.y)) { occupied.add(`${p.x},${p.y}`); break; }
    }
    this.shelteredJobs = [];
    this.ui.notify(resumed ? `${resumed} worker(s) returning to their jobs.` : 'Villagers may work again. Assign any free villagers to a building.');
  }

  private repairAll(): void {
    const damaged = this.buildingSystem.buildings.filter(b => b.built && (b.hp < b.maxHp || b.needsRepair));
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
      v.taskProgress += dt * workerProductivity(v, this.techSystem);

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
    this.villagerActionWork(villagerId, buildingId);
  }

  private sendVillagerToToggleGate(villagerId: string, buildingId: string): void {
    if (this.stayInShelterMode && this.isVillagerInShelter(villagerId)) {
      this.ui.notify('Villagers are staying in shelter. Press "Resume" first.');
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
    const previousBuildingId = v.assignedBuildingId;
    if (this.villagerSystem.assignPath(v, arrivalTiles[0].x, arrivalTiles[0].y)) {
      this.detachVillagerFromPreviousWork(villagerId, previousBuildingId);
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
    this.pendingOrder = null;
    this.level = 1;
    this.furAges = [];
    this.foodConsumptionAccum = 0;
    this.productionAccum = 0;
    this.clearingAssignTimer = 0;
    this.growthAccum = 0;
    this.furClothingProduced = 0; this.lastRewardedWinter = 0;
    this.palisadeStart = null;
    this.palisadePreview = [];
    this.gameOver = false;
    this.stayInShelterMode = false;
    this.shelteredJobs = [];
    this.demoMessageShown = false;
    this.foodLowSoundPlayed = false;
    this.clearModeHintCount = 0;
    this.tutorialSystem.reset();

    this.initWorld();

    this.gameLoop.gameSpeed = 1;
    this.protectionSystem.update(this.buildingSystem.buildings);
    this.ui.hideGameOver();
    this.ui.hideInfo(); this.ui.hideActionMenu(); this.ui.closePanels();
    this.input.reset();

    const center = this.tileMap.getClearingCenter();
    const ts = getConfig().map.tileSize;
    this.camera.centerOn(center.x * ts, center.y * ts);

    this.soundManager.stopHordeLoop(); this.soundManager.stopBuildingSound(); this.soundManager.stopWood();
    this.soundManager.playSeason(this.seasonSystem.season);
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
    this.deselectVillager();
    this.mode = this.mode === 'demolish' ? 'normal' : 'demolish';
    if (this.mode === 'demolish') {
      this.ui.notify('Click a building to demolish it');
    }
  }

  private setSpeed(speed: number): void {
    this.gameLoop.gameSpeed = speed;
    this.ui.setSpeedHighlight(speed);
    this.updateUI();
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
    this.tutorialSystem.onTechnologyUnlocked(techId);
    this.ui.notify(`Unlocked: ${tech.name}`);
    if (newBuildings.length > 0) {
      this.ui.notify(`New buildings: ${newBuildings.join(', ')}`);
    }
    this.refreshTechPanel();
  }

  private updateUI(): void {
    const alive = this.villagerSystem.getAliveCount();
    const cfg = getConfig().villagers;
    const winterMult = this.seasonSystem.isWinter() ? cfg.winterFoodConsumptionMultiplier : 1;
    const smokehouseBonus = this.buildingSystem.getBuildingsOfType('smokehouse').length > 0
      ? getConfig().resources.smokehouseFoodEfficiencyBonus : 1;
    const foodConsumptionPerSecond = cfg.foodConsumptionPerSecond * alive * winterMult / smokehouseBonus;
    const foodLow = foodConsumptionPerSecond > 0 &&
      this.resourceSystem.resources.food < getConfig().gameplay.foodWarningSeconds * foodConsumptionPerSecond;

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
      soundOn: this.soundManager.isSoundEnabled(),
      gameSpeed: this.gameLoop.gameSpeed,
      foodLow,
      foodSeconds: foodConsumptionPerSecond > 0 ? Math.floor(this.resourceSystem.resources.food / foodConsumptionPerSecond) : 0,
      foodConsumption: foodConsumptionPerSecond,
      toolsAvailable: this.techSystem.isBuildingUnlocked('workshop') || this.resourceSystem.resources.tools>0 || this.villagerSystem.getAliveVillagers().some(hasTool),
      coatsWorn: this.villagerSystem.getAliveVillagers().filter(hasCoat).length,
    });
    const plan=makeForecast(this.seasonSystem,this.resourceSystem,this.buildingSystem,this.villagerSystem,this.techSystem.isBuildingUnlocked('workshop'));
    this.ui.updateForecast(plan);
    this.ui.updateWarnings(settlementWarnings(plan,this.villagerSystem.getAliveVillagers(),this.seasonSystem.season,
      id=>this.isVillagerInShelter(id),this.weatherSystem.currentEvent?.type==='snowstorm'));
    this.ui.updateTutorial(this.tutorialSystem.getObjective(this.resourceSystem.resources.food, this.getWinterFoodTarget()));

    this.ui.updateStatus({ mode: this.mode, shelter: this.stayInShelterMode,
      season: this.seasonSystem.season, secondsLeft: Math.ceil(this.seasonSystem.getCurrentDuration() - this.seasonSystem.seasonTimer),
      foodSeconds: foodConsumptionPerSecond > 0 ? Math.floor(this.resourceSystem.resources.food / foodConsumptionPerSecond) : 0,
      idle: this.villagerSystem.getAliveVillagers().filter(v => !v.currentTask && !v.assignedBuildingId).length,
      enemies: this.hordeSystem.getActiveEnemies().length, paused: this.gameLoop.gameSpeed === 0 });
    if (this.selectedVillagerId) {
      const v = this.villagerSystem.getVillagerById(this.selectedVillagerId);
      if (v && v.health !== HealthState.Dead) {
        const b = this.buildingSystem.buildings.find(b => b.id === v.assignedBuildingId);
        const name = b ? this.buildingSystem.getBuildingConfig(b.configId)?.name ?? '' : '';
        let progress: number | null = null;
        if (!v.path.length) {
          if (v.currentTask === 'clearing' && v.targetX !== null && v.targetY !== null) progress = this.tileMap.getTile(v.targetX, v.targetY)?.clearingProgress ?? 0;
          else if (v.currentTask === 'hunting') progress = v.taskProgress / cfg.freeHuntDuration;
          else if (v.currentTask === 'repairing') progress = v.taskProgress / getConfig().repair.repairTime;
          else if (v.currentTask === 'building') progress = b?.buildProgress ?? 0;
          else if (v.currentTask === 'farming') { progress = b?.cropState==='ripe'?(b.harvestProgress??0)/getConfig().farming.harvestWorkSeconds:b?.farmingProgress??0; }
          else if (b?.configId==='furWorkshop' || b?.configId==='workshop') progress=(b.productionProgress??0)/(b.configId==='furWorkshop'?getConfig().resources.furWorkshopProcessTime:getConfig().resources.workshopToolProductionTime);
        }
        this.ui.showVillager(v, this.pendingOrder, name, progress, this.jobsFor(v.id), plan.toolsAvailable);
      }
    }
    if (this.ui.isBuildPanelOpen()) this.ui.updateBuildAffordability(
      this.buildingSystem.getAllBuildingConfigs(), (w, t, id) => this.resourceSystem.canAfford(w, t) && (!id || !getConfig().buildings[id].maxCount || this.buildingSystem.buildings.filter(b => b.configId === id).length < getConfig().buildings[id].maxCount!));
    if (this.ui.isTechPanelOpen()) this.refreshTechPanel();
    this.uiUpdateCounter++;
    if (this.uiUpdateCounter % 15 === 0) {
      if (!this.ui.isBuildPanelOpen()) {
        this.ui.updateBuildPanel(
          this.buildingSystem.getAllBuildingConfigs(),
          this.techSystem.unlockedBuildings,
          (w, t, id) => this.resourceSystem.canAfford(w, t) && (!id || !getConfig().buildings[id].maxCount || this.buildingSystem.buildings.filter(b => b.configId === id).length < getConfig().buildings[id].maxCount!),
          Number.MAX_SAFE_INTEGER,
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

  private getWinterFoodTarget(): number {
    const cfg = getConfig();
    const plan = makeForecast(this.seasonSystem, this.resourceSystem, this.buildingSystem, this.villagerSystem);
    return Math.max(cfg.tutorial.minimumFoodReserve, Math.ceil(plan.beforeFood + plan.winterFood * cfg.tutorial.winterReserveMultiplier));
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
      economyVersion: 2,
      lastRewardedWinter: this.lastRewardedWinter,
      season: this.seasonSystem.serialize(),
      resources: this.resourceSystem.serialize(),
      villagers: this.villagerSystem.serialize(),
      buildings: this.buildingSystem.serialize(),
      technology: this.techSystem.serialize(),
      enemies: this.hordeSystem.serialize(),
      simulation: { growthAccum: this.growthAccum, foodConsumptionAccum: this.foodConsumptionAccum },
      cameraZoom: this.camera.zoom,
      weather: this.weatherSystem.serialize(),
      comfort: this.comfortSystem.serialize(),
      tileMap: this.tileMap.serialize(),
      level: this.level,
      furAges: [...this.furAges],
      furClothingProduced: this.furClothingProduced,
      stayInShelterMode: this.stayInShelterMode,
      shelteredJobs: this.shelteredJobs,
      tutorial: this.tutorialSystem.serialize(),
      cameraX: this.camera.x,
      cameraY: this.camera.y,
    };
  }

  private deserializeState(data: Record<string, unknown>): void {
    data = migrateRetiredBuildings(data);
    if (typeof data.level === 'number') this.level = data.level;
    if (data.tileMap) {
      this.tileMap.deserialize(data.tileMap as any);
    }
    if (data.season) {
      this.seasonSystem.deserialize(data.season as any);
    }
    this.lastRewardedWinter = Number(data.lastRewardedWinter ?? Math.max(0, this.seasonSystem.year - 1));
    if (data.resources) {
      const savedResources = data.resources as any;
      this.resourceSystem.deserialize({ ...savedResources, clothing: savedResources.clothing ?? Number(data.furClothingProduced ?? 0) });
    }
    if (data.buildings) {
      this.buildingSystem.buildings = [];
      this.buildingSystem.deserialize(data.buildings as any);
    }
    const extraWards = this.buildingSystem.buildings.filter(b => b.configId === 'herbalFire').slice(getConfig().buildings.herbalFire.maxCount);
    for (const b of extraWards) this.buildingSystem.demolishBuilding(b.id);
    if (data.villagers) {
      this.villagerSystem.deserialize(data.villagers as any);
    }
    if (data.technology) {
      this.techSystem.deserialize(data.technology as any);
      for (const id of getConfig().technology.initialTechs) this.techSystem.unlockedTechs.add(id);
      for (const id of getConfig().technology.initialBuildings) this.techSystem.unlockedBuildings.add(id);
    }
    if (data.enemies) {
      this.hordeSystem.deserialize(data.enemies as any, this.seasonSystem.isWinter(), this.seasonSystem.year, this.level);
    }
    if ('weather' in data) {
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
    this.shelteredJobs = (data.shelteredJobs as typeof this.shelteredJobs) ?? [];
    if (data.tutorial) {
      this.tutorialSystem.deserialize(data.tutorial as TutorialState);
    } else {
      // Older saves may already be far beyond the onboarding sequence.
      this.tutorialSystem.skip();
    }
    this.villagerSystem.setShelters(this.buildingSystem.getHousingTiles());
    for (const v of this.villagerSystem.getAliveVillagers()) {
      if (v.currentTask === 'hunting') {
        const hunting = getConfig().villagers;
        const depth = this.villagerSystem.huntingGrounds.depthAt(v.targetX ?? v.x, v.targetY ?? v.y);
        if (depth < hunting.huntForestDepth || depth > hunting.huntMaxForestDepth) {
          v.currentTask = null;
          if (!this.villagerSystem.sendVillagerToHunt(v.id)) {
            v.path = []; v.targetX = null; v.targetY = null; v.state = VillagerState.Idle;
          }
        }
      }
      const b = this.buildingSystem.buildings.find(b => b.id === v.assignedBuildingId);
      if (!b?.built || !this.buildingSystem.getBuildingConfig(b.configId)?.maxWorkers || v.currentTask === 'repairing') continue;
      v.currentTask = b.configId === 'garden' ? 'farming' : 'working';
      if (!b.assignedWorkers.includes(v.id)) b.assignedWorkers.push(v.id);
      if (b.configId === 'garden' && b.productionProgress === undefined) b.productionProgress = v.taskProgress;
    }
    if (this.seasonSystem.isWinter() && data.economyVersion !== 2) this.cropSystem.winter(this.buildingSystem.buildings);
    this.equipmentSystem.issue(this.villagerSystem.getAliveVillagers(), this.resourceSystem);
    this.protectionSystem.advance(0, this.buildingSystem.buildings, this.resourceSystem, this.seasonSystem.season);
    this.resourceSystem.updateStorageCapacity(this.buildingSystem.getStorageBonuses());
    const accum = data.simulation as { growthAccum?: number; foodConsumptionAccum?: number } | undefined;
    this.growthAccum = accum?.growthAccum ?? 0;
    this.foodConsumptionAccum = accum?.foodConsumptionAccum ?? 0;
    if (typeof data.cameraZoom === 'number') this.camera.zoom = data.cameraZoom;
    this.mode = 'normal'; this.pendingOrder = null; this.selectedVillagerId = null; this.ui.closePanels(); this.ui.hideActionMenu(); this.ui.hideInfo(); this.input.reset();
    this.soundManager.stopHordeLoop(); this.soundManager.stopBuildingSound(); this.soundManager.stopWood();
    this.soundManager.playSeason(this.seasonSystem.season);
    if (data.cameraZoom === undefined) {
      const c = this.tileMap.getClearingCenter(), ts = getConfig().map.tileSize;
      this.camera.centerOn(c.x * ts, c.y * ts);
    } else if (data.cameraX !== undefined && data.cameraY !== undefined) {
      this.camera.x = data.cameraX as number;
      this.camera.y = data.cameraY as number;
    }
  }
}
