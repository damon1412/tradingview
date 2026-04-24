import { useState, useMemo, useEffect } from 'react';
import type { StockData, TimeFrame } from '../types/stock';
import { calculateVolumeProfile, getTimeFrameLabel, calculateVolumeProfileStats } from '../utils/stockData';
import { get1MinuteDataForVolumeProfile } from '../services/stockApi';
import { saveVolumeProfileCache, getVolumeProfileCache } from '../utils/analysisCache';

export function useVolumeProfile(
  selectedData: StockData[],
  stockCode: string,
  timeFrame: TimeFrame,
  dataRange: string,
  priceLevels: number,
  isFullData: boolean = true
) {
  const [volumeProfileData, setVolumeProfileData] = useState<StockData[]>([]);
  const [dataSourceLabel, setDataSourceLabel] = useState<string>('');
  const [cachedProfile, setCachedProfile] = useState<{ price: number; volume: number }[] | null>(null);
  const [cachedStats, setCachedStats] = useState<{ poc: number; vah: number; val: number; totalVolume: number } | null>(null);

  useEffect(() => {
    const loadVolumeProfileData = async () => {
      if (selectedData.length === 0) {
        setVolumeProfileData([]);
        setDataSourceLabel('');
        setCachedProfile(null);
        setCachedStats(null);
        return;
      }

      if (isFullData) {
        const cache = getVolumeProfileCache(stockCode, timeFrame, dataRange, priceLevels);
        if (cache) {
          setCachedProfile(cache.profile);
          setCachedStats(cache.stats);
        } else {
          setCachedProfile(null);
          setCachedStats(null);
        }
      } else {
        setCachedProfile(null);
        setCachedStats(null);
      }

      if (stockCode !== 'DEMO' && timeFrame !== '1m' && timeFrame !== 'minute') {
        const startDate = new Date(selectedData[0].timestamp);
        const endDate = new Date(selectedData[selectedData.length - 1].timestamp);
        const formatDate = (date: Date) => {
          const year = date.getFullYear();
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          return `${year}${month}${day}`;
        };
        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);

        try {
          const { data: minuteData, error } = await get1MinuteDataForVolumeProfile(stockCode, startDateStr, endDateStr);
          if (!error && minuteData.length > 0) {
            const filteredMinuteData = minuteData.filter(
              item => item.timestamp >= selectedData[0].timestamp && item.timestamp <= selectedData[selectedData.length - 1].timestamp
            );
            
            const minuteDaySet = new Set<string>();
            filteredMinuteData.forEach(item => {
              const d = new Date(item.timestamp);
              const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              minuteDaySet.add(key);
            });
            const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            
            if (minuteDaySet.size >= totalDays * 0.8) {
              setVolumeProfileData(filteredMinuteData);
              setDataSourceLabel('1分钟数据');
              return;
            }
          }
        } catch (err) {
          console.error('加载1分钟数据失败:', err);
        }
        
        setVolumeProfileData(selectedData);
        setDataSourceLabel('日线数据');
      } else {
        setVolumeProfileData(selectedData);
        setDataSourceLabel(timeFrame === 'minute' ? '分时数据' : '1分钟数据');
      }
    };

    loadVolumeProfileData();
  }, [selectedData, stockCode, timeFrame, dataRange, priceLevels]);

  const volumeProfile = useMemo(() => {
    if (cachedProfile) return cachedProfile;
    if (volumeProfileData.length === 0) return null;
    const { profile } = calculateVolumeProfile(volumeProfileData, priceLevels);
    
    if (isFullData && stockCode !== 'DEMO') {
      const stats = calculateVolumeProfileStats(profile);
      saveVolumeProfileCache(stockCode, timeFrame, dataRange, priceLevels, profile, stats);
    }
    
    return profile;
  }, [cachedProfile, volumeProfileData, priceLevels, stockCode, timeFrame, dataRange, isFullData]);

  const volumeProfileStats = useMemo(() => {
    if (cachedStats) return cachedStats;
    if (!volumeProfile) return null;
    return calculateVolumeProfileStats(volumeProfile);
  }, [cachedStats, volumeProfile]);

  return { volumeProfileData, volumeProfile, volumeProfileStats, dataSourceLabel };
}
