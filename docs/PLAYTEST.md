# Playtest and regression checks

Recorded 2026-11-16. All 20 browser checks passed.

## Browser coverage

Tested in dedicated headless Chrome 157.0.8103.52 on macOS, using the actual
canvas input and visible UI controls. The full first year was played through
by clicking the controls; simulation time was advanced between actions.
Desktop viewport: 1280 × 900 at DPR 1. Mobile emulation: 390 × 844 at DPR 2.
The mobile check sends touch events, verifies camera movement and checks that
menu controls are not covered. Physical phones and Safari/Firefox were not tested.

| Check | Result |
| --- | --- |
| custom interface artwork loads and buttons keep accessible labels | PASS |
| projection and zoom round-trip | PASS |
| first year through visible controls | PASS |
| winter save restores active wave and timers | PASS |
| pause accepts villager orders immediately | PASS |
| selected villager receives exact tree, hunt and farm orders | PASS |
| selected worker builds and repairs without stealing other workers | PASS |
| tools animate distinct work poses and freeze while paused | PASS |
| production persists and workshop respects its recipe timer | PASS |
| horde wave limit is enforced | PASS |
| 50 visible villagers render within a playable frame budget | PASS |
| mobile menus remain reachable and touch camera works | PASS |
| existing researched buildings appear in the build menu | PASS |
| an open build menu updates when resources arrive | PASS |
| missing artwork still renders a usable world | PASS |
| a defending worker resumes their production job | PASS |
| repair keeps research bonuses and clears maintenance warnings | PASS |
| older winter saves remain playable | PASS |
| all winter weather types can occur and cooldown saves correctly | PASS |
| no unhandled browser exceptions | PASS |

## Observed gameplay

Cleared forest, sent the protected first hunter, built a hut, researched and built
a garden, assigned a farmer and harvested food. Called Shelter, reached winter,
survived until the next spring and resumed the original farming job. Spring
autosave was present. Residents survived and the garden remained repairable.
No unhandled browser exceptions occurred. All third-party requests were blocked
during verification, so these checks did not send production analytics or emails.

Selected a resident through the canvas and used their job buttons to chop the
chosen tree, hunt on an exact forest tile, farm a chosen garden, build a hut,
repair that hut and work at a lumber camp. Invalid farming targets left the old
job intact. Reassignment released the previous building's worker slot. Stop
remained effective after automatic dispatch ticks and saving/loading; Move
reached the chosen ground tile and kept the resident available for direct orders.
Mobile selection and job buttons were exercised with touch events. Four distinct
poses for axe, hoe, hammer and bow were captured; paused render frames remained
identical, including the grass animation.

All 34 SVG interface icons loaded successfully and interface text contained no
emoji. Buttons retained accessible labels. A separate layout pass covered widths
390, 768, 900, 1024 and 1280 px: main controls stayed inside the viewport and the
top bar had no horizontal overflow. Selected/targeting cards, build/research
menus and both sound states were inspected. Cancel order stayed hidden outside
targeting and visible while targeting. The icon sheet is captured in
`.qa/interface-icon-sheet.png`; individual menu captures use the `icons-` prefix.

## Performance reference

55 residents were placed in the visible clearing. Both simulation update and
scene rendering were measured together: mean 5.7 ms, 95th percentile 6.7 ms
across 40 sampled frames in headless Chrome. Terrain caching and visible-object
culling remained active. Results depend on the device and browser.

## Reproduce

Requires Node 22 or newer for the test runner. Production builds use the normal
Vite/TypeScript toolchain and do not need browser automation dependencies.

1. Start the development server:

   ```sh
   npm run dev -- --host 127.0.0.1 --port 4173
   ```

2. Start a dedicated Chrome profile with a local debugging port (macOS example):

   ```sh
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --headless=new --disable-gpu --no-first-run \
     --user-data-dir=/tmp/winter-village-qa --remote-debugging-port=9461 about:blank
   ```

3. Run:

   ```sh
   node scripts/browser-check.mjs
   ```

`GAME_URL` and `CHROME_URL` environment variables override the defaults.
The runner uses the dedicated test browser and modifies its game state/local
saves. Use a separate profile. It writes ignored `.qa/results.json` and screenshot
artifacts, including spring/winter desktop views, mobile menus and 55 residents.
Additional captures show the individual command card, farming and a work-pose
sheet (`work-poses.png`).

## Release builds

```sh
npm run build
npm run build:itch
```

`dist/` is the relative-path GitHub Pages build. `itch-build/` is the verified
itch.io directory. No hosting or publishing is performed by these commands.
The compiled build was also opened at `http://localhost:4173/`: startup,
individual selection and an exact tree-chopping order passed without browser
exceptions. This check used the compiled bundle rather than Vite source modules.
