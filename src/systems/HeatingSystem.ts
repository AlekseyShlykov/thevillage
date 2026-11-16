import { BuildingInstance, Season } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { ResourceSystem } from './ResourceSystem';

export function heatedShelters(buildings:BuildingInstance[]):BuildingInstance[] {
  const ids=new Set(getConfig().heating.buildingIds);
  return buildings.filter(b=>b.built&&ids.has(b.configId));
}

/** Fuel is shared evenly and charged over time, so unfinished buildings and loading cost nothing extra. */
export class HeatingSystem {
  private warmth=new Map<string,number>();
  update(dt:number,buildings:BuildingInstance[],resources:ResourceSystem,season:Season):void {
    this.warmth.clear();if(season!==Season.Winter)return;
    const cfg=getConfig(),homes=heatedShelters(buildings);
    const demand=homes.length*cfg.heating.woodPerShelterPerWinter*dt/cfg.seasons.winterDuration;
    const fuel=Math.min(resources.resources.wood,demand);
    if(fuel>0)resources.consumeWood(fuel);
    const ratio=demand>0?Math.min(1,fuel/demand):Number(resources.resources.wood>0);
    for(const b of homes) {
      const size=cfg.buildings[b.configId];
      for(let y=0;y<size.height;y++)for(let x=0;x<size.width;x++)this.warmth.set(`${b.tileX+x},${b.tileY+y}`,ratio);
    }
  }
  at(x:number,y:number):number {return this.warmth.get(`${Math.floor(x)},${Math.floor(y)}`)??1;}
}
