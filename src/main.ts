import './style.css';
import Phaser from 'phaser';
import { IsoGrid } from './sim/grid';
import { vec2 } from './sim/math';
import { Simulation } from './sim/sim';

type RenderAgent = {
  id: string;
  sprite: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  reaction: Phaser.GameObjects.Text;
};

type HudRefs = {
  container: HTMLDivElement;
  agentName: HTMLDivElement;
  mode: HTMLDivElement;
  needs: HTMLDivElement;
  mood: HTMLDivElement;
  goal: HTMLDivElement;
  beliefs: HTMLDivElement;
  relationships: HTMLDivElement;
  memories: HTMLDivElement;
  whyButton: HTMLButtonElement;
  whyOutput: HTMLDivElement;
};

class MainScene extends Phaser.Scene {
  sim!: Simulation;
  grid!: IsoGrid;
  graphics!: Phaser.GameObjects.Graphics;
  agents: RenderAgent[] = [];
  objectSprites: Record<string, Phaser.GameObjects.Rectangle> = {};
  overlay?: Phaser.GameObjects.Graphics;
  overlayMode: 'none' | 'noise' | 'smell' | 'light' = 'none';
  selectedAgentId?: string;
  hud?: HudRefs;
  eventLog?: HTMLDivElement;
  buildMode = false;
  nightOverlay?: Phaser.GameObjects.Rectangle;
  speechBubbles: { agentId: string; text: Phaser.GameObjects.Text; remaining: number }[] = [];
  dragStart?: Phaser.Math.Vector2;
  cameraStart?: Phaser.Math.Vector2;
  simSpeed = 1;

  constructor() {
    super('main');
  }

  create() {
    this.sim = new Simulation(42);
    this.grid = this.sim.grid;
    this.graphics = this.add.graphics();

    this.drawGrid();
    this.drawObjects();
    this.createAgents();
    this.overlay = this.add.graphics();
    this.hud = this.createHud();
    this.eventLog = this.createEventLog();
    this.nightOverlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x0f172a, 0.3)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(900);
    this.selectedAgentId = this.sim.state.agents[0]?.id;
    this.updateInspector();

    const camera = this.cameras.main;
    camera.setZoom(1);
    const mid = this.grid.toWorld(this.grid.width / 2, this.grid.height / 2);
    camera.centerOn(mid.x, mid.y);
    this.add
      .text(
        16,
        16,
        'Left click: move Riley | Right drag: pan | Scroll: zoom | 1/2/3: signal overlays | B: build mode | S/L: save/load',
        {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        color: '#e2e8f0',
      },
      )
      .setScrollFactor(0)
      .setDepth(1000);

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, _dx: number, dy: number) => {
      const zoom = Phaser.Math.Clamp(camera.zoom - dy * 0.001, 0.5, 2.5);
      camera.setZoom(zoom);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
        this.dragStart = new Phaser.Math.Vector2(pointer.x, pointer.y);
        this.cameraStart = new Phaser.Math.Vector2(camera.scrollX, camera.scrollY);
        return;
      }

      const worldPoint = pointer.positionToCamera(camera) as Phaser.Math.Vector2;
      const gridPos = this.grid.toGrid(worldPoint.x, worldPoint.y);
      if (!this.grid.isInside(gridPos.x, gridPos.y)) {
        return;
      }
      if (this.buildMode) {
        this.sim.moveObject('chair-1', vec2(gridPos.x, gridPos.y));
        this.refreshObjects();
        return;
      }
      const agent = this.sim.state.agents[0];
      agent.currentAction = 'idle';
      agent.actionLabel = 'Walking';
      agent.actionTarget = vec2(gridPos.x, gridPos.y);
      agent.actionTimer = 6;
      agent.path = [];
    });

    this.input.on('pointerup', () => {
      this.dragStart = undefined;
      this.cameraStart = undefined;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragStart || !this.cameraStart) {
        return;
      }
      const dx = this.dragStart.x - pointer.x;
      const dy = this.dragStart.y - pointer.y;
      camera.scrollX = this.cameraStart.x + dx / camera.zoom;
      camera.scrollY = this.cameraStart.y + dy / camera.zoom;
    });

    this.input.keyboard?.on('keydown-ONE', () => {
      this.overlayMode = this.overlayMode === 'noise' ? 'none' : 'noise';
      this.drawOverlay();
    });
    this.input.keyboard?.on('keydown-TWO', () => {
      this.overlayMode = this.overlayMode === 'smell' ? 'none' : 'smell';
      this.drawOverlay();
    });
    this.input.keyboard?.on('keydown-THREE', () => {
      this.overlayMode = this.overlayMode === 'light' ? 'none' : 'light';
      this.drawOverlay();
    });
    this.input.keyboard?.on('keydown-B', () => {
      this.buildMode = !this.buildMode;
    });
    this.input.keyboard?.on('keydown-S', () => {
      localStorage.setItem('soapbox-city-save', this.sim.serialize());
      this.sim.addEventLog('Saved simulation snapshot.');
    });
    this.input.keyboard?.on('keydown-L', () => {
      const data = localStorage.getItem('soapbox-city-save');
      if (data) {
        this.sim.load(data);
        this.refreshObjects();
        this.sim.addEventLog('Loaded simulation snapshot.');
      }
    });
  }

  update(_time: number, delta: number) {
    const dt = (delta / 1000) * this.simSpeed;
    this.sim.step(dt);
    this.updateAgents();
    this.updateSpeechBubbles(delta / 1000);
    this.updateEventLog();
    this.updateNightOverlay();
    if (this.overlayMode !== 'none') {
      this.drawOverlay();
    }
    this.updateInspector();
  }

  private updateAgents() {
    const speechEvents = this.sim.drainSpeechEvents();
    for (const event of speechEvents) {
      const bubble = this.add.text(0, 0, event.text, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '12px',
        color: '#0f172a',
        backgroundColor: 'rgba(248, 250, 252, 0.9)',
        padding: { x: 6, y: 4 },
      });
      bubble.setDepth(800);
      this.speechBubbles.push({ agentId: event.agentId, text: bubble, remaining: 4 });
    }
    for (const renderAgent of this.agents) {
      const simAgent = this.sim.state.agents.find((agent) => agent.id === renderAgent.id);
      if (!simAgent) {
        continue;
      }
      const world = this.grid.toWorld(simAgent.position.x, simAgent.position.y);
      renderAgent.sprite.setPosition(world.x, world.y);
      renderAgent.sprite.setDepth(world.y + 10);
      renderAgent.label.setPosition(world.x, world.y - 26);
      renderAgent.label.setDepth(world.y + 20);
      renderAgent.label.setText(`${simAgent.name}\n${simAgent.actionLabel}`);

      const reaction = this.getReactionIcon(simAgent.signals);
      renderAgent.reaction.setText(reaction);
      renderAgent.reaction.setPosition(world.x + 16, world.y - 36);
      renderAgent.reaction.setDepth(world.y + 25);
    }
  }

  private updateSpeechBubbles(dt: number) {
    this.speechBubbles = this.speechBubbles.filter((bubble) => {
      bubble.remaining -= dt;
      if (bubble.remaining <= 0) {
        bubble.text.destroy();
        return false;
      }
      const simAgent = this.sim.state.agents.find((agent) => agent.id === bubble.agentId);
      if (!simAgent) {
        return false;
      }
      const world = this.grid.toWorld(simAgent.position.x, simAgent.position.y);
      bubble.text.setPosition(world.x + 12, world.y - 48);
      return true;
    });
  }

  private getReactionIcon(signals: { noise: number; smell: number; light: number }) {
    if (signals.noise > 0.65) {
      return '😣';
    }
    if (signals.smell > 0.65) {
      return '🤢';
    }
    if (signals.light < 0.35) {
      return '😴';
    }
    return '';
  }

  private drawGrid() {
    this.graphics.clear();
    this.graphics.lineStyle(1, 0x2f3b5f, 0.7);
    for (let y = 0; y < this.grid.height; y += 1) {
      for (let x = 0; x < this.grid.width; x += 1) {
        const world = this.grid.toWorld(x, y);
        const halfW = this.grid.tileWidth / 2;
        const halfH = this.grid.tileHeight / 2;
        this.graphics.strokePoints(
          [
            new Phaser.Math.Vector2(world.x, world.y - halfH),
            new Phaser.Math.Vector2(world.x + halfW, world.y),
            new Phaser.Math.Vector2(world.x, world.y + halfH),
            new Phaser.Math.Vector2(world.x - halfW, world.y),
          ],
          true,
        );
      }
    }
  }

  private drawObjects() {
    const colors: Record<string, number> = {
      bed: 0xf472b6,
      fridge: 0x93c5fd,
      stove: 0xf97316,
      shower: 0x38bdf8,
      sofa: 0xf59e0b,
      tv: 0x1e293b,
      table: 0xa78bfa,
      chair: 0xc4b5fd,
      phone: 0x22d3ee,
      trash: 0x64748b,
      lamp: 0xfacc15,
      park: 0x22c55e,
      bench: 0x84cc16,
      grill: 0xfb7185,
    };
    for (const object of this.sim.state.objects) {
      const world = this.grid.toWorld(object.position.x, object.position.y);
      const sprite = this.add.rectangle(world.x, world.y - 12, 24, 16, colors[object.type] ?? 0x6b7280);
      sprite.setDepth(world.y + 5);
      sprite.setStrokeStyle(1, 0x0f172a, 0.8);
      this.objectSprites[object.id] = sprite;
    }
  }

  private refreshObjects() {
    for (const sprite of Object.values(this.objectSprites)) {
      sprite.destroy();
    }
    this.objectSprites = {};
    this.drawObjects();
  }

  private createAgents() {
    for (const agent of this.sim.state.agents) {
      const world = this.grid.toWorld(agent.position.x, agent.position.y);
      const sprite = this.add.circle(world.x, world.y, 10, 0x4ade80);
      sprite.setDepth(world.y + 10);
      sprite.setInteractive({ useHandCursor: true });
      sprite.on('pointerdown', () => {
        this.selectedAgentId = agent.id;
        this.updateInspector();
      });
      const label = this.add
        .text(world.x, world.y - 26, `${agent.name}\nIdle`, {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '12px',
          color: '#e2e8f0',
          align: 'center',
        })
        .setOrigin(0.5, 1);
      label.setDepth(world.y + 20);
      const reaction = this.add.text(world.x + 16, world.y - 36, '', {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
      });
      this.agents.push({ id: agent.id, sprite, label, reaction });
    }
  }

  private createHud(): HudRefs {
    let container = document.getElementById('hud') as HTMLDivElement | null;
    if (!container) {
      container = document.createElement('div');
      container.id = 'hud';
      document.body.appendChild(container);
    }
    container.innerHTML = `
      <h2>Mind Inspector</h2>
      <div class="hud-section" id="hud-agent"></div>
      <div class="hud-section" id="hud-mode"></div>
      <div class="hud-section">
        <strong>Speed</strong>
        <div class="hud-row">
          <button class="hud-button" id="hud-speed-1">1x</button>
          <button class="hud-button" id="hud-speed-2">2x</button>
          <button class="hud-button" id="hud-speed-4">4x</button>
        </div>
      </div>
      <div class="hud-section">
        <strong>Needs</strong>
        <div id="hud-needs"></div>
      </div>
      <div class="hud-section">
        <strong>Mood</strong>
        <div id="hud-mood"></div>
      </div>
      <div class="hud-section">
        <strong>Current Goal</strong>
        <div id="hud-goal"></div>
      </div>
      <div class="hud-section">
        <strong>Top Beliefs</strong>
        <div id="hud-beliefs"></div>
      </div>
      <div class="hud-section">
        <strong>Relationships</strong>
        <div id="hud-relationships"></div>
      </div>
      <div class="hud-section">
        <strong>Memories</strong>
        <div id="hud-memories"></div>
      </div>
      <div class="hud-section">
        <button class="hud-button" id="hud-why">Why?</button>
        <div id="hud-why-output"></div>
      </div>
    `;
    const refs: HudRefs = {
      container,
      agentName: container.querySelector('#hud-agent') as HTMLDivElement,
      mode: container.querySelector('#hud-mode') as HTMLDivElement,
      needs: container.querySelector('#hud-needs') as HTMLDivElement,
      mood: container.querySelector('#hud-mood') as HTMLDivElement,
      goal: container.querySelector('#hud-goal') as HTMLDivElement,
      beliefs: container.querySelector('#hud-beliefs') as HTMLDivElement,
      relationships: container.querySelector('#hud-relationships') as HTMLDivElement,
      memories: container.querySelector('#hud-memories') as HTMLDivElement,
      whyButton: container.querySelector('#hud-why') as HTMLButtonElement,
      whyOutput: container.querySelector('#hud-why-output') as HTMLDivElement,
    };
    refs.whyButton.onclick = () => {
      if (!this.selectedAgentId) {
        return;
      }
      const explanation = this.sim.getDecisionExplanation(this.selectedAgentId);
      if (!explanation) {
        refs.whyOutput.innerHTML = '<em>No decision yet.</em>';
        return;
      }
      refs.whyOutput.innerHTML = explanation.topActions
        .map((action) => {
          const needs = Object.entries(action.needScores)
            .map(([key, value]) => `${key}: ${value.toFixed(1)}`)
            .join(', ');
          const beliefNotes = action.beliefNotes.length > 0 ? ` | ${action.beliefNotes.join(' ')}` : '';
          return `<div><strong>${action.label}</strong> (${action.total.toFixed(1)})<br/><small>${needs} | RNG ${action.randomness.toFixed(2)}${beliefNotes}</small></div>`;
        })
        .join('');
    };
    const speed1 = container.querySelector('#hud-speed-1') as HTMLButtonElement;
    const speed2 = container.querySelector('#hud-speed-2') as HTMLButtonElement;
    const speed4 = container.querySelector('#hud-speed-4') as HTMLButtonElement;
    speed1.onclick = () => {
      this.simSpeed = 1;
    };
    speed2.onclick = () => {
      this.simSpeed = 2;
    };
    speed4.onclick = () => {
      this.simSpeed = 4;
    };
    return refs;
  }

  private createEventLog() {
    let container = document.getElementById('event-log') as HTMLDivElement | null;
    if (!container) {
      container = document.createElement('div');
      container.id = 'event-log';
      document.body.appendChild(container);
    }
    return container;
  }

  private updateEventLog() {
    if (!this.eventLog) {
      return;
    }
    const entries = this.sim.getEventLog();
    this.eventLog.innerHTML = `
      <strong>Event Log</strong>
      ${entries
        .map((entry) => `<div><small>${entry.message}</small></div>`)
        .join('')}
    `;
  }

  private updateNightOverlay() {
    if (!this.nightOverlay) {
      return;
    }
    const darkness = Phaser.Math.Clamp(1 - this.sim.ambientLight, 0, 0.8);
    this.nightOverlay.setFillStyle(0x0f172a, darkness * 0.7);
  }

  private updateInspector() {
    if (!this.hud || !this.selectedAgentId) {
      return;
    }
    const agent = this.sim.state.agents.find((entry) => entry.id === this.selectedAgentId);
    if (!agent) {
      return;
    }
    this.hud.agentName.innerHTML = `<strong>${agent.name}</strong> <small>(ID ${agent.id})</small>`;
    this.hud.mode.innerHTML = `<small>Build mode: ${this.buildMode ? 'ON (move chair)' : 'OFF'}</small>`;
    this.hud.needs.innerHTML = agent.needs
      .map((need) => {
        const width = Math.round(need.value);
        return `
          <div class="hud-row">
            <span>${need.id}</span>
            <div class="bar"><div class="bar-fill" style="width:${width}%"></div></div>
            <span>${width}</span>
          </div>
        `;
      })
      .join('');
    this.hud.mood.innerHTML = `<div class="hud-row"><span>Valence</span><span>${agent.mood.valence.toFixed(
      2,
    )}</span></div><div class="hud-row"><span>Arousal</span><span>${agent.mood.arousal.toFixed(2)}</span></div>`;
    const explanation = this.sim.getDecisionExplanation(agent.id);
    const topAction = explanation?.topActions[0];
    this.hud.goal.innerHTML = `<div>${agent.actionLabel}</div><small>Utility ${topAction?.total.toFixed(1) ?? '—'}</small>`;
    const beliefs = Object.values(agent.beliefs)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
    this.hud.beliefs.innerHTML = beliefs
      .map((belief) => {
        const width = Math.round(belief.confidence * 100);
        return `
        <div class="belief">
          <span>${belief.key.replace(':', ' ')}</span>
          <span>${String(belief.value)}</span>
        </div>
        <div class="bar"><div class="bar-fill" style="width:${width}%"></div></div>
        <small>confidence ${width}%</small>
      `;
      })
      .join('');
    this.hud.relationships.innerHTML = Object.entries(agent.relationships)
      .map(([id, rel]) => {
        return `<div class="hud-row"><span>${id}</span><span>Trust ${rel.trust.toFixed(
          2,
        )} · Annoy ${rel.annoyance.toFixed(2)} · Adm ${rel.admiration.toFixed(2)}</span></div>`;
      })
      .join('');
    this.hud.memories.innerHTML = agent.memories
      .slice(0, 3)
      .map((memory) => {
        return `<div class="hud-row"><span>${memory.tags.join(', ')}</span><span>${memory.strength.toFixed(
          2,
        )}</span></div>`;
      })
      .join('');
  }

  private drawOverlay() {
    if (!this.overlay) {
      return;
    }
    this.overlay.clear();
    if (this.overlayMode === 'none') {
      return;
    }
    const field = this.sim.signals[this.overlayMode];
    for (let y = 0; y < this.grid.height; y += 1) {
      for (let x = 0; x < this.grid.width; x += 1) {
        const value = field[y][x];
        if (value <= 0.02) {
          continue;
        }
        const world = this.grid.toWorld(x, y);
        const color =
          this.overlayMode === 'noise'
            ? 0xef4444
            : this.overlayMode === 'smell'
              ? 0x84cc16
              : 0x60a5fa;
        const alpha = Phaser.Math.Clamp(value, 0, 0.8);
        this.overlay.fillStyle(color, alpha);
        this.overlay.fillPoints(
          [
            new Phaser.Math.Vector2(world.x, world.y - this.grid.tileHeight / 2),
            new Phaser.Math.Vector2(world.x + this.grid.tileWidth / 2, world.y),
            new Phaser.Math.Vector2(world.x, world.y + this.grid.tileHeight / 2),
            new Phaser.Math.Vector2(world.x - this.grid.tileWidth / 2, world.y),
          ],
          true,
        );
      }
    }
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280,
  height: 720,
  backgroundColor: '#0b1020',
  scene: MainScene,
};

new Phaser.Game(config);
