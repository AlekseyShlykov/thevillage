import { BuildingInstance } from '../types';

/** Clockwise world-grid directions: north, east, south, west. */
export const moatDirections = [[0,-1],[1,0],[0,1],[-1,0]] as const;
export function moatConnectionMask(b: BuildingInstance, buildings: BuildingInstance[]): number {
  return moatDirections.reduce((mask,[dx,dy],i)=>buildings.some(o=>o.configId==='moat' &&
    o.tileX===b.tileX+dx && o.tileY===b.tileY+dy) ? mask|(1<<i) : mask,0);
}

const baseMasks = [0,1,5,3,11,15];
/** Six painted shapes cover all sixteen neighbour patterns with quarter turns. */
export function moatSprite(mask: number): { frame: number; turns: number } {
  for(let frame=0;frame<baseMasks.length;frame++) {
    let rotated=baseMasks[frame];
    for(let turns=0;turns<4;turns++) {
      if(rotated===mask)return {frame,turns};
      rotated=((rotated<<1)|(rotated>>3))&15;
    }
  }
  return {frame:0,turns:0};
}
