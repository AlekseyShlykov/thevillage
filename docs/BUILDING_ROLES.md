# Building catalogue review

Reviewed against the running simulation on 2026-11-16. Current values are in
`public/data/game-balance.json`; descriptions in the build menu explain each role.

| Building | Purpose | Worker requirement |
| --- | --- | --- |
| Hut | Four shelter places; the inexpensive first housing | None |
| House | Six shelter places and additional comfort | None |
| Large House | Eight shelter places and a larger comfort bonus | None |
| Garden | Sowing and harvest around a 1.5-season growth cycle; frost kills unharvested crops | Builder stays as farmer; up to two farmers, none needed during growth |
| Lumber Camp | Steady wood near forest; improved nearby tree-clearing yield | Up to three lumberjacks |
| Workshop | Converts wood into individual tools with finite work durability | Up to two craftspeople |
| Fur Workshop | Converts raw pelts into personal coats lasting three winters | Builder stays as craftsperson; up to two craftspeople |
| Smokehouse | Reduces the entire village's food consumption | Passive; removed misleading worker slot |
| Storage | Raises wood, food, raw fur and spare tool capacity; herbs remain capped at five | None |
| Palisade Wall | Physical defense; monsters attack it before houses or crops | None after construction |
| Palisade Gate | Opens a passage through connected defenses | A resident operates it; no permanent worker |
| Forest Camp Fire | Builds directly in forest; nearby warning, comfort, light and one shelter place | None |
| Watchtower | Longer detection range than the camp fire; perimeter light | Passive; removed misleading worker slot |
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
