# Playtest and regression checks

Recorded 2026-11-17. All 148/148 browser checks passed without sound.

## Environment and scope

Dedicated headless Chrome on macOS, 1280 × 900 desktop and 390 × 844 mobile emulation at
DPR 2. Additional widths: 768, 900, 1024; landscape phone and touch tablet layouts
are included. The runner uses real Canvas clicks, buttons and touch events with
deterministic simulation steps. Third-party requests are blocked; no analytics
or emails are sent. Physical phones, Safari and Firefox were not tested.

## Current changes

- The upgraded House accepts six actual residents; the complete recall and entry
  scenario passes with all six indoors.
- Generated reinforced fence art loads with real alpha in summer and winter.
  All sixteen connected shapes render distinctly and native fallback remains
  usable. Four gate sprites cover open/closed states and both seasons; the
  painted passage is transparent when open in both grid axes.
- Clicking the visible gate model offers Open gate / Close gate immediately on
  pause and during shelter. Closing removes paths crossing it. Loading either
  state restores routing before an update. Phone actions pass with 44 px targets.
- Towers alone may touch walls and gates in either placement order. Overlap,
  ordinary building spacing and fully blocked entrances are still rejected.

- Compact advanced catalogue: Smokehouse, Large House, Hearth and global
  Reinforced Palisade research are retired. House is an upgrade and never a
  separate Build entry. Forest Camp Fire remains available.
- Real Hut menu clicks start a 25-wood upgrade. A builder reaches the site;
  residents retain shelter during work. The same ID and 2 × 2 footprint become
  a six-place, 200-HP House. Save/load, shelter/resume, cancellation, one-time
  refund and completed worker release all pass.
- Sawmill research and a completed mill unlock individual wall/gate reinforcement.
  Each section doubles HP, preserves damage fraction, gate state, rotation and
  connections, and cannot be upgraded twice. Repairs retain its extra durability.
- Tower preview appears alongside Sawmill. Visible text and a hover title explain
  the missing research/building; it cannot spend stars before mill completion.
  Completing the mill updates the card and an accepted purchase closes Tech.
- Old removed buildings/research migrate once; Large Houses become Houses with
  cleaned excess footprints. Existing globally reinforced walls keep their
  upgrade and damage fraction. Input save snapshots remain unchanged.
- Generated warm-house summer/winter sprites have transparent alpha. Occupied
  homes produce animated chimney smoke; empty homes are stable. Shape fallback
  and phone upgrade actions remain usable and within screen bounds.
- Walkable-region rejection avoids repeated A* searches to unreachable repairs.
  Gates opening/closing, unfinished fences and demolition invalidate correctly.
  The 55-resident winter stress case with 36 wall segments and 14 monsters
  passed at about 10 ms mean frame time after this fix.

- Residents inflict no monster damage before a completed tower, including after
  research or placement of an unfinished tower. Completing the first tower
  enables melee/ranged defense and scales living monsters from 30 to 60 maximum
  HP, preserving injury fractions; subsequent towers do not scale again.
- Later waves and winters keep the stronger monsters after tower demolition.
  Current saves avoid repeat scaling; legacy saves with a tower migrate once
  without mutating their snapshot. Loading an early save and restarting clear
  progression correctly.
- Generated projectile artwork loads with alpha and renders in real tower shots.
  Flight progresses along its arc, rotates in all tested directions, freezes
  when paused and expires at the configured flight time. A shape fallback works
  without the PNG. Launch/middle/arrival screenshots were reviewed in winter.

- The lower status ribbon and every heading/countdown in it are removed on
  mobile and desktop. Queue length is on Clear (for example, Clear (3)); active
  command and shelter states still update.
- Mobile/touch layouts show one ordinary warning at a time, prioritizing urgent
  heating. Cold alerts and new Tech rewards defer ordinary warnings. Dismissals
  reveal the next relevant warning without reviving an already dismissed one.
- Successful orders, queued trees, deliveries, harvests, coat production and
  full-storage hints no longer create phone toasts. Commands and resource
  transfers still work; actual failures, deaths and new Tech stars remain visible.
- Switching between desktop and touch presentation compacts notices during the
  next UI update, including browsers which delay media-query change events.

- Winter Plan is absent from the DOM on every tested screen size; warnings still
  use the internal economy estimate. Cold alerts are 14 px, horizontally centred
  above the play area centre and dismissible on touch screens.
- Generic Hunt, Herbs, Clear, repair and construction preserve farmers. Explicit
  selection allows changing their job. Two individual farming commands choose
  two different reachable plots when available; assignments survive loading.
- Idle/automatic woodcutting labour goes first to gardens, then repairs, then
  other construction. One farmer per available garden is the automatic default.
- Research begins with Storage, exposes the three essential technologies next,
  and gates advanced research until all three are owned. A tower needs a completed
  Sawmill plus its research and three stars. Storage and Palisade cost one; all
  others cost two. Purchasing closes Tech.
- Stars arrive on entering winter. Reloading, spring transitions and older winter
  save migration cannot duplicate awards. All existing migration checks pass.
- Fur Workshop summer/winter images load with real alpha; missing-image fallback
  draws a distinct work bay. Only garden depth changes; taller buildings still
  occlude residents along their rear edge.
- Winter moat uses its snow atlas across all sixteen adjacency masks and 32 open
  mouths. Fence/gate winter rendering adds snow to caps, rails and bases; sample
  comparison found more than 900 snowy pixels versus zero in the warm version.
- Herbs sound decodes to a valid 0.55-second rustle (RMS 0.0456), plays on an
  accepted order at configured volume and is suppressed by Sound Off. The test
  uses a muted playback spy; speakers remain silent.

## Existing coverage retained

The first-year survival playthrough, cargo delivery, crop growth/harvest, coats,
heating, shelter allocation, forest depth/risk, circular clearing and its manual
queue, winter enemy schedule, defense priorities, indestructible moats, towers,
seasonal briefings, touch menu rows, tooltips, fonts, save migration and rendering
with 50+ residents continue to pass.

Circular clearing follows A* paths, expands around the village, and skips old
long corridors. Explicit queued trees still override automatic selection.

## Browser scenario results

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
| repair keeps individual palisade upgrades and clears maintenance warnings | PASS |
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
| science arrives at winter start: five single stars then doubles | PASS |
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
| global Hunt and Herbs preserve farmers while redirecting other workers | PASS |
| Clear immediately starts expanding the settlement and continues chopping | PASS |
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
| cold takes priority on mobile; dismissed warnings still return for greater urgency | PASS |
| both mobile toolbar rows have identical edges for every resource and shelter state | PASS |
| Shelter fills tower places first and keeps a configured home reserve | PASS |
| recall moves residents already inside a house into both towers and keeps the home group | PASS |
| unreachable towers fall back to homes; tower-only settlements still use free places | PASS |
| monster damage cannot destroy a finished moat or unfinished ditch, but manual demolition works | PASS |
| painted moat covers all sixteen adjacency patterns with matching open mouths | PASS |
| moat joins refresh after construction, demolition and save loading | PASS |
| moat artwork renders bends, junctions, winter and missing-asset fallback | PASS |
| Spring briefing highlights Hunt and Build and gates simulation until Got it | PASS |
| only first-year season changes require acknowledgement and matching controls | PASS |
| season acknowledgement, pending modal and Skip tutorial survive save loading | PASS |
| old second-year tutorial saves load without a modal or simulation gate | PASS |
| mobile season modal keeps Got it and Skip reachable in portrait and landscape | PASS |
| heating consumes exactly four wood per completed shelter per winter | PASS |
| unheated shelters slow hypothermia while fuel restores warming | PASS |
| winter forecast and warnings include remaining firewood and indoor hypothermia | PASS |
| midwinter save loading charges only the remaining winter fuel | PASS |
| Clear redirects a busy non-farmer and accepts many tree clicks without duplicates | PASS |
| queued trees are chopped in click order before automatic nearby trees | PASS |
| clearing queue survives loading and spring recall; workers reserve distinct targets | PASS |
| unreachable queued trees do not block reachable work and older marks still work | PASS |
| Clear, Escape, right-click and background exit selection without deleting queued work | PASS |
| mobile Clear starts chopping, taps queue trees and camera drags do not add work | PASS |
| 120 automatic cuts with real path movement expand all sides of the village without tunnels | PASS |
| a loaded old corridor draws workers back around the village while explicit distant clicks still win | PASS |
| multiple woodcutters reserve distinct trees and keep a broad clearing after 120 cuts | PASS |
| season changes avoid calendar toasts and preserve the new Tech star announcement | PASS |
| later winter rewards announce two stars and loading cannot announce or award them twice | PASS |
| Winter plan is absent on phones, tablets and desktop | PASS |
| mobile Tech star notice opens Tech or closes with a touch-sized dismiss button | PASS |
| research starts with Storage, closes after purchase and gates the advanced branch | PASS |
| research is awarded before winter work and legacy winter saves receive it only once | PASS |
| generic commands never take farmers; explicit selection can redirect one | PASS |
| automatic food and repairs reclaim woodcutters before other construction | PASS |
| a stale repair order for a dead resident cannot spend wood | PASS |
| manual farming chooses separate reachable gardens before adding a second farmer | PASS |
| only gardens render below a resident working along their rear edge | PASS |
| winter moat and fur workshop sprites load distinctly; fence and gate carry snow | PASS |
| generated winter moat keeps every open junction continuous in all sixteen masks | PASS |
| Herbs plays a valid rustle sound and respects the sound-off setting | PASS |
| new fur workshop has seasonal artwork and renders a distinct missing-image fallback | PASS |
| desktop and mobile omit the status ribbon and its headings in every interaction mode | PASS |
| phone commands and tree queue work without success toasts; failures remain visible | PASS |
| phone deliveries and crafted coats update resources without routine popups | PASS |
| phone shows one warning with urgent heating first and cold suppresses duplicates | PASS |
| dismissing the leading phone warning reveals the next without restoring dismissed warnings | PASS |
| phone Tech reward defers ordinary warnings and remains accessible until acknowledged | PASS |
| desktop keeps routine feedback and switching to touch mode immediately compacts notices | PASS |
| residents cannot hurt monsters before a completed tower, including after research or an unfinished site | PASS |
| finishing the first tower doubles live monster health once and preserves injuries | PASS |
| after the tower milestone ordinary residents can fight back at their configured damage | PASS |
| later waves and winters retain doubled health even when every tower is demolished | PASS |
| tower progression saves without repeat scaling and older tower saves migrate without mutating snapshots | PASS |
| loading a pre-tower save clears progress from a previously developed settlement | PASS |
| occupied towers shoot painted arrows that visibly travel, rotate and freeze at a fixed simulation age | PASS |
| arrow directions have a readable shape fallback and expire after the configured flight time | PASS |
| the compact catalogue removes surplus research and keeps House out of the build menu | PASS |
| tower appears beside Sawmill but cannot be researched until the mill is completed | PASS |
| a real Hut action starts an on-site upgrade while residents keep their shelter | PASS |
| unfinished upgrades save their worker and progress, then resume after shelter release | PASS |
| cancelling an upgrade refunds once and keeps the original house and occupants | PASS |
| palisade and gate upgrades require a sawmill, double individual HP and preserve their connections | PASS |
| retired buildings and research migrate once without ghost footprints or lost fence upgrades | PASS |
| warm house sprites are seasonal, smoke animates only with residents and fallback remains usable | PASS |
| route rejection updates when gates open, construction finishes or a wall is demolished | PASS |
| mobile upgrade actions and the locked tower requirement remain within the viewport | PASS |
| an upgraded House actually shelters six residents | PASS |
| only towers can touch fences and gates, in either construction order; overlap and other spacing stay blocked | PASS |
| gate menu opens and closes immediately while paused and sheltered | PASS |
| closing a gate removes routes through it and save loading restores gate routing without a simulation tick | PASS |
| painted reinforced panels and all four gate images load with alpha and change with season and gate state | PASS |
| painted palisade renders all sixteen joins and native missing-image fallbacks | PASS |
| generated open gates show a transparent passage in both axes and both seasons | PASS |
| a phone can open a gate using a touch-sized context action | PASS |
| no unhandled browser exceptions | PASS |

Screenshots and JSON diagnostics are local ignored files under `.qa/`. Run
`scripts/browser-check.mjs` against a dedicated muted Chrome and local Vite;
`GAME_URL` selects the development server. Launch Chrome with `--headless=new`
and `--mute-audio`; hidden macOS GUI windows may defer frames and touch
acknowledgements. The runner brings its dedicated page to the foreground.

## Production artifacts

`npm run build:itch` passed. The final production bundle is `index-D8jFjE0p.js`.
The compiled game at `http://localhost:4173/` passed startup and first-season
acknowledgement, individual commands, Clear with three actual queued Canvas tree
clicks, save/notifications, local PT Sans loading, square UI corners and layouts
at 390, 768, 900, 1024 and 1280 px. Mobile notice dismissal and equal menu row
bounds passed (both rows span x=16…374 at 390 px). Winter Plan is absent. No
unhandled browser errors occurred, and all tests remained muted.
The compiled build additionally passed an actual Hut → House upgrade through
visible controls, confirmed its saved 200 HP and both seasonal PNG loads, and
kept tower research blocked without a Sawmill. It also opened/closed the painted
gate by clicking the model and placed a tower between a gate and a fence through
the Build menu (30 wood charged). All six new defense PNGs loaded in the compiled
game, with no browser exceptions.
The itch.io ZIP was refreshed from the verified `itch-build/` directory; it and
screenshots remain local ignored artifacts. The existing preview on port 4173
is retained; the dedicated test browser and development server are closed after
verification.

## Social previews and itch.io refresh (2026-11-25)

`npm run build:itch` passed with production bundle `index-CtDS0PNC.js`.
The static HTML includes Twitter/X metadata for the square artwork and Open
Graph metadata for the landscape artwork, with the square image as an alternative.
Both compressed JPEGs preserve their original dimensions and match the files
copied to `dist/` and `itch-build/`.

The local `.qa/Before-Night-Falls-itch.zip` was rebuilt from `itch-build/`.
ZIP CRC checks passed for all 132 files, and every archived file matches the
build byte for byte. `index.html` is at the archive root; module, stylesheet,
font and intro-image paths resolve inside the package. All current sound assets
are included. Promotional videos, original artwork, nested ZIPs and macOS
metadata are absent. The archive and the itch.io build remain ignored by Git.

## Automatic startup and itch.io package (2026-11-25)

The launch screen now shows only **Before Winter Comes** and an actual loading
bar. The bar advances as configuration, images and fonts become ready; world
initialization completes it. The game opens without pressing Start. The existing
first-season tutorial remains available inside the game.

All **153/153** browser regression checks passed without sound or unhandled
exceptions. New checks cover the title, monotonic loading progress, automatic
startup and resuming browser-blocked audio on pointer or keyboard interaction
while respecting mute. The runner clears prior Chrome exception history before
each run and installs its test hook while the configuration request is paused.

Production bundle `index-C9VA5u2P.js` passed four silent Chrome startup scenarios:
GitHub Pages build under a subpath at 1280 × 900, itch.io build at 390 × 844,
itch.io with every PNG unavailable, and a failed configuration request. Holding
one image request confirmed that the bar remains partially filled until assets
finish. Missing images allow startup with shape fallbacks; a configuration error
keeps the current title visible and displays a reload message. No unhandled
exceptions occurred in these production checks.

`Before-Winter-Comes-itch.zip` at the repository root contains 132 files (51.3 MiB),
with `index.html` directly at its root. Every archived file matches `itch-build/`
byte for byte, and ZIP CRC checks pass. The package contains no nested archives
or macOS metadata. SHA-256:
`a4a76a028f940c1c81e0404e04a9d67d577c2239e96df2dd083913dccc4b4534`.
