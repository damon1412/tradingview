import { useState, useMemo, useEffect } from 'react';
import type { StockData, TimeFrame } from '../types/stock';
import { calculateVolumeProfile, getTimeFrameLabel } from '../utils/stockData';
import { get1MinuteDataForVolumeProfile } from '../services/stockApi';

export function useVolumeProfile(
  selectedData: StockData[],
  stockCode: string,
  timeFrame: TimeFrame,
  priceLevels: number
) {
  const [volumeProfileData, setVolumeProfileData] = useState<StockData[]>([]);
  const [dataSourceLabel, setDataSourceLabel] = useState<string>('');

  useEffect(() => {
    const loadVolumeProfileData = async () => {
      if (selectedData.length === 0) {
        setVolumeProfileData([]);
        setDataSourceLabel('');
        return;
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
            if (filteredMinuteData.length > selectedData.length) {
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
  }, [selectedData, stockCode, timeFrame]);

  const volumeProfile = useMemo(() => {
    if (volumeProfileData.length === 0) return null;
    const { profile } = calculateVolumeProfile(volumeProfileData, priceLevels);
    return profile;
  }, [volumeProfileData, priceLevels]);

  return { volumeProfileData, volumeProfile, dataSourceLabel };
}
