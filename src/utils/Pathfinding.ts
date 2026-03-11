import { Position } from '../types';

interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

export function findPath(
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  isWalkable: (x: number, y: number) => boolean,
  mapWidth: number,
  mapHeight: number,
  maxIterations = 1000
): Position[] {
  if (goalX < 0 || goalX >= mapWidth || goalY < 0 || goalY >= mapHeight) return [];
  if (startX === goalX && startY === goalY) return [{ x: goalX, y: goalY }];

  const open: PathNode[] = [];
  const closed = new Set<number>();
  const key = (x: number, y: number) => y * mapWidth + x;

  const h = (x: number, y: number) => Math.abs(x - goalX) + Math.abs(y - goalY);

  const startNode: PathNode = { x: startX, y: startY, g: 0, h: h(startX, startY), f: h(startX, startY), parent: null };
  open.push(startNode);

  const dirs = [
    { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
    { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
  ];

  let iterations = 0;

  while (open.length > 0 && iterations < maxIterations) {
    iterations++;
    
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open[bestIdx];
    open.splice(bestIdx, 1);

    if (current.x === goalX && current.y === goalY) {
      const path: Position[] = [];
      let node: PathNode | null = current;
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    closed.add(key(current.x, current.y));

    for (const dir of dirs) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;

      if (nx < 0 || nx >= mapWidth || ny < 0 || ny >= mapHeight) continue;
      if (closed.has(key(nx, ny))) continue;
      
      const isGoal = nx === goalX && ny === goalY;
      if (!isGoal && !isWalkable(nx, ny)) continue;

      // Diagonal movement cost
      const isDiag = dir.dx !== 0 && dir.dy !== 0;
      if (isDiag) {
        if (!isWalkable(current.x + dir.dx, current.y) && !isWalkable(current.x, current.y + dir.dy)) {
          continue;
        }
      }

      const g = current.g + (isDiag ? 1.414 : 1);
      const existing = open.find(n => n.x === nx && n.y === ny);
      
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = g + existing.h;
          existing.parent = current;
        }
      } else {
        const hVal = h(nx, ny);
        open.push({ x: nx, y: ny, g, h: hVal, f: g + hVal, parent: current });
      }
    }
  }

  return [];
}
