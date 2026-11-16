/** One shared tooltip for hover, keyboard focus and tapping informational counters.
 * Anchors stay in the DOM when their values update, so hovering does not flicker. */
export class TooltipController {
  private popup: HTMLElement;
  private anchor: HTMLElement | null = null;
  constructor(private root: HTMLElement, parent: HTMLElement) {
    this.popup = document.createElement('div'); this.popup.id = 'topbar-tooltip';
    this.popup.setAttribute('role', 'tooltip'); this.popup.hidden = true; parent.appendChild(this.popup);
    root.addEventListener('pointerover', e => this.show((e.target as HTMLElement).closest<HTMLElement>('[data-tooltip]')));
    root.addEventListener('pointerleave', () => this.hide());
    root.addEventListener('focusin', e => this.show((e.target as HTMLElement).closest<HTMLElement>('[data-tooltip]')));
    root.addEventListener('focusout', e => { if (!root.contains((e as FocusEvent).relatedTarget as Node)) this.hide(); });
    root.addEventListener('click', e => {
      const anchor = (e.target as HTMLElement).closest<HTMLElement>('[data-tooltip]');
      if (anchor?.matches('[data-stat]')) this.show(anchor);
      else this.hide();
    });
    document.addEventListener('pointerdown', e => { if (!root.contains(e.target as Node)) this.hide(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.hide(); });
    window.addEventListener('resize', () => this.hide());
  }
  refresh(): void { if (this.anchor) this.show(this.anchor); }
  private show(anchor: HTMLElement | null): void {
    if (!anchor || !this.root.contains(anchor)) { this.hide(); return; }
    if (this.anchor !== anchor) this.anchor?.removeAttribute('aria-describedby');
    this.anchor = anchor; anchor.setAttribute('aria-describedby', this.popup.id);
    this.popup.replaceChildren();
    const title = document.createElement('strong'); title.textContent = anchor.dataset.tooltipTitle ?? anchor.getAttribute('aria-label') ?? '';
    const body = document.createElement('span'); body.textContent = anchor.dataset.tooltip ?? '';
    this.popup.append(title, body); this.popup.hidden = false;
    const r = anchor.getBoundingClientRect(), box = this.popup.getBoundingClientRect();
    this.popup.style.left = `${Math.max(8, Math.min(innerWidth - box.width - 8, r.x + r.width / 2 - box.width / 2))}px`;
    this.popup.style.top = `${Math.min(innerHeight - box.height - 8, this.root.getBoundingClientRect().bottom + 10)}px`;
  }
  private hide(): void { this.popup.hidden = true; this.anchor?.removeAttribute('aria-describedby'); this.anchor = null; }
}
