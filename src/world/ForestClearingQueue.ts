import { Position, TileType } from '../types';
import { TileMap } from './TileMap';

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

/** Explicit clicks come first, then older marked trees, then automatic nearby work. */
export function clearingTargets(map: TileMap,origin:Position,automatic:boolean): Position[] {
  const targets:Position[]=[];
  for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++) {
    const tile=map.getTile(x,y)!;
    if(tile.type===TileType.Forest && !tile.buildingId && (automatic||tile.markedForClearing))targets.push({x,y});
  }
  return targets.sort((a,b)=>{
    const first=map.getTile(a.x,a.y)!,second=map.getTile(b.x,b.y)!;
    const rank=(tile:typeof first)=>tile.clearingQueueOrder!==undefined?0:tile.markedForClearing?1:2;
    return rank(first)-rank(second) ||
      (first.clearingQueueOrder!==undefined&&second.clearingQueueOrder!==undefined?first.clearingQueueOrder-second.clearingQueueOrder:0) ||
      Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y);
  });
}
