import { BuildingSystem } from './BuildingSystem';
import { VillagerSystem } from './VillagerSystem';
import { HordeSystem } from './HordeSystem';
import { getConfig } from '../data/ConfigLoader';

export interface TowerShot { x: number; y: number; targetX: number; targetY: number; age: number }

/** Only residents actually sheltered inside a tower can operate its arrow slits. */
export class TowerCombatSystem {
  public shots: TowerShot[]=[];
  update(dt: number,buildings: BuildingSystem,villagers: VillagerSystem,horde: HordeSystem): void {
    for(const shot of this.shots)shot.age+=dt;
    this.shots=this.shots.filter(s=>s.age<getConfig().rendering.towerShotSeconds);
    if(!horde.isActive)return;
    for(const tower of buildings.getBuildingsOfType('watchtower')) {
      const cfg=buildings.getBuildingConfig(tower.configId)!;
      tower.towerAttackCooldown=Math.max(0,(tower.towerAttackCooldown??0)-dt);
      const archers=Math.min(cfg.capacity,villagers.getAliveVillagers().filter(v=>Math.floor(v.x)===tower.tileX&&Math.floor(v.y)===tower.tileY).length);
      if(!archers || tower.towerAttackCooldown>0)continue;
      const target=horde.getActiveEnemies().filter(e=>Math.hypot(e.x-tower.tileX,e.y-tower.tileY)<=cfg.towerRange!)
        .sort((a,b)=>Math.hypot(a.x-tower.tileX,a.y-tower.tileY)-Math.hypot(b.x-tower.tileX,b.y-tower.tileY))[0];
      if(!target)continue;
      horde.damageEnemy(target.id,cfg.towerDamage!*archers);
      tower.towerAttackCooldown=cfg.towerAttackInterval;
      this.shots.push({x:tower.tileX,y:tower.tileY,targetX:target.x,targetY:target.y,age:0});
    }
  }
  reset(): void { this.shots=[]; }
}
