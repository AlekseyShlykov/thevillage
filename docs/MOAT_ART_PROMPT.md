# Modular moat atlas

Generated with the built-in `image_gen` tool, `transparent_background=true`.
Final asset: `public/assets/isometric/moat-tiles-atlas.png` (1536 × 1024 RGBA).
The original was copied without image editing. Canvas selects, rotates and projects
the six square cells at runtime; shared painted mouth samples make joins continuous.

## Final prompt

Use case: stylized-concept.
Asset type: production terrain sprite atlas for a cozy northern medieval village browser game.
Primary request: SIX modular pieces of an excavated defensive moat, in EXACTLY THREE EQUAL COLUMNS AND TWO EQUAL ROWS, with NO gutters, labels, grid lines or dividers. Landscape atlas aspect ratio 3:2. Each cell is one SQUARE logical terrain tile seen STRAIGHT DOWN FROM ABOVE, orthographic, NOT an isometric diamond. The game will project these square cells into isometric diamonds itself.
Style: richly textured hand-painted storybook game art, pixel-art-adjacent crisp detail, warm ochre/brown cut earth, muted moss and sage grass tufts, small irregular gray mossy stones, exposed roots, dark recessed earth faces and deep desaturated blue-green still water. Upper-left lighting. This must match a detailed rustic timber/stone village with straw roofs, NOT flat vector art or a modern concrete canal. The moat is dug into the earth, low, with crumbling natural earthen banks, NOT raised stone walls.
All six cells must have identical scale, exact same dark teal water color, matching bank thickness and water width. A water channel at an OPEN tile edge MUST reach all the way to that cell boundary, perfectly centred at the midpoint; water width there is EXACTLY 44% of cell width, with earthy banks on either side. Never draw a bank across an open connection. Outer channel width with banks is 82% of a cell. Everything outside the irregular earthen banks is truly TRANSPARENT, not a grass square, scene, backdrop, glow or shadow.
TOP ROW LEFT: one isolated compact round-square dug pit filled with water, fully closed natural banks on all four sides; no exits.
TOP ROW MIDDLE: one dead end. Open water connection ONLY at the TOP edge, centred. The channel runs down to a gently rounded closed end at the cell centre/lower half, with natural banks around the closed end. No other exits.
TOP ROW RIGHT: one STRAIGHT channel, open at the TOP and BOTTOM edges, perfectly centred, no exits left or right; two continuous parallel natural earthen banks.
BOTTOM ROW LEFT: one smooth 90-degree ELBOW. Open at TOP and RIGHT edges, centred on both. The channel turns smoothly around the centre, with rounded inside and outside banks. No exits bottom or left. Water continuous around the turn.
BOTTOM ROW MIDDLE: one T JUNCTION. Open at TOP, RIGHT and LEFT edges, centred on each. A natural rounded three-way water junction; bottom bank closed. No bottom exit.
BOTTOM ROW RIGHT: one FOUR-WAY CROSS junction. Open at TOP, RIGHT, BOTTOM and LEFT edges, centred on every edge. Continuous central water, four earthen corner banks only.
These are SIX SEPARATE tiles, not one connected demonstration scene. Water and banks stop at each cell edge and remain entirely within that cell. Full atlas has true transparent alpha wherever no moat exists. No text, houses, characters, bridges, fences, sky, UI, perspective tilt, giant rocks, wide exterior shadows, or checkerboard texture. The geometry of the exits and the 3x2 cell layout is essential.
