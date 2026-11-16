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
Select a villager and click an available job: work starts immediately at a
reachable destination, replacing the previous task. Click empty world space to
deselect and close menus. Stop waits for further orders.
Shelter/Resume is one toggle button. Hover or focus the top-bar counters for
explanations. Protective Herbs research unlocks a fire with a five-tile square
ward. One ward fire is allowed per village: four herbs fuel a winter and inventory
is capped at five, including expeditions. Monsters must breach palisades before
attacking homes and gardens. Hunting takes residents 10–20 tiles inside the forest;
food, pelts and herbs enter storage only after a living carrier returns home.
Tools and crafted fur coats are issued to individuals and wear out. Unclothed
residents must shelter in winter or risk hypothermia. Gardens mature over 1.5
calendar seasons, cannot be sown in winter and lose unharvested crops at frost.
Garden and fur-workshop builders remain as workers; spring automatically resumes
planned jobs. Coats and herbs have HUD counters; tools appear after their unlock.
Persistent warnings explain food shortages and cold danger. Science is earned only by surviving winters (one star for the first five,
then two). Gardens are known initially. Open Winter plan for food, harvest,
equipment, cold and herb forecasts.
The building catalogue removes duplicate hunting/scout structures; each remaining
building has a separate role. Gardens and ward fires use illustrated sprite atlases.

- [Game specification](docs/GAME_SPEC.md)
- [Building roles and retired buildings](docs/BUILDING_ROLES.md)
- [Playtest and regression checks](docs/PLAYTEST.md)
- [Artwork and generation prompts](docs/ART_ASSETS.md)
- [Garden and hearth generation prompts](docs/PROP_ART_PROMPTS.md)

Balance is loaded dynamically from `public/data/game-balance.json`.
