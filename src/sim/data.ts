import { ActionDefinition, AgentNeed, SimObject } from './types';
import { vec2 } from './math';

export const createDefaultNeeds = (): AgentNeed[] => [
  { id: 'hunger', value: 70, decayPerMinute: 2.5 },
  { id: 'energy', value: 80, decayPerMinute: 2.2 },
  { id: 'hygiene', value: 75, decayPerMinute: 2.0 },
  { id: 'fun', value: 65, decayPerMinute: 1.6 },
  { id: 'social', value: 60, decayPerMinute: 1.4 },
];

export const actions: ActionDefinition[] = [
  {
    id: 'sleep',
    label: 'Sleeping',
    duration: 30,
    effects: { energy: 35, hygiene: -4 },
    targetObjectTypes: ['bed'],
  },
  {
    id: 'eat',
    label: 'Eating',
    duration: 20,
    effects: { hunger: 30, fun: 5 },
    targetObjectTypes: ['fridge'],
  },
  {
    id: 'cook',
    label: 'Cooking',
    duration: 26,
    effects: { hunger: 18, fun: 6 },
    targetObjectTypes: ['stove'],
  },
  {
    id: 'shower',
    label: 'Showering',
    duration: 18,
    effects: { hygiene: 30, fun: 4 },
    targetObjectTypes: ['shower'],
  },
  {
    id: 'watch_tv',
    label: 'Watching TV',
    duration: 22,
    effects: { fun: 28 },
    targetObjectTypes: ['sofa'],
  },
  {
    id: 'text',
    label: 'Texting',
    duration: 12,
    effects: { social: 16, fun: 4 },
    targetObjectTypes: ['phone'],
  },
  {
    id: 'chat',
    label: 'Chatting',
    duration: 16,
    effects: { social: 26, fun: 6 },
    targetObjectTypes: ['table'],
  },
  {
    id: 'go_park',
    label: 'Park Walk',
    duration: 24,
    effects: { fun: 18, social: 8 },
    targetObjectTypes: ['park'],
  },
  {
    id: 'grill',
    label: 'Grilling',
    duration: 22,
    effects: { hunger: 20, fun: 6 },
    targetObjectTypes: ['grill'],
  },
  {
    id: 'clean_trash',
    label: 'Cleaning Trash',
    duration: 14,
    effects: { hygiene: 10, fun: -2 },
    targetObjectTypes: ['trash'],
  },
  {
    id: 'shop',
    label: 'Shopping',
    duration: 14,
    effects: { fun: 4 },
    targetObjectTypes: [],
  },
  {
    id: 'idle',
    label: 'Idling',
    duration: 10,
    effects: { fun: 2 },
    targetObjectTypes: [],
  },
];

export const createDefaultObjects = (): SimObject[] => [
  { id: 'bed-1', type: 'bed', label: 'Bed', position: vec2(6, 5) },
  { id: 'fridge-1', type: 'fridge', label: 'Fridge', position: vec2(10, 6) },
  { id: 'stove-1', type: 'stove', label: 'Stove', position: vec2(11, 6) },
  { id: 'shower-1', type: 'shower', label: 'Shower', position: vec2(8, 8) },
  { id: 'sofa-1', type: 'sofa', label: 'Sofa', position: vec2(12, 9) },
  { id: 'tv-1', type: 'tv', label: 'TV', position: vec2(13, 9) },
  { id: 'table-1', type: 'table', label: 'Table', position: vec2(7, 10) },
  { id: 'chair-1', type: 'chair', label: 'Chair', position: vec2(7, 11) },
  { id: 'phone-1', type: 'phone', label: 'Phone', position: vec2(9, 10) },
  { id: 'trash-1', type: 'trash', label: 'Trash', position: vec2(5, 9) },
  { id: 'lamp-1', type: 'lamp', label: 'Lamp', position: vec2(9, 7) },
  { id: 'park-1', type: 'park', label: 'Park', position: vec2(20, 10) },
  { id: 'bench-1', type: 'bench', label: 'Park Bench', position: vec2(21, 11) },
  { id: 'grill-1', type: 'grill', label: 'Grill', position: vec2(19, 9) },
];
