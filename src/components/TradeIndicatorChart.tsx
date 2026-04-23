import React, { useRef, useEffect, useState } from 'react';
import type { TradeIndicatorData } from '../types/stock';
import { formatAmount } from '../utils/tradeData';

type IndicatorMode = 'cumulative' | 'macd' | 'rsi';

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
  const [mode, setMode] = useState<IndicatorMode>('cumulative');

  const modes: IndicatorMode[] = ['cumulative', 'macd', 'rsi'];
  const modeLabels: Record<IndicatorMode, string> = {
    cumulative: '累计买卖',
    macd: 'MACD',
    rsi: 'RSI'
  };

  const cycleMode = () => {
    const currentIndex = modes.indexOf(mode);
    setMode(modes[(currentIndex + 1) % modes.length]);
  };

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

    if (mode === 'cumulative') {
      renderCumulative(ctx, margin, chartWidth, chartHeight, indexToX);
    } else if (mode === 'macd') {
      renderMACD(ctx, margin, chartWidth, chartHeight, indexToX);
    } else {
      renderRSI(ctx, margin, chartWidth, chartHeight, indexToX);
    }

    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.prices.length) {
      renderTooltip(ctx, hoverIndex, margin, chartWidth, chartHeight, indexToX, width);
    }

    renderTimeLabels(ctx, margin, chartWidth, chartHeight, indexToX);
  }, [data, width, height, hoverIndex, mode]);

  const renderCumulative = (ctx: CanvasRenderingContext2D, margin: any, chartWidth: number, chartHeight: number, indexToX: (i: number) => number) => {
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
  };

  const renderMACD = (ctx: CanvasRenderingContext2D, margin: any, chartWidth: number, chartHeight: number, indexToX: (i: number) => number) => {
    const validHistogram = data.macdHistogram.filter(v => v !== 0);
    const validDIF = data.macdDIF.filter(v => v !== 0);
    const validDEA = data.macdDEA.filter(v => v !== 0);
    
    const allValues = [...validHistogram, ...validDIF, ...validDEA];
    const maxAbs = Math.max(...allValues.map(Math.abs), 0.001);

    const macdToY = (value: number) => margin.top + chartHeight / 2 - (value / maxAbs) * (chartHeight / 2);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    const midY = margin.top + chartHeight / 2;
    ctx.beginPath();
    ctx.moveTo(margin.left, midY);
    ctx.lineTo(margin.left + chartWidth, midY);
    ctx.stroke();

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    for (let i = 1; i <= 3; i++) {
      const y = margin.top + (chartHeight * i) / 4;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();
    }

    const barWidth = Math.max(1, chartWidth / data.macdHistogram.length - 1);
    data.macdHistogram.forEach((value, index) => {
      if (value !== 0) {
        const x = indexToX(index);
        const y = macdToY(value);
        ctx.fillStyle = value > 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)';
        if (value > 0) {
          ctx.fillRect(x - barWidth / 2, y, barWidth, midY - y);
        } else {
          ctx.fillRect(x - barWidth / 2, midY, barWidth, y - midY);
        }
      }
    });

    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    data.macdDIF.forEach((value, index) => {
      if (value !== 0) {
        const x = indexToX(index);
        const y = macdToY(value);
        if (index === 0 || data.macdDIF[index - 1] === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    data.macdDEA.forEach((value, index) => {
      if (value !== 0) {
        const x = indexToX(index);
        const y = macdToY(value);
        if (index === 0 || data.macdDEA[index - 1] === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    ctx.fillStyle = '#3b82f6';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DIF', margin.left + 5, margin.top + 15);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('DEA', margin.left + 45, margin.top + 15);
    ctx.fillStyle = '#10b981';
    ctx.fillText('MACD', margin.left + 85, margin.top + 15);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(formatAmount(maxAbs), margin.left + chartWidth + 5, margin.top + 8);
    ctx.fillText(formatAmount(-maxAbs), margin.left + chartWidth + 5, margin.top + chartHeight - 5);
  };

  const renderRSI = (ctx: CanvasRenderingContext2D, margin: any, chartWidth: number, chartHeight: number, indexToX: (i: number) => number) => {
    const rsiToY = (value: number) => margin.top + chartHeight - (value / 100) * chartHeight;

    ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
    const overboughtY = rsiToY(70);
    const oversoldY = rsiToY(30);
    ctx.fillRect(margin.left, overboughtY, chartWidth, oversoldY - overboughtY);

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(margin.left, overboughtY);
    ctx.lineTo(margin.left + chartWidth, overboughtY);
    ctx.stroke();

    ctx.strokeStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(margin.left, oversoldY);
    ctx.lineTo(margin.left + chartWidth, oversoldY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ef4444';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('70', margin.left + chartWidth + 5, overboughtY + 4);
    ctx.fillStyle = '#10b981';
    ctx.fillText('30', margin.left + chartWidth + 5, oversoldY + 4);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('50', margin.left + chartWidth + 5, rsiToY(50) + 4);

    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.rsi.forEach((value, index) => {
      const x = indexToX(index);
      const y = rsiToY(value);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = '#a855f7';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`RSI: ${data.rsi.length > 0 ? data.rsi[data.rsi.length - 1].toFixed(1) : '0'}`, margin.left + 5, margin.top + 15);
  };

  const renderTooltip = (ctx: CanvasRenderingContext2D, hoverIndex: number, margin: any, chartWidth: number, chartHeight: number, indexToX: (i: number) => number, width: number) => {
    const x = indexToX(hoverIndex);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + chartHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    const tooltipWidth = 160;
    let tooltipHeight = 50;
    if (mode === 'macd') tooltipHeight = 90;
    else if (mode === 'rsi') tooltipHeight = 60;

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
    const time = data.timestamps[hoverIndex] ? new Date(data.timestamps[hoverIndex]).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
    ctx.fillText(`时间: ${time}`, tooltipX + 8, tooltipY + 18);

    if (mode === 'cumulative') {
      ctx.fillStyle = '#10b981';
      ctx.fillText(`买入: ${formatAmount(data.cumulativeBuy[hoverIndex])}`, tooltipX + 8, tooltipY + 34);
      ctx.fillStyle = '#ef4444';
      ctx.fillText(`卖出: ${formatAmount(data.cumulativeSell[hoverIndex])}`, tooltipX + 8, tooltipY + 50);
    } else if (mode === 'macd') {
      ctx.fillStyle = '#3b82f6';
      ctx.fillText(`DIF: ${data.macdDIF[hoverIndex]?.toFixed(3) || '0'}`, tooltipX + 8, tooltipY + 34);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`DEA: ${data.macdDEA[hoverIndex]?.toFixed(3) || '0'}`, tooltipX + 8, tooltipY + 50);
      ctx.fillStyle = '#10b981';
      ctx.fillText(`MACD: ${data.macdHistogram[hoverIndex]?.toFixed(3) || '0'}`, tooltipX + 8, tooltipY + 66);
    } else {
      ctx.fillStyle = '#a855f7';
      ctx.fillText(`RSI: ${data.rsi[hoverIndex]?.toFixed(1) || '50'}`, tooltipX + 8, tooltipY + 34);
    }
  };

  const renderTimeLabels = (ctx: CanvasRenderingContext2D, margin: any, chartWidth: number, chartHeight: number, indexToX: (i: number) => number) => {
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
  };

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
        onClick={cycleMode}
        className="absolute top-2 right-16 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-2 py-1 rounded transition-colors"
      >
        {modeLabels[mode]}
      </button>
    </div>
  );
};
