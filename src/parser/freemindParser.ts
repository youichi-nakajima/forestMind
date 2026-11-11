import {
  FreeMindMap,
  FreeMindNode,
  NodePosition,
  NodeStyle,
  EdgeStyle,
  FreeMindFont,
  FreeMindEdge,
  FreeMindCloud,
  FreeMindIcon,
  FreeMindAttribute,
  FreeMindArrowLink,
  FreeMindHook,
} from '../types/freemind';

/**
 * Generate a unique FreeMind-style ID (e.g. ID_1234567890)
 */
export function generateNodeId(): string {
  return `ID_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

/**
 * Parse an XML string (.mm) into FreeMindMap
 */
export function parseFreeMindXml(xmlString: string): FreeMindMap {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  // Check for parse error
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`XML Parse Error: ${parserError.textContent}`);
  }

  const mapElement = doc.querySelector('map');
  if (!mapElement) {
    throw new Error('Invalid FreeMind file: Missing <map> root element.');
  }

  const version = mapElement.getAttribute('version') || '1.0.1';
  
  // Extract extra attributes of map
  const mapExtraAttrs: Record<string, string> = {};
  for (let i = 0; i < mapElement.attributes.length; i++) {
    const attr = mapElement.attributes[i];
    if (attr.name !== 'version') {
      mapExtraAttrs[attr.name] = attr.value;
    }
  }

  // Find root node element
  let rootNodeEl: Element | null = null;
  for (let i = 0; i < mapElement.children.length; i++) {
    const child = mapElement.children[i];
    if (child.tagName.toLowerCase() === 'node') {
      rootNodeEl = child;
      break;
    }
  }

  if (!rootNodeEl) {
    throw new Error('Invalid FreeMind file: Missing root <node> inside <map>.');
  }

  const rootNode = parseNodeElement(rootNodeEl);

  return {
    version,
    root: rootNode,
    extraAttributes: Object.keys(mapExtraAttrs).length > 0 ? mapExtraAttrs : undefined,
  };
}

/**
 * Parse a <node> element recursively
 */
function parseNodeElement(element: Element): FreeMindNode {
  const knownNodeAttrs = new Set([
    'id',
    'text',
    'folded',
    'position',
    'color',
    'background_color',
    'style',
    'link',
    'created',
    'modified',
  ]);

  const rawAttrs: Record<string, string> = {};
  const extraAttributes: Record<string, string> = {};

  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    const lowerName = attr.name.toLowerCase();
    rawAttrs[lowerName] = attr.value;
    if (!knownNodeAttrs.has(lowerName)) {
      extraAttributes[attr.name] = attr.value;
    }
  }

  const id = rawAttrs['id'] || generateNodeId();
  const text = rawAttrs['text'] || '';
  const folded = rawAttrs['folded'] === 'true';
  const position = (rawAttrs['position'] === 'left' || rawAttrs['position'] === 'right') 
    ? (rawAttrs['position'] as NodePosition) 
    : undefined;
  const color = rawAttrs['color'];
  const backgroundColor = rawAttrs['background_color'];
  const style = (rawAttrs['style'] === 'bubble' || rawAttrs['style'] === 'fork')
    ? (rawAttrs['style'] as NodeStyle)
    : undefined;
  const link = rawAttrs['link'];
  const created = rawAttrs['created'] ? Number(rawAttrs['created']) : undefined;
  const modified = rawAttrs['modified'] ? Number(rawAttrs['modified']) : undefined;

  let htmlContent: string | undefined;
  let noteHtml: string | undefined;
  let font: FreeMindFont | undefined;
  let edge: FreeMindEdge | undefined;
  let cloud: FreeMindCloud | undefined;
  const icons: FreeMindIcon[] = [];
  const attributes: FreeMindAttribute[] = [];
  const arrowLinks: FreeMindArrowLink[] = [];
  const hooks: FreeMindHook[] = [];
  const children: FreeMindNode[] = [];

  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i];
    const tagName = child.tagName.toLowerCase();

    if (tagName === 'node') {
      children.push(parseNodeElement(child));
    } else if (tagName === 'richcontent') {
      const type = (child.getAttribute('TYPE') || child.getAttribute('type') || '').toUpperCase();
      const content = child.innerHTML.trim();
      if (type === 'NODE') {
        htmlContent = content;
      } else if (type === 'NOTE') {
        noteHtml = content;
      }
    } else if (tagName === 'font') {
      font = {
        name: child.getAttribute('NAME') || child.getAttribute('name') || undefined,
        size: child.hasAttribute('SIZE') ? Number(child.getAttribute('SIZE')) : undefined,
        bold: child.getAttribute('BOLD') === 'true' || child.getAttribute('bold') === 'true',
        italic: child.getAttribute('ITALIC') === 'true' || child.getAttribute('italic') === 'true',
      };
    } else if (tagName === 'edge') {
      edge = {
        color: child.getAttribute('COLOR') || child.getAttribute('color') || undefined,
        style: (child.getAttribute('STYLE') || child.getAttribute('style') || undefined) as EdgeStyle | undefined,
        width: child.getAttribute('WIDTH') || child.getAttribute('width') || undefined,
      };
    } else if (tagName === 'cloud') {
      cloud = {
        color: child.getAttribute('COLOR') || child.getAttribute('color') || undefined,
      };
    } else if (tagName === 'icon') {
      const builtin = child.getAttribute('BUILTIN') || child.getAttribute('builtin') || '';
      if (builtin) {
        icons.push({ builtin });
      }
    } else if (tagName === 'attribute') {
      const name = child.getAttribute('NAME') || child.getAttribute('name') || '';
      const value = child.getAttribute('VALUE') || child.getAttribute('value') || '';
      attributes.push({ name, value });
    } else if (tagName === 'arrowlink') {
      const destination = child.getAttribute('DESTINATION') || child.getAttribute('destination') || '';
      if (destination) {
        arrowLinks.push({
          destination,
          color: child.getAttribute('COLOR') || child.getAttribute('color') || undefined,
          startArrow: child.getAttribute('STARTARROW') || child.getAttribute('startarrow') || undefined,
          endArrow: child.getAttribute('ENDARROW') || child.getAttribute('endarrow') || undefined,
        });
      }
    } else if (tagName === 'hook') {
      const name = child.getAttribute('NAME') || child.getAttribute('name') || '';
      const params: Record<string, string> = {};
      for (let j = 0; j < child.attributes.length; j++) {
        const a = child.attributes[j];
        if (a.name.toLowerCase() !== 'name') {
          params[a.name] = a.value;
        }
      }
      hooks.push({
        name,
        params: Object.keys(params).length > 0 ? params : undefined,
        content: child.innerHTML.trim() || undefined,
      });
    }
  }

  return {
    id,
    text,
    htmlContent,
    noteHtml,
    folded,
    position,
    color,
    backgroundColor,
    style,
    link,
    created,
    modified,
    font,
    edge,
    cloud,
    icons,
    attributes,
    arrowLinks,
    hooks,
    extraAttributes: Object.keys(extraAttributes).length > 0 ? extraAttributes : undefined,
    children,
  };
}

