# Garden and herbal hearth artwork

Generated with the built-in `image_gen` tool through the imagegen skill; no CLI
fallback or external image processing. Style reference:
`public/assets/isometric/village-atlas.png`.

Final project files:

- `public/assets/isometric/garden-growth-atlas.png` — RGBA, 1774 × 887, 4 × 2 cells; seven growth stages plus a winter bed.
- `public/assets/isometric/herbal-fire-atlas.png` — RGBA, 1774 × 887, 4 × 2 cells; unlit hearth plus seven flame poses.

Canvas samples the atlas cells directly. Original generated alpha is preserved.

## Garden prompt

Use case: stylized-concept. Asset type: production garden growth sprite atlas for an existing isometric browser game.
Input image 1 is a STYLE REFERENCE ONLY: match its richly textured warm pixel-detail storybook game art, earthy browns, muted moss greens, ochre highlights, rustic wood and stone. Do not reproduce the buildings or trees.
Create a genuinely transparent PNG landscape atlas, 2:1 overall aspect ratio, EXACTLY FOUR EQUAL COLUMNS and TWO EQUAL ROWS. Eight isolated sprites, each fully inside its equal square cell. No labels or grid. All cells show the EXACT SAME small square vegetable garden bed in true 2:1 isometric perspective, viewed from above at 30 degrees, light from upper left. Identical position, garden dimensions, low weathered timber edging, dark rich soil, four neat planting rows and a little wooden corner marker in every cell. Diamond bed footprint, front corner toward viewer. Fill 86% of each cell width. Bottom tip of the garden is on the baseline 90% down every cell. No large ground slab or surrounding grass. Ground-level plants must remain inside their beds.
TOP ROW left to right: 1 prepared freshly turned empty soil with detailed furrows; 2 neatly sown soil, tiny scattered pale seeds barely emerging; 3 small paired green seedlings in organized rows; 4 clearly taller lush young leafy vegetables.
BOTTOM ROW left to right: 5 healthy broad foliage with small cream blossoms, early green fruit; 6 nearly mature vegetables, larger leafy clusters, small orange carrots and green cabbages starting to show; 7 fully ready harvest, abundant mature cabbages and prominent orange carrots, a little ripe golden grain at the rear, clearly the lushest and most plentiful stage; 8 the SAME empty bed dormant in winter, snow lying on its timber rim and lightly in the furrows, no living crops.
Essential: growth increases clearly from cells 1 through 7, same garden outline and consistent scale across all eight. High production detail like the reference cottage, subtle pixel-style edges, readable at 120 pixels. Discrete clean alpha silhouette, no glow, no scenery or environment, no people, no tools floating outside beds, no text, no shadow outside the cell, no opaque or checkerboard background.

## Herbal hearth prompt

Use case: stylized-concept. Asset type: production protective herbal fire animation sprite atlas for an existing cozy isometric browser game.
Input image 1 is a STYLE REFERENCE ONLY: exactly match its warm richly detailed pixel-art storybook style, rustic weathered timber, mossy gray stones, earthy ochre and muted greens, clean readable game-object silhouettes.
Create a truly transparent PNG sprite atlas, landscape 2:1 aspect ratio, EXACTLY FOUR EQUAL COLUMNS and TWO EQUAL ROWS. Eight isolated equal-size square cells. Every sprite is the SAME compact low circular rustic hearth: a heavy ring of irregular gray-green mossy fieldstones, a low dark aged iron brazier inside, a few stacked charred logs, tiny bundles of dried protective herbs tied with coarse twine resting just inside the stone ring. NOT a large monument. No buildings, floor tiles, scenery, people, text or floating icons. True 2:1 isometric perspective, looking down 30 degrees, light from upper left, tangible dimensional stone, detailed texture on each stone and log. Stone ring fills 82% of the cell width; every ring has identical scale, position and shape, ground baseline exactly 90% down every cell. Flames and smoke stay completely inside each cell.
TOP ROW left to right: 1 UNLIT hearth with dark logs and visible sage herb bundles, absolutely no flames or smoke. 2 same hearth burning a low warm amber flame with a slight pale sage-green tint only at the tips. 3 same hearth medium-height warm amber flame with curling light sage-green herbal wisps. 4 same hearth brighter and slightly taller fire with irregular golden tongues and the same restrained green tint.
BOTTOM ROW left to right: 5 same hearth with flames leaning slightly left, 6 flames curling upright, 7 flames leaning slightly right, 8 flames settling lower. Cells 2–8 are consecutive animation frames: vary only the flame shape and the subtle thin herbal wisp; the stone ring, herb bundles and logs must stay perfectly fixed. Fire remains warm orange and gold, no neon magic, no giant glowing orb, no surrounding shield drawn in the asset. Small ember details only within the hearth.
All transparent margins must remain actually clear: no broad glow halo, no black background, no opaque backdrop, no checkerboard texture. Detailed sprite art as polished as the reference cottage and storage shed, crisp at small size, not flat vector art. Exactly the same hearth eight times.

## Handheld work tools · 2026-11-16

Generated with the built-in image tool, one call per tool, `transparent_background=true`.
Final files: `public/assets/tools/rake.png`, `public/assets/tools/axe.png`,
`public/assets/tools/hammer.png`. Originals were copied without image editing.
Every final prompt consisted of this shared prefix followed by ` Primary request: `
and the corresponding subject below.

Shared prefix:

> Use case: stylized-concept. Asset type: one isolated handheld tool sprite for a cozy medieval northern village browser game, hand-painted isometric storybook pixel-art-adjacent style, detailed warm wood grain, worn muted steel, ochre/sage palette, dark fine silhouette outline, warm light from upper left. One object only, absolutely no hands, people, landscape, floor, text, border, UI, cast shadow or extra props. Transparent background with real alpha. The tool is shown flat enough to remain readable at 32 pixels. Long handle points straight vertically downwards and working head at the top, perfectly centered upright, with 12 percent transparent margin; full object visible. Output square image.

Rake:

> A wooden garden rake with a long honey-brown ash handle, a wide horizontal aged-iron head and exactly six clearly separated downward-curving tines. Recognizable real garden rake, not hoe or fork.

Axe:

> A practical woodcutter's axe, straight honey-brown wooden shaft, single broad slightly convex steel axe blade on its upper left side, sturdy small socket. Recognizable medieval felling axe.

Hammer:

> A carpenter's cross-peen hammer with a straight honey-brown wooden handle, heavy horizontal worn steel head with a flat square striking face on the left and a tapered peen on the right. Compact head, long readable handle.
