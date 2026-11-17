import { BuildingInstance, HealthState, VillagerData } from '../types';

export function isFarmer(v:VillagerData,buildings:BuildingInstance[]):boolean {
  return v.currentTask==='farming'&&buildings.some(b=>b.id===v.assignedBuildingId&&b.built&&b.configId==='garden');
}
export function hasCargo(v:VillagerData):boolean {return Object.values(v.cargo??{}).some(n=>n>0);}

/** Generic orders protect farmers. An explicitly selected resident may change any job. */
export function orderedWorkers(people:VillagerData[],buildings:BuildingInstance[],task:string,selected:string|null):VillagerData[] {
  const rank=(v:VillagerData)=>!v.currentTask?0:v.currentTask==='clearing'&&v.repeatClearing?1:['hunting','gatheringHerbs'].includes(v.currentTask)?3:2;
  return people.filter(v=>v.health!==HealthState.Dead&&v.currentTask!==task&&(!isFarmer(v,buildings)||v.id===selected))
    .sort((a,b)=>Number(b.id===selected)-Number(a.id===selected)||rank(a)-rank(b));
}

/** Automatic higher-priority work may take an idle resident or an automatic woodcutter. */
export function automaticWorkers(people:VillagerData[]):VillagerData[] {
  return people.filter(v=>v.health!==HealthState.Dead&&!v.holdPosition&&!hasCargo(v)&&
    ((!v.currentTask&&!v.assignedBuildingId)||(v.currentTask==='clearing'&&v.repeatClearing)))
    .sort((a,b)=>Number(!!a.currentTask)-Number(!!b.currentTask));
}
