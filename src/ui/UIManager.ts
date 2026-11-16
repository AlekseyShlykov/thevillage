import { ResourceState, Season, BuildingConfig, TechConfig, VillagerData } from '../types';
import { SeasonBriefing } from '../systems/TutorialSystem';
import { SeasonTutorial } from './SeasonTutorial';
import { TargetedVillagerOrder, VillagerOrder, villagerActivity, villagerOrders } from '../game/VillagerOrders';
import { IconName, iconMarkup, setButtonContent } from './icons';
import { TooltipController } from './TooltipController';
import { getConfig } from '../data/ConfigLoader';
import { EconomyForecast } from '../systems/ForecastSystem';
import { hasCoat } from '../systems/EquipmentSystem';
import { VillagerJob } from '../game/VillagerJobs';
import { Notifications } from './Notifications';
import { SettlementWarning } from '../systems/WarningSystem';

export interface UIAction { label: string; icon?: IconName; callback: () => void }

export interface UICallbacks {
  onSpeedChange: (speed: number) => void;
  onBuildSelect: (buildingId: string) => void;
  onBuildCancel: () => void;
  onBuildPanelOpen?: () => void;
  onTechPanelOpen?: () => void;
  onDemolish: () => void;
  onTechUnlock: (techId: string) => void;
  onSave: () => void;
  onLoad: () => void;
  onToggleClearMode: () => void;
  onGoHunting: () => void;
  onGatherHerbs: () => void;
  onSendAllToChop: () => void;
  onReleaseOne?: () => void;
  onToggleShelter: () => void;
  onRepairAll: () => void;
  onRestart: () => void;
  onTutorialAcknowledge: () => void;
  onTutorialSkip: () => void;
  onSoundToggle?: () => void;
  onEmailSubmitted?: () => void;
  onCameraZoom?: (factor: number) => void;
  onCameraHome?: () => void;
  onVillagerOrder: (order: VillagerOrder) => void;
  onVillagerDeselect: () => void;
  onVillagerJob: (key: string) => void;
}

export class UIManager {
  private overlay: HTMLElement;
  private topBar!: HTMLElement;
  private topBarStatsDiv!: HTMLElement;
  private topBarTechBtn!: HTMLElement;
  private topBarRightDiv!: HTMLElement;
  private soundBtn!: HTMLButtonElement;
  private shelterBtn!: HTMLElement;
  private tooltips!: TooltipController;
  private speedButtons: HTMLElement[] = [];
  private buildPanel!: HTMLElement;
  private techPanel!: HTMLElement;
  private infoPanel!: HTMLElement;
  private notifications!: Notifications;
  private toolbarKey = "";
  private seasonTutorial!: SeasonTutorial;
  private statusEl!: HTMLElement;
  private callbacks: UICallbacks;
  private buildPanelOpen = false;
  private techPanelOpen = false;
  private actionMenuEl: HTMLElement | null = null;
  private actionMenuBackdrop: HTMLElement | null = null;
  private gameOverOverlay: HTMLElement | null = null;

  constructor(callbacks: UICallbacks) {
    this.overlay = document.getElementById('ui-overlay')!;
    this.callbacks = callbacks;
    this.createUI();
    this.tooltips = new TooltipController(this.topBar, this.overlay);
  }

  private createUI(): void {
    this.overlay.innerHTML = '';

    this.topBar = this.el('div', {
      position: 'absolute', top: '0', left: '0', right: '0',
      height: '48px', background: 'rgba(20,20,40,0.9)',
      display: 'flex', alignItems: 'center', padding: '0 12px',
      gap: '16px', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.1)',
      zIndex: '10', fontFamily: 'inherit', color: '#e0d8c8',
    });
    this.topBar.id = 'game-top-bar';
    this.topBarStatsDiv = this.el('div', { display: 'flex', alignItems: 'center', gap: '16px' });
    this.topBarStatsDiv.setAttribute('data-topbar-stats', 'true');
    this.topBar.appendChild(this.topBarStatsDiv);
    this.topBarTechBtn = this.el('button', {
      marginLeft: '4px', padding: '4px 10px', background: 'rgba(60,60,80,0.9)',
      border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#e0d8c8',
      cursor: 'pointer', fontSize: '12px',
    }) as HTMLButtonElement;
    this.topBarTechBtn.setAttribute('data-tech-btn', 'true');
    setButtonContent(this.topBarTechBtn, 'Tech', 'book');
    this.topBarTechBtn.addEventListener('click', () => this.toggleTechPanel());
    this.topBar.appendChild(this.topBarTechBtn);
    this.topBarRightDiv = this.el('div', { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' });
    this.topBarRightDiv.setAttribute('data-topbar-buttons', 'true');
    this.soundBtn = document.createElement('button');
    this.soundBtn.setAttribute('data-sound-btn', 'true');
    this.soundBtn.title = 'Sound';
    Object.assign(this.soundBtn.style, {
      padding: '4px 8px', background: 'rgba(60,60,80,0.9)', border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '4px', color: '#e0d8c8', cursor: 'pointer', fontSize: '12px',
    });
    setButtonContent(this.soundBtn, 'Mute sound', 'sound'); this.soundBtn.classList.add('icon-only');
    this.soundBtn.addEventListener('click', () => this.callbacks.onSoundToggle?.());
    this.topBarRightDiv.appendChild(this.soundBtn);
    const saveBtn = this.btn('Save', () => this.callbacks.onSave(), 'save');
    saveBtn.setAttribute('data-save-btn', 'true');
    this.topBarRightDiv.appendChild(saveBtn);
    const loadBtn = this.btn('Load', () => this.callbacks.onLoad(), 'load');
    loadBtn.setAttribute('data-load-btn', 'true');
    this.topBarRightDiv.appendChild(loadBtn);
    this.topBar.appendChild(this.topBarRightDiv);
    this.overlay.appendChild(this.topBar);

    const bottomBar = this.el('div', {
      position: 'absolute', bottom: '0', left: '0', right: '0',
      height: '44px', background: 'rgba(20,20,40,0.9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '8px', borderTop: '1px solid rgba(255,255,255,0.1)',
      zIndex: '10',
    });
    bottomBar.id = 'game-bottom-bar';
    this.overlay.appendChild(bottomBar);

    const speeds = [
      { label: 'Pause', speed: 0 },
      { label: '1×', speed: 1 },
      { label: '2×', speed: 2 },
      { label: '4×', speed: 4 },
    ];
    for (const s of speeds) {
      const btn = this.btn(s.label, () => this.callbacks.onSpeedChange(s.speed), s.speed === 0 ? 'pause' : undefined);
      if (s.speed === 0) btn.classList.add('icon-only');
      btn.setAttribute('data-speed', String(s.speed));
      this.speedButtons.push(btn);
      bottomBar.appendChild(btn);
    }

    const clearBtn = this.btn('Clear', () => this.callbacks.onToggleClearMode(), 'axe');
    clearBtn.title='Expand the clearing around the village, or click specific trees to queue them. Click Clear again to finish selecting.';
    clearBtn.dataset.globalClear='true';bottomBar.appendChild(clearBtn);

    const huntBtn = this.btn('Hunt', () => this.callbacks.onGoHunting(), 'bow');
    huntBtn.dataset.globalHunt='true';bottomBar.appendChild(huntBtn);
    const herbBtn = this.btn('Herbs', () => this.callbacks.onGatherHerbs(), 'herbs');
    herbBtn.dataset.gatherHerbs = 'true'; bottomBar.appendChild(herbBtn);

    const buildBtn = this.btn('Build', () => this.toggleBuildPanel(), 'build');
    buildBtn.dataset.buildToggle='true';bottomBar.appendChild(buildBtn);

    this.shelterBtn = this.btn('Shelter', () => this.callbacks.onToggleShelter(), 'home');
    this.shelterBtn.dataset.shelterToggle = 'true';
    bottomBar.appendChild(this.shelterBtn);
    const release=this.btn('Release one',()=>this.callbacks.onReleaseOne?.(),'release');release.dataset.releaseOne='true';release.title='Release one resident while everyone else stays sheltered';release.hidden=true;bottomBar.appendChild(release);

    const repairBtn = this.btn('Repair', () => this.callbacks.onRepairAll(), 'repair');
    repairBtn.setAttribute('data-repair-btn', 'true');
    bottomBar.appendChild(repairBtn);
    this.layoutBottomBar();
    new ResizeObserver(()=>this.overlay.style.setProperty('--toolbar-height',`${bottomBar.getBoundingClientRect().height}px`)).observe(bottomBar);

    this.buildPanel = this.el('div', {
      position: 'absolute', left: '8px', top: '56px',
      width: '220px', maxHeight: 'calc(100% - 120px)', overflowY: 'auto',
      background: 'rgba(20,20,40,0.92)', borderRadius: '8px',
      padding: '8px', display: 'none', zIndex: '10',
      border: '1px solid rgba(255,255,255,0.1)',
    });
    this.buildPanel.setAttribute('data-ui', 'true');
    this.buildPanel.setAttribute('data-build-panel', 'true');
    this.buildPanel.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('[data-building-id]');
      if (item) {
        const id = item.getAttribute('data-building-id');
        if (id && item.getAttribute('data-affordable') === 'true') this.callbacks.onBuildSelect(id);
      }
    });
    this.overlay.appendChild(this.buildPanel);

    this.techPanel = this.el('div', {
      position: 'absolute', right: '8px', top: '56px',
      width: '260px', maxHeight: 'calc(100% - 120px)', overflowY: 'auto',
      background: 'rgba(20,20,40,0.92)', borderRadius: '8px',
      padding: '8px', display: 'none', zIndex: '10',
      border: '1px solid rgba(255,255,255,0.1)',
    });
    this.techPanel.setAttribute('data-tech-panel', 'true');
    this.overlay.appendChild(this.techPanel);

    this.infoPanel = this.el('div', {
      position: 'absolute', right: '8px', bottom: '56px',
      width: '200px', background: 'rgba(20,20,40,0.92)', borderRadius: '8px',
      padding: '8px', display: 'none', zIndex: '10', fontSize: '12px',
      border: '1px solid rgba(255,255,255,0.1)',
    });
    this.infoPanel.setAttribute('data-info-panel', 'true');
    this.overlay.appendChild(this.infoPanel);

    this.notifications = new Notifications(this.overlay,()=>{if(!this.techPanelOpen)this.toggleTechPanel();});

    this.seasonTutorial=new SeasonTutorial(this.overlay,()=>this.callbacks.onTutorialAcknowledge(),()=>this.callbacks.onTutorialSkip());
    this.statusEl = this.el('div'); this.statusEl.id = 'status-ribbon'; this.statusEl.setAttribute('role', 'status');
    this.overlay.appendChild(this.statusEl);
    const controls = this.el('div'); controls.className = 'camera-controls'; controls.setAttribute('data-ui', 'true');
    for (const [icon, title, action] of [
      ['minus', 'Zoom out', () => this.callbacks.onCameraZoom?.(1 / 1.15)],
      ['home', 'Center village', () => this.callbacks.onCameraHome?.()],
      ['plus', 'Zoom in', () => this.callbacks.onCameraZoom?.(1.15)],
    ] as const) { const button = this.btn(title, action, icon); button.classList.add('icon-only'); button.title = title; controls.appendChild(button); }
    this.overlay.appendChild(controls);
    for (const button of this.overlay.querySelectorAll('button')) if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', button.textContent ?? '');
  }

  updateTutorial(briefing:SeasonBriefing|null):void {this.seasonTutorial.update(briefing);this.layoutBottomBar();}

  /** Show context menu with actions for selected villager at (screenX, screenY). */
  showActionMenu(screenX: number, screenY: number, actions: UIAction[]): void {
    this.hideActionMenu();
    if (actions.length === 0) return;

    const backdrop = this.el('div', {
      position: 'fixed',
      left: '0', top: '0', right: '0', bottom: '0',
      zIndex: '29',
      background: 'transparent',
    });
    backdrop.setAttribute('data-ui', 'true');
    backdrop.addEventListener('click', () => { this.callbacks.onVillagerDeselect();this.closePanels();this.closeForecast();this.hideActionMenu(); });
    this.overlay.appendChild(backdrop);
    this.actionMenuBackdrop = backdrop;

    const menu = this.el('div', {
      position: 'fixed',
      left: `${Math.min(screenX, this.overlay.offsetWidth - 160)}px`,
      top: `${Math.min(screenY + 8, this.overlay.offsetHeight - 120)}px`,
      minWidth: '140px',
      background: 'rgba(25,25,45,0.96)',
      borderRadius: '8px',
      padding: '6px',
      zIndex: '30',
      border: '1px solid rgba(74,222,128,0.4)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    });
    menu.setAttribute('data-ui', 'true');
    menu.addEventListener('click', (e) => e.stopPropagation());

    const title = this.el('div', { fontSize: '11px', opacity: '0.7', marginBottom: '6px', padding: '0 4px' });
    title.textContent = 'Actions';
    menu.appendChild(title);

    for (const a of actions) {
      const btn = this.btn(a.label, () => {
        a.callback();
        this.hideActionMenu();
      }, a.icon);
      btn.style.width = '100%';
      btn.style.marginBottom = '2px';
      btn.style.textAlign = 'left';
      menu.appendChild(btn);
    }

    const cancel = this.btn('Close', () => this.hideActionMenu(), 'close');
    cancel.style.width = '100%';
    cancel.style.marginTop = '4px';
    menu.appendChild(cancel);

    this.overlay.appendChild(menu);
    this.actionMenuEl = menu;
    menu.classList.add('action-menu');
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(screenX, innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(screenY + 8, innerHeight - rect.height - 145))}px`;
  }

  hideActionMenu(): void {
    if (this.actionMenuBackdrop && this.actionMenuBackdrop.parentNode) {
      this.actionMenuBackdrop.parentNode.removeChild(this.actionMenuBackdrop);
      this.actionMenuBackdrop = null;
    }
    if (this.actionMenuEl && this.actionMenuEl.parentNode) {
      this.actionMenuEl.parentNode.removeChild(this.actionMenuEl);
      this.actionMenuEl = null;
    }
  }

  updateTopBar(data: {
    resources: ResourceState;
    season: Season;
    seasonProgress: number;
    comfort: number;
    year: number;
    level: number;
    population: number;
    housing: number;
    soundOn?: boolean;
    gameSpeed?: number;
    foodLow?: boolean;
    foodSeconds: number;
    foodConsumption: number;
    hasWard: boolean;
    coatsWorn: number;
  }): void {
    const seasonColors: Record<string, string> = {
      spring: '#7ec87e', summer: '#d4c45a', autumn: '#c87a3e', winter: '#8ab4e8',
    };
    const sc = seasonColors[data.season] || '#aaa';
    const pct = Math.round(data.seasonProgress * 100);

    if (!this.topBarStatsDiv.childElementCount) {
      const resource = (icon: IconName, label: string) =>
        `<span class="resource" data-stat="${icon}" tabindex="0"><span class="resource-icon">${iconMarkup(icon)}</span><span><small>${label}</small><strong data-value></strong></span></span>`;
      this.topBarStatsDiv.innerHTML = resource('wood','Wood') + resource('food','Food') + resource('fur','Pelts') + resource('clothing','Coats') + resource('herbs','Herbs') +
        `<span class="season-stat" data-stat="season" tabindex="0"><span data-season-name></span><span class="season-track"><i></i></span></span>` +
        `<span class="village-stat" data-stat="villagers" tabindex="0">${iconMarkup('villagers')} <b data-value></b><small>VILLAGERS</small></span>` +
        `<span class="village-stat" data-stat="comfort" tabindex="0">${iconMarkup('comfort')} <b data-value></b><small>COMFORT</small></span>` +
        `<span class="village-stat" data-stat="research" tabindex="0">${iconMarkup('research')} <b data-value></b><small data-level></small></span>`;
    }
    const stat = (key: string, value: string, title: string, detail: string) => {
      const el = this.topBarStatsDiv.querySelector<HTMLElement>(`[data-stat="${key}"]`)!;
      el.querySelector('[data-value]')!.textContent = value;
      el.dataset.tooltipTitle = title; el.dataset.tooltip = detail; el.setAttribute('aria-label', `${title}: ${value}`);
    };
    stat('wood', String(Math.floor(data.resources.wood)), 'Wood', `Gathered by chopping trees and working at lumber camps. Used for construction, repairs and winter heating. Each home or guard tower needs ${getConfig().heating.woodPerShelterPerWinter} wood per full winter. Keep enough firewood before spending your reserve.`);
    stat('food', String(Math.floor(data.resources.food)), 'Food', `Feeds every resident. Current use: ${data.foodConsumption.toFixed(2)} per second; supplies last ${data.foodSeconds} seconds. Consumption rises in winter. Hunting and gardens replenish food.`);
    stat('fur', String(Math.floor(data.resources.fur)), 'Fur', 'Hunters deliver raw pelts after returning home. Pelts must be crafted into individual fur coats; raw pelts do not protect from cold.');
    stat('clothing',String(data.coatsWorn+data.resources.clothing),'Warm clothing',`${data.coatsWorn} residents wearing a fur coat; ${data.resources.clothing} spare coats. A fur workshop turns pelts into coats. Only worn coats protect from cold.`);
    stat('herbs',String(data.resources.herbs),'Protective herbs',`Maximum ${getConfig().herbs.capacity}, including expeditions. ${getConfig().herbs.perWinter} fuel the ward for one winter. Gatherers travel deep into the forest and risk death.`);
    stat('villagers', `${data.population}/${data.housing}`, 'Villagers / housing', 'The first number is living residents; the second is housing capacity. Spare housing, food and comfort attract newcomers outside winter.');
    this.topBarStatsDiv.querySelector<HTMLElement>('[data-stat="herbs"]')!.hidden=!data.hasWard;
    this.overlay.querySelector<HTMLElement>('[data-gather-herbs]')!.hidden=!data.hasWard&&!this.seasonTutorial.isHerbPreview();
    this.layoutBottomBar();
    stat('comfort', `${Math.round(data.comfort*100)}%`, 'Comfort', 'Food, warmth, shelter, health and defenses raise comfort. Comfortable villagers work faster and the village attracts newcomers.');
    const nextLevel = Object.entries(getConfig().levels).find(([level]) => Number(level) > data.level);
    stat('research', String(Math.floor(data.resources.techPoints)), `Research · village level ${data.level}`, `Research points unlock technologies in Tech. Earn them only by surviving winter: 1 star in winters 1–5, then 2 per winter.${nextLevel ? ` Next level: ${nextLevel[1].populationThreshold} residents.` : ' All technology tiers are available.'}`);
    this.topBarStatsDiv.querySelector('[data-level]')!.textContent = `LEVEL ${data.level}`;
    this.topBarStatsDiv.querySelector('[data-stat="food"]')!.classList.toggle('resource-low', !!data.foodLow);
    const season = this.topBarStatsDiv.querySelector<HTMLElement>('[data-stat="season"]')!;
    const duration = getConfig().seasons[`${data.season}Duration`];
    season.dataset.tooltipTitle = `${data.season.charAt(0).toUpperCase()+data.season.slice(1)} · year ${data.year}`;
    season.dataset.tooltip = `${Math.ceil(duration*(1-data.seasonProgress))} seconds remain. Prepare food and defenses before winter; winter brings monster attacks. Spring ends the horde and autosaves the village.`;
    const seasonName = season.querySelector<HTMLElement>('[data-season-name]')!;
    seasonName.textContent = `${data.season} · Year ${data.year}`; seasonName.style.color = sc;
    const track = season.querySelector<HTMLElement>('.season-track i')!; track.style.width = `${pct}%`; track.style.background = sc;
    for (const [selector,title,detail] of [
      ['[data-tech-btn]', 'Technology', 'Spend research points to unlock buildings and improvements. New village levels make more technologies available.'],
      ['[data-save-btn]', 'Save game', 'Save the current village in this browser. Spring also creates an automatic save.'],
      ['[data-load-btn]', 'Load game', 'Restore a saved village in this browser, including jobs, resources and the season.'],
      ['[data-sound-btn]', 'Sound', 'Turn music and game sounds on or off.'],
    ]) {
      const el = this.topBar.querySelector<HTMLElement>(selector)!; el.dataset.tooltipTitle = title; el.dataset.tooltip = detail;
    }
    this.tooltips?.refresh();

    const soundOn = data.soundOn !== false;
    if (this.soundBtn.dataset.soundState !== String(soundOn)) {
      setButtonContent(this.soundBtn, soundOn ? 'Mute sound' : 'Unmute sound', soundOn ? 'sound' : 'muted');
      this.soundBtn.dataset.soundState = String(soundOn);
      this.soundBtn.setAttribute('aria-pressed', String(soundOn));
      this.soundBtn.removeAttribute('title');
    }

    if (data.gameSpeed !== undefined) this.setSpeedHighlight(data.gameSpeed);
  }

  setSpeedHighlight(currentSpeed: number): void {
    for (const btn of this.speedButtons) {
      const speed = Number(btn.getAttribute('data-speed'));
      if (speed === currentSpeed) {
        btn.style.boxShadow = '0 0 0 2px #ffe0a0';
      } else {
        btn.style.boxShadow = '';
      }
    }
  }

  updateBuildPanel(buildings: Record<string, BuildingConfig>, unlockedIds: Set<string>, canAfford: (wood: number, tools: number, id?: string) => boolean, maxBuildingTier = Number.MAX_SAFE_INTEGER): void {
    this.buildPanel.innerHTML = '<div style="font-size:14px;font-weight:bold;margin-bottom:8px;color:#ffe0a0">Build Menu</div>';

    const cancelBtn = this.btn('Cancel', () => this.callbacks.onBuildCancel(), 'close');
    cancelBtn.style.width = '100%';
    cancelBtn.style.marginBottom = '8px';
    this.buildPanel.appendChild(cancelBtn);

    for (const [id, cfg] of Object.entries(buildings)) {
      if (!unlockedIds.has(id)) continue;
      if (cfg.tier > maxBuildingTier) continue;
      const affordable = canAfford(cfg.costWood, cfg.costTools, cfg.id);
      const item = this.el('div', {
        padding: '6px', marginBottom: '4px', borderRadius: '4px',
        background: affordable ? 'rgba(60,60,80,0.8)' : 'rgba(40,40,50,0.5)',
        cursor: affordable ? 'pointer' : 'default',
        opacity: affordable ? '1' : '0.5',
        border: '1px solid rgba(255,255,255,0.05)',
      });
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', affordable ? '0' : '-1');
      item.setAttribute('aria-label', `${cfg.name}: ${cfg.costWood} wood${cfg.costTools ? `, ${cfg.costTools} tools` : ''}`);
      item.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Enter' && item.getAttribute('data-affordable') === 'true') this.callbacks.onBuildSelect(id); });
      item.setAttribute('data-building-id', id);
      item.setAttribute('data-affordable', affordable ? 'true' : 'false');
      item.setAttribute('data-ui', 'true');
      item.innerHTML = `
        <div style="font-weight:bold;font-size:12px">${cfg.protectionRadius ? iconMarkup('ward') : ''}${cfg.name}</div>
        <div style="font-size:10px;opacity:0.7">${cfg.description}${cfg.protectionRadius ? ` Protects ${cfg.protectionRadius} tiles in every direction.` : ''}</div>
        <div class="resource-cost">${iconMarkup('wood', true)}<span>${cfg.costWood}</span>${cfg.costTools ? `${iconMarkup('tools', true)}<span>${cfg.costTools}</span>` : ''}<span class="footprint-size">${cfg.width}×${cfg.height}</span></div>
      `;
      this.buildPanel.appendChild(item);
    }
  }

  updateBuildAffordability(buildings: Record<string, BuildingConfig>, canAfford: (wood: number, tools: number, id?: string) => boolean): void {
    for (const item of this.buildPanel.querySelectorAll<HTMLElement>('[data-building-id]')) {
      const cfg = buildings[item.dataset.buildingId!]; if (!cfg) continue;
      const affordable = canAfford(cfg.costWood, cfg.costTools, cfg.id);
      item.dataset.affordable = String(affordable);
      item.style.opacity = affordable ? '1' : '.5';
      item.style.cursor = affordable ? 'pointer' : 'default';
      item.tabIndex = affordable ? 0 : -1;
      item.setAttribute('aria-disabled', String(!affordable));
    }
  }

  updateTechPanel(
    available: TechConfig[],
    unlocked: Set<string>,
    techPoints: number,
    currentLevel: number,
  ): void {
    const key = `${currentLevel}:${Math.floor(techPoints)}:${[...unlocked].join(',')}:${available.map(t => t.id).join(',')}`;
    if (this.techPanel.dataset.contentKey === key) return;
    this.techPanel.dataset.contentKey = key;
    this.techPanel.innerHTML = `
      <div style="font-size:14px;font-weight:bold;margin-bottom:4px;color:#ffe0a0">Technology Tree</div>
      <div style="font-size:11px;margin-bottom:8px;opacity:0.7">Tech Points: ${iconMarkup('research', true)}${Math.floor(techPoints)} | Level ${currentLevel}</div>
    `;

    if (unlocked.size > 0) {
      const unlockedDiv = this.el('div', { marginBottom: '8px' });
      unlockedDiv.innerHTML = '<div style="font-size:11px;opacity:0.5;margin-bottom:4px">Unlocked:</div>';
      for (const id of unlocked) {
        const d = this.el('div', { fontSize: '11px', opacity: '0.6', padding: '2px 0' });
        d.innerHTML = `${iconMarkup('check', true)} ${id}`;
        unlockedDiv.appendChild(d);
      }
      this.techPanel.appendChild(unlockedDiv);
    }

    if (available.length === 0) {
      const msg = this.el('div', { fontSize: '12px', opacity: '0.5', padding: '8px 0' });
      msg.textContent = 'No new tech available. Grow population to unlock higher tiers.';
      this.techPanel.appendChild(msg);
      return;
    }

    for (const tech of available) {
      const canAfford = techPoints >= tech.cost;
      const item = this.el('div', {
        padding: '6px', marginBottom: '4px', borderRadius: '4px',
        background: canAfford ? 'rgba(60,80,60,0.8)' : 'rgba(40,40,50,0.5)',
        cursor: canAfford ? 'pointer' : 'default',
        opacity: canAfford ? '1' : '0.6',
        border: '1px solid rgba(255,255,255,0.05)',
      });
      item.innerHTML = `
        <div style="font-weight:bold;font-size:12px">${tech.id === 'herbalFire' ? iconMarkup('ward') : ''}${tech.name} <span style="opacity:0.5">T${tech.tier}</span></div>
        <div style="font-size:10px;opacity:0.7">${tech.description}</div>
        <div style="font-size:10px;margin-top:2px">Cost: ${iconMarkup('research', true)}${tech.cost}</div>
      `;
      item.setAttribute('data-tech-id', tech.id);
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', canAfford ? '0' : '-1');
      if (canAfford) {
        item.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Enter') this.callbacks.onTechUnlock(tech.id); });
        item.addEventListener('click', () => this.callbacks.onTechUnlock(tech.id));
      }
      this.techPanel.appendChild(item);
    }
  }

  showInfo(lines: (string | { text: string; icon: IconName })[]): void {
    delete this.infoPanel.dataset.villager;
    this.infoPanel.style.display = 'block';
    this.infoPanel.replaceChildren(...lines.map(line => {
      const row = this.el('div'); row.className = 'info-line';
      if (typeof line === 'string') row.textContent = line;
      else { row.innerHTML = iconMarkup(line.icon, true); row.appendChild(document.createTextNode(line.text)); }
      return row;
    }));
  }

  hideInfo(): void {
    this.infoPanel.style.display = 'none';
    delete this.infoPanel.dataset.villager;
  }

  /** Update text without replacing focused job buttons on every simulation tick. */
  showVillager(v: VillagerData, order: TargetedVillagerOrder | null, workplace: string, progress: number | null, jobs: VillagerJob[]): void {
    if (this.buildPanelOpen || this.techPanelOpen) { this.infoPanel.style.display = 'none'; return; }
    if (this.infoPanel.dataset.villager !== v.id) {
      this.infoPanel.innerHTML = '';
      this.infoPanel.dataset.villager = v.id;
      const header = this.el('div'); header.className = 'villager-header';
      const title = this.el('span'); title.textContent = `Villager ${v.id.replace('v_', '')}`;
      const close = this.btn('Deselect villager', () => this.callbacks.onVillagerDeselect(), 'close'); close.classList.add('icon-only');
      header.append(title, close);
      const status = this.el('div'); status.dataset.villagerStatus = 'true';
      const health = this.el('small'); health.dataset.villagerHealth = 'true';
      const meter = document.createElement('progress'); meter.max = 1; meter.setAttribute('aria-label', 'Job progress');
      const grid = this.el('div'); grid.className = 'villager-orders';
      const hint = this.el('div'); hint.dataset.orderHint = 'true'; hint.setAttribute('role', 'status');
      const cancel = this.btn('Cancel order', () => this.callbacks.onVillagerOrder(this.infoPanel.dataset.targetOrder as VillagerOrder), 'close');
      cancel.dataset.orderCancel = 'true';
      this.infoPanel.append(header, status, health, meter, grid, hint, cancel);
    }
    this.infoPanel.style.display = 'block';
    const grid=this.infoPanel.querySelector<HTMLElement>('.villager-orders')!;
    const jobKey=jobs.map(j=>`${j.key}:${j.label}:${j.buildingId??''}`).join('|');
    if(grid.dataset.jobs!==jobKey) {
      grid.replaceChildren();grid.dataset.jobs=jobKey;
      for(const job of jobs) {
        const button=this.btn(job.label,()=>this.callbacks.onVillagerJob(job.key),job.icon);
        button.dataset.villagerOrder=job.kind;button.dataset.villagerJob=job.key;grid.append(button);
      }
    }
    this.infoPanel.dataset.targetOrder = order ?? '';
    this.infoPanel.querySelector<HTMLElement>('[data-order-cancel]')!.hidden = !order;
    this.infoPanel.querySelector<HTMLElement>('[data-villager-status]')!.textContent = `${villagerActivity(v)}${workplace ? ` · ${workplace}` : ''}`;
    this.infoPanel.querySelector<HTMLElement>('[data-villager-health]')!.textContent = `Health ${Math.round(v.hp)}/${v.maxHp}${v.health === 'injured' ? ' · Recovering' : ''} · ${hasCoat(v) ? 'Fur coat worn' : 'No warm coat'}${(v.coldExposure ?? 0)>0 ? ' · Cold '+Math.round(v.coldExposure!)+'/'+getConfig().cold.unclothedSurvivalSeconds : ''}${v.cargo && Object.values(v.cargo).some(n=>n>0) ? ' · Carrying '+v.cargo.food+' food, '+v.cargo.fur+' pelts, '+v.cargo.herbs+' herbs' : ''}`;
    const meter = this.infoPanel.querySelector('progress')!; meter.hidden = progress === null; meter.value = progress ?? 0;
    this.infoPanel.querySelector<HTMLElement>('[data-order-hint]')!.textContent = order ? `${villagerOrders[order].hint} Right-click or Esc to cancel.` : 'Choose an available job to start immediately. It replaces this resident’s previous task.';
    for (const button of this.infoPanel.querySelectorAll<HTMLElement>('[data-villager-order]')) {
      const active = button.dataset.villagerOrder === order;
      button.classList.toggle('active-action', active); button.setAttribute('aria-pressed', String(active));
    }
  }

  notify(message: string, duration = 3000): void { this.notifications.notify(message, duration); }
  notifyResearchStars(stars:number):void {this.notifications.notifyResearchStars(stars);}
  resetNotifications(): void { this.notifications.reset(); }

  /** Different button counts still produce two complete, equally wide mobile rows. */
  private layoutBottomBar(): void {
    const bar=this.overlay.querySelector<HTMLElement>('#game-bottom-bar')!;
    const buttons=[...bar.querySelectorAll<HTMLElement>('button')].filter(b=>!b.hidden);
    const key=buttons.map(b=>b.textContent).join('|');if(key===this.toolbarKey)return;this.toolbarKey=key;
    const top=Math.ceil(buttons.length/2),bottom=buttons.length-top;
    bar.style.setProperty('--toolbar-columns',String(top*bottom));
    buttons.forEach((b,i)=>{b.style.gridColumn=`span ${i<top?bottom:top}`;});
  }

  private toggleBuildPanel(): void {
    this.buildPanelOpen = !this.buildPanelOpen;
    this.buildPanel.style.display = this.buildPanelOpen ? 'block' : 'none';
    if (this.buildPanelOpen) {
      this.techPanelOpen = false;
      this.techPanel.style.display = 'none';
      this.hideActionMenu();
      this.infoPanel.style.display = 'none';
      this.callbacks.onBuildPanelOpen?.();
    }
  }

  private toggleTechPanel(): void {
    this.techPanelOpen = !this.techPanelOpen;
    this.techPanel.style.display = this.techPanelOpen ? 'block' : 'none';
    if (this.techPanelOpen) {
      this.notifications.acknowledgeResearch();
      this.buildPanelOpen = false;
      this.buildPanel.style.display = 'none';
      this.hideActionMenu();
      this.infoPanel.style.display = 'none';
      this.callbacks.onTechPanelOpen?.();
    }
  }

  closePanels(): void {
    this.buildPanelOpen = false;
    this.techPanelOpen = false;
    this.buildPanel.style.display = 'none';
    this.techPanel.style.display = 'none';
  }

  isBuildPanelOpen(): boolean {
    return this.buildPanelOpen;
  }

  isTechPanelOpen(): boolean { return this.techPanelOpen; }

  isOverUI(x: number, y: number): boolean {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      if (el === this.topBar || el === this.buildPanel || el === this.techPanel ||
          el === this.infoPanel || el.closest('[data-ui]')) {
        return true;
      }
    }
    return false;
  }

  updateForecast(data: EconomyForecast): void {
    let panel = this.overlay.querySelector<HTMLDetailsElement>('#game-forecast');
    if (!panel) {
      panel = document.createElement('details'); panel.id = 'game-forecast'; panel.dataset.ui = 'true';
      panel.innerHTML = '<summary data-forecast-summary></summary><div data-forecast-body></div>';
      this.overlay.appendChild(panel);
    }
    panel.style.top = `${Math.ceil(this.topBar.getBoundingClientRect().bottom + 8)}px`;
    this.overlay.style.setProperty('--hud-bottom',panel.style.top);
    panel.querySelector('summary')!.innerHTML = `${iconMarkup('home')} Winter plan${data.hasWard?` · ${data.herbs}/${data.herbCapacity} herbs`:''} · ${data.coats}/${data.population} coats`;
    const seconds = data.nextHarvestSeconds === null ? 'No growing crops' : Number.isFinite(data.nextHarvestSeconds) ? `${Math.ceil(data.nextHarvestSeconds)}s to ripen` : 'Too late: crops will die in winter';
    panel.querySelector('[data-forecast-body]')!.innerHTML = `
      <div><b>Food for winter</b><span>${Math.ceil(data.winterFood - 1e-8)} · reserve goal ${Math.ceil(data.reserve - 1e-8)}</span></div>
      <div><b>Winter firewood</b><span>${Math.ceil(data.heatingWoodNeeded-1e-8)} wood for ${data.heatedShelters} shelter(s) · ${getConfig().heating.woodPerShelterPerWinter} each per full winter</span></div>
      <div><b>Firewood balance</b><span class="${data.woodBalance<0?'forecast-danger':''}">${data.woodBalance>=0?'+':''}${Math.floor(data.woodBalance+1e-8)} wood${data.unheatedShelters?' · shelters are unheated':''}</span></div>
      <div><b>Food before winter</b><span>${Math.ceil(data.beforeFood - 1e-8)} consumed</span></div>
      <div><b>Standing harvests</b><span>+${Math.round(data.expectedHarvest)} expected · ${seconds}</span></div>
      <div><b>Balance by spring</b><span class="${data.springBalance < 0 ? 'forecast-danger' : ''}">${data.springBalance >= 0 ? '+' : ''}${Math.floor(data.springBalance + 1e-8)} food</span></div>
      ${data.hasWard?`<div><b>Protective herbs</b><span>${data.herbs}/${data.herbCapacity} stored · ${data.herbsInTransit} carried · ${data.herbsNeeded} needed</span></div>
      <div><b>Ward fuel</b><span>${Math.floor(data.wardSeconds)}s of winter protection</span></div>`:''}
      <div><b>Fur clothing</b><span>${data.coats}/${data.population} wearing · ${data.coatsStored} spare</span></div>
      <div><b>Cold danger</b><span class="${data.exposed ? 'forecast-danger' : ''}">${data.exposed} residents freezing · uncoated limit ${getConfig().cold.unclothedSurvivalSeconds}s outdoors</span></div>
      <div><b>Next winter reward</b><span>${data.nextStars} research star(s)</span></div>
      <p>Current population and assigned crops; future expeditions are excluded. Harvests require farmers and storage space.</p>`;
  }

  closeForecast(): void { const panel=this.overlay.querySelector<HTMLDetailsElement>('#game-forecast');if(panel)panel.open=false; }

  updateWarnings(warnings: SettlementWarning[]): void { this.notifications.updateWarnings(warnings); }

  updateStatus(data: { mode: string; shelter: boolean; season: Season; secondsLeft: number; foodSeconds: number; idle: number; enemies: number; paused: boolean; clearingQueued:number }): void {
    const title = data.paused ? 'Time to make a plan' : data.shelter ? 'Safe by the hearth' : data.mode === 'clear' ? 'Make room for your village' : data.mode === 'build' ? 'Find a place to call home' : 'A little care goes a long way';
    const detail = data.mode === 'clear' ? `${data.clearingQueued} trees queued · Tap trees to add · Clear / Esc / right-click to finish` : data.mode === 'build' ? 'Tap a green footprint to place · Esc or right-click to cancel' :
      `${data.secondsLeft}s of ${data.season} left · ${data.idle} free villagers · Food for ${data.foodSeconds}s${data.enemies ? ` · ${data.enemies} in the woods` : ''} · Tap a villager to give orders`;
    this.statusEl.innerHTML = `<span class="status-dot ${data.shelter ? 'sheltered' : ''}"></span><div><strong>${title}</strong><small>${detail}</small></div>`;
    this.overlay.dataset.mode = data.mode;
    const shelterState = String(data.shelter);
    if (this.shelterBtn.dataset.active !== shelterState) {
      setButtonContent(this.shelterBtn, data.shelter ? 'Resume' : 'Shelter', data.shelter ? 'resume' : 'home');
      this.shelterBtn.dataset.active = shelterState;
    }
    this.shelterBtn.classList.toggle('active-action', data.shelter);
    this.shelterBtn.setAttribute('aria-pressed', shelterState);
    this.overlay.querySelector<HTMLElement>('[data-release-one]')!.hidden=!data.shelter;
    this.layoutBottomBar();
    this.shelterBtn.title = data.shelter ? 'Release everyone and resume their jobs' : 'Call everyone to shelter';
    for (const button of this.overlay.querySelectorAll<HTMLElement>('#game-bottom-bar button')) {
      if (button.hasAttribute('data-global-clear')) {button.classList.toggle('active-action', data.mode === 'clear');button.setAttribute('aria-pressed',String(data.mode==='clear'));}
      if (button.textContent?.includes('Build')) button.classList.toggle('active-action', data.mode === 'build' || this.buildPanelOpen);
    }
  }

  showGameOver(emailSubmitUrl?: string): void {
    this.hideGameOver();
    const overlay = this.el('div', {
      position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
      background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', zIndex: '100',
      color: '#e0d8c8', fontFamily: 'inherit',
    });
    overlay.setAttribute('data-ui', 'true');

    const title = this.el('div', { fontSize: '28px', fontWeight: 'bold', marginBottom: '12px', color: '#c44' });
    title.textContent = 'Game Over';
    overlay.appendChild(title);

    const msg = this.el('div', { fontSize: '16px', marginBottom: '16px', opacity: '0.9' });
    msg.textContent = 'All villagers have perished.';
    overlay.appendChild(msg);

    const subMsg = this.el('div', { fontSize: '15px', marginBottom: '16px', opacity: '0.9', textAlign: 'center', maxWidth: '400px' });
    subMsg.textContent = "If you liked the game — leave your email: when the full version is released, we'll notify you at that address.";
    overlay.appendChild(subMsg);

    const formWrap = this.el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px', gap: '8px' });
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = 'your@email.com';
    emailInput.style.cssText = 'padding:10px 14px; font-size:14px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(40,40,50,0.9); color:#e0d8c8; min-width:220px;';
    formWrap.appendChild(emailInput);

    const submitFeedback = this.el('div', { fontSize: '13px', minHeight: '20px', color: '#9e9' });
    formWrap.appendChild(submitFeedback);

    const submitBtn = this.btn('Submit', async () => {
      const email = (emailInput as HTMLInputElement).value.trim();
      if (!email) {
        submitFeedback.textContent = 'Enter email';
        submitFeedback.style.color = '#c96';
        return;
      }
      if (emailSubmitUrl) {
        try {
          const res = await fetch(emailSubmitUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ email }),
          });
          if (res.ok) {
            submitFeedback.textContent = "Thank you! We'll notify you when the full version is out.";
            submitFeedback.style.color = '#9e9';
            this.callbacks.onEmailSubmitted?.();
          } else {
            submitFeedback.textContent = 'Send failed. Try again later.';
            submitFeedback.style.color = '#c96';
          }
        } catch {
          submitFeedback.textContent = 'Network error. Try again later.';
          submitFeedback.style.color = '#c96';
        }
      } else {
        submitFeedback.textContent = 'Thank you!';
        submitFeedback.style.color = '#9e9';
        this.callbacks.onEmailSubmitted?.();
      }
    });
    submitBtn.style.fontSize = '14px';
    submitBtn.style.padding = '10px 20px';
    formWrap.appendChild(submitBtn);
    overlay.appendChild(formWrap);

    this.appendGameOverButtons(overlay);
    this.overlay.appendChild(overlay);
    this.gameOverOverlay = overlay;
  }

  showDemoEnd(emailSubmitUrl?: string): void {
    this.showEmailForm(emailSubmitUrl, true);
  }

  /**
   * Shows modal to submit email for full version notification (demo end only).
   * @param isDemoEnd If true, title is "Demo End" and shows "Start Over". Otherwise shows "Close".
   */
  showEmailForm(emailSubmitUrl?: string, isDemoEnd = false): void {
    this.hideGameOver();
    const overlay = this.el('div', {
      position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
      background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', zIndex: '100',
      color: '#e0d8c8', fontFamily: 'inherit',
    });
    overlay.setAttribute('data-ui', 'true');

    const title = this.el('div', { fontSize: '28px', fontWeight: 'bold', marginBottom: '12px', color: '#ffe0a0' });
    title.textContent = isDemoEnd ? 'Demo End' : 'Leave your email';
    overlay.appendChild(title);

    const msg = this.el('div', { fontSize: '16px', marginBottom: '8px', opacity: '0.9', textAlign: 'center', maxWidth: '400px' });
    if (isDemoEnd) {
      msg.textContent = "You survived 8 winters. Thanks for playing!";
      overlay.appendChild(msg);
    }

    const subMsg = this.el('div', { fontSize: '15px', marginBottom: '20px', opacity: '0.9', textAlign: 'center', maxWidth: '400px' });
    subMsg.textContent = "If you liked the game — leave your email: when the full version is released, you'll get a notification at that address.";
    overlay.appendChild(subMsg);

    const formWrap = this.el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px', gap: '8px' });
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = 'your@email.com';
    emailInput.style.cssText = 'padding:10px 14px; font-size:14px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(40,40,50,0.9); color:#e0d8c8; min-width:220px;';
    formWrap.appendChild(emailInput);

    const submitFeedback = this.el('div', { fontSize: '13px', minHeight: '20px', color: '#9e9' });
    formWrap.appendChild(submitFeedback);

    const submitBtn = this.btn('Submit', async () => {
      const email = (emailInput as HTMLInputElement).value.trim();
      if (!email) {
        submitFeedback.textContent = 'Enter email';
        submitFeedback.style.color = '#c96';
        return;
      }
      if (emailSubmitUrl) {
        try {
          const res = await fetch(emailSubmitUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ email }),
          });
          if (res.ok) {
            submitFeedback.textContent = "Thank you! We'll notify you when the full version is out.";
            submitFeedback.style.color = '#9e9';
            this.callbacks.onEmailSubmitted?.();
          } else {
            submitFeedback.textContent = 'Send failed. Try again later.';
            submitFeedback.style.color = '#c96';
          }
        } catch {
          submitFeedback.textContent = 'Network error. Try again later.';
          submitFeedback.style.color = '#c96';
        }
      } else {
        submitFeedback.textContent = 'Thank you!';
        submitFeedback.style.color = '#9e9';
        this.callbacks.onEmailSubmitted?.();
      }
    });
    submitBtn.style.fontSize = '14px';
    submitBtn.style.padding = '10px 20px';
    formWrap.appendChild(submitBtn);
    overlay.appendChild(formWrap);

    if (isDemoEnd) {
      const restartBtn = this.btn('Start Over', () => this.callbacks.onRestart(), 'restart');
      restartBtn.style.fontSize = '14px';
      restartBtn.style.padding = '10px 20px';
      overlay.appendChild(restartBtn);
    } else {
      const closeBtn = this.btn('Close', () => this.hideGameOver(), 'close');
      closeBtn.style.fontSize = '14px';
      closeBtn.style.padding = '10px 20px';
      overlay.appendChild(closeBtn);
    }

    this.overlay.appendChild(overlay);
    this.gameOverOverlay = overlay;
  }

  private appendGameOverButtons(overlay: HTMLElement): void {
    const loadBtn = this.btn('Load game', () => this.callbacks.onLoad(), 'load');
    loadBtn.style.fontSize = '14px';
    loadBtn.style.padding = '10px 20px';
    loadBtn.style.marginBottom = '8px';
    overlay.appendChild(loadBtn);

    const restartBtn = this.btn('Start Over', () => this.callbacks.onRestart(), 'restart');
    restartBtn.style.fontSize = '14px';
    restartBtn.style.padding = '10px 20px';
    overlay.appendChild(restartBtn);
  }

  hideGameOver(): void {
    if (this.gameOverOverlay && this.gameOverOverlay.parentNode) {
      this.gameOverOverlay.parentNode.removeChild(this.gameOverOverlay);
      this.gameOverOverlay = null;
    }
  }

  private el(tag: string, styles: Record<string, string> = {}): HTMLElement {
    const e = document.createElement(tag);
    Object.assign(e.style, styles);
    e.style.color = '#e0d8c8';
    return e;
  }

  private btn(label: string, onClick: () => void, icon?: IconName): HTMLElement {
    const b = this.el('button', {
      padding: '6px 12px', background: 'rgba(60,60,80,0.9)',
      border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px',
      color: '#e0d8c8', cursor: 'pointer', fontSize: '12px',
      fontFamily: 'inherit',
    });
    setButtonContent(b, label, icon);
    b.setAttribute('data-ui', 'true');
    b.addEventListener('click', onClick);
    b.addEventListener('mouseenter', () => b.style.background = 'rgba(80,80,100,0.9)');
    b.addEventListener('mouseleave', () => b.style.background = 'rgba(60,60,80,0.9)');
    return b;
  }
}
