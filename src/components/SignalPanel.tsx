import React, { useState } from 'react';
import type { TradingSignalResult, TradingSignal, VolatilitySkewAnalysis } from '../types/stock';

interface SignalPanelProps {
  signalResult: TradingSignalResult | null;
  isLoading?: boolean;
}

const SIGNAL_COLORS: Record<TradingSignal, string> = {
  '强势做多': 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  '偏多，可持仓': 'text-green-400 bg-green-500/20 border-green-500/30',
  '中性，观望': 'text-slate-400 bg-slate-500/20 border-slate-500/30',
  '偏空，减仓': 'text-orange-400 bg-orange-500/20 border-orange-500/30',
  '强势做空': 'text-red-400 bg-red-500/20 border-red-500/30'
};

const SCORE_COLORS: Record<string, string> = {
  positive: 'text-emerald-400',
  negative: 'text-red-400',
  neutral: 'text-slate-400'
};

export const SignalPanel: React.FC<SignalPanelProps> = ({ signalResult, isLoading = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fas fa-spinner fa-spin text-blue-400"></i>
            <span className="text-sm text-slate-400">分析中...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!signalResult) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="px-4 py-3">
          <span className="text-sm text-slate-500">数据不足，无法进行偏度分析</span>
        </div>
      </div>
    );
  }

  const { signal, score, analysis, coverageReason } = signalResult;
  const signalColorClass = SIGNAL_COLORS[signal];
  const scoreColorClass = score > 0 ? SCORE_COLORS.positive : score < 0 ? SCORE_COLORS.negative : SCORE_COLORS.neutral;

  const formatPercent = (val: number) => {
    if (isNaN(val)) return 'N/A';
    return `${val >= 0 ? '+' : ''}${(val * 100).toFixed(1)}%`;
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-1 rounded border text-xs font-medium ${signalColorClass}`}>
            信号：{signal}
          </span>
          <span className={`text-sm font-mono font-semibold ${scoreColorClass}`}>
            评分：{score > 0 ? '+' : ''}{score}
          </span>
          {analysis.driverType !== '无明显驱动特征' && (
            <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
              {analysis.driverType}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {coverageReason && (
            <span className="text-xs text-amber-400 flex items-center gap-1">
              <i className="fas fa-exclamation-triangle"></i>
              有警告
            </span>
          )}
          <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-slate-500 text-xs transition-transform`}></i>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-700 pt-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-xs text-slate-400 mb-1">波动率水平</div>
              <div className="text-slate-200 font-mono text-sm">
                {(analysis.currentVolatility * 100).toFixed(2)}%
              </div>
              <div className={`text-xs mt-0.5 ${
                analysis.volLevel === '极度压缩' ? 'text-blue-400' :
                analysis.volLevel === '低于均值' ? 'text-cyan-400' :
                analysis.volLevel === '正常水平' ? 'text-slate-400' :
                analysis.volLevel === '偏高' ? 'text-orange-400' :
                'text-red-400'
              }`}>
                {analysis.volLevel} (比率: {analysis.volRatio.toFixed(2)})
              </div>
            </div>

            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-xs text-slate-400 mb-1">偏度方向</div>
              <div className={`font-mono text-sm ${
                analysis.skewDirection === '上行主导' ? 'text-emerald-400' :
                analysis.skewDirection === '下行主导' ? 'text-red-400' :
                'text-slate-400'
              }`}>
                {analysis.skewDirection}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                偏度比: {analysis.currentSkew.toFixed(3)}
              </div>
            </div>

            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-xs text-slate-400 mb-1">偏度偏离度</div>
              <div className="text-slate-200 font-mono text-sm">
                {formatPercent(analysis.skewDeviation)}
              </div>
              <div className={`text-xs mt-0.5 ${
                analysis.skewDeviationLevel === '极度偏高' ? 'text-purple-400' :
                analysis.skewDeviationLevel === '显著偏高' ? 'text-blue-400' :
                analysis.skewDeviationLevel === '正常范围' ? 'text-slate-400' :
                analysis.skewDeviationLevel === '显著偏低' ? 'text-orange-400' :
                'text-red-400'
              }`}>
                {analysis.skewDeviationLevel}
              </div>
            </div>

            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-xs text-slate-400 mb-1">驱动类型</div>
              <div className={`text-sm font-medium ${
                analysis.driverType === '多头进攻型' ? 'text-emerald-400' :
                analysis.driverType === '空头进攻型' ? 'text-red-400' :
                analysis.driverType === '波动放大型' ? 'text-purple-400' :
                analysis.driverType === '波动收缩型' ? 'text-blue-400' :
                'text-slate-400'
              }`}>
                {analysis.driverType}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                上行偏离: {formatPercent(analysis.upVolDeviation)} / 下行偏离: {formatPercent(analysis.downVolDeviation)}
              </div>
            </div>

            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-xs text-slate-400 mb-1">成交量</div>
              <div className={`text-sm ${
                analysis.volumeLevel === '异常放量' ? 'text-purple-400' :
                analysis.volumeLevel === '显著放量' ? 'text-blue-400' :
                analysis.volumeLevel === '正常' ? 'text-slate-400' :
                'text-orange-400'
              }`}>
                {analysis.volumeLevel} (量比: {analysis.volumeRatio.toFixed(2)})
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                量价: {analysis.volumeConfirmation}
              </div>
            </div>

            {analysis.periodConsistency && (
              <div className="bg-slate-700/50 rounded p-2">
                <div className="text-xs text-slate-400 mb-1">多周期一致性</div>
                <div className={`text-sm font-medium ${
                  analysis.periodConsistency === '完全一致' ? 'text-emerald-400' :
                  analysis.periodConsistency === '基本一致' ? 'text-green-400' :
                  analysis.periodConsistency === '中等分歧' ? 'text-orange-400' :
                  'text-red-400'
                }`}>
                  {analysis.periodConsistency}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {analysis.bullishPeriods}/{analysis.totalPeriods} 周期偏多
                </div>
              </div>
            )}
          </div>

          {coverageReason && (
            <div className="mt-3 bg-amber-900/20 border border-amber-700/30 rounded p-2.5">
              <div className="flex items-start gap-2">
                <i className="fas fa-exclamation-triangle text-amber-400 mt-0.5"></i>
                <div>
                  <div className="text-xs text-amber-300 font-medium mb-0.5">警告信息</div>
                  <div className="text-xs text-amber-200/80">{coverageReason}</div>
                </div>
              </div>
            </div>
          )}

          {analysis.isAnomaly && (
            <div className="mt-2 bg-red-900/20 border border-red-700/30 rounded p-2.5">
              <div className="flex items-start gap-2">
                <i className="fas fa-bug text-red-400 mt-0.5"></i>
                <div>
                  <div className="text-xs text-red-300 font-medium mb-0.5">异常标记</div>
                  <div className="text-xs text-red-200/80">{analysis.anomalyReason}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
