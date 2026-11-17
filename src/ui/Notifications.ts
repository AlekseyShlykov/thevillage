import { SettlementWarning } from '../systems/WarningSystem';
import { iconMarkup, setButtonContent } from './icons';

export type NoticePriority = 'routine' | 'important';

/** Dismissals last for one danger episode; an escalation or a resolved/new danger is shown again. */
export class Notifications {
  private toast = document.createElement('div');
  private toastMessage = document.createElement('span');
  private cold = document.createElement('div');
  private coldMessage = document.createElement('span');
  private warnings = document.createElement('div');
  private dismissed = new Map<string, boolean>();
  private current: SettlementWarning[] = [];
  private timer = 0;
  private researchOpen = document.createElement('button');
  private researchPending = false;
  private compact = window.matchMedia('(max-width: 900px), (pointer: coarse)');
  private toastPriority: NoticePriority = 'important';

  constructor(private overlay: HTMLElement,onOpenTech:()=>void) {
    this.toast.dataset.notificationEl = 'true'; this.toast.hidden = true;
    this.toast.setAttribute('role', 'status'); this.toast.setAttribute('aria-live', 'polite');
    this.toastMessage.dataset.noticeMessage = 'true';
    this.researchOpen.type='button';this.researchOpen.hidden=true;this.researchOpen.dataset.researchOpen='true';this.researchOpen.dataset.ui='true';
    setButtonContent(this.researchOpen,'Open Tech','book');
    this.researchOpen.addEventListener('click',()=>{this.hideToast();onOpenTech();});
    this.toast.append(this.toastMessage,this.researchOpen,this.closeButton('notification', () => this.hideToast()));
    this.cold.id = 'cold-warning'; this.cold.hidden = true;
    this.cold.setAttribute('role', 'alert'); this.cold.setAttribute('aria-live', 'assertive');
    this.coldMessage.dataset.noticeMessage = 'true';
    this.cold.append(this.coldMessage, this.closeButton('cold', () => this.dismissWarning('cold')));
    this.warnings.id = 'settlement-warnings'; this.warnings.hidden = true;
    this.warnings.setAttribute('role', 'status'); this.warnings.setAttribute('aria-live', 'polite');
    overlay.append(this.toast, this.cold, this.warnings);
    this.compact.addEventListener('change', () => {
      if (this.compact.matches && this.toastPriority === 'routine' && !this.researchPending) this.hideToast();
      this.updateWarnings(this.current);
    });
  }

  private closeButton(id: string, close: () => void): HTMLButtonElement {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'notice-close icon-button icon-only'; button.dataset.dismissNotice = id;
    setButtonContent(button, id === 'notification' ? 'Dismiss notification' : 'Dismiss warning', 'close');
    button.addEventListener('pointerdown', e => e.stopPropagation());
    button.addEventListener('click', e => { e.stopPropagation(); close(); });
    return button;
  }

  private hideToast(): void {
    window.clearTimeout(this.timer);this.toast.hidden=true;
    this.researchPending=false;this.researchOpen.hidden=true;delete this.toast.dataset.researchAward;
    this.updateWarnings(this.current);
  }
  notify(message: string, duration: number, priority: NoticePriority = 'important'): void {
    if(this.researchPending || (this.compact.matches && priority === 'routine'))return;
    this.toastPriority = priority;
    window.clearTimeout(this.timer); this.toastMessage.textContent = message; this.toast.hidden = false;
    this.timer = window.setTimeout(() => { this.toast.hidden = true; }, duration);
  }

  /** Winter rewards stay visible until dismissed or Tech opens; routine toasts cannot replace them. */
  notifyResearchStars(stars:number):void {
    window.clearTimeout(this.timer);this.researchPending=true;this.researchOpen.hidden=false;
    this.toast.dataset.researchAward='true';this.toast.hidden=false;
    this.toastMessage.textContent=`+${stars} new Tech star${stars===1?'':'s'}! Open Tech to choose a new building.`;
    this.updateWarnings(this.current);
  }
  acknowledgeResearch():void {if(this.researchPending)this.hideToast();}

  private dismissWarning(id: string): void {
    this.dismissed.set(id, !!this.current.find(w => w.id === id)?.urgent);
    this.updateWarnings(this.current);
  }

  updateWarnings(warnings: SettlementWarning[]): void {
    // Also refresh during normal UI ticks: some browsers defer media-query events.
    if (this.compact.matches && this.toastPriority === 'routine' && !this.researchPending && !this.toast.hidden) {
      window.clearTimeout(this.timer); this.toast.hidden = true;
    }
    this.current = warnings;
    for (const [id, wasUrgent] of this.dismissed) {
      const active = warnings.find(w => w.id === id);
      if (!active || (!wasUrgent && active.urgent)) this.dismissed.delete(id);
    }
    const visible = warnings.filter(w => !this.dismissed.has(w.id));
    const danger = visible.find(w => w.id === 'cold'); this.cold.hidden = !danger;
    if (danger && this.coldMessage.textContent !== danger.text) this.coldMessage.textContent = danger.text;
    let ordinary = visible.filter(w => w.id !== 'cold');
    if (this.compact.matches) {
      // One actionable notice at a time. Cold and new research take precedence.
      const order = ['heating', 'food', 'wood', 'coats', 'crops', 'herbs'];
      ordinary = danger || this.researchPending ? [] : ordinary.sort((a, b) =>
        Number(!!b.urgent) - Number(!!a.urgent) || order.indexOf(a.id) - order.indexOf(b.id)).slice(0, 1);
    }
    const key = ordinary.map(w => w.id + Number(!!w.urgent) + w.text).join('|');
    if (this.warnings.dataset.content !== key) {
      this.warnings.replaceChildren(); this.warnings.dataset.content = key;
      for (const warning of ordinary) {
        const item = document.createElement('div'); item.dataset.warning = warning.id;
        if (warning.urgent) item.className = 'warning-urgent';
        item.innerHTML = iconMarkup('warning', true);
        const text = document.createElement('span'); text.textContent = warning.text;
        item.append(text, this.closeButton(warning.id, () => this.dismissWarning(warning.id))); this.warnings.append(item);
      }
    }
    this.warnings.hidden = !ordinary.length;
    this.overlay.style.setProperty('--warnings-height', `${this.warnings.hidden ? 0 : this.warnings.getBoundingClientRect().height}px`);
  }

  reset(): void { this.hideToast(); this.dismissed.clear(); this.updateWarnings([]); }
}
