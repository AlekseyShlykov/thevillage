# Before Winter Comes

The playable prototype is a browser-only village management and winter survival
game, built with TypeScript, Vite and Canvas 2D. Buildings have distinct housing,
production, storage, warning or defense roles; redundant hunting/fire structures
have been removed. All gameplay balance loads dynamically from
`public/data/game-balance.json`.

On launch, a minimal loading screen shows “Before Winter Comes” and a progress
bar driven by configuration, image and font loading, followed by world initialization.
Missing images count as loaded and use the existing shape fallbacks. Once ready,
the game opens automatically without an intro or Start button. Failed configuration
loading keeps the title visible and shows a reload message. Browser-blocked seasonal
audio resumes on the first interaction inside the game.

## World and graphics

The simulation uses an 80 × 60 orthogonal grid with 48 px logical tiles. An
invertible 2:1 isometric camera projects the grid into a 2.5D scene. Movement,
building footprints and A* remain on the original grid. The nominal desktop
viewport is 25 × 18 logical tiles; the actual view responds to screen size and
zoom. Touch and mouse input use the same inverse projection as rendering.

Terrain is cached until the map revision, camera or season changes. Visible
trees, buildings, residents and enemies are sorted together by depth. Illustrated
summer/winter atlases supply trees, huts, storage and sawmills. Fur Workshop has
its own summer/winter illustrations with an open work bay, pelts and a hide frame.
Other existing housing shares the cottage silhouette with labels and worker counts.
Gardens sort below nearby residents so farmers remain visible even along the rear
edge; occlusion for taller buildings is unchanged. Generated
transparent atlases supply garden stages and the animated herbal ward hearth. Separate
transparent illustrations supply the timber guard tower and carried herb/hunting
baskets. `MoatArt` draws connected earth banks and dark water; fences and the
ordinary camp fire use Canvas geometry. Original resident and enemy sprites remain.
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
`FenceArt`, `WardFireArt`, `ProjectileArt`, `BuildingEffects`, `AssetLoader` and `InputManager` own these
responsibilities independently of the simulation systems.

## Gameplay loop

Start with one hut, two villagers, a 10 × 10 clearing and configured supplies.
Press Clear to widen the village clearing, hunt deep in the forest, build the initially known
garden, assign a farmer and harvest before frost. Expand housing and prepare
food, worn coats and protective herbs. Call Shelter before winter exposure or
the horde threatens residents.
Repair, resume work and expand in spring. A short seasonal briefing pauses time
until acknowledged or skipped. The first guided hunter remains protected from death.

## Systems

### SeasonSystem

Spring 30 s → summer 90 s → autumn 30 s → winter 120 s at normal speed. Spring
increments the year, ends the horde and autosaves. Research is awarded on entering
winter, before winter construction and work. The configured demo ends after eighteen winters. Pause, 1×, 2× and 4×
control simulation time. Frame input and UI continue while paused.

### ResourceSystem and ProductionSystem

Wood, food, raw fur, spare clothing, protective herbs and research persist.
Storage expands wood/food/fur capacity; the saved tools field is compatibility-only; herbs have a separate fixed
limit of five, including outbound reservations and returning carriers.
notifications fire when reaching a limit, not on every frame. Food is consumed
continuously, with higher winter consumption.
Starvation uses a configurable grace period and death interval.

Production requires living assigned workers who have reached a building's
perimeter. Injuries, comfort, weather and winter affect work. Building production
progress is saved. Sawmills require nearby forest; fur workshops process
pelts from direct hunting into clothing. Smokehouse is currently retired.
The tool Workshop and Better Tools research are removed: every resident has
permanent tools and no construction recipe requires spare tools.

### EquipmentSystem

All living residents have their own permanent tools, including the combat bonus.
Tools never wear out, require production, or occupy a resource counter. Fur coats
remain individual: one pelt and 20 worker-seconds produce a coat, issued
automatically to an uncoated resident. It lasts three winters; stored coats do not
age. Raw pelts and historical production totals provide no cold protection.
Worn coat lifetime and spare inventories are saved. All values are JSON data.

### CropSystem

Farmers sow in spring, summer or autumn: four worker-seconds, then 1.125 calendar
seasons of biological growth. For example, one complete spring plus 12.5% of summer
advances a crop from zero to maturity. Additional farmers speed sowing and harvesting, not biological growth. Ripe crops require three worker-seconds to gather 45 food.
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
second destination click. A reachable suitable site is used; farming prefers a
garden with fewer assigned farmers, then the nearer plot. A full garden is
skipped. With two available plots, two residents work separate plots. A ripe garden says
Harvest food; a fur workshop says Make fur coats when pelts exist. Reassignment
releases the resident's old worker slot. Other residents retain their jobs.
Stop releases the job and waits for further orders. The saved `holdPosition`
flag prevents automatic dispatch from replacing Stop.

Clicking unoccupied world space deselects the resident and closes construction,
technology and context panels. Work continues after deselection. A
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
hunts retain their configured risk. Global Hunt, Herbs and Clear commands choose
an idle resident, then an automatic woodcutter, then another non-farming worker.
A farmer stays on their plot unless the player explicitly selects that resident
and issues a new job. Global Shelter still recalls everyone. Existing expeditions
are interrupted only when no other worker is available; a selected resident has priority. Former work rosters are released immediately. Carried
supplies are delivered first, then the accepted order starts without another click.

Clear immediately dispatches a worker to a reachable unreserved tree, interrupting
a non-farming job if necessary, and enters tree-selection mode. Click forest tiles to
queue any number of specific trees in click order; duplicates are ignored. Queued
tiles show numbered markers and the Clear button shows the queue size. A worker
finishes its current tree, then chooses queued trees before automatic expansion.
Workers reserve distinct targets, skip unreachable requests without deleting them,
and fall back to widening the settlement when no selected target is available.
Automatic targets must touch a cleared tile along a grid edge. They are ordered
in concentric bands around the original village centre, with worker travel distance
used only within the same band. `villagers.clearingRingWidth` sets the band width
(one tile by default). This fills the nearby perimeter before progressing outward,
producing a broad round clearing rather than a narrow corridor following one
worker's position. Both the global Clear and individual Chop wood jobs use this
selection. Explicit queued trees and legacy marked requests retain priority and
can target deeper forest. The centre derives from the map, so loading a save or
placing a distant outpost does not move the expansion origin. Idle residents
may help with marked work, while Stop and settlement shelter still prevent automatic
dispatch. Click Clear again, press Escape, right-click or click empty ground to
leave selection; current work and queued trees remain. Clicking a resident exits
selection and opens their usual orders. Mobile taps select trees and camera drags
never enqueue them. Tile metadata saves explicit ordering across reloads and
spring recall; old unordered marked tiles remain usable. Completed trees leave
the queue and yield wood once. Farming,
construction, ordinary production and clearing are remembered as annual jobs.
Shelter cancels outdoor orders; Resume and spring restore these jobs before
spring autosave. If a carrier is still returning at spring, their annual job
resumes after delivery. Finished construction sites fall back to another unfinished
site. Hunting and herb expeditions require a fresh explicit order and never
restart because of Resume or spring. Stop clears the remembered job.

The Shelter/Resume button toggles recall and release of everybody. Release one,
or a named resident in a shelter's context menu, exempts just that resident from
the settlement shelter order and selects them for immediate job commands. The
others stay inside. Resume also cancels empty return-home paths and sends
unassigned residents outside through available perimeter tiles. Immigration
requires housing, comfort and sufficient food and does not occur in winter.
Residents regenerate gradually to full HP, including after crossing the injured
health threshold.

### ShelterSystem

The settlement Shelter button reserves ordinary home places for 25% of living
residents, rounded up, with a minimum of one. Both values are configurable under
`gameplay`. Remaining residents first fill reachable Timber Guard Tower places,
up to each tower's configured capacity, then return to ordinary homes. Routes
are checked before a place is reserved; an inaccessible tower falls back to homes.
If there are no ordinary shelters, free tower places are still used. The command
reports any residents without a reachable place. Repeated recalls recompute the
plan from living residents rather than adding stale reservations. Residents
already inside a house can complete their new return-home path into a tower
while the settlement stays in shelter mode.

### ColdSystem

Unclothed residents die after 30 exposure-seconds outside in winter. Snowstorms
increase exposure by 1.5×; a worn coat reduces it to 0.1×. A heated shelter removes
three exposure-seconds per second. An unheated shelter accumulates exposure at
0.35× the outdoor rate, further reduced by worn coats. Exposure resets outside winter. Residents show
their coat, cargo and exposure in their command card. First-winter horde
protection does not prevent hypothermia: Shelter remains necessary.

### HeatingSystem

Every completed hut, house, guard tower and forest camp fire uses
four wood over one full winter, including empty shelters. Consumption is continuous,
shared equally between shelters, and absent in other seasons. Unfinished buildings
use no fuel. No extra charge occurs on entering a season or loading a save.
When wood runs out, shelter still conceals residents from monsters but stops
warming them; gathering wood immediately restores heat. Fuel demand, shelter IDs
and indoor cold exposure are configured in `game-balance.json`. The Wood tooltip
explains the reserve, with actionable warnings for a deficit or no heating.

### BuildingSystem

The JSON catalogue defines costs, footprints, capacities, workers and HP. One
builder reserves each site and must arrive before construction advances. New
placement can reassign an occupied worker if no idle builder is available. Garden
construction uses 5.5 build units instead of 22 (four times faster); at base
construction speed 0.8 that is 6.875 seconds on site.
A completed garden or fur workshop retains its builder as the first farmer or
craftsperson. Other completed sites release their builders without releasing
production workers. Ordinary
placement returns to selection; fence drawing remains repeatable. Cancelling a
site refunds a configurable share of wood. Repair requires wood and a worker;
age-based warnings/collapse use configured winter counts. Repair retains improved
maximum HP from palisade research.

### TechnologySystem

Research arrives at the beginning of winter: one star for each of winters 1–5,
then two per winter. Construction and population milestones give no stars.
The last rewarded winter and `researchRewardTiming: winter-start` are saved to
prevent repeat awards. An older save loaded during winter receives that winter's
new early reward once; a spring save retains its existing balance until the next
winter. Previously unlocked technologies remain owned.

A new village has zero stars and already knows gardens and moats. Only Storage
is initially researchable. Storage unlocks the Fur Workshop, Palisade and
Protective Herbs branch. All three branch technologies must be researched before
the compact advanced set appears: Forest Camp Fire, Sawmill, Warm House and
Timber Guard Tower. The tower card appears alongside Sawmill, disabled with a
visible requirement and hover tooltip until Sawmill research and a completed
Sawmill are present. Its card updates immediately when the mill finishes.
Dependencies are data-driven `prerequisites`, `visibleAfter` and `requiresBuildings`;
population levels no longer gate research. Costs: Storage and Palisade one star;
Timber Guard Tower three stars; every other technology two stars. Warm House
unlocks in-place upgrades instead of a separate Build entry. Successfully
purchasing a technology immediately closes the Tech panel. Smokehouse, Large
House, Hearth and the global Reinforced Palisade research are retired for now.

### BuildingUpgrades

Select a completed Hut after Warm House research and choose Upgrade to House.
It costs 25 wood and 28 base construction seconds. One resident must reach the
perimeter and build, with the ordinary weather/season/productivity modifiers.
The Hut remains a functioning four-place shelter during construction; completion
changes it to a six-place House with 200 HP and +2 comfort. ID, coordinates,
2 × 2 footprint, resident locations, damage fraction and heating demand (four
wood per winter) remain unchanged. Distinct generated summer/winter log-house
sprites show chinked walls, heavy shingles and a stone foundation. Chimney smoke
is still separate animation and appears only when residents are inside.

After researching and completing Sawmill, select each existing palisade section
or gate to reinforce it. Walls cost four wood and six base construction seconds;
gates cost eight wood and eight seconds. Completed upgrades double that section's
HP (60 → 120 for walls, 120 → 240 for gates) and visibly thicken the timber and
add a supporting rail. Connections, corners, open gates, rotation, snow and
walkability remain intact. This is an individual upgrade, not another research
card or building type.

Pending upgrades retain built=true, normal defense and shelter functionality;
`upgradeProgress` distinguishes active construction. Builders can be redirected,
reassigned automatically or resume after winter shelter. Progress, workers and
completed reinforcement persist in saves. Cancelling returns the configured
construction refund (50%) once, releases its workers and keeps the original
building. Upgrades preserve existing damage and cannot be repeated on a
fully upgraded structure. All costs, times, target IDs and HP multipliers are
configured on each building's `upgrade` record in the balance JSON.

Older saves refund Smokehouse construction/research and Hearth research once.
Large Houses become Houses without displacement (the old excess footprint
becomes clear ground), transferring research when necessary. Former global
palisade reinforcement becomes an individual completed upgrade on existing
walls and gates; its research stars are refunded. Old House footprints are
normalized from 3 × 2 to 2 × 2 and retain their damage fraction.

The former Lumber Camp is displayed as Sawmill (saved ID `lumberCamp` is retained).
Its existing wood production and nearby clearing-yield bonus remain. It is now
required for advanced tower research. Planks and additional processing chains
are proposals only; see `DEVELOPMENT_OPTIONS.md`.

### Combat progression

Before the first completed Timber Guard Tower, residents cannot damage monsters,
including through automatic close combat. Researching a tower or placing an
unfinished construction site does not enable attacks. The first completed tower
permanently unlocks resident defense and doubles both current and maximum HP of
all living monsters, preserving their injury fraction. Dead enemies stay dead.
Future waves spawn at doubled health (default 30 → 60 HP). Additional towers and
rebuilding do not multiply health again. Demolishing or losing the last tower
does not undo this settlement milestone.

`HordeSystem` owns `towerDefenseUnlocked`, blocks damage centrally, and stores
the milestone in its saved state through seasonal changes. The construction tick
observes completion before horde spawning, attacks and tower shooting. New games
reset progression. Older saves with a completed tower acquire it once on load;
new saves retain it even after every tower is gone. Loading does not mutate the
provided snapshot or apply the multiplier repeatedly. Rules are configured by
`horde.requireTowerForVillagerDamage` and `horde.enemyHealthAfterTowerMultiplier`.

### TowerCombatSystem and moats

Timber Guard Tower replaces the old passive watchtower using the same ID and
1 × 1 footprint. It provides shelter for three residents, 360 HP, detection at
8 tiles and ranged defense. Garrison tower sends a different available resident
inside on each click, reserves incoming places, and works during global shelter.
Only living residents inside can fire: each contributes 18 damage every 1.25
seconds against the nearest monster within seven tiles. An empty tower does not
shoot. Generated wooden arrows with iron tips and ivory/brown fletching show attacks.
`ProjectileArt` rotates each arrow along a shallow flight arc from the firing
slit to the target; zoom preserves its proportions, pausing freezes its position,
and missing images use a Canvas arrow. Length, arc and flight time are configured
in `rendering`. Tower occupants are hidden and counted
as sheltered, so they warm up when supplied with firewood. Old towers receive the new
maximum HP while retaining their health fraction. All combat values live in JSON.

Moats are walkable 1 × 1 terrain projects, each requiring six build units and no
resources. Consecutive placement clicks dig connected sections; Cancel/ESC leaves
the mode. Finished moat tiles multiply monster movement speed by 1/6 (six times
slower); unfinished sections have no effect. Residents cross normally. Monsters
do not attack trenches. The JSON `indestructible` flag also rejects damage in
`BuildingSystem`, for both unfinished and finished sections; winter maintenance
does not damage them. The player may still cancel or manually demolish them. Moats can
surround a house without making its entrances impassable. Terrain state is
reconstructed from saved construction state on load.
The generated six-cell transparent moat atlas supplies isolated pits, ends,
straights, elbows, T junctions and crosses. Four-neighbour masks select and rotate
these pieces before isometric projection, including unfinished adjacent sections.
Shared painted mouth samples and extruded edge pixels keep joins continuous at
fractional zoom. Connections recalculate after digging, demolition and loading.
Winter uses a separate painted atlas with snow-covered banks and icy channel
edges. It preserves the same sixteen connection masks and shared mouth samples.
Fence posts, rails, gates and their footings also accumulate visible snow. Missing
art uses connected Canvas shapes.

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

Protective Herbs follows Storage research and costs
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
removes hunter huts and tool workshops, clears their footprint and refunds resources within storage
capacity, merges retired fire variants into forest camp fires, refunds obsolete
research (including Better Tools) and releases redundant jobs. Migration is idempotent. The full retained
catalogue and migration policy are described in [BUILDING_ROLES.md](BUILDING_ROLES.md).

### TutorialSystem and UIManager

A short English modal appears at the start of each season in year one only,
including a new game. `tutorial.lastYear` configures this limit. Starting year two
disables further lessons without pausing simulation; older saves with a pending
second-year message also discard it.
Spring explains food and highlights Hunt/Build. Summer highlights Clear/Herbs and
explains four wood per shelter for winter plus ward herbs. Autumn highlights Tech
and explains fur clothing. Winter highlights Shelter and explains hypothermia,
firewood and forest monsters. Simulation and world commands wait for Got it;
Escape, clicking the backdrop or changing speed cannot bypass acknowledgement.
Skip tutorial disables future briefings in that saved game. Acknowledged seasons,
pending messages and skipping persist across loading; older completed/skipped
tutorials remain skipped. SeasonTutorial manages focus, touch-sized buttons and
compact portrait/landscape layouts. Relevant toolbar controls remain visible and
highlighted but cannot issue orders until the message closes. The summer lesson
temporarily previews a locked Herbs button; the herb counter remains hidden
until a ward is complete. The HUD shows resources,
population, comfort and season progress. The former lower status ribbon and all
its headings, food-duration text and general mode instructions are removed on
both desktop and mobile. Toolbar highlights and the Clear queue count convey
action state; detailed resource explanations remain in tooltips.
Mobile main controls are at least 44 px high; saving, loading and repair remain
available. A previous notification timer cannot hide a newer message.
All interface pictograms are original SVG assets under `public/assets/ui/icons/`,
using the game's timber, parchment, sage and aged-iron palette. Resource counters,
action buttons, villager orders, context menus and building/research costs use the
same typed icon collection. No platform emoji are used. Icons are decorative;
button labels and accessible names remain present, including on icon-only controls.
Job buttons are at least 44 px high. Available jobs use two columns with readable labels and start immediately.
The redundant game heading below the HUD is removed. The HUD always shows pelts and finished coats (worn plus spare). Protective
herbs and their order appear after the ward fire is completed. Tools have no
resource counter or research. Zero tool construction costs are omitted. Coats
and herbs include explanatory tooltips. Research availability refreshes
when opening the panel and when resource/level state changes, without replacing
unchanged controls.

All interface text and Canvas labels use self-hosted PT Sans. Regular, bold and
italic faces are shipped with their OFL license; regular and bold faces load
before the game begins. Fonts use relative asset paths for GitHub Pages and
itch.io and need no third-party requests.

All interface panels, buttons, dialogs, input fields and progress tracks have
square corners. Canvas information labels use rectangles as well.
`TooltipController` explains every top-bar resource/stat and the Tech, sound,
save and load controls on hover or keyboard focus. Tapping a stat also opens its
tooltip. Food shows current consumption/reserve duration; research explains the
winter-only star schedule. Stable counter nodes prevent flickering when values
update. Tooltips are kept inside the viewport and close on pointer exit/Escape.

### ForecastSystem

Winter Plan has been removed from both mobile and desktop interfaces, including
its DOM and styles. `ForecastSystem` remains an internal estimate used for food
targets and actionable warnings: consumption, crop readiness, remaining firewood,
coats and ward coverage. It requires harvest labor before counting a crop yield.
Future hunts, arrivals, weather and storage interruptions can change the result.
Resource tooltips and warnings remain available on every screen size. The ward
fire itself always displays stored herbs out of the configured four needed per
winter, including when unlit.

### SoundManager and AnalyticsSystem

Seasonal nature ambience uses loudness-balanced AAC files (`spring.m4a`,
`summer.m4a`, `autumn.m4a`, `winter.m4a`), each near -24 LUFS before the
configured `sounds.season` gain, or -30 LUFS at the default gain. Short isolated
peaks are limited before encoding so quiet autumn/winter recordings can be
raised without harsh spikes. The original MP3 source recordings are retained.
Hunting and construction use balanced `hunt.m4a` and `building.m4a` recordings
to control their isolated peaks.
Action gains in `game-balance.json` bring cues near -28 LUFS (Herbs near -29),
keeping actions audible over the background without large volume jumps.
The offline audit uses K weighting and loudness gating from
[ITU-R BS.1770](https://www.itu.int/rec/R-REC-BS.1770/en).
`scripts/audio-checks.mjs` verifies the decoded recordings at their actual
configured playback volumes, seasonal consistency and mute behavior.
Accepted Herbs orders
play a short foliage-rustle cue (`assets/sounds/herbs.wav`) at the configured
`sounds.herbs` volume. Sound-off suppresses it. The deterministic sound source
is `scripts/generate-herbs-sound.mjs`. Loading and restarting
restore the appropriate music. Optional analytics/email endpoints are independent
of gameplay; regression checks block third-party requests and never send email.

### WarningSystem

Persistent actionable warnings show a food deficit until spring, crops that
cannot mature before frost, missing coats before winter, inadequate ward fuel
and residents freezing outdoors. Cold warnings take priority, show estimated
remaining exposure time, and recommend Shelter. They appear in red at the
upper part of the screen in a compact 14 px persistent alert, horizontally
centred and kept below the measured HUD. Notice text does not intercept
world input; accessible 44 px close controls remain interactive. Warm clothing, shelter, food
or herbs resolve their respective warnings; ordinary counter updates do not
cause repeated notification toasts. Warnings adapt to the measured HUD height
and remain available on narrow screens.

`Notifications` owns transient messages, settlement warnings and the compact cold
alert. Each has a close button usable with touch and keyboard. Dismissing a warning
hides it for that continuous danger episode, even as counters and countdowns
change. Resolving the condition permits a later new warning; an ordinary warning
also reappears if it escalates to urgent. A dismissed toast's timer is cancelled,
and subsequent messages can appear normally. Starting or loading a game resets
dismissals. Hidden warnings release their reserved layout height immediately.

On narrow screens (at most 900 px) or devices with a coarse primary pointer,
only one ordinary warning is shown at a time, with urgent notices first. An
active cold alert hides ordinary warnings; a new Tech reward also defers them
until acknowledged. Dismissing or resolving the leading notice reveals the next
applicable warning, preserving per-episode dismissals. Resizing or changing
orientation re-evaluates this presentation immediately.

Routine successes are silent on these devices: accepted orders, tree queue
additions, successful shelter/resume, finished repairs, population growth,
harvests, coat production, full-storage hints and hunting/herb deliveries. Resource counters,
resident activity and construction visuals still update. Errors, expedition
losses, deaths, important manual-save feedback and new Tech stars remain visible.
The delivery/loss distinction comes from the expedition system, not message-text
matching. Desktop retains routine feedback.

Calendar-only season/year and spring-autosave toasts are omitted; the HUD still
shows the current season and year, and spring autosaves still run. Awarding winter
research displays the actual new star count and explains that Tech can unlock a
new building. This message remains until dismissed or Tech opens; ordinary toasts
and old timers cannot overwrite it. An Open Tech button leads directly to research,
with the same 44 px touch target as its close control. The one-star/two-star
schedule and saved duplicate-reward protection remain unchanged. Cold and other
settlement warnings remain separate from this announcement.

On mobile the bottom toolbar uses two balanced grid rows with identical left and
right edges. Visibility changes for Herbs and Release one recompute button spans;
all visible buttons stretch to their row height and remain at least 44 px tall.
A resize observer measures toolbar height to keep nearby controls above it.

## Controls and hosting

Click/tap a resident and choose an available job to start it immediately. Stop
keeps the selected resident waiting. Click/tap empty world space to dismiss
selection and open menus. Click/tap buildings without a resident selected for general
actions. Drag to pan, scroll/pinch or use +/−
to zoom, and use the home button to center the village. Space pauses; Escape or
right-click cancels placement. Orders remain available while paused.
Clear immediately expands the village clearing in radial bands and enables tree clicks to form an
ordered queue. Click Clear again, use Escape/right-click, or click empty ground
to finish selecting; queued work continues. Shelter calls everybody
home; the same button becomes Resume and releases them. Release one keeps
everyone else sheltered. Click a completed tower and choose Garrison tower to
send a resident into it. Moat allows repeated single-cell placement.

`npm run build` type-checks and builds `dist/` for GitHub Pages. `npm run build:itch`
also verifies an itch.io package using relative paths. No backend is required for
gameplay. See [PLAYTEST.md](PLAYTEST.md) for browser checks and
[ART_ASSETS.md](ART_ASSETS.md) for generated artwork and prompts.

Link previews are declared in the static HTML so crawlers do not need JavaScript.
Twitter/X uses the supplied square artwork with a summary card; Open Graph uses
the landscape artwork first and includes the square image as an alternative.
Both are compressed JPEGs in `public/assets/social/`, preserving their original
dimensions. Metadata uses absolute HTTPS URLs for the published GitHub Pages site
at `https://buildtounderstand.dev/thevillage/`; game asset paths remain relative
for GitHub Pages and itch.io.

## Automatic work priority

`WorkforcePolicy` preserves farmers for generic commands and ranks available
residents consistently. Automatic allocation uses idle residents or workers
performing repeating forest clearing, excluding stopped, sheltered and cargo-
carrying residents. Outside winter it staffs one farmer per completed empty
garden, then supplies builders for unbuilt gardens. Next it assigns one worker
per damaged building when repair wood and a path are available, then workers for
other construction. Repair costs are charged only after dispatch succeeds.
`gameplay.automaticGardenWorkers` configures the default one-farmer coverage;
manual assignments can still use the configured garden capacity of two.
Generic Hunt, Herbs, Clear, repair, construction and production assignments do
not remove farmers. Explicit individual orders can replace their job. Food and
repair orders reclaim automatic woodcutters before interrupting other jobs.


### Route rejection before A*

`WalkableRegions` caches connected walkable areas so residents can reject
impossible work assignments before running A*. This avoids repeating full-grid
searches for every idle resident behind a closed palisade. Tile-map revision,
open gates, unfinished palisades and shelter footprints invalidate the cache.
A* still constructs every accepted movement path. A resident standing on a newly
blocked tile can still try walking out; temporary resident collisions are handled
by the existing movement system rather than the region cache.


### Painted palisades, gate controls and tower placement

An upgraded House has six actual shelter places; all six residents can enter the
same home. Reinforced palisades use generated summer/winter timber-panel PNGs.
`FenceSprites` projects each panel between the existing half-tile endpoints and
covers the shared centre post, preserving straight lines, all corners and
junctions. Ordinary fences and missing-image cases retain their Canvas rendering.

Gates use four generated sprites: closed/open for summer and winter. The source
variants share their post anchors; affine projection aligns those posts with the
same fence endpoints in both grid axes. Upgraded gates retain the same state
images at a stronger post height. Click the visible model of a completed gate and choose Open gate or
Close gate. This acts immediately, including on pause and during shelter mode,
and needs no worker. Closing recalculates any route crossing the gate. Gate state
persists in saves, and loading restores walkability before a simulation tick.
Legacy resident toggle-gate tasks still finish through the same control.

Guard towers may touch palisade walls and gates. The rule is symmetric: a fence
or gate can also be built next to an existing tower. Overlap, fully blocked tower
entrances and ordinary building spacing are still rejected. The exception is
configured as `adjacentBuildingExceptions` on the tower; moats retain their
terrain placement rules.
