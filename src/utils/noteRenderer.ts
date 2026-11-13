function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('forest://')
  );
}

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'del',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'a',
  'div',
  'span',
  'hr',
]);

const STRIP_CONTENT_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'svg']);

/**
 * Sanitize HTML using DOMParser, keeping only safe formatting tags and safe links.
 */
export function sanitizeNoteHtml(rawHtml: string): string {
  if (!rawHtml.trim()) return '';
  if (typeof DOMParser === 'undefined') {
    return `<p>${escapeHtml(rawHtml.replace(/<[^>]+>/g, ''))}</p>`;
  }

  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  const sanitizeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent || '');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (STRIP_CONTENT_TAGS.has(tag)) {
      return '';
    }

    const childrenHtml = Array.from(el.childNodes).map(sanitizeNode).join('');

    if (!ALLOWED_TAGS.has(tag)) {
      return childrenHtml;
    }

    if (tag === 'br' || tag === 'hr') {
      return `<${tag}>`;
    }

    if (tag === 'a') {
      const href = el.getAttribute('href') || '';
      if (!isSafeUrl(href)) {
        return childrenHtml;
      }
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${childrenHtml}</a>`;
    }

    return `<${tag}>${childrenHtml}</${tag}>`;
  };

  return Array.from(doc.body.childNodes).map(sanitizeNode).join('');
}

function formatInlineMarkdown(escapedLine: string): string {
  let out = escapedLine;
  // Inline code
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  // Markdown links [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
    const rawUrl = url.replace(/&amp;/g, '&');
    if (!isSafeUrl(rawUrl)) return label;
    return `<a href="${escapeHtml(rawUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  // Auto-link bare URLs not already inside href="..."
  out = out.replace(/(^|[\s(>])(https?:\/\/[^\s<)]+)/g, (_m, prefix: string, url: string) => {
    const rawUrl = url.replace(/&amp;/g, '&');
    if (!isSafeUrl(rawUrl)) return `${prefix}${url}`;
    return `${prefix}<a href="${escapeHtml(rawUrl)}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
  return out;
}

/**
 * Convert plain-text / simple Markdown note text into clean HTML.
 */
export function renderSimpleMarkdownToHtml(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const htmlParts: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      htmlParts.push('</ul>');
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      closeList();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = Math.min(4, headingMatch[1].length);
      htmlParts.push(`<h${level}>${formatInlineMarkdown(escapeHtml(headingMatch[2]))}</h${level}>`);
      continue;
    }

    const listMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (listMatch) {
      if (!inList) {
        htmlParts.push('<ul>');
        inList = true;
      }
      htmlParts.push(`<li>${formatInlineMarkdown(escapeHtml(listMatch[1]))}</li>`);
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      closeList();
      htmlParts.push(`<blockquote>${formatInlineMarkdown(escapeHtml(quoteMatch[1]))}</blockquote>`);
      continue;
    }

    closeList();
    htmlParts.push(`<p>${formatInlineMarkdown(escapeHtml(trimmed))}</p>`);
  }

  closeList();
  return htmlParts.join('');
}

/**
 * Render FreeMind noteHtml safely for popover display.
 * - Preserves rich HTML from FreeMind (sanitized).
 * - Converts simple <p>-wrapped plain/Markdown notes written in forestMind into formatted HTML.
 */
export function renderNoteForPopover(noteHtml: string): string {
  const trimmed = noteHtml.trim();
  if (!trimmed) return '';

  // Check if it contains rich HTML tags beyond simple <p> / <html> / <body> wrappers
  const withoutSimpleWrappers = trimmed
    .replace(/<\/?(html|head|body|p)\b[^>]*>/gi, '')
    .trim();
  const hasRichTags = /<[a-z][a-z0-9]*\b[^>]*>/i.test(withoutSimpleWrappers);

  if (hasRichTags) {
    return sanitizeNoteHtml(trimmed);
  }

  // Extract plain text preserving paragraph breaks as newlines
  let plain = trimmed;
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(trimmed, 'text/html');
    const paragraphs = Array.from(doc.body.querySelectorAll('p'));
    if (paragraphs.length > 0 && doc.body.children.length === paragraphs.length) {
      plain = paragraphs.map(p => p.textContent || '').join('\n');
    } else {
      plain = doc.body.textContent || '';
    }
  } else {
    plain = trimmed.replace(/<\/p>\s*<p[^>]*>/gi, '\n').replace(/<[^>]+>/g, '');
  }

  return renderSimpleMarkdownToHtml(plain);
}

