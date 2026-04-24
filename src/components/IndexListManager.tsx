import React, { useState, useCallback } from 'react';
import { LOCAL_INDEX_LIST, saveIndicesList, type IndexItem } from '../config/indices';
import { getQuote } from '../services/stockApi';
import { Toast, useToast } from './Toast';

export const IndexListManager: React.FC = () => {
  const { showToast, toasts, dismissToast } = useToast();
  const [indices, setIndices] = useState<IndexItem[]>(() => {
    try {
      return LOCAL_INDEX_LIST;
    } catch {
      return [];
    }
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ code: string; name: string }>({ code: '', name: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<{ code: string; name: string }>({ code: '', name: '' });
  const [testStatus, setTestStatus] = useState<Record<number, 'testing' | 'success' | 'error' | null>>({});
  const [isTestingAll, setIsTestingAll] = useState(false);

  const handleSaveIndices = useCallback((newIndices: IndexItem[]) => {
    setIndices(newIndices);
    try {
      saveIndicesList(newIndices);
    } catch (error) {
      console.error('保存指数列表失败:', error);
    }
  }, []);

  const handleAdd = useCallback(() => {
    const code = addForm.code.trim();
    const name = addForm.name.trim();
    if (!code || !name) {
      showToast('请填写完整的代码和名称', 'error');
      return;
    }
    const prefix = code.startsWith('sh') || code.startsWith('sz') ? code : 
      (code.startsWith('6') ? 'sh' : 'sz') + code;
    const exists = indices.find(item => item.code === prefix);
    if (exists) {
      showToast(`指数 ${prefix} 已存在`, 'error');
      return;
    }
    const newItem: IndexItem = { code: prefix, name };
    handleSaveIndices([...indices, newItem]);
    setAddForm({ code: '', name: '' });
    setShowAddForm(false);
    showToast(`已添加 ${name}`, 'success');
  }, [addForm, indices, handleSaveIndices, showToast]);

  const handleDelete = useCallback((index: number) => {
    const item = indices[index];
    if (window.confirm(`确定删除 ${item.name} (${item.code})？`)) {
      const updated = [...indices];
      updated.splice(index, 1);
      handleSaveIndices(updated);
      setTestStatus(prev => {
        const next = { ...prev };
        delete next[index];
        const rekeyed: Record<number, 'testing' | 'success' | 'error' | null> = {};
        Object.keys(next).forEach(k => {
          const numKey = parseInt(k);
          rekeyed[numKey > index ? numKey - 1 : numKey] = next[numKey];
        });
        return rekeyed;
      });
      showToast(`已删除 ${item.name}`, 'success');
    }
  }, [indices, handleSaveIndices, showToast]);

  const handleEditStart = useCallback((index: number) => {
    setEditingIndex(index);
    setEditForm({ code: indices[index].code, name: indices[index].name });
  }, [indices]);

  const handleEditSave = useCallback(() => {
    if (editingIndex === null) return;
    const code = editForm.code.trim();
    const name = editForm.name.trim();
    if (!code || !name) {
      showToast('请填写完整的代码和名称', 'error');
      return;
    }
    const updated = [...indices];
    updated[editingIndex] = { code, name };
    handleSaveIndices(updated);
    setEditingIndex(null);
    setEditForm({ code: '', name: '' });
    showToast(`已更新 ${name}`, 'success');
  }, [editingIndex, editForm, indices, handleSaveIndices, showToast]);

  const handleEditCancel = useCallback(() => {
    setEditingIndex(null);
    setEditForm({ code: '', name: '' });
  }, []);

  const handleTestSingle = useCallback(async (index: number) => {
    const item = indices[index];
    setTestStatus(prev => ({ ...prev, [index]: 'testing' }));
    try {
      const { data, error } = await getQuote(item.code);
      setTestStatus(prev => ({ ...prev, [index]: error || !data ? 'error' : 'success' }));
    } catch {
      setTestStatus(prev => ({ ...prev, [index]: 'error' }));
    }
  }, [indices]);

  const handleTestAll = useCallback(async () => {
    setIsTestingAll(true);
    const newStatus: Record<number, 'testing' | 'success' | 'error' | null> = {};
    indices.forEach((_, i) => { newStatus[i] = 'testing'; });
    setTestStatus(newStatus);

    for (let i = 0; i < indices.length; i++) {
      try {
        const { data, error } = await getQuote(indices[i].code);
        setTestStatus(prev => ({ ...prev, [i]: error || !data ? 'error' : 'success' }));
      } catch {
        setTestStatus(prev => ({ ...prev, [i]: 'error' }));
      }
    }

    setIsTestingAll(false);
  }, [indices]);

  const handleResetToDefault = useCallback(() => {
    if (window.confirm('确定重置为默认指数列表？所有自定义修改将丢失。')) {
      fetch('/src/config/indices.json')
        .then(res => res.json())
        .then((data: IndexItem[]) => {
          handleSaveIndices(data);
          setTestStatus({});
          showToast('已重置为默认列表', 'success');
        })
        .catch(() => {
          showToast('无法加载默认数据', 'error');
        });
    }
  }, [handleSaveIndices, showToast]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">指数列表管理</h1>
            <p className="text-sm text-slate-400 mt-1">管理搜索框中显示的指数，共 {indices.length} 个</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleTestAll}
              disabled={isTestingAll || indices.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              <i className={`fas ${isTestingAll ? 'fa-spinner fa-spin' : 'fa-vial'}`}></i>
              {isTestingAll ? '测试中...' : '测试全部'}
            </button>
            <button
              onClick={handleResetToDefault}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              <i className="fas fa-undo"></i>
              重置默认
            </button>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-slate-200">指数列表</h2>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
            >
              <i className="fas fa-plus"></i>
              添加指数
            </button>
          </div>

          {showAddForm && (
            <div className="px-4 py-3 bg-emerald-600/10 border-b border-emerald-500/30">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={addForm.code}
                  onChange={(e) => setAddForm(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="指数代码 (如 sh880656)"
                  className="bg-slate-700 text-white text-sm px-3 py-1.5 rounded border border-slate-600 w-40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="指数名称 (如 CPO概念)"
                  className="bg-slate-700 text-white text-sm px-3 py-1.5 rounded border border-slate-600 w-40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleAdd}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded transition-colors"
                >
                  确认添加
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setAddForm({ code: '', name: '' }); }}
                  className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-200 text-sm rounded transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-700">
            {indices.map((item, index) => {
              const status = testStatus[index];
              const rowBg = status === 'success' ? 'bg-emerald-600/5' : status === 'error' ? 'bg-red-600/5' : '';
              return (
                <div key={item.code} className={`px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors ${rowBg}`}>
                  {editingIndex === index ? (
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="text"
                        value={editForm.code}
                        onChange={(e) => setEditForm(prev => ({ ...prev, code: e.target.value }))}
                        className="bg-slate-700 text-white text-sm px-3 py-1.5 rounded border border-slate-600 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className="bg-slate-700 text-white text-sm px-3 py-1.5 rounded border border-slate-600 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleEditSave}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
                      >
                        保存
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-200 text-sm rounded transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-sm w-8">{index + 1}</span>
                        {status && (
                          <div className={`w-2 h-2 rounded-full ${
                            status === 'success' ? 'bg-emerald-400' :
                            status === 'error' ? 'bg-red-400' :
                            'bg-blue-400 animate-pulse'
                          }`}></div>
                        )}
                        <div>
                          <span className="font-mono text-blue-400 text-sm">{item.code}</span>
                          <span className="text-slate-300 ml-3">{item.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTestSingle(index)}
                          disabled={isTestingAll}
                          className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 disabled:bg-slate-700 disabled:text-slate-500 text-blue-400 text-xs rounded transition-colors"
                          title="测试此指数"
                        >
                          <i className="fas fa-vial"></i>
                        </button>
                        <button
                          onClick={() => handleEditStart(index)}
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(index)}
                          className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs rounded transition-colors"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            {indices.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-500">
                <i className="fas fa-inbox text-3xl mb-2"></i>
                <p>暂无指数，点击"添加指数"开始添加</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 mt-6">
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <i className="fas fa-info-circle text-blue-400"></i>
            使用说明
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li>添加的指数会自动保存到本地存储，刷新页面后仍然有效</li>
            <li>指数代码需要包含交易所前缀（sh 或 sz），如 sh880656、sz399001</li>
            <li>sh88 开头的是概念板块指数，sh0/sz399 开头的是标准指数</li>
            <li>点击每行的 测试按钮或顶部"测试全部"可验证指数数据是否能获取，绿色=成功，红色=失败</li>
            <li>点击"重置默认"会恢复为初始的指数列表</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
