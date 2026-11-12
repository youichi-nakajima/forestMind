import { FreeMindMap } from './freemind';

export interface FreeMindSearchQuery {
  keyword: string;
  folderPath?: string;
  modifiedFrom?: string; // YYYY-MM-DD
  modifiedTo?: string;   // YYYY-MM-DD
  iconBuiltin?: string;
}

export interface FreeMindSearchResult {
  id: string;
  fileName: string;
  relativePath: string;
  nodeId: string;
  nodeText: string;
  breadcrumbPath: string;
  modifiedTime?: number;
  formattedModifiedTime: string;
  icons: string[];
  link?: string;
  map: FreeMindMap;
}

export interface ScannedFileItem {
  fileName: string;
  relativePath: string;
  xmlContent: string;
  map: FreeMindMap;
  fileSize: number;
}

