import { ResourceState, Season, BuildingConfig, TechConfig } from '../types';

export interface UICallbacks {
  onSpeedChange: (speed: number) => void;
  onBuildSelect: (buildingId: string) => void;
  onBuildCancel: () => void;
  onBuildPanelOpen?: () => void;
  onDemolish: () => void;
  onTechUnlock: (techId: string) => void;
  onSave: () => void;
  onLoad: () => void;
  onToggleClearMode: () => void;
  onGoHunting: () => void;
  onSendAllToChop: () => void;
  onReturnHome: () => void;
  onLeaveShelter: () => void;
  onRepairAll: () => void;
  onRestart: () => void;
  onSoundToggle?: () => void;
  onEmailSubmitted?: () => void;
}

export class UIManager {
  private overlay: HTMLElement;
  private topBar!: HTMLElement;
  private topBarStatsDiv!: HTMLElement;
  private topBarTechBtn!: HTMLElement;
  private topBarRightDiv!: HTMLElement;
  private soundBtn!: HTMLButtonElement;
  private speedButtons: HTMLElement[] = [];
  private buildPanel!: HTMLElement;
  private techPanel!: HTMLElement;
  private infoPanel!: HTMLElement;
  private notificationEl!: HTMLElement;
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
    this.topBar.addEventListener('click', (e) => {
      const el = e.target instanceof HTMLElement ? e.target : (e.target as Node).parentElement;
      const target = el?.closest?.('[data-tech-btn],[data-save-btn],[data-load-btn]') as HTMLElement | null;
      if (!target) return;
      if (target.hasAttribute('data-tech-btn')) this.toggleTechPanel();
      else if (target.hasAttribute('data-save-btn')) this.callbacks.onSave();
      else if (target.hasAttribute('data-load-btn')) this.callbacks.onLoad();
    });
    this.topBarStatsDiv = this.el('div', { display: 'flex', alignItems: 'center', gap: '16px' });
    this.topBarStatsDiv.setAttribute('data-topbar-stats', 'true');
    this.topBar.appendChild(this.topBarStatsDiv);
    this.topBarTechBtn = this.el('button', {
      marginLeft: '4px', padding: '4px 10px', background: 'rgba(60,60,80,0.9)',
      border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#e0d8c8',
      cursor: 'pointer', fontSize: '12px',
    }) as HTMLButtonElement;
    this.topBarTechBtn.setAttribute('data-tech-btn', 'true');
    this.topBarTechBtn.textContent = '📖 Tech';
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
    this.soundBtn.textContent = '🔊';
    this.soundBtn.addEventListener('click', () => this.callbacks.onSoundToggle?.());
    this.topBarRightDiv.appendChild(this.soundBtn);
    const saveBtn = this.btn('💾 Save', () => this.callbacks.onSave());
    saveBtn.setAttribute('data-save-btn', 'true');
    this.topBarRightDiv.appendChild(saveBtn);
    const loadBtn = this.btn('📂 Load', () => this.callbacks.onLoad());
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
      { label: '⏸', speed: 0 },
      { label: '1×', speed: 1 },
      { label: '2×', speed: 2 },
      { label: '4×', speed: 4 },
    ];
    for (const s of speeds) {
      const btn = this.btn(s.label, () => this.callbacks.onSpeedChange(s.speed));
      btn.setAttribute('data-speed', String(s.speed));
      this.speedButtons.push(btn);
      bottomBar.appendChild(btn);
    }

    const clearBtn = this.btn('🪓 Clear', () => this.callbacks.onToggleClearMode());
    bottomBar.appendChild(clearBtn);

    const huntBtn = this.btn('🦌 Hunt', () => this.callbacks.onGoHunting());
    bottomBar.appendChild(huntBtn);

    const buildBtn = this.btn('🏗 Build', () => this.toggleBuildPanel());
    bottomBar.appendChild(buildBtn);

    const returnHomeBtn = this.btn('🏠 To shelter', () => this.callbacks.onReturnHome());
    bottomBar.appendChild(returnHomeBtn);

    const leaveShelterBtn = this.btn('🚪 Leave shelter', () => this.callbacks.onLeaveShelter());
    leaveShelterBtn.setAttribute('data-leave-shelter-btn', 'true');
    bottomBar.appendChild(leaveShelterBtn);

    const repairBtn = this.btn('🔧 Repair all', () => this.callbacks.onRepairAll());
    repairBtn.setAttribute('data-repair-btn', 'true');
    bottomBar.appendChild(repairBtn);

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

    this.notificationEl = this.el('div', {
      position: 'absolute', bottom: '52px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(40,40,60,0.95)', padding: '8px 20px', borderRadius: '6px',
      fontSize: '14px', display: 'none', zIndex: '20', textAlign: 'center',
      border: '1px solid rgba(255,200,100,0.3)', color: '#ffe0a0',
    });
    this.notificationEl.setAttribute('data-notification-el', 'true');
    this.overlay.appendChild(this.notificationEl);
  }

  /** Show context menu with actions for selected villager at (screenX, screenY). */
  showActionMenu(screenX: number, screenY: number, actions: { label: string; callback: () => void }[]): void {
    this.hideActionMenu();
    if (actions.length === 0) return;

    const backdrop = this.el('div', {
      position: 'fixed',
      left: '0', top: '0', right: '0', bottom: '0',
      zIndex: '29',
      background: 'transparent',
    });
    backdrop.setAttribute('data-ui', 'true');
    backdrop.addEventListener('click', () => this.hideActionMenu());
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
      });
      btn.style.width = '100%';
      btn.style.marginBottom = '2px';
      btn.style.textAlign = 'left';
      menu.appendChild(btn);
    }

    const cancel = this.btn('Cancel', () => this.hideActionMenu());
    cancel.style.width = '100%';
    cancel.style.marginTop = '4px';
    menu.appendChild(cancel);

    this.overlay.appendChild(menu);
    this.actionMenuEl = menu;
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
  }): void {
    const seasonColors: Record<string, string> = {
      spring: '#7ec87e', summer: '#d4c45a', autumn: '#c87a3e', winter: '#8ab4e8',
    };
    const sc = seasonColors[data.season] || '#aaa';
    const pct = Math.round(data.seasonProgress * 100);
    const foodStyle = data.foodLow ? ' style="color:#e66;font-weight:bold"' : '';

    this.topBarStatsDiv.innerHTML =
      `<span>🪵 ${Math.floor(data.resources.wood)}</span>` +
      `<span${foodStyle}>🍖 ${Math.floor(data.resources.food)}</span>` +
      `<span>🧥 ${Math.floor(data.resources.fur)}</span>` +
      `<span>🔧 ${Math.floor(data.resources.tools)}</span>` +
      `<span style="color:${sc}">${data.season.charAt(0).toUpperCase() + data.season.slice(1)} Y${data.year}</span>` +
      `<span style="display:inline-block;width:80px;height:6px;background:#333;border-radius:3px;overflow:hidden;vertical-align:middle" data-season-bar>` +
        `<span style="display:block;width:${pct}%;height:100%;background:${sc};border-radius:3px"></span>` +
      `</span>` +
      `<span>😊 ${Math.round(data.comfort * 100)}%</span>` +
      `<span>👥 ${data.population}/${data.housing}</span>` +
      `<span>Lv${data.level}</span>` +
      `<span>⭐ ${Math.floor(data.resources.techPoints)}</span>`;

    this.soundBtn.textContent = data.soundOn !== false ? '🔊' : '🔇';

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

  updateBuildPanel(buildings: Record<string, BuildingConfig>, unlockedIds: Set<string>, canAfford: (wood: number, tools: number) => boolean, maxBuildingTier = 2): void {
    this.buildPanel.innerHTML = '<div style="font-size:14px;font-weight:bold;margin-bottom:8px;color:#ffe0a0">Build Menu</div>';

    const cancelBtn = this.btn('Cancel', () => this.callbacks.onBuildCancel());
    cancelBtn.style.width = '100%';
    cancelBtn.style.marginBottom = '8px';
    this.buildPanel.appendChild(cancelBtn);

    for (const [id, cfg] of Object.entries(buildings)) {
      if (!unlockedIds.has(id)) continue;
      if (cfg.tier > maxBuildingTier) continue;
      const affordable = canAfford(cfg.costWood, cfg.costTools);
      const item = this.el('div', {
        padding: '6px', marginBottom: '4px', borderRadius: '4px',
        background: affordable ? 'rgba(60,60,80,0.8)' : 'rgba(40,40,50,0.5)',
        cursor: affordable ? 'pointer' : 'default',
        opacity: affordable ? '1' : '0.5',
        border: '1px solid rgba(255,255,255,0.05)',
      });
      item.setAttribute('data-building-id', id);
      item.setAttribute('data-affordable', affordable ? 'true' : 'false');
      item.setAttribute('data-ui', 'true');
      item.innerHTML = `
        <div style="font-weight:bold;font-size:12px">${cfg.name}</div>
        <div style="font-size:10px;opacity:0.7">${cfg.description}</div>
        <div style="font-size:10px;margin-top:2px">🪵${cfg.costWood} 🔧${cfg.costTools} | ${cfg.width}×${cfg.height}</div>
      `;
      this.buildPanel.appendChild(item);
    }
  }

  updateTechPanel(
    available: TechConfig[],
    unlocked: Set<string>,
    techPoints: number,
    currentLevel: number,
  ): void {
    this.techPanel.innerHTML = `
      <div style="font-size:14px;font-weight:bold;margin-bottom:4px;color:#ffe0a0">Technology Tree</div>
      <div style="font-size:11px;margin-bottom:8px;opacity:0.7">Tech Points: ⭐${Math.floor(techPoints)} | Level ${currentLevel}</div>
    `;

    if (unlocked.size > 0) {
      const unlockedDiv = this.el('div', { marginBottom: '8px' });
      unlockedDiv.innerHTML = '<div style="font-size:11px;opacity:0.5;margin-bottom:4px">Unlocked:</div>';
      for (const id of unlocked) {
        const d = this.el('div', { fontSize: '11px', opacity: '0.6', padding: '2px 0' });
        d.textContent = `✓ ${id}`;
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
        <div style="font-weight:bold;font-size:12px">${tech.name} <span style="opacity:0.5">T${tech.tier}</span></div>
        <div style="font-size:10px;opacity:0.7">${tech.description}</div>
        <div style="font-size:10px;margin-top:2px">Cost: ⭐${tech.cost}</div>
      `;
      if (canAfford) {
        item.addEventListener('click', () => this.callbacks.onTechUnlock(tech.id));
      }
      this.techPanel.appendChild(item);
    }
  }

  showInfo(lines: string[]): void {
    this.infoPanel.style.display = 'block';
    this.infoPanel.innerHTML = lines.map(l => `<div style="margin-bottom:2px">${l}</div>`).join('');
  }

  hideInfo(): void {
    this.infoPanel.style.display = 'none';
  }

  notify(message: string, duration = 3000): void {
    this.notificationEl.textContent = message;
    this.notificationEl.style.display = 'block';
    setTimeout(() => {
      this.notificationEl.style.display = 'none';
    }, duration);
  }

  private toggleBuildPanel(): void {
    this.buildPanelOpen = !this.buildPanelOpen;
    this.buildPanel.style.display = this.buildPanelOpen ? 'block' : 'none';
    if (this.buildPanelOpen) {
      this.techPanelOpen = false;
      this.techPanel.style.display = 'none';
      this.callbacks.onBuildPanelOpen?.();
    }
  }

  private toggleTechPanel(): void {
    this.techPanelOpen = !this.techPanelOpen;
    this.techPanel.style.display = this.techPanelOpen ? 'block' : 'none';
    if (this.techPanelOpen) {
      this.buildPanelOpen = false;
      this.buildPanel.style.display = 'none';
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
      const restartBtn = this.btn('🔄 Start Over', () => this.callbacks.onRestart());
      restartBtn.style.fontSize = '14px';
      restartBtn.style.padding = '10px 20px';
      overlay.appendChild(restartBtn);
    } else {
      const closeBtn = this.btn('Close', () => this.hideGameOver());
      closeBtn.style.fontSize = '14px';
      closeBtn.style.padding = '10px 20px';
      overlay.appendChild(closeBtn);
    }

    this.overlay.appendChild(overlay);
    this.gameOverOverlay = overlay;
  }

  private appendGameOverButtons(overlay: HTMLElement): void {
    const loadBtn = this.btn('📂 Load game', () => this.callbacks.onLoad());
    loadBtn.style.fontSize = '14px';
    loadBtn.style.padding = '10px 20px';
    loadBtn.style.marginBottom = '8px';
    overlay.appendChild(loadBtn);

    const restartBtn = this.btn('🔄 Start Over', () => this.callbacks.onRestart());
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

  private btn(label: string, onClick: () => void): HTMLElement {
    const b = this.el('button', {
      padding: '6px 12px', background: 'rgba(60,60,80,0.9)',
      border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px',
      color: '#e0d8c8', cursor: 'pointer', fontSize: '12px',
      fontFamily: 'inherit',
    });
    b.textContent = label;
    b.setAttribute('data-ui', 'true');
    b.addEventListener('click', onClick);
    b.addEventListener('mouseenter', () => b.style.background = 'rgba(80,80,100,0.9)');
    b.addEventListener('mouseleave', () => b.style.background = 'rgba(60,60,80,0.9)');
    return b;
  }
}
