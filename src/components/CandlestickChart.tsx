import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { StockData, SelectedRange, PinnedProfile } from '../types/stock';

interface CandlestickChartProps {
  data: StockData[];
  width: number;
  height: number;
  selectedRange: SelectedRange | null;
  onRangeSelect: (range: SelectedRange | null) => void;
  onZoom: (range: { startIndex: number; endIndex: number } | null) => void;
  pinnedProfiles?: PinnedProfile[];
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  width,
  height,
  selectedRange,
  onRangeSelect,
  onZoom,
  pinnedProfiles = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [zoomStart, setZoomStart] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const margin = { top: 20, right: 60, bottom: 40, left: 10 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const minPrice = Math.min(...data.map(d => d.low));
  const maxPrice = Math.max(...data.map(d => d.high));
  const priceRange = maxPrice - minPrice;

  const candleWidth = Math.max(2, (chartWidth / data.length) * 0.7);
  const candleSpacing = chartWidth / data.length;

  const priceToY = useCallback((price: number) => {
    return margin.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
  }, [minPrice, priceRange, chartHeight, margin.top]);

  const indexToX = useCallback((index: number) => {
    return margin.left + index * candleSpacing + candleSpacing / 2;
  }, [margin.left, candleSpacing]);

  const xToIndex = useCallback((x: number) => {
    const relativeX = x - margin.left;
    return Math.floor(relativeX / candleSpacing);
  }, [margin.left, candleSpacing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (chartHeight / 5) * i;
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
    }
    ctx.stroke();

    data.forEach((candle, index) => {
      const x = indexToX(index);
      const isUp = candle.close >= candle.open;
      const color = isUp ? '#10b981' : '#ef4444';

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;

      const highY = priceToY(candle.high);
      const lowY = priceToY(candle.low);
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      const openY = priceToY(candle.open);
      const closeY = priceToY(candle.close);
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.abs(closeY - openY) || 1;

      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    if (selectedRange) {
      const startX = indexToX(selectedRange.startIndex) - candleSpacing / 2;
      const endX = indexToX(selectedRange.endIndex) + candleSpacing / 2;
      const selectionWidth = endX - startX;

      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.fillRect(startX, margin.top, selectionWidth, chartHeight);

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(startX, margin.top);
      ctx.lineTo(startX, margin.top + chartHeight);
      ctx.moveTo(endX, margin.top);
      ctx.lineTo(endX, margin.top + chartHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (isSelecting && selectionStart !== null) {
      const currentX = hoverIndex !== null ? indexToX(hoverIndex) : 0;
      const startX = indexToX(selectionStart) - candleSpacing / 2;
      const endX = currentX + candleSpacing / 2;
      const selectionWidth = endX - startX;

      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.fillRect(startX, margin.top, selectionWidth, chartHeight);

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(startX, margin.top, selectionWidth, chartHeight);
      ctx.setLineDash([]);
    }

    if (isZooming && zoomStart !== null && hoverIndex !== null) {
      const startX = indexToX(Math.min(zoomStart, hoverIndex)) - candleSpacing / 2;
      const endX = indexToX(Math.max(zoomStart, hoverIndex)) + candleSpacing / 2;
      const selectionWidth = endX - startX;

      ctx.fillStyle = 'rgba(124, 58, 237, 0.3)';
      ctx.fillRect(startX, margin.top, selectionWidth, chartHeight);

      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(startX, margin.top, selectionWidth, chartHeight);
      ctx.setLineDash([]);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i <= 5; i++) {
      const price = minPrice + (priceRange / 5) * (5 - i);
      const y = margin.top + (chartHeight / 5) * i;
      ctx.fillText(price.toFixed(2), margin.left + chartWidth + 5, y + 4);
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const dateStep = Math.ceil(data.length / 6);
    for (let i = 0; i < data.length; i += dateStep) {
      const x = indexToX(i);
      const date = new Date(data[i].timestamp);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      ctx.fillText(dateStr, x, margin.top + chartHeight + 15);
    }

    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.length) {
      const x = indexToX(hoverIndex);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      // 显示完整时间信息
      const candle = data[hoverIndex];
      const date = new Date(candle.timestamp);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hour = date.getHours().toString().padStart(2, '0');
      const minute = date.getMinutes().toString().padStart(2, '0');
      const timeStr = `${year}-${month}-${day} ${hour}:${minute}`;

      // 绘制时间背景
      ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
      const textWidth = ctx.measureText(timeStr).width;
      const bgWidth = textWidth + 16;
      const bgHeight = 22;
      const bgX = x - bgWidth / 2;
      const bgY = height - bgHeight - 2;

      // 确保时间显示不超出边界
      const adjustedBgX = Math.max(2, Math.min(width - bgWidth - 2, bgX));
      ctx.fillRect(adjustedBgX, bgY, bgWidth, bgHeight);

      // 绘制时间文本
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(timeStr, adjustedBgX + bgWidth / 2, bgY + 15);
    }

    pinnedProfiles.forEach((profile, index) => {
      const label = `#${index + 1}`;

      if (profile.stats.poc > 0) {
        const pocY = priceToY(profile.stats.poc);
        ctx.strokeStyle = profile.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(margin.left, pocY);
        ctx.lineTo(margin.left + chartWidth, pocY);
        ctx.stroke();

        ctx.fillStyle = profile.color;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${label} POC`, margin.left + chartWidth + 5, pocY + 3);
      }

      if (profile.stats.vah > 0) {
        const vahY = priceToY(profile.stats.vah);
        ctx.strokeStyle = profile.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(margin.left, vahY);
        ctx.lineTo(margin.left + chartWidth, vahY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        ctx.fillStyle = profile.color;
        ctx.font = '9px sans-serif';
        ctx.fillText(`${label} VAH`, margin.left + chartWidth + 5, vahY + 3);
      }

      if (profile.stats.val > 0) {
        const valY = priceToY(profile.stats.val);
        ctx.strokeStyle = profile.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(margin.left, valY);
        ctx.lineTo(margin.left + chartWidth, valY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        ctx.fillStyle = profile.color;
        ctx.font = '9px sans-serif';
        ctx.fillText(`${label} VAL`, margin.left + chartWidth + 5, valY + 3);
      }
    });
  }, [data, width, height, selectedRange, isSelecting, selectionStart, hoverIndex, priceToY, indexToX, candleWidth, candleSpacing, chartWidth, chartHeight, margin, pinnedProfiles]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const index = xToIndex(x);

    if (index >= 0 && index < data.length) {
      if (e.ctrlKey) {
        // Ctrl + 鼠标左键：开始缩放
        setIsZooming(true);
        setZoomStart(index);
      } else {
        // 普通鼠标左键：开始选择
        setIsSelecting(true);
        setSelectionStart(index);
      }
      setHoverIndex(index);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const index = xToIndex(x);

    if (index >= 0 && index < data.length) {
      setHoverIndex(index);
    }
  };

  const handleMouseUp = () => {
    if (isZooming && zoomStart !== null && hoverIndex !== null) {
      const start = Math.min(zoomStart, hoverIndex);
      const end = Math.max(zoomStart, hoverIndex);

      if (start !== end) {
        onZoom({ startIndex: start, endIndex: end });
      }
      setIsZooming(false);
      setZoomStart(null);
    } else if (isSelecting && selectionStart !== null && hoverIndex !== null) {
      const start = Math.min(selectionStart, hoverIndex);
      const end = Math.max(selectionStart, hoverIndex);

      if (start !== end) {
        onRangeSelect({ startIndex: start, endIndex: end });
      } else {
        onRangeSelect(null);
      }
      setIsSelecting(false);
      setSelectionStart(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    if (isSelecting) {
      setIsSelecting(false);
      setSelectionStart(null);
    }
    if (isZooming) {
      setIsZooming(false);
      setZoomStart(null);
    }
  };

  const handleDoubleClick = () => {
    onRangeSelect(null);
    onZoom(null); // 双击重置缩放
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
      className="cursor-crosshair"
    />
  );
};
