# Before Night Falls / Winter Village

The playable prototype is a browser-only village management and winter survival
game, built with TypeScript, Vite and Canvas 2D. The existing building catalogue
is unchanged. All gameplay balance loads dynamically from
`public/data/game-balance.json`.

## World and graphics

The simulation uses an 80 × 60 orthogonal grid with 48 px logical tiles. An
invertible 2:1 isometric camera projects the grid into a 2.5D scene. Movement,
building footprints and A* remain on the original grid. The nominal desktop
viewport is 25 × 18 logical tiles; the actual view responds to screen size and
zoom. Touch and mouse input use the same inverse projection as rendering.

Terrain is cached until the map revision, camera or season changes. Visible
trees, buildings, residents and enemies are sorted together by depth. Illustrated
summer/winter atlases supply trees, huts, storage and lumber camps. Other existing
buildings share the cottage silhouette with labels and worker counts; gardens,
fences and fires use Canvas geometry. Original resident and enemy sprites remain.
Missing images fall back to shapes. Snow covers roofs and trees in winter;
shelters give warm light. Canvas backing resolution follows device pixel ratio,
capped at 2, while input stays in CSS pixels.

`GroundArt` draws continuous meadow colour patches, individual grass tufts,
clover, small groups of flowers, stones, forest shade and soil near buildings.
Deterministic world coordinates keep the texture stationary when panning or
zooming. Seasonal palettes include autumn grass and snow. Reusable tuft stamps
stay in the terrain cache; a sparse layer of grass sways separately each frame.

`VillagerArt` combines the original character sprites with directional walking,
breathing and task-specific poses. Chopping swings an axe, shakes the worked tree
and throws chips; farming moves a hoe and soil particles; construction, repairs
and workshop work swing a hammer; hunters draw a bow. Work poses start only after
arrival and use separate timing offsets for each resident. Pausing freezes these
animations and grass motion. Selection shows a ring, route, destination and a
readable activity label; the command card shows actual job progress.

`Camera`, `Renderer`, `GroundArt`, `VillagerArt`, `IsometricArt`, `AssetLoader` and `InputManager` own these
responsibilities independently of the simulation systems.

## Gameplay loop

Start with one hut, two villagers, a 10 × 10 clearing and configured supplies.
Mark trees to gather wood, hunt nearby, build housing, research a garden, assign
workers and prepare food. Call Shelter before the horde reaches the village.
Repair, resume work and expand in spring. The skippable tutorial follows actual
actions rather than a timer and protects the first hunter from death.

## Systems

### SeasonSystem

Spring 30 s → summer 90 s → autumn 30 s → winter 120 s at normal speed. Spring
increments the year, ends the horde, awards surviving-winter research and
autosaves. The configured demo ends after eight winters. Pause, 1×, 2× and 4×
control simulation time. Frame input and UI continue while paused.

### ResourceSystem and ProductionSystem

Wood, food, fur, tools and research persist. Storage has explicit capacities;
notifications fire when reaching a limit, not on every frame. Food is consumed
continuously, with higher winter consumption and a smokehouse efficiency bonus.
Starvation uses a configurable grace period and death interval.

Production requires living assigned workers who have reached a building's
perimeter. Injuries, tools, comfort, weather and winter affect work. Building
production progress is saved. Both garden commands use the same harvest cycle:
45 food per 50 worker-seconds before modifiers. Workshops respect their configured
15 worker-second / 10 wood recipe and do not consume wood when tool storage is
full. Lumber camps require nearby forest; hunter huts produce food/fur with injury
risk; fur workshops process fur into clothing.

### VillagerSystem

Explicit orders persist until completion or replacement. Buildings offer Assign
a free villager and Release workers. Workers can approach any reachable side.
Idle residents may stand still; moving residents replan after blockage and may
share shelter tiles. A* uses an octile heuristic for eight-neighbour movement.
Combat is a temporary state and does not permanently disable a worker's job.

Clicking a visible resident opens their individual command card. Choose Chop,
Hunt here, Farm, Build, Repair, Work or Move, then click the destination. Target
footprints show whether the object supports the chosen job. Invalid or unreachable
destinations keep the previous job intact and leave targeting open for another
attempt. Successful reassignment removes only that resident from their previous
building roster. Repair uses the selected resident rather than finding a different
idle worker, and duplicate repair assignments do not charge twice.

Stop releases the selected resident and makes them wait for explicit orders.
Move similarly reserves that resident after arrival. The saved `holdPosition`
flag prevents automatic clearing/construction from immediately replacing these
orders. A new job or a global Shelter order releases the hold. Stop and Move do
not remove other residents' jobs or unmark the global forest-clearing queue.

The main Hunt command targets nearby reachable forest; Hunt here goes to the
specific forest tile clicked by the player. Later
hunts retain their configured risk. Shelter cancels outdoor orders and records
production assignments; Resume restores jobs for surviving workers when the
building still exists. Immigration requires housing, comfort and sufficient food
and does not occur in winter. Winter exposure is tracked; this prototype uses
hordes, hunger, injuries and warmth/comfort rather than instant cold deaths.

### BuildingSystem

The JSON catalogue defines costs, footprints, capacities, workers and HP. One
builder reserves each site and must arrive before construction advances.
Completion releases builders without releasing production workers. Ordinary
placement returns to selection; fence drawing remains repeatable. Cancelling a
site refunds a configurable share of wood. Repair requires wood and a worker;
age-based warnings/collapse use configured winter counts. Repair retains improved
maximum HP from palisade research.

### TechnologySystem

Research comes from non-defensive construction, population milestones and
survived winters. Existing technologies use configured tiers and costs. Every
researched building appears in the build menu, including tiers 3–5. Better tools,
hearth comfort and reinforced palisades apply their effects.

### HordeSystem

A finite configured number of waves spawns from forest map edges. Enemies
patrol, chase exposed residents and attack non-housing structures and palisades.
Housing is safe shelter. Resident attacks respect cooldowns and configured damage
instead of instantly killing every touched villager. The minimum survivor count
protects against lethal horde damage, but not starvation. The tutorial winter has
two attackers and reduced building damage; later winters require defense and
repair. Enemies retreat before spring. Fog reduces detection distance.

### WeatherSystem

Snowstorms, fog and wind have configured probabilities, durations and penalties.
Spring has no weather events. Work and visibility modifiers affect simulation as
well as presentation. Reset clears both the event and cooldown.

### ComfortSystem

Food reserves, fur/clothing warmth, housing, health, defense and building/hearth
bonuses contribute to comfort. Comfort affects work speed and immigration. Food
and housing checks prevent arrivals into a village unable to support them.

### SaveSystem

Manual saves and spring autosaves use localStorage. Saved state includes the map,
resources, residents and paths, building production, research, season, weather,
comfort, growth/starvation accumulators, sheltered jobs, camera zoom and complete
horde wave state/timers. Loading winter resumes its horde. Older version-1 saves
with an enemy array remain readable; the camera recenters for old top-down saves.

### TutorialSystem and UIManager

The nine-step first-year guide is action-driven and skippable. Its food target
uses actual population and winter consumption. Opening build/research panels
hides the tutorial so it cannot intercept controls. The HUD shows resources,
population, comfort, season time, idle residents and food reserve in seconds.
Mobile main controls are at least 44 px high; saving, loading and repair remain
available. A previous notification timer cannot hide a newer message.
All interface pictograms are original SVG assets under `public/assets/ui/icons/`,
using the game's timber, parchment, sage and aged-iron palette. Resource counters,
action buttons, villager orders, context menus and building/research costs use the
same typed icon collection. No platform emoji are used. Icons are decorative;
button labels and accessible names remain present, including on icon-only controls.
Selecting a resident also hides the tutorial. Job buttons are at least 44 px
high. On mobile the command card contracts while choosing a destination, leaving
more of the map visible; Cancel order restores it. Escape/right-click cancels
targeting while keeping the resident selected. Research availability refreshes
when opening the panel and when resource/level state changes, without replacing
unchanged controls.

### SoundManager and AnalyticsSystem

Existing seasonal music and action sounds are retained. Loading and restarting
restore the appropriate music. Optional analytics/email endpoints are independent
of gameplay; regression checks block third-party requests and never send email.

## Controls and hosting

Click/tap a resident, choose a job and tap its destination. Alternatively, select
a resident and tap a tree/building for its context actions. Stop keeps the selected
resident waiting. Click/tap buildings without a resident selected for general
actions. Drag to pan, scroll/pinch or use +/−
to zoom, and use the home button to center the village. Space pauses; Escape or
right-click cancels placement. Orders remain available while paused.

`npm run build` type-checks and builds `dist/` for GitHub Pages. `npm run build:itch`
also verifies an itch.io package using relative paths. No backend is required for
gameplay. See [PLAYTEST.md](PLAYTEST.md) for browser checks and
[ART_ASSETS.md](ART_ASSETS.md) for generated artwork and prompts.
