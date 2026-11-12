import { FreeMindNode } from '../types/freemind';
import { parseFreeMindXml } from '../parser/freemindParser';
import {
  FreeMindSearchQuery,
  FreeMindSearchResult,
  ScannedFileItem,
} from '../types/searcher';

export const SEARCH_ICON_MAP: Record<string, { label: string; emoji: string }> = {
  button_ok: { label: 'OK (完了)', emoji: '✅' },
  button_cancel: { label: '× (中止/NG)', emoji: '❌' },
  help: { label: '? (疑問/ヘルプ)', emoji: '❓' },
  messagebox_warning: { label: '! (警告/注意)', emoji: '⚠️' },
  bookmark: { label: '★ (ブックマーク)', emoji: '⭐' },
  idea: { label: 'アイデア', emoji: '💡' },
  launch: { label: 'ロケット', emoji: '🚀' },
  pencil: { label: '編集/鉛筆', emoji: '✏️' },
  'full-1': { label: '① 優先度1', emoji: '①' },
  'full-2': { label: '② 優先度2', emoji: '②' },
  'full-3': { label: '③ 優先度3', emoji: '③' },
  'full-4': { label: '④ 優先度4', emoji: '④' },
  'full-5': { label: '⑤ 優先度5', emoji: '⑤' },
};

/**
 * Format timestamp (epoch ms) into YYYY/MM/DD HH:mm:ss
 */
export function formatTimestamp(ts?: number): string {
  if (!ts) return '-';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '-';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}:${ss}`;
}

/**
 * Recursively scan directory handle using File System Access API
 */
export async function scanDirectoryHandle(
  dirHandle: any,
  onProgress?: (scannedCount: number, currentFile: string) => void
): Promise<ScannedFileItem[]> {
  const items: ScannedFileItem[] = [];

  async function traverse(handle: any, currentPath: string) {
    for await (const entry of handle.values()) {
      if (entry.name.startsWith('.') || entry.name.startsWith('$')) {
        continue;
      }

      const relPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

      if (entry.kind === 'file') {
        if (entry.name.toLowerCase().endsWith('.mm')) {
          try {
            const file = await entry.getFile();
            const text = await file.text();
            const map = parseFreeMindXml(text);
            items.push({
              fileName: entry.name,
              relativePath: currentPath || '.',
              xmlContent: text,
              map,
              fileSize: file.size,
            });
            if (onProgress) {
              onProgress(items.length, entry.name);
            }
          } catch (e) {
            console.warn(`Failed to parse ${relPath}:`, e);
          }
        }
      } else if (entry.kind === 'directory') {
        await traverse(entry, relPath);
      }
    }
  }

  await traverse(dirHandle, '');
  return items;
}

/**
 * Scan files from HTML directory input (webkitdirectory fallback)
 */
export async function scanFileList(
  fileList: FileList,
  onProgress?: (scannedCount: number, currentFile: string) => void
): Promise<ScannedFileItem[]> {
  const items: ScannedFileItem[] = [];
  const files: File[] = [];

  for (let i = 0; i < fileList.length; i++) {
    const f = fileList[i];
    if (f.name.toLowerCase().endsWith('.mm') && !f.name.startsWith('.')) {
      files.push(f);
    }
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const text = await file.text();
      const map = parseFreeMindXml(text);

      const webkitPath = (file as any).webkitRelativePath || file.name;
      const parts = webkitPath.split('/');
      const relFolder = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';

      items.push({
        fileName: file.name,
        relativePath: relFolder,
        xmlContent: text,
        map,
        fileSize: file.size,
      });

      if (onProgress) {
        onProgress(items.length, file.name);
      }
    } catch (e) {
      console.warn(`Failed to parse ${file.name}:`, e);
    }
  }

  return items;
}

/**
 * Search across all scanned FreeMind files with criteria matching FreeMindSearcher:
 * 1. Keyword search (case-insensitive in node text, link, and note)
 * 2. Date range filter (From / To on node.modified)
 * 3. Icon filter (FreeMind builtin icons)
 * 4. Breadcrumb hierarchy path calculation (Root > Child > Grandchild)
 */
export function executeFreeMindSearch(
  scannedFiles: ScannedFileItem[],
  query: FreeMindSearchQuery
): FreeMindSearchResult[] {
  const results: FreeMindSearchResult[] = [];
  const keywordLower = (query.keyword || '').trim().toLowerCase();

  const fromTime = query.modifiedFrom ? new Date(`${query.modifiedFrom}T00:00:00`).getTime() : null;
  const toTime = query.modifiedTo ? new Date(`${query.modifiedTo}T23:59:59.999`).getTime() : null;

  for (const item of scannedFiles) {
    function traverse(node: FreeMindNode, ancestors: string[]) {
      // 1. Icon Filter
      if (query.iconBuiltin) {
        const hasIcon = node.icons.some(i => i.builtin === query.iconBuiltin);
        if (!hasIcon) {
          for (const c of node.children) {
            traverse(c, [...ancestors, node.text || '(無題)']);
          }
          return;
        }
      }

      // 2. Date Range Filter
      if (fromTime || toTime) {
        if (!node.modified) {
          for (const c of node.children) {
            traverse(c, [...ancestors, node.text || '(無題)']);
          }
          return;
        }
        if (fromTime && node.modified < fromTime) {
          for (const c of node.children) {
            traverse(c, [...ancestors, node.text || '(無題)']);
          }
          return;
        }
        if (toTime && node.modified > toTime) {
          for (const c of node.children) {
            traverse(c, [...ancestors, node.text || '(無題)']);
          }
          return;
        }
      }

      // 3. Keyword Match
      let isMatch = false;
      if (!keywordLower) {
        // If no keyword, matches everything satisfying icon & date filters
        isMatch = true;
      } else {
        const textTarget = (node.text || '').toLowerCase();
        const linkTarget = (node.link || '').toLowerCase();
        const noteTarget = (node.noteHtml || '').toLowerCase();

        if (
          textTarget.includes(keywordLower) ||
          linkTarget.includes(keywordLower) ||
          noteTarget.includes(keywordLower)
        ) {
          isMatch = true;
        }
      }

      if (isMatch) {
        const cleanAncestors = ancestors.filter(a => a.trim() !== '');
        const currentText = node.text || (node.htmlContent ? 'Rich Content' : '(無題ノード)');
        const breadcrumbPath = [...cleanAncestors, currentText].join(' > ');

        results.push({
          id: `${item.fileName}_${node.id}_${results.length}`,
          fileName: item.fileName,
          relativePath: item.relativePath,
          nodeId: node.id,
          nodeText: currentText,
          breadcrumbPath,
          modifiedTime: node.modified,
          formattedModifiedTime: formatTimestamp(node.modified),
          icons: node.icons.map(i => i.builtin),
          link: node.link,
          map: item.map,
        });
      }

      // Recursively search children
      for (const c of node.children) {
        traverse(c, [...ancestors, node.text || '(無題)']);
      }
    }

    traverse(item.map.root, []);
  }

  return results;
}

/**
 * Generate CSV with UTF-8 BOM for Excel compatibility (FreeMindSearcher feature)
 */
export function generateCsvExport(results: FreeMindSearchResult[]): string {
  const header = ['ファイル名', 'フォルダ', '階層パス (パンくず)', 'ノードテキスト', 'アイコン', '更新日時', 'リンク'];
  const rows: string[] = [header.map(escapeCsvCell).join(',')];

  for (const r of results) {
    const iconNames = r.icons
      .map(id => SEARCH_ICON_MAP[id]?.label || id)
      .join('; ');

    const row = [
      r.fileName,
      r.relativePath,
      r.breadcrumbPath,
      r.nodeText,
      iconNames,
      r.formattedModifiedTime,
      r.link || '',
    ];
    rows.push(row.map(escapeCsvCell).join(','));
  }

  // UTF-8 BOM (\uFEFF)
  return '\uFEFF' + rows.join('\r\n');
}

function escapeCsvCell(val: string): string {
  if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
