import type { FreeMindMap, FreeMindNode, NodePosition } from '../types/freemind';
import { noteHtmlToPlainText } from './noteRenderer';

/**
 * Deep-clones a FreeMindMap using structuredClone when available, with JSON fallback.
 */
export function cloneMindMap(map: FreeMindMap): FreeMindMap {
  if (typeof structuredClone === 'function') {
    return structuredClone(map);
  }
  return JSON.parse(JSON.stringify(map)) as FreeMindMap;
}

/**
 * Collects a node's ID and all descendant IDs into a Set.
 */
export function collectSubtreeIds(
  node: FreeMindNode,
  out: Set<string> = new Set<string>()
): Set<string> {
  out.add(node.id);
  for (const child of node.children) {
    collectSubtreeIds(child, out);
  }
  return out;
}

/**
 * Removes arrowLinks whose destination ID no longer exists in the tree.
 * Returns true if at least one dangling arrow link was removed.
 */
export function cleanupDanglingArrowLinks(
  root: FreeMindNode,
  validNodeIds?: ReadonlySet<string>
): boolean {
  const validIds = validNodeIds ?? collectSubtreeIds(root);
  let modified = false;

  function visit(node: FreeMindNode) {
    if (node.arrowLinks.length > 0) {
      const filtered = node.arrowLinks.filter(link => validIds.has(link.destination));
      if (filtered.length !== node.arrowLinks.length) {
        node.arrowLinks = filtered;
        modified = true;
      }
    }
    for (const child of node.children) {
      visit(child);
    }
  }

  visit(root);
  return modified;
}

/**
 * Recursively assigns `position` ('left' | 'right') to `node` and all descendants.
 */
export function setSubtreePosition(node: FreeMindNode, position: NodePosition): void {
  node.position = position;
  for (const child of node.children) {
    setSubtreePosition(child, position);
  }
}

/**
 * Collects top-level target nodes in pre-order traversal, skipping descendants of an
 * already-matched ancestor so batch operations never double-process nested selections.
 */
export function pruneTopLevelTargetNodes(
  root: FreeMindNode,
  targetIds: ReadonlySet<string>,
  options?: { excludeRoot?: boolean }
): FreeMindNode[] {
  const results: FreeMindNode[] = [];
  const excludeRoot = Boolean(options?.excludeRoot);

  function visit(node: FreeMindNode) {
    if (node.id === root.id && excludeRoot) {
      for (const child of node.children) {
        visit(child);
      }
      return;
    }
    if (targetIds.has(node.id)) {
      results.push(node);
      return;
    }
    for (const child of node.children) {
      visit(child);
    }
  }

  visit(root);
  return results;
}

/**
 * Extracts plain text from a node, falling back to stripped/decoded rich HTML content.
 */
export function getNodePlainText(node: Pick<FreeMindNode, 'text' | 'htmlContent'>): string {
  if (node.text && node.text.length > 0) {
    return node.text;
  }
  if (node.htmlContent) {
    return noteHtmlToPlainText(node.htmlContent).replace(/\s+/g, ' ').trim();
  }
  return '';
}

/**
 * Evaluates whether a node matches a search keyword across plain text, plain-text note,
 * link URL/path, and attributes (without false-matching HTML tag names in noteHtml).
 */
export function nodeMatchesKeyword(node: FreeMindNode, rawKeyword: string): boolean {
  const q = rawKeyword.trim().toLowerCase();
  if (!q) return true;

  const plainText = getNodePlainText(node).toLowerCase();
  if (plainText.includes(q)) return true;

  if (node.noteHtml) {
    const plainNote = noteHtmlToPlainText(node.noteHtml).toLowerCase();
    if (plainNote.includes(q)) return true;
  }

  if (node.link && node.link.toLowerCase().includes(q)) {
    return true;
  }

  if (
    node.attributes.some(
      attr => attr.name.toLowerCase().includes(q) || attr.value.toLowerCase().includes(q)
    )
  ) {
    return true;
  }

  return false;
}

const ILLEGAL_FILENAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

/**
 * Sanitizes a node/map title into a safe cross-platform download filename stem.
 */
export function sanitizeDownloadFileName(rawName: string, fallback = 'mindmap'): string {
  let cleaned = '';
  for (const ch of String(rawName || '')) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || ILLEGAL_FILENAME_CHARS.has(ch)) {
      cleaned += '_';
    } else {
      cleaned += ch;
    }
  }
  const normalized = cleaned
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  return normalized || fallback;
}
