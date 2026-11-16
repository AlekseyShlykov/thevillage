import { Camera } from '../core/Camera';
export interface InputState {
  mouseX: number; mouseY: number; worldX: number; worldY: number;
  tileX: number; tileY: number; clicked: boolean; rightClicked: boolean; isDragging: boolean;
}
/** CSS pixels are used throughout input, independent of the canvas backing resolution. */
export class InputManager {
  private _state: InputState = { mouseX: -1, mouseY: -1, worldX: 0, worldY: 0, tileX: -1, tileY: -1, clicked: false, rightClicked: false, isDragging: false };
  private pointers = new Map<number, { x: number; y: number }>();
  private origin = { x: 0, y: 0, cx: 0, cy: 0 };
  private dragged = false;
  private pinchDistance = 0;
  constructor(private canvas: HTMLCanvasElement, private camera: Camera) {
    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      const p = this.pos(e); this.pointers.set(e.pointerId, p); this.update(p.x, p.y);
      this.origin = { ...p, cx: camera.x, cy: camera.y }; this.dragged = false;
      if (this.pointers.size > 1) { this.dragged = true; this.pinchDistance = this.distance(); }
    });
    canvas.addEventListener('pointermove', e => {
      const p = this.pos(e);
      if (this.pointers.has(e.pointerId)) {
        this.pointers.set(e.pointerId, p);
        if (this.pointers.size > 1) {
          const d = this.distance(), ps = [...this.pointers.values()];
          if (this.pinchDistance) camera.setZoom(camera.zoom * d / this.pinchDistance, (ps[0].x + ps[1].x) / 2, (ps[0].y + ps[1].y) / 2);
          this.pinchDistance = d; this.dragged = true;
        } else {
          const dx = p.x - this.origin.x, dy = p.y - this.origin.y;
          if (Math.hypot(dx, dy) > (e.pointerType === 'touch' ? 10 : 5)) this.dragged = true;
          if (this.dragged) { camera.x = this.origin.cx - dx; camera.y = this.origin.cy - dy; camera.clamp(); }
        }
      }
      this._state.isDragging = this.dragged && this.pointers.size > 0;
      this.update(p.x, p.y);
    });
    canvas.addEventListener('pointerup', e => {
      if (!this.pointers.has(e.pointerId)) return;
      const p = this.pos(e); this.update(p.x, p.y);
      if (!this.dragged && this.pointers.size === 1) this._state.clicked = true;
      this.pointers.delete(e.pointerId); this._state.isDragging = false;
      if (this.pointers.size === 1) { const remaining = [...this.pointers.values()][0]; this.origin = { ...remaining, cx: camera.x, cy: camera.y }; }
      if (!this.pointers.size) { this.dragged = false; this.pinchDistance = 0; }
    });
    canvas.addEventListener('pointercancel', e => { this.pointers.delete(e.pointerId); this._state.isDragging = false; this.dragged = true; });
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); const p = this.pos(e); this.update(p.x, p.y); this._state.rightClicked = true; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); const p = this.pos(e); camera.setZoom(camera.zoom * Math.exp(-e.deltaY * 0.001), p.x, p.y); this.update(p.x, p.y); }, { passive: false });
  }
  private pos(e: { clientX: number; clientY: number }) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  private distance() { const p = [...this.pointers.values()]; return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }
  private update(x: number, y: number) {
    const world = this.camera.screenToWorld(x, y), tile = this.camera.screenToTile(x, y);
    Object.assign(this._state, { mouseX: x, mouseY: y, worldX: world.x, worldY: world.y, tileX: tile.tx, tileY: tile.ty });
  }
  reset(): void {
    this.pointers.clear(); this.dragged = false; this.pinchDistance = 0;
    Object.assign(this._state, { clicked: false, rightClicked: false, isDragging: false, tileX: -1, tileY: -1, mouseX: -1, mouseY: -1 });
  }
  get state(): InputState { return this._state; }
  consumeClick(): boolean { const v = this._state.clicked; this._state.clicked = false; return v; }
  consumeRightClick(): boolean { const v = this._state.rightClicked; this._state.rightClicked = false; return v; }
}
