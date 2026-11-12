import { FreeMindNode } from './freemind';

export type PresentationOrderMode = 'topic' | 'breadth' | 'chronological';

export interface PresentationStep {
  index: number;
  nodeId: string;
  node: FreeMindNode;
  depth: number;
  parentText?: string;
  createdAt?: number;
}

export interface PresentationState {
  isActive: boolean;
  isPlaying: boolean;
  currentStepIndex: number;
  steps: PresentationStep[];
  mode: PresentationOrderMode;
  speed: number; // Interval in seconds (e.g. 1.5, 2.5, 4.0)
  autoCenter: boolean;
}

