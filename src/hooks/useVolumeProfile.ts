import { useState, useMemo, useEffect } from 'react';
import type { StockData, TimeFrame } from '../types/stock';
import { calculateVolumeProfile, getTimeFrameLabel, calculateVolumeProfileStats } from '../utils/stockData';
import { get1MinuteDataForVolumeProfile, getKlineData, convertKlineToStockData } from '../services/stockApi';
import { saveVolumeProfileCache, getVolumeProfileCache } from '../utils/analysisCache';

interface TimeframeOption {
  type: string;
  label: string;
  minCoverage: number;
}

const VOLUME_PROFILE_TIMEFRAMES: TimeframeOption[] = [
  { type: 'minute1', label: '1分钟数据', minCoverage: 0.8 },
  { type: 'minute5', label: '5分钟数据', minCoverage: 0.8 },
  { type: 'minute15', label: '15分钟数据', minCoverage: 0.8 },
  { type: 'minute30', label: '30分钟数据', minCoverage: 0.8 },
  { type: 'hour', label: '60分钟数据', minCoverage: 0.8 },
];

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

        const checkDataCoverage = (data: StockData[], minCoverage: number): { passed: boolean; availableDays: number; filteredDays: number } => {
          const filteredData = data.filter(
            item => item.timestamp >= selectedData[0].timestamp && item.timestamp <= selectedData[selectedData.length - 1].timestamp
          );
          
          const daySet = new Set<string>();
          filteredData.forEach(item => {
            const d = new Date(item.timestamp);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            daySet.add(key);
          });
          
          // 计算选定范围内的交易日数量（用selectedData的实际条数作为基准）
          const tradingDaysInRange = selectedData.length;
          
          // 分钟数据实际覆盖的交易日数量
          const coveredDays = daySet.size;
          
          // 覆盖率 = 覆盖的交易日 / 选定范围的交易日
          return {
            passed: tradingDaysInRange > 0 && coveredDays >= tradingDaysInRange * minCoverage,
            availableDays: coveredDays,
            filteredDays: coveredDays
          };
        };

        // 依次尝试不同时间周期的数据
        for (const tf of VOLUME_PROFILE_TIMEFRAMES) {
          try {
            let data: StockData[] = [];
            
            if (tf.type === 'minute1') {
              const result = await get1MinuteDataForVolumeProfile(stockCode, startDateStr, endDateStr);
              if (result.error || !result.data || result.data.length === 0) {
                console.log(`${tf.label}无数据，继续尝试下一个`);
                continue;
              }
              data = result.data;
            } else {
              const result = await getKlineData(stockCode, tf.type);
              if (result.error || !result.data || !result.data.List || result.data.List.length === 0) {
                console.log(`${tf.label}无数据，继续尝试下一个`);
                continue;
              }
              data = convertKlineToStockData(result.data.List);
            }

            const { passed, availableDays, filteredDays } = checkDataCoverage(data, tf.minCoverage);
            
            if (passed) {
              const filteredData = data.filter(
                item => item.timestamp >= selectedData[0].timestamp && item.timestamp <= selectedData[selectedData.length - 1].timestamp
              );
              setVolumeProfileData(filteredData);
              setDataSourceLabel(tf.label);
              return;
            }
          } catch (err) {
            console.error(`加载${tf.label}失败:`, err);
            continue;
          }
        }
        
        // 所有时间周期都不完整，回退到日线数据
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
