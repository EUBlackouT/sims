import { actions, createDefaultNeeds, createDefaultObjects } from './data';
import { vec2, vec2Clone, vec2Distance, vec2Normalize, Vec2 } from './math';
import { createRng } from './rng';
import { IsoGrid } from './grid';
import { Pathfinder } from './pathfinding';
import { SignalFieldSystem } from './signal';
import {
  AgentState,
  ActionDefinition,
  DecisionExplanation,
  GossipToken,
  Memory,
  NeedId,
  SimState,
} from './types';
import { clamp } from './util';
import { DirectorSystem } from './director';

const needsDeficit = (value: number) => clamp((100 - value) / 100, 0, 1);

export class Simulation {
  state: SimState;
  rng: ReturnType<typeof createRng>;
  grid: IsoGrid;
  pathfinder: Pathfinder;
  signals: SignalFieldSystem;
  worldState: {
    fridgeFood: number;
    parkCrowded: boolean;
    trashLevel: number;
    powerOutage?: {
      center: Vec2;
      until: number;
      radius: number;
    };
    guestFor?: string;
    guestUntil?: number;
  };
  gossipTokens: GossipToken[];
  signalBursts: {
    type: 'noise' | 'smell';
    position: Vec2;
    amount: number;
    remaining: number;
  }[];
  eventLog: { time: number; message: string }[];
  director: DirectorSystem;
  ambientLight: number;

  constructor(seed: number) {
    this.rng = createRng(seed);
    this.grid = new IsoGrid(30, 20, 64, 32);
    this.pathfinder = new Pathfinder(this.grid);
    this.signals = new SignalFieldSystem(this.grid.width, this.grid.height);
    this.worldState = {
      fridgeFood: 2,
      parkCrowded: false,
      trashLevel: 1,
    };
    this.gossipTokens = [];
    this.signalBursts = [];
    this.eventLog = [];
    this.director = new DirectorSystem(this);
    this.ambientLight = 1;
    this.state = {
      time: 0,
      objects: createDefaultObjects(),
      agents: [
        this.createAgent('a1', 'Riley', vec2(4, 4)),
        this.createAgent('a2', 'Sam', vec2(5, 8)),
        this.createAgent('a3', 'Nova', vec2(9, 4)),
        this.createAgent('a4', 'Jordan', vec2(11, 8)),
      ],
    };
    this.updateObstacles();
  }

  private createAgent(id: string, name: string, position: Vec2): AgentState {
    const relationships: AgentState['relationships'] = {};
    for (const other of ['a1', 'a2', 'a3', 'a4']) {
      if (other === id) {
        continue;
      }
      relationships[other] = {
        trust: 0.5,
        annoyance: 0.2,
        admiration: 0.4,
      };
    }
    return {
      id,
      name,
      position,
      speed: 1.8,
      needs: createDefaultNeeds(),
      currentAction: null,
      actionTimer: 0,
      actionTarget: null,
      actionLabel: 'Idle',
      path: [],
      signals: { noise: 0, smell: 0, light: 1 },
      mood: { valence: 0.2, arousal: 0.2 },
      beliefs: {
        'fridge:hasFood': {
          key: 'fridge:hasFood',
          value: true,
          confidence: 0.6,
          lastUpdated: 0,
        },
        'park:crowded': {
          key: 'park:crowded',
          value: false,
          confidence: 0.4,
          lastUpdated: 0,
        },
        'shower:available': {
          key: 'shower:available',
          value: true,
          confidence: 0.7,
          lastUpdated: 0,
        },
      },
      relationships,
      memories: [],
    };
  }

  step(dt: number) {
    this.state.time += dt;
    this.updateSignals(dt);
    this.updateBeliefs(dt);
    this.updateMood();
    this.updateNeeds(dt);
    this.updateMemories(dt);
    this.updateAgents(dt);
    if (this.worldState.guestUntil && this.state.time >= this.worldState.guestUntil) {
      this.worldState.guestUntil = undefined;
      this.worldState.guestFor = undefined;
    }
    this.director.update();
  }

  private updateSignals(dt: number) {
    const dayPhase = (this.state.time / 240) % 1;
    const daylight = 0.25 + 0.75 * Math.max(0, Math.sin(dayPhase * Math.PI * 2));
    this.ambientLight = daylight;
    this.signals.setLightBase(daylight);
    this.worldState.trashLevel = clamp(this.worldState.trashLevel + dt * 0.002, 0, 1);
    for (const object of this.state.objects) {
      if (object.type === 'lamp') {
        this.signals.addLight(object.position.x, object.position.y, 0.45);
      }
      if (object.type === 'sofa') {
        this.signals.addLight(object.position.x, object.position.y, 0.15);
      }
      if (object.type === 'trash') {
        this.signals.addSmell(object.position.x, object.position.y, 0.2 * this.worldState.trashLevel);
      }
    }
    for (const agent of this.state.agents) {
      if (agent.currentAction === 'watch_tv') {
        this.signals.addNoise(Math.round(agent.position.x), Math.round(agent.position.y), 0.25);
        this.signals.addLight(Math.round(agent.position.x), Math.round(agent.position.y), 0.2);
      }
      if (agent.currentAction === 'chat') {
        this.signals.addNoise(Math.round(agent.position.x), Math.round(agent.position.y), 0.2);
      }
      if (agent.currentAction === 'cook' || agent.currentAction === 'grill') {
        this.signals.addNoise(Math.round(agent.position.x), Math.round(agent.position.y), 0.2);
        this.signals.addSmell(Math.round(agent.position.x), Math.round(agent.position.y), 0.3);
      }
      if (agent.currentAction === 'shower') {
        this.signals.addSmell(Math.round(agent.position.x), Math.round(agent.position.y), 0.18);
      }
      if (agent.currentAction === 'eat') {
        this.signals.addSmell(Math.round(agent.position.x), Math.round(agent.position.y), 0.24);
      }
    }
    for (const burst of this.signalBursts) {
      if (burst.remaining <= 0) {
        continue;
      }
      if (burst.type === 'noise') {
        this.signals.addNoise(Math.round(burst.position.x), Math.round(burst.position.y), burst.amount);
      } else {
        this.signals.addSmell(Math.round(burst.position.x), Math.round(burst.position.y), burst.amount);
      }
      burst.remaining -= 1;
    }
    this.signalBursts = this.signalBursts.filter((burst) => burst.remaining > 0);
    if (this.worldState.powerOutage && this.state.time < this.worldState.powerOutage.until) {
      const { center, radius } = this.worldState.powerOutage;
      for (let y = Math.max(0, Math.floor(center.y - radius)); y < Math.min(this.grid.height, center.y + radius); y += 1) {
        for (let x = Math.max(0, Math.floor(center.x - radius)); x < Math.min(this.grid.width, center.x + radius); x += 1) {
          const distance = Math.hypot(x - center.x, y - center.y);
          if (distance <= radius) {
            this.signals.light[y][x] = Math.min(this.signals.light[y][x], 0.15);
          }
        }
      }
    }
    if (this.worldState.powerOutage && this.state.time >= this.worldState.powerOutage.until) {
      this.worldState.powerOutage = undefined;
    }
    this.signals.step();

    for (const agent of this.state.agents) {
      agent.signals.noise = this.signals.sample('noise', agent.position.x, agent.position.y);
      agent.signals.smell = this.signals.sample('smell', agent.position.x, agent.position.y);
      agent.signals.light = this.signals.sample('light', agent.position.x, agent.position.y);
    }
  }

  private updateBeliefs(dt: number) {
    const decayRate = 0.0025;
    for (const agent of this.state.agents) {
      for (const belief of Object.values(agent.beliefs)) {
        belief.confidence = clamp(belief.confidence - decayRate * dt, 0, 1);
      }

      for (const object of this.state.objects) {
        const distance = vec2Distance(agent.position, object.position);
        if (distance > 4.5) {
          continue;
        }
        if (object.type === 'fridge') {
          this.setBelief(
            agent,
            'fridge:hasFood',
            this.worldState.fridgeFood > 0,
            0.9,
          );
        }
        if (object.type === 'park') {
          this.setBelief(agent, 'park:crowded', this.worldState.parkCrowded, 0.7);
        }
        if (object.type === 'shower') {
          this.setBelief(agent, 'shower:available', true, 0.8);
        }
      }
    }
  }

  private updateMood() {
    for (const agent of this.state.agents) {
      const needAverage =
        agent.needs.reduce((sum, need) => sum + need.value, 0) / agent.needs.length;
      const valence = clamp((needAverage / 100) * 2 - 1, -1, 1);
      const arousal = clamp(agent.signals.noise * 0.8 + (1 - agent.signals.light) * 0.3, 0, 1);
      agent.mood.valence = valence;
      agent.mood.arousal = arousal;
    }
  }

  private updateMemories(dt: number) {
    const decayRate = 0.002;
    for (const agent of this.state.agents) {
      agent.memories = agent.memories
        .map((memory) => ({
          ...memory,
          strength: clamp(memory.strength - decayRate * dt, 0, 1),
        }))
        .filter((memory) => memory.strength > 0.05);
    }
  }

  private updateNeeds(dt: number) {
    const minutes = dt / 60;
    for (const agent of this.state.agents) {
      for (const need of agent.needs) {
        const noisePenalty = agent.signals.noise > 0.6 ? 0.35 : 0;
        const smellPenalty = agent.signals.smell > 0.6 ? 0.2 : 0;
        const decay = need.decayPerMinute + noisePenalty + smellPenalty;
        need.value = clamp(need.value - decay * minutes, 0, 100);
      }
    }
  }

  private updateAgents(dt: number) {
    for (const agent of this.state.agents) {
      if (!agent.currentAction) {
        const action = this.chooseAction(agent);
        agent.currentAction = action.id;
        agent.actionTimer = action.duration;
        agent.actionLabel = action.label;
        agent.actionTarget = this.pickTarget(action);
        agent.path = [];
      }

      if (agent.actionTarget) {
        const reached = this.followPath(agent, agent.actionTarget, dt);
        if (!reached) {
          continue;
        }
      }

      if (agent.currentAction && agent.actionTimer > 0) {
        agent.actionTimer = Math.max(agent.actionTimer - dt, 0);
        if (agent.actionTimer === 0) {
          this.applyActionEffects(agent);
          agent.currentAction = null;
          agent.actionTarget = null;
          agent.actionLabel = 'Idle';
          agent.path = [];
        }
      }
    }
  }

  private pickTarget(action: ActionDefinition): Vec2 | null {
    if (action.targetObjectTypes.length === 0) {
      return null;
    }
    const candidates = this.state.objects.filter((obj) =>
      action.targetObjectTypes.includes(obj.type),
    );
    if (candidates.length === 0) {
      return null;
    }
    const chosen = candidates[Math.floor(this.rng.next() * candidates.length)];
    const target = vec2Clone(chosen.position);
    if (this.grid.isWalkable(Math.round(target.x), Math.round(target.y))) {
      return target;
    }
    return this.findAdjacentWalkable(target);
  }

  private chooseAction(agent: AgentState) {
    const evaluated = actions.map((action) => {
      const details = this.evaluateAction(agent, action);
      return { action, details };
    });
    evaluated.sort((a, b) => b.details.total - a.details.total);
    agent.lastDecision = {
      topActions: evaluated.slice(0, 3).map(({ action, details }) => ({
        id: action.id,
        label: action.label,
        total: details.total,
        needScores: details.needScores,
        beliefNotes: details.beliefNotes,
        randomness: details.randomness,
      })),
    };
    return evaluated[0].action;
  }

  private evaluateAction(agent: AgentState, action: ActionDefinition) {
    let score = 0;
    const needScores: Partial<Record<NeedId, number>> = {};
    const beliefNotes: string[] = [];
    for (const [needId, effect] of Object.entries(action.effects)) {
      const need = agent.needs.find((entry) => entry.id === needId);
      if (need) {
        const contribution = needsDeficit(need.value) * effect;
        needScores[needId] = contribution;
        score += contribution;
      }
    }
    if (action.id === 'eat') {
      const belief = agent.beliefs['fridge:hasFood'];
      if (belief?.value === false) {
        const modifier = -35 * belief.confidence;
        score += modifier;
        beliefNotes.push(`Belief: fridge empty (${modifier.toFixed(1)})`);
      } else if (belief?.value === true) {
        const modifier = 12 * belief.confidence;
        score += modifier;
        beliefNotes.push(`Belief: fridge stocked (+${modifier.toFixed(1)})`);
      }
      if (this.hasMemory(agent, 'fridge_empty')) {
        score -= 6;
        beliefNotes.push('Memory: fridge empty (-6)');
      }
    }
    if (action.id === 'shower') {
      const belief = agent.beliefs['shower:available'];
      if (belief?.value === false) {
        const modifier = -20 * belief.confidence;
        score += modifier;
        beliefNotes.push(`Belief: shower busy (${modifier.toFixed(1)})`);
      }
    }
    if (action.id === 'go_park') {
      const belief = agent.beliefs['park:crowded'];
      if (belief?.value === true) {
        const modifier = -10 * belief.confidence;
        score += modifier;
        beliefNotes.push(`Belief: park crowded (${modifier.toFixed(1)})`);
      } else if (belief?.value === false) {
        const modifier = 8 * belief.confidence;
        score += modifier;
        beliefNotes.push(`Belief: park calm (+${modifier.toFixed(1)})`);
      }
    }
    if (action.id === 'chat' && this.worldState.guestFor === agent.id) {
      score += 10;
      beliefNotes.push('Guest waiting (+10)');
    }
    const randomness = this.rng.next() * 2;
    score += randomness;
    if (action.id === 'idle') {
      score *= 0.4;
    }
    return { total: score, needScores, beliefNotes, randomness };
  }

  private applyActionEffects(agent: AgentState) {
    const action = actions.find((entry) => entry.id === agent.currentAction);
    if (!action) {
      return;
    }
    if (action.id === 'eat') {
      if (this.worldState.fridgeFood <= 0) {
        this.setBelief(agent, 'fridge:hasFood', false, 0.95);
        agent.currentAction = 'shop';
        agent.actionLabel = 'Shopping (fridge empty)';
        agent.actionTarget = null;
        agent.actionTimer = actions.find((entry) => entry.id === 'shop')?.duration ?? 10;
        agent.path = [];
        this.addMemory(agent, {
          tags: ['fridge_empty', 'frustrated'],
          valence: -0.6,
          arousal: 0.5,
        });
        this.addSpeech(agent, 'I thought the fridge had food.');
        const funNeed = agent.needs.find((need) => need.id === 'fun');
        if (funNeed) {
          funNeed.value = clamp(funNeed.value - 6, 0, 100);
        }
        return;
      }
      this.worldState.fridgeFood = Math.max(0, this.worldState.fridgeFood - 1);
      this.setBelief(agent, 'fridge:hasFood', this.worldState.fridgeFood > 0, 0.85);
    }
    if (action.id === 'shop') {
      this.worldState.fridgeFood = 3;
      this.setBelief(agent, 'fridge:hasFood', true, 0.9);
      this.addMemory(agent, {
        tags: ['shopping', 'relieved'],
        valence: 0.4,
        arousal: 0.2,
      });
    }
    if (action.id === 'chat') {
      const partner = this.findNearbyAgent(agent.id, 3);
      if (partner) {
        agent.relationships[partner.id].trust = clamp(
          agent.relationships[partner.id].trust + 0.05,
          0,
          1,
        );
        agent.relationships[partner.id].admiration = clamp(
          agent.relationships[partner.id].admiration + 0.03,
          0,
          1,
        );
        partner.relationships[agent.id].trust = clamp(
          partner.relationships[agent.id].trust + 0.04,
          0,
          1,
        );
        this.addMemory(agent, {
          tags: ['chat', 'social'],
          valence: 0.3,
          arousal: 0.3,
        });
        this.addMemory(partner, {
          tags: ['chat', 'social'],
          valence: 0.25,
          arousal: 0.25,
        });
        const rumor = this.createGossipToken(agent);
        if (rumor) {
          this.gossipTokens.push(rumor);
          this.applyGossip(partner, rumor);
        }
        this.addSpeech(agent, this.generateSpeech(agent, partner));
        this.addSpeech(partner, this.generateSpeech(partner, agent));
      }
    }
    if (action.id === 'text') {
      const recipient = this.findNearbyAgent(agent.id, 6);
      if (recipient) {
        const rumor = this.createGossipToken(agent);
        if (rumor) {
          this.gossipTokens.push(rumor);
          this.applyGossip(recipient, rumor);
        }
      }
      this.addMemory(agent, {
        tags: ['text', 'social'],
        valence: 0.2,
        arousal: 0.25,
      });
    }
    if (action.id === 'cook' || action.id === 'grill') {
      const failed = this.rng.next() < 0.2;
      if (failed) {
        this.signalBursts.push({
          type: 'smell',
          position: vec2(agent.position.x, agent.position.y),
          amount: 0.8,
          remaining: 12,
        });
        this.addMemory(agent, {
          tags: ['burnt', 'embarrassed'],
          valence: -0.4,
          arousal: 0.5,
        });
        this.addSpeech(agent, 'Yikes, I burnt it.');
      }
    }
    if (action.id === 'clean_trash') {
      this.worldState.trashLevel = 0;
      this.addMemory(agent, {
        tags: ['cleaned', 'relief'],
        valence: 0.3,
        arousal: 0.1,
      });
    }
    for (const [needId, effect] of Object.entries(action.effects)) {
      const need = agent.needs.find((entry) => entry.id === needId);
      if (need) {
        need.value = clamp(need.value + effect, 0, 100);
      }
    }
  }

  private moveAgent(agent: AgentState, target: Vec2, dt: number) {
    const direction = vec2Normalize(vec2(target.x - agent.position.x, target.y - agent.position.y));
    const step = agent.speed * dt;
    agent.position.x += direction.x * step;
    agent.position.y += direction.y * step;
  }

  private followPath(agent: AgentState, target: Vec2, dt: number) {
    const distance = vec2Distance(agent.position, target);
    if (distance < 0.1) {
      agent.position = vec2Clone(target);
      agent.path = [];
      return true;
    }
    if (agent.path.length === 0) {
      const path = this.pathfinder.findPath(
        Math.round(agent.position.x),
        Math.round(agent.position.y),
        Math.round(target.x),
        Math.round(target.y),
      );
      agent.path = path.slice(1);
    }

    if (agent.path.length === 0) {
      return true;
    }
    const waypoint = agent.path[0];
    this.moveAgent(agent, waypoint, dt);
    if (vec2Distance(agent.position, waypoint) < 0.1) {
      agent.position = vec2Clone(waypoint);
      agent.path.shift();
    }
    return vec2Distance(agent.position, target) < 0.1;
  }

  private findAdjacentWalkable(target: Vec2) {
    const candidates = [
      vec2(target.x + 1, target.y),
      vec2(target.x - 1, target.y),
      vec2(target.x, target.y + 1),
      vec2(target.x, target.y - 1),
    ];
    for (const candidate of candidates) {
      if (this.grid.isWalkable(Math.round(candidate.x), Math.round(candidate.y))) {
        return candidate;
      }
    }
    return target;
  }

  private setBelief(
    agent: AgentState,
    key: string,
    value: boolean | number | string,
    confidence: number,
  ) {
    agent.beliefs[key] = {
      key,
      value,
      confidence,
      lastUpdated: this.state.time,
    };
  }

  private addMemory(
    agent: AgentState,
    memory: Pick<Memory, 'tags' | 'valence' | 'arousal'>,
  ) {
    const record: Memory = {
      id: `${agent.id}-${this.state.time}-${memory.tags.join('-')}`,
      tags: memory.tags,
      valence: memory.valence,
      arousal: memory.arousal,
      strength: 1,
      createdAt: this.state.time,
    };
    agent.memories.unshift(record);
  }

  private hasMemory(agent: AgentState, tag: string) {
    return agent.memories.some((memory) => memory.tags.includes(tag));
  }

  private findNearbyAgent(agentId: string, range: number) {
    const agent = this.state.agents.find((entry) => entry.id === agentId);
    if (!agent) {
      return null;
    }
    return (
      this.state.agents.find(
        (entry) => entry.id !== agentId && vec2Distance(entry.position, agent.position) <= range,
      ) ?? null
    );
  }

  private createGossipToken(agent: AgentState): GossipToken | null {
    const topics = ['park:crowded', 'fridge:hasFood'];
    const topic = topics[Math.floor(this.rng.next() * topics.length)];
    const belief = agent.beliefs[topic];
    if (!belief) {
      return null;
    }
    const noiseFactor = clamp(agent.signals.noise * 0.4, 0, 0.4);
    const uncertainty = clamp(1 - belief.confidence + noiseFactor, 0.1, 0.9);
    return {
      id: `rumor-${this.state.time}-${agent.id}`,
      topic,
      value: belief.value,
      uncertainty,
      sourceId: agent.id,
      createdAt: this.state.time,
    };
  }

  applyGossip(agent: AgentState, token: GossipToken) {
    const confidence = clamp(1 - token.uncertainty, 0.1, 0.9);
    this.setBelief(agent, token.topic, token.value, confidence);
    this.addMemory(agent, {
      tags: ['rumor', token.topic],
      valence: 0.05,
      arousal: 0.2,
    });
    this.addEventLog(`Gossip: ${token.topic} = ${String(token.value)} (${confidence.toFixed(2)} conf)`);
  }

  createDirectorRumor(agent: AgentState) {
    const topics = ['park:crowded', 'fridge:hasFood'];
    const topic = topics[Math.floor(this.rng.next() * topics.length)];
    const belief = agent.beliefs[topic];
    if (!belief) {
      return null;
    }
    const uncertainty = clamp(1 - belief.confidence + 0.3, 0.2, 0.9);
    return {
      id: `director-${this.state.time}-${agent.id}`,
      topic,
      value: belief.value,
      uncertainty,
      sourceId: agent.id,
      createdAt: this.state.time,
    } as GossipToken;
  }

  addEventLog(message: string) {
    this.eventLog.unshift({ time: this.state.time, message });
    this.eventLog = this.eventLog.slice(0, 6);
  }

  getEventLog() {
    return this.eventLog;
  }

  private addSpeech(agent: AgentState, text: string) {
    this.speechEvents.push({ agentId: agent.id, text });
  }

  private generateSpeech(speaker: AgentState, listener: AgentState) {
    const templates = [
      `Did you hear about ${listener.name} and the power outage?`,
      `Ugh, this place smells like ${speaker.signals.smell > 0.5 ? 'burnt toast' : 'cheap cologne'}…`,
      `I thought the fridge had food.`,
      `Everyone says the park is ${speaker.beliefs['park:crowded']?.value ? 'packed' : 'empty'} today.`,
    ];
    return templates[Math.floor(this.rng.next() * templates.length)];
  }

  speechEvents: { agentId: string; text: string }[] = [];

  drainSpeechEvents() {
    const events = [...this.speechEvents];
    this.speechEvents = [];
    return events;
  }

  updateObstacles() {
    for (let y = 0; y < this.grid.height; y += 1) {
      for (let x = 0; x < this.grid.width; x += 1) {
        this.grid.walkable[y][x] = true;
      }
    }
    const blockers = new Set(['bed', 'fridge', 'stove', 'shower', 'sofa', 'table', 'trash', 'grill', 'lamp', 'chair']);
    for (const object of this.state.objects) {
      if (blockers.has(object.type)) {
        const gx = Math.round(object.position.x);
        const gy = Math.round(object.position.y);
        if (this.grid.isInside(gx, gy)) {
          this.grid.walkable[gy][gx] = false;
        }
      }
    }
  }

  moveObject(id: string, position: Vec2) {
    const object = this.state.objects.find((entry) => entry.id === id);
    if (!object) {
      return;
    }
    object.position = { x: position.x, y: position.y };
    this.updateObstacles();
  }

  serialize() {
    return JSON.stringify({
      seedState: this.rng.getState(),
      time: this.state.time,
      worldState: this.worldState,
      objects: this.state.objects,
      agents: this.state.agents,
      signals: {
        noise: this.signals.noise,
        smell: this.signals.smell,
        light: this.signals.light,
      },
      gossipTokens: this.gossipTokens,
      eventLog: this.eventLog,
    });
  }

  load(payload: string) {
    const data = JSON.parse(payload);
    this.rng.setState(data.seedState ?? 1);
    this.state.time = data.time ?? 0;
    this.worldState = data.worldState ?? this.worldState;
    this.state.objects = data.objects ?? this.state.objects;
    this.state.agents = data.agents ?? this.state.agents;
    this.signals.noise = data.signals?.noise ?? this.signals.noise;
    this.signals.smell = data.signals?.smell ?? this.signals.smell;
    this.signals.light = data.signals?.light ?? this.signals.light;
    this.gossipTokens = data.gossipTokens ?? [];
    this.eventLog = data.eventLog ?? [];
    this.updateObstacles();
    this.director = new DirectorSystem(this);
  }

  getDecisionExplanation(agentId: string): DecisionExplanation | null {
    const agent = this.state.agents.find((entry) => entry.id === agentId);
    return agent?.lastDecision ?? null;
  }
}
