import { describe, expect, it } from 'vitest';
import { Simulation } from '../sim';

describe('Belief updates', () => {
  it('decays confidence over time', () => {
    const sim = new Simulation(1);
    const agent = sim.state.agents[0];
    agent.beliefs['fridge:hasFood'].confidence = 1;
    agent.position.x = 0;
    agent.position.y = 0;
    sim.step(20);
    expect(agent.beliefs['fridge:hasFood'].confidence).toBeLessThan(1);
  });

  it('updates beliefs when perceiving objects', () => {
    const sim = new Simulation(2);
    const agent = sim.state.agents[0];
    const fridge = sim.state.objects.find((obj) => obj.type === 'fridge');
    if (!fridge) {
      throw new Error('Missing fridge');
    }
    agent.position.x = fridge.position.x;
    agent.position.y = fridge.position.y;
    sim.worldState.fridgeFood = 2;
    sim.step(1);
    expect(agent.beliefs['fridge:hasFood'].value).toBe(true);
    expect(agent.beliefs['fridge:hasFood'].confidence).toBeGreaterThan(0.5);
  });
});
