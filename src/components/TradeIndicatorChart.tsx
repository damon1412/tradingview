import React, { useRef, useEffect, useState } from 'react';
import type { TradeIndicatorData } from '../types/stock';
import { formatAmount } from '../utils/tradeData';

interface TradeIndicatorChartProps {
  data: TradeIndicatorData;
  width: number;
  height: number;
}

export const TradeIndicatorChart: React.FC<TradeIndicatorChartProps> = ({
  data,
  width,
  height
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showAcceleration, setShowAcceleration] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.prices.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const margin = { top: 20, right: 60, bottom: 30, left: 10 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    ctx.clearRect(0, 0, width, height);

    const indexToX = (index: number) => margin.left + (index / (data.prices.length - 1)) * chartWidth;

    if (!showAcceleration) {
      const cumValues = data.cumulativeBuy.concat(data.cumulativeSell);
      const maxCum = Math.max(...cumValues) || 1;

      const cumToY = (value: number) => margin.top + chartHeight - (value / maxCum) * chartHeight;

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = margin.top + (chartHeight * i) / 4;
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(margin.left + chartWidth, y);
        ctx.stroke();

        const value = maxCum * (1 - i / 4);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(formatAmount(value), margin.left + chartWidth + 5, y + 4);
      }

      ctx.beginPath();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      data.cumulativeBuy.forEach((value, index) => {
        const x = indexToX(index);
        const y = cumToY(value);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      data.cumulativeSell.forEach((value, index) => {
        const x = indexToX(index);
        const y = cumToY(value);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('累计买入', margin.left + 5, margin.top + 15);
      ctx.fillStyle = '#ef4444';
      ctx.fillText('累计卖出', margin.left + 70, margin.top + 15);
    } else {
      const accelValues = data.buyAcceleration.concat(data.sellAcceleration);
      const absMax = Math.max(...accelValues.map(Math.abs)) || 1;

      const accelToY = (value: number) => margin.top + chartHeight / 2 - (value / absMax) * (chartHeight / 2);

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      const midY = margin.top + chartHeight / 2;
      ctx.beginPath();
      ctx.moveTo(margin.left, midY);
      ctx.lineTo(margin.left + chartWidth, midY);
      ctx.stroke();

      for (let i = 0; i <= 4; i++) {
        const value = absMax * (1 - i / 2);
        const y = accelToY(value);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(formatAmount(Math.abs(value)), margin.left + chartWidth + 5, y + 4);
      }

      const barWidth = Math.max(1, chartWidth / data.buyAcceleration.length - 1);
      data.buyAcceleration.forEach((value, index) => {
        if (value > 0) {
          const x = indexToX(index);
          const y = accelToY(value);
          ctx.fillStyle = 'rgba(16, 185, 129, 0.7)';
          ctx.fillRect(x - barWidth / 2, y, barWidth, midY - y);
        }
      });

      data.sellAcceleration.forEach((value, index) => {
        if (value > 0) {
          const x = indexToX(index);
          const y = accelToY(-value);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
          ctx.fillRect(x - barWidth / 2, midY, barWidth, y - midY);
        }
      });

      ctx.fillStyle = '#10b981';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('买入加速度', margin.left + 5, margin.top + 15);
      ctx.fillStyle = '#ef4444';
      ctx.fillText('卖出加速度', margin.left + 85, margin.top + 15);
    }

    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.prices.length) {
      const x = indexToX(hoverIndex);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      const tooltipWidth = 140;
      const tooltipHeight = showAcceleration ? 70 : 50;
      let tooltipX = x + 10;
      let tooltipY = margin.top + 10;
      
      if (tooltipX + tooltipWidth > width) {
        tooltipX = x - tooltipWidth - 10;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`时间: ${data.timestamps[hoverIndex] ? new Date(data.timestamps[hoverIndex]).toLocaleTimeString() : ''}`, tooltipX + 8, tooltipY + 18);
      
      if (!showAcceleration) {
        ctx.fillStyle = '#10b981';
        ctx.fillText(`买入: ${formatAmount(data.cumulativeBuy[hoverIndex])}`, tooltipX + 8, tooltipY + 34);
        ctx.fillStyle = '#ef4444';
        ctx.fillText(`卖出: ${formatAmount(data.cumulativeSell[hoverIndex])}`, tooltipX + 8, tooltipY + 50);
      } else {
        ctx.fillStyle = '#10b981';
        ctx.fillText(`买入加速度: ${formatAmount(data.buyAcceleration[hoverIndex])}`, tooltipX + 8, tooltipY + 34);
        ctx.fillStyle = '#ef4444';
        ctx.fillText(`卖出加速度: ${formatAmount(data.sellAcceleration[hoverIndex])}`, tooltipX + 8, tooltipY + 50);
      }
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const labelCount = Math.min(5, data.prices.length);
    for (let i = 0; i < labelCount; i++) {
      const index = Math.floor((i / (labelCount - 1)) * (data.prices.length - 1));
      const x = indexToX(index);
      const time = data.timestamps[index] ? new Date(data.timestamps[index]).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
      ctx.fillText(time, x, margin.top + chartHeight + 20);
    }
  }, [data, width, height, hoverIndex, showAcceleration]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const margin = { top: 20, right: 60, bottom: 30, left: 10 };
    const chartWidth = width - margin.left - margin.right;
    
    const ratio = (x - margin.left) / chartWidth;
    const index = Math.round(ratio * (data.prices.length - 1));
    
    if (index >= 0 && index < data.prices.length) {
      setHoverIndex(index);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  if (data.prices.length === 0) {
    return (
      <div className="flex items-center justify-center bg-slate-800 rounded-lg border border-slate-700" style={{ height }}>
        <p className="text-slate-500 text-sm">暂无指标数据</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      <button
        onClick={() => setShowAcceleration(!showAcceleration)}
        className="absolute top-2 right-16 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-2 py-1 rounded transition-colors"
      >
        {showAcceleration ? '累计买卖' : '加速度'}
      </button>
    </div>
  );
};
