import './ui/game.css';
import { loadConfig } from './data/ConfigLoader';
import { AssetLoader } from './render/AssetLoader';
import { Game } from './game/Game';

async function main(): Promise<void> {
  const loadingScreen = document.getElementById('loading-screen');
  const progress = document.getElementById('loading-progress') as HTMLProgressElement | null;
  try {
    await loadConfig();

    const assets = new AssetLoader();
    let loadedAssets = 0;
    let totalAssets = 0;
    let loadedFonts = 0;
    const updateProgress = (): void => {
      if (!progress) return;
      // One configuration, all images, two fonts, and game initialization.
      progress.max = totalAssets + 4;
      progress.value = 1 + loadedAssets + loadedFonts;
    };
    const loadFont = async (weight: number): Promise<void> => {
      await document.fonts.load(`${weight} 12px "PT Sans"`).catch(() => []);
      loadedFonts++;
      updateProgress();
    };
    await Promise.all([
      assets.loadAll((completed, total) => {
        loadedAssets = completed;
        totalAssets = total;
        updateProgress();
      }),
      loadFont(400),
      loadFont(700),
    ]);

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Canvas element not found');

    const game = new Game(canvas, assets);
    game.trackSiteOpen();
    game.start();
    if (progress) progress.value = progress.max;
    // Let the game draw its first frame before revealing the canvas.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (loadingScreen) loadingScreen.style.display = 'none';
  } catch (err) {
    console.error('Failed to start Before Winter Comes:', err);
    if (loadingScreen) loadingScreen.style.display = 'flex';
    if (progress) progress.hidden = true;
    const errorMessage = document.getElementById('loading-error');
    if (errorMessage) {
      errorMessage.textContent = 'Failed to load game. Please reload the page to try again.';
      errorMessage.hidden = false;
    }
  }
}

main();
