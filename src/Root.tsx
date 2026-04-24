import React, { useState, useCallback } from 'react';
import App from './App';
import { VolatilityPage } from './components/VolatilityPage';
import { SkewScannerPage } from './components/SkewScannerPage';
import { NavigationProvider } from './NavigationContext';

const Root: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'volume' | 'volatility' | 'scanner'>('volume');
  const [navTarget, setNavTarget] = useState<{ code: string; name: string; timestamp: number } | null>(null);

  const handleNavigate = useCallback((tab: 'volume' | 'volatility', code: string, name: string) => {
    setNavTarget({ code, name, timestamp: Date.now() });
    setActiveTab(tab);
  }, []);

  return (
    <NavigationProvider onNavigate={handleNavigate}>
      <div className="min-h-screen bg-slate-900">
        <div className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setNavTarget(null); setActiveTab('volume'); }}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'volume'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <i className="fas fa-chart-bar mr-2"></i>
                筹码分布
              </button>
              <button
                onClick={() => { setNavTarget(null); setActiveTab('volatility'); }}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'volatility'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <i className="fas fa-chart-area mr-2"></i>
                波动率分析
              </button>
              <button
                onClick={() => { setNavTarget(null); setActiveTab('scanner'); }}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'scanner'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <i className="fas fa-radar mr-2"></i>
                偏度扫描器
              </button>
            </div>
          </div>
        </div>
        {activeTab === 'volume' ? (
          <App key={navTarget?.timestamp || 'default'} initialStockCode={navTarget?.code} initialStockName={navTarget?.name} />
        ) : activeTab === 'volatility' ? (
          <VolatilityPage key={navTarget?.timestamp || 'default'} initialStockCode={navTarget?.code} initialStockName={navTarget?.name} />
        ) : (
          <SkewScannerPage />
        )}
      </div>
    </NavigationProvider>
  );
};

export default Root;
