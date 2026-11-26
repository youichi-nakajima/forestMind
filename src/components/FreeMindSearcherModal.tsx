import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  FreeMindSearchQuery,
  FreeMindSearchResult,
  ScannedFileItem,
} from '../types/searcher';
import type { ForestFolderEntry } from '../types/workspace';
import {
  scanDirectoryHandle,
  scanFileList,
  parseScannedRawFiles,
  executeFreeMindSearch,
  generateCsvExport,
  SEARCH_ICON_MAP,
  SEARCH_ICON_OPTIONS,
} from '../services/freeMindSearchEngine';
import { normalizeWorkspacePathKey } from '../utils/workspaceStorage';
import {
  Search,
  FolderSearch,
  Download,
  X,
  ExternalLink,
  Calendar,
  Smile,
  ArrowUpDown,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  Folder,
  Star,
  History,
} from 'lucide-react';
import { FreeMindMap } from '../types/freemind';

interface FreeMindSearcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMapNode: (map: FreeMindMap, title: string, nodeId: string, filePath?: string) => void;
  forestFolders?: ForestFolderEntry[];
  lastScannedFolder?: string;
  initialFolderToScan?: string | null;
  onConsumedInitialFolder?: () => void;
  onFolderScanned?: (rootDir: string, dirName: string) => void;
  onRegisterForestFolder?: (folderPath: string, name: string) => void;
}

type SortField = 'fileName' | 'relativePath' | 'breadcrumbPath' | 'nodeText' | 'modifiedTime';
type SortOrder = 'asc' | 'desc';

/** File System Access API (not yet in TypeScript's standard DOM lib) */
type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
};

export const FreeMindSearcherModal: React.FC<FreeMindSearcherModalProps> = ({
  isOpen,
  onClose,
  onOpenMapNode,
  forestFolders = [],
  lastScannedFolder,
  initialFolderToScan,
  onConsumedInitialFolder,
  onFolderScanned,
  onRegisterForestFolder,
}) => {
  // Scanned files state
  const [scannedFiles, setScannedFiles] = useState<ScannedFileItem[]>([]);
  const [scannedDirName, setScannedDirName] = useState<string>('');
  const [scannedRootDir, setScannedRootDir] = useState<string>('');
  const [hasScanned, setHasScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ count: number; current: string }>({
    count: 0,
    current: '',
  });

  // Search filter query state
  const [query, setQuery] = useState<FreeMindSearchQuery>({
    keyword: '',
    modifiedFrom: '',
    modifiedTo: '',
    iconBuiltin: '',
  });

  // Sorting
  const [sortField, setSortField] = useState<SortField>('modifiedTime');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // File input fallback ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  const results = useMemo(() => {
    if (scannedFiles.length === 0) return [];
    return executeFreeMindSearch(scannedFiles, query);
  }, [scannedFiles, query]);

  const scanKnownElectronFolder = useCallback(
    async (folderPath: string) => {
      const scanMmFolderByPath = window.electronAPI?.scanMmFolderByPath;
      if (!scanMmFolderByPath) return;
      setIsScanning(true);
      setScanProgress({ count: 0, current: 'フォルダをスキャン中...' });
      try {
        const res = await scanMmFolderByPath(folderPath);
        if (!res.ok) {
          alert('フォルダのスキャンに失敗しました: ' + res.error);
          return;
        }
        setScannedDirName(res.result.dirName);
        setScannedRootDir(res.result.rootDir);
        const items = parseScannedRawFiles(res.result.files, (count, current) => {
          setScanProgress({ count, current });
        });
        setScannedFiles(items);
        setHasScanned(true);
        onFolderScanned?.(res.result.rootDir, res.result.dirName);
      } catch (err: unknown) {
        console.error('Electron Known Folder Scan Error:', err);
        const message = err instanceof Error ? err.message : String(err);
        alert('フォルダのスキャンに失敗しました: ' + message);
      } finally {
        setIsScanning(false);
      }
    },
    [onFolderScanned]
  );

  useEffect(() => {
    if (!isOpen || !initialFolderToScan) return;
    onConsumedInitialFolder?.();
    if (window.electronAPI?.scanMmFolderByPath) {
      void scanKnownElectronFolder(initialFolderToScan);
    }
  }, [isOpen, initialFolderToScan, onConsumedInitialFolder, scanKnownElectronFolder]);

  // Folder scanning via Electron native dialog or File System Access API
  const handlePickDirectory = async () => {
    const scanMmFolder = window.electronAPI?.scanMmFolder;
    if (scanMmFolder) {
      setIsScanning(true);
      setScanProgress({ count: 0, current: 'フォルダを選択中...' });
      try {
        const scanned = await scanMmFolder();
        if (!scanned) {
          return;
        }
        setScannedDirName(scanned.dirName);
        setScannedRootDir(scanned.rootDir);
        const items = parseScannedRawFiles(scanned.files, (count, current) => {
          setScanProgress({ count, current });
        });
        setScannedFiles(items);
        setHasScanned(true);
        onFolderScanned?.(scanned.rootDir, scanned.dirName);
      } catch (err: unknown) {
        console.error('Electron Folder Scan Error:', err);
        const message = err instanceof Error ? err.message : String(err);
        alert('フォルダのスキャンに失敗しました: ' + message);
      } finally {
        setIsScanning(false);
      }
      return;
    }

    if ('showDirectoryPicker' in window && window.isSecureContext) {
      try {
        const dirHandle = await (window as WindowWithDirectoryPicker).showDirectoryPicker();
        setScannedDirName(dirHandle.name);
        setScannedRootDir('');
        setIsScanning(true);
        setScanProgress({ count: 0, current: '探索開始...' });

        const items = await scanDirectoryHandle(dirHandle, (count, current) => {
          setScanProgress({ count, current });
        });

        setScannedFiles(items);
        setHasScanned(true);
      } catch (err: unknown) {
        const name = err instanceof Error ? err.name : '';
        if (name !== 'AbortError') {
          console.error('Directory Picker Error:', err);
          const message = err instanceof Error ? err.message : String(err);
          alert('フォルダの選択に失敗しました: ' + message);
        }
      } finally {
        setIsScanning(false);
      }
    } else {
      // Fallback for browsers without showDirectoryPicker
      fileInputRef.current?.click();
    }
  };

  const handleFallbackDirectoryInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const firstRel = fileList[0]?.webkitRelativePath || '';
    const dirLabel = firstRel.split('/')[0] || '選択フォルダ';

    setIsScanning(true);
    setScannedDirName(dirLabel);
    setScannedRootDir('');
    setScanProgress({ count: 0, current: '探索中...' });

    try {
      const items = await scanFileList(fileList, (count, current) => {
        setScanProgress({ count, current });
      });

      setScannedFiles(items);
      setHasScanned(true);
    } catch (err: unknown) {
      console.error('Fallback Directory Input Error:', err);
      const message = err instanceof Error ? err.message : String(err);
      alert('フォルダのスキャンに失敗しました: ' + message);
    } finally {
      setIsScanning(false);
      e.target.value = '';
    }
  };

  // Perform search (results already update reactively; prevent form reload on Enter/submit)
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
  };

  const handleClearFilters = () => {
    setQuery({
      keyword: '',
      modifiedFrom: '',
      modifiedTo: '',
      iconBuiltin: '',
    });
  };

  // Handle Sort
  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Sorted results
  const sortedResults = useMemo(() => {
    const list = [...results];
    list.sort((a, b) => {
      if (sortField === 'modifiedTime') {
        const timeA = a.modifiedTime ?? 0;
        const timeB = b.modifiedTime ?? 0;
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      const cmp = a[sortField].localeCompare(b[sortField], 'ja');
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [results, sortField, sortOrder]);

  // Export CSV
  const handleExportCsv = () => {
    if (results.length === 0) return;
    const csvContent = generateCsvExport(results);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `forestMind_search_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isScannedFolderRegistered = useMemo(() => {
    if (!scannedRootDir) return false;
    const key = normalizeWorkspacePathKey(scannedRootDir);
    return forestFolders.some(f => normalizeWorkspacePathKey(f.folderPath) === key);
  }, [scannedRootDir, forestFolders]);

  const showLastScannedChip = useMemo(() => {
    if (!lastScannedFolder) return false;
    const key = normalizeWorkspacePathKey(lastScannedFolder);
    return !forestFolders.some(f => normalizeWorkspacePathKey(f.folderPath) === key);
  }, [lastScannedFolder, forestFolders]);

  const canQuickScanInElectron = Boolean(window.electronAPI?.scanMmFolderByPath);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog searcher-modal-dialog" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header searcher-modal-header">
          <div className="modal-title-group">
            <FolderSearch size={22} className="searcher-brand-icon" />
            <div>
              <h3>ローカルフォルダ横断検索</h3>
              <p className="searcher-sub-desc">
                PC上の指定フォルダ配下のすべての .mm ファイルを再帰的にスキャン・高速検索します
              </p>
            </div>
          </div>
          <button
            type="button"
            className="panel-close-btn"
            onClick={onClose}
            aria-label="閉じる"
            title="閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body searcher-modal-body">
          {/* Top Folder Scanner Bar */}
          <div className="searcher-scan-bar">
            <input
              type="file"
              ref={fileInputRef}
              {...{ webkitdirectory: 'true', directory: 'true' }}
              multiple
              style={{ display: 'none' }}
              onChange={handleFallbackDirectoryInput}
            />
            <button
              type="button"
              className="toolbar-btn primary-action-btn"
              disabled={isScanning}
              onClick={handlePickDirectory}
            >
              {isScanning ? <Loader2 size={16} className="spin" /> : <Folder size={16} />}
              <span>{hasScanned ? 'フォルダを再選択' : 'フォルダを選択してスキャン'}</span>
            </button>

            {isScanning && (
              <span className="scan-status-text">
                スキャン中: {scanProgress.count} 件の .mm ファイルを解析 ({scanProgress.current})
              </span>
            )}

            {!isScanning && hasScanned && (
              <>
                <div className="scanned-info-pill">
                  <CheckCircle2 size={14} className="success-icon" />
                  <span>
                    <strong>{scannedDirName}</strong> 配下の <strong>{scannedFiles.length}</strong> ファイルをスキャン済み
                  </span>
                </div>
                {scannedRootDir && onRegisterForestFolder && !isScannedFolderRegistered && (
                  <button
                    type="button"
                    className="toolbar-btn searcher-register-folder-btn"
                    title="このフォルダを森フォルダに登録"
                    onClick={() => onRegisterForestFolder(scannedRootDir, scannedDirName)}
                  >
                    <Star size={14} />
                    <span>森フォルダに登録</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Registered Forest Folders & Last Scanned Folder Quick Strip */}
          {canQuickScanInElectron && (forestFolders.length > 0 || showLastScannedChip) && (
            <div className="searcher-workspace-strip">
              {forestFolders.map(folder => (
                <button
                  key={folder.folderPath}
                  type="button"
                  disabled={isScanning}
                  className="searcher-workspace-chip"
                  title={folder.folderPath}
                  onClick={() => void scanKnownElectronFolder(folder.folderPath)}
                >
                  <Folder size={12} />
                  <span>{folder.name}</span>
                </button>
              ))}
              {showLastScannedChip && lastScannedFolder && (
                <button
                  type="button"
                  disabled={isScanning}
                  className="searcher-workspace-chip secondary"
                  title={lastScannedFolder}
                  onClick={() => void scanKnownElectronFolder(lastScannedFolder)}
                >
                  <History size={12} />
                  <span>
                    前回のフォルダ:{' '}
                    {lastScannedFolder.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ||
                      lastScannedFolder}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Search Query Form */}
          <form className="searcher-filter-card" onSubmit={handleSearch}>
            <div className="filter-row main-keyword-row">
              <div className="filter-input-wrap flex-grow">
                <Search size={15} className="filter-icon" />
                <input
                  type="text"
                  className="filter-text-input"
                  placeholder="検索キーワードを入力（ノード名・ノート・リンク対象、大文字小文字無視、日本語実体参照自動デコード）..."
                  value={query.keyword}
                  onChange={e => setQuery({ ...query, keyword: e.target.value })}
                />
              </div>
              <button
                type="submit"
                className="toolbar-btn filter-submit-btn"
                disabled={scannedFiles.length === 0 || isScanning}
              >
                <Search size={14} />
                <span>検索実行</span>
              </button>
              <button
                type="button"
                className="toolbar-btn secondary"
                onClick={handleClearFilters}
              >
                クリア
              </button>
            </div>

            {/* Advanced Filters: Date Range & Icon */}
            <div className="filter-row advanced-row">
              <div className="date-filter-group">
                <Calendar size={13} className="filter-icon-sm" />
                <span className="filter-label">更新日:</span>
                <input
                  type="date"
                  className="filter-date-input"
                  value={query.modifiedFrom}
                  onChange={e => setQuery({ ...query, modifiedFrom: e.target.value })}
                />
                <span className="date-sep">〜</span>
                <input
                  type="date"
                  className="filter-date-input"
                  value={query.modifiedTo}
                  onChange={e => setQuery({ ...query, modifiedTo: e.target.value })}
                />
              </div>

              <div className="icon-filter-group">
                <Smile size={13} className="filter-icon-sm" />
                <span className="filter-label">アイコン:</span>
                <select
                  className="filter-select-input"
                  value={query.iconBuiltin}
                  onChange={e => setQuery({ ...query, iconBuiltin: e.target.value })}
                >
                  <option value="">すべてのアイコン</option>
                  {SEARCH_ICON_OPTIONS.map(ic => (
                    <option key={ic.builtin} value={ic.builtin}>
                      {ic.emoji} {ic.label}
                    </option>
                  ))}
                </select>
              </div>

              {results.length > 0 && (
                <button
                  type="button"
                  className="toolbar-btn csv-export-btn"
                  onClick={handleExportCsv}
                  title="検索結果をExcel対応のCSV(UTF-8 BOM付き)でダウンロード"
                >
                  <Download size={14} />
                  <span>CSVエクスポート</span>
                </button>
              )}
            </div>
          </form>

          {/* Results Summary & Table */}
          <div className="searcher-results-container">
            <div className="results-header-bar">
              <h4>
                検索結果: <strong>{results.length}</strong> 件
                {query.keyword && <span className="query-tag">キーワード: "{query.keyword}"</span>}
              </h4>
              <span className="hint-text">行をダブルクリックで該当のマップを開いてジャンプ</span>
            </div>

            {!hasScanned ? (
              <div className="empty-searcher-state">
                <FolderSearch size={44} className="empty-icon" />
                <h4>PC上のマインドマップ保管フォルダを選択してください</h4>
                <p>
                  フォルダ内のサブフォルダを再帰的に全走査し、すべての .mm ファイルから高速にキーワード・日付・アイコン検索できます。
                </p>
                <button
                  type="button"
                  className="toolbar-btn primary-action-btn"
                  disabled={isScanning}
                  onClick={handlePickDirectory}
                >
                  フォルダを選択
                </button>
              </div>
            ) : scannedFiles.length === 0 ? (
              <div className="empty-searcher-state">
                <FolderSearch size={44} className="empty-icon" />
                <p className="no-hit-text">
                  選択したフォルダ「{scannedDirName}」配下に .mm ファイルは見つかりませんでした。
                </p>
                <button
                  type="button"
                  className="toolbar-btn primary-action-btn"
                  disabled={isScanning}
                  onClick={handlePickDirectory}
                >
                  別のフォルダを選択
                </button>
              </div>
            ) : results.length === 0 ? (
              <div className="empty-searcher-state">
                <p className="no-hit-text">指定した条件に一致するノードは見つかりませんでした。</p>
              </div>
            ) : (
              <div className="searcher-table-scroll">
                <table className="searcher-table">
                  <thead>
                    <tr>
                      <th style={{ width: '160px' }} onClick={() => handleToggleSort('fileName')}>
                        <div className="th-content">
                          <span>ファイル名</span>
                          <ArrowUpDown size={11} />
                        </div>
                      </th>
                      <th style={{ width: '130px' }} onClick={() => handleToggleSort('relativePath')}>
                        <div className="th-content">
                          <span>フォルダ</span>
                          <ArrowUpDown size={11} />
                        </div>
                      </th>
                      <th onClick={() => handleToggleSort('breadcrumbPath')}>
                        <div className="th-content">
                          <span>階層パス (パンくず)</span>
                          <ArrowUpDown size={11} />
                        </div>
                      </th>
                      <th style={{ width: '180px' }} onClick={() => handleToggleSort('nodeText')}>
                        <div className="th-content">
                          <span>ノードテキスト</span>
                          <ArrowUpDown size={11} />
                        </div>
                      </th>
                      <th style={{ width: '80px' }}>アイコン</th>
                      <th style={{ width: '140px' }} onClick={() => handleToggleSort('modifiedTime')}>
                        <div className="th-content">
                          <span>更新日時</span>
                          <ArrowUpDown size={11} />
                        </div>
                      </th>
                      <th style={{ width: '60px' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResults.map((r: FreeMindSearchResult) => (
                      <tr
                        key={r.id}
                        className="searcher-row"
                        onDoubleClick={() => {
                          onOpenMapNode(
                            r.map,
                            r.fileName.replace(/\.mm$/i, ''),
                            r.nodeId,
                            r.filePath
                          );
                          onClose();
                        }}
                      >
                        <td className="cell-filename" title={r.fileName}>
                          <FileSpreadsheet size={13} className="cell-icon" />
                          <span>{r.fileName}</span>
                        </td>
                        <td className="cell-folder" title={r.relativePath}>
                          {r.relativePath}
                        </td>
                        <td className="cell-breadcrumb" title={r.breadcrumbPath}>
                          {r.breadcrumbPath}
                        </td>
                        <td className="cell-nodetext" title={r.nodeText}>
                          <strong>{r.nodeText}</strong>
                        </td>
                        <td className="cell-icons">
                          {r.icons.map((ic, i) => (
                            <span
                              key={i}
                              title={SEARCH_ICON_MAP[ic]?.label ? `${SEARCH_ICON_MAP[ic].label} (${ic})` : ic}
                              className="table-icon-badge"
                            >
                              {SEARCH_ICON_MAP[ic]?.emoji || '📌'}
                            </span>
                          ))}
                        </td>
                        <td className="cell-time">{r.formattedModifiedTime}</td>
                        <td className="cell-actions">
                          <button
                            type="button"
                            className="row-open-btn"
                            title="このマップを開いてノードにジャンプ"
                            onClick={() => {
                              onOpenMapNode(
                                r.map,
                                r.fileName.replace(/\.mm$/i, ''),
                                r.nodeId,
                                r.filePath
                              );
                              onClose();
                            }}
                          >
                            <ExternalLink size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
