# Winter Village

A cozy village management and survival browser game about preparing a small northern settlement for the winter.

Manage villagers, gather resources, clear forest, build structures, unlock technologies, and survive mysterious winter hordes.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Build

```bash
npm run build
```

Output goes to `dist/` – ready for static hosting.

## Deployment

### GitHub Pages

1. Run `npm run build`
2. Deploy the `dist/` folder to GitHub Pages
3. Asset paths use `./` (relative), so it works in any subdirectory

### itch.io

1. Run `npm run build`
2. Zip the contents of `dist/`
3. Upload as an HTML5 game on itch.io

## How to Play

- **Drag** the map to pan the camera (mouse or touch)
- **Click** villagers or buildings to select and assign workers
- **🪓 Clear** – mark forest tiles for clearing (grants wood)
- **🏗 Build** – open build menu to place structures
- **📖 Tech** – open technology tree to unlock new buildings and upgrades
- **🗑 Demolish** – remove buildings (recovers some wood)
- **Speed controls** – Pause, 1×, 2×, 4× game speed
- **💾 Save / 📂 Load** – manual save/load (autosaves each Spring)

## Game Balance

All gameplay values are in `public/data/game-balance.json`. Edit and reload to tweak balance without code changes.

## Docs

- [Game Specification](GAME_SPEC.MD)
- [Asset Guide](docs/ASSET_GUIDE.md)
- [Implementation Notes](docs/IMPLEMENTATION_NOTES.md)

## Tech Stack

- TypeScript
- Vite
- HTML5 Canvas
- No external game engine
