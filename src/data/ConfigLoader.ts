import { GameBalanceConfig } from '../types';

let _config: GameBalanceConfig | null = null;

export async function loadConfig(): Promise<GameBalanceConfig> {
  const resp = await fetch('./data/game-balance.json');
  if (!resp.ok) throw new Error('Failed to load game balance config');
  _config = await resp.json();
  return _config!;
}

export function getConfig(): GameBalanceConfig {
  if (!_config) throw new Error('Config not loaded yet');
  return _config;
}
