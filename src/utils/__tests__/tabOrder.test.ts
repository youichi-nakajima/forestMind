import { describe, it, expect } from 'vitest';
import {
  normalizeTabOrder,
  reorderTabsInList,
  toggleTabPinnedInList,
} from '../tabOrder';

interface MockTab {
  id: string;
  isPinned?: boolean;
}

describe('tabOrder', () => {
  it('normalizeTabOrder keeps pinned tabs on the left while preserving relative order', () => {
    const input: MockTab[] = [
      { id: 'u1', isPinned: false },
      { id: 'p1', isPinned: true },
      { id: 'u2' },
      { id: 'p2', isPinned: true },
    ];

    expect(normalizeTabOrder(input).map(t => t.id)).toEqual(['p1', 'p2', 'u1', 'u2']);
  });

  it('toggleTabPinnedInList pins an unpinned tab to the end of pinned group and unpins to start of unpinned group', () => {
    const initial: MockTab[] = [
      { id: 'p1', isPinned: true },
      { id: 'u1', isPinned: false },
      { id: 'u2', isPinned: false },
    ];

    const afterPin = toggleTabPinnedInList(initial, 'u2');
    expect(afterPin).toEqual([
      { id: 'p1', isPinned: true },
      { id: 'u2', isPinned: true },
      { id: 'u1', isPinned: false },
    ]);

    const afterUnpin = toggleTabPinnedInList(afterPin, 'p1');
    expect(afterUnpin).toEqual([
      { id: 'u2', isPinned: true },
      { id: 'p1', isPinned: false },
      { id: 'u1', isPinned: false },
    ]);

    // Unknown id returns original reference
    expect(toggleTabPinnedInList(afterUnpin, 'missing')).toBe(afterUnpin);
  });

  it('reorderTabsInList reorders tabs within the unpinned group (before & after)', () => {
    const initial: MockTab[] = [
      { id: 'p1', isPinned: true },
      { id: 'u1' },
      { id: 'u2' },
      { id: 'u3' },
    ];

    const movedRight = reorderTabsInList(initial, 'u1', 'u3', 'after');
    expect(movedRight.map(t => t.id)).toEqual(['p1', 'u2', 'u3', 'u1']);

    const movedLeft = reorderTabsInList(movedRight, 'u1', 'u2', 'before');
    expect(movedLeft.map(t => t.id)).toEqual(['p1', 'u1', 'u2', 'u3']);

    // Dropping right next to current position results in a no-op returning original reference
    expect(reorderTabsInList(initial, 'u1', 'u2', 'before')).toBe(initial);
    expect(reorderTabsInList(initial, 'u2', 'u1', 'after')).toBe(initial);
  });

  it('reorderTabsInList reorders tabs within the pinned group', () => {
    const initial: MockTab[] = [
      { id: 'p1', isPinned: true },
      { id: 'p2', isPinned: true },
      { id: 'p3', isPinned: true },
      { id: 'u1' },
    ];

    const reordered = reorderTabsInList(initial, 'p3', 'p1', 'before');
    expect(reordered.map(t => t.id)).toEqual(['p3', 'p1', 'p2', 'u1']);
  });

  it('reorderTabsInList refuses cross-group moves between pinned and unpinned tabs', () => {
    const initial: MockTab[] = [
      { id: 'p1', isPinned: true },
      { id: 'u1', isPinned: false },
      { id: 'u2', isPinned: false },
    ];

    expect(reorderTabsInList(initial, 'u1', 'p1', 'before')).toBe(initial);
    expect(reorderTabsInList(initial, 'p1', 'u2', 'after')).toBe(initial);
    expect(reorderTabsInList(initial, 'u1', 'u1', 'before')).toBe(initial);
    expect(reorderTabsInList(initial, 'missing', 'u2', 'before')).toBe(initial);
  });
});
