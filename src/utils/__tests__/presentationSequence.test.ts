import { describe, it, expect } from 'vitest';
import { FreeMindNode } from '../../types/freemind';
import {
  buildPresentationSequence,
  getVisibleNodeIdsAtStep,
} from '../presentationSequence';

describe('presentationSequence', () => {
  const sampleTree: FreeMindNode = {
    id: 'root',
    text: 'Root Idea',
    created: 1000,
    icons: [],
    attributes: [],
    arrowLinks: [],
    hooks: [],
    children: [
      {
        id: 'node-a',
        text: 'Topic A',
        position: 'right',
        created: 3000,
        icons: [],
        attributes: [],
        arrowLinks: [],
        hooks: [],
        children: [
          {
            id: 'node-a-1',
            text: 'Subtopic A1',
            created: 4000,
            icons: [],
            attributes: [],
            arrowLinks: [],
            hooks: [],
            children: [],
          },
        ],
      },
      {
        id: 'node-b',
        text: 'Topic B',
        position: 'left',
        created: 2000, // Created before Topic A!
        icons: [],
        attributes: [],
        arrowLinks: [],
        hooks: [],
        children: [
          {
            id: 'node-b-1',
            text: 'Subtopic B1',
            created: 2500,
            icons: [],
            attributes: [],
            arrowLinks: [],
            hooks: [],
            children: [],
          },
        ],
      },
    ],
  };

  it('builds topic (depth-first) sequence correctly', () => {
    const steps = buildPresentationSequence(sampleTree, 'topic');
    const ids = steps.map(s => s.nodeId);
    // Root -> Topic A (right) -> Subtopic A1 -> Topic B (left) -> Subtopic B1
    expect(ids).toEqual(['root', 'node-a', 'node-a-1', 'node-b', 'node-b-1']);
  });

  it('builds breadth-first sequence correctly', () => {
    const steps = buildPresentationSequence(sampleTree, 'breadth');
    const ids = steps.map(s => s.nodeId);
    // Root -> [Topic A, Topic B] -> [Subtopic A1, Subtopic B1]
    expect(ids).toEqual(['root', 'node-a', 'node-b', 'node-a-1', 'node-b-1']);
  });

  it('builds chronological sequence sorted by created timestamp with parent topological order', () => {
    const steps = buildPresentationSequence(sampleTree, 'chronological');
    const ids = steps.map(s => s.nodeId);
    // Root (1000) -> Topic B (2000) -> Subtopic B1 (2500) -> Topic A (3000) -> Subtopic A1 (4000)
    expect(ids).toEqual(['root', 'node-b', 'node-b-1', 'node-a', 'node-a-1']);
  });

  it('calculates visible node IDs correctly at step', () => {
    const steps = buildPresentationSequence(sampleTree, 'topic');
    // At step 0: only root
    const visible0 = getVisibleNodeIdsAtStep(sampleTree, steps, 0);
    expect(Array.from(visible0)).toEqual(['root']);

    // At step 1: root and node-a
    const visible1 = getVisibleNodeIdsAtStep(sampleTree, steps, 1);
    expect(Array.from(visible1).sort()).toEqual(['node-a', 'root'].sort());

    // At step 2: root, node-a, node-a-1
    const visible2 = getVisibleNodeIdsAtStep(sampleTree, steps, 2);
    expect(Array.from(visible2).sort()).toEqual(['node-a', 'node-a-1', 'root'].sort());
  });
});
