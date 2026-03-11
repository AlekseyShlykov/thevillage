# Winter Village – Implementation Notes

## Project Structure

```
src/
├── core/           Game loop and camera
│   ├── GameLoop.ts     requestAnimationFrame loop with speed control
│   └── Camera.ts       Viewport panning, world/screen coordinate conversion
├── game/           Main game orchestrator
│   └── Game.ts         Wires all systems, handles interaction modes
├── systems/        Independent game systems
│   ├── SeasonSystem.ts     Season cycle (spring/summer/autumn/winter)
│   ├── ResourceSystem.ts   Wood, food, fur, tools, tech points
│   ├── VillagerSystem.ts   Villager spawning, movement, task assignment
│   ├── BuildingSystem.ts   Building placement, construction, damage, repair
│   ├── TechnologySystem.ts Tech tree unlocking
│   ├── HordeSystem.ts      Winter enemy waves
│   ├── WeatherSystem.ts    Random weather events
│   ├── ComfortSystem.ts    Derived comfort metric
│   └── SaveSystem.ts       localStorage save/load
├── entities/       (Reserved for entity classes if needed)
├── world/          Tile map
│   └── TileMap.ts      80×60 grid, tile types, building placement
├── render/         Canvas rendering
│   └── Renderer.ts     Tiles, buildings, villagers, enemies, weather, UI overlays
├── ui/             DOM-based UI overlay
│   └── UIManager.ts    Top bar, build menu, tech tree, info panel
├── input/          Input handling
│   └── InputManager.ts Mouse and touch input, camera drag, click detection
├── data/           Configuration loading
│   └── ConfigLoader.ts Loads game-balance.json at startup
├── types/          TypeScript interfaces and enums
│   └── index.ts        All shared types
└── utils/          Utilities
    └── Pathfinding.ts  A* pathfinding on tile grid
```

---

## Implemented Systems

### Season System
- Four seasons cycle: Spring → Summer → Autumn → Winter
- Durations configurable in `game-balance.json`
- Year counter increments each Spring
- Season change triggers events (horde start, autosave, etc.)

### Resource System
- Five resources: wood, food, fur, tools, tech points
- Storage capacity with building bonuses
- All rates from config

### Villager System
- Villagers with states: idle, moving, working, building, defending, injured, dead
- A* pathfinding for movement
- Auto-task assignment: idle villagers help build or work assigned buildings
- Health/injury/healing system

### Building System
- 15 building types defined in JSON config
- Placement validation (clear tiles only, except scout fire in forest)
- Construction progress with builder assignment
- HP, damage, repair, and collapse mechanics
- Palisade line-drawing placement

### Technology System
- Data-driven tech tree from JSON
- Tier-based unlocking tied to village level
- Player chooses which tech to unlock (not automatic)
- Techs unlock buildings and provide stat upgrades

### Horde System
- Winter enemy waves from forest edges
- Enemies use A* pathfinding toward village center
- Glowing eyes visibility before detection range
- Attack priority: palisades → buildings → villagers
- Minimum survivor guarantee (never total wipe)

### Weather System
- Random events: snowstorm, fog, strong wind
- Configurable chance per season
- Effects: work speed penalty, visibility reduction
- Visual overlay effects on canvas

### Comfort System
- Derived from: food supply, warmth, housing, health, defenses
- Affects productivity and population growth
- Building comfort bonuses

### Save System
- localStorage-based
- Autosave every Spring
- Manual save/load
- Full game state serialization

---

## Current Simplifications

1. **Single enemy type** – All horde enemies share one stat block. Structure supports adding more types later.

2. **No sprite loading** – All rendering uses canvas primitives (placeholder graphics). Sprites can be added via an AssetLoader.

3. **Simple task AI** – Villagers pick tasks based on building assignment or find the nearest unbuilt structure. More sophisticated priority logic (closest resource, most urgent task) is marked as TODO.

4. **Fur aging** – Simplified: fur degrades by a fraction each winter rather than tracking individual fur items.

5. **Combat** – Melee-only, distance-based. Villagers near attacking enemies auto-defend. No formation or targeting priority.

6. **Weather visuals** – Simple particle effects and overlays. Could be enhanced with proper fog-of-war, wind particles, etc.

7. **Palisade placement** – Line drawing works but doesn't check for enclosed area or gate requirements.

---

## TODO Items

- [ ] Sprite/asset loading system (`src/render/AssetLoader.ts`)
- [ ] More sophisticated villager task priority (weighted scoring)
- [ ] Multiple enemy types with different stats
- [ ] Building repair via villager assignment
- [ ] Fog of war for unexplored areas
- [ ] Sound effects and ambient audio
- [ ] Keyboard shortcuts (1-4 for speed, B for build, etc.)
- [ ] Tutorial/onboarding for first-time players
- [ ] Level 2+ content and balancing
- [ ] Mobile-optimized UI sizing
- [ ] Performance profiling with 50+ villagers
- [ ] Animated villager/building states
- [ ] Minimap
- [ ] Path tile type for roads between buildings

---

## Where to Tweak Balance Values

All gameplay numbers live in `public/data/game-balance.json`:

| Section | What it controls |
|---------|-----------------|
| `seasons` | Duration of each season in seconds |
| `resources` | Starting amounts, production rates, costs |
| `villagers` | Speed, consumption, work rates, health |
| `buildings` | Costs, build times, HP, capacities, bonuses |
| `storage` | Base resource capacity limits |
| `horde` | Enemy count, HP, damage, waves per level |
| `comfort` | Weight factors, growth thresholds |
| `fur` | Lifetime in winters, warmth per fur |
| `weather` | Event chances, penalties, durations |
| `technology` | Tech point costs, tier requirements, effects |
| `levels` | Population thresholds for level-up |
| `repair` | Winters until repair needed/collapse |
| `gameSpeed` | Speed multiplier values |

Edit the JSON file and reload the game – no code changes needed for balance tweaks.

---

## GitHub Pages Deployment

```bash
npm run build
# Deploy the dist/ folder to GitHub Pages
# The base path is './' so it works in any subdirectory
```

Vite is configured with `base: './'` for relative asset paths, ensuring compatibility with GitHub Pages and itch.io.

---

## itch.io Deployment

1. Run `npm run build`
2. Zip the contents of the `dist/` folder
3. Upload to itch.io as an HTML5 game
4. Set "Type of project" to "HTML"
5. Set viewport dimensions to 1200×864 or similar
