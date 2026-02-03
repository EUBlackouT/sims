import { describe, expect, it } from 'vitest';
import { SignalFieldSystem } from '../signal';

describe('SignalFieldSystem', () => {
  it('diffuses and decays values', () => {
    const system = new SignalFieldSystem(5, 5);
    system.addNoise(2, 2, 1);
    const beforeCenter = system.noise[2][2];
    system.step();
    const afterCenter = system.noise[2][2];
    const neighbor = system.noise[2][3];
    expect(beforeCenter).toBeGreaterThan(afterCenter);
    expect(neighbor).toBeGreaterThan(0);
  });
});
