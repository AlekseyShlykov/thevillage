/** Cheap rejection of impossible routes before A*. Four-neighbour components
 * match A* connectivity: a diagonal requires at least one open side tile. */
export class WalkableRegions {
  private key = '';
  private regions = new Int32Array();

  mayReach(sx: number, sy: number, gx: number, gy: number, width: number, height: number,
    revision: string, walkable: (x: number, y: number) => boolean): boolean {
    if (this.key !== revision) {
      this.key = revision;
      this.regions = new Int32Array(width * height);
      const queue = new Int32Array(width * height);
      let region = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const start = y * width + x;
        if (this.regions[start] || !walkable(x, y)) continue;
        this.regions[start] = ++region;
        let head = 0, tail = 1; queue[0] = start;
        while (head < tail) {
          const index = queue[head++], px = index % width, py = Math.floor(index / width);
          for (const [nx, ny] of [[px-1,py],[px+1,py],[px,py-1],[px,py+1]]) {
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const next = ny * width + nx;
            if (this.regions[next] || !walkable(nx, ny)) continue;
            this.regions[next] = region; queue[tail++] = next;
          }
        }
      }
    }
    const from = this.regions[sy * width + sx];
    // A resident on a newly blocked tile must still be allowed to walk out.
    return !from || from === this.regions[gy * width + gx];
  }
}
