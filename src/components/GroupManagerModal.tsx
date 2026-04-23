import React, { useState } from 'react';
import type { WatchlistGroup } from '../types/stock';

const GROUP_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

interface GroupManagerModalProps {
  groups: WatchlistGroup[];
  onAdd: (name: string, color: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

export const GroupManagerModal: React.FC<GroupManagerModalProps> = ({
  groups,
  onAdd,
  onRemove,
  onClose
}) => {
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedColor, setSelectedColor] = useState(GROUP_COLORS[0]);
  const [showForm, setShowForm] = useState(false);

  const handleAdd = () => {
    if (newGroupName.trim()) {
      onAdd(newGroupName.trim(), selectedColor);
      setNewGroupName('');
      setSelectedColor(GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)]);
      setShowForm(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-slate-800 rounded-lg border border-slate-700 shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="font-semibold text-slate-200">管理自选股分组</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-4 max-h-96 overflow-y-auto">
          <div className="space-y-2 mb-4">
            {groups.map(group => (
              <div
                key={group.id}
                className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: group.color }}
                  ></div>
                  <span className="text-sm text-slate-200">{group.name}</span>
                  <span className="text-xs text-slate-500">({group.id === 'default' ? '默认' : ''})</span>
                </div>
                {group.id !== 'default' && (
                  <button
                    onClick={() => onRemove(group.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                  >
                    <i className="fas fa-trash text-xs"></i>
                  </button>
                )}
              </div>
            ))}
          </div>

          {showForm ? (
            <div className="space-y-3 p-3 bg-slate-700/30 rounded-lg">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="分组名称"
                className="w-full bg-slate-700 text-sm text-white placeholder-slate-400 px-3 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">颜色:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {GROUP_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-6 h-6 rounded-full transition-all ${
                        selectedColor === color ? 'ring-2 ring-white scale-110' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors flex-1"
                >
                  添加
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded transition-colors flex-1"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded transition-colors flex items-center justify-center gap-2"
            >
              <i className="fas fa-plus"></i>
              新建分组
            </button>
          )}

          <div className="mt-4 text-xs text-slate-500 space-y-1">
            <div className="flex items-start gap-2">
              <i className="fas fa-info-circle mt-0.5"></i>
              <span>每个分组可以存放不同的自选股</span>
            </div>
            <div className="flex items-start gap-2">
              <i className="fas fa-exclamation-triangle mt-0.5"></i>
              <span>删除分组会同时删除该分组下的所有自选股</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
