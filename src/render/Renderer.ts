import { Camera } from '../core/Camera';
import { TileMap } from '../world/TileMap';
import { TileType, BuildingInstance, VillagerData, EnemyData, Season, WeatherEvent, BuildingConfig, Position, VillagerState, HealthState } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { AssetLoader } from './AssetLoader';

const TILE_COLORS: Record<string, string> = {
  [TileType.Forest]: '#2d5a27',
  [TileType.Clear]: '#8fbc5e',
  [TileType.Building]: '#8b7355',
  [TileType.Farm]: '#c4a852',
  [TileType.Palisade]: '#6b4226',
  [TileType.Path]: '#c2b280',
};

const BUILDING_COLORS: Record<string, string> = {
  hut: '#a0785a', garden: '#6aad3a', hunterHut: '#7a6040', bonfire: '#e87040',
  workshop: '#887060', lumberCamp: '#5a7040', storage: '#9a8a6a',
  palisadeWall: '#6b4226', palisadeGate: '#8b6236', campFire: '#e87040',
  furWorkshop: '#7a5a40', smokehouse: '#6a5a4a', watchtower: '#5a5a6a',
  house: '#b08a6a', largeHouse: '#c09a7a',
};

const SEASON_TINTS: Record<string, string> = {
  spring: 'rgba(100, 200, 100, 0.05)',
  summer: 'rgba(255, 255, 200, 0.03)',
  autumn: 'rgba(200, 150, 50, 0.08)',
  winter: 'rgba(180, 200, 255, 0.15)',
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  private tileSize: number;
  private assets: AssetLoader;

  constructor(canvas: HTMLCanvasElement, camera: Camera, assets: AssetLoader) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.camera = camera;
    this.tileSize = getConfig().map.tileSize;
    this.assets = assets;
  }

  resize(): void {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
    this.camera.viewportWidth = this.canvas.width;
    this.camera.viewportHeight = this.canvas.height;
  }

  clear(): void {
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  renderTiles(tileMap: TileMap, season: Season): void {
    const ts = this.tileSize;
    const startTX = Math.floor(this.camera.x / ts);
    const startTY = Math.floor(this.camera.y / ts);
    const endTX = Math.ceil((this.camera.x + this.camera.viewportWidth) / ts);
    const endTY = Math.ceil((this.camera.y + this.camera.viewportHeight) / ts);

    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const tile = tileMap.getTile(tx, ty);
        if (!tile) continue;

        const screen = this.camera.worldToScreen(tx * ts, ty * ts);

        if (tile.type === TileType.Forest) {
          const sprite = this.assets.getForestTile(tx, ty);
          if (sprite) {
            this.ctx.drawImage(sprite, screen.x, screen.y, ts, ts);
          } else {
            this.ctx.fillStyle = TILE_COLORS[TileType.Forest];
            this.ctx.fillRect(screen.x, screen.y, ts, ts);
            this.drawForestFallback(screen.x, screen.y, ts, tx, ty);
          }
        } else if (tile.type === TileType.Clear || tile.type === TileType.Path) {
          const groundSprite = this.assets.getGroundTile(season);
          if (groundSprite) {
            this.ctx.drawImage(groundSprite, screen.x, screen.y, ts, ts);
          } else {
            this.ctx.fillStyle = season === Season.Winter
              ? this.winterize(TILE_COLORS[TileType.Clear])
              : TILE_COLORS[tile.type] || TILE_COLORS[TileType.Clear];
            this.ctx.fillRect(screen.x, screen.y, ts, ts);
          }
        } else if (tile.type === TileType.Farm) {
          const groundSprite = this.assets.getGroundTile(season);
          if (groundSprite) {
            this.ctx.drawImage(groundSprite, screen.x, screen.y, ts, ts);
          } else {
            this.ctx.fillStyle = TILE_COLORS[TileType.Farm];
            this.ctx.fillRect(screen.x, screen.y, ts, ts);
          }
        } else if (tile.type === TileType.Building || tile.type === TileType.Palisade) {
          const groundSprite = this.assets.getGroundTile(season);
          if (groundSprite) {
            this.ctx.drawImage(groundSprite, screen.x, screen.y, ts, ts);
          } else {
            this.ctx.fillStyle = season === Season.Winter
              ? this.winterize(TILE_COLORS[TileType.Clear])
              : TILE_COLORS[TileType.Clear];
            this.ctx.fillRect(screen.x, screen.y, ts, ts);
          }
        }

        if (tile.markedForClearing && tile.type === TileType.Forest) {
          this.ctx.strokeStyle = '#ffcc00';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(screen.x + 1, screen.y + 1, ts - 2, ts - 2);
          if (tile.clearingProgress > 0) {
            this.ctx.fillStyle = 'rgba(255, 204, 0, 0.3)';
            this.ctx.fillRect(screen.x, screen.y + ts - 4, ts * tile.clearingProgress, 4);
          }
        }
      }
    }

    const tint = SEASON_TINTS[season];
    if (tint) {
      this.ctx.fillStyle = tint;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private drawForestFallback(sx: number, sy: number, ts: number, tx: number, ty: number): void {
    const seed = tx * 73 + ty * 137;
    this.ctx.fillStyle = '#1e4a1e';
    const cx = sx + ts / 2 + ((seed % 7) - 3);
    const cy = sy + ts / 2 + ((seed % 5) - 2);
    const r = ts * 0.32;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#3a7a30';
    this.ctx.beginPath();
    this.ctx.arc(cx - 2, cy - 2, r * 0.7, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private getPalisadeCorner(tx: number, ty: number, palisadeTiles: Set<string>): { rotationDeg: number } | null {
    const left = palisadeTiles.has(`${tx - 1},${ty}`);
    const right = palisadeTiles.has(`${tx + 1},${ty}`);
    const top = palisadeTiles.has(`${tx},${ty - 1}`);
    const bottom = palisadeTiles.has(`${tx},${ty + 1}`);
    const hCount = (left ? 1 : 0) + (right ? 1 : 0);
    const vCount = (top ? 1 : 0) + (bottom ? 1 : 0);
    if (hCount !== 1 || vCount !== 1) return null;
    if (right && bottom) return { rotationDeg: 0 };
    if (left && bottom) return { rotationDeg: 90 };
    if (left && top) return { rotationDeg: 180 };
    if (right && top) return { rotationDeg: 270 };
    return null;
  }

  private winterize(color: string): string {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const mix = 0.35;
    const nr = Math.round(r * (1 - mix) + 220 * mix);
    const ng = Math.round(g * (1 - mix) + 225 * mix);
    const nb = Math.round(b * (1 - mix) + 240 * mix);
    return `rgb(${nr},${ng},${nb})`;
  }

  renderBuildings(buildings: BuildingInstance[], configs: Record<string, BuildingConfig>): void {
    const ts = this.tileSize;
    const palisadeTiles = new Set<string>();
    for (const b of buildings) {
      if ((b.configId === 'palisadeWall' || b.configId === 'palisadeGate') && b.built) {
        palisadeTiles.add(`${b.tileX},${b.tileY}`);
      }
    }

    for (const b of buildings) {
      const cfg = configs[b.configId];
      if (!cfg) continue;

      const screen = this.camera.worldToScreen(b.tileX * ts, b.tileY * ts);
      const w = cfg.width * ts;
      const h = cfg.height * ts;

      if (screen.x + w < 0 || screen.y + h < 0 || screen.x > this.camera.viewportWidth || screen.y > this.camera.viewportHeight) {
        continue;
      }

      const isPalisadeWallBuilt = b.configId === 'palisadeWall' && b.built;
      const corner = isPalisadeWallBuilt ? this.getPalisadeCorner(b.tileX, b.tileY, palisadeTiles) : null;
      const useCornerSprite = corner !== null && this.assets.getBuilding('palisadeCorner');

      const sprite = useCornerSprite ? this.assets.getBuilding('palisadeCorner') : this.assets.getBuilding(b.configId);
      const rotated = useCornerSprite ? (corner!.rotationDeg / 90) !== 0 : (b.rotation ?? 0) === 90;
      const rotationDeg = useCornerSprite ? corner!.rotationDeg : 0;

      const isGardenWithProgress = b.configId === 'garden' && b.built && b.farmingProgress !== undefined;
      let gardenTileKey: string = 'garden_empty';
      if (isGardenWithProgress) {
        const p = b.farmingProgress!;
        if (p >= 0.66) gardenTileKey = 'garden_ready';
        else if (p >= 0.33) gardenTileKey = 'garden_growing_2';
        else if (p > 0) gardenTileKey = 'garden_growing_1';
        else gardenTileKey = 'garden_empty';
      } else if (b.configId === 'garden' && b.built) {
        gardenTileKey = 'garden_empty';
      }

      if (b.configId === 'garden' && b.built) {
        const tileSprite = this.assets.getTile(gardenTileKey, 0);
        if (tileSprite) {
          this.ctx.drawImage(tileSprite, screen.x, screen.y, w, h);
        } else {
          this.ctx.fillStyle = BUILDING_COLORS[b.configId] || '#6aad3a';
          this.ctx.fillRect(screen.x + 2, screen.y + 2, w - 4, h - 4);
        }
        if (isGardenWithProgress && b.farmingProgress !== undefined && b.farmingProgress < 1) {
          this.ctx.fillStyle = '#333';
          this.ctx.fillRect(screen.x, screen.y + h - 6, w, 5);
          this.ctx.fillStyle = '#6aad3a';
          this.ctx.fillRect(screen.x, screen.y + h - 6, w * b.farmingProgress, 5);
        }
      } else if (sprite) {
        if (!b.built) {
          this.ctx.globalAlpha = 0.3 + b.buildProgress * 0.7;
        } else if (b.configId === 'palisadeGate' && b.gateOpen) {
          this.ctx.globalAlpha = 0.4;
        }
        if (useCornerSprite && rotationDeg !== 0) {
          this.ctx.save();
          this.ctx.translate(screen.x + w / 2, screen.y + h / 2);
          this.ctx.rotate((rotationDeg * Math.PI) / 180);
          this.ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
          this.ctx.restore();
        } else if (rotated) {
          this.ctx.save();
          this.ctx.translate(screen.x + w / 2, screen.y + h / 2);
          this.ctx.rotate(Math.PI / 2);
          this.ctx.drawImage(sprite, -h / 2, -w / 2, h, w);
          this.ctx.restore();
        } else {
          this.ctx.drawImage(sprite, screen.x, screen.y, w, h);
        }
        this.ctx.globalAlpha = 1;

        if (!b.built) {
          this.ctx.fillStyle = '#ffcc00';
          this.ctx.fillRect(screen.x, screen.y + h - 4, w * b.buildProgress, 4);
        }
      } else {
        if (rotated) {
          this.ctx.save();
          this.ctx.translate(screen.x + w / 2, screen.y + h / 2);
          this.ctx.rotate(Math.PI / 2);
          this.ctx.fillStyle = BUILDING_COLORS[b.configId] || '#888';
          this.ctx.fillRect(-h / 2 + 2, -w / 2 + 2, h - 4, w - 4);
          if (!b.built) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
            this.ctx.fillRect(-h / 2 + 2, -w / 2 + 2, h - 4, (w - 4) * (1 - b.buildProgress));
          }
          this.ctx.restore();
        } else {
          this.ctx.fillStyle = BUILDING_COLORS[b.configId] || '#888';
          this.ctx.fillRect(screen.x + 2, screen.y + 2, w - 4, h - 4);
          if (!b.built) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
            this.ctx.fillRect(screen.x + 2, screen.y + 2, w - 4, (h - 4) * (1 - b.buildProgress));
          }
        }

        if (!b.built) {
          this.ctx.fillStyle = '#ffcc00';
          this.ctx.fillRect(screen.x + 2, screen.y + h - 6, (w - 4) * b.buildProgress, 4);
        }

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '10px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(cfg.name, screen.x + w / 2, screen.y + h / 2 + 3);
      }

      if (b.needsRepair) {
        this.ctx.strokeStyle = '#ff4444';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 4]);
        this.ctx.strokeRect(screen.x + 1, screen.y + 1, w - 2, h - 2);
        this.ctx.setLineDash([]);
      }

      if (b.hp < b.maxHp) {
        const hpPct = b.hp / b.maxHp;
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(screen.x + 4, screen.y - 6, w - 8, 4);
        this.ctx.fillStyle = hpPct > 0.5 ? '#4a4' : hpPct > 0.25 ? '#aa4' : '#a44';
        this.ctx.fillRect(screen.x + 4, screen.y - 6, (w - 8) * hpPct, 4);
      }

      if (cfg.lightRadius && cfg.lightRadius > 0) {
        const cx = screen.x + w / 2;
        const cy = screen.y + h / 2;
        const lr = cfg.lightRadius * ts;
        const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, lr);
        grad.addColorStop(0, 'rgba(255, 200, 100, 0.12)');
        grad.addColorStop(1, 'rgba(255, 200, 100, 0)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(cx - lr, cy - lr, lr * 2, lr * 2);
      }
    }
  }

  renderVillagers(villagers: VillagerData[], selectedId: string | null, season: Season): void {
    const ts = this.tileSize;
    const animFrame = Math.floor(Date.now() / 400) % 2;

    for (const v of villagers) {
      if (v.state === VillagerState.Dead || v.health === HealthState.Dead) continue;
      const screen = this.camera.worldToScreen(v.x * ts + ts / 2, v.y * ts + ts / 2);

      if (screen.x < -ts || screen.y < -ts || screen.x > this.camera.viewportWidth + ts || screen.y > this.camera.viewportHeight + ts) {
        continue;
      }

      if (v.id === selectedId) {
        const glowRadius = ts * 0.5;
        this.ctx.save();
        this.ctx.shadowColor = '#4ade80';
        this.ctx.shadowBlur = 12;
        this.ctx.strokeStyle = 'rgba(74, 222, 128, 0.9)';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, glowRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = '#22c55e';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.restore();
      }

      let spriteKey: string;
      if (v.health === HealthState.Injured) {
        spriteKey = 'injured';
      } else if (season === Season.Winter) {
        spriteKey = 'winter';
      } else if (v.state === VillagerState.Building) {
        spriteKey = 'builder';
      } else if (v.state === VillagerState.Working) {
        if (v.currentTask === 'clearing') spriteKey = 'lumberjack';
        else if (v.assignedBuildingId?.includes('hunter')) spriteKey = 'hunter';
        else spriteKey = 'builder';
      } else if (v.state === VillagerState.Moving) {
        spriteKey = animFrame === 0 ? 'walk_1' : 'walk_2';
      } else {
        spriteKey = 'idle';
      }

      const sprite = this.assets.getVillager(spriteKey);
      if (sprite) {
        const size = ts * 0.75;
        this.ctx.drawImage(sprite, screen.x - size / 2, screen.y - size / 2, size, size);
      } else {
        const radius = ts * 0.28;
        this.ctx.fillStyle = v.health === HealthState.Injured ? '#cc8844' : '#ddb87a';
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#553322';
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y - radius * 0.2, radius * 0.7, Math.PI, 0, true);
        this.ctx.fill();
      }

      if (v.state === VillagerState.Working || v.state === VillagerState.Building) {
        if (!sprite) {
          this.ctx.fillStyle = '#fff';
          this.ctx.font = '8px sans-serif';
          this.ctx.textAlign = 'center';
          const icon = v.state === VillagerState.Building ? '🔨' : '⛏';
          this.ctx.fillText(icon, screen.x, screen.y - ts * 0.28 - 4);
        }
      }
    }
  }

  renderEnemies(enemies: EnemyData[], _season: Season): void {
    const ts = this.tileSize;
    const animFrame = Math.floor(Date.now() / 350) % 2;

    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const screen = this.camera.worldToScreen(e.x * ts + ts / 2, e.y * ts + ts / 2);

      if (screen.x < -ts || screen.y < -ts || screen.x > this.camera.viewportWidth + ts || screen.y > this.camera.viewportHeight + ts) {
        continue;
      }

      if (!e.visible) {
        const eyeSprite = this.assets.getEnemy('eyes');
        if (eyeSprite) {
          const size = ts * 0.7;
          this.ctx.drawImage(eyeSprite, screen.x - size / 2, screen.y - size / 2, size, size);
        } else {
          this.ctx.fillStyle = '#ff3300';
          this.ctx.shadowColor = '#ff3300';
          this.ctx.shadowBlur = 8;
          this.ctx.beginPath();
          this.ctx.arc(screen.x - 4, screen.y, 2.5, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.beginPath();
          this.ctx.arc(screen.x + 4, screen.y, 2.5, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.shadowBlur = 0;
        }
      } else {
        let spriteKey: string;
        if (e.state === 'attacking') {
          spriteKey = 'attack';
        } else {
          spriteKey = animFrame === 0 ? 'walk_1' : 'walk_2';
        }
        const sprite = this.assets.getEnemy(spriteKey);
        if (sprite) {
          const size = ts * 0.8;
          this.ctx.drawImage(sprite, screen.x - size / 2, screen.y - size / 2, size, size);
        } else {
          const radius = ts * 0.3;
          this.ctx.fillStyle = '#3a2a4a';
          this.ctx.beginPath();
          this.ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.fillStyle = '#ff4444';
          this.ctx.beginPath();
          this.ctx.arc(screen.x - 3, screen.y - 2, 2, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.beginPath();
          this.ctx.arc(screen.x + 3, screen.y - 2, 2, 0, Math.PI * 2);
          this.ctx.fill();
        }

        if (e.hp < e.maxHp) {
          const hpPct = e.hp / e.maxHp;
          this.ctx.fillStyle = '#333';
          this.ctx.fillRect(screen.x - 10, screen.y - ts * 0.3 - 6, 20, 3);
          this.ctx.fillStyle = '#c44';
          this.ctx.fillRect(screen.x - 10, screen.y - ts * 0.3 - 6, 20 * hpPct, 3);
        }
      }
    }
  }

  renderWeather(weather: WeatherEvent | null): void {
    if (!weather) return;
    switch (weather.type) {
      case 'snowstorm':
        this.ctx.fillStyle = `rgba(220, 230, 255, ${0.15 * weather.intensity})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        for (let i = 0; i < 80; i++) {
          const x = Math.random() * this.canvas.width;
          const y = Math.random() * this.canvas.height;
          this.ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.4})`;
          this.ctx.fillRect(x, y, 2, 2);
        }
        break;
      case 'fog':
        this.ctx.fillStyle = `rgba(180, 190, 200, ${0.25 * weather.intensity})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        break;
      case 'strongWind':
        this.ctx.strokeStyle = `rgba(200, 200, 200, ${0.15 * weather.intensity})`;
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
          const y = Math.random() * this.canvas.height;
          const x = Math.random() * this.canvas.width;
          this.ctx.beginPath();
          this.ctx.moveTo(x, y);
          this.ctx.lineTo(x + 30 + Math.random() * 30, y - 2 + Math.random() * 4);
          this.ctx.stroke();
        }
        break;
    }
  }

  renderBuildPreview(tx: number, ty: number, w: number, h: number, valid: boolean): void {
    const ts = this.tileSize;
    const screen = this.camera.worldToScreen(tx * ts, ty * ts);
    this.ctx.fillStyle = valid ? 'rgba(100, 255, 100, 0.3)' : 'rgba(255, 100, 100, 0.3)';
    this.ctx.fillRect(screen.x, screen.y, w * ts, h * ts);
    this.ctx.strokeStyle = valid ? '#4f4' : '#f44';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(screen.x, screen.y, w * ts, h * ts);
  }

  renderPalisadePreview(tiles: Position[], tileMap: TileMap): void {
    const ts = this.tileSize;
    for (const t of tiles) {
      const valid = tileMap.isBuildable(t.x, t.y);
      const screen = this.camera.worldToScreen(t.x * ts, t.y * ts);
      this.ctx.fillStyle = valid ? 'rgba(100, 200, 100, 0.3)' : 'rgba(255, 100, 100, 0.3)';
      this.ctx.fillRect(screen.x, screen.y, ts, ts);
    }
  }

  renderWinterDarkness(season: Season, buildings: BuildingInstance[], configs: Record<string, BuildingConfig>): void {
    if (season !== Season.Winter) return;

    this.ctx.fillStyle = 'rgba(10, 10, 30, 0.3)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const ts = this.tileSize;
    for (const b of buildings) {
      const cfg = configs[b.configId];
      if (!cfg || !b.built) continue;
      const lr = cfg.lightRadius || (cfg.category === 'housing' ? 2 : 0);
      if (lr <= 0) continue;

      const cx = b.tileX * ts + (cfg.width * ts) / 2;
      const cy = b.tileY * ts + (cfg.height * ts) / 2;
      const screen = this.camera.worldToScreen(cx, cy);
      const radius = lr * ts;

      const grad = this.ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, radius);
      grad.addColorStop(0, 'rgba(255, 220, 150, 0.15)');
      grad.addColorStop(1, 'rgba(255, 220, 150, 0)');
      this.ctx.globalCompositeOperation = 'lighter';
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(screen.x - radius, screen.y - radius, radius * 2, radius * 2);
      this.ctx.globalCompositeOperation = 'source-over';
    }
  }

  renderSelectionBox(tx: number, ty: number): void {
    const ts = this.tileSize;
    const screen = this.camera.worldToScreen(tx * ts, ty * ts);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(screen.x, screen.y, ts, ts);
  }
}
