import React, { useEffect, useState } from 'react';
import { GitFork, Link2, Save, Layers, X } from 'lucide-react';
import type { FreeMindNode } from '../types/freemind';
import { countSubtreeNodes } from '../utils/branchOperations';
import { getNodePlainText } from '../utils/treeUtils';

interface BranchSplitModalProps {
  isOpen: boolean;
  branchNode: FreeMindNode | null;
  isElectron: boolean;
  hasSourceFilePath: boolean;
  onConfirmSplit: (options: {
    collapseToLinkNode: boolean;
    saveToDisk: boolean;
  }) => Promise<void> | void;
  onClose: () => void;
}

export const BranchSplitModal: React.FC<BranchSplitModalProps> = ({
  isOpen,
  branchNode,
  isElectron,
  hasSourceFilePath,
  onConfirmSplit,
  onClose,
}) => {
  const [collapseToLinkNode, setCollapseToLinkNode] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCollapseToLinkNode(true);
      setIsSubmitting(false);
    }
  }, [isOpen, branchNode?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !branchNode) return null;

  const branchTitle = getNodePlainText(branchNode) || '(無題ノード)';
  const totalNodes = countSubtreeNodes(branchNode);

  const handleRun = async (saveToDisk: boolean) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirmSplit({ collapseToLinkNode, saveToDisk });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !isSubmitting && onClose()}>
      <div
        className="modal-dialog branch-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="branch-split-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <GitFork size={19} className="modal-icon" />
            <h3 id="branch-split-title">ブランチを別マップへ株分け</h3>
          </div>
          <button
            type="button"
            className="panel-close-btn"
            aria-label="閉じる"
            title="閉じる"
            disabled={isSubmitting}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body branch-modal-body">
          <div className="branch-summary-card">
            <div className="branch-summary-label">株分け対象のブランチ</div>
            <div className="branch-summary-title">{branchTitle}</div>
            <div className="branch-summary-meta">
              合計 <strong>{totalNodes}</strong> ノード（直下の子ノード {branchNode.children.length} 件）
            </div>
          </div>

          <div className="branch-option-list">
            <label className={`branch-option-item ${collapseToLinkNode ? 'selected' : ''}`}>
              <input
                type="radio"
                name="split-collapse-mode"
                checked={collapseToLinkNode}
                onChange={() => setCollapseToLinkNode(true)}
              />
              <div>
                <strong>元ノードの子要素を整理し、リンクノードに置き換える（推奨）</strong>
                <p>元マップはすっきり保ち、このノードをクリックして新しいマップへ移動できます。</p>
              </div>
            </label>

            <label className={`branch-option-item ${!collapseToLinkNode ? 'selected' : ''}`}>
              <input
                type="radio"
                name="split-collapse-mode"
                checked={!collapseToLinkNode}
                onChange={() => setCollapseToLinkNode(false)}
              />
              <div>
                <strong>元ノードの子要素も残したままリンクを追加する</strong>
                <p>元マップ側に既存のサブツリーを残しつつ、別マップへの複製とリンクを作成します。</p>
              </div>
            </label>
          </div>

          <div className="branch-modal-note">
            <Link2 size={14} />
            <span>
              {isElectron
                ? hasSourceFilePath
                  ? '.mm として保存すると、元マップ側に相対パス LINK（FreeMind 1.0.1 標準互換）が自動設定されます。'
                  : '.mm として保存すると、元マップ側に保存先パスへの LINK が自動設定されます。'
                : '新しいタブとして独立マップを作成し、元ノードへ forest:// リンクを自動設定します。'}
            </span>
          </div>
        </div>

        <div className="branch-modal-footer">
          <button
            type="button"
            className="toolbar-btn secondary"
            disabled={isSubmitting}
            onClick={onClose}
          >
            キャンセル
          </button>

          {isElectron ? (
            <>
              <button
                type="button"
                className="toolbar-btn secondary"
                disabled={isSubmitting}
                onClick={() => void handleRun(false)}
              >
                <Layers size={14} />
                <span>保存せず新規タブへ株分け</span>
              </button>
              <button
                type="button"
                className="toolbar-btn primary-action-btn"
                disabled={isSubmitting}
                onClick={() => void handleRun(true)}
              >
                <Save size={14} />
                <span>保存先を選んで株分け (.mm)</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="toolbar-btn primary-action-btn"
              disabled={isSubmitting}
              onClick={() => void handleRun(false)}
            >
              <GitFork size={14} />
              <span>新しいタブへ株分け</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
