export interface TutorialStep {
  target: HTMLElement;
  text: string;
  durationMs: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export class TutorialOverlay {
  private root: HTMLDivElement;
  private svgDefs: SVGSVGElement;
  private maskHoleRect: SVGRectElement;
  private backdrop: HTMLDivElement;
  private highlight: HTMLDivElement;
  private tooltip: HTMLDivElement;
  private running = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.setAttribute('data-tutorial-overlay', 'true');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '200',
      pointerEvents: 'auto',
    });
    this.root.addEventListener('click', (e) => e.stopPropagation(), { capture: true });

    // SVG mask defs (in-DOM so CSS can reference by id).
    this.svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement;
    this.svgDefs.setAttribute('width', '0');
    this.svgDefs.setAttribute('height', '0');
    this.svgDefs.style.position = 'absolute';
    this.svgDefs.style.left = '0';
    this.svgDefs.style.top = '0';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.setAttribute('id', 'tutorial-mask');
    mask.setAttribute('maskUnits', 'objectBoundingBox');
    mask.setAttribute('maskContentUnits', 'userSpaceOnUse');

    const white = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    white.setAttribute('x', '0');
    white.setAttribute('y', '0');
    white.setAttribute('width', '100%');
    white.setAttribute('height', '100%');
    white.setAttribute('fill', 'white');

    this.maskHoleRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.maskHoleRect.setAttribute('x', '0');
    this.maskHoleRect.setAttribute('y', '0');
    this.maskHoleRect.setAttribute('width', '0');
    this.maskHoleRect.setAttribute('height', '0');
    this.maskHoleRect.setAttribute('rx', '10');
    this.maskHoleRect.setAttribute('ry', '10');
    this.maskHoleRect.setAttribute('fill', 'black');

    mask.appendChild(white);
    mask.appendChild(this.maskHoleRect);
    defs.appendChild(mask);
    this.svgDefs.appendChild(defs);
    this.root.appendChild(this.svgDefs);

    this.backdrop = document.createElement('div');
    this.backdrop.setAttribute('data-ui', 'true');
    Object.assign(this.backdrop.style, {
      position: 'absolute',
      inset: '0',
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(2px)',
      WebkitBackdropFilter: 'blur(2px)',
      pointerEvents: 'auto',
      // Mask out the spotlight hole.
      mask: 'url(#tutorial-mask)',
      WebkitMask: 'url(#tutorial-mask)',
    } as Partial<CSSStyleDeclaration>);
    this.root.appendChild(this.backdrop);

    this.highlight = document.createElement('div');
    this.highlight.setAttribute('data-ui', 'true');
    Object.assign(this.highlight.style, {
      position: 'absolute',
      borderRadius: '10px',
      border: '2px solid rgba(255,224,160,0.95)',
      boxShadow: '0 0 0 2px rgba(0,0,0,0.35), 0 0 26px rgba(255,224,160,0.45)',
      pointerEvents: 'none',
      transition: 'left 120ms ease, top 120ms ease, width 120ms ease, height 120ms ease',
    });
    this.root.appendChild(this.highlight);

    this.tooltip = document.createElement('div');
    this.tooltip.setAttribute('data-ui', 'true');
    Object.assign(this.tooltip.style, {
      position: 'absolute',
      maxWidth: '340px',
      padding: '12px 14px',
      background: 'rgba(25,25,45,0.95)',
      border: '1px solid rgba(255,255,255,0.14)',
      borderRadius: '10px',
      color: '#e0d8c8',
      fontSize: '15px',
      lineHeight: '1.35',
      boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
      pointerEvents: 'none',
      textAlign: 'left',
    });
    this.root.appendChild(this.tooltip);

    parent.appendChild(this.root);
    this.hide();
  }

  isRunning(): boolean {
    return this.running;
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  async run(steps: TutorialStep[]): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.root.style.display = 'block';
    document.documentElement.classList.add('tutorial-active');

    const onResize = () => {
      // Re-apply current step positioning on resize; next step will correct anyway.
      // Intentionally no-op placeholder; positioning is updated per-step and in rAF below.
    };
    window.addEventListener('resize', onResize);

    try {
      for (const step of steps) {
        await this.showStep(step);
      }
    } finally {
      window.removeEventListener('resize', onResize);
      this.hide();
      this.running = false;
      document.documentElement.classList.remove('tutorial-active');
    }
  }

  private async showStep(step: TutorialStep): Promise<void> {
    this.tooltip.textContent = step.text;

    const pad = 8;
    const applyPositions = () => {
      const r = step.target.getBoundingClientRect();
      const x = Math.max(0, r.left - pad);
      const y = Math.max(0, r.top - pad);
      const w = Math.min(window.innerWidth - x, r.width + pad * 2);
      const h = Math.min(window.innerHeight - y, r.height + pad * 2);

      this.maskHoleRect.setAttribute('x', String(x));
      this.maskHoleRect.setAttribute('y', String(y));
      this.maskHoleRect.setAttribute('width', String(w));
      this.maskHoleRect.setAttribute('height', String(h));
      this.maskHoleRect.setAttribute('rx', '10');
      this.maskHoleRect.setAttribute('ry', '10');

      Object.assign(this.highlight.style, {
        left: `${x}px`,
        top: `${y}px`,
        width: `${w}px`,
        height: `${h}px`,
      });

      // Tooltip placement: prefer below, fallback above, clamp to viewport.
      const margin = 12;
      const ttW = 340;
      const ttX = clamp(r.left, margin, window.innerWidth - margin - ttW);
      const belowY = r.bottom + 14;
      const aboveY = r.top - 14;
      const placeBelow = belowY + 64 < window.innerHeight; // approx height
      const ttY = placeBelow ? belowY : Math.max(margin, aboveY - 70);

      Object.assign(this.tooltip.style, {
        left: `${ttX}px`,
        top: `${ttY}px`,
      });
    };

    // Two frames to let layout settle after UI updates.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    applyPositions();

    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), step.durationMs);
    });
  }
}

