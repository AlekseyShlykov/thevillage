# Winter Village – Game Specification

## Overview

Winter Village is a cozy village management and survival game about preparing a small northern settlement for the winter.

The player manages villagers, gathers resources, expands the village by clearing forest, and survives mysterious winter hordes that emerge from the forest each winter.

The tone of the game is cozy, atmospheric, and strategic rather than violent or stressful.

The game runs entirely in the browser and must be compatible with desktop and mobile browsers. The project is intended to be hosted on GitHub Pages and itch.io.

---

# Core Gameplay Loop

Each game follows a seasonal cycle:

Summer (3 minutes)
- gather resources
- clear forest
- build structures
- expand the village

Autumn (1 minute)
- prepare supplies
- reinforce defenses
- produce tools and clothing

Winter (2 minutes)
- resources are consumed faster
- production slows
- a mysterious horde attacks the village

Spring (1 minute)
- village recovers
- population may grow
- repairs and rebuilding

---

# Map

The world uses a square grid tile system.

Tile size:
48px

Visible screen area:
25 × 18 tiles

Map size:
80 × 60 tiles

The village begins with a small clearing.

Starting clearing:
8 × 8 tiles

Starting buildings:
2 huts

Everything outside the clearing is forest.

---

# Tile Types

- forest
- clear
- building
- farm
- palisade
- path (optional later)

Forest tiles can be selected and cleared by the player.

Clearing a forest tile:
- grants wood
- turns the tile into clear terrain

Players can select exactly which tiles to clear.

---

# Villagers

Villagers are the core workforce of the settlement.

Villagers can perform any job (no specialization).

Possible roles:
- lumberjack
- hunter
- gatherer
- builder
- crafter

Villagers automatically choose tasks based on job assignments or building workers.

Players can:
- click villagers individually
- assign workers through buildings

---

# Population Progression

The village grows through population milestones.

Level progression:

Level 1 → 11 villagers  
Level 2 → 21 villagers  
Level 3 → 35 villagers  
Level 4 → 51 villagers  
Level 5 → 100+ villagers  

When reaching a new level:
- new technologies become available
- the player chooses which technologies to unlock first

---

# Resources

Main resources:

Wood  
Food  
Fur  
Tools  

Additional systems:
Technology Points  
Comfort

All resource rates must be configurable through JSON.

---

# Food

Food is a single resource.

Food does not spoil.

Villagers consume food continuously.

If food reaches zero:
- villagers become hungry
- population decreases

Consumption rate must be configurable.

---

# Fur

Fur is obtained through hunting.

Fur lifespan:

5 winters

Fur improves winter survival and comfort.

---

# Tools

Tools are crafted in the workshop.

Recipe example:

10 wood → 1 tool

Tools improve:
- production speed
- defense capability

Tools also act as primitive weapons early in the game.

---

# Comfort System

Comfort is a derived metric.

It depends on:

- food supply
- winter warmth
- housing quality
- injuries/health
- defenses
- comfort buildings

Comfort affects:
- villager productivity
- population growth
- resilience during winter

---

# Buildings

Buildings occupy multiple tiles.

Buildings cannot be placed on forest tiles.
The forest must be cleared first.

Buildings can only be demolished (not moved).

## Housing

Hut
2×2
Capacity: 4 villagers

House
3×2
Capacity: 6 villagers

Large House
3×3
Capacity: 8 villagers

---

## Food

Garden
2×2
Safe food production

Hunter Hut
2×2
Allows hunting for food and fur

Smokehouse
Improves food efficiency

---

## Production

Workshop
Produces tools

Fur Workshop
Turns fur into winter clothing

---

## Resource Infrastructure

Lumber Camp
Boosts wood production nearby

Storage
Increases resource capacity

---

## Defense

Palisade Wall
1×1 defensive structure

Palisade Gate
Village entry point

Palisades unlock at Level 2.

---

## Detection and Defense

Scout Fire
1×1

Placed in forest.

Provides early warning of incoming hordes.

Detection radius:
5 tiles

Scouts can die.

Unlocked at Level 3.

---

Watchtower
1×1

Detection radius:
7 tiles

Provides light during winter.

Unlocked at Level 4.

---

## Comfort

Bonfire
1×1

Provides comfort and light.

---

# Horde System

Every winter, a mysterious horde emerges from the forest.

The horde spawns from forest tiles near the edge of the map.

Enemies appear first as glowing eyes in the forest.

They become visible when approaching within:

5 tiles of the village

or

8 tiles of a watchtower.

---

Horde behavior:

- moves toward the village
- attacks palisades first
- can destroy buildings
- attacks villagers

The horde never completely destroys the village.

At least 2–3 villagers always survive.

---

# Combat

Villagers have three states:

Healthy  
Injured / Sick  
Dead  

Buildings can be damaged.

Buildings require repair after:

5 winters

If unrepaired:

they collapse after 10 winters.

---

# Weather System

Occasional seasonal weather events occur.

Examples:

Snowstorm  
Fog  
Strong wind

Effects:
- slower work
- reduced visibility
- harder gathering

Weather events appear visibly on the map.

---

# Technology Tree

Technologies are unlocked using technology points.

Points are gained from:

- building structures
- surviving winters
- reaching population milestones

When reaching a new village level:
new technologies become available.

Players must choose which to unlock first.

Not all technologies unlock automatically.

---

Technology tiers:

Tier 2 (Level 2 population)
- Workshop
- Lumber Camp
- Palisade
- Storage

Tier 3
- Fur Workshop
- Smokehouse
- Scout Fire

Tier 4
- Watchtower
- Better Tools
- House

Tier 5
- Large House
- Reinforced Palisade
- Hearth

---

# Construction

Players place buildings manually.

Villagers automatically become builders.

Multiple villagers can work on construction simultaneously.

---

# Pathfinding

All movement uses A* pathfinding on the tile grid.

This applies to:

- villagers
- enemies

---

# Save System

Autosave occurs every spring.

Players can also save manually.

---

# Time Control

The player can control game speed:

Pause  
1×  
2×  
4×

---

# UI

Top bar displays:

Wood  
Food  
Fur  
Tools  
Tech points  
Season  
Season progress  
Comfort

Additional panels:

Build menu  
Tech tree  
Villager assignments  

---

# Hosting

The game must run entirely in the browser.

It must be deployable to:

GitHub Pages  
itch.io

No backend services are required.

All configuration data should be stored in JSON files.