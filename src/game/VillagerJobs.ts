import { HealthState, Position, Season, VillagerData } from '../types';
import { IconName } from '../ui/icons';
import { getConfig } from '../data/ConfigLoader';
import { TileMap } from '../world/TileMap';
import { BuildingSystem } from '../systems/BuildingSystem';
import { VillagerSystem } from '../systems/VillagerSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { ForagingSystem } from '../systems/ForagingSystem';

export interface VillagerJob {
  key: string;
  kind: 'chop' | 'hunt' | 'herbs' | 'farm' | 'work' | 'build' | 'repair' | 'shelter' | 'deliver' | 'stop';
  label: string;
  icon: IconName;
  target?: Position;
  buildingId?: string;
}

/** Offer concrete reachable jobs. Clicking a card executes its prepared destination. */
export function availableJobs(v: VillagerData, map: TileMap, buildings: BuildingSystem,
  villagers: VillagerSystem, resources: ResourceSystem, foraging: ForagingSystem, season: Season, sheltered: boolean): VillagerJob[] {
  if (v.health === HealthState.Dead) return [];
  const cfg = getConfig(), jobs: VillagerJob[] = [], cargo = Object.values(v.cargo ?? {}).some(n => n > 0);
  const distance = (p: Position) => Math.hypot(p.x - v.x, p.y - v.y);
  const reach = (p: Position) => villagers.canReach(v, p.x, p.y);
  const homes = buildings.getHousingTiles().sort((a,b) => distance(a) - distance(b));
  const home = homes.find(reach);
  if (home) jobs.push({key:'shelter',kind:cargo?'deliver':'shelter',label:cargo?'Deliver supplies':'Take shelter',icon:'home',target:home});
  if (!sheltered) {
    const trees: Position[] = [];
    for (let y=0;y<map.height;y++) for (let x=0;x<map.width;x++)
      if (map.getTile(x,y)?.type === 'forest' && !villagers.isTileAlreadyBeingClearedByOther(v.id,x,y)) trees.push({x,y});
    trees.sort((a,b) => distance(a)-distance(b));
    const tree = trees.find(reach);
    if (tree && v.currentTask !== 'clearing') jobs.push({key:'chop',kind:'chop',label:'Chop wood',icon:'axe',target:tree});
    if (!cargo && v.currentTask !== 'hunting' && villagers.huntingGrounds.candidates(v).some(reach))
      jobs.push({key:'hunt',kind:'hunt',label:'Hunt',icon:'bow'});
    if (buildings.getBuildingsOfType('herbalFire').length && !cargo && v.currentTask !== 'gatheringHerbs' && resources.resources.herbs+foraging.reservedHerbs(villagers)<cfg.herbs.capacity &&
      villagers.huntingGrounds.candidates(v,undefined,{minimum:cfg.herbs.minimumForestDepth,maximum:cfg.herbs.maximumForestDepth,searchRadius:cfg.herbs.searchRadius}).some(reach))
      jobs.push({key:'herbs',kind:'herbs',label:'Gather herbs',icon:'herbs'});
    const offered = new Set<string>();
    const sorted = [...buildings.buildings].sort((a,b) => distance({x:a.tileX,y:a.tileY})-distance({x:b.tileX,y:b.tileY}));
    for (const b of sorted) {
      const spec = buildings.getBuildingConfig(b.configId);
      if (!spec || !buildings.getArrivalTiles(b).some(reach)) continue;
      if (!b.built && !b.assignedWorkers.length && !offered.has('build')) {
        jobs.push({key:'build',kind:'build',label:`Build ${spec.name}`,icon:'hammer',buildingId:b.id});offered.add('build');
      }
      if (b.built && (b.hp<b.maxHp || b.needsRepair) && !offered.has('repair') &&
        resources.canAfford(Math.ceil(spec.costWood*cfg.repair.repairCostWoodPercent),0) &&
        !villagers.getAliveVillagers().some(o=>o.currentTask==='repairing'&&o.assignedBuildingId===b.id)) {
        jobs.push({key:'repair',kind:'repair',label:`Repair ${spec.name}`,icon:'repair',buildingId:b.id});offered.add('repair');
      }
      if (!b.built || !spec.maxWorkers || offered.has(b.configId)) continue;
      if (b.assignedWorkers.length>=spec.maxWorkers && !b.assignedWorkers.includes(v.id)) continue;
      const garden = b.configId==='garden';
      if (garden && season===Season.Winter) continue;
      if (!garden && v.assignedBuildingId===b.id) continue;
      if (b.configId==='furWorkshop' && resources.resources.fur<cfg.resources.furPerClothing) continue;
      const label = garden ? b.cropState==='ripe'?'Harvest food':'Tend garden' : b.configId==='furWorkshop'?'Make fur coats':'Gather wood';
      jobs.push({key:`${garden?'farm':'work'}:${b.configId}`,kind:garden?'farm':'work',label,icon:garden?'wheat':b.configId==='furWorkshop'?'clothing':'axe',buildingId:b.id});
      offered.add(b.configId);
    }
  }
  if (v.currentTask || v.path.length) jobs.push({key:'stop',kind:'stop',label:'Stop work',icon:'stop'});
  return jobs;
}
