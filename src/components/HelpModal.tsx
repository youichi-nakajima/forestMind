import React from 'react';
import { X, Keyboard, Sparkles } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    category: 'ノード作成・編集',
    items: [
      { key: 'Tab / Insert', desc: '子ノードを追加' },
      { key: 'Enter', desc: '兄弟ノードを追加' },
      { key: 'Ctrl + C / X / V', desc: 'コピー / カット / 貼り付け（Markdown対応）' },
      { key: 'Ctrl + D', desc: '選択ノードを複製 (Duplicate)' },
      { key: 'Alt + ↑ / ↓', desc: '兄弟ノードの順番を上下に入れ替え' },
      { key: 'F2 / ダブルクリック', desc: 'インラインテキスト編集' },
      { key: 'Esc (新規作成直後)', desc: '作成した新規ノードを削除してキャンセル' },
      { key: 'Delete / Backspace', desc: '選択ノードを削除' },
      { key: 'ドラッグ＆ドロップ', desc: 'ノードを別の親ノードへ移動' },
    ],
  },
  {
    category: 'ナビゲーション & 開閉',
    items: [
      { key: '↑ / ↓', desc: '兄弟ノード間を移動' },
      { key: '→', desc: '右の子ノードへ移動（左ブランチ時は親へ）' },
      { key: '←', desc: '左の子ノードへ移動（右ブランチ時は親へ）' },
      { key: 'Space / ○アイコン', desc: 'ノードの展開 / 折りたたみを切り替え' },
      { key: 'ドラッグ (背景)', desc: 'キャンバスをスクロール・移動' },
      { key: 'マウスホイール', desc: 'キャンバスを拡大 / 縮小' },
    ],
  },
  {
    category: 'クイック色分け・アイコン・タグ',
    items: [
      { key: '1 〜 6', desc: 'クイックカラーを適用 / 解除（トグル）' },
      { key: '0', desc: '選択ノードの配色をクリア' },
      { key: 'Alt + 1 〜 9', desc: 'FreeMind 組み込みアイコンをトグル' },
      { key: 'Alt + 0', desc: '選択ノードのアイコンをすべてクリア' },
      { key: 'Q / Ctrl + K', desc: 'クイック装飾パレットの表示 / 非表示' },
      { key: 'Ctrl + クリック', desc: '複数ノードを追加選択 / 選択解除' },
    ],
  },
  {
    category: '履歴 & 検索',
    items: [
      { key: 'Ctrl + Z', desc: '元に戻す (Undo)' },
      { key: 'Ctrl + Y', desc: 'やり直し (Redo)' },
      { key: 'Ctrl + F', desc: 'マップ内検索バーにフォーカス' },
      { key: 'Enter (検索中)', desc: '次の一致ノードへジャンプ' },
      { key: 'Shift + Enter', desc: '前の一致ノードへジャンプ' },
    ],
  },
  {
    category: '思考再生 & プレゼンテーション',
    items: [
      { key: 'F5', desc: 'プレゼンテーション再生の開始 / 終了' },
      { key: 'Space', desc: '再生 / 一時停止の切り替え' },
      { key: '→ / ↓', desc: '次の思考ステップへ進む' },
      { key: '← / ↑', desc: '前の思考ステップへ戻る' },
      { key: 'Home', desc: '最初のステップにリセット' },
      { key: 'F', desc: 'シネマ全画面モードの切り替え' },
      { key: 'L', desc: 'スポットライト（現在パス強調）の切り替え' },
      { key: 'C', desc: '自動カメラ追従の切り替え' },
      { key: 'M', desc: '効果音のミュート切り替え' },
      { key: 'Esc', desc: 'プレゼンテーション / 全画面を終了' },
    ],
  },
];

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Keyboard size={20} className="modal-icon" />
            <h3>キーボードショートカット & 操作ガイド</h3>
          </div>
          <button className="panel-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="shortcuts-grid">
            {SHORTCUT_GROUPS.map((group, idx) => (
              <div key={idx} className="shortcut-group-card">
                <h4>{group.category}</h4>
                <div className="shortcut-list">
                  {group.items.map((item, i) => (
                    <div key={i} className="shortcut-row">
                      <kbd>{item.key}</kbd>
                      <span>{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="help-tip-box">
            <Sparkles size={16} />
            <div>
              <strong>FreeMind 1.0.1 互換について:</strong>
              <p>
                「保存」でダウンロードされる <code>.mm</code> ファイルは、本家 FreeMind と同じく非ASCII文字を 16進数数値文字参照（<code>&amp;#xXXXX;</code>）で出力するため、既存の FreeMind や Freeplane でも文字化けなくそのまま開くことができます。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

