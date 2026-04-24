import type { SectorSkewData, SectorSkewHistory } from '../types/sector';

const STORAGE_KEY = 'sectorSkewScanData';
const HISTORY_STORAGE_KEY = 'sectorSkewHistory';

export async function loadSectorSkewData(): Promise<SectorSkewData | null> {
  try {
    const response = await fetch('/sector-skew-data.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: SectorSkewData = await response.json();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
    return data;
  } catch (error) {
    console.error('Failed to load sector skew data:', error);
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch { /* ignore */ }
    return null;
  }
}

export async function loadSectorSkewHistory(): Promise<SectorSkewHistory | null> {
  try {
    const response = await fetch('/sector-skew-history.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: SectorSkewHistory = await response.json();
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
    return data;
  } catch (error) {
    console.error('Failed to load sector skew history:', error);
    try {
      const cached = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }
    return null;
  }
}

export function getCachedSectorSkewData(): SectorSkewData | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* ignore */ }
  return null;
}

export async function loadSectorRotationData(): Promise<any | null> {
  try {
    const response = await fetch('/sector-rotation.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to load sector rotation data:', error);
    return null;
  }
}

export async function loadSectorMembersData(): Promise<any | null> {
  try {
    const response = await fetch('/sector-members-data.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to load sector members data:', error);
    return null;
  }
}

export async function loadSectorMultiCycleData(): Promise<any | null> {
  try {
    const response = await fetch('/sector-multi-cycle.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to load sector multi-cycle data:', error);
    return null;
  }
}
