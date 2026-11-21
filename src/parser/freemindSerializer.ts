import { FreeMindMap, FreeMindNode } from '../types/freemind';

/**
 * Whether a code point is allowed in an XML 1.0 document (even as a character reference).
 * Disallowed characters (most C0 controls, lone surrogates, U+FFFE/U+FFFF) are dropped,
 * otherwise the saved file could not be parsed again.
 */
function isXmlChar(code: number): boolean {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  );
}

/**
 * Escape string for FreeMind 1.0.1 XML attributes.
 * FreeMind's XMLElement.writeEncoded converts any character outside ASCII 32..126
 * (including Japanese / CJK characters and newlines) into hex numeric character references (&#xXXXX;).
 */
export function escapeXmlAttr(str: string): string {
  let result = '';
  for (const ch of str) {
    switch (ch) {
      case '&':
        result += '&amp;';
        break;
      case '<':
        result += '&lt;';
        break;
      case '>':
        result += '&gt;';
        break;
      case '"':
        result += '&quot;';
        break;
      case "'":
        result += '&apos;';
        break;
      default: {
        const code = ch.codePointAt(0)!;
        if (!isXmlChar(code)) {
          // Drop characters that are illegal in XML 1.0
        } else if (code < 32 || code > 126) {
          result += `&#x${code.toString(16)};`;
        } else {
          result += ch;
        }
      }
    }
  }
  return result;
}

/**
 * Encode non-ASCII characters (> 126) as &#xXXXX; inside richcontent HTML while preserving markup tags.
 */
function encodeNonAsciiHtml(html: string): string {
  let result = '';
  for (const ch of html) {
    const code = ch.codePointAt(0)!;
    if (!isXmlChar(code)) {
      continue;
    }
    if (code > 126) {
      result += `&#x${code.toString(16)};`;
    } else {
      result += ch;
    }
  }
  return result;
}

const XHTML_NS_ATTR = / xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g;
const FRAGMENT_CACHE_LIMIT = 500;
const wellFormedCache = new Map<string, string>();
const XML_PREDEFINED_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

function isWellFormedFragment(fragment: string): boolean {
  const doc = new DOMParser().parseFromString(`<x>${fragment}</x>`, 'text/xml');
  return doc.getElementsByTagName('parsererror').length === 0;
}

/** Replace HTML-only named entities (e.g. &nbsp;) with their characters; XML only knows 5 entities. */
function replaceHtmlOnlyEntities(fragment: string): string {
  return fragment.replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (match, name: string) => {
    if (XML_PREDEFINED_ENTITIES.has(name)) return match;
    const decoded = new DOMParser().parseFromString(match, 'text/html').body.textContent || '';
    if (!decoded || decoded === match) return `&amp;${name};`;
    return decoded.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });
}

/**
 * Ensure an HTML fragment (richcontent / hook content) is well-formed XML.
 * Malformed content (e.g. a bare `&` or `<`, HTML-only entities like &nbsp;) is
 * repaired by parsing it as HTML and re-serializing it as XHTML.
 */
export function ensureWellFormedXmlFragment(html: string): string {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return html;
  }
  const cached = wellFormedCache.get(html);
  if (cached !== undefined) return cached;

  let result = html;
  const probe = new DOMParser().parseFromString(`<x>${html}</x>`, 'text/xml');
  if (probe.getElementsByTagName('parsererror').length > 0) {
    result = replaceHtmlOnlyEntities(html);
    if (!isWellFormedFragment(result)) {
      const htmlDoc = new DOMParser().parseFromString(html, 'text/html');
      const serializer = new XMLSerializer();
      const source = /<html[\s>]/i.test(html)
        ? [htmlDoc.documentElement]
        : Array.from(htmlDoc.body.childNodes);
      result = replaceHtmlOnlyEntities(
        source
          .map(n => serializer.serializeToString(n))
          .join('')
          .replace(XHTML_NS_ATTR, '')
      );
      if (!isWellFormedFragment(result)) {
        // Last resort: keep the text content only
        const text = htmlDoc.body.textContent || '';
        result = `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
      }
    }
  }

  if (wellFormedCache.size >= FRAGMENT_CACHE_LIMIT) {
    const oldestKey = wellFormedCache.keys().next().value;
    if (oldestKey !== undefined) wellFormedCache.delete(oldestKey);
  }
  wellFormedCache.set(html, result);
  return result;
}

function encodeRichContent(html: string): string {
  return encodeNonAsciiHtml(ensureWellFormedXmlFragment(html));
}

export function serializeFreeMindXml(map: FreeMindMap): string {
  const lines: string[] = [];
  let mapOpen = `<map version="${escapeXmlAttr(map.version || '1.0.1')}"`;
  
  if (map.extraAttributes) {
    for (const [key, val] of Object.entries(map.extraAttributes)) {
      mapOpen += ` ${escapeXmlAttr(key)}="${escapeXmlAttr(val)}"`;
    }
  }
  mapOpen += '>';
  lines.push(mapOpen);

  // Serialize root node
  serializeNode(map.root, lines, 1);

  lines.push('</map>');
  return lines.join('\n');
}

function serializeNode(node: FreeMindNode, lines: string[], indentLevel: number): void {
  const indent = '  '.repeat(indentLevel);
  const attrs: string[] = [];

  // FreeMind node attributes
  if (node.backgroundColor) attrs.push(`BACKGROUND_COLOR="${escapeXmlAttr(node.backgroundColor)}"`);
  if (node.color) attrs.push(`COLOR="${escapeXmlAttr(node.color)}"`);
  if (node.created) attrs.push(`CREATED="${node.created}"`);
  if (node.folded) attrs.push(`FOLDED="true"`);
  if (node.id) attrs.push(`ID="${escapeXmlAttr(node.id)}"`);
  if (node.link) attrs.push(`LINK="${escapeXmlAttr(node.link)}"`);
  if (node.modified) attrs.push(`MODIFIED="${node.modified}"`);
  if (node.position) attrs.push(`POSITION="${escapeXmlAttr(node.position)}"`);
  if (node.style) attrs.push(`STYLE="${escapeXmlAttr(node.style)}"`);
  if (node.text !== undefined && !node.htmlContent) {
    attrs.push(`TEXT="${escapeXmlAttr(node.text)}"`);
  }

  // Extra attributes preserved during parsing
  if (node.extraAttributes) {
    for (const [key, val] of Object.entries(node.extraAttributes)) {
      attrs.push(`${escapeXmlAttr(key)}="${escapeXmlAttr(val)}"`);
    }
  }

  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // Determine if node has child elements
  const hasChildren = 
    node.children.length > 0 ||
    Boolean(node.htmlContent) ||
    Boolean(node.noteHtml) ||
    Boolean(node.font) ||
    Boolean(node.edge) ||
    Boolean(node.cloud) ||
    node.icons.length > 0 ||
    node.attributes.length > 0 ||
    node.arrowLinks.length > 0 ||
    node.hooks.length > 0;

  if (!hasChildren) {
    lines.push(`${indent}<node${attrStr}/>`);
    return;
  }

  lines.push(`${indent}<node${attrStr}>`);
  const childIndent = '  '.repeat(indentLevel + 1);

  // 1. Richcontent (NODE)
  if (node.htmlContent) {
    lines.push(`${childIndent}<richcontent TYPE="NODE">`);
    lines.push(`${childIndent}  ${encodeRichContent(node.htmlContent)}`);
    lines.push(`${childIndent}</richcontent>`);
  }

  // 2. Richcontent (NOTE)
  if (node.noteHtml) {
    lines.push(`${childIndent}<richcontent TYPE="NOTE">`);
    lines.push(`${childIndent}  ${encodeRichContent(node.noteHtml)}`);
    lines.push(`${childIndent}</richcontent>`);
  }

  // 3. Edge
  if (node.edge) {
    const edgeAttrs: string[] = [];
    if (node.edge.color) edgeAttrs.push(`COLOR="${escapeXmlAttr(node.edge.color)}"`);
    if (node.edge.style) edgeAttrs.push(`STYLE="${escapeXmlAttr(node.edge.style)}"`);
    if (node.edge.width) edgeAttrs.push(`WIDTH="${escapeXmlAttr(String(node.edge.width))}"`);
    lines.push(`${childIndent}<edge${edgeAttrs.length > 0 ? ' ' + edgeAttrs.join(' ') : ''}/>`);
  }

  // 4. Font
  if (node.font) {
    const fontAttrs: string[] = [];
    if (node.font.name) fontAttrs.push(`NAME="${escapeXmlAttr(node.font.name)}"`);
    if (node.font.size) fontAttrs.push(`SIZE="${node.font.size}"`);
    if (node.font.bold) fontAttrs.push(`BOLD="true"`);
    if (node.font.italic) fontAttrs.push(`ITALIC="true"`);
    lines.push(`${childIndent}<font${fontAttrs.length > 0 ? ' ' + fontAttrs.join(' ') : ''}/>`);
  }

  // 5. Cloud
  if (node.cloud) {
    const cloudAttr = node.cloud.color ? ` COLOR="${escapeXmlAttr(node.cloud.color)}"` : '';
    lines.push(`${childIndent}<cloud${cloudAttr}/>`);
  }

  // 6. Icons
  for (const icon of node.icons) {
    lines.push(`${childIndent}<icon BUILTIN="${escapeXmlAttr(icon.builtin)}"/>`);
  }

  // 7. Attributes
  for (const attr of node.attributes) {
    lines.push(`${childIndent}<attribute NAME="${escapeXmlAttr(attr.name)}" VALUE="${escapeXmlAttr(attr.value)}"/>`);
  }

  // 8. Arrow links
  for (const arrow of node.arrowLinks) {
    const arrowAttrs: string[] = [`DESTINATION="${escapeXmlAttr(arrow.destination)}"`];
    if (arrow.color) arrowAttrs.push(`COLOR="${escapeXmlAttr(arrow.color)}"`);
    if (arrow.startArrow) arrowAttrs.push(`STARTARROW="${escapeXmlAttr(arrow.startArrow)}"`);
    if (arrow.endArrow) arrowAttrs.push(`ENDARROW="${escapeXmlAttr(arrow.endArrow)}"`);
    lines.push(`${childIndent}<arrowlink ${arrowAttrs.join(' ')}/>`);
  }

  // 9. Hooks
  for (const hook of node.hooks) {
    const hookAttrs: string[] = [`NAME="${escapeXmlAttr(hook.name)}"`];
    if (hook.params) {
      for (const [pk, pv] of Object.entries(hook.params)) {
        hookAttrs.push(`${escapeXmlAttr(pk)}="${escapeXmlAttr(pv)}"`);
      }
    }
    if (hook.content) {
      lines.push(`${childIndent}<hook ${hookAttrs.join(' ')}>${encodeRichContent(hook.content)}</hook>`);
    } else {
      lines.push(`${childIndent}<hook ${hookAttrs.join(' ')}/>`);
    }
  }

  // 10. Child nodes
  for (const childNode of node.children) {
    serializeNode(childNode, lines, indentLevel + 1);
  }

  lines.push(`${indent}</node>`);
}

