import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { StockData, VolatilityData, VolatilityIndicator, GridResult, TradingSignal } from '../types/stock';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface VolatilityChartProps {
  stockData: StockData[];
  volatilityData: VolatilityData[];
  width: number;
  height: number;
  indicator: VolatilityIndicator;
  showBollingerBands: boolean;
  gridResult?: GridResult | null;
  signal?: TradingSignal | null;
}

const INDICATOR_CONFIG: Record<VolatilityIndicator, { label: string; color: string; key: keyof VolatilityData; unit: string }> = {
  volatility: { label: '波动率 (%)', color: '#8b5cf6', key: 'volatility', unit: '%' },
  atr: { label: 'ATR', color: '#06b6d4', key: 'atr', unit: '' },
  hv: { label: '历史波动率 (%)', color: '#f59e0b', key: 'hv', unit: '%' }
};

export const VolatilityChart: React.FC<VolatilityChartProps> = ({
  stockData,
  volatilityData,
  width,
  height,
  indicator,
  showBollingerBands,
  gridResult,
  signal
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const margin = { top: 20, right: 80, bottom: 40, left: 10 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  const priceChartHeight = chartHeight * 0.6;
  const volChartHeight = chartHeight * 0.4;
  const dividerHeight = 20;

  const candleWidth = Math.max(2, (chartWidth / stockData.length) * 0.7);
  const candleSpacing = chartWidth / stockData.length;

  const priceRange = useMemo(() => {
    if (stockData.length === 0) return { min: 0, max: 1 };
    let min = Math.min(...stockData.map(d => d.low));
    let max = Math.max(...stockData.map(d => d.high));

    if (showBollingerBands && volatilityData.length > 0) {
      const bbUpperValues = volatilityData.map(v => v.bbUpper).filter(v => v > 0);
      const bbLowerValues = volatilityData.map(v => v.bbLower).filter(v => v > 0);
      if (bbUpperValues.length > 0 && bbLowerValues.length > 0) {
        min = Math.min(min, Math.min(...bbLowerValues));
        max = Math.max(max, Math.max(...bbUpperValues));
      }
    }

    if (gridResult && gridResult.grids.length > 0) {
      const gridPrices = gridResult.grids.map(g => g.price);
      min = Math.min(min, Math.min(...gridPrices));
      max = Math.max(max, Math.max(...gridPrices));
    }

    return { min, max };
  }, [stockData, volatilityData, showBollingerBands, gridResult]);

  const indicatorConfig = INDICATOR_CONFIG[indicator];
  const indicatorKey = indicatorConfig.key;

  const indicatorRange = volatilityData.length > 0 ? {
    min: 0,
    max: Math.max(...volatilityData.map(v => v[indicatorKey] as number).filter((v: number) => v > 0), 1)
  } : { min: 0, max: 1 };

  const priceToY = useCallback((price: number) => {
    const range = priceRange.max - priceRange.min;
    if (range === 0) return margin.top + priceChartHeight / 2;
    return margin.top + priceChartHeight - ((price - priceRange.min) / range) * priceChartHeight;
  }, [priceRange, priceChartHeight, margin.top]);

  const indicatorToY = useCallback((value: number) => {
    const range = indicatorRange.max - indicatorRange.min;
    if (range === 0) return margin.top + priceChartHeight + dividerHeight + volChartHeight;
    return margin.top + priceChartHeight + dividerHeight + volChartHeight - ((value - indicatorRange.min) / range) * volChartHeight;
  }, [indicatorRange, volChartHeight, priceChartHeight, dividerHeight, margin.top]);

  const indexToX = useCallback((index: number) => {
    return margin.left + index * candleSpacing + candleSpacing / 2;
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
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left + chartWidth, margin.top);
    ctx.lineTo(margin.left + chartWidth, margin.top + priceChartHeight);
    ctx.lineTo(margin.left, margin.top + priceChartHeight);
    ctx.lineTo(margin.left, margin.top);
    ctx.stroke();

    const volTop = margin.top + priceChartHeight + dividerHeight;
    ctx.beginPath();
    ctx.moveTo(margin.left, volTop);
    ctx.lineTo(margin.left + chartWidth, volTop);
    ctx.lineTo(margin.left + chartWidth, volTop + volChartHeight);
    ctx.lineTo(margin.left, volTop + volChartHeight);
    ctx.lineTo(margin.left, volTop);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('价格', margin.left + 5, margin.top + 15);

    ctx.fillStyle = indicatorConfig.color;
    ctx.fillText(indicatorConfig.label, margin.left + 5, volTop + 15);

    stockData.forEach((candle, index) => {
      const x = indexToX(index);
      const isUp = candle.close >= candle.open;

      ctx.strokeStyle = isUp ? '#10b981' : '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, priceToY(candle.high));
      ctx.lineTo(x, priceToY(candle.low));
      ctx.stroke();

      const openY = priceToY(candle.open);
      const closeY = priceToY(candle.close);
      const bodyHeight = Math.max(1, Math.abs(closeY - openY));

      ctx.fillStyle = isUp ? '#10b981' : '#ef4444';
      ctx.fillRect(x - candleWidth / 2, Math.min(openY, closeY), candleWidth, bodyHeight);

      ctx.strokeStyle = isUp ? '#10b981' : '#ef4444';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - candleWidth / 2, Math.min(openY, closeY), candleWidth, bodyHeight);
    });

    if (showBollingerBands && volatilityData.length > 0) {
      const fillGradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + priceChartHeight);
      fillGradient.addColorStop(0, 'rgba(245, 158, 11, 0.08)');
      fillGradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.03)');
      fillGradient.addColorStop(1, 'rgba(245, 158, 11, 0.08)');

      ctx.fillStyle = fillGradient;
      ctx.beginPath();
      let firstBB = true;
      volatilityData.forEach((v, index) => {
        if (v.bbUpper === 0) return;
        const x = indexToX(index);
        const y = priceToY(v.bbUpper);
        if (firstBB) {
          ctx.moveTo(x, y);
          firstBB = false;
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      for (let i = volatilityData.length - 1; i >= 0; i--) {
        const v = volatilityData[i];
        if (v.bbLower === 0) continue;
        const x = indexToX(i);
        const y = priceToY(v.bbLower);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      firstBB = true;
      volatilityData.forEach((v, index) => {
        if (v.bbUpper === 0) return;
        const x = indexToX(index);
        const y = priceToY(v.bbUpper);
        if (firstBB) {
          ctx.moveTo(x, y);
          firstBB = false;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      ctx.beginPath();
      firstBB = true;
      volatilityData.forEach((v, index) => {
        if (v.bbMiddle === 0) return;
        const x = indexToX(index);
        const y = priceToY(v.bbMiddle);
        if (firstBB) {
          ctx.moveTo(x, y);
          firstBB = false;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      firstBB = true;
      volatilityData.forEach((v, index) => {
        if (v.bbLower === 0) return;
        const x = indexToX(index);
        const y = priceToY(v.bbLower);
        if (firstBB) {
          ctx.moveTo(x, y);
          firstBB = false;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
      ctx.stroke();

      const lastValidBB = [...volatilityData].reverse().find(v => v.bbUpper > 0);
      if (lastValidBB) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('BOLL', margin.left + chartWidth + 5, priceToY(lastValidBB.bbMiddle) + 3);
      }
    }

    if (gridResult && gridResult.grids.length > 0) {
      const sortedGrids = [...gridResult.grids].sort((a, b) => b.price - a.price);
      const priceValues = sortedGrids.map(g => g.price);
      const levels = sortedGrids.map(g => g.level);

      const gridGradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + priceChartHeight);
      gridGradient.addColorStop(0, 'rgba(34, 197, 94, 0.06)');
      gridGradient.addColorStop(1, 'rgba(34, 197, 94, 0.02)');
      
      ctx.fillStyle = gridGradient;
      ctx.fillRect(margin.left, margin.top, chartWidth, priceChartHeight);

      sortedGrids.forEach((grid, idx) => {
        const y = priceToY(grid.price);
        if (y < margin.top || y > margin.top + priceChartHeight) return;

        const isBase = grid.level === 0;
        const isBuy = grid.level > 0;
        const gridColor = isBase ? '#22c55e' : isBuy ? '#10b981' : '#ef4444';

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = isBase ? 2 : 1;
        if (!isBase) {
          ctx.setLineDash([6, 4]);
        }
        
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(margin.left + chartWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);

        if (isBase || idx % 2 === 0) {
          const label = grid.level > 0 ? `卖${grid.level}` : grid.level < 0 ? `买${Math.abs(grid.level)}` : '基准';
          const labelY = Math.max(margin.top + 10, Math.min(margin.top + priceChartHeight - 5, y));
          
          ctx.fillStyle = gridColor + 'cc';
          ctx.font = isBase ? 'bold 10px sans-serif' : '9px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`${label} ${grid.price.toFixed(2)}`, margin.left + chartWidth + 5, labelY + 3);
        }
      });
    }

    if (volatilityData.length > 0) {
      const gradient = ctx.createLinearGradient(0, volTop, 0, volTop + volChartHeight);
      gradient.addColorStop(0, indicatorConfig.color + '40');
      gradient.addColorStop(1, indicatorConfig.color + '08');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      let firstPoint = true;
      let lastIndex = 0;

      volatilityData.forEach((v, index) => {
        const val = v[indicatorKey] as number;
        if (val === 0) return;
        const x = indexToX(index);
        const y = indicatorToY(val);

        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
        lastIndex = index;
      });

      ctx.lineTo(indexToX(lastIndex), volTop + volChartHeight);
      ctx.lineTo(indexToX(0), volTop + volChartHeight);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = indicatorConfig.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      firstPoint = true;

      volatilityData.forEach((v, index) => {
        const val = v[indicatorKey] as number;
        if (val === 0) return;
        const x = indexToX(index);
        const y = indicatorToY(val);

        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      const validValues = volatilityData.map(v => v[indicatorKey] as number).filter((v: number) => v > 0);
      if (validValues.length > 0) {
        const avgValue = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
        const avgY = indicatorToY(avgValue);

        ctx.strokeStyle = indicatorConfig.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(margin.left, avgY);
        ctx.lineTo(margin.left + chartWidth, avgY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        ctx.fillStyle = indicatorConfig.color;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`平均: ${avgValue.toFixed(2)}${indicatorConfig.unit}`, margin.left + chartWidth + 8, avgY + 3);
      }
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';

    const priceSteps = 5;
    for (let i = 0; i <= priceSteps; i++) {
      const price = priceRange.min + ((priceRange.max - priceRange.min) / priceSteps) * (priceSteps - i);
      const y = priceToY(price);
      ctx.fillText(price.toFixed(2), margin.left + chartWidth + 5, y + 3);
    }

    ctx.fillStyle = indicatorConfig.color;
    const indSteps = 5;
    for (let i = 0; i <= indSteps; i++) {
      const val = indicatorRange.min + ((indicatorRange.max - indicatorRange.min) / indSteps) * (indSteps - i);
      const y = indicatorToY(val);
      ctx.fillText(`${val.toFixed(2)}${indicatorConfig.unit}`, margin.left + chartWidth + 5, y + 3);
    }

    const labelCount = Math.min(6, stockData.length);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i < labelCount; i++) {
      const index = Math.floor((i / (labelCount - 1)) * (stockData.length - 1));
      const x = indexToX(index);
      const date = new Date(stockData[index].timestamp);
      const label = format(date, 'MM/dd', { locale: zhCN });
      ctx.fillText(label, x, margin.top + priceChartHeight + 12);
      ctx.fillText(label, x, volTop + volChartHeight + 15);
    }

    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < stockData.length) {
      const x = indexToX(hoverIndex);
      
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + priceChartHeight);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, volTop);
      ctx.lineTo(x, volTop + volChartHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      const stock = stockData[hoverIndex];
      const vol = volatilityData[hoverIndex];
      const indicatorValue = vol ? (vol[indicatorKey] as number) : 0;

      const tooltipWidth = 170;
      let tooltipHeight = 60;
      if (indicatorValue > 0) tooltipHeight += 18;
      if (showBollingerBands && vol && vol.bbUpper > 0) tooltipHeight += 42;
      if (vol && vol.upVolatility > 0 && vol.downVolatility > 0) tooltipHeight += 16;

      let tooltipX = x > chartWidth / 2 ? x - tooltipWidth - 10 : x + 10;
      let tooltipY = margin.top + 10;

      if (tooltipX < margin.left) tooltipX = margin.left;
      if (tooltipX + tooltipWidth > width) tooltipX = width - tooltipWidth - margin.right;
      if (tooltipY < margin.top) tooltipY = margin.top;
      if (tooltipY + tooltipHeight > height - margin.bottom) tooltipY = height - margin.bottom - tooltipHeight - 10;
      if (tooltipY + tooltipHeight > height) {
        tooltipY = Math.max(margin.top, height - tooltipHeight - 10);
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      const dateStr = format(new Date(stock.timestamp), 'yyyy-MM-dd', { locale: zhCN });
      ctx.fillText(`日期: ${dateStr}`, tooltipX + 8, tooltipY + 18);

      ctx.fillStyle = stock.close >= stock.open ? '#10b981' : '#ef4444';
      ctx.fillText(`收盘: ${stock.close.toFixed(2)}`, tooltipX + 8, tooltipY + 36);

      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`最高: ${stock.high.toFixed(2)}`, tooltipX + 8, tooltipY + 54);

      if (indicatorValue > 0) {
        ctx.fillStyle = indicatorConfig.color;
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${indicatorConfig.label.replace(' (%)', '')}: ${indicatorValue.toFixed(2)}${indicatorConfig.unit}`, tooltipX + 8, tooltipY + 72);
      }

      if (showBollingerBands && vol && vol.bbUpper > 0) {
        const bbY = indicatorValue > 0 ? tooltipY + 90 : tooltipY + 72;
        ctx.fillStyle = '#f59e0b';
        ctx.font = '10px sans-serif';
        ctx.fillText(`上轨: ${vol.bbUpper.toFixed(2)}`, tooltipX + 8, bbY);
        ctx.fillText(`中轨: ${vol.bbMiddle.toFixed(2)}`, tooltipX + 8, bbY + 14);
        ctx.fillText(`下轨: ${vol.bbLower.toFixed(2)}`, tooltipX + 8, bbY + 28);
      }

      if (vol && vol.upVolatility > 0 && vol.downVolatility > 0) {
        let skewY = indicatorValue > 0 ? tooltipY + 90 : tooltipY + 72;
        if (showBollingerBands && vol.bbUpper > 0) skewY += 42;
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px sans-serif';
        const skewColor = vol.volSkew >= 1 ? '#10b981' : '#ef4444';
        ctx.fillStyle = skewColor;
        ctx.fillText(`偏度: ${vol.volSkew.toFixed(3)}`, tooltipX + 8, skewY);
      }
    }

    if (signal && stockData.length > 0) {
      const x = indexToX(stockData.length - 1);
      const y = priceToY(stockData[stockData.length - 1].high) - 20;

      const signalColors: Record<string, string> = {
        '强势做多': '#10b981',
        '偏多，可持仓': '#22c55e',
        '中性，观望': '#94a3b8',
        '偏空，减仓': '#f97316',
        '强势做空': '#ef4444'
      };

      ctx.fillStyle = signalColors[signal] || '#94a3b8';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('S', x, y + 3);
    }
  }, [stockData, volatilityData, width, height, priceToY, indicatorToY, indexToX, priceRange, indicatorRange, candleWidth, candleSpacing, chartWidth, chartHeight, margin, hoverIndex, priceChartHeight, volChartHeight, dividerHeight, indicator, indicatorConfig, showBollingerBands, gridResult, signal]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    const ratio = (x - margin.left) / chartWidth;
    const index = Math.round(ratio * (stockData.length - 1));
    
    if (index >= 0 && index < stockData.length) {
      setHoverIndex(index);
    } else {
      setHoverIndex(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

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
