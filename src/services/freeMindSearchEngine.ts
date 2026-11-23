import { FreeMindNode } from '../types/freemind';
import { parseFreeMindXml } from '../parser/freemindParser';
import { NODE_ICONS } from '../utils/quickStyle';
import {
  FreeMindSearchQuery,
  FreeMindSearchResult,
  ScannedFileItem,
} from '../types/searcher';

export const SEARCH_ICON_OPTIONS = NODE_ICONS;

export const SEARCH_ICON_MAP: Record<string, { label: string; emoji: string }> = Object.fromEntries(
  NODE_ICONS.map(ic => [ic.builtin, { label: ic.label, emoji: ic.emoji }])
);

export interface RawScannedMmFile {
  filePath?: string;
  fileName: string;
  relativePath: string;
  xmlContent: string;
  fileSize: number;
}

function createScannedFileItem(raw: RawScannedMmFile): ScannedFileItem {
  return {
    filePath: raw.filePath,
    fileName: raw.fileName,
    relativePath: raw.relativePath,
    xmlContent: raw.xmlContent,
    map: parseFreeMindXml(raw.xmlContent),
    fileSize: raw.fileSize,
  };
}

/**
 * Parse raw .mm file payloads (e.g. from Electron main process) into ScannedFileItem entries.
 */
export function parseScannedRawFiles(
  rawFiles: RawScannedMmFile[],
  onProgress?: (scannedCount: number, currentFile: string) => void
): ScannedFileItem[] {
  const items: ScannedFileItem[] = [];
  for (const raw of rawFiles) {
    try {
      items.push(createScannedFileItem(raw));
      onProgress?.(items.length, raw.fileName);
    } catch (e) {
      console.warn(`Failed to parse ${raw.filePath || raw.fileName}:`, e);
    }
  }
  return items;
}

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
  dirHandle: FileSystemDirectoryHandle,
  onProgress?: (scannedCount: number, currentFile: string) => void
): Promise<ScannedFileItem[]> {
  const items: ScannedFileItem[] = [];

  async function traverse(handle: FileSystemDirectoryHandle, currentPath: string) {
    for await (const entry of handle.values()) {
      if (entry.name.startsWith('.') || entry.name.startsWith('$')) {
        continue;
      }

      const relPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

      if (entry.kind === 'file') {
        if (entry.name.toLowerCase().endsWith('.mm')) {
          try {
            const file = await (entry as FileSystemFileHandle).getFile();
            const text = await file.text();
            items.push(
              createScannedFileItem({
                fileName: entry.name,
                relativePath: currentPath || '.',
                xmlContent: text,
                fileSize: file.size,
              })
            );
            if (onProgress) {
              onProgress(items.length, entry.name);
            }
          } catch (e) {
            console.warn(`Failed to parse ${relPath}:`, e);
          }
        }
      } else if (entry.kind === 'directory') {
        await traverse(entry as FileSystemDirectoryHandle, relPath);
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
      const webkitPath = file.webkitRelativePath || file.name;
      const parts = webkitPath.split('/');
      const relFolder = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';

      items.push(
        createScannedFileItem({
          fileName: file.name,
          relativePath: relFolder,
          xmlContent: text,
          fileSize: file.size,
        })
      );

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
 * Search across all scanned FreeMind files:
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
          id: `${item.filePath || `${item.relativePath}/${item.fileName}`}_${node.id}_${results.length}`,
          filePath: item.filePath,
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
 * Generate CSV with UTF-8 BOM for Excel compatibility
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
