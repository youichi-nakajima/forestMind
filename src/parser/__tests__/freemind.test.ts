import { describe, it, expect } from 'vitest';
import { parseFreeMindXml } from '../freemindParser';
import { serializeFreeMindXml } from '../freemindSerializer';

const sampleXml = `<map version="1.0.1">
  <node CREATED="1700000000000" ID="ID_ROOT" MODIFIED="1700000001000" TEXT="Central Idea &amp; Overview">
    <edge COLOR="#808080" STYLE="bezier" WIDTH="2"/>
    <font BOLD="true" NAME="SansSerif" SIZE="16"/>
    <node COLOR="#ff0000" CREATED="1700000002000" ID="ID_RIGHT_1" MODIFIED="1700000003000" POSITION="right" STYLE="bubble" TEXT="Right Branch 1">
      <icon BUILTIN="button_ok"/>
      <icon BUILTIN="flag"/>
      <attribute NAME="Priority" VALUE="High"/>
      <node CREATED="1700000004000" ID="ID_SUB_1" MODIFIED="1700000005000" TEXT="Sub-topic &lt;details&gt;"/>
    </node>
    <node CREATED="1700000006000" FOLDED="true" ID="ID_LEFT_1" MODIFIED="1700000007000" POSITION="left" LINK="https://example.com">
      <richcontent TYPE="NODE">
        <html><head></head><body><p>Rich text <b>bold</b> and <i>italic</i></p></body></html>
      </richcontent>
      <richcontent TYPE="NOTE">
        <html><head></head><body><p>Detailed notes here.</p></body></html>
      </richcontent>
    </node>
  </node>
</map>`;

describe('FreeMind Parser & Serializer', () => {
  it('should parse FreeMind XML correctly', () => {
    const map = parseFreeMindXml(sampleXml);

    expect(map.version).toBe('1.0.1');
    expect(map.root.id).toBe('ID_ROOT');
    expect(map.root.text).toBe('Central Idea & Overview');
    expect(map.root.font?.bold).toBe(true);
    expect(map.root.font?.size).toBe(16);
    expect(map.root.edge?.style).toBe('bezier');

    expect(map.root.children).toHaveLength(2);

    // Right child
    const rightChild = map.root.children[0];
    expect(rightChild.id).toBe('ID_RIGHT_1');
    expect(rightChild.position).toBe('right');
    expect(rightChild.style).toBe('bubble');
    expect(rightChild.color).toBe('#ff0000');
    expect(rightChild.icons).toHaveLength(2);
    expect(rightChild.icons[0].builtin).toBe('button_ok');
    expect(rightChild.attributes).toHaveLength(1);
    expect(rightChild.attributes[0]).toEqual({ name: 'Priority', value: 'High' });
    expect(rightChild.children[0].text).toBe('Sub-topic <details>');

    // Left child
    const leftChild = map.root.children[1];
    expect(leftChild.id).toBe('ID_LEFT_1');
    expect(leftChild.position).toBe('left');
    expect(leftChild.folded).toBe(true);
    expect(leftChild.link).toBe('https://example.com');
    expect(leftChild.htmlContent).toContain('Rich text <b>bold</b>');
    expect(leftChild.noteHtml).toContain('Detailed notes here.');
  });

  it('should achieve lossless round-trip serialization', () => {
    const parsed1 = parseFreeMindXml(sampleXml);
    const serialized = serializeFreeMindXml(parsed1);
    const parsed2 = parseFreeMindXml(serialized);

    expect(parsed2.version).toBe(parsed1.version);
    expect(parsed2.root.id).toBe(parsed1.root.id);
    expect(parsed2.root.text).toBe(parsed1.root.text);
    expect(parsed2.root.children).toHaveLength(parsed1.root.children.length);
    expect(parsed2.root.children[0].icons).toEqual(parsed1.root.children[0].icons);
    expect(parsed2.root.children[0].attributes).toEqual(parsed1.root.children[0].attributes);
    expect(parsed2.root.children[1].folded).toBe(true);
    expect(parsed2.root.children[1].link).toBe('https://example.com');
  });

  it('should handle special XML characters in text properly', () => {
    const map = parseFreeMindXml(`
      <map version="1.0.1">
        <node ID="ID_1" TEXT="Special: &amp; &lt; &gt; &quot; &apos;"/>
      </map>
    `);
    expect(map.root.text).toBe(`Special: & < > " '`);

    const serialized = serializeFreeMindXml(map);
    expect(serialized).toContain('&amp;');
    expect(serialized).toContain('&lt;');
    expect(serialized).toContain('&gt;');
    expect(serialized).toContain('&quot;');
    expect(serialized).toContain('&apos;');

    const roundTripped = parseFreeMindXml(serialized);
    expect(roundTripped.root.text).toBe(`Special: & < > " '`);
  });

  it('should encode non-ASCII (Japanese) characters as hex numeric character references (&#xXXXX;) per FreeMind 1.0.1 spec', () => {
    const map = parseFreeMindXml(`
      <map version="1.0.1">
        <node ID="ID_JP" TEXT="&#x65e5;&#x672c;&#x8a9e;&#x30c6;&#x30b9;&#x30c8;"/>
      </map>
    `);
    expect(map.root.text).toBe('日本語テスト');

    const serialized = serializeFreeMindXml(map);
    expect(serialized).toContain('TEXT="&#x65e5;&#x672c;&#x8a9e;&#x30c6;&#x30b9;&#x30c8;"');

    const roundTripped = parseFreeMindXml(serialized);
    expect(roundTripped.root.text).toBe('日本語テスト');
  });
});

