import React, { useState } from 'react';
import { FreeMindNode, NodeStyle, FreeMindMap } from '../types/freemind';
import { CLOUD_PALETTE } from '../utils/layout';
import { noteHtmlToPlainText, plainTextToNoteHtml } from '../utils/noteRenderer';
import {
  Palette,
  Type,
  Link as LinkIcon,
  FileText,
  Tag,
  Smile,
  X,
  Plus,
  Trash2,
  Cloud,
  MoveRight,
} from 'lucide-react';

interface NodePropertiesPanelProps {
  node: FreeMindNode | null;
  map: FreeMindMap;
  currentFilePath?: string;
  onUpdate: (patch: Partial<FreeMindNode>) => void;
  onClose: () => void;
}

const AVAILABLE_ICONS = [
  { id: 'button_ok', emoji: '✅', label: 'OK' },
  { id: 'button_cancel', emoji: '❌', label: 'Cancel' },
  { id: 'flag', emoji: '🚩', label: 'Flag' },
  { id: 'star', emoji: '⭐', label: 'Star' },
  { id: 'idea', emoji: '💡', label: 'Idea' },
  { id: 'launch', emoji: '🚀', label: 'Launch' },
  { id: 'pencil', emoji: '✏️', label: 'Edit' },
  { id: 'clanbomber', emoji: '🌲', label: 'Forest' },
  { id: 'folder', emoji: '📁', label: 'Folder' },
  { id: 'help', emoji: '❓', label: 'Question' },
  { id: 'bookmark', emoji: '🔖', label: 'Bookmark' },
  { id: 'attach', emoji: '📎', label: 'Attach' },
];

export const NodePropertiesPanel: React.FC<NodePropertiesPanelProps> = ({
  node,
  map,
  currentFilePath,
  onUpdate,
  onClose,
}) => {
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');
  const [selectedDestId, setSelectedDestId] = useState('');

  if (!node) return null;

  // Flatten all nodes for ArrowLink destination picker
  const allOtherNodes: { id: string; text: string }[] = [];
  function collectNodes(n: FreeMindNode) {
    if (n.id !== node?.id) {
      allOtherNodes.push({ id: n.id, text: n.text || '(無題ノード)' });
    }
    for (const c of n.children) collectNodes(c);
  }
  collectNodes(map.root);

  const ancestorCloudCount = Math.max(0, countAncestorClouds(map.root, node.id));

  const handleToggleIcon = (iconId: string) => {
    const existing = node.icons.some(i => i.builtin === iconId);
    let newIcons = [...node.icons];
    if (existing) {
      newIcons = newIcons.filter(i => i.builtin !== iconId);
    } else {
      newIcons.push({ builtin: iconId });
    }
    onUpdate({ icons: newIcons });
  };

  const handleAddAttribute = () => {
    if (!newAttrName.trim()) return;
    const newAttrs = [...node.attributes, { name: newAttrName.trim(), value: newAttrValue.trim() }];
    onUpdate({ attributes: newAttrs });
    setNewAttrName('');
    setNewAttrValue('');
  };

  const handleDeleteAttribute = (index: number) => {
    const newAttrs = node.attributes.filter((_, i) => i !== index);
    onUpdate({ attributes: newAttrs });
  };

  return (
    <aside className="properties-panel">
      <div className="panel-header">
        <h3>ノードプロパティ</h3>
        <button className="panel-close-btn" onClick={onClose} title="閉じる">
          <X size={16} />
        </button>
      </div>

      <div className="panel-content">
        {/* Text */}
        <div className="form-group">
          <label className="form-label">
            <Type size={14} />
            <span>テキスト</span>
          </label>
          <input
            type="text"
            className="form-input"
            value={node.text}
            onChange={e => onUpdate({ text: e.target.value })}
          />
        </div>

        {/* Style */}
        <div className="form-group">
          <label className="form-label">
            <Palette size={14} />
            <span>ノードスタイル</span>
          </label>
          <div className="style-segmented-control">
            <button
              className={`segment-btn ${node.style !== 'bubble' ? 'active' : ''}`}
              onClick={() => onUpdate({ style: 'fork' as NodeStyle })}
            >
              Fork (下線)
            </button>
            <button
              className={`segment-btn ${node.style === 'bubble' ? 'active' : ''}`}
              onClick={() => onUpdate({ style: 'bubble' as NodeStyle })}
            >
              Bubble (枠線)
            </button>
          </div>
        </div>

        {/* Colors */}
        <div className="form-row">
          <div className="form-group half">
            <label className="form-label">文字色</label>
            <div className="color-picker-row">
              <input
                type="color"
                className="color-picker-input"
                value={node.color || '#2d3748'}
                onChange={e => onUpdate({ color: e.target.value })}
              />
              <span className="color-value">{node.color || '#2d3748'}</span>
            </div>
          </div>
          <div className="form-group half">
            <label className="form-label">背景色</label>
            <div className="color-picker-row">
              <input
                type="color"
                className="color-picker-input"
                value={node.backgroundColor || '#ffffff'}
                onChange={e => onUpdate({ backgroundColor: e.target.value })}
              />
              {node.backgroundColor && (
                <button
                  className="color-clear-btn"
                  onClick={() => onUpdate({ backgroundColor: undefined })}
                  title="背景色をクリア"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Font */}
        <div className="form-row">
          <div className="form-group half">
            <label className="form-label">フォントサイズ</label>
            <input
              type="number"
              className="form-input"
              min={10}
              max={36}
              value={node.font?.size || 14}
              onChange={e =>
                onUpdate({
                  font: { ...node.font, size: Number(e.target.value) },
                })
              }
            />
          </div>
          <div className="form-group half">
            <label className="form-label">装飾</label>
            <div className="font-style-toggles">
              <button
                className={`toggle-btn ${node.font?.bold ? 'active' : ''}`}
                onClick={() =>
                  onUpdate({
                    font: { ...node.font, bold: !node.font?.bold },
                  })
                }
              >
                <b>B</b>
              </button>
              <button
                className={`toggle-btn ${node.font?.italic ? 'active' : ''}`}
                onClick={() =>
                  onUpdate({
                    font: { ...node.font, italic: !node.font?.italic },
                  })
                }
              >
                <i>I</i>
              </button>
            </div>
          </div>
        </div>

        {/* Link */}
        <div className="form-group">
          <label className="form-label">
            <LinkIcon size={14} />
            <span>リンク (URL / パス)</span>
          </label>
          <div className="add-attribute-row">
            <input
              type="text"
              className="form-input attr-input"
              placeholder="https://... または ./submap.mm"
              value={node.link || ''}
              onChange={e => onUpdate({ link: e.target.value || undefined })}
            />
            {window.electronAPI && (
              <button
                type="button"
                className="add-attr-btn"
                title="別の .mm ファイルを選択してリンク"
                onClick={async () => {
                  const res = await window.electronAPI?.pickTargetMmFile(currentFilePath);
                  if (res?.linkValue) {
                    onUpdate({ link: res.linkValue });
                  }
                }}
              >
                .mm参照
              </button>
            )}
          </div>
        </div>

        {/* Note (HTML / text) */}
        <div className="form-group">
          <label className="form-label">
            <FileText size={14} />
            <span>詳細ノート</span>
          </label>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="ノードの詳細説明やメモ..."
            value={noteHtmlToPlainText(node.noteHtml)}
            onChange={e =>
              onUpdate({
                noteHtml: plainTextToNoteHtml(e.target.value),
              })
            }
          />
        </div>

        {/* Cloud (囲み枠) */}
        <div className="form-group">
          <label className="form-label">
            <Cloud size={14} />
            <span>クラウド (囲み枠)</span>
          </label>
          <div className="color-picker-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(node.cloud)}
                onChange={e => {
                  if (e.target.checked) {
                    const defaultColor = CLOUD_PALETTE[ancestorCloudCount % CLOUD_PALETTE.length];
                    onUpdate({ cloud: { color: defaultColor } });
                  } else {
                    onUpdate({ cloud: undefined });
                  }
                }}
              />
              <span>有効</span>
            </label>
            {node.cloud && (
              <input
                type="color"
                className="color-picker-input"
                value={node.cloud.color || CLOUD_PALETTE[0]}
                onChange={e => onUpdate({ cloud: { color: e.target.value } })}
              />
            )}
          </div>
          {node.cloud && (
            <div className="cloud-color-swatches">
              {CLOUD_PALETTE.map(swatchColor => {
                const isActive =
                  (node.cloud?.color || CLOUD_PALETTE[0]).toLowerCase() === swatchColor.toLowerCase();
                return (
                  <button
                    key={swatchColor}
                    type="button"
                    className={`cloud-swatch-btn ${isActive ? 'active' : ''}`}
                    style={{ backgroundColor: swatchColor }}
                    title={swatchColor}
                    onClick={() => onUpdate({ cloud: { color: swatchColor } })}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Arrow Links (関連矢印) */}
        <div className="form-group">
          <label className="form-label">
            <MoveRight size={14} />
            <span>矢印リンク (関連線)</span>
          </label>
          {node.arrowLinks.length > 0 && (
            <div className="attributes-table">
              {node.arrowLinks.map((al, idx) => {
                const targetText = allOtherNodes.find(n => n.id === al.destination)?.text || al.destination;
                return (
                  <div key={idx} className="attribute-row">
                    <span className="attr-name">➔ {targetText}</span>
                    <button
                      className="attr-delete-btn"
                      onClick={() => {
                        const newLinks = node.arrowLinks.filter((_, i) => i !== idx);
                        onUpdate({ arrowLinks: newLinks });
                      }}
                      title="矢印削除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="add-attribute-row">
            <select
              className="form-input attr-input"
              value={selectedDestId}
              onChange={e => setSelectedDestId(e.target.value)}
            >
              <option value="">接続先ノードを選択...</option>
              {allOtherNodes.map(n => (
                <option key={n.id} value={n.id}>
                  {n.text}
                </option>
              ))}
            </select>
            <button
              className="add-attr-btn"
              disabled={!selectedDestId}
              onClick={() => {
                if (!selectedDestId) return;
                const newLinks = [
                  ...node.arrowLinks,
                  { destination: selectedDestId, color: '#e11d48' },
                ];
                onUpdate({ arrowLinks: newLinks });
                setSelectedDestId('');
              }}
              title="矢印リンク追加"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Icons Picker */}
        <div className="form-group">
          <label className="form-label">
            <Smile size={14} />
            <span>アイコン</span>
          </label>
          <div className="icons-palette">
            {AVAILABLE_ICONS.map(ic => {
              const active = node.icons.some(i => i.builtin === ic.id);
              return (
                <button
                  key={ic.id}
                  className={`icon-palette-btn ${active ? 'active' : ''}`}
                  title={ic.label}
                  onClick={() => handleToggleIcon(ic.id)}
                >
                  <span>{ic.emoji}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Attributes Table */}
        <div className="form-group">
          <label className="form-label">
            <Tag size={14} />
            <span>属性 (Attributes)</span>
          </label>
          {node.attributes.length > 0 && (
            <div className="attributes-table">
              {node.attributes.map((attr, idx) => (
                <div key={idx} className="attribute-row">
                  <span className="attr-name">{attr.name}</span>
                  <span className="attr-sep">:</span>
                  <span className="attr-value">{attr.value}</span>
                  <button
                    className="attr-delete-btn"
                    onClick={() => handleDeleteAttribute(idx)}
                    title="属性削除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="add-attribute-row">
            <input
              type="text"
              placeholder="属性名"
              className="form-input attr-input"
              value={newAttrName}
              onChange={e => setNewAttrName(e.target.value)}
            />
            <input
              type="text"
              placeholder="値"
              className="form-input attr-input"
              value={newAttrValue}
              onChange={e => setNewAttrValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddAttribute();
              }}
            />
            <button
              className="add-attr-btn"
              onClick={handleAddAttribute}
              title="属性追加"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

function countAncestorClouds(curr: FreeMindNode, targetId: string, cloudCount = 0): number {
  if (curr.id === targetId) return cloudCount;
  const nextCount = curr.cloud ? cloudCount + 1 : cloudCount;
  for (const child of curr.children) {
    const found = countAncestorClouds(child, targetId, nextCount);
    if (found !== -1) return found;
  }
  return -1;
}

