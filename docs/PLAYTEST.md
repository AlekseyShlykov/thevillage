# Playtest and regression checks

Recorded 2026-11-16. All 96 browser checks passed, without sound.

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
| retired workshop refunds once and releases its workers on load | PASS |
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
| permanent personal tools require no workshop, stock or replacement | PASS |
| all healthy farmers work at full speed without spare tools | PASS |
| raw pelts must be crafted and clothing wears by winters per person | PASS |
| cold kills unclothed residents, shelter warms them and worn coats protect | PASS |
| crops ripen after 1.125 calendar seasons, 25% faster | PASS |
| winter destroys every unharvested crop and sowing resumes only in spring | PASS |
| ripe crops wait for storage and partial harvests cannot duplicate food | PASS |
| science comes only from survived winters: five single stars then doubles | PASS |
| hunting cargo persists without aliasing or early deposits and death loses it | PASS |
| a stranded carrier retries delivery after a house is rebuilt | PASS |
| winter forecasts distinguish clothes, cargo and crops that cannot mature | PASS |
| background clicks dismiss selection and every auxiliary menu | PASS |
| herbs unlock only after a completed ward; tools never clutter resources | PASS |
| construction offers one cancel action and a distinct close control | PASS |
| a garden builder becomes its farmer and harvested food enters storage | PASS |
| a fur workshop builder sews wearable coats and the resource survives loading | PASS |
| food and lethal cold warnings remain visible until the danger is resolved | PASS |
| herb gathering goes ten to thirty forest tiles deep and can be fatal | PASS |
| spring automatically releases residents and restores their saved jobs | PASS |
| a monster takes much longer to destroy a building | PASS |
| generated rake, axe and hammer load with distinct animated work poses | PASS |
| expanded resources and job cards fit phone, tablet and desktop screens | PASS |
| global Hunt and Herbs interrupt employed workers immediately | PASS |
| Clear immediately finds the nearest tree and continues with the next one | PASS |
| one resident leaves shelter and receives a job while everyone else stays inside | PASS |
| a carrier completes delivery before a queued manual hunting order | PASS |
| annual farming, clearing and unfinished construction resume but expeditions do not | PASS |
| injured residents regenerate past the healthy threshold up to full HP | PASS |
| finished moat is walkable and slows monsters exactly sixfold; unfinished ditch does not | PASS |
| only an occupied tower fires; its occupants shelter from cold and retain upgraded durability | PASS |
| garrison commands send different residents into a tower while the settlement shelters | PASS |
| moats can surround every side of a house without blocking residents | PASS |
| a spring delivery resumes last year farming rather than another expedition | PASS |
| garden construction is four times quicker and crops another quarter quicker | PASS |
| generated cargo and tower artwork load; ward stock is drawn directly on the fire | PASS |
| mobile toasts and warnings close with touch and stay dismissed during the same danger | PASS |
| dismissed warnings return for greater urgency; central cold alerts are also dismissible | PASS |
| both mobile toolbar rows have identical edges for every resource and shelter state | PASS |
| Shelter fills tower places first and keeps a configured home reserve | PASS |
| recall moves residents already inside a house into both towers and keeps the home group | PASS |
| unreachable towers fall back to homes; tower-only settlements still use free places | PASS |
| monster damage cannot destroy a finished moat or unfinished ditch, but manual demolition works | PASS |
| painted moat covers all sixteen adjacency patterns with matching open mouths | PASS |
| moat joins refresh after construction, demolition and save loading | PASS |
| moat artwork renders bends, junctions, winter and missing-asset fallback | PASS |
| Spring briefing highlights Hunt and Build and gates simulation until Got it | PASS |
| season changes require acknowledgement and show the matching controls | PASS |
| season acknowledgement, pending modal and Skip tutorial survive save loading | PASS |
| mobile season modal keeps Got it and Skip reachable in portrait and landscape | PASS |
| heating consumes exactly four wood per completed shelter per winter | PASS |
| unheated shelters slow hypothermia while fuel restores warming | PASS |
| winter forecast and warnings include remaining firewood and indoor hypothermia | PASS |
| midwinter save loading charges only the remaining winter fuel | PASS |
| Clear starts busy residents immediately and accepts many tree clicks without duplicates | PASS |
| queued trees are chopped in click order before automatic nearby trees | PASS |
| clearing queue survives loading and spring recall; workers reserve distinct targets | PASS |
| unreachable queued trees do not block reachable work and older marks still work | PASS |
| Clear, Escape, right-click and background exit selection without deleting queued work | PASS |
| mobile Clear starts chopping, taps queue trees and camera drags do not add work | PASS |
| no unhandled browser exceptions | PASS |

## Gameplay and UX observations

The first year was completed through visible controls: acknowledge Spring, press Clear, hunt, build a
garden, and wait for its builder to sow and harvest. Crops mature over 1.125 calendar
seasons. Shelter protected unclothed residents; spring automatically restored work,
awarded one star and autosaved. Food remained after winter. Winter plan budgets
consumption before winter as well as during it, plus heating wood.

Available jobs start with one click and replace only the selected resident's
previous task. Unavailable farm, craft, repair and construction jobs are absent.
Background clicks clear selection and dismiss construction, research and forecast
panels while residents continue working. Construction offers Cancel construction
and a distinct Close control. Tools have no resource counter or unlock. Herbs
appear only after a ward is built; finished coats include coats already worn.
The redundant heading and oval cottage shadow are gone.

A newly built garden retains its builder as a farmer. A ripe crop delivered 45
food to storage; full storage preserved partial remaining yield through saving.
A newly built fur workshop retained its builder, consumed pelts, made coats and
issued them to residents; the visible coat counter and worn equipment survived
loading. Production waits for ingredients rather than pre-completing recipes.

Persistent warnings cover food deficits and lethal cold. A resident with 16 cold
exposure-seconds received a warning with approximately 14 seconds remaining.
The warning is red, centred on both screen axes and does not capture clicks.
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
`scripts/ux-checks.mjs`; direct orders, annual work and defenses are checked in
`scripts/defense-checks.mjs`; immediate clearing, ordered tree selection, saved queues
and touch input are covered by `scripts/forest-clearing-checks.mjs`. Close test Chrome and temporary servers after checking;
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

## Timber tower, moat and direct orders

Occupied towers fired only with residents inside, shelter prevented cold, and
legacy towers kept their HP fraction while upgrading to 360 maximum HP. Garrison
commands reserved different residents and worked while the rest of the settlement
was sheltered. Finished moats slowed monsters exactly sixfold; unfinished moats
did not. Full house surrounds remained walkable and trenches were not targets.

Hunt and Herbs reassigned employed workers and released their old rosters. A
carrier delivered supplies before starting an accepted queued order. Clear found
the nearest tree immediately and continued to the next one. Farming, clearing
and unfinished construction resumed in spring; hunts did not. An overdue spring
carrier returned to last year's farming after delivery. Injured residents healed
past the halfway health threshold all the way to full HP.

Generated herb and hunting baskets and the timber tower loaded locally. The ward
label displayed Herbs 3/4 for winter. Garden construction uses one quarter of
its previous time and biological crop growth is another 25% shorter. Workshop
removal refunded wood and obsolete research exactly once on repeated loading.

The final compiled build `index-B-5_UBht.js` passed silent checks on
`http://localhost:4173/`: startup, immediate jobs, hidden herbs before a ward,
removed tool counter, background dismissal, shelter toggle, square controls,
tooltips and loaded interface art. All four local PT Sans faces loaded, and
390/768/900/1024/1280 px layouts had no horizontal overflow. The itch archive
contains all three new generated sprites, fonts and the current balance JSON.
Temporary test Chrome and the development server were closed; localhost:4173
remains running with the latest compiled build.

## Mobile notices and tower-priority recall

All 79 silent browser checks passed after the mobile changes. Touch taps closed
ordinary toasts, persistent settlement warnings and the central cold alert without
deselecting a resident underneath. Dismissals survived changing countdowns and
resource totals; a resolved/new danger or an escalation showed warnings again.
Hidden warning cards immediately released their layout height.

Toolbar checks covered 320, 360, 390, 430, 600, 768, 900 and 1280 px with initial,
Herbs and Shelter/Release one states. Mobile rows had identical left/right edges,
no clipped labels and at least 44 px button height. Screenshots:
`mobile-toolbar-aligned.png`, `mobile-notices-before.png`,
`mobile-notices-dismissed.png`.

Recall reserved 25% of residents (at least one) for ordinary homes, filled towers
up to three residents each, and sent the rest home. Eight residents with two
towers physically reached six tower places and two home places. An inaccessible
tower fell back to homes; a settlement with only a tower used its free places.
Moats rejected repeated damage even while unfinished and remained outside enemy
target lists; manual demolition still cleared the ground.

The final production localhost build also passed touch dismissal and aligned
mobile-row checks after compilation. Eighteen additional mobile layout variants
confirmed consistent icon placement and hidden unavailable buttons. All tests
ran muted; temporary browser/server processes were closed after verification.


## Connected moat art, seasonal lessons and winter heating

All 90 browser scenarios passed silently. Six generated terrain sprites covered
all sixteen orthogonal connection masks. Painted mouths had matching opaque water
at each join. Corners and branches refreshed after adding/removing a section and
loading a save; unfinished neighbours also connected. The 34-section village scene
was reviewed in spring and winter. Shape fallbacks rendered every mask. Captures:
`moat-connected-spring.png`, `moat-connected-winter.png`.

Spring, summer, autumn and winter each required Got it before time or residents
advanced. The actual Hunt/Build, Clear/Herbs, Tech and Shelter controls received
highlights. Summer previewed the locked herb order without revealing herb stocks.
Acknowledgements, a pending briefing and Skip tutorial survived save/load; a new
year displayed its spring message. Escape and Space did not bypass the lesson.
Touch acknowledgement worked at 390 × 844 and 844 × 390; both action buttons were
at least 44 px tall, and landscape text retained a readable scrolling area.
Captures: `season-briefing-spring.png`, `season-briefing-summer.png`,
`season-briefing-mobile.png`, `season-briefing-landscape.png`.

Two completed shelters consumed exactly eight wood over a winter; unfinished
homes and non-winter seasons used none. Fuel exhaustion disabled warming, and
adding wood restored it. Unheated indoor cold could kill an unclothed resident
while coats slowed exposure. The half-winter forecast requested two wood for one
shelter. Warnings distinguished indoor fuel shortages from outdoor recall.
A midwinter save charged only the remaining fuel after loading.

The compiled localhost build passed startup acknowledgement plus the existing
jobs, mobile dismissal, toolbar alignment, typography and layout checks with no
browser exceptions. The local preview uses `index-B-5_UBht.js`; both distribution
folders contain the moat atlas and heating configuration. Tests remained muted.


## Immediate clearing and selectable tree queue

All 96 scenarios passed without sound. Clicking Clear immediately interrupted a
busy farmer, started a valid chopping path and enabled persistent selection. Six
canvas tree clicks queued six tiles in click order; clicking one again added no
duplicate. The current automatic tree finished first, then all six explicit trees
were cut in the selected order before automatic nearest-tree work resumed. Each
tree awarded wood once and removed its queue metadata.

A 25-tree queue retained order after saving/loading and spring recall. Two workers
reserved separate trees. An unreachable first request stayed queued while reachable
work proceeded, and older saved tiles with only a marked flag remained usable.
Clear, Escape, right-click and clicking empty ground exited selection without
cancelling current work or deleting the queue. The first-year playthrough also
verified that a resident could still be selected after pressing Clear.

On a 390 × 844 touch viewport, Clear started chopping, three taps added three
trees, and dragging the camera added none. A queued tree was then reached and
cut in the actual simulation. Desktop/mobile numbered markers were reviewed in
`forest-clearing-queue.png` and `forest-clearing-queue-mobile.png`.
The production build on localhost:4173 also accepted three actual canvas tree
clicks and toggled selection off while keeping its queue. It passed the existing
font, menu, touch-dismissal and layout checks without browser exceptions.
`npm run build:itch` passed and the local itch archive was refreshed.
