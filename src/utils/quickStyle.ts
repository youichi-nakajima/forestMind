import type { FreeMindNode } from '../types/freemind';

export interface QuickColorPreset {
  id: string;
  key: '1' | '2' | '3' | '4' | '5' | '6';
  label: string;
  bg: string;
  color: string;
  darkBg: string;
  darkColor: string;
  darkBorder: string;
}

export const QUICK_COLOR_PRESETS: readonly QuickColorPreset[] = [
  {
    id: 'rose',
    key: '1',
    label: '重要',
    bg: '#fee2e2',
    color: '#7f1d1d',
    darkBg: '#4c1d24',
    darkColor: '#fecaca',
    darkBorder: '#f87171',
  },
  {
    id: 'amber',
    key: '2',
    label: '注意',
    bg: '#fef3c7',
    color: '#78350f',
    darkBg: '#451a03',
    darkColor: '#fde68a',
    darkBorder: '#fbbf24',
  },
  {
    id: 'emerald',
    key: '3',
    label: '完了',
    bg: '#dcfce7',
    color: '#064e3b',
    darkBg: '#064e3b',
    darkColor: '#a7f3d0',
    darkBorder: '#34d399',
  },
  {
    id: 'sky',
    key: '4',
    label: '情報',
    bg: '#e0f2fe',
    color: '#0c4a6e',
    darkBg: '#0c4a6e',
    darkColor: '#bae6fd',
    darkBorder: '#38bdf8',
  },
  {
    id: 'violet',
    key: '5',
    label: 'アイデア',
    bg: '#ede9fe',
    color: '#5b21b6',
    darkBg: '#3b0764',
    darkColor: '#ddd6fe',
    darkBorder: '#a78bfa',
  },
  {
    id: 'slate',
    key: '6',
    label: '保留',
    bg: '#e2e8f0',
    color: '#1e293b',
    darkBg: '#334155',
    darkColor: '#f1f5f9',
    darkBorder: '#94a3b8',
  },
] as const;

export interface NodeIconDefinition {
  builtin: string;
  emoji: string;
  label: string;
  key?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
}

export type QuickIconPreset = NodeIconDefinition & {
  key: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
};

export const NODE_ICONS: readonly NodeIconDefinition[] = [
  { key: '1', builtin: 'button_ok', emoji: '✅', label: '完了' },
  { key: '2', builtin: 'button_cancel', emoji: '❌', label: '却下' },
  { key: '3', builtin: 'flag', emoji: '🚩', label: '重要' },
  { key: '4', builtin: 'star', emoji: '⭐', label: '注目' },
  { key: '5', builtin: 'idea', emoji: '💡', label: 'アイデア' },
  { key: '6', builtin: 'launch', emoji: '🚀', label: '進行' },
  { key: '7', builtin: 'help', emoji: '❓', label: '疑問' },
  { key: '8', builtin: 'pencil', emoji: '✏️', label: '要編集' },
  { key: '9', builtin: 'bookmark', emoji: '🔖', label: 'ブックマーク' },
  { builtin: 'clanbomber', emoji: '🌲', label: '森' },
  { builtin: 'folder', emoji: '📁', label: 'フォルダ' },
  { builtin: 'attach', emoji: '📎', label: '添付' },
] as const;

export const QUICK_ICON_PRESETS: readonly QuickIconPreset[] = NODE_ICONS.filter(
  (ic): ic is QuickIconPreset => ic.key !== undefined
);

export type AttributeTone = 'rose' | 'amber' | 'emerald' | 'sky' | 'violet' | 'slate';

export interface QuickAttributeOption {
  value: string;
  tone: AttributeTone;
}

export interface QuickAttributeGroup {
  name: string;
  options: readonly QuickAttributeOption[];
}

export const QUICK_ATTRIBUTE_GROUPS: readonly QuickAttributeGroup[] = [
  {
    name: '優先度',
    options: [
      { value: '高', tone: 'rose' },
      { value: '中', tone: 'amber' },
      { value: '低', tone: 'sky' },
    ],
  },
  {
    name: 'ステータス',
    options: [
      { value: '未着手', tone: 'slate' },
      { value: '進行中', tone: 'sky' },
      { value: '確認待ち', tone: 'amber' },
      { value: '完了', tone: 'emerald' },
    ],
  },
] as const;

/** Parses #RRGGBB or #RGB hex strings into 0-255 RGB channels. */
export function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim();
  const shortMatch = normalized.match(/^#([0-9a-f]{3})$/i);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('').map(ch => parseInt(ch + ch, 16));
    return { r, g, b };
  }
  const fullMatch = normalized.match(/^#([0-9a-f]{6})$/i);
  if (fullMatch) {
    const raw = fullMatch[1];
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    };
  }
  return null;
}

/** Computes WCAG 2.x relative luminance in [0, 1] for a hex color. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHexRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(channel => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Computes WCAG 2.x contrast ratio between two hex colors. */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (bright + 0.05) / (dark + 0.05);
}

/** Finds the quick color preset matching a node's FreeMind COLOR / BACKGROUND_COLOR. */
export function findMatchingColorPreset(
  node: Pick<FreeMindNode, 'color' | 'backgroundColor'>
): QuickColorPreset | undefined {
  if (!node.backgroundColor) return undefined;
  const bgLower = node.backgroundColor.trim().toLowerCase();
  const colorLower = node.color?.trim().toLowerCase();
  return QUICK_COLOR_PRESETS.find(
    p =>
      p.bg.toLowerCase() === bgLower &&
      (!colorLower || p.color.toLowerCase() === colorLower)
  );
}

/**
 * Resolves display colors for rendering/exporting while keeping saved XML in FreeMind light colors.
 */
export function resolveNodeDisplayColors(
  node: Pick<FreeMindNode, 'color' | 'backgroundColor'>,
  isDarkMode: boolean
): { color?: string; backgroundColor?: string; borderColor?: string } {
  const matchedPreset = findMatchingColorPreset(node);

  if (isDarkMode) {
    if (matchedPreset) {
      return {
        backgroundColor: matchedPreset.darkBg,
        color: matchedPreset.darkColor,
        borderColor: matchedPreset.darkBorder,
      };
    }

    if (node.backgroundColor) {
      let textColor = node.color;
      if (!textColor && parseHexRgb(node.backgroundColor)) {
        textColor = relativeLuminance(node.backgroundColor) > 0.35 ? '#0f172a' : '#f8fafc';
      }
      return {
        backgroundColor: node.backgroundColor,
        color: textColor,
      };
    }

    if (node.color && parseHexRgb(node.color) && contrastRatio(node.color, '#111827') < 3) {
      return { color: '#e2e8f0' };
    }

    return { color: node.color };
  }

  if (node.backgroundColor && !node.color && parseHexRgb(node.backgroundColor)) {
    return {
      backgroundColor: node.backgroundColor,
      color: relativeLuminance(node.backgroundColor) > 0.35 ? '#0f172a' : '#f8fafc',
    };
  }

  return {
    color: node.color,
    backgroundColor: node.backgroundColor,
  };
}

function isExactPresetMatch(
  node: Pick<FreeMindNode, 'color' | 'backgroundColor'>,
  preset: QuickColorPreset
): boolean {
  return (
    node.backgroundColor?.trim().toLowerCase() === preset.bg.toLowerCase() &&
    node.color?.trim().toLowerCase() === preset.color.toLowerCase()
  );
}

/** Applies a quick color preset to target nodes, or clears it if all already match. */
export function applyQuickColorToNodes(
  nodes: FreeMindNode[],
  preset: QuickColorPreset
): boolean {
  if (nodes.length === 0) return false;
  const allMatch = nodes.every(n => isExactPresetMatch(n, preset));
  if (allMatch) {
    for (const node of nodes) {
      node.backgroundColor = undefined;
      node.color = undefined;
    }
    return true;
  }
  for (const node of nodes) {
    node.backgroundColor = preset.bg;
    node.color = preset.color;
  }
  return true;
}

/** Clears COLOR and BACKGROUND_COLOR on target nodes. */
export function clearColorOnNodes(nodes: FreeMindNode[]): boolean {
  let changed = false;
  for (const node of nodes) {
    if (node.color !== undefined || node.backgroundColor !== undefined) {
      node.color = undefined;
      node.backgroundColor = undefined;
      changed = true;
    }
  }
  return changed;
}

/** Toggles a FreeMind BUILTIN icon across target nodes. */
export function toggleIconOnNodes(nodes: FreeMindNode[], builtin: string): boolean {
  if (nodes.length === 0) return false;
  const allHave = nodes.every(n => n.icons.some(ic => ic.builtin === builtin));
  if (allHave) {
    for (const node of nodes) {
      node.icons = node.icons.filter(ic => ic.builtin !== builtin);
    }
    return true;
  }
  for (const node of nodes) {
    if (!node.icons.some(ic => ic.builtin === builtin)) {
      node.icons = [...node.icons, { builtin }];
    }
  }
  return true;
}

/** Removes all icons from target nodes. */
export function clearIconsOnNodes(nodes: FreeMindNode[]): boolean {
  let changed = false;
  for (const node of nodes) {
    if (node.icons.length > 0) {
      node.icons = [];
      changed = true;
    }
  }
  return changed;
}

/** Toggles or replaces a named FreeMind attribute across target nodes. */
export function toggleAttributeOnNodes(
  nodes: FreeMindNode[],
  name: string,
  value: string
): boolean {
  if (nodes.length === 0) return false;
  const allMatch = nodes.every(n =>
    n.attributes.some(attr => attr.name === name && attr.value === value)
  );

  if (allMatch) {
    for (const node of nodes) {
      node.attributes = node.attributes.filter(
        attr => !(attr.name === name && attr.value === value)
      );
    }
    return true;
  }

  for (const node of nodes) {
    const remaining = node.attributes.filter(attr => attr.name !== name);
    const existingIdx = node.attributes.findIndex(attr => attr.name === name);
    if (existingIdx !== -1) {
      const next = [...node.attributes];
      next[existingIdx] = { name, value };
      // Deduplicate any additional entries with the same attribute name
      let seen = false;
      node.attributes = next.filter(attr => {
        if (attr.name !== name) return true;
        if (seen) return false;
        seen = true;
        return true;
      });
    } else {
      node.attributes = [...remaining, { name, value }];
    }
  }
  return true;
}

/** Resolves attribute tone for compact canvas tag styling. */
export function getAttributeTone(name: string, value: string): AttributeTone {
  const group = QUICK_ATTRIBUTE_GROUPS.find(g => g.name === name);
  const option = group?.options.find(o => o.value === value);
  return option?.tone ?? 'slate';
}

/** Extracts 0-9 digit from keyboard event independent of Alt/Shift symbol layout. */
export function getDigitFromKeyboardEvent(
  e: Pick<KeyboardEvent, 'code' | 'key'>
): string | null {
  const codeMatch = e.code?.match(/^(?:Digit|Numpad)([0-9])$/);
  if (codeMatch) return codeMatch[1];
  if (/^[0-9]$/.test(e.key)) return e.key;
  return null;
}
