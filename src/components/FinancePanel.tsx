import React, { useEffect, useState } from 'react';

interface FinanceMetrics {
  code: string;
  report_date: string;
  report_type: string;
  eps: number | null;
  bps: number | null;
  revenue: number | null;
  net_profit: number | null;
  deduct_net_profit: number | null;
  roe: number | null;
  roa: number | null;
  debt_ratio: number | null;
  gross_margin: number | null;
  net_margin: number | null;
  current_ratio: number | null;
  rev_yoy: number | null;
  profit_yoy: number | null;
}

interface FinancePanelProps {
  stockCode: string;
}

const formatLargeNumber = (num: number | null): string => {
  if (num === null || num === undefined) return '-';
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(2)}亿`;
  }
  if (num >= 10000) {
    return `${(num / 10000).toFixed(2)}万`;
  }
  return num.toFixed(2);
};

const formatPercent = (num: number | null): string => {
  if (num === null || num === undefined) return '-';
  return `${num.toFixed(2)}%`;
};

export const FinancePanel: React.FC<FinancePanelProps> = ({ stockCode }) => {
  const [data, setData] = useState<FinanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFinanceData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/finance/${stockCode}/summary`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('暂无财务数据');
          }
          throw new Error('获取财务数据失败');
        }
        const result = await response.json();
        setData(result);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFinanceData();
  }, [stockCode]);

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <i className="fas fa-chart-line text-emerald-500"></i>
            基本面数据
          </h3>
        </div>
        <div className="p-6 text-center text-slate-500 text-sm">
          <i className="fas fa-spinner fa-spin mr-2"></i>
          加载财务数据...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <i className="fas fa-chart-line text-emerald-500"></i>
            基本面数据
          </h3>
        </div>
        <div className="p-6 text-center text-slate-500 text-sm">
          <i className="fas fa-exclamation-triangle text-amber-500 mr-2"></i>
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <i className="fas fa-chart-line text-emerald-500"></i>
            基本面数据
          </h3>
        </div>
        <div className="p-6 text-center text-slate-500 text-sm">暂无财务数据</div>
      </div>
    );
  }

  const metrics = [
    { label: '报告期', value: data.report_date || '-', icon: 'fa-calendar' },
    { label: '每股收益 (EPS)', value: data.eps !== null ? data.eps.toFixed(2) : '-', icon: 'fa-coins' },
    { label: '每股净资产 (BPS)', value: data.bps !== null ? data.bps.toFixed(2) : '-', icon: 'fa-money-bill' },
    { label: '净资产收益率 (ROE)', value: formatPercent(data.roe), icon: 'fa-chart-pie' },
    { label: '总资产收益率 (ROA)', value: formatPercent(data.roa), icon: 'fa-chart-area' },
    { label: '资产负债率', value: formatPercent(data.debt_ratio), icon: 'fa-balance-scale' },
    { label: '毛利率', value: formatPercent(data.gross_margin), icon: 'fa-percent' },
    { label: '净利率', value: formatPercent(data.net_margin), icon: 'fa-percentage' },
    { label: '流动比率', value: data.current_ratio !== null ? data.current_ratio.toFixed(2) : '-', icon: 'fa-water' },
    { label: '营业收入', value: formatLargeNumber(data.revenue), icon: 'fa-chart-line' },
    { label: '净利润', value: formatLargeNumber(data.net_profit), icon: 'fa-sack-dollar' },
    { label: '营收同比', value: formatPercent(data.rev_yoy), icon: 'fa-arrow-trend-up' },
    { label: '净利润同比', value: formatPercent(data.profit_yoy), icon: 'fa-arrow-trend-down' },
  ];

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700">
        <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
          <i className="fas fa-chart-line text-emerald-500"></i>
          基本面数据
          <span className="text-xs text-slate-500 font-normal">({data.report_date || '最新'})</span>
        </h3>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="bg-slate-700/50 rounded-lg p-2.5 hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <i className={`fas ${metric.icon} text-slate-500`}></i>
                <span>{metric.label}</span>
              </div>
              <div className="text-sm text-slate-200 font-medium">{metric.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-700">
          <div className="flex items-start gap-2 text-xs text-slate-500">
            <i className="fas fa-info-circle mt-0.5"></i>
            <span>数据来源：财务报告，仅展示最新一期主要指标</span>
          </div>
        </div>
      </div>
    </div>
  );
};
