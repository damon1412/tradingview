import React, { useState, useCallback, useEffect } from 'react';
import App from './App';
import { VolatilityPage } from './components/VolatilityPage';
import { SkewScannerPage } from './components/SkewScannerPage';
import { SectorSkewScannerPage } from './components/SectorSkewScannerPage';
import { SectorVolumeProfilePage } from './components/SectorVolumeProfilePage';
import { NavigationProvider } from './NavigationContext';

const Root: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'volume' | 'volatility' | 'scanner' | 'sector-scanner' | 'sector-volume'>('volume');
  const [navTarget, setNavTarget] = useState<{ code: string; name: string; timestamp: number } | null>(null);
  const [sectorNavTarget, setSectorNavTarget] = useState<{ code: string; name: string; timestamp: number } | null>(null);

  const handleNavigate = useCallback((tab: 'volume' | 'volatility' | 'sector-volume', code: string, name: string) => {
    if (tab === 'sector-volume') {
      setSectorNavTarget({ code, name, timestamp: Date.now() });
      setActiveTab('sector-volume');
    } else {
      setNavTarget({ code, name, timestamp: Date.now() });
      setActiveTab(tab);
    }
  }, []);

  const handleSectorVolumeClick = useCallback(() => {
    const defaultCode = 'sh880660';
    const defaultName = '半导体';
    setSectorNavTarget({ code: defaultCode, name: defaultName, timestamp: Date.now() });
    setActiveTab('sector-volume');
  }, []);

  return (
    <NavigationProvider onNavigate={handleNavigate}>
      <div className="min-h-screen bg-slate-900">
        <div className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setNavTarget(null); setSectorNavTarget(null); setActiveTab('volume'); }}
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
                onClick={handleSectorVolumeClick}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'sector-volume'
                    ? 'border-teal-500 text-teal-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <i className="fas fa-layer-group mr-2"></i>
                板块筹码
              </button>
              <button
                onClick={() => { setNavTarget(null); setSectorNavTarget(null); setActiveTab('volatility'); }}
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
                onClick={() => { setNavTarget(null); setSectorNavTarget(null); setActiveTab('scanner'); }}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'scanner'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <i className="fas fa-radar mr-2"></i>
                偏度扫描器
              </button>
              <button
                onClick={() => { setNavTarget(null); setSectorNavTarget(null); setActiveTab('sector-scanner'); }}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'sector-scanner'
                    ? 'border-violet-500 text-violet-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <i className="fas fa-chart-pie mr-2"></i>
                板块偏度
              </button>
            </div>
          </div>
        </div>
        {activeTab === 'volume' ? (
          <App key={navTarget?.timestamp || 'default'} initialStockCode={navTarget?.code} initialStockName={navTarget?.name} />
        ) : activeTab === 'volatility' ? (
          <VolatilityPage key={navTarget?.timestamp || 'default'} initialStockCode={navTarget?.code} initialStockName={navTarget?.name} />
        ) : activeTab === 'sector-volume' ? (
          <SectorVolumeProfilePage 
            key={sectorNavTarget?.timestamp || 'default'}
            sectorCode={sectorNavTarget?.code || ''}
            sectorName={sectorNavTarget?.name || ''}
          />
        ) : activeTab === 'sector-scanner' ? (
          <SectorSkewScannerPage />
        ) : (
          <SkewScannerPage />
        )}
      </div>
    </NavigationProvider>
  );
};

export default Root;
