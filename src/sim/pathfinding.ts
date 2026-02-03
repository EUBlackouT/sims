import { vec2, Vec2 } from './math';
import { IsoGrid } from './grid';

type GridNode = {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: GridNode | null;
};

export class Pathfinder {
  grid: IsoGrid;

  constructor(grid: IsoGrid) {
    this.grid = grid;
  }

  private heuristic(a: GridNode, b: GridNode) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  findPath(startX: number, startY: number, goalX: number, goalY: number): Vec2[] {
    if (!this.grid.isWalkable(goalX, goalY)) {
      return [];
    }

    const start: GridNode = { x: startX, y: startY, g: 0, h: 0, f: 0, parent: null };
    const goal: GridNode = { x: goalX, y: goalY, g: 0, h: 0, f: 0, parent: null };

    const open: GridNode[] = [start];
    const closed = new Set<string>();

    const nodeKey = (x: number, y: number) => `${x},${y}`;

    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift()!;
      if (current.x === goal.x && current.y === goal.y) {
        const path: Vec2[] = [];
        let node: GridNode | null = current;
        while (node) {
          path.unshift(vec2(node.x, node.y));
          node = node.parent;
        }
        return path;
      }

      closed.add(nodeKey(current.x, current.y));

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];

      for (const neighbor of neighbors) {
        if (!this.grid.isWalkable(neighbor.x, neighbor.y)) {
          continue;
        }
        const key = nodeKey(neighbor.x, neighbor.y);
        if (closed.has(key)) {
          continue;
        }

        const gScore = current.g + 1;
        let existing = open.find((node) => node.x === neighbor.x && node.y === neighbor.y);
        if (!existing) {
          existing = {
            x: neighbor.x,
            y: neighbor.y,
            g: gScore,
            h: 0,
            f: 0,
            parent: current,
          };
          existing.h = this.heuristic(existing, goal);
          existing.f = existing.g + existing.h;
          open.push(existing);
        } else if (gScore < existing.g) {
          existing.g = gScore;
          existing.f = existing.g + existing.h;
          existing.parent = current;
        }
      }
    }

    return [];
  }
}
