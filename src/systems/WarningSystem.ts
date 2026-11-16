import { Season, VillagerData } from '../types';
import { getConfig } from '../data/ConfigLoader';
import { hasCoat } from './EquipmentSystem';
import { EconomyForecast } from './ForecastSystem';

export interface SettlementWarning { id: string; text: string; urgent?: boolean }

/** Persistent, actionable warnings disappear when their condition is resolved. */
export function settlementWarnings(plan: EconomyForecast, people: VillagerData[], season: Season,
  inside: (id: string) => boolean, snowstorm: boolean, warmth: (id: string) => number = () => 1): SettlementWarning[] {
  const cfg=getConfig(), warnings:SettlementWarning[]=[];
  const outside=people.filter(v=>!inside(v.id));
  const freezing=people.filter(v=>!inside(v.id)||warmth(v.id)<1).filter(v=>(v.coldExposure??0)>=cfg.cold.unclothedSurvivalSeconds*cfg.cold.warningFraction);
  if(season===Season.Winter && freezing.length) {
    const seconds=Math.max(0,Math.ceil(Math.min(...freezing.map(v=>(cfg.cold.unclothedSurvivalSeconds-(v.coldExposure??0))/
      ((hasCoat(v)?cfg.cold.clothedExposureMultiplier:1)*(inside(v.id)?cfg.heating.unheatedExposureMultiplier:snowstorm?cfg.cold.snowstormExposureMultiplier:1))))));
    const action=freezing.some(v=>inside(v.id))?'Gather wood immediately to heat the shelters; warm clothing also slows the cold.':'Call Shelter immediately; use heated shelter or warm clothing.';
    warnings.push({id:'cold',urgent:true,text:`${freezing.length} resident(s) are freezing — about ${seconds}s left. ${action}`});
  } else if(season===Season.Winter && outside.some(v=>!hasCoat(v))) {
    warnings.push({id:'cold',urgent:true,text:'Unclothed residents are outdoors in winter. Call Shelter before they die from hypothermia.'});
  } else if(season===Season.Autumn && plan.coats<plan.population) {
    warnings.push({id:'coats',text:`${plan.population-plan.coats} resident(s) lack warm clothing. Hunt for pelts, sew fur coats, or keep them in heated shelters during winter.`});
  }
  if(plan.springBalance<0) warnings.push({id:'food',urgent:season===Season.Winter,text:`Not enough food until spring: about ${Math.ceil(-plan.springBalance-1e-8)} missing. Send someone hunting or build and staff a garden before frost.`});
  if(plan.woodBalance < -1e-8)warnings.push({id:'wood',urgent:season===Season.Winter,text:`Not enough firewood: ${Math.ceil(-plan.woodBalance-1e-8)} more wood needed for winter heating. Each shelter uses ${cfg.heating.woodPerShelterPerWinter} per full winter. Chop trees and keep a reserve.`});
  if(plan.unheatedShelters)warnings.push({id:'heating',urgent:true,text:'No firewood: shelters are unheated. Residents can freeze indoors. Gather wood to restore heating.'});
  if(plan.dyingCrops) warnings.push({id:'crops',text:'Some crops cannot mature before winter and will die at frost. Plan another source of food.'});
  if(season===Season.Winter && plan.hasWard && plan.wardSeconds<getConfig().seasons.winterDuration && plan.herbs<plan.herbsNeeded)
    warnings.push({id:'herbs',text:'Ward fuel will not cover the remaining winter. Gather herbs if it is safe; otherwise shelter and rely on defenses.'});
  return warnings;
}
