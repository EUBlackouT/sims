import { vec2, Vec2 } from './math';

export class IsoGrid {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  walkable: boolean[][];

  constructor(width: number, height: number, tileWidth: number, tileHeight: number) {
    this.width = width;
    this.height = height;
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
    this.walkable = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => true),
    );
  }

  isInside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isWalkable(x: number, y: number) {
    return this.isInside(x, y) && this.walkable[y][x];
  }

  toWorld(x: number, y: number) {
    const worldX = (x - y) * (this.tileWidth / 2);
    const worldY = (x + y) * (this.tileHeight / 2);
    return vec2(worldX, worldY);
  }

  toGrid(worldX: number, worldY: number) {
    const x = (worldX / (this.tileWidth / 2) + worldY / (this.tileHeight / 2)) / 2;
    const y = (worldY / (this.tileHeight / 2) - worldX / (this.tileWidth / 2)) / 2;
    return vec2(Math.floor(x), Math.floor(y));
  }
}
