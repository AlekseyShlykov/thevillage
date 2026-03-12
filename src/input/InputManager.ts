import { Camera } from '../core/Camera';

export interface InputState {
  mouseX: number;
  mouseY: number;
  worldX: number;
  worldY: number;
  tileX: number;
  tileY: number;
  clicked: boolean;
  rightClicked: boolean;
  isDragging: boolean;
}

export class InputManager {
  private camera: Camera;
  private canvas: HTMLCanvasElement;
  private _state: InputState = {
    mouseX: 0,
    mouseY: 0,
    worldX: 0,
    worldY: 0,
    tileX: 0,
    tileY: 0,
    clicked: false,
    rightClicked: false,
    isDragging: false,
  };

  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;
  private isPointerDown = false;
  private dragThreshold = 5;
  private touchDragThreshold = 12;
  private hasDragged = false;
  private isTouchActive = false;

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.setupListeners();
  }

  get state(): InputState {
    return this._state;
  }

  consumeClick(): boolean {
    if (this._state.clicked) {
      this._state.clicked = false;
      return true;
    }
    return false;
  }

  consumeRightClick(): boolean {
    if (this._state.rightClicked) {
      this._state.rightClicked = false;
      return true;
    }
    return false;
  }

  private getCanvasPos(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  private updateWorldPos(canvasX: number, canvasY: number): void {
    this._state.mouseX = canvasX;
    this._state.mouseY = canvasY;
    const world = this.camera.screenToWorld(canvasX, canvasY);
    this._state.worldX = world.x;
    this._state.worldY = world.y;
    const tile = this.camera.screenToTile(canvasX, canvasY);
    this._state.tileX = tile.tx;
    this._state.tileY = tile.ty;
  }

  private setupListeners(): void {
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        const pos = this.getCanvasPos(e.clientX, e.clientY);
        this.startDrag(pos.x, pos.y);
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const pos = this.getCanvasPos(e.clientX, e.clientY);
      this.onMove(pos.x, pos.y);
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        const pos = this.getCanvasPos(e.clientX, e.clientY);
        this.endDrag(pos.x, pos.y, false);
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const pos = this.getCanvasPos(e.clientX, e.clientY);
      this.updateWorldPos(pos.x, pos.y);
      this._state.rightClicked = true;
    });

    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this.isTouchActive = true;
        if (e.touches.length === 1) {
          const t = e.touches[0];
          const pos = this.getCanvasPos(t.clientX, t.clientY);
          this.startDrag(pos.x, pos.y);
        }
      },
      { passive: false }
    );

    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
          const t = e.touches[0];
          const pos = this.getCanvasPos(t.clientX, t.clientY);
          this.onMove(pos.x, pos.y);
        }
      },
      { passive: false }
    );

    this.canvas.addEventListener(
      'touchend',
      (e) => {
        e.preventDefault();
        let x = this._state.mouseX;
        let y = this._state.mouseY;
        if (e.changedTouches && e.changedTouches.length > 0) {
          const t = e.changedTouches[0];
          const pos = this.getCanvasPos(t.clientX, t.clientY);
          x = pos.x;
          y = pos.y;
        }
        this.endDrag(x, y, true);
        this.isTouchActive = false;
      },
      { passive: false }
    );
    this.canvas.addEventListener('touchcancel', () => { this.isTouchActive = false; }, { passive: true });
  }

  private startDrag(x: number, y: number): void {
    this.isPointerDown = true;
    this.hasDragged = false;
    this.dragStartX = x;
    this.dragStartY = y;
    this.cameraStartX = this.camera.x;
    this.cameraStartY = this.camera.y;
    this.updateWorldPos(x, y);
  }

  private onMove(x: number, y: number): void {
    this.updateWorldPos(x, y);
    if (this.isPointerDown) {
      const dx = x - this.dragStartX;
      const dy = y - this.dragStartY;
      const threshold = this.isTouchActive ? this.touchDragThreshold : this.dragThreshold;
      if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        this.hasDragged = true;
        this._state.isDragging = true;
      }
      if (this.hasDragged) {
        this.camera.x = this.cameraStartX - dx;
        this.camera.y = this.cameraStartY - dy;
        this.camera.clamp();
      }
    }
  }

  private endDrag(x: number, y: number, _isTouch: boolean): void {
    if (this.isPointerDown && !this.hasDragged) {
      this.updateWorldPos(x, y);
      this._state.clicked = true;
    }
    this.isPointerDown = false;
    this._state.isDragging = false;
    this.hasDragged = false;
  }
}
