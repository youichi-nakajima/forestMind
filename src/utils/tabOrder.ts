export function normalizeTabOrder<T extends { isPinned?: boolean }>(tabs: T[]): T[] {
  const pinned = tabs.filter(t => Boolean(t.isPinned));
  const unpinned = tabs.filter(t => !t.isPinned);
  return [...pinned, ...unpinned];
}

export function toggleTabPinnedInList<T extends { id: string; isPinned?: boolean }>(
  tabs: T[],
  tabId: string
): T[] {
  const targetIndex = tabs.findIndex(t => t.id === tabId);
  if (targetIndex === -1) return tabs;

  const target = tabs[targetIndex];
  const updatedTarget: T = { ...target, isPinned: !target.isPinned };
  const others = tabs.filter(t => t.id !== tabId);
  const pinnedOthers = others.filter(t => Boolean(t.isPinned));
  const unpinnedOthers = others.filter(t => !t.isPinned);

  return [...pinnedOthers, updatedTarget, ...unpinnedOthers];
}

export function reorderTabsInList<T extends { id: string; isPinned?: boolean }>(
  tabs: T[],
  draggedTabId: string,
  targetTabId: string,
  position: 'before' | 'after'
): T[] {
  if (draggedTabId === targetTabId) return tabs;

  const draggedIndex = tabs.findIndex(t => t.id === draggedTabId);
  const targetIndex = tabs.findIndex(t => t.id === targetTabId);
  if (draggedIndex === -1 || targetIndex === -1) return tabs;

  const dragged = tabs[draggedIndex];
  const target = tabs[targetIndex];
  if (Boolean(dragged.isPinned) !== Boolean(target.isPinned)) {
    return tabs;
  }

  const remaining = tabs.filter(t => t.id !== draggedTabId);
  const targetIdxInRemaining = remaining.findIndex(t => t.id === targetTabId);
  if (targetIdxInRemaining === -1) return tabs;

  const insertIdx = position === 'before' ? targetIdxInRemaining : targetIdxInRemaining + 1;
  const nextTabs = [
    ...remaining.slice(0, insertIdx),
    dragged,
    ...remaining.slice(insertIdx),
  ];

  const unchanged = nextTabs.every((t, idx) => t.id === tabs[idx]?.id);
  return unchanged ? tabs : nextTabs;
}
