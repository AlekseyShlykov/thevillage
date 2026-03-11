const SAVE_KEY = 'winter_village_save';
const AUTOSAVE_KEY = 'winter_village_autosave';

export interface SaveData {
  version: number;
  timestamp: number;
  gameState: Record<string, unknown>;
}

export class SaveSystem {
  save(gameState: Record<string, unknown>, key = SAVE_KEY): boolean {
    try {
      const data: SaveData = {
        version: 1,
        timestamp: Date.now(),
        gameState,
      };
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch {
      console.error('Failed to save game');
      return false;
    }
  }

  autosave(gameState: Record<string, unknown>): boolean {
    return this.save(gameState, AUTOSAVE_KEY);
  }

  load(key = SAVE_KEY): Record<string, unknown> | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data: SaveData = JSON.parse(raw);
      if (data.version !== 1) {
        console.warn('Save version mismatch');
        return null;
      }
      return data.gameState;
    } catch {
      console.error('Failed to load game');
      return null;
    }
  }

  loadAutosave(): Record<string, unknown> | null {
    return this.load(AUTOSAVE_KEY);
  }

  hasSave(key = SAVE_KEY): boolean {
    return localStorage.getItem(key) !== null;
  }

  hasAutosave(): boolean {
    return this.hasSave(AUTOSAVE_KEY);
  }

  deleteSave(key = SAVE_KEY): void {
    localStorage.removeItem(key);
  }

  getSaveTimestamp(key = SAVE_KEY): number | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data: SaveData = JSON.parse(raw);
      return data.timestamp;
    } catch {
      return null;
    }
  }
}
