# Cursor Agent Instructions

This repository contains the Winter Village browser game.

Agents generating code for this project must follow these rules.

---

# Tech Stack

The game must be built using:

TypeScript  
Vite  
HTML5 Canvas  

Do NOT use heavy game engines.

The project must run fully in the browser.

The final build must be compatible with:

GitHub Pages  
itch.io

---

# Architecture

The code must be modular and structured.

Recommended structure:

src/
  core/
  game/
  systems/
  entities/
  world/
  ui/
  types/
  utils/

public/
  assets/
  data/

docs/

---

# Configuration

All gameplay parameters must be configurable.

Balance values must be stored in:

public/data/game-balance.json

Examples:

resource production  
season durations  
combat values  
building costs  
tech tree  
enemy spawn  

The game must load this JSON dynamically.

No balance numbers should be hardcoded.

---

# Rendering

Rendering must use HTML5 Canvas.

Sprites must be loaded from:

public/assets/

If assets are missing:

the game must render placeholder shapes so the prototype still works.

---

# Tile System

The world uses a grid system.

Tile size:

48px

Map size:

80 × 60 tiles

Visible viewport:

25 × 18 tiles

Tiles must support types:

forest  
clear  
building  
farm  
palisade  

---

# Pathfinding

Movement must use A* pathfinding on the tile grid.

Entities using pathfinding:

villagers  
enemies

---

# Game Systems

The following systems must be separate modules:

SeasonSystem  
ResourceSystem  
VillagerSystem  
BuildingSystem  
TechnologySystem  
HordeSystem  
WeatherSystem  
ComfortSystem  
SaveSystem

---

# Data Driven Design

Buildings, enemies, and technologies must be defined through JSON data where possible.

This allows easy balancing without editing code.

---

# Performance

The game must remain playable with:

50+ villagers on screen.

Rendering and updates should be optimized.

---

# Input

Desktop:

mouse input

Mobile:

touch drag for camera

Buttons must be large enough for touch interaction.

---

# Saving

Autosave must occur every spring.

Manual save must also be available.

---

# Code Quality

Rules:

- small modular classes
- avoid giant files
- avoid hardcoded values
- use TypeScript interfaces
- document systems clearly

---

# Documentation

All systems must be described in:

docs/GAME_SPEC.md

If the implementation differs from the spec, update the documentation.

---

# Goal

The result must be a playable prototype where a player can:

- manage villagers
- gather resources
- clear forest
- build structures
- unlock technologies
- survive winter hordes
- grow the village