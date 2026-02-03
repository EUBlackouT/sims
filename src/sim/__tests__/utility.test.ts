import { describe, expect, it } from 'vitest';
import { Simulation } from '../sim';

describe('Utility explain', () => {
  it('provides a top action breakdown', () => {
    const sim = new Simulation(3);
    sim.step(1);
    const agent = sim.state.agents[0];
    const explanation = sim.getDecisionExplanation(agent.id);
    expect(explanation).not.toBeNull();
    expect(explanation?.topActions.length).toBeGreaterThan(0);
    const action = explanation?.topActions[0];
    expect(action?.needScores).toBeDefined();
    expect(action?.randomness).toBeTypeOf('number');
  });
});
