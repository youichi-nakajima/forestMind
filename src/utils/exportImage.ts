import { FreeMindNode } from '../types/freemind';
import { computeLayout, LayoutNode, RenderCloud } from './layout';
import { resolveNodeDisplayColors } from './quickStyle';

export interface MapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

const ICON_EMOJI_MAP: Record<string, string> = {
  button_ok: '✅',
  button_cancel: '❌',
  flag: '🚩',
  launch: '🚀',
  pencil: '✏️',
  wizard: '🪄',
  clanbomber: '🌲',
  folder: '📁',
  help: '❓',
  bookmark: '🔖',
  kdevelop_down: '🔽',
  attach: '📎',
  star: '⭐',
  idea: '💡',
  stop: '⛔',
  yes: '👍',
};

function getIconEmoji(builtin: string): string {
  return ICON_EMOJI_MAP[builtin] || '📌';
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Compute bounding box covering all visible layout nodes and clouds.
 */
export function computeMapBounds(
  layoutNodes: Map<string, LayoutNode>,
  clouds: RenderCloud[] = []
): MapBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const lNode of layoutNodes.values()) {
    minX = Math.min(minX, lNode.x - lNode.width / 2);
    maxX = Math.max(maxX, lNode.x + lNode.width / 2);
    minY = Math.min(minY, lNode.y - lNode.height / 2);
    maxY = Math.max(maxY, lNode.y + lNode.height / 2);
  }

  for (const c of clouds) {
    minX = Math.min(minX, c.x - 16);
    maxX = Math.max(maxX, c.x + c.width + 16);
    minY = Math.min(minY, c.y - 16);
    maxY = Math.max(maxY, c.y + c.height + 16);
  }

  if (!Number.isFinite(minX)) {
    return { minX: -100, maxX: 100, minY: -50, maxY: 50, width: 200, height: 100 };
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/**
 * Build a standalone SVG string representing the current mindmap.
 */
export function buildMindMapSvg(
  rootNode: FreeMindNode,
  options: { isDarkMode?: boolean; padding?: number } = {}
): { svg: string; width: number; height: number } {
  const { isDarkMode = false, padding = 48 } = options;
  const { layoutNodes, edges, arrowLinks, clouds } = computeLayout(rootNode);
  const bounds = computeMapBounds(layoutNodes, clouds);

  const width = Math.ceil(bounds.width + padding * 2);
  const height = Math.ceil(bounds.height + padding * 2);
  const vx = bounds.minX - padding;
  const vy = bounds.minY - padding;

  const bgFill = isDarkMode ? '#0f172a' : '#f8fafc';
  const defaultText = isDarkMode ? '#f1f5f9' : '#1e293b';
  const defaultBubbleFill = isDarkMode ? '#1e293b' : '#ffffff';
  const defaultBubbleStroke = isDarkMode ? '#475569' : '#cbd5e1';
  const rootFill = isDarkMode ? '#0c4a6e' : '#f0f9ff';
  const rootStroke = isDarkMode ? '#38bdf8' : '#0284c7';
  const rootText = isDarkMode ? '#e0f2fe' : '#0369a1';
  const forkUnderline = isDarkMode ? '#475569' : '#94a3b8';

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${vx.toFixed(1)} ${vy.toFixed(1)} ${width} ${height}">`
  );
  parts.push(
    `<defs><marker id="export-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 1 L 9 5 L 0 9 z" fill="#e11d48"/></marker></defs>`
  );
  parts.push(`<rect x="${vx.toFixed(1)}" y="${vy.toFixed(1)}" width="${width}" height="${height}" fill="${bgFill}"/>`);

  // Clouds
  for (const c of clouds) {
    const sw = c.nestingLevel > 0 ? 2.2 : 2;
    parts.push(
      `<path d="${c.d}" fill="${escapeXml(c.color)}" fill-opacity="0.55" stroke="${escapeXml(c.strokeColor)}" stroke-opacity="0.85" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`
    );
  }

  // Edges
  for (const edge of edges) {
    parts.push(
      `<path d="${edge.d}" fill="none" stroke="${escapeXml(edge.color)}" stroke-width="${edge.width}" stroke-linecap="round"/>`
    );
  }

  // Arrow links
  for (const al of arrowLinks) {
    parts.push(
      `<path d="${al.d}" fill="none" stroke="${escapeXml(al.color)}" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#export-arrow)"/>`
    );
  }

  // Nodes
  const fontFamily = "'Inter', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  for (const lNode of layoutNodes.values()) {
    const { node } = lNode;
    const isRoot = lNode.depth === 0;
    const isBubble = node.style === 'bubble' || isRoot;
    const fontSize = node.font?.size || (isRoot ? 18 : 14);
    const fontWeight = node.font?.bold || isRoot ? 'bold' : 'normal';
    const fontStyle = node.font?.italic ? 'italic' : 'normal';

    const left = lNode.x - lNode.width / 2;
    const top = lNode.y - lNode.height / 2;
    const resolved = resolveNodeDisplayColors(node, isDarkMode);

    if (isBubble) {
      const fill = resolved.backgroundColor || (isRoot ? rootFill : defaultBubbleFill);
      const stroke = resolved.borderColor || resolved.color || (isRoot ? rootStroke : defaultBubbleStroke);
      const rx = isRoot ? 16 : 10;
      const strokeWidth = isRoot ? 2 : 1.5;
      parts.push(
        `<rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${lNode.width.toFixed(1)}" height="${lNode.height.toFixed(1)}" rx="${rx}" fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}"/>`
      );
    } else {
      if (resolved.backgroundColor) {
        parts.push(
          `<rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${lNode.width.toFixed(1)}" height="${lNode.height.toFixed(1)}" rx="6" fill="${escapeXml(resolved.backgroundColor)}"/>`
        );
      }
      const lineY = lNode.y + lNode.height / 2 - 1;
      const lineColor = resolved.borderColor || resolved.color || forkUnderline;
      parts.push(
        `<line x1="${left.toFixed(1)}" y1="${lineY.toFixed(1)}" x2="${(left + lNode.width).toFixed(1)}" y2="${lineY.toFixed(1)}" stroke="${escapeXml(lineColor)}" stroke-width="2.5" stroke-linecap="round"/>`
      );
    }

    const iconsStr = node.icons.map(ic => getIconEmoji(ic.builtin)).join(' ');
    const badges: string[] = [];
    if (node.link) badges.push('🔗');
    if (node.noteHtml) badges.push('📝');
    const attrsStr =
      node.attributes.length > 0
        ? node.attributes
            .slice(0, 3)
            .map(a => `[${a.name}:${a.value}]`)
            .join(' ') + (node.attributes.length > 3 ? ` +${node.attributes.length - 3}` : '')
        : '';
    const label = [iconsStr, node.text || '', attrsStr, badges.join('')].filter(Boolean).join(' ');
    const textColor = resolved.color || (isRoot ? rootText : defaultText);

    parts.push(
      `<text x="${lNode.x.toFixed(1)}" y="${lNode.y.toFixed(1)}" fill="${escapeXml(textColor)}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" font-style="${fontStyle}" text-anchor="middle" dominant-baseline="central">${escapeXml(label)}</text>`
    );
  }

  parts.push('</svg>');
  return { svg: parts.join('\n'), width, height };
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download the mindmap as a standalone SVG file.
 */
export function exportMindMapAsSvg(
  rootNode: FreeMindNode,
  filenameBase: string,
  isDarkMode: boolean = false
): void {
  const { svg } = buildMindMapSvg(rootNode, { isDarkMode });
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, `${filenameBase || 'mindmap'}.svg`);
}

/**
 * Render the standalone SVG onto a high-DPI canvas and download as PNG.
 */
export async function exportMindMapAsPng(
  rootNode: FreeMindNode,
  filenameBase: string,
  isDarkMode: boolean = false
): Promise<void> {
  const { svg, width, height } = buildMindMapSvg(rootNode, { isDarkMode });
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = err => reject(err);
      image.src = url;
    });

    // Use 2x resolution while capping canvas size for browser safety
    const maxDim = 4096;
    const scale = Math.min(2, maxDim / Math.max(width, height, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D canvas context');
    }
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode PNG'));
      }, 'image/png');
    });

    triggerDownload(pngBlob, `${filenameBase || 'mindmap'}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

