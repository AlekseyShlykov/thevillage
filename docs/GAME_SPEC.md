# Before Night Falls / Winter Village

The playable prototype is a browser-only village management and winter survival
game, built with TypeScript, Vite and Canvas 2D. Buildings have distinct housing,
production, storage, warning or defense roles; redundant hunting/fire structures
have been removed. All gameplay balance loads dynamically from
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
buildings share the cottage silhouette with labels and worker counts. Generated
transparent atlases supply garden stages and the animated herbal ward hearth;
fences and the ordinary camp fire use Canvas geometry. Original resident and enemy sprites remain.
Missing images fall back to shapes. Snow covers roofs and trees in winter;
shelters give warm light. Canvas backing resolution follows device pixel ratio,
capped at 2, while input stays in CSS pixels.

`GroundArt` draws continuous meadow colour patches, individual grass tufts,
clover, small groups of flowers, stones, forest shade and soil near buildings.
Deterministic world coordinates keep the texture stationary when panning or
zooming. Seasonal palettes include autumn grass and snow. Reusable tuft stamps
stay in the terrain cache; a sparse layer of grass sways separately each frame.

`VillagerArt` combines the original character sprites with directional walking,
breathing and task-specific poses. Walking retains a stable head/torso, moves feet
continuously with distance travelled, interpolates position and eases the stride
in/out. It does not alternate entire character drawings. Chopping swings an axe, shakes the worked tree
and throws chips; farming moves a hoe and soil particles; construction, repairs
and workshop work swing a hammer; hunters draw a bow. Handheld rake, axe and hammer are generated transparent sprites under
`public/assets/tools/`, animated about the resident’s grip; missing files use
Canvas tools. The cottage’s oval ground shadow is removed. Work poses start only after
arrival and use separate timing offsets for each resident. Pausing freezes these
animations and grass motion. Selection shows a ring, route, destination and a
readable activity label; the command card shows actual job progress.

The summer/winter cottage atlases contain no baked smoke. `BuildingEffects`
draws rising, fading smoke only for completed housing containing living residents.
Smoke disappears when the house empties and freezes on pause. `CropArt` shows
seven stages from the actual saved farming progress: prepared soil, sown seeds,
sprouts, young plants, flowering, ripening and ripe crops. Visual thresholds are
configured in `rendering.cropStageThresholds`.
The garden atlas has eight cells: seven growth stages and a snow-covered empty
bed for prepared winter gardens. `WardFireArt` plays seven illustrated flame
poses over a stone-and-iron herbal hearth; unbuilt fires remain unlit. Both props
keep Canvas shape fallbacks when their PNGs cannot load, and pause freezes fire.

`FenceArt` uses cylindrical timber with grain, caps, rails and winter snow.
`FenceConnections` derives connections from cardinal neighbours whenever drawing,
so extending a wall updates existing corners and junctions. Fence lines follow an
orthogonal L when both axes differ. Gates align with their neighbours and have
two hinged leaves, bracing and a latch; opening swings both leaves away from the
passage. Their simulation tile opens/closes with the same gate state.

`Camera`, `Renderer`, `GroundArt`, `VillagerArt`, `IsometricArt`, `CropArt`,
`FenceArt`, `WardFireArt`, `BuildingEffects`, `AssetLoader` and `InputManager` own these
responsibilities independently of the simulation systems.

## Gameplay loop

Start with one hut, two villagers, a 10 × 10 clearing and configured supplies.
Mark trees to gather wood, hunt deep in the forest, build the initially known
garden, assign a farmer and harvest before frost. Expand housing and prepare
food, worn coats and protective herbs. Call Shelter before winter exposure or
the horde threatens residents.
Repair, resume work and expand in spring. The skippable tutorial follows actual
actions rather than a timer and protects the first hunter from death.

## Systems

### SeasonSystem

Spring 30 s → summer 90 s → autumn 30 s → winter 120 s at normal speed. Spring
increments the year, ends the horde, awards surviving-winter research and
autosaves. The configured demo ends after eighteen winters. Pause, 1×, 2× and 4×
control simulation time. Frame input and UI continue while paused.

### ResourceSystem and ProductionSystem

Wood, food, raw fur, spare tools, spare clothing, protective herbs and research
persist. Storage expands wood/food/fur/tool capacity; herbs have a separate fixed
limit of five, including outbound reservations and returning carriers.
notifications fire when reaching a limit, not on every frame. Food is consumed
continuously, with higher winter consumption and a smokehouse efficiency bonus.
Starvation uses a configurable grace period and death interval.

Production requires living assigned workers who have reached a building's
perimeter. Injuries, tools, comfort, weather and winter affect work. Building
production progress is saved. Workshops respect their configured
15 worker-second / 10 wood recipe and do not consume wood when tool storage is
full. Lumber camps require nearby forest; fur workshops process fur from direct
hunting into clothing. Smokehouses reduce consumption and watchtowers reveal
enemies passively; these two buildings have no worker slots.

### EquipmentSystem

Tools and coats belong to individual residents. A single spare tool is consumed
when issued and benefits only its wearer: 1.5× work and the configured combat
bonus. It lasts 240 working seconds; travel and idle time do not wear it. A coat
requires one raw pelt and 20 worker-seconds in a fur workshop. Finished coats are
issued automatically, one per resident, and last three winters. Stored coats do
not age. Raw pelts and historical production totals provide no cold protection.
Both worn durability and spare inventories are saved. All values are JSON data.

### CropSystem

Farmers sow in spring, summer or autumn: four worker-seconds, then 1.5 calendar
seasons of biological growth. For example, one complete spring plus 50% of summer
advances a crop from zero to maturity. Tools and more farmers speed sowing and
harvesting, not growth. Ripe crops require three worker-seconds to gather 45 food.
Full storage leaves the uncollected portion on the plot; later delivery cannot
duplicate food. A farmer must be present to sow and harvest but may leave during
growth. At winter onset every unharvested crop, including ripe crops, dies;
winter sowing is forbidden. Spring permits sowing again. Plot state, progress and
remaining yield persist. Seven illustrated growth stages follow this progress.

### ForagingSystem

Hunting and herb collection carry supplies on the resident. Nothing is added to
settlement inventory until a living carrier reaches a completed house. Saving
en route preserves cargo and return paths; death loses the cargo. Gather herbs
is available globally and as a selected resident's forest order. Each expedition
reserves one slot, takes 20 worker-seconds on a forest patch and brings one herb. Patches are
10–30 forest tiles from the nearest clearing, with a randomly selected depth.
Each completed herb expedition has a configurable 8% death risk; supplies are
lost and the reserved slot is released if the gatherer dies.
New orders are rejected when stored herbs plus reserved/carried herbs reach five.

### VillagerSystem

Explicit orders persist until completion or replacement. Buildings offer Assign
a free villager and Release workers. Workers can approach any reachable side.
Idle residents may stand still; moving residents replan after blockage and may
share shelter tiles. A* uses an octile heuristic for eight-neighbour movement.
Combat is a temporary state and does not permanently disable a worker's job.

Clicking a visible resident opens their individual command card with only
currently available jobs. `VillagerJobs` resolves reachable forest, construction,
repair and production destinations, free worker slots and recipe ingredients.
Clicking a job immediately replaces that resident's previous task; there is no
second destination click. The nearest suitable site is used. A ripe garden says
Harvest food; a fur workshop says Make fur coats when pelts exist. Reassignment
releases the resident's old worker slot. Other residents retain their jobs.
Stop releases the job and waits for further orders. The saved `holdPosition`
flag prevents automatic dispatch from replacing Stop.

Clicking unoccupied world space deselects the resident and closes construction,
technology, forecast and context panels. Work continues after deselection. A
click outside an open build/research menu dismisses it. Choosing a building in
the build catalogue still enables map placement. Construction context menus
have one Cancel construction action and a separate Close control.

Both hunting commands send residents deeper into the forest. `HuntingGrounds`
caches distance from all clearings using eight-neighbour flood propagation.
Hunting targets must be 10–20 forest tiles from the nearest clearing. Travel distance
from the resident does not cap forest depth. Hunt here chooses a deep reachable spot near the clicked forest area,
rather than stopping on that edge tile. These limits and target search radius
are configured in the villagers data. Successful expeditions bring 15 food and
two fur. Older saves with a shallow hunting destination receive a new deep
destination when loaded. Later
hunts retain their configured risk. Shelter cancels outdoor orders and records
production, clearing, hunting, herb, construction and repair assignments; Resume
restores valid jobs for surviving workers. Spring automatically releases shelter
and restores these planned jobs before autosaving. Repairs preserve prepaid
progress; resumed forest expeditions keep their progress. Older saves containing
only building jobs remain compatible. A single Shelter/Resume button toggles both actions. Resume
also cancels outstanding return-home paths and sends unassigned residents outside
through available perimeter tiles. Immigration requires housing, comfort and sufficient food
and does not occur in winter.

### ColdSystem

Unclothed residents die after 30 exposure-seconds outside in winter. Snowstorms
increase exposure by 1.5×; a worn coat reduces it to 0.1×. Shelter removes three
exposure-seconds per second, and exposure resets outside winter. Residents show
their coat, tool, cargo and exposure in their command card. First-winter horde
protection does not prevent hypothermia: Shelter remains necessary.

### BuildingSystem

The JSON catalogue defines costs, footprints, capacities, workers and HP. One
builder reserves each site and must arrive before construction advances.
A completed garden or fur workshop retains its builder as the first farmer or
craftsperson. Other completed sites release their builders without releasing
production workers. Ordinary
placement returns to selection; fence drawing remains repeatable. Cancelling a
site refunds a configurable share of wood. Repair requires wood and a worker;
age-based warnings/collapse use configured winter counts. Repair retains improved
maximum HP from palisade research.

### TechnologySystem

Research comes only from survived winters: one star for each of winters 1–5,
then two per winter. Construction and population milestones give no stars.
The last rewarded winter is saved to prevent repeat awards. A new village has
zero stars and already knows gardens. Research prices are one or two stars;
fur clothing research is available at tier 1 after the first winter without
requiring tools. Existing technologies use configured tiers and costs. Every
researched building appears in the build menu, including tiers 3–5. Better tools,
hearth comfort and reinforced palisades apply their effects.

### HordeSystem

Building strikes deal two HP every three seconds (formerly four HP every two
seconds), giving residents more time to respond. The building interval is
separate from attacks on residents. A finite configured number of waves spawns from forest map edges. The total
number of enemies per winter is configured by `horde.enemiesPerWinter`:
1, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 17, 20, 21, 22, 25;
25 every subsequent winter. The year sets this total;
the village level only sets how many waves share it. Waves split the remaining
total evenly, with any extra enemies in the earlier waves. Saving preserves
the seasonal spawn counter so reloading cannot replenish the horde. Waves arrive
at the configured interval without waiting for previous enemies to die; the
default arrivals are 8, 38 and 68 seconds into the 120-second winter. New waves
stop during the retreat before spring. Enemies
must destroy every unprotected intact built palisade/gate before attacking other structures.
Once defenses are gone, houses and gardens are valid targets as well. Residents
inside are hidden from direct attacks, but their house can now be destroyed.
`HordeNavigation` paths to reachable perimeter attack positions instead of walking
into a building. Enemies reserve separate attack positions and recover from
traffic blockage. Targets are rechecked after destruction, new defenses or ward
changes, including immediately after loading an older save.

Resident attacks respect cooldowns and configured damage
instead of instantly killing every touched villager. The minimum survivor count
protects against lethal horde damage, but not starvation. The tutorial winter has
one attacker and reduced building damage; later winters require defense and
repair. Enemies retreat before spring. Fog reduces detection distance.

### ProtectionSystem

Protective Herbs is a tier-2 research (available with four residents), costing
two research stars. It unlocks Herbal Ward Fire: 18 wood, 20 construction units,
70 HP. These values and the protection radius are JSON data. A completed fire
automatically burns gathered herbs during winter and blocks a square extending five
tiles in every direction: an 11 × 11 area including the fire's own tile. No
more than one fire may be placed per settlement, including unfinished sites.
Four herbs fuel one full winter: each lasts 30 seconds. A fifth is a spare.
Warm seasons consume no fuel and show an unlit hearth. An empty fire provides
no field; saved fuel seconds restore protection correctly when loading midwinter.

Enemy A* goals, paths, movement and attacks all respect ward tiles. A newly lit
fire repels enemies already inside to a valid outside position. Overlapping
fields form a union. Removing/destroying the fire removes its field. Protection
is derived from completed saved buildings, so it restores on load. Villagers
remain free to move through fields. Placement previews show the entire radius;
built fields have a subtle square ground outline.
Unreachable protected fences do not prevent attacks on buildings outside the
ward: protection remains local to its configured square. Wave spawns also skip
protected tiles.

### WeatherSystem

Snowstorms, fog and wind have configured probabilities, durations and penalties.
Spring has no weather events. Work and visibility modifiers affect simulation as
well as presentation. Reset clears both the event and cooldown.

### ComfortSystem

Food reserves, the fraction of residents wearing coats, housing, health, defense and building/hearth
bonuses contribute to comfort. Comfort affects work speed and immigration. Food
and housing checks prevent arrivals into a village unable to support them.

### SaveSystem

Manual saves and spring autosaves use localStorage. Saved state includes the map,
resources, residents and paths, building production, research, season, weather,
comfort, growth/starvation accumulators, sheltered jobs, camera zoom and complete
horde wave state/timers. Loading winter resumes its horde. Older version-1 saves
with an enemy array remain readable; the camera recenters for old top-down saves.
`SaveMigration` applies `retiredBuildings` data before restoring the map. It
removes hunter huts, clears their footprint and refunds resources within storage
capacity, merges retired fire variants into forest camp fires, refunds obsolete
research and releases redundant jobs. Migration is idempotent. The full retained
catalogue and migration policy are described in [BUILDING_ROLES.md](BUILDING_ROLES.md).

### TutorialSystem and UIManager

The seven-step first-year guide is action-driven and skippable. Its food target
includes consumption until winter, winter consumption and a reserve buffer, using
actual population. It rechecks reserves after arrivals. Opening build/research panels
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
high. Available jobs use two columns with readable labels and start immediately.
The redundant game heading below the HUD is removed. The HUD always shows pelts,
finished coats (worn plus spare) and protective herbs. Tools appear only after
workshop research or when tools already exist; zero tool construction costs are
omitted. Coats and herbs include explanatory tooltips. Research availability refreshes
when opening the panel and when resource/level state changes, without replacing
unchanged controls.

All interface text and Canvas labels use self-hosted PT Sans. Regular, bold and
italic faces are shipped with their OFL license; regular and bold faces load
before the game begins. Fonts use relative asset paths for GitHub Pages and
itch.io and need no third-party requests.

All interface panels, buttons, dialogs, input fields, progress tracks and intro
art have square corners. Canvas information labels use rectangles as well.
`TooltipController` explains every top-bar resource/stat and the Tech, sound,
save and load controls on hover or keyboard focus. Tapping a stat also opens its
tooltip. Food shows current consumption/reserve duration; research explains the
winter-only star schedule. Stable counter nodes prevent flickering when values
update. Tooltips are kept inside the viewport and close on pointer exit/Escape.

### ForecastSystem

The collapsible Winter plan panel estimates consumption until winter and during
winter, a 20% safety reserve, harvest readiness and spring food balance. It warns
when crops cannot ripen before frost and requires harvest labor before counting
a yield. It also shows stored/carried herbs, remaining fuel coverage, worn/spare
coats and tools, residents at risk from cold, and the next winter's star reward.
The estimate uses current population and assigned crops; future hunts, arrivals,
weather and storage interruptions can change the result. It is an estimate, not
a guarantee. The panel stays below the actual top bar on narrow screens.

### SoundManager and AnalyticsSystem

Existing seasonal music and action sounds are retained. Loading and restarting
restore the appropriate music. Optional analytics/email endpoints are independent
of gameplay; regression checks block third-party requests and never send email.

### WarningSystem

Persistent actionable warnings show a food deficit until spring, crops that
cannot mature before frost, missing coats before winter, inadequate ward fuel
and residents freezing outdoors. Cold warnings take priority, show estimated
remaining exposure time, and recommend Shelter. Warm clothing, shelter, food
or herbs resolve their respective warnings; ordinary counter updates do not
cause repeated notification toasts. Warnings and forecasts adapt to the measured
HUD height and remain available on narrow screens.

## Controls and hosting

Click/tap a resident and choose an available job to start it immediately. Stop
keeps the selected resident waiting. Click/tap empty world space to dismiss
selection and open menus. Click/tap buildings without a resident selected for general
actions. Drag to pan, scroll/pinch or use +/−
to zoom, and use the home button to center the village. Space pauses; Escape or
right-click cancels placement. Orders remain available while paused.
Shelter calls everybody home; the same button becomes Resume and releases them.

`npm run build` type-checks and builds `dist/` for GitHub Pages. `npm run build:itch`
also verifies an itch.io package using relative paths. No backend is required for
gameplay. See [PLAYTEST.md](PLAYTEST.md) for browser checks and
[ART_ASSETS.md](ART_ASSETS.md) for generated artwork and prompts.
