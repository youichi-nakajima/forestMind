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
});

