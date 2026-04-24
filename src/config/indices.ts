import type { SearchResult } from '../services/stockApi';
import indicesData from './indices.json';

export interface IndexItem {
  code: string;
  name: string;
}

const STORAGE_KEY = 'indicesList';

function loadIndicesList(): IndexItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return indicesData as IndexItem[];
}

export const LOCAL_INDEX_LIST: IndexItem[] = loadIndicesList();

export function saveIndicesList(indices: IndexItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(indices));
    const list = LOCAL_INDEX_LIST;
    list.length = 0;
    list.push(...indices);
  } catch (error) {
    console.error('Failed to save indices list:', error);
  }
}
