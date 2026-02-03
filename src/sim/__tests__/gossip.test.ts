import { describe, expect, it } from 'vitest';
import { Simulation } from '../sim';

describe('Gossip propagation', () => {
  it('applies uncertainty to belief confidence', () => {
    const sim = new Simulation(4);
    const listener = sim.state.agents[1];
    const token = {
      id: 'rumor',
      topic: 'park:crowded',
      value: true,
      uncertainty: 0.3,
      sourceId: 'a1',
      createdAt: sim.state.time,
    };
    sim.applyGossip(listener, token);
    expect(listener.beliefs['park:crowded'].confidence).toBeCloseTo(0.7, 2);
  });
});
