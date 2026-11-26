import { describe, it, expect } from 'vitest';
import { renderNoteForPopover, sanitizeNoteHtml } from '../noteRenderer';

describe('noteRenderer', () => {
  it('strips dangerous scripts, event handlers, and javascript: links', () => {
    const dirty =
      '<p onclick="alert(1)">Hello <a href="javascript:alert(1)">bad</a> <a href="https://example.com">good</a><script>evil()</script></p>';
    const clean = sanitizeNoteHtml(dirty);

    expect(clean).not.toContain('script');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('Hello');
    expect(clean).toContain('href="https://example.com"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it('preserves rich HTML notes from FreeMind while sanitizing', () => {
    const freemindNote = '<html><body><ul><li>First</li><li><b>Second</b></li></ul></body></html>';
    const rendered = renderNoteForPopover(freemindNote);

    expect(rendered).toContain('<ul>');
    expect(rendered).toContain('<li>First</li>');
    expect(rendered).toContain('<li><b>Second</b></li>');
  });

  it('converts simple Markdown inside <p>-wrapped notes into formatted HTML', () => {
    const mdNote = '<p># Title\n- item A\n- **bold** `code`\nhttps://example.com</p>';
    const rendered = renderNoteForPopover(mdNote);

    expect(rendered).toContain('<h1>Title</h1>');
    expect(rendered).toContain('<ul><li>item A</li><li><strong>bold</strong> <code>code</code></li></ul>');
    expect(rendered).toContain('href="https://example.com"');
  });

  it('preserves internal .mm/#NODE_ID/forest:// links without target="_blank" while stripping unsafe schemes', () => {
    const html =
      '<p><a href="./sub/roadmap.mm#ID_1">Sub</a> <a href="#ID_LOCAL">Local</a> <a href="forest://tab_1#ID_2">Tab</a> <a href="javascript:alert(1).mm">BadJS</a> <a href="data:text/html,foo.mm">BadData</a></p>';
    const clean = sanitizeNoteHtml(html);

    expect(clean).toContain('<a href="./sub/roadmap.mm#ID_1">Sub</a>');
    expect(clean).toContain('<a href="#ID_LOCAL">Local</a>');
    expect(clean).toContain('<a href="forest://tab_1#ID_2">Tab</a>');
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('data:text/html');
    expect(clean).toContain('BadJS');
    expect(clean).toContain('BadData');

    const md = '<p>Jump to [Design](./design.mm#ID_9) or forest://tab_abc#ID_7</p>';
    const rendered = renderNoteForPopover(md);
    expect(rendered).toContain('<a href="./design.mm#ID_9">Design</a>');
    expect(rendered).toContain('<a href="forest://tab_abc#ID_7">forest://tab_abc#ID_7</a>');
    expect(rendered).not.toContain('target="_blank"');
  });
});

