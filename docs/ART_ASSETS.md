# Game artwork

The isometric atlases were generated with the built-in `image_gen` tool through the imagegen skill.
Original sprites were preserved. Final project-bound PNGs:

- `public/assets/isometric/village-atlas.png` — 1536 × 1024, transparent, 3 × 2.
- `public/assets/isometric/village-winter-atlas.png` — aligned winter variant.
- `public/assets/isometric/garden-growth-atlas.png` — 1774 × 887, transparent, 4 × 2: seven growth stages plus a winter bed.
- `public/assets/isometric/herbal-fire-atlas.png` — 1774 × 887, transparent, 4 × 2: unlit hearth plus seven flame poses.

Columns 0–2 of row 0 contain spruce, fir and birch. Row 1 contains the existing
hut, storage and lumber camp. `IsometricArt` samples cells directly at runtime;
there is no manual cutting, background removal or external image processing.
The style references were `public/assets/buildings/hut.png` and
`public/assets/villagers/villager_idle.png`. Gardens and herbal hearths match the
village atlas through generated illustrated props. Procedural Canvas art handles
palisades, gates, the ordinary camp fire and missing-image fallbacks.
The complete new prop prompts are in [PROP_ART_PROMPTS.md](PROP_ART_PROMPTS.md).

## Interface icons

`public/assets/ui/icons/` contains 37 original, hand-authored SVG illustrations,
including protective herbs for gathering orders and winter forecasts.
The source paths and shared palette live in `scripts/draw-ui-icons.mjs`; regenerate
the shipped SVG files with `node scripts/draw-ui-icons.mjs`. No external icon
library, image service or additional runtime dependency is needed.

The transparent 48 × 48 illustrations use ochre timber, muted sage, parchment,
aged iron, warm outlines and upper-left highlights. They replace emoji in resource
counters, village statistics, the action bar, individual job cards, context
menus, build/research costs, save/load, sound, camera and restart controls.
Their silhouettes remain readable at the 16–34 px sizes used by the interface.

`src/ui/icons.ts` supplies typed names, base-relative asset URLs and a shared
button-label helper. Images are decorative (`alt=""`, `aria-hidden="true"`),
while buttons retain explicit accessible names. Icon-only controls keep their
text labels available to assistive technology. Ordinary labels and tutorial
instructions use text rather than platform-specific emoji glyphs.

## Summer atlas prompt

Use case: stylized-concept. Asset type: production sprite atlas for an existing
cozy northern village browser game. The two input images are STYLE REFERENCES
ONLY: retain their warm, detailed pixel-art storybook game aesthetic, ochre
thatch, mossy greens, simple rustic wood and readable silhouettes. Create a single
transparent PNG sprite atlas, landscape 3:2 aspect, EXACTLY 3 equal columns and 2
equal rows, six sprites centered within their own equal cell, generous transparent
padding, no text, no grid lines, no ground tiles, no background. All six sprites
viewed in consistent true isometric 2:1 game perspective, camera looking down
approximately 30 degrees, light from upper left. TOP ROW left to right: (1) a
single tall evergreen spruce tree, rich muted pine green, visible brown trunk,
layered natural boughs; (2) a second distinct, slightly shorter rounded evergreen
fir tree, same palette; (3) a slender northern birch tree with pale trunk and small
muted golden-green canopy. BOTTOM ROW left to right: (4) a tiny rustic thatched
wooden hut, warm glowing little window, stone foundation, small chimney, front
door on visible front face, square footprint; (5) a little rustic storage shed
with a dark timber roof and a few wooden crates, square footprint; (6) a small
lumber camp open-sided timber shelter with stacked cut logs and a thatched roof,
square footprint. These correspond to existing game buildings, do not invent
additional buildings. Sprites must have discrete clean alpha edges, crisp
pixel-like details, no blurry painted backgrounds. Show left and right wall faces
and roofs of structures, not an overhead roof plan. Every sprite completely
contained in its cell, aligned at the same bottom baseline 90% down the cell, no
long cast shadows extending outside the cell. No labels, people, extra items
between cells, border, watermark or UI.

## Winter atlas prompt

Use case: lighting-weather. Edit target: the supplied six-cell transparent sprite
atlas for a cozy isometric village browser game. Create its WINTER VERSION.
Preserve EXACTLY the 3-column by 2-row layout, equal cells, sprite sizes, sprite
positions and bottom baselines. Keep the same six objects, same shapes,
silhouettes, isometric camera perspective, detailed warm pixel-art style, and the
same transparent alpha background. Change only the season: snow settling
generously on evergreen boughs and birch branches, birch now sparse with a few
ochre leaves, and soft fresh snow covering the tops of the hut, storage shed and
lumber camp roofs. Pine greens become muted blue-sage greens; snow is pale
blue-white in shadows and warm ivory in highlights. Keep the hut window warmly
glowing amber and chimney smoke visible. Do not add ground, scenery, new objects,
people, UI, cell outlines or text. No fog or glow around silhouettes, no opaque
background. This is a drop-in seasonal sprite sheet; strict alignment and exact
3x2 atlas organization are essential.

## Smoke-free cottage update

The built-in `image_gen` tool (imagegen skill, not the fallback CLI) edited both
atlases in place at the user's request. Final assets remain:

- `public/assets/isometric/village-atlas.png`
- `public/assets/isometric/village-winter-atlas.png`

Both are RGBA 1536 × 1024 with the existing aligned 3 × 2 layout. The static
chimney plume was removed; Canvas `BuildingEffects.chimneySmoke` now supplies
resident-dependent animated smoke. Connected timber fences and hinged gates
remain native Canvas artwork. Garden stages and the herbal brazier now use the
generated prop atlases described above. The ward icon is
an original SVG added through `scripts/draw-ui-icons.mjs`.

### Summer edit prompt

Use case: precise-object-edit. Edit target: the supplied transparent 1536x1024 production sprite atlas. REMOVE ONLY THE BAKED-IN WHITE SMOKE ABOVE THE CHIMNEY of the cottage in the bottom-left cell. This is essential: chimney must be completely extinguished, no smoke, no steam, no fog or glow above the chimney; the game will add dynamic smoke in code. Preserve the cottage and its empty open stone chimney, the roof, every other sprite, all six objects, exact 3-column by 2-row cell layout, object positions, sizes and bottom baselines. Preserve the illustrated pixel-detail cozy northern village style and summer colors. Absolutely no rearranging cells, moving sprites, crop changes, added ground, borders, labels or text. Return the same landscape 1536x1024 atlas with a genuinely transparent alpha background. The ONLY visual change is removing the smoke plume from that cottage.

### Winter edit prompt

Use case: precise-object-edit. Edit target: supplied transparent 1536x1024 WINTER production sprite atlas. REMOVE ONLY THE BAKED-IN WHITE SMOKE ABOVE THE CHIMNEY of the snow-covered cottage in the bottom-left cell. Chimney must be completely extinguished: no smoke, no steam, no fog or glow above its open stone mouth. The game will add animated smoke when residents are inside. Preserve the cottage, its open empty stone chimney, all snow, every other sprite, all six objects, exact 3-column by 2-row cell layout, object positions, sizes and bottom baselines. Preserve the original illustrated pixel-detail cozy northern village style, winter colors and warm window. Do not rearrange cells, move objects, crop, add ground, labels, borders or text. Same landscape 1536x1024 atlas with genuinely transparent alpha background. ONLY remove the smoke plume.

## Handheld work tools

`public/assets/tools/rake.png`, `axe.png` and `hammer.png` are transparent
generated images used directly in the Canvas work animation. They replace the
symbolic tool shapes, retain grip-relative rotation and have native shape
fallbacks. The existing SVG interface collection also gains `clothing.svg`.
See [PROP_ART_PROMPTS.md](PROP_ART_PROMPTS.md) for the built-in image generation
prompt set. No CLI/API fallback was used.

## Typography

The game uses self-hosted PT Sans for interface text, headings, tooltips and
Canvas labels. The unmodified Regular, Bold, Italic and BoldItalic TTF files
are under `public/assets/fonts/`; the embedded SIL Open Font License and
ParaType copyright notice are preserved in `OFL.txt`. No external font service
is required. Regular and Bold load with game assets before Canvas text is drawn;
missing fonts fall back to the browser sans-serif.

## Carried supplies and timber tower · 2026-11-16

Generated transparent sprites: `public/assets/cargo/herbs.png` (sage basket),
`public/assets/cargo/hunt.png` (hunter's basket with pelt and wrapped venison), and
`public/assets/isometric/guard-tower.png` (timber archery shelter). All three use
the village's painted ochre timber and sage palette. Original alpha is retained;
assets load locally and have Canvas shape fallbacks. Cargo moves with the
resident's smooth walking pose. The tower replaces the generic cottage prop.
Exact generation prompts are in [PROP_ART_PROMPTS.md](PROP_ART_PROMPTS.md).
