import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import type { StockData, VolumeProfileStats } from '../types/stock';
import { calculateVolumeProfile, calculateVolumeProfileStats } from '../utils/stockData';

interface VolumeProfileProps {
  data: StockData[];
  width: number;
  height: number;
  minPrice: number;
  maxPrice: number;
  priceToY: (price: number) => number;
  priceLevels?: number;
  onPriceLevelsChange?: (levels: number) => void;
}

export const VolumeProfile: React.FC<VolumeProfileProps> = ({
  data,
  width,
  height,
  minPrice,
  maxPrice,
  priceToY,
  priceLevels = 40,
  onPriceLevelsChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { profile, stats } = useMemo(() => {
    const { profile: volProfile } = calculateVolumeProfile(data, priceLevels);
    const volStats = calculateVolumeProfileStats(volProfile);
    return { profile: volProfile, stats: volStats };
  }, [data, priceLevels]);

  const maxVolume = useMemo(() => {
    return Math.max(...profile.map(p => p.volume), 1);
  }, [profile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const barHeight = (maxPrice - minPrice) / profile.length;
    const barHeightPx = Math.abs(priceToY(minPrice + barHeight) - priceToY(minPrice));

    profile.forEach((level) => {
      const y = priceToY(level.price);
      if (y < 0 || y > height) return;
      const barWidth = (level.volume / maxVolume) * (width - 40);
      const intensity = level.volume / maxVolume;

      const gradient = ctx.createLinearGradient(0, y - barHeightPx / 2, barWidth, y + barHeightPx / 2);
      gradient.addColorStop(0, `rgba(59, 130, 246, ${0.3 + intensity * 0.5})`);
      gradient.addColorStop(1, `rgba(59, 130, 246, ${0.1 + intensity * 0.2})`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, y - barHeightPx / 2, barWidth, barHeightPx);

      ctx.strokeStyle = `rgba(59, 130, 246, ${0.4 + intensity * 0.4})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(0, y - barHeightPx / 2, barWidth, barHeightPx);
    });

    if (stats.poc > 0) {
      const pocY = priceToY(stats.poc);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, pocY);
      ctx.lineTo(width - 40, pocY);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('POC', width - 38, pocY + 4);
    }

    if (stats.vah > 0) {
      const vahY = priceToY(stats.vah);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, vahY);
      ctx.lineTo(width - 40, vahY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#10b981';
      ctx.font = '10px sans-serif';
      ctx.fillText('VAH', width - 38, vahY + 4);
    }

    if (stats.val > 0) {
      const valY = priceToY(stats.val);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, valY);
      ctx.lineTo(width - 40, valY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ef4444';
      ctx.font = '10px sans-serif';
      ctx.fillText('VAL', width - 38, valY + 4);
    }

  }, [profile, stats, maxVolume, minPrice, maxPrice, priceToY, width, height]);

  return (
    <div className="relative">
      {onPriceLevelsChange && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center gap-2 bg-slate-800/90 py-1 px-2 rounded-b">
          <span className="text-xs text-slate-400">价格桶:</span>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={priceLevels}
            onChange={(e) => onPriceLevelsChange(Number(e.target.value))}
            className="w-16 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-slate-300 w-6 text-center">{priceLevels}</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block"
      />
    </div>
  );
};

export { calculateVolumeProfileStats };
export type { VolumeProfileStats };
