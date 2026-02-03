import { Vec2 } from './math';

export type NeedId = 'hunger' | 'energy' | 'hygiene' | 'fun' | 'social';

export type AgentNeed = {
  id: NeedId;
  value: number;
  decayPerMinute: number;
};

export type ActionEffect = Partial<Record<NeedId, number>>;

export type ActionId =
  | 'sleep'
  | 'eat'
  | 'shower'
  | 'watch_tv'
  | 'chat'
  | 'shop'
  | 'cook'
  | 'clean_trash'
  | 'text'
  | 'go_park'
  | 'grill'
  | 'idle';

export type ActionDefinition = {
  id: ActionId;
  label: string;
  duration: number;
  effects: ActionEffect;
  targetObjectTypes: string[];
};

export type SimObject = {
  id: string;
  type: string;
  label: string;
  position: Vec2;
};

export type AgentState = {
  id: string;
  name: string;
  position: Vec2;
  speed: number;
  needs: AgentNeed[];
  currentAction: ActionId | null;
  actionTimer: number;
  actionTarget: Vec2 | null;
  actionLabel: string;
  path: Vec2[];
  signals: {
    noise: number;
    smell: number;
    light: number;
  };
  mood: {
    valence: number;
    arousal: number;
  };
  beliefs: Record<string, BeliefEntry>;
  relationships: Record<
    string,
    {
      trust: number;
      annoyance: number;
      admiration: number;
    }
  >;
  lastDecision?: DecisionExplanation;
  memories: Memory[];
};

export type BeliefEntry = {
  key: string;
  value: boolean | number | string;
  confidence: number;
  lastUpdated: number;
};

export type DecisionExplanation = {
  topActions: {
    id: ActionId;
    label: string;
    total: number;
    needScores: Partial<Record<NeedId, number>>;
    beliefNotes: string[];
    randomness: number;
  }[];
};

export type Memory = {
  id: string;
  tags: string[];
  valence: number;
  arousal: number;
  strength: number;
  createdAt: number;
};

export type GossipToken = {
  id: string;
  topic: string;
  value: boolean | number | string;
  uncertainty: number;
  sourceId: string;
  createdAt: number;
};

export type SimState = {
  time: number;
  agents: AgentState[];
  objects: SimObject[];
};
