import React, { useRef, useEffect, useState } from 'react';
import type { TradeTick, PinnedProfile } from '../types/stock';

interface TradeTrendChartProps {
  data: TradeTick[];
  width: number;
  height: number;
  pinnedProfiles?: PinnedProfile[];
}

export const TradeTrendChart: React.FC<TradeTrendChartProps> = ({
  data,
  width,
  height,
  pinnedProfiles = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const margin = { top: 20, right: 60, bottom: 30, left: 10 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    ctx.clearRect(0, 0, width, height);

    const prices = data.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    const padding = priceRange * 0.1;

    const indexToX = (index: number) => margin.left + (index / (data.length - 1)) * chartWidth;
    const priceToY = (price: number) => margin.top + chartHeight - ((price - (minPrice - padding)) / (priceRange + padding * 2)) * chartHeight;

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    ctx.stroke();

    ctx.strokeStyle = '#334155';
    ctx.setLineDash([2, 2]);
    for (let i = 0; i <= 4; i++) {
      const price = minPrice - padding + ((priceRange + padding * 2) * i) / 4;
      const y = priceToY(price);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.setLineDash([]);
      ctx.fillText(price.toFixed(2), margin.left + chartWidth + 5, y + 4);
      ctx.setLineDash([2, 2]);
    }
    ctx.setLineDash([]);

    const previousClose = data[0]?.price || 0;
    const previousCloseY = priceToY(previousClose);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(margin.left, previousCloseY);
    ctx.lineTo(margin.left + chartWidth, previousCloseY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#f59e0b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`昨收 ${previousClose.toFixed(2)}`, margin.left + chartWidth + 5, previousCloseY + 4);

    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    data.forEach((tick, index) => {
      const x = indexToX(index);
      const y = priceToY(tick.price);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + chartHeight);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

    ctx.lineTo(indexToX(data.length - 1), margin.top + chartHeight);
    ctx.lineTo(indexToX(0), margin.top + chartHeight);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    data.forEach((tick, index) => {
      const x = indexToX(index);
      const y = priceToY(tick.price);
      const color = tick.status === 1 ? '#10b981' : tick.status === 2 ? '#ef4444' : '#64748b';
      
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 绘制固定POC点位线
    pinnedProfiles.forEach((profile, i) => {
      const pocY = priceToY(profile.stats.poc);
      const vahY = priceToY(profile.stats.vah);
      const valY = priceToY(profile.stats.val);
      
      // POC线
      ctx.strokeStyle = profile.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(margin.left, pocY);
      ctx.lineTo(margin.left + chartWidth, pocY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = profile.color;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`#${i + 1} POC:${profile.stats.poc.toFixed(2)}`, margin.left + chartWidth + 5, pocY + 4);
      
      // VAH线
      ctx.strokeStyle = profile.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(margin.left, vahY);
      ctx.lineTo(margin.left + chartWidth, vahY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = profile.color;
      ctx.font = '9px sans-serif';
      ctx.fillText(`#${i + 1} VAH:${profile.stats.vah.toFixed(2)}`, margin.left + chartWidth + 5, vahY + 4);
      
      // VAL线
      ctx.strokeStyle = profile.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(margin.left, valY);
      ctx.lineTo(margin.left + chartWidth, valY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = profile.color;
      ctx.font = '9px sans-serif';
      ctx.fillText(`#${i + 1} VAL:${profile.stats.val.toFixed(2)}`, margin.left + chartWidth + 5, valY + 4);
    });

    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.length) {
      const tick = data[hoverIndex];
      const x = indexToX(hoverIndex);
      const y = priceToY(tick.price);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      const hasPinnedPocs = pinnedProfiles.length > 0;
      const tooltipWidth = 140;
      const tooltipHeight = hasPinnedPocs ? 70 + pinnedProfiles.length * 16 : 70;
      let tooltipX = x + 10;
      let tooltipY = y - 80;
      
      if (tooltipX + tooltipWidth > width) {
        tooltipX = x - tooltipWidth - 10;
      }
      if (tooltipY < 0) tooltipY = 10;
      if (tooltipY + tooltipHeight > height) tooltipY = height - tooltipHeight - 10;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`时间: ${tick.time}`, tooltipX + 8, tooltipY + 18);
      ctx.fillText(`价格: ${tick.price.toFixed(2)}`, tooltipX + 8, tooltipY + 34);
      ctx.fillText(`成交量: ${tick.volume}`, tooltipX + 8, tooltipY + 50);
      const directionColor = tick.status === 1 ? '#10b981' : tick.status === 2 ? '#ef4444' : '#94a3b8';
      ctx.fillStyle = directionColor;
      ctx.fillText(`方向: ${tick.status === 1 ? '买入' : tick.status === 2 ? '卖出' : '中性'}`, tooltipX + 8, tooltipY + 66);

      if (hasPinnedPocs) {
        let yOff = 82;
        pinnedProfiles.forEach((profile, i) => {
          ctx.fillStyle = profile.color;
          ctx.fillText(`POC#${i + 1}: ${profile.stats.poc.toFixed(2)}`, tooltipX + 8, tooltipY + yOff);
          yOff += 16;
        });
      }
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const labelCount = Math.min(5, data.length);
    for (let i = 0; i < labelCount; i++) {
      const index = Math.floor((i / (labelCount - 1)) * (data.length - 1));
      const x = indexToX(index);
      ctx.fillText(data[index].time, x, margin.top + chartHeight + 20);
    }
  }, [data, width, height, hoverIndex, pinnedProfiles]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const margin = { top: 20, right: 60, bottom: 30, left: 10 };
    const chartWidth = width - margin.left - margin.right;
    
    const ratio = (x - margin.left) / chartWidth;
    const index = Math.round(ratio * (data.length - 1));
    
    if (index >= 0 && index < data.length) {
      setHoverIndex(index);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center bg-slate-800 rounded-lg border border-slate-700" style={{ height }}>
        <p className="text-slate-500 text-sm">暂无逐笔数据</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  );
};
