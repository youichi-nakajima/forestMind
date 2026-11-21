import { describe, it, expect } from 'vitest';
import {
  noteHtmlToPlainText,
  plainTextToNoteHtml,
  sanitizeNodeHtml,
} from '../noteRenderer';
import { parseFreeMindXml, generateNodeId } from '../../parser/freemindParser';
import { serializeFreeMindXml, escapeXmlAttr } from '../../parser/freemindSerializer';
import type { FreeMindMap } from '../../types/freemind';

function mapWith(patch: Partial<FreeMindMap['root']>): FreeMindMap {
  return {
    version: '1.0.1',
    root: {
      id: 'ID_ROOT',
      text: 'Root',
      icons: [],
      attributes: [],
      arrowLinks: [],
      hooks: [],
      children: [],
      ...patch,
    },
  };
}

describe('note text <-> HTML conversion', () => {
  it('escapes special characters and round-trips multi-line text', () => {
    const text = 'a < b & c\n<script>x</script>\n\n"quoted"';
    const html = plainTextToNoteHtml(text)!;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;');
    expect(noteHtmlToPlainText(html)).toBe(text);
  });

  it('returns undefined for empty input', () => {
    expect(plainTextToNoteHtml('')).toBeUndefined();
    expect(noteHtmlToPlainText(undefined)).toBe('');
  });
});

describe('sanitizeNodeHtml', () => {
  it('removes event handlers, scripts and unsafe links from rich node content', () => {
    const dirty =
      '<html><body><p>Hi<img src="x" onerror="alert(1)"><a href="javascript:alert(1)">x</a></p><script>evil()</script></body></html>';
    const clean = sanitizeNodeHtml(dirty);
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('<img');
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('script');
    expect(clean).toContain('Hi');
    // cached result is identical
    expect(sanitizeNodeHtml(dirty)).toBe(clean);
  });
});

describe('serializer robustness', () => {
  it('produces parseable XML even when note HTML is malformed', () => {
    const map = mapWith({ noteHtml: '<p>a < b & c &nbsp;日本語</p>' });
    const xml = serializeFreeMindXml(map);
    const parsed = parseFreeMindXml(xml);
    expect(noteHtmlToPlainText(parsed.root.noteHtml)).toContain('a < b & c');
    expect(noteHtmlToPlainText(parsed.root.noteHtml)).toContain('日本語');
  });

  it('keeps already well-formed rich content unchanged', () => {
    const html = '<html><head></head><body><p>ok &amp; fine</p></body></html>';
    const xml = serializeFreeMindXml(mapWith({ noteHtml: html }));
    expect(xml).toContain(html);
  });

  it('drops characters that are illegal in XML 1.0', () => {
    expect(escapeXmlAttr('a\u0001b\uD800c\tz')).toBe('abc&#x9;z');
    const xml = serializeFreeMindXml(mapWith({ text: 'bad\u0002char' }));
    expect(parseFreeMindXml(xml).root.text).toBe('badchar');
  });
});

describe('generateNodeId', () => {
  it('generates 1,000 unique IDs in a tight loop without collisions', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateNodeId());
    }
    expect(ids.size).toBe(1000);
  });
});
