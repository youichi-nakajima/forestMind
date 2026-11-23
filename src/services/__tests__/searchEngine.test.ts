import { describe, it, expect, vi } from 'vitest';
import {
  executeFreeMindSearch,
  generateCsvExport,
  parseScannedRawFiles,
  SEARCH_ICON_MAP,
  SEARCH_ICON_OPTIONS,
} from '../freeMindSearchEngine';
import { parseFreeMindXml } from '../../parser/freemindParser';
import { ScannedFileItem } from '../../types/searcher';
import { NODE_ICONS } from '../../utils/quickStyle';

describe('FreeMindSearchEngine (Local Folder Search)', () => {
  const xmlSample = `
  <map version="1.0.1">
    <node ID="ID_ROOT" TEXT="資格・試験">
      <node ID="ID_IT" TEXT="IT系">
        <node ID="ID_ORACLE" TEXT="Oracle Master" MODIFIED="1609459200000"> <!-- 2021-01-01 -->
          <icon BUILTIN="button_ok"/>
          <node ID="ID_12C" TEXT="12c Gold" MODIFIED="1672531200000"> <!-- 2023-01-01 -->
            <icon BUILTIN="bookmark"/>
          </node>
        </node>
        <node ID="ID_LPIC" TEXT="LPIC Level 1" MODIFIED="1577836800000"> <!-- 2020-01-01 -->
          <icon BUILTIN="help"/>
        </node>
      </node>
    </node>
  </map>
  `;

  const parsed = parseFreeMindXml(xmlSample);
  const scannedFiles: ScannedFileItem[] = [
    {
      fileName: '資格.mm',
      relativePath: '勉強/2023',
      xmlContent: xmlSample,
      map: parsed,
      fileSize: 1024,
    },
  ];

  it('should search by keyword and compute breadcrumb hierarchy path correctly', () => {
    const results = executeFreeMindSearch(scannedFiles, { keyword: '12c' });

    expect(results).toHaveLength(1);
    expect(results[0].nodeText).toBe('12c Gold');
    expect(results[0].breadcrumbPath).toBe('資格・試験 > IT系 > Oracle Master > 12c Gold');
    expect(results[0].fileName).toBe('資格.mm');
    expect(results[0].relativePath).toBe('勉強/2023');
    expect(results[0].icons).toContain('bookmark');
  });

  it('should filter by icon builtin', () => {
    const resultsOk = executeFreeMindSearch(scannedFiles, { keyword: '', iconBuiltin: 'button_ok' });
    expect(resultsOk).toHaveLength(1);
    expect(resultsOk[0].nodeText).toBe('Oracle Master');

    const resultsBookmark = executeFreeMindSearch(scannedFiles, { keyword: '', iconBuiltin: 'bookmark' });
    expect(resultsBookmark).toHaveLength(1);
    expect(resultsBookmark[0].nodeText).toBe('12c Gold');
  });

  it('should filter by modified date range', () => {
    // 2022-01-01 to 2023-12-31 should only match 12c Gold (2023-01-01)
    const results = executeFreeMindSearch(scannedFiles, {
      keyword: '',
      modifiedFrom: '2022-01-01',
      modifiedTo: '2023-12-31',
    });

    expect(results).toHaveLength(1);
    expect(results[0].nodeText).toBe('12c Gold');
  });

  it('should generate CSV with UTF-8 BOM and correct headers', () => {
    const results = executeFreeMindSearch(scannedFiles, { keyword: 'Oracle' });
    const csv = generateCsvExport(results);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('ファイル名,フォルダ,階層パス (パンくず),ノードテキスト,アイコン,更新日時,リンク');
    expect(csv).toContain('資格.mm');
    expect(csv).toContain('Oracle Master');
    expect(csv).toContain('資格・試験 > IT系 > Oracle Master');
  });

  it('aligns SEARCH_ICON_OPTIONS and SEARCH_ICON_MAP with NODE_ICONS', () => {
    expect(SEARCH_ICON_OPTIONS).toEqual(NODE_ICONS);
    expect(Object.keys(SEARCH_ICON_MAP)).toEqual(NODE_ICONS.map(ic => ic.builtin));
    expect(SEARCH_ICON_MAP.flag).toEqual({ label: '重要', emoji: '🚩' });
    expect(SEARCH_ICON_MAP.star).toEqual({ label: '注目', emoji: '⭐' });
    expect(SEARCH_ICON_MAP.bookmark).toEqual({ label: 'ブックマーク', emoji: '🔖' });
    expect(SEARCH_ICON_MAP.clanbomber).toEqual({ label: '森', emoji: '🌲' });
    expect(SEARCH_ICON_MAP.folder).toEqual({ label: 'フォルダ', emoji: '📁' });
    expect(SEARCH_ICON_MAP.attach).toEqual({ label: '添付', emoji: '📎' });
  });

  it('parses raw scanned files, preserves filePath, and skips invalid XML', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const items = parseScannedRawFiles([
      {
        filePath: 'C:\\maps\\study\\資格.mm',
        fileName: '資格.mm',
        relativePath: 'study',
        xmlContent: xmlSample,
        fileSize: 512,
      },
      {
        filePath: 'C:\\maps\\broken.mm',
        fileName: 'broken.mm',
        relativePath: '.',
        xmlContent: '<map><node',
        fileSize: 10,
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].filePath).toBe('C:\\maps\\study\\資格.mm');
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const results = executeFreeMindSearch(items, { keyword: '12c' });
    expect(results).toHaveLength(1);
    expect(results[0].filePath).toBe('C:\\maps\\study\\資格.mm');
    warnSpy.mockRestore();
  });
});

