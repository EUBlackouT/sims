import type { Simulation } from './sim';
import { vec2 } from './math';

export class DirectorSystem {
  sim: Simulation;
  nextEventAt: number;

  constructor(sim: Simulation) {
    this.sim = sim;
    this.nextEventAt = 60 + sim.rng.next() * 60;
  }

  update() {
    if (this.sim.state.time < this.nextEventAt) {
      return;
    }
    this.triggerEvent();
    this.nextEventAt = this.sim.state.time + 60 + this.sim.rng.next() * 60;
  }

  private triggerEvent() {
    const events = ['power_outage', 'burnt_dinner', 'misdirected_text', 'unexpected_guest'];
    const choice = events[Math.floor(this.sim.rng.next() * events.length)];
    switch (choice) {
      case 'power_outage':
        this.powerOutage();
        break;
      case 'burnt_dinner':
        this.burntDinner();
        break;
      case 'misdirected_text':
        this.misdirectedText();
        break;
      case 'unexpected_guest':
        this.unexpectedGuest();
        break;
      default:
        break;
    }
  }

  private powerOutage() {
    const anchor = this.sim.state.objects.find((obj) => obj.type === 'sofa') ?? this.sim.state.objects[0];
    const center = vec2(anchor.position.x, anchor.position.y);
    this.sim.worldState.powerOutage = {
      center,
      until: this.sim.state.time + 40,
      radius: 6,
    };
    this.sim.addEventLog(`Director: Power outage near ${anchor.label}.`);
  }

  private burntDinner() {
    const anchor = this.sim.state.objects.find((obj) => obj.type === 'stove') ?? this.sim.state.objects[0];
    this.sim.signalBursts.push({
      type: 'smell',
      position: vec2(anchor.position.x, anchor.position.y),
      amount: 0.9,
      remaining: 18,
    });
    this.sim.signalBursts.push({
      type: 'noise',
      position: vec2(anchor.position.x, anchor.position.y),
      amount: 0.6,
      remaining: 8,
    });
    this.sim.addEventLog(`Director: Burnt dinner at ${anchor.label}.`);
  }

  private misdirectedText() {
    const sender = this.sim.state.agents[Math.floor(this.sim.rng.next() * this.sim.state.agents.length)];
    const rumor = this.sim.createDirectorRumor(sender);
    if (rumor) {
      this.sim.gossipTokens.push(rumor);
      const recipient = this.sim.state.agents.find((agent) => agent.id !== sender.id);
      if (recipient) {
        this.sim.applyGossip(recipient, rumor);
      }
      this.sim.addEventLog(`Director: Misdirected text spreads ${rumor.topic}.`);
    }
  }

  private unexpectedGuest() {
    const target = this.sim.state.agents[Math.floor(this.sim.rng.next() * this.sim.state.agents.length)];
    this.sim.worldState.guestFor = target.id;
    this.sim.worldState.guestUntil = this.sim.state.time + 35;
    this.sim.addEventLog(`Director: Unexpected guest at ${target.name}'s door.`);
  }
}
