export class GameLoop {
  private lastTime = 0;
  private running = false;
  private _fps = 0;
  private frameCount = 0;
  private fpsTimer = 0;

  public gameSpeed = 1;
  public onUpdate: ((dt: number) => void) | null = null;
  public onRender: (() => void) | null = null;

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  stop(): void {
    this.running = false;
  }

  getFPS(): number {
    return this._fps;
  }

  private loop(time: number): void {
    if (!this.running) return;
    const rawDt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    const cappedDt = Math.min(rawDt, 0.1);
    const dt = cappedDt * this.gameSpeed;

    this.frameCount++;
    this.fpsTimer += rawDt;
    if (this.fpsTimer >= 1) {
      this._fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    if (this.onUpdate && this.gameSpeed > 0) {
      this.onUpdate(dt);
    }
    if (this.onRender) {
      this.onRender();
    }

    requestAnimationFrame((t) => this.loop(t));
  }
}
