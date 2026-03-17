import { loadConfig } from './data/ConfigLoader';
import { AssetLoader } from './render/AssetLoader';
import { Game } from './game/Game';

async function main(): Promise<void> {
  try {
    await loadConfig();

    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.querySelector('p')!.textContent = 'Loading assets...';
    }

    const assets = new AssetLoader();
    await assets.loadAll();

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Canvas element not found');

    const game = new Game(canvas, assets);
    game.trackSiteOpen();

    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }

    const introScreen = document.getElementById('intro-screen');
    const startBtn = document.getElementById('intro-start-btn');
    if (introScreen && startBtn) {
      introScreen.style.display = 'flex';
      await new Promise<void>((resolve) => {
        startBtn.addEventListener('click', () => {
          introScreen.style.display = 'none';
          resolve();
        });
      });
    }

    game.start();
  } catch (err) {
    console.error('Failed to start Winter Village:', err);
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.innerHTML = `
        <h1>Winter Village</h1>
        <p style="color:#ff6666">Failed to load game. Check console for details.</p>
        <p style="font-size:0.8rem;opacity:0.5">${err}</p>
      `;
    }
  }
}

main();
