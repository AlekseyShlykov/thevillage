import { Position, TileType } from '../types';
import { TileMap } from './TileMap';
import { getConfig } from '../data/ConfigLoader';

const neighbours=[[0,-1],[1,0],[0,1],[-1,0]] as const;

/** Queue metadata lives on tiles, so normal world saves preserve click order. */
export function queuedForestTiles(map: TileMap): Position[] {
  return map.getMarkedClearingTiles().filter(p=>map.getTile(p.x,p.y)!.clearingQueueOrder!==undefined)
    .sort((a,b)=>map.getTile(a.x,a.y)!.clearingQueueOrder!-map.getTile(b.x,b.y)!.clearingQueueOrder!);
}

export function queueForestTile(map: TileMap,x:number,y:number): boolean {
  const tile=map.getTile(x,y);
  if(!tile || tile.type!==TileType.Forest || tile.buildingId || tile.clearingQueueOrder!==undefined)return false;
  const queue=queuedForestTiles(map),last=queue[queue.length-1];
  tile.clearingQueueOrder=last?map.getTile(last.x,last.y)!.clearingQueueOrder!+1:1;
  tile.markedForClearing=true;return true;
}

/** Player choices stay first. Automatic work widens the village edge in radial bands. */
export function clearingTargets(map: TileMap,origin:Position,automatic:boolean): Position[] {
  const center=map.getClearingCenter(),ringWidth=getConfig().villagers.clearingRingWidth;
  const targets:Array<Position&{priority:number;order:number;ring:number;distance:number}>=[];
  for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++) {
    const tile=map.getTile(x,y)!;
    if(tile.type!==TileType.Forest || tile.buildingId || (!automatic&&!tile.markedForClearing))continue;
    const priority=tile.clearingQueueOrder!==undefined?0:tile.markedForClearing?1:2;
    // Finish the existing settlement boundary instead of opening isolated holes in forest.
    if(priority===2 && !neighbours.some(([dx,dy])=>{const next=map.getTile(x+dx,y+dy);return next&&next.type!==TileType.Forest;}))continue;
    targets.push({x,y,priority,order:tile.clearingQueueOrder??0,
      ring:Math.floor(Math.hypot(x+.5-center.x,y+.5-center.y)/ringWidth),distance:Math.hypot(x-origin.x,y-origin.y)});
  }
  return targets.sort((a,b)=>a.priority-b.priority || a.order-b.order ||
    (a.priority===2?a.ring-b.ring:0) || a.distance-b.distance).map(({x,y})=>({x,y}));
}
