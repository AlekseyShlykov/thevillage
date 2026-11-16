import { HealthState, Position, Season, VillagerData } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { hasCoat } from './EquipmentSystem';

/** Coats protect outdoors; shelters need fuel to warm residents rather than merely slow the cold. */
export class ColdSystem {
  update(dt:number,people:VillagerData[],shelters:Position[],season:Season,snowstorm:boolean,
    onDeath:(v:VillagerData)=>void,warmthAt:(x:number,y:number)=>number=()=>1):void {
    const balance=getConfig(),cfg=balance.cold,inside=new Set(shelters.map(p=>`${p.x},${p.y}`));
    for(const v of people) {
      if(v.health===HealthState.Dead)continue;
      if(season!==Season.Winter){v.coldExposure=0;v.timeOutsideInWinter=0;continue;}
      const coat=hasCoat(v)?cfg.clothedExposureMultiplier:1;
      if(inside.has(`${Math.floor(v.x)},${Math.floor(v.y)}`)) {
        const heat=warmthAt(v.x,v.y);
        const change=(1-heat)*balance.heating.unheatedExposureMultiplier*coat-heat*cfg.warmupMultiplier;
        v.coldExposure=Math.max(0,(v.coldExposure??0)+dt*change);v.timeOutsideInWinter=0;
      } else {
        v.timeOutsideInWinter=(v.timeOutsideInWinter??0)+dt;
        v.coldExposure=(v.coldExposure??0)+dt*coat*(snowstorm?cfg.snowstormExposureMultiplier:1);
      }
      if((v.coldExposure??0)>=cfg.unclothedSurvivalSeconds)onDeath(v);
    }
  }
}
