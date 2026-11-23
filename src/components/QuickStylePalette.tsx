import React from 'react';
import { Eraser, Palette, Smile, Tag, X } from 'lucide-react';
import type { FreeMindNode } from '../types/freemind';
import {
  findMatchingColorPreset,
  QUICK_ATTRIBUTE_GROUPS,
  QUICK_COLOR_PRESETS,
  QUICK_ICON_PRESETS,
  type QuickColorPreset,
} from '../utils/quickStyle';

interface QuickStylePaletteProps {
  isOpen: boolean;
  selectedNodes: FreeMindNode[];
  isDarkMode: boolean;
  onSelectColor: (preset: QuickColorPreset) => void;
  onClearColor: () => void;
  onToggleIcon: (builtin: string) => void;
  onClearIcons: () => void;
  onToggleAttribute: (name: string, value: string) => void;
  onClose: () => void;
}

export const QuickStylePalette: React.FC<QuickStylePaletteProps> = ({
  isOpen,
  selectedNodes,
  isDarkMode,
  onSelectColor,
  onClearColor,
  onToggleIcon,
  onClearIcons,
  onToggleAttribute,
  onClose,
}) => {
  if (!isOpen) return null;

  const hasSelection = selectedNodes.length > 0;
  const targetLabel =
    selectedNodes.length === 0
      ? 'ノードを選択してください'
      : selectedNodes.length === 1
        ? selectedNodes[0].text || '(無題ノード)'
        : `${selectedNodes.length}ノード選択中`;

  return (
    <div
      className="quick-style-palette"
      role="region"
      aria-label="クイック装飾パレット"
      onMouseDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <div className="quick-palette-header">
        <div className="quick-palette-title">
          <Palette size={14} className="quick-palette-icon" />
          <span className="quick-palette-target" title={targetLabel}>
            {targetLabel}
          </span>
        </div>
        <span className="quick-palette-hint">
          1-6 色 · Alt+1-9 アイコン · Ctrl+クリック 複数選択
        </span>
        <button
          type="button"
          className="quick-palette-close"
          aria-label="閉じる"
          title="パレットを閉じる (Esc)"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      {/* Colors Row */}
      <div className="quick-palette-row">
        <span className="quick-palette-row-label">
          <Palette size={12} />
          <span>配色</span>
        </span>
        <div className="quick-palette-items">
          {QUICK_COLOR_PRESETS.map(preset => {
            const isActive =
              hasSelection &&
              selectedNodes.every(n => findMatchingColorPreset(n)?.id === preset.id);
            return (
              <button
                key={preset.id}
                type="button"
                disabled={!hasSelection}
                className={`quick-color-btn ${isActive ? 'active' : ''}`}
                style={{
                  backgroundColor: isDarkMode ? preset.darkBg : preset.bg,
                  color: isDarkMode ? preset.darkColor : preset.color,
                  borderColor: isDarkMode ? preset.darkBorder : preset.color,
                }}
                title={`${preset.label} (キー: ${preset.key})`}
                onClick={() => onSelectColor(preset)}
              >
                <kbd className="quick-key-badge">{preset.key}</kbd>
                <span>{preset.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            disabled={!hasSelection}
            className="quick-clear-btn"
            aria-label="色をクリア"
            title="色をクリア (キー: 0)"
            onClick={onClearColor}
          >
            <Eraser size={12} />
            <span>0 クリア</span>
          </button>
        </div>
      </div>

      {/* Icons Row */}
      <div className="quick-palette-row">
        <span className="quick-palette-row-label">
          <Smile size={12} />
          <span>アイコン</span>
        </span>
        <div className="quick-palette-items">
          {QUICK_ICON_PRESETS.map(ic => {
            const hasAll =
              hasSelection &&
              selectedNodes.every(n => n.icons.some(item => item.builtin === ic.builtin));
            const hasSome =
              !hasAll &&
              hasSelection &&
              selectedNodes.some(n => n.icons.some(item => item.builtin === ic.builtin));
            return (
              <button
                key={ic.builtin}
                type="button"
                disabled={!hasSelection}
                className={`quick-icon-btn ${hasAll ? 'active' : hasSome ? 'partial' : ''}`}
                aria-label={`${ic.label} (${ic.builtin})`}
                title={`${ic.label} (Alt+${ic.key})`}
                onClick={() => onToggleIcon(ic.builtin)}
              >
                <span className="quick-icon-emoji">{ic.emoji}</span>
                <span className="quick-icon-key">{ic.key}</span>
              </button>
            );
          })}
          <button
            type="button"
            disabled={!hasSelection}
            className="quick-clear-btn"
            aria-label="アイコンをクリア"
            title="アイコンをすべてクリア (Alt+0)"
            onClick={onClearIcons}
          >
            <Eraser size={12} />
            <span>Alt+0</span>
          </button>
        </div>
      </div>

      {/* Attributes Row */}
      <div className="quick-palette-row">
        <span className="quick-palette-row-label">
          <Tag size={12} />
          <span>属性</span>
        </span>
        <div className="quick-palette-items quick-attr-groups">
          {QUICK_ATTRIBUTE_GROUPS.map(group => (
            <div key={group.name} className="quick-attr-group">
              <span className="quick-attr-group-name">{group.name}:</span>
              {group.options.map(option => {
                const hasAll =
                  hasSelection &&
                  selectedNodes.every(n =>
                    n.attributes.some(a => a.name === group.name && a.value === option.value)
                  );
                const hasSome =
                  !hasAll &&
                  hasSelection &&
                  selectedNodes.some(n =>
                    n.attributes.some(a => a.name === group.name && a.value === option.value)
                  );
                return (
                  <button
                    key={`${group.name}:${option.value}`}
                    type="button"
                    disabled={!hasSelection}
                    className={`quick-attr-btn tone-${option.tone} ${
                      hasAll ? 'active' : hasSome ? 'partial' : ''
                    }`}
                    title={`${group.name}: ${option.value}`}
                    onClick={() => onToggleAttribute(group.name, option.value)}
                  >
                    {option.value}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
