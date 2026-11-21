import { describe, it, expect } from 'vitest';
import type { MapTab } from '../../hooks/useMindMap';
import { FreeMindMap } from '../../types/freemind';
import {
  PendingNewNodeEdit,
  cancelPendingNewNodeOnTab,
  commitPendingNewNodeTextOnTab,
} from '../pendingNodeEdit';

function makeSampleMap(rootText = 'Root', childIds: string[] = ['c1']): FreeMindMap {
  return {
    version: '1.0.1',
    root: {
      id: 'root',
      text: rootText,
      style: 'bubble',
      icons: [],
      attributes: [],
      arrowLinks: [],
      hooks: [],
      children: childIds.map(id => ({
        id,
        text: id === 'new_1' ? '新規ノード' : `Child ${id}`,
        position: 'right',
        style: 'fork',
        icons: [],
        attributes: [],
        arrowLinks: [],
        hooks: [],
        children: [],
      })),
    },
  };
}

describe('pendingNodeEdit', () => {
  it('cancelPendingNewNodeOnTab removes the newly added node and restores clean state & selection', () => {
    const beforeMap = makeSampleMap('Project', ['c1']);
    const afterAddMap = makeSampleMap('Project', ['c1', 'new_1']);

    const tabAfterAdd: MapTab = {
      id: 'tab_1',
      title: 'Project',
      map: afterAddMap,
      past: [beforeMap],
      future: [],
      selectedNodeId: 'new_1',
      isDirty: true,
      savedPastLength: 0,
    };

    const pending: PendingNewNodeEdit = {
      tabId: 'tab_1',
      nodeId: 'new_1',
      previousSelectedNodeId: 'c1',
      previousFuture: [],
      previousSavedPastLength: 0,
    };

    const cancelled = cancelPendingNewNodeOnTab(tabAfterAdd, pending);
    expect(cancelled.map).toBe(beforeMap);
    expect(cancelled.map.root.children.map(c => c.id)).toEqual(['c1']);
    expect(cancelled.past).toEqual([]);
    expect(cancelled.future).toEqual([]);
    expect(cancelled.isDirty).toBe(false);
    expect(cancelled.savedPastLength).toBe(0);
    expect(cancelled.selectedNodeId).toBe('c1');
  });

  it('cancelPendingNewNodeOnTab preserves prior future stack and prior dirty state', () => {
    const initialMap = makeSampleMap('Project', []);
    const beforeAddMap = makeSampleMap('Project', ['c1']);
    const undoneFutureMap = makeSampleMap('Project', ['c1', 'undone']);
    const afterAddMap = makeSampleMap('Project', ['c1', 'new_1']);

    const tabAfterAdd: MapTab = {
      id: 'tab_1',
      title: 'Project',
      map: afterAddMap,
      past: [initialMap, beforeAddMap],
      future: [],
      selectedNodeId: 'new_1',
      isDirty: true,
      savedPastLength: 0,
    };

    const pending: PendingNewNodeEdit = {
      tabId: 'tab_1',
      nodeId: 'new_1',
      previousSelectedNodeId: 'root',
      previousFuture: [undoneFutureMap],
      previousSavedPastLength: 0,
    };

    const cancelled = cancelPendingNewNodeOnTab(tabAfterAdd, pending);
    expect(cancelled.map).toBe(beforeAddMap);
    expect(cancelled.past).toEqual([initialMap]);
    expect(cancelled.future).toEqual([undoneFutureMap]);
    expect(cancelled.isDirty).toBe(true);
    expect(cancelled.selectedNodeId).toBe('root');
  });

  it('commitPendingNewNodeTextOnTab updates node text without adding an extra history entry', () => {
    const beforeMap = makeSampleMap('Project', ['c1']);
    const afterAddMap = makeSampleMap('Project', ['c1', 'new_1']);

    const tabAfterAdd: MapTab = {
      id: 'tab_1',
      title: 'Project',
      map: afterAddMap,
      past: [beforeMap],
      future: [],
      selectedNodeId: 'new_1',
      isDirty: true,
      savedPastLength: 0,
    };

    const committed = commitPendingNewNodeTextOnTab(tabAfterAdd, 'new_1', 'API設計');
    expect(committed.past).toHaveLength(1);
    expect(committed.map.root.children[1].text).toBe('API設計');
    expect(committed.isDirty).toBe(true);
  });
});

