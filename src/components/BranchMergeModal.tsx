import React, { useEffect, useRef, useState } from 'react';
import { FolderOpen, GitMerge, AlertCircle, X } from 'lucide-react';
import type { MapTab } from '../hooks/useMindMap';
import { generateNodeId, parseFreeMindXml } from '../parser/freemindParser';
import type { FreeMindMap, FreeMindNode } from '../types/freemind';
import { countSubtreeNodes } from '../utils/branchOperations';
import { parseMarkdownToSubtree } from '../utils/markdownUtils';
import { getNodePlainText } from '../utils/treeUtils';

interface BranchMergeModalProps {
  isOpen: boolean;
  targetNode: FreeMindNode | null;
  otherTabs: MapTab[];
  isElectron: boolean;
  onMergeFromTab: (sourceTabId: string, includeSourceRoot: boolean) => void;
  onMergeFromFile: (
    sourceMap: FreeMindMap,
    sourceTitle: string,
    includeSourceRoot: boolean
  ) => void;
  onClose: () => void;
}

function parseFileToMap(content: string, fileName: string): { map: FreeMindMap; title: string } {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.txt')) {
    const title = fileName.replace(/\.(md|txt)$/i, '') || 'Markdown';
    const children = parseMarkdownToSubtree(content);
    const map: FreeMindMap = {
      version: '1.0.1',
      root: {
        id: generateNodeId(),
        text: title,
        style: 'bubble',
        font: { size: 16, bold: true },
        icons: [],
        attributes: [],
        arrowLinks: [],
        hooks: [],
        children,
      },
    };
    return { map, title };
  }
  const parsed = parseFreeMindXml(content);
  const title = getNodePlainText(parsed.root) || fileName.replace(/\.mm$/i, '') || 'MindMap';
  return { map: parsed, title };
}

export const BranchMergeModal: React.FC<BranchMergeModalProps> = ({
  isOpen,
  targetNode,
  otherTabs,
  isElectron,
  onMergeFromTab,
  onMergeFromFile,
  onClose,
}) => {
  const [selectedTabId, setSelectedTabId] = useState<string>('');
  const [includeSourceRoot, setIncludeSourceRoot] = useState(true);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedTabId(otherTabs[0]?.id || '');
      setIncludeSourceRoot(true);
      setFileError(null);
    }
  }, [isOpen, targetNode?.id, otherTabs]);

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

  if (!isOpen || !targetNode) return null;

  const targetTitle = getNodePlainText(targetNode) || '(無題ノード)';

  const handlePickElectronFile = async () => {
    setFileError(null);
    const openMmFile = window.electronAPI?.openMmFile;
    if (!openMmFile) return;
    try {
      const payload = await openMmFile();
      if (!payload) return;
      const { map, title } = parseFileToMap(payload.content, payload.fileName);
      onMergeFromFile(map, title, includeSourceRoot);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleWebFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result;
      if (typeof content !== 'string') return;
      try {
        const { map, title } = parseFileToMap(content, file.name);
        onMergeFromFile(map, title, includeSourceRoot);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : String(err));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog branch-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="branch-merge-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <GitMerge size={19} className="modal-icon" />
            <h3 id="branch-merge-title">別マップをここへ合流</h3>
          </div>
          <button
            type="button"
            className="panel-close-btn"
            aria-label="閉じる"
            title="閉じる"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body branch-modal-body">
          <div className="branch-summary-card">
            <div className="branch-summary-label">合流先の親ノード</div>
            <div className="branch-summary-title">{targetTitle}</div>
          </div>

          <div className="merge-section">
            <h4 className="merge-section-title">開いている別タブから合流</h4>
            {otherTabs.length === 0 ? (
              <p className="merge-empty-hint">
                他に開いているタブはありません。下のボタンからローカルファイルを直接取り込めます。
              </p>
            ) : (
              <div className="merge-tabs-list">
                {otherTabs.map(tab => {
                  const tabTitle = getNodePlainText(tab.map.root) || tab.title || '無題マップ';
                  const count = countSubtreeNodes(tab.map.root);
                  const isSelected = selectedTabId === tab.id;
                  return (
                    <label
                      key={tab.id}
                      className={`merge-tab-option ${isSelected ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="merge-source-tab"
                        checked={isSelected}
                        onChange={() => setSelectedTabId(tab.id)}
                      />
                      <div className="merge-tab-info">
                        <strong>{tabTitle}</strong>
                        <span>
                          {count} ノード
                          {tab.filePath ? ` · ${tab.filePath.split(/[\\/]/).pop()}` : ''}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="merge-file-section">
            <h4 className="merge-section-title">ローカルの .mm / .md ファイルから合流</h4>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mm,.xml,.md,.txt"
              style={{ display: 'none' }}
              onChange={handleWebFileChange}
            />
            <button
              type="button"
              className="toolbar-btn secondary"
              onClick={() => {
                if (isElectron && window.electronAPI?.openMmFile) {
                  void handlePickElectronFile();
                } else {
                  fileInputRef.current?.click();
                }
              }}
            >
              <FolderOpen size={15} />
              <span>ファイルを選択して合流…</span>
            </button>
          </div>

          {fileError && (
            <div className="merge-error-box" role="alert">
              <AlertCircle size={15} />
              <span>ファイルの読み込みに失敗しました: {fileError}</span>
            </div>
          )}

          <label className="branch-checkbox-row">
            <input
              type="checkbox"
              checked={includeSourceRoot}
              onChange={e => setIncludeSourceRoot(e.target.checked)}
            />
            <span>取り込み元のルートノードを含めて子ブランチにする</span>
          </label>

          <p className="merge-undo-note">
            ※ 取り込み時にノードIDは自動で再採番され、Ctrl+Z で一括取り消しできます。
          </p>
        </div>

        <div className="branch-modal-footer">
          <button type="button" className="toolbar-btn secondary" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="button"
            className="toolbar-btn primary-action-btn"
            disabled={!selectedTabId}
            onClick={() => selectedTabId && onMergeFromTab(selectedTabId, includeSourceRoot)}
          >
            <GitMerge size={14} />
            <span>選択したタブを合流</span>
          </button>
        </div>
      </div>
    </div>
  );
};
