import { FreeMindNode } from '../types/freemind';
import { PresentationOrderMode, PresentationStep } from '../types/presentation';

interface NodeWithContext {
  node: FreeMindNode;
  depth: number;
  parentText?: string;
  orderIndex: number;
}

/**
 * Collect all nodes recursively
 */
function collectAllNodes(
  node: FreeMindNode,
  depth = 0,
  parentText?: string,
  counter = { val: 0 }
): NodeWithContext[] {
  const current: NodeWithContext = {
    node,
    depth,
    parentText,
    orderIndex: counter.val++,
  };

  const list: NodeWithContext[] = [current];

  // Right nodes first, then Left nodes (or document order)
  const sortedChildren = [...node.children].sort((a, b) => {
    if (a.position === 'right' && b.position === 'left') return -1;
    if (a.position === 'left' && b.position === 'right') return 1;
    return 0;
  });

  for (const child of sortedChildren) {
    list.push(...collectAllNodes(child, depth + 1, node.text, counter));
  }

  return list;
}

/**
 * Breadth-First traversal
 */
function collectBreadthFirst(root: FreeMindNode): NodeWithContext[] {
  const result: NodeWithContext[] = [];
  const queue: Array<{ node: FreeMindNode; depth: number; parentText?: string }> = [
    { node: root, depth: 0 },
  ];
  let counter = 0;

  while (queue.length > 0) {
    const item = queue.shift()!;
    result.push({
      node: item.node,
      depth: item.depth,
      parentText: item.parentText,
      orderIndex: counter++,
    });

    const sortedChildren = [...item.node.children].sort((a, b) => {
      if (a.position === 'right' && b.position === 'left') return -1;
      if (a.position === 'left' && b.position === 'right') return 1;
      return 0;
    });

    for (const child of sortedChildren) {
      queue.push({
        node: child,
        depth: item.depth + 1,
        parentText: item.node.text,
      });
    }
  }

  return result;
}

/**
 * Chronological ordering respecting parent-before-child tree invariant
 */
function collectChronological(root: FreeMindNode): NodeWithContext[] {
  const all = collectAllNodes(root);
  const nodeMap = new Map<string, NodeWithContext>();
  all.forEach(item => nodeMap.set(item.node.id, item));

  // Build parent map
  const parentMap = new Map<string, string>();
  function mapParents(node: FreeMindNode) {
    for (const child of node.children) {
      parentMap.set(child.id, node.id);
      mapParents(child);
    }
  }
  mapParents(root);

  // Fallback timestamp for nodes without CREATED attribute:
  // use modified or default sequential timestamp
  const defaultBaseTime = 1600000000000;
  function getNodeTime(item: NodeWithContext): number {
    return item.node.created ?? item.node.modified ?? (defaultBaseTime + item.orderIndex * 10000);
  }

  // Sort candidates by creation time
  const sorted = [...all].sort((a, b) => {
    // Root always comes first
    if (a.node.id === root.id) return -1;
    if (b.node.id === root.id) return 1;

    const timeA = getNodeTime(a);
    const timeB = getNodeTime(b);
    if (timeA !== timeB) return timeA - timeB;
    return a.orderIndex - b.orderIndex;
  });

  // Ensure topological order: a parent must appear before its children
  const result: NodeWithContext[] = [];
  const addedIds = new Set<string>();

  function addWithAncestors(nodeId: string) {
    if (addedIds.has(nodeId)) return;
    const parentId = parentMap.get(nodeId);
    if (parentId && !addedIds.has(parentId)) {
      addWithAncestors(parentId);
    }
    const item = nodeMap.get(nodeId);
    if (item && !addedIds.has(nodeId)) {
      addedIds.add(nodeId);
      result.push(item);
    }
  }

  for (const item of sorted) {
    addWithAncestors(item.node.id);
  }

  return result;
}

/**
 * Generate presentation steps from a FreeMind root node
 */
export function buildPresentationSequence(
  root: FreeMindNode,
  mode: PresentationOrderMode
): PresentationStep[] {
  let list: NodeWithContext[];

  switch (mode) {
    case 'topic':
      list = collectAllNodes(root);
      break;
    case 'breadth':
      list = collectBreadthFirst(root);
      break;
    case 'chronological':
      list = collectChronological(root);
      break;
    default:
      list = collectAllNodes(root);
  }

  return list.map((item, index) => ({
    index,
    nodeId: item.node.id,
    node: item.node,
    depth: item.depth,
    parentText: item.parentText,
    createdAt: item.node.created,
  }));
}

/**
 * Returns a set of visible node IDs up to the given step index.
 * Automatically includes all ancestors so branches stay connected.
 */
export function getVisibleNodeIdsAtStep(
  root: FreeMindNode,
  steps: PresentationStep[],
  currentStepIndex: number
): Set<string> {
  const visible = new Set<string>();
  if (steps.length === 0 || currentStepIndex < 0) return visible;

  // Build parent map
  const parentMap = new Map<string, string>();
  function mapParents(node: FreeMindNode) {
    for (const child of node.children) {
      parentMap.set(child.id, node.id);
      mapParents(child);
    }
  }
  mapParents(root);

  const maxIndex = Math.min(currentStepIndex, steps.length - 1);
  for (let i = 0; i <= maxIndex; i++) {
    const step = steps[i];
    let currId: string | undefined = step.nodeId;
    while (currId) {
      visible.add(currId);
      currId = parentMap.get(currId);
    }
  }

  return visible;
}
