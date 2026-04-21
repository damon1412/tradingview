import React, { useRef, useEffect, useCallback } from 'react';
import type { StockData, SelectedRange } from '../types/stock';

interface VolumeChartProps {
  data: StockData[];
  width: number;
  height: number;
  selectedRange: SelectedRange | null;
}

export const VolumeChart: React.FC<VolumeChartProps> = ({
  data,
  width,
  height,
  selectedRange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const margin = { top: 10, right: 60, bottom: 30, left: 10 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const maxVolume = Math.max(...data.map(d => d.volume));
  const candleSpacing = chartWidth / data.length;

  const volumeToHeight = useCallback((volume: number) => {
    return (volume / maxVolume) * chartHeight;
  }, [maxVolume, chartHeight]);

  const indexToX = useCallback((index: number) => {
    return margin.left + index * candleSpacing + candleSpacing / 2;
  }, [margin.left, candleSpacing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const barWidth = Math.max(1, candleSpacing * 0.8);

    data.forEach((candle, index) => {
      const x = indexToX(index);
      const isUp = candle.close >= candle.open;
      const barHeight = volumeToHeight(candle.volume);
      const y = margin.top + chartHeight - barHeight;

      const baseColor = isUp ? '#10b981' : '#ef4444';
      const gradient = ctx.createLinearGradient(x, y + barHeight, x, y);
      gradient.addColorStop(0, baseColor + '40');
      gradient.addColorStop(1, baseColor + '80');

      ctx.fillStyle = gradient;
      ctx.fillRect(x - barWidth / 2, y, barWidth, barHeight);

      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - barWidth / 2, y, barWidth, barHeight);
    });

    if (selectedRange) {
      const startX = indexToX(selectedRange.startIndex) - candleSpacing / 2;
      const endX = indexToX(selectedRange.endIndex) + candleSpacing / 2;
      const selectionWidth = endX - startX;

      ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.fillRect(startX, margin.top, selectionWidth, chartHeight);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';

    const volumeSteps = 3;
    for (let i = 0; i <= volumeSteps; i++) {
      const volume = (maxVolume / volumeSteps) * (volumeSteps - i);
      const y = margin.top + (chartHeight / volumeSteps) * i;

      let label = '';
      if (volume >= 1000000) {
        label = (volume / 1000000).toFixed(1) + 'M';
      } else if (volume >= 1000) {
        label = (volume / 1000).toFixed(1) + 'K';
      } else {
        label = volume.toFixed(0);
      }

      ctx.fillText(label, margin.left + chartWidth + 5, y + 4);
    }

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + chartHeight);
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    ctx.stroke();

  }, [data, width, height, selectedRange, maxVolume, chartWidth, chartHeight, margin, candleSpacing, volumeToHeight, indexToX]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block"
    />
  );
};
