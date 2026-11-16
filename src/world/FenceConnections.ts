import { BuildingInstance } from '../types';
export type FenceDirection = readonly [number, number];
export const isFence = (b: BuildingInstance) => b.configId === 'palisadeWall' || b.configId === 'palisadeGate';
export function fenceConnections(b: BuildingInstance, buildings: BuildingInstance[]): FenceDirection[] {
  return ([[0,-1],[1,0],[0,1],[-1,0]] as const).filter(([dx,dy]) =>
    buildings.some(o => o.id !== b.id && isFence(o) && o.tileX === b.tileX + dx && o.tileY === b.tileY + dy));
}
export function fenceAxis(b: BuildingInstance, buildings: BuildingInstance[]): FenceDirection {
  const dirs = fenceConnections(b, buildings), horizontal = dirs.filter(d => d[0]).length, vertical = dirs.filter(d => d[1]).length;
  return vertical > horizontal || (vertical === horizontal && b.rotation === 90) ? [0,1] : [1,0];
}
