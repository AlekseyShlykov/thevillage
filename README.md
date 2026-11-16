# Before Night Falls · Winter Village

A cozy browser village-survival game built with TypeScript, Vite and HTML5 Canvas.
Prepare a small northern settlement for winter in an illustrated isometric world.

```sh
npm install
npm run dev
```

`npm run build` creates the GitHub Pages-compatible `dist/` build.
`npm run build:itch` also produces a verified `itch-build/` directory for itch.io.

Mouse/touch drag pans the camera. Scroll, pinch or + / − zooms. Space pauses;
commands remain available while paused. Escape or right-click cancels placement.
Select a villager, choose Chop / Hunt here / Farm / Build / Repair / Work / Move,
then tap the destination. Stop keeps that villager waiting for further orders.
Escape or Cancel order exits targeting without deselecting the villager.

- [Game specification](docs/GAME_SPEC.md)
- [Playtest and regression checks](docs/PLAYTEST.md)
- [Artwork and generation prompts](docs/ART_ASSETS.md)

Balance is loaded dynamically from `public/data/game-balance.json`.
