export type ParsedForestMindLink =
  | { kind: 'forest'; tabId: string; nodeId?: string }
  | { kind: 'file'; filePath: string; nodeId?: string }
  | { kind: 'localNode'; nodeId: string }
  | { kind: 'external'; url: string };

const FILE_EXT_RE = /\.(mm|md)$/i;

function decodeFragment(rawFragment: string): string | undefined {
  const trimmed = rawFragment.trim();
  if (!trimmed) return undefined;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

/**
 * Parses a FreeMind node LINK value into a typed target, separating optional #NODE_ID fragments.
 */
export function parseForestMindLink(rawLink: string): ParsedForestMindLink {
  const trimmed = (rawLink || '').trim();
  if (!trimmed) {
    return { kind: 'external', url: '' };
  }

  if (trimmed.startsWith('forest://')) {
    const rest = trimmed.slice('forest://'.length);
    const hashIdx = rest.indexOf('#');
    if (hashIdx === -1) {
      return { kind: 'forest', tabId: rest };
    }
    return {
      kind: 'forest',
      tabId: rest.slice(0, hashIdx),
      nodeId: decodeFragment(rest.slice(hashIdx + 1)),
    };
  }

  if (trimmed.startsWith('#') && trimmed.length > 1) {
    return {
      kind: 'localNode',
      nodeId: decodeFragment(trimmed.slice(1)) || trimmed.slice(1),
    };
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    const hashIdx = trimmed.indexOf('#');
    const pathPart = hashIdx === -1 ? trimmed : trimmed.slice(0, hashIdx);
    const fragment = hashIdx === -1 ? '' : trimmed.slice(hashIdx + 1);
    if (FILE_EXT_RE.test(pathPart.trim())) {
      return {
        kind: 'file',
        filePath: pathPart.trim(),
        nodeId: decodeFragment(fragment),
      };
    }
  }

  return { kind: 'external', url: trimmed };
}

/**
 * Builds a copyable link string pointing to a specific node in the current map.
 */
export function buildNodeLinkText(params: {
  tabId: string;
  nodeId: string;
  filePath?: string;
}): string {
  const { tabId, nodeId, filePath } = params;
  if (filePath && filePath.trim()) {
    const normalized = filePath.trim().replace(/\\/g, '/');
    return `${normalized}#${nodeId}`;
  }
  return `forest://${tabId}#${nodeId}`;
}
