# Playtest and regression checks

Recorded 2026-11-16. All 59 browser checks passed, without sound.

## Browser coverage

Dedicated headless Chrome on macOS, 1280 × 900 desktop and 390 × 844 mobile
emulation at DPR 2. Additional layout checks: 390, 768, 900, 1024 and 1280 pixels.
The runner uses Canvas clicks, actual buttons and touch events, with simulation
time advanced between actions. Physical phones, Safari and Firefox were not tested.
Third-party requests are blocked; no production analytics or emails are sent.

| Check | Result |
| --- | --- |
| custom interface artwork loads and buttons keep accessible labels | PASS |
| projection and zoom round-trip | PASS |
| first year through visible controls | PASS |
| winter save restores active wave and timers | PASS |
| pause accepts villager orders immediately | PASS |
| selected villager sees available jobs and starts them immediately | PASS |
| selected worker builds and repairs without stealing other workers | PASS |
| tools animate distinct work poses and freeze while paused | PASS |
| walking uses continuous steps with eased starts and stops | PASS |
| retired buildings migrate without ghost tiles or lost research | PASS |
| hunters reach ten to twenty tiles inside forest and bring back fur | PASS |
| production persists and workshop respects its recipe timer | PASS |
| remaining production and passive buildings provide useful effects | PASS |
| winter totals grow gradually from one to twenty-five independently of village level and reloads | PASS |
| all scheduled winter enemies arrive while earlier waves survive | PASS |
| one shelter button recalls and releases everyone with resident-only smoke | PASS |
| smoke animates only in occupied houses and crops show seven stages | PASS |
| generated garden and ward sprites render, animate and retain shape fallbacks | PASS |
| fence corners connect in both axes and gates have open and closed models | PASS |
| monsters destroy all defenses before gardens and houses | PASS |
| herbal ward unlocks through research and blocks an eleven by eleven square | PASS |
| top bar tooltips remain stable while values update and all interface corners are square | PASS |
| 50 visible villagers render within a playable frame budget | PASS |
| winter remains playable with 55 villagers, a connected fence and 14 monsters | PASS |
| mobile menus remain reachable and touch camera works | PASS |
| existing researched buildings appear in the build menu | PASS |
| an open build menu updates when resources arrive | PASS |
| missing artwork still renders a usable world | PASS |
| a defending worker resumes their production job | PASS |
| repair keeps research bonuses and clears maintenance warnings | PASS |
| older winter saves remain playable | PASS |
| all winter weather types can occur and cooldown saves correctly | PASS |
| herb orders reserve at most five supplies including expeditions | PASS |
| gathered herbs arrive only when a living gatherer reaches home | PASS |
| one ward per village includes unfinished construction and survives saving | PASS |
| four herbs fuel exactly a winter and an empty fire provides no field | PASS |
| tools are issued individually and wear only during work | PASS |
| one resident gets the tool bonus while their neighbour works at base speed | PASS |
| raw pelts must be crafted and clothing wears by winters per person | PASS |
| cold kills unclothed residents, shelter warms them and worn coats protect | PASS |
| crops grow for 1.5 calendar seasons regardless of farmers and tools | PASS |
| winter destroys every unharvested crop and sowing resumes only in spring | PASS |
| ripe crops wait for storage and partial harvests cannot duplicate food | PASS |
| science comes only from survived winters: five single stars then doubles | PASS |
| hunting cargo persists without aliasing or early deposits and death loses it | PASS |
| a stranded carrier retries delivery after a house is rebuilt | PASS |
| winter forecasts distinguish clothes, cargo and crops that cannot mature | PASS |
| background clicks dismiss selection and every auxiliary menu | PASS |
| herbs and worn coats are resources while tools wait for their unlock | PASS |
| construction offers one cancel action and a distinct close control | PASS |
| a garden builder becomes its farmer and harvested food enters storage | PASS |
| a fur workshop builder sews wearable coats and the resource survives loading | PASS |
| food and lethal cold warnings remain visible until the danger is resolved | PASS |
| herb gathering goes ten to thirty forest tiles deep and can be fatal | PASS |
| spring automatically releases residents and restores their saved jobs | PASS |
| a monster takes much longer to destroy a building | PASS |
| generated rake, axe and hammer load with distinct animated work poses | PASS |
| expanded resources and job cards fit phone, tablet and desktop screens | PASS |
| no unhandled browser exceptions | PASS |

## Gameplay and UX observations

The first year was completed through visible controls: mark trees, hunt, build a
garden, and wait for its builder to sow and harvest. Crops mature over 1.5 calendar
seasons. Shelter protected unclothed residents; spring automatically restored work,
awarded one star and autosaved. Food remained after winter. The tutorial budgets
consumption before winter as well as during it.

Available jobs start with one click and replace only the selected resident's
previous task. Unavailable farm, craft, repair and construction jobs are absent.
Background clicks clear selection and dismiss construction, research and forecast
panels while residents continue working. Construction offers Cancel construction
and a distinct Close control. Tools are hidden until workshop research or existing
tools; herbs and finished coats have resource counters, including coats already worn.
The redundant heading and oval cottage shadow are gone.

A newly built garden retains its builder as a farmer. A ripe crop delivered 45
food to storage; full storage preserved partial remaining yield through saving.
A newly built fur workshop retained its builder, consumed pelts, made coats and
issued them to residents; the visible coat counter and worn equipment survived
loading. Production waits for ingredients rather than pre-completing recipes.

Persistent warnings cover food deficits and lethal cold. A resident with 16 cold
exposure-seconds received a warning with approximately 14 seconds remaining.
Shelter resolved that warning. Desktop and mobile captures were inspected:
`ux-jobs-390.png`, `ux-jobs-1280.png`, `cold-danger-warning.png`,
`ripe-harvest-ready.png`, `fur-workshop-coat-produced.png`, `resources-coats-herbs.png`.

Herb expeditions reserve a slot before leaving, travel 10–30 tiles inside forest,
and can die with no loot delivered. Stored herbs plus expeditions never exceed
five. Four herbs fuel a 120-second winter; a fifth remains spare. One ward fire
is enforced even during construction. Fuel timers survive loading.

Spring restored farmer, fur-worker and hunter jobs from a loaded shelter save;
the restored hunter retained the deep forest destination. Construction, repairs,
clearing and herb jobs are also recorded. Dead residents and destroyed workplaces
are skipped. Existing older building-only job saves remain readable.

## Enemies, artwork and performance

Winter counts follow `1,2,3,4,6,7,8,10,11,12,14,15,16,17,20,21,22,25`, then remain
at 25. Years 1–18 and 20 were checked at village levels 1, 3 and 5, including new,
legacy and between-wave reloads. With earlier waves alive, 9, 8 and 8 monsters
arrived at seconds 8, 38 and 68 in winter 18. A monster dealt eight building HP
across twelve seconds, reflecting the slower two-HP strike every three seconds.
Monsters still breach available palisades before attacking houses and crops.

All 37 SVG interface illustrations loaded. Generated transparent rake, axe and
hammer sprites loaded from `public/assets/tools/` and were inspected in animated
poses (`work-poses.png`). Seven crop stages, animated herbal fire, inhabited-only
chimney smoke, connected fences/gates, smooth walking and missing-image fallbacks
remain covered. UI text contains no emoji.

55 visible residents: mean combined update/render 5.8 ms,
95th percentile 7.7 ms over 40 frames. Winter with 55 residents,
36 fence segments and 14 monsters: mean 10.5 ms, 95th percentile
24.6 ms over 50 frames. Results vary by device and browser.

## Reproduce

Requires Node 22 or newer, Vite and a separate test Chrome profile.

```sh
npm run dev -- --host 127.0.0.1 --port 4174 --strictPort
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --mute-audio --no-first-run \
  --user-data-dir=/tmp/winter-village-qa --remote-debugging-port=9461 about:blank
GAME_URL=http://127.0.0.1:4174/ node scripts/browser-check.mjs
```

`CHROME_URL` overrides the debugging endpoint. Ordinary checks also mute page
playback and disable game sound before starting. Only when explicitly checking
sound, omit the Chrome mute flag and use `CHECK_AUDIO=1`.
The runner modifies only its dedicated profile and writes ignored `.qa/results.json`
and screenshots. Economy and UX scenarios live in `scripts/economy-checks.mjs` and
`scripts/ux-checks.mjs`. Close test Chrome and temporary servers after checking;
leave the user's localhost preview running.

## Release builds

```sh
npm run build:itch
```

Creates the relative-path GitHub Pages build in `dist/` and verified itch.io
files in `itch-build/`. The compiled bundle is also checked at
`http://localhost:4173/`: immediate orders, background dismissal, resource unlocks,
shelter toggle, tooltips and interface art. Build output is not published by
these commands.

## PT Sans verification

The compiled localhost build loaded all four bundled PT Sans faces. Cyrillic
loading succeeded, and all interface buttons/counters used PT Sans. Widths
390, 768, 900, 1024 and 1280 had no horizontal overflow. The compiled startup,
immediate orders, dismissal, shelter and tooltips checks also passed without
sound or browser exceptions after the font change.
