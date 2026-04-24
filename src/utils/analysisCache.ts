import type { TimeFrame } from '../types/stock';

export interface VolumeProfileCacheEntry {
  code: string;
  timeFrame: string;
  dataRange: string;
  priceLevels: number;
  profile: { price: number; volume: number }[];
  stats: { poc: number; vah: number; val: number; totalVolume: number };
  cachedAt: number;
}

export interface VolatilityCacheEntry {
  code: string;
  timeFrame: string;
  dataRange: string;
  window: number;
  bbMultiplier: number;
  latestSkew: { upVolatility: number; downVolatility: number; volSkew: number };
  latestVolatility: number;
  latestAtr: number;
  cachedAt: number;
}

export interface CacheStatus {
  volumeProfile: Record<string, { cachedAt: number; size: number }>;
  volatility: Record<string, { cachedAt: number; size: number }>;
  pinnedProfiles: Record<string, { count: number; size: number }>;
  totalSize: number;
}

const VOLUME_PROFILE_CACHE_KEY = 'volumeProfileCache';
const VOLATILITY_CACHE_KEY = 'volatilityCache';
const PINNED_PROFILES_KEY = 'pinnedProfilesByStock';

function buildCacheKey(code: string, timeFrame: string, dataRange: string, params: Record<string, unknown>): string {
  return `${code}_${timeFrame}_${dataRange}_${JSON.stringify(params)}`;
}

function getStorageSize(): number {
  let total = 0;
  try {
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length * 2; // UTF-16 characters
      }
    }
  } catch { /* ignore */ }
  return total;
}

export function saveVolumeProfileCache(
  code: string,
  timeFrame: TimeFrame,
  dataRange: string,
  priceLevels: number,
  profile: { price: number; volume: number }[],
  stats: { poc: number; vah: number; val: number; totalVolume: number }
): void {
  try {
    const cache = JSON.parse(localStorage.getItem(VOLUME_PROFILE_CACHE_KEY) || '{}');
    const key = buildCacheKey(code, timeFrame, dataRange, { priceLevels });
    cache[key] = {
      code,
      timeFrame,
      dataRange,
      priceLevels,
      profile,
      stats,
      cachedAt: Date.now()
    };
    localStorage.setItem(VOLUME_PROFILE_CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

export function getVolumeProfileCache(
  code: string,
  timeFrame: TimeFrame,
  dataRange: string,
  priceLevels: number
): VolumeProfileCacheEntry | null {
  try {
    const cache = JSON.parse(localStorage.getItem(VOLUME_PROFILE_CACHE_KEY) || '{}');
    const key = buildCacheKey(code, timeFrame, dataRange, { priceLevels });
    return cache[key] || null;
  } catch {
    return null;
  }
}

export function clearVolumeProfileCache(code?: string): void {
  try {
    if (!code) {
      localStorage.removeItem(VOLUME_PROFILE_CACHE_KEY);
      return;
    }
    const cache = JSON.parse(localStorage.getItem(VOLUME_PROFILE_CACHE_KEY) || '{}');
    const keysToDelete = Object.keys(cache).filter(key => key.startsWith(`${code}_`));
    keysToDelete.forEach(key => delete cache[key]);
    localStorage.setItem(VOLUME_PROFILE_CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

export function saveVolatilityCache(
  code: string,
  timeFrame: TimeFrame,
  dataRange: string,
  window: number,
  bbMultiplier: number,
  latestSkew: { upVolatility: number; downVolatility: number; volSkew: number },
  latestVolatility: number,
  latestAtr: number
): void {
  try {
    const cache = JSON.parse(localStorage.getItem(VOLATILITY_CACHE_KEY) || '{}');
    const key = buildCacheKey(code, timeFrame, dataRange, { window, bbMultiplier });
    cache[key] = {
      code,
      timeFrame,
      dataRange,
      window,
      bbMultiplier,
      latestSkew,
      latestVolatility,
      latestAtr,
      cachedAt: Date.now()
    };
    localStorage.setItem(VOLATILITY_CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

export function getVolatilityCache(
  code: string,
  timeFrame: TimeFrame,
  dataRange: string,
  window: number,
  bbMultiplier: number
): VolatilityCacheEntry | null {
  try {
    const cache = JSON.parse(localStorage.getItem(VOLATILITY_CACHE_KEY) || '{}');
    const key = buildCacheKey(code, timeFrame, dataRange, { window, bbMultiplier });
    return cache[key] || null;
  } catch {
    return null;
  }
}

export function clearVolatilityCache(code?: string): void {
  try {
    if (!code) {
      localStorage.removeItem(VOLATILITY_CACHE_KEY);
      return;
    }
    const cache = JSON.parse(localStorage.getItem(VOLATILITY_CACHE_KEY) || '{}');
    const keysToDelete = Object.keys(cache).filter(key => key.startsWith(`${code}_`));
    keysToDelete.forEach(key => delete cache[key]);
    localStorage.setItem(VOLATILITY_CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

export function clearAllAnalysisCache(code?: string): void {
  clearVolumeProfileCache(code);
  clearVolatilityCache(code);
  // Also clear legacy skewCache if clearing all
  if (!code) {
    localStorage.removeItem('skewCache');
  } else {
    try {
      const skewCache = JSON.parse(localStorage.getItem('skewCache') || '{}');
      delete skewCache[code];
      localStorage.setItem('skewCache', JSON.stringify(skewCache));
    } catch { /* ignore */ }
  }
}

export function getCacheStatus(): CacheStatus {
  const volumeProfile: Record<string, { cachedAt: number; size: number }> = {};
  const volatility: Record<string, { cachedAt: number; size: number }> = {};
  const pinnedProfiles: Record<string, { count: number; size: number }> = {};

  try {
    const vpCache = JSON.parse(localStorage.getItem(VOLUME_PROFILE_CACHE_KEY) || '{}');
    for (const key in vpCache) {
      if (vpCache.hasOwnProperty(key)) {
        const entry = vpCache[key];
        volumeProfile[entry.code] = {
          cachedAt: entry.cachedAt,
          size: JSON.stringify(entry).length * 2
        };
      }
    }
  } catch { /* ignore */ }

  try {
    const volCache = JSON.parse(localStorage.getItem(VOLATILITY_CACHE_KEY) || '{}');
    for (const key in volCache) {
      if (volCache.hasOwnProperty(key)) {
        const entry = volCache[key];
        volatility[entry.code] = {
          cachedAt: entry.cachedAt,
          size: JSON.stringify(entry).length * 2
        };
      }
    }
  } catch { /* ignore */ }

  try {
    const ppCache = JSON.parse(localStorage.getItem(PINNED_PROFILES_KEY) || '{}');
    for (const code in ppCache) {
      if (ppCache.hasOwnProperty(code) && ppCache[code].length > 0) {
        pinnedProfiles[code] = {
          count: ppCache[code].length,
          size: JSON.stringify(ppCache[code]).length * 2
        };
      }
    }
  } catch { /* ignore */ }

  return {
    volumeProfile,
    volatility,
    pinnedProfiles,
    totalSize: getStorageSize()
  };
}

export function getCachedStocks(): string[] {
  const stocks = new Set<string>();
  try {
    const vpCache = JSON.parse(localStorage.getItem(VOLUME_PROFILE_CACHE_KEY) || '{}');
    for (const key in vpCache) {
      if (vpCache.hasOwnProperty(key)) {
        stocks.add(vpCache[key].code);
      }
    }
  } catch { /* ignore */ }

  try {
    const volCache = JSON.parse(localStorage.getItem(VOLATILITY_CACHE_KEY) || '{}');
    for (const key in volCache) {
      if (volCache.hasOwnProperty(key)) {
        stocks.add(volCache[key].code);
      }
    }
  } catch { /* ignore */ }

  return Array.from(stocks);
}

export interface PinnedProfile {
  id: string;
  range: { startIndex: number; endIndex: number };
  stats: { poc: number; vah: number; val: number; totalVolume: number };
  color: string;
}

function getAllPinnedProfiles(): Record<string, PinnedProfile[]> {
  try {
    return JSON.parse(localStorage.getItem(PINNED_PROFILES_KEY) || '{}');
  } catch {
    return {};
  }
}

export function getPinnedProfiles(code: string): PinnedProfile[] {
  try {
    const all = getAllPinnedProfiles();
    return all[code] || [];
  } catch {
    return [];
  }
}

export function savePinnedProfiles(code: string, profiles: PinnedProfile[]): void {
  try {
    const all = getAllPinnedProfiles();
    if (profiles.length === 0) {
      delete all[code];
    } else {
      all[code] = profiles;
    }
    localStorage.setItem(PINNED_PROFILES_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function addPinnedProfile(code: string, profile: PinnedProfile): void {
  try {
    const all = getAllPinnedProfiles();
    const profiles = all[code] || [];
    profiles.push(profile);
    all[code] = profiles;
    localStorage.setItem(PINNED_PROFILES_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function removePinnedProfile(code: string, id: string): void {
  try {
    const all = getAllPinnedProfiles();
    const profiles = all[code] || [];
    const filtered = profiles.filter(p => p.id !== id);
    if (filtered.length === 0) {
      delete all[code];
    } else {
      all[code] = filtered;
    }
    localStorage.setItem(PINNED_PROFILES_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function clearPinnedProfiles(code?: string): void {
  try {
    if (!code) {
      localStorage.removeItem(PINNED_PROFILES_KEY);
      return;
    }
    const all = getAllPinnedProfiles();
    delete all[code];
    localStorage.setItem(PINNED_PROFILES_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function getPinnedStocks(): string[] {
  try {
    const all = getAllPinnedProfiles();
    return Object.keys(all).filter(code => all[code].length > 0);
  } catch {
    return [];
  }
}
