# Game artwork

The isometric atlases were generated with the built-in `image_gen` tool through the imagegen skill.
Original sprites were preserved. Final project-bound PNGs:

- `public/assets/isometric/village-atlas.png` — 1536 × 1024, transparent, 3 × 2.
- `public/assets/isometric/village-winter-atlas.png` — aligned winter variant.

Columns 0–2 of row 0 contain spruce, fir and birch. Row 1 contains the existing
hut, storage and lumber camp. `IsometricArt` samples cells directly at runtime;
there is no manual cutting, background removal or external image processing.
The style references were `public/assets/buildings/hut.png` and
`public/assets/villagers/villager_idle.png`. Procedural Canvas art handles the
existing gardens, palisades and fires, with shape fallbacks for missing images.

## Interface icons

`public/assets/ui/icons/` contains 34 original, hand-authored SVG illustrations.
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
