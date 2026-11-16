import { Season, VillagerData } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { hasCoat } from './EquipmentSystem';
import { EconomyForecast } from './ForecastSystem';

export interface SettlementWarning { id: string; text: string; urgent?: boolean }

/** Persistent, actionable warnings disappear when their condition is resolved. */
export function settlementWarnings(plan: EconomyForecast, people: VillagerData[], season: Season,
  inside: (id: string) => boolean, snowstorm: boolean): SettlementWarning[] {
  const cfg=getConfig(), warnings:SettlementWarning[]=[];
  const outside=people.filter(v=>!inside(v.id));
  const freezing=outside.filter(v=>(v.coldExposure??0)>=cfg.cold.unclothedSurvivalSeconds*cfg.cold.warningFraction);
  if(season===Season.Winter && freezing.length) {
    const seconds=Math.max(0,Math.ceil(Math.min(...freezing.map(v=>(cfg.cold.unclothedSurvivalSeconds-(v.coldExposure??0))/
      ((hasCoat(v)?cfg.cold.clothedExposureMultiplier:1)*(snowstorm?cfg.cold.snowstormExposureMultiplier:1))))));
    warnings.push({id:'cold',urgent:true,text:`${freezing.length} resident(s) are freezing — about ${seconds}s left. Call Shelter immediately; only worn fur coats protect outdoors.`});
  } else if(season===Season.Winter && outside.some(v=>!hasCoat(v))) {
    warnings.push({id:'cold',urgent:true,text:'Unclothed residents are outdoors in winter. Call Shelter before they die from hypothermia.'});
  } else if(season===Season.Autumn && plan.coats<plan.population) {
    warnings.push({id:'coats',text:`${plan.population-plan.coats} resident(s) lack warm clothing. Hunt for pelts, sew fur coats, or keep them inside during winter.`});
  }
  if(plan.springBalance<0) warnings.push({id:'food',urgent:season===Season.Winter,text:`Not enough food until spring: about ${Math.ceil(-plan.springBalance-1e-8)} missing. Send someone hunting or build and staff a garden before frost.`});
  if(plan.dyingCrops) warnings.push({id:'crops',text:'Some crops cannot mature before winter and will die at frost. Plan another source of food.'});
  if(season===Season.Winter && plan.hasWard && plan.wardSeconds<getConfig().seasons.winterDuration && plan.herbs<plan.herbsNeeded)
    warnings.push({id:'herbs',text:'Ward fuel will not cover the remaining winter. Gather herbs if it is safe; otherwise shelter and rely on defenses.'});
  return warnings;
}
