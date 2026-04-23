import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type { StockData, SelectedRange } from '../types/stock';
import { calculateRSI, calculateMACD } from '../utils/indicators';

interface IndicatorChartProps {
  data: StockData[];
  width: number;
  height: number;
  selectedRange: SelectedRange | null;
  indicator: 'volume' | 'macd' | 'rsi';
  onHoverIndexChange?: (index: number | null) => void;
  hoverIndex?: number | null;
}

export const IndicatorChart: React.FC<IndicatorChartProps> = ({
  data,
  width,
  height,
  selectedRange,
  indicator,
  onHoverIndexChange,
  hoverIndex: externalHoverIndex
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [internalHoverIndex, setInternalHoverIndex] = useState<number | null>(null);
  const hoverIndex = externalHoverIndex !== undefined ? externalHoverIndex : internalHoverIndex;

  const margin = { top: 10, right: 60, bottom: 30, left: 10 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const candleSpacing = chartWidth / data.length;

  const indexToX = useCallback((index: number) => {
    return margin.left + index * candleSpacing + candleSpacing / 2;
  }, [margin.left, candleSpacing]);

  // 计算指标数据
  const indicatorData = useMemo(() => {
    if (indicator === 'volume') {
      return { type: 'volume' as const };
    } else if (indicator === 'rsi') {
      const rsiValues = calculateRSI(data);
      return { type: 'rsi' as const, values: rsiValues };
    } else if (indicator === 'macd') {
      const macdData = calculateMACD(data);
      return { type: 'macd' as const, ...macdData };
    }
    return { type: 'volume' as const };
  }, [data, indicator]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const barWidth = Math.max(1, candleSpacing * 0.8);

    if (indicatorData.type === 'volume') {
      // 绘制成交量
      const maxVolume = Math.max(...data.map(d => d.volume));
      const volumeToHeight = (volume: number) => {
        return (volume / maxVolume) * chartHeight;
      };

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

      // 绘制成交量Y轴刻度
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
    } else if (indicatorData.type === 'rsi') {
      // 绘制RSI
      const rsiValues = indicatorData.values;
      const maxY = 100;
      const minY = 0;
      const range = maxY - minY;

      const valueToY = (value: number) => {
        return margin.top + chartHeight - ((value - minY) / range) * chartHeight;
      };

      // 绘制超买超卖线
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      const overboughtY = valueToY(70);
      ctx.beginPath();
      ctx.moveTo(margin.left, overboughtY);
      ctx.lineTo(margin.left + chartWidth, overboughtY);
      ctx.stroke();

      const oversoldY = valueToY(30);
      ctx.beginPath();
      ctx.moveTo(margin.left, oversoldY);
      ctx.lineTo(margin.left + chartWidth, oversoldY);
      ctx.stroke();

      const middleY = valueToY(50);
      ctx.beginPath();
      ctx.moveTo(margin.left, middleY);
      ctx.lineTo(margin.left + chartWidth, middleY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 绘制RSI线
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let firstPoint = true;

      for (let i = 0; i < rsiValues.length; i++) {
        const value = rsiValues[i];
        if (value === null) continue;

        const x = indexToX(i);
        const y = valueToY(value);

        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // 绘制RSI Y轴刻度
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      [0, 30, 50, 70, 100].forEach(value => {
        const y = valueToY(value);
        ctx.fillText(value.toString(), margin.left + chartWidth + 5, y + 4);
      });
    } else if (indicatorData.type === 'macd') {
      // 绘制MACD
      const { macd, signal, histogram } = indicatorData;

      // 找出最大值最小值
      const allValues = [...macd, ...signal, ...histogram].filter((v): v is number => v !== null);
      const maxValue = Math.max(...allValues, 0.001);
      const minValue = Math.min(...allValues, -0.001);
      const absMax = Math.max(Math.abs(maxValue), Math.abs(minValue));
      const range = absMax * 2;

      const valueToY = (value: number) => {
        return margin.top + chartHeight - ((value + absMax) / range) * chartHeight;
      };

      // 绘制零轴
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      const zeroY = valueToY(0);
      ctx.beginPath();
      ctx.moveTo(margin.left, zeroY);
      ctx.lineTo(margin.left + chartWidth, zeroY);
      ctx.stroke();

      // 绘制MACD柱状图
      for (let i = 0; i < histogram.length; i++) {
        const value = histogram[i];
        if (value === null) continue;

        const x = indexToX(i);
        const barHeight = Math.abs(valueToY(value) - zeroY);
        const y = value > 0 ? valueToY(value) : zeroY;
        const color = value >= 0 ? '#10b981' : '#ef4444';

        ctx.fillStyle = color + '80';
        ctx.fillRect(x - barWidth / 2, y, barWidth, barHeight);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - barWidth / 2, y, barWidth, barHeight);
      }

      // 绘制MACD线
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let firstMacd = true;
      for (let i = 0; i < macd.length; i++) {
        const value = macd[i];
        if (value === null) continue;

        const x = indexToX(i);
        const y = valueToY(value);

        if (firstMacd) {
          ctx.moveTo(x, y);
          firstMacd = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // 绘制信号线
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let firstSignal = true;
      for (let i = 0; i < signal.length; i++) {
        const value = signal[i];
        if (value === null) continue;

        const x = indexToX(i);
        const y = valueToY(value);

        if (firstSignal) {
          ctx.moveTo(x, y);
          firstSignal = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // 绘制MACD Y轴刻度
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      [absMax, absMax / 2, 0, -absMax / 2, -absMax].forEach(value => {
        const y = valueToY(value);
        ctx.fillText(value.toFixed(2), margin.left + chartWidth + 5, y + 4);
      });
    }

    // 绘制选中区域高亮
    if (selectedRange) {
      const startX = indexToX(selectedRange.startIndex) - candleSpacing / 2;
      const endX = indexToX(selectedRange.endIndex) + candleSpacing / 2;
      const selectionWidth = endX - startX;

      ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.fillRect(startX, margin.top, selectionWidth, chartHeight);
    }

    // 绘制底部横线
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + chartHeight);
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    ctx.stroke();

  }, [data, width, height, selectedRange, candleSpacing, indexToX, indicatorData]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block"
    />
  );
};