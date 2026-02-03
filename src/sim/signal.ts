import { clamp } from './util';

export type SignalFieldName = 'noise' | 'smell' | 'light';

export class SignalFieldSystem {
  width: number;
  height: number;
  noise: number[][];
  smell: number[][];
  light: number[][];
  diffusion: number;
  decay: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.noise = this.createField();
    this.smell = this.createField();
    this.light = this.createField();
    this.diffusion = 0.35;
    this.decay = 0.985;
  }

  private createField() {
    return Array.from({ length: this.height }, () => Array.from({ length: this.width }, () => 0));
  }

  addNoise(x: number, y: number, amount: number) {
    this.addToField(this.noise, x, y, amount);
  }

  addSmell(x: number, y: number, amount: number) {
    this.addToField(this.smell, x, y, amount);
  }

  setLightBase(value: number) {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        this.light[y][x] = value;
      }
    }
  }

  addLight(x: number, y: number, amount: number) {
    this.addToField(this.light, x, y, amount);
  }

  step() {
    this.noise = this.diffuseAndDecay(this.noise);
    this.smell = this.diffuseAndDecay(this.smell);
    this.light = this.diffuseAndDecay(this.light);
  }

  sample(field: SignalFieldName, x: number, y: number) {
    const gridX = clamp(Math.round(x), 0, this.width - 1);
    const gridY = clamp(Math.round(y), 0, this.height - 1);
    const source = this[field];
    return source[gridY][gridX];
  }

  private addToField(field: number[][], x: number, y: number, amount: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return;
    }
    field[y][x] = clamp(field[y][x] + amount, 0, 1);
  }

  private diffuseAndDecay(field: number[][]) {
    const result = this.createField();
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const current = field[y][x];
        const neighbors = this.collectNeighbors(field, x, y);
        const avg = neighbors.reduce((sum, value) => sum + value, 0) / neighbors.length;
        const diffused = current + (avg - current) * this.diffusion;
        result[y][x] = clamp(diffused * this.decay, 0, 1);
      }
    }
    return result;
  }

  private collectNeighbors(field: number[][], x: number, y: number) {
    const values: number[] = [];
    const coords = [
      [x, y],
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of coords) {
      if (nx >= 0 && ny >= 0 && nx < this.width && ny < this.height) {
        values.push(field[ny][nx]);
      }
    }
    return values;
  }
}
