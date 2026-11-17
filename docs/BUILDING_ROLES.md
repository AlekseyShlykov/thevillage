# Building catalogue review

Reviewed against the running simulation on 2026-11-17. Current values are in
`public/data/game-balance.json`; descriptions in the build menu explain each role.

| Building | Purpose | Worker requirement |
| --- | --- | --- |
| Hut | Four shelter places; the inexpensive first housing | None |
| House | Six shelter places and additional comfort | None |
| Large House | Eight shelter places and a larger comfort bonus | None |
| Garden | Sowing and harvest around a 1.125-season growth cycle; frost kills unharvested crops | Builder stays as farmer; up to two farmers, none needed during growth |
| Sawmill | Steady wood near forest; improved nearby tree-clearing yield; a completed mill is required for tower research | Up to three lumberjacks |
| Fur Workshop | Converts raw pelts into personal coats lasting three winters | Builder stays as craftsperson; up to two craftspeople |
| Smokehouse | Reduces the entire village's food consumption | Passive; removed misleading worker slot |
| Storage | Raises wood, food, raw fur capacity; herbs remain capped at five | None |
| Palisade Wall | Physical defense; monsters attack it before houses or crops | None after construction |
| Palisade Gate | Opens a passage through connected defenses | A resident operates it; no permanent worker |
| Forest Camp Fire | Builds directly in forest; nearby warning, comfort, light and one shelter place | None |
| Timber Guard Tower | 360 HP, three shelter places, detection and ranged defense | Sheltered residents fire arrows: 18 damage each every 1.25s within seven tiles |
| Moat | Indestructible connected trench; monsters cross six times slower, residents cross normally | Builder digs each section, no permanent worker |
| Herbal Ward Fire | One per village; burns four herbs per winter to protect its 11 × 11 square | None after construction; residents gather herbs through an order |

Removed Hunter Hut: it produced food and fur with workers standing beside the
building, bypassing real forest expeditions. The existing Hunt command now
returns food and two pelts on success, credited only when the hunter gets home.
Raw pelts must be crafted into coats and worn for cold protection. This preserves the fur/clothing economy
without another building doing the same job.

Merged Scout Fire into Forest Camp Fire: both had a detection radius of five,
and assigning a scout did not actually alter the effect. The remaining camp fire
can now be placed in forest and retains a one-resident shelter.

Merged Bonfire into Forest Camp Fire: the ordinary bonfire had no research or
build-menu unlock. Its warmth/comfort and light now belong to the forest camp.
The Herbal Ward Fire stays separate because it physically repels monsters.

## Older saves

`SaveMigration` applies the data-driven `retiredBuildings` rules before loading.
Hunter huts are removed, their footprint becomes clear ground, their workers are
released, and construction resources are returned within storage capacity.
Ordinary/scout fires become forest camp fires in the same locations. Removed
research is refunded; acquiring the replacement camp-fire research deducts its
cost only if it was not already owned. Idle worker assignments at smokehouses
and watchtowers are also cleared. The next save uses current IDs, so loading it
again does not repeat refunds.

Removed the tool Workshop and Better Tools research: all residents own permanent
tools. Old workshops return 30 wood; removed research returns one and two stars,
respectively, once. Fur Workshop remains because personal warm clothing must
still be sewn from pelts. Old watchtowers become Timber Guard Towers at the same
location, retain their health fraction and gain winter shelter and shooting.

Settlement recall fills towers before other shelters while reserving a home
group: 25% of residents rounded up, at least one. Tower places are reserved only
after pathfinding succeeds, and remaining residents go to ordinary homes.

Each completed hut, house, large house, guard tower and forest camp fire now
requires four wood per full winter for heating, consumed continuously. Empty
shelters also use fuel; unfinished shelters do not. Without wood residents remain
hidden from monsters indoors but accumulate cold at 35% of the outdoor rate.
Actionable warnings and the wood tooltip explain heating shortages. Winter Plan
has been removed on all devices.

Research now starts with Storage, then Fur Workshop / Palisade / Protective Herbs.
All three branch technologies unlock the remaining options. Storage and Palisade
cost one star, the tower costs three (and requires a completed Sawmill), and all
other technologies cost two. Stars arrive at winter start. Fur Workshop now uses
distinct summer and winter workshop sprites. Automatic allocation covers one
farmer per empty garden before repair and construction; generic orders protect
existing farmers. Personal farming orders prefer less staffed plots.

The first completed Timber Guard Tower is now a permanent combat milestone.
Residents cannot harm monsters before it is completed. On completion, living and
future monsters gain double health (30 → 60 by default); existing injuries keep
their percentage. More towers do not compound the bonus, and losing a tower does
not reverse progression. Occupied towers retain their configured 18 damage per
archer and now shoot a generated arrow sprite along an animated flight arc.
