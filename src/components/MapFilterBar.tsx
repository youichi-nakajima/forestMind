import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eraser,
  Filter,
  Palette,
  Smile,
  Tag,
  X,
} from 'lucide-react';
import {
  NODE_ICONS,
  QUICK_ATTRIBUTE_GROUPS,
  QUICK_COLOR_PRESETS,
} from '../utils/quickStyle';
import {
  isMapFilterActive,
  type MapFilterCriteria,
} from '../utils/mapFilter';

interface MapFilterBarProps {
  isOpen: boolean;
  criteria: MapFilterCriteria;
  matchedCount: number;
  currentMatchIndex: number;
  isDarkMode: boolean;
  onToggleColor: (presetId: string) => void;
  onToggleIcon: (builtin: string) => void;
  onToggleAttribute: (name: string, value: string) => void;
  onPrevMatch: () => void;
  onNextMatch: () => void;
  onClear: () => void;
  onClose: () => void;
}

export const MapFilterBar: React.FC<MapFilterBarProps> = ({
  isOpen,
  criteria,
  matchedCount,
  currentMatchIndex,
  isDarkMode,
  onToggleColor,
  onToggleIcon,
  onToggleAttribute,
  onPrevMatch,
  onNextMatch,
  onClear,
  onClose,
}) => {
  if (!isOpen) return null;

  const active = isMapFilterActive(criteria);
  const summaryLabel = !active
    ? '条件を選択'
    : matchedCount === 0
      ? '0 件一致'
      : `${Math.min(currentMatchIndex, matchedCount - 1) + 1}/${matchedCount} 件一致`;

  return (
    <div
      className="map-filter-bar"
      role="region"
      aria-label="マップ内フィルタ"
      onMouseDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <div className="map-filter-header">
        <div className="map-filter-title">
          <Filter size={14} className="map-filter-icon" />
          <span>マップ内フィルタ</span>
          <span className={`map-filter-count ${active ? 'active' : ''}`}>
            {summaryLabel}
          </span>
        </div>

        <div className="map-filter-actions">
          <button
            type="button"
            className="map-filter-nav-btn"
            disabled={!active || matchedCount === 0}
            title="前の一致へ"
            aria-label="前の一致へ"
            onClick={onPrevMatch}
          >
            <ChevronUp size={13} />
          </button>
          <button
            type="button"
            className="map-filter-nav-btn"
            disabled={!active || matchedCount === 0}
            title="次の一致へ"
            aria-label="次の一致へ"
            onClick={onNextMatch}
          >
            <ChevronDown size={13} />
          </button>
          <button
            type="button"
            className="quick-clear-btn"
            disabled={!active}
            title="フィルタをクリア (Esc)"
            onClick={onClear}
          >
            <Eraser size={12} />
            <span>クリア</span>
          </button>
          <button
            type="button"
            className="quick-palette-close"
            aria-label="フィルタを閉じる"
            title="フィルタを閉じる (Esc)"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Colors Row */}
      <div className="map-filter-row">
        <span className="quick-palette-row-label">
          <Palette size={12} />
          <span>配色</span>
        </span>
        <div className="quick-palette-items">
          {QUICK_COLOR_PRESETS.map(preset => {
            const isSelected = criteria.colorPresetIds.includes(preset.id);
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isSelected}
                className={`quick-color-btn map-filter-chip ${isSelected ? 'active' : ''}`}
                style={{
                  backgroundColor: isDarkMode ? preset.darkBg : preset.bg,
                  color: isDarkMode ? preset.darkColor : preset.color,
                  borderColor: isDarkMode ? preset.darkBorder : preset.color,
                }}
                title={`配色で絞り込み: ${preset.label}`}
                onClick={() => onToggleColor(preset.id)}
              >
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Icons Row */}
      <div className="map-filter-row">
        <span className="quick-palette-row-label">
          <Smile size={12} />
          <span>アイコン</span>
        </span>
        <div className="quick-palette-items">
          {NODE_ICONS.map(ic => {
            const isSelected = criteria.iconBuiltins.includes(ic.builtin);
            return (
              <button
                key={ic.builtin}
                type="button"
                aria-label={`${ic.label} (${ic.builtin})`}
                aria-pressed={isSelected}
                className={`quick-icon-btn map-filter-chip ${isSelected ? 'active' : ''}`}
                title={`アイコンで絞り込み: ${ic.label}`}
                onClick={() => onToggleIcon(ic.builtin)}
              >
                <span className="quick-icon-emoji">{ic.emoji}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Attributes Row */}
      <div className="map-filter-row">
        <span className="quick-palette-row-label">
          <Tag size={12} />
          <span>属性</span>
        </span>
        <div className="quick-palette-items quick-attr-groups">
          {QUICK_ATTRIBUTE_GROUPS.map(group => (
            <div key={group.name} className="quick-attr-group">
              <span className="quick-attr-group-name">{group.name}:</span>
              {group.options.map(option => {
                const isSelected = criteria.attributes.some(
                  a => a.name === group.name && a.value === option.value
                );
                return (
                  <button
                    key={`${group.name}:${option.value}`}
                    type="button"
                    aria-pressed={isSelected}
                    className={`quick-attr-btn tone-${option.tone} map-filter-chip ${
                      isSelected ? 'active' : ''
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
