/**
 * FreeMind (.mm) Data Model Definition
 */

export type NodePosition = 'left' | 'right';
export type NodeStyle = 'fork' | 'bubble';
export type EdgeStyle = 'bezier' | 'linear' | 'sharp_linear' | 'sharp_bezier';

export interface FreeMindFont {
  name?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
}

export interface FreeMindEdge {
  color?: string;
  style?: EdgeStyle;
  width?: string | number;
}

export interface FreeMindCloud {
  color?: string;
}

export interface FreeMindIcon {
  builtin: string;
}

export interface FreeMindAttribute {
  name: string;
  value: string;
}

export interface FreeMindArrowLink {
  destination: string;
  color?: string;
  startArrow?: string;
  endArrow?: string;
}

export interface FreeMindHook {
  name: string;
  params?: Record<string, string>;
  content?: string;
}

export interface FreeMindNode {
  id: string;
  text: string;
  htmlContent?: string; // Richcontent type="NODE"
  noteHtml?: string;    // Richcontent type="NOTE"
  folded?: boolean;
  position?: NodePosition;
  color?: string;
  backgroundColor?: string;
  style?: NodeStyle;
  link?: string;
  created?: number;
  modified?: number;
  
  font?: FreeMindFont;
  edge?: FreeMindEdge;
  cloud?: FreeMindCloud;
  icons: FreeMindIcon[];
  attributes: FreeMindAttribute[];
  arrowLinks: FreeMindArrowLink[];
  hooks: FreeMindHook[];
  
  // Unknown / passthrough XML attributes for lossless round-trip
  extraAttributes?: Record<string, string>;

  children: FreeMindNode[];
}

export interface FreeMindMap {
  version: string;
  root: FreeMindNode;
  extraAttributes?: Record<string, string>;
}

