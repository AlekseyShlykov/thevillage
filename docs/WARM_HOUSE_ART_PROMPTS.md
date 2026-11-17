# Warm house sprites

Generated using the built-in `image_gen` tool. Original transparent alpha is
preserved; no background removal or raster repainting was applied afterward.

Game assets:
- `public/assets/isometric/warm-house.png`
- `public/assets/isometric/warm-house-winter.png`

## Summer generation prompt

```text
Use case: stylized-concept
Asset type: transparent browser game isometric building sprite, single warm upgraded house.
Primary request: Generate a new sturdy, insulated upgraded dwelling for the existing Winter Village game. The attached image 1 is a STYLE AND CAMERA reference sheet only; the small thatched hut in its bottom left is the basic house that this new dwelling upgrades from. Image 2 is another style reference, a fur workshop: do NOT copy its open workshop or furs. Make a recognizably residential home, compact square footprint, same elevated three-quarter isometric camera with two visible walls, door on right-facing wall and window on left-facing wall.
Subject: snug substantial dark honey-brown interlocking log walls with clear pale clay/moss chinking, thicker corner timbers, solid low stone foundation following the exact building base, well-sealed heavy timber door, small recessed warm amber windows with wooden shutters, deep thick weatherproof timber-shingle roof, stout stone chimney at upper left roof. More robust and warm than the basic straw hut, modest and compact rather than a large mansion.
Style: hand-painted rustic strategy game illustration matching the references, crisp readable silhouette, softly textured wood and stone, restrained detail readable when reduced to 180 pixels, muted earthy brown/olive/cream palette, warm upper-left lighting. No black outline.
Composition: one isolated centered building only, nearly fills a square canvas with 8% transparent padding, entire roof/chimney/base visible, base vertices aligned on an isometric diamond. The chimney mouth should be near 30% of canvas width and 19% height so separate animated smoke can originate there.
Constraints: true transparent alpha background; no environment, no ground patch, no ground ellipse, no cast shadow outside foundation, no people, no items outside the home, no snow (a separate winter variant will follow), NO smoke, no text, no UI, no watermark.
```

## Winter edit prompt

```text
Use case: lighting-weather
Asset type: winter variant of an existing transparent isometric house game sprite.
Edit target: the attached warm-house.png. Preserve the exact image dimensions, composition, camera, building shape, foundation and roof silhouette, door/window positions, chimney mouth and style. Change ONLY season: add believable soft ivory snow to roof shingles in irregular light layers, snow on chimney top edge and shutters, a little snow along the building's stone foundation. Keep wood walls exposed and warm, glowing amber window, readable dark roof edges and chimney mouth. Same hand-painted earthy rustic strategy game style and upper-left light. NO smoke; animated smoke is rendered separately. Preserve transparent alpha everywhere outside the building; no landscape, no ground base, no cast shadow, no people, no UI, no text or watermark. Single isolated building only, same scale and placement.
```

