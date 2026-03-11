# Winter Village – Asset Guide

## Overview

Winter Village uses HTML5 Canvas rendering with sprite-based assets.
If sprite files are missing, the game falls back to placeholder graphics (colored shapes, circles, rectangles).

---

## Asset Directory Structure

```
public/assets/
├── tiles/
│   ├── forest.png          (48×48)
│   ├── clear.png           (48×48)
│   ├── snow-clear.png      (48×48)
│   └── path.png            (48×48)
├── buildings/
│   ├── hut.png             (96×96 = 2×2 tiles)
│   ├── garden.png          (96×96)
│   ├── hunterHut.png       (96×96)
│   ├── bonfire.png         (48×48)
│   ├── workshop.png        (96×96)
│   ├── lumberCamp.png      (96×96)
│   ├── storage.png         (96×96)
│   ├── palisadeWall.png    (48×48)
│   ├── palisadeGate.png    (48×48)
│   ├── scoutFire.png       (48×48)
│   ├── furWorkshop.png     (96×96)
│   ├── smokehouse.png      (96×96)
│   ├── watchtower.png      (48×48)
│   ├── house.png           (144×96 = 3×2 tiles)
│   └── largeHouse.png      (144×144 = 3×3 tiles)
├── villagers/
│   ├── villager-idle.png   (32×32)
│   ├── villager-work.png   (32×32)
│   └── villager-injured.png(32×32)
├── enemies/
│   ├── enemy.png           (32×32)
│   └── eyes-glow.png       (16×16)
├── ui/
│   ├── icon-wood.png       (24×24)
│   ├── icon-food.png       (24×24)
│   ├── icon-fur.png        (24×24)
│   ├── icon-tools.png      (24×24)
│   └── icon-tech.png       (24×24)
└── fx/
    ├── snowflake.png       (8×8)
    └── fog.png             (256×256 tileable)
```

---

## Tile Size

All tiles are **48×48 pixels**.

Building sprites should be `width × height` tiles × 48px each:
- 1×1 building → 48×48
- 2×2 building → 96×96
- 3×2 building → 144×96
- 3×3 building → 144×144

---

## Art Style Guidelines

- Top-down or slight ¾ perspective
- Cozy, warm color palette
- Pixel art or clean hand-drawn style
- Clear silhouettes at small sizes

---

## Fallback Behavior

If any asset file is missing, the game renders:
- **Forest tiles**: Dark green circles on green backgrounds
- **Clear tiles**: Light green rectangles
- **Buildings**: Colored rectangles with name labels
- **Villagers**: Skin-toned circles with brown "hair" arc
- **Enemies (hidden)**: Glowing red eye dots
- **Enemies (visible)**: Dark purple circles with red eyes
- **Weather**: Particle effects using canvas primitives

The prototype is fully playable without any sprite assets.

---

## Adding Custom Assets

1. Create PNG files matching the filenames above
2. Place them in the corresponding `public/assets/` subfolder
3. The renderer will automatically use them if a sprite loader is implemented

> **Note**: The current prototype uses only placeholder rendering.
> To enable sprite loading, implement an `AssetLoader` in `src/render/` that
> loads images and passes them to the `Renderer` for drawing instead of primitives.
