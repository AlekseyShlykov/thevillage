# Building catalogue review

Reviewed against the running simulation on 2026-11-17. Current values are in
`public/data/game-balance.json`; descriptions in the build menu explain each role.

| Building | Purpose | Worker requirement |
| --- | --- | --- |
| Hut | Four shelter places; the inexpensive first housing | None |
| House | Upgrade a Hut in place: six shelter places, 200 HP and additional comfort | One builder during upgrade |
| Garden | Sowing and harvest around a 1.125-season growth cycle; frost kills unharvested crops | Builder stays as farmer; up to two farmers, none needed during growth |
| Sawmill | Steady wood near forest; improved nearby tree-clearing yield; a completed mill is required for tower research | Up to three lumberjacks |
| Fur Workshop | Converts raw pelts into personal coats lasting three winters | Builder stays as craftsperson; up to two craftspeople |
| Storage | Raises wood, food, raw fur capacity; herbs remain capped at five | None |
| Palisade Wall | Physical defense; monsters attack it before houses or crops | None after construction |
| Palisade Gate | Opens a passage through connected defenses | Direct Open/Close action, including while sheltered; no worker |
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

Each completed hut, house, guard tower and forest camp fire now
requires four wood per full winter for heating, consumed continuously. Empty
shelters also use fuel; unfinished shelters do not. Without wood residents remain
hidden from monsters indoors but accumulate cold at 35% of the outdoor rate.
Actionable warnings and the wood tooltip explain heating shortages. Winter Plan
has been removed on all devices.

Research now starts with Storage, then Fur Workshop / Palisade / Protective Herbs.
All three branch technologies reveal Forest Camp Fire, Sawmill, Warm House and the locked tower preview. Storage and Palisade
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


## Compact catalogue and in-place upgrades

Smokehouse, Large House, Hearth and global Reinforced Palisade research are
currently removed from new games. Existing Large Houses become Houses, removed
research/buildings receive their configured migration refund once, and old
reinforced walls retain their individual strength.

Warm House research enables upgrading each existing Hut for 25 wood. The same
2 × 2 home remains usable during construction and becomes a six-place, 200-HP
House. Its new summer/winter art is distinct from the Hut. House has no separate
Build entry. Heating still costs four wood per winter.

Sawmill research and a completed mill allow reinforcing each wall for four wood
and each gate for eight wood. Durability doubles after an on-site builder finishes;
connections and gates remain functional during the work. No extra research card
is needed. Upgrades save, can resume after shelter and can be cancelled without
removing the underlying building.

The tower is visible at the same time as Sawmill. Its card and hover tooltip explain
that researching and completing a Sawmill are required before buying the tower.


Reinforced walls now use painted summer/winter panel sprites with connected
corners and junctions. Gates have distinct generated closed/open sprites in both
seasons, toggled immediately through their context menu by clicking the model. Closing invalidates
routes through the passage; loading restores the selected state without waiting
for an update. Towers alone may touch walls/gates in either placement order;
other building spacing and access rules continue to apply.
