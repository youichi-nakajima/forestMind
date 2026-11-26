import { FreeMindNode, NodePosition } from '../types/freemind';
import { generateNodeId } from '../parser/freemindParser';
import { noteHtmlToPlainText } from './noteRenderer';
import { getNodePlainText } from './treeUtils';

/**
 * Serializes a node and its descendants into Markdown outline text
 */
export function serializeSubtreeToMarkdown(node: FreeMindNode, depth = 0): string {
  const indent = '  '.repeat(depth);
  const text = getNodePlainText(node) || 'Node';
  const lines: string[] = [`${indent}- ${text}`];

  if (node.noteHtml) {
    const plainNote = noteHtmlToPlainText(node.noteHtml).replace(/\s*\n\s*/g, ' ').trim();
    if (plainNote) {
      lines.push(`${indent}  > ${plainNote}`);
    }
  }

  for (const child of node.children) {
    lines.push(serializeSubtreeToMarkdown(child, depth + 1));
  }

  return lines.join('\n');
}

/**
 * Parses indented text or bullet/heading Markdown into a hierarchy of FreeMindNodes
 */
export function parseMarkdownToSubtree(markdownText: string, defaultPosition?: NodePosition): FreeMindNode[] {
  const lines = markdownText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  const rootChildren: FreeMindNode[] = [];
  const stack: { node: FreeMindNode; indent: number }[] = [];

  lines.forEach(rawLine => {
    const headingMatch = rawLine.match(/^#+\s+(.+)$/);
    const bulletMatch = rawLine.match(/^(\s*)[-*+]\s+(.+)$/);

    let indent = 0;
    let text = rawLine.trim();

    if (bulletMatch) {
      indent = bulletMatch[1].length;
      text = bulletMatch[2].trim();
    } else if (headingMatch) {
      const hashes = rawLine.match(/^#+/)?.[0].length || 1;
      indent = (hashes - 1) * 2;
      text = headingMatch[1].trim();
    } else {
      const leadingSpaces = rawLine.match(/^(\s*)/)?.[1].length || 0;
      indent = leadingSpaces;
    }

    const newNode: FreeMindNode = {
      id: generateNodeId(),
      text,
      style: 'fork',
      position: defaultPosition,
      icons: [],
      attributes: [],
      arrowLinks: [],
      hooks: [],
      children: [],
      created: Date.now(),
      modified: Date.now(),
    };

    if (stack.length === 0) {
      rootChildren.push(newNode);
      stack.push({ node: newNode, indent });
    } else {
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      if (stack.length === 0) {
        rootChildren.push(newNode);
        stack.push({ node: newNode, indent });
      } else {
        const parent = stack[stack.length - 1].node;
        newNode.position = parent.position || defaultPosition;
        parent.children.push(newNode);
        stack.push({ node: newNode, indent });
      }
    }
  });

  return rootChildren;
}

