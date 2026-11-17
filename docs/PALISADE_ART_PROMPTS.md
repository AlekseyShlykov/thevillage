# Palisade and gate artwork

Generated with the built-in `image_gen` tool. Original PNG alpha is preserved.
All final assets are in `public/assets/isometric/`. The house is a style reference;
the winter/open edits retain the source fence or gate geometry.

FenceSprites projects complete panel sprites onto connected fence half-sections.
Gate state images share their post-foot anchors in both grid orientations.

## reinforced-palisade.png

```text
Use case: stylized-concept
Asset type: one transparent modular reinforced palisade fence panel sprite for a browser strategy game.
Style reference: attached warm-house.png, match its hand-painted honey-brown timber, soft crisp edges, rustic wood grain, subdued aged iron and upper-left lighting. Do not draw a house.
Subject: ONLY one short freestanding reinforced wooden palisade section, three evenly spaced stout upright sharpened logs side by side, two thick horizontal supporting timbers behind them and one diagonal timber brace, small dull iron binding bands and wooden pegs. The tops are hand-cut chamfered points, not perfect spikes. Bottom ends form a straight level baseline. Uprights have equal height, the two outer logs stand right at the left and right ends; horizontal rails end flush. No tall separate gate posts.
Camera: STRICT ORTHOGRAPHIC FRONT VIEW, no side perspective, upright logs perfectly vertical. This panel will be projected and joined into corners by the game renderer, so no isometric ground plane in the source sprite.
Composition: one isolated complete panel centered on transparent square canvas, about 80% canvas width and 80% canvas height, modest transparent margin. Three logs only, broad readable silhouette. No surrounding fence, no ground strip, no terrain, no shadow, no people, no snow, no labels, no background, no text, no watermark. Genuine transparent alpha.
```

## palisade-gate-closed.png

```text
Use case: stylized-concept
Asset type: single transparent isometric CLOSED timber palisade gate sprite for the same rustic browser game as the reference.
Style reference: attached warm-house.png, match the painted timber/stone illustration, warm aged wood, subtle iron hardware and earthy palette.
Subject: a sturdy small wooden double-leaf village gate between two stout chamfered palisade posts. Closed wooden leaves meet in the middle, two horizontal timbers and diagonal braces with a simple iron latch. Dark iron strap hinges. Compact defensive gate, no stonework, no roof or arch spanning the top. Posts a little taller than the leaves.
Camera: same elevated three-quarter isometric angle as the house. Fence line extends from lower-left to upper-right? For clarity: the LEFT post foot must be higher on the canvas than the RIGHT post foot, a straight fence baseline slopes DOWN toward the RIGHT at about 26 degrees. All timber verticals stay vertical. Front face visible.
Composition: one gate, isolated, centered, all posts/leaf edges entirely visible, square transparent canvas with at least 8% padding. The exact camera, post positions and size will be preserved for open and winter variants. Ground invisible; feet simply end without dirt. No surrounding fence, no ground patch, no cast shadow, no vegetation, no snow, no people, no buildings, no text or watermark. Genuine transparent alpha.
```

## reinforced-palisade-winter.png

```text
Use case: lighting-weather. Edit this transparent reinforced palisade panel to its winter version. Preserve EXACT canvas dimensions, crop, three upright logs, level baseline, wood and iron construction, orthographic front camera and every element's position. Add soft ivory snow to all three pointed caps, top edges of the horizontal/diagonal timbers and tiny patches on iron bands. Snow should be painted in the same rustic game style. Keep wood visible. True transparent background preserved. No ground, no shadow, no other objects, no people, no text. This sprite must join seamlessly to itself when the game projects it.
```

## palisade-gate-open.png

```text
Use case: precise-object-edit. Create the OPEN state of this exact transparent isometric wooden gate. Change ONLY the two gate leaves: swing BOTH leaves away from the centre to a visibly wide open passage, with foreshortened leaves resting near their respective outside posts. The centre between posts must be transparent and clearly passable. Preserve the two upright posts EXACTLY in the same pixel positions, heights and foot locations, the same canvas dimensions, camera, perspective, scale, lighting, timber grain and iron hardware. The leaves must stay hinged at the original posts, with their wood braces and hardware recognizably retained. Do not move, enlarge, shrink, rotate or reframe the gate or its posts. No top arch, no extra beams, no ground, no landscape, no shadow, no snow, no people or text. True transparent alpha outside all timber AND in the open passage.
```

## palisade-gate-closed-winter.png

```text
Use case: lighting-weather. Make the winter version of this EXACT CLOSED wooden gate sprite. Preserve exact image dimensions, composition, two posts' pixel positions and foot locations, closed leaves, latch, all wood/iron shapes and isometric camera. Add soft white/ivory snow to post caps, top edges of both leaves and support timbers, with small snow patches on hinges and latch. Same hand-painted rustic game style. Keep walls/wood exposed. No changes to gate state; leaves remain fully closed. Preserve genuine transparent alpha. No terrain, no ground patch, no cast shadow, no buildings, people, text or watermark.
```

## palisade-gate-open-winter.png

```text
Use case: lighting-weather
Asset type: winter OPEN-state gate sprite matching the attached summer open gate and winter closed gate.
Edit target: image 1 (open gate). Image 2 is a snow/material style reference ONLY; do not close the gate.
Change ONLY the season of image 1: add soft ivory snow caps to both posts, snow along the upper edges and braces of both OPEN leaves and a little on the iron hinges. Preserve EXACT canvas dimensions and placement, camera, perspective, two post positions and foot anchors, both open leaves' shape/orientation, all timber and iron details. The central gateway MUST remain a wide transparent passage with both leaves swung open exactly as image 1. Keep wood exposed and match image 2's rustic painted snow. Preserve transparent alpha outside the gate and through the open passage. No ground, no terrain, no shadow, no extra structures, no people or text.
```

