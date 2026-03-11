import { TileType, TileData, Position } from '../types';
import { getConfig } from '../data/ConfigLoader';

export class TileMap {
  public width: number;
  public height: number;
  public tiles: TileData[][];

  constructor() {
    const cfg = getConfig().map;
    this.width = cfg.mapWidth;
    this.height = cfg.mapHeight;
    this.tiles = [];
    this.generate();
  }

  private generate(): void {
    const cfg = getConfig().map;
    const centerX = Math.floor(this.width / 2);
    const centerY = Math.floor(this.height / 2);
    const halfClearing = Math.floor(cfg.startClearingSize / 2);

    for (let y = 0; y < this.height; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < this.width; x++) {
        const inClearing =
          x >= centerX - halfClearing && x < centerX + halfClearing &&
          y >= centerY - halfClearing && y < centerY + halfClearing;
        this.tiles[y][x] = {
          type: inClearing ? TileType.Clear : TileType.Forest,
          buildingId: null,
          markedForClearing: false,
          clearingProgress: 0,
        };
      }
    }
  }

  /** Regenerate map to initial state (for restart). */
  reset(): void {
    this.generate();
  }

  getTile(x: number, y: number): TileData | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.tiles[y][x];
  }

  setTileType(x: number, y: number, type: TileType): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.tiles[y][x].type = type;
    }
  }

  isWalkable(x: number, y: number, openGateIds?: Set<string>, unbuiltIds?: Set<string>): boolean {
    const tile = this.getTile(x, y);
    if (!tile) return false;
    if (tile.type === TileType.Building) return false;
    if (tile.type === TileType.Palisade) {
      if (tile.buildingId && openGateIds?.has(tile.buildingId)) return true;
      if (tile.buildingId && unbuiltIds?.has(tile.buildingId)) return true;
      return false;
    }
    return true;
  }

  isBuildable(x: number, y: number): boolean {
    const tile = this.getTile(x, y);
    if (!tile) return false;
    return tile.type === TileType.Clear || tile.type === TileType.Farm;
  }

  canPlaceBuilding(tx: number, ty: number, w: number, h: number, allowForest?: boolean): boolean {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tile = this.getTile(tx + dx, ty + dy);
        if (!tile) return false;
        if (allowForest) {
          if (tile.type !== TileType.Forest && tile.type !== TileType.Clear) return false;
        } else {
          if (!this.isBuildable(tx + dx, ty + dy)) return false;
        }
        if (tile.buildingId) return false;
      }
    }
    return true;
  }

  placeBuilding(tx: number, ty: number, w: number, h: number, buildingId: string, tileType: TileType = TileType.Building): void {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tile = this.getTile(tx + dx, ty + dy);
        if (tile) {
          tile.type = tileType;
          tile.buildingId = buildingId;
        }
      }
    }
  }

  removeBuilding(tx: number, ty: number, w: number, h: number): void {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tile = this.getTile(tx + dx, ty + dy);
        if (tile) {
          tile.type = TileType.Clear;
          tile.buildingId = null;
        }
      }
    }
  }

  getClearingCenter(): Position {
    const cfg = getConfig().map;
    return {
      x: Math.floor(this.width / 2),
      y: Math.floor(this.height / 2),
    };
  }

  getForestEdgeTiles(): Position[] {
    const result: Position[] = [];
    const margin = 3;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[y][x].type === TileType.Forest) {
          if (x < margin || x >= this.width - margin || y < margin || y >= this.height - margin) {
            result.push({ x, y });
          }
        }
      }
    }
    return result;
  }

  /** Returns all walkable non-forest tiles (the cleared zone for horde patrol). */
  getClearZoneTiles(): Position[] {
    const result: Position[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = this.tiles[y][x];
        if (t.type === TileType.Clear || t.type === TileType.Farm || t.type === TileType.Path) {
          result.push({ x, y });
        }
      }
    }
    return result;
  }

  /** Returns all forest tiles that are marked for clearing. */
  getMarkedClearingTiles(): Position[] {
    const result: Position[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = this.tiles[y][x];
        if (t.type === TileType.Forest && t.markedForClearing) {
          result.push({ x, y });
        }
      }
    }
    return result;
  }

  serialize(): TileData[][] {
    return this.tiles.map(row => row.map(t => ({ ...t })));
  }

  deserialize(data: TileData[][]): void {
    this.tiles = data;
    this.height = data.length;
    this.width = data[0]?.length ?? 0;
  }
}
