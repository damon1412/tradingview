import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WatchlistItem, WatchlistGroup } from '../types/stock';

interface WatchlistPanelProps {
  items: WatchlistItem[];
  currentCode: string;
  currentName: string;
  groups: WatchlistGroup[];
  activeGroup: string;
  onAdd: () => void;
  onAddCurrent: () => void;
  onSelect: (code: string, name: string) => void;
  onRemove: (code: string) => void;
  onClose: () => void;
  onSwitchGroup: (groupId: string) => void;
  onManageGroups: () => void;
  onReorder: (items: WatchlistItem[]) => void;
  isMobile?: boolean;
  visible?: boolean;
}

export const WatchlistPanel: React.FC<WatchlistPanelProps> = ({
  items,
  currentCode,
  currentName,
  groups,
  activeGroup,
  onAdd,
  onAddCurrent,
  onSelect,
  onRemove,
  onClose,
  onSwitchGroup,
  onManageGroups,
  onReorder,
  isMobile = false,
  visible = true
}) => {
  const [showConfirmClear, setShowConfirmClear] = useState<string | null>(null);
  const [translateY, setTranslateY] = useState(0);
  const [draggedItem, setDraggedItem] = useState<WatchlistItem | null>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const isCurrentInWatchlist = items.some(item => item.code === currentCode);
  const closeThreshold = 100;

  const handleDragStart = useCallback((item: WatchlistItem) => {
    setDraggedItem(item);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetItem: WatchlistItem) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.code === targetItem.code) return;
    
    const draggedIdx = items.findIndex(i => i.code === draggedItem.code);
    const targetIdx = items.findIndex(i => i.code === targetItem.code);
    
    if (draggedIdx !== -1 && targetIdx !== -1) {
      const newItems = [...items];
      const [removed] = newItems.splice(draggedIdx, 1);
      newItems.splice(targetIdx, 0, removed);
      onReorder(newItems);
    }
  }, [draggedItem, items, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
  }, []);

  const isIndex = (code: string) => {
    return code.startsWith('000') || code.startsWith('399') || code.startsWith('899');
  };

  const stocks = items.filter(item => !isIndex(item.code));
  const indices = items.filter(item => isIndex(item.code));

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    startY.current = touch.clientY;
    currentY.current = touch.clientY;
    isDragging.current = false;
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !visible) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - startY.current;
    
    if (deltaY > 0) {
      isDragging.current = true;
      currentY.current = touch.clientY;
      setTranslateY(deltaY);
      e.preventDefault();
    }
  }, [isMobile, visible]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile) return;
    
    if (translateY > closeThreshold) {
      onClose();
    }
    setTranslateY(0);
    isDragging.current = false;
  }, [isMobile, translateY, onClose]);

  useEffect(() => {
    if (!isMobile) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !visible) return;
      const deltaY = e.clientY - startY.current;
      if (deltaY > 0) {
        currentY.current = e.clientY;
        setTranslateY(deltaY);
      }
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      if (translateY > closeThreshold) {
        onClose();
      }
      setTranslateY(0);
      isDragging.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMobile, visible, translateY, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={panelRef}
      className={`bg-slate-800 border border-slate-700 overflow-hidden transition-transform duration-300 ${
        isMobile 
          ? 'rounded-t-xl fixed inset-x-0 bottom-0 max-h-[80vh] z-50 shadow-2xl' 
          : 'rounded-lg'
      }`}
      style={isMobile && translateY > 0 ? { transform: `translateY(${translateY}px)` } : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
          <i className="fas fa-star text-yellow-500"></i>
          自选股
          <span className="text-xs text-slate-500 font-normal">({items.length})</span>
        </h3>
        <div className="flex gap-1.5">
          {!isCurrentInWatchlist && (
            <button
              onClick={onAddCurrent}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded transition-colors flex items-center gap-1"
              title={`添加当前: ${currentCode} ${currentName}`}
            >
              <i className="fas fa-plus-circle"></i>
              <span className="hidden sm:inline">添加当前</span>
            </button>
          )}
          <button
            onClick={onAdd}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition-colors flex items-center gap-1"
          >
            <i className="fas fa-plus"></i>
            <span className="hidden sm:inline">添加</span>
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            title={isMobile ? "关闭" : "收起面板"}
          >
            <i className={`fas ${isMobile ? 'fa-times' : 'fa-chevron-right'}`}></i>
          </button>
        </div>
      </div>

      {isMobile && (
        <div
          className="w-12 h-1 bg-slate-600 rounded-full mx-auto my-2 cursor-grab active:cursor-grabbing transition-all"
          style={translateY > 0 ? { backgroundColor: `rgba(100, 116, 139, ${Math.min(translateY / closeThreshold, 1)})` } : undefined}
        ></div>
      )}

      {isMobile && translateY > 0 && (
        <div className="text-center text-xs text-slate-500 -mt-2 mb-1 transition-opacity">
          {translateY > closeThreshold ? '松手关闭' : '继续下拉关闭'}
        </div>
      )}

      {groups.length > 1 && (
        <div className="px-4 py-2 border-b border-slate-700 flex items-center gap-2 overflow-x-auto">
          {groups.map(group => (
            <button
              key={group.id}
              onClick={() => onSwitchGroup(group.id)}
              className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-all ${
                group.id === activeGroup
                  ? 'text-white font-medium'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              }`}
              style={group.id === activeGroup ? { backgroundColor: group.color } : undefined}
            >
              {group.name}
            </button>
          ))}
          <button
            onClick={onManageGroups}
            className="text-xs text-slate-500 hover:text-slate-300 p-1 transition-colors"
            title="管理分组"
          >
            <i className="fas fa-cog"></i>
          </button>
        </div>
      )}

      <div className={`${isMobile ? 'max-h-[calc(80vh-80px)]' : 'max-h-96'} overflow-y-auto`}>
        {items.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-slate-500 text-sm mb-2">暂无自选股</div>
            <div className="text-xs text-slate-600 mb-3">点击"添加"开始追踪你关注的股票</div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {!isCurrentInWatchlist && (
                <button
                  onClick={onAddCurrent}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded transition-colors"
                >
                  <i className="fas fa-plus-circle mr-1"></i>
                  添加当前 {currentCode}
                </button>
              )}
              <button
                onClick={onAdd}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors"
              >
                <i className="fas fa-plus mr-1"></i>
                搜索添加
              </button>
            </div>
          </div>
        ) : (
          <motion.div className="py-2" layout>
            {stocks.length > 0 && (
              <>
                {indices.length > 0 && (
                  <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 bg-slate-700/30">
                    <i className="fas fa-chart-line mr-1"></i>股票
                  </div>
                )}
                <AnimatePresence>
                  {stocks.map(item => (
                    <motion.div
                      key={item.code}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0 }}
                      transition={{ duration: 0.2 }}
                      draggable
                      onDragStart={() => handleDragStart(item)}
                      onDragOver={(e) => handleDragOver(e, item)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onSelect(item.code, item.name)}
                      className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-all group ${
                        item.code === currentCode
                          ? 'bg-blue-600/20 border-l-2 border-blue-500'
                          : 'hover:bg-slate-700/50 border-l-2 border-transparent'
                      }`}
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <i className="fas fa-grip-vertical text-slate-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"></i>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-blue-400">{item.code}</span>
                            {item.code === currentCode && (
                              <span className="text-xs bg-blue-600/30 text-blue-400 px-1.5 py-0.5 rounded">
                                当前
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 truncate">{item.name}</div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (showConfirmClear === item.code) {
                            onRemove(item.code);
                            setShowConfirmClear(null);
                          } else {
                            setShowConfirmClear(item.code);
                            setTimeout(() => setShowConfirmClear(null), 2000);
                          }
                        }}
                        className={`transition-colors p-1 rounded ${
                          showConfirmClear === item.code
                            ? 'text-red-400 bg-red-400/10'
                            : 'text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100'
                        }`}
                        title={showConfirmClear === item.code ? '再次点击确认删除' : '删除'}
                      >
                        <i className={`fas ${showConfirmClear === item.code ? 'fa-check' : 'fa-trash'} text-xs`}></i>
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </>
            )}

            {indices.length > 0 && (
              <>
                <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 bg-slate-700/30 mt-2">
                  <i className="fas fa-chart-bar mr-1"></i>指数
                </div>
                <AnimatePresence>
                  {indices.map(item => (
                    <motion.div
                      key={item.code}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0 }}
                      transition={{ duration: 0.2 }}
                      draggable
                      onDragStart={() => handleDragStart(item)}
                      onDragOver={(e) => handleDragOver(e, item)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onSelect(item.code, item.name)}
                      className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-all group ${
                        item.code === currentCode
                          ? 'bg-blue-600/20 border-l-2 border-blue-500'
                          : 'hover:bg-slate-700/50 border-l-2 border-transparent'
                      }`}
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <i className="fas fa-grip-vertical text-slate-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"></i>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-amber-400">{item.code}</span>
                            {item.code === currentCode && (
                              <span className="text-xs bg-blue-600/30 text-blue-400 px-1.5 py-0.5 rounded">
                                当前
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 truncate">{item.name}</div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (showConfirmClear === item.code) {
                            onRemove(item.code);
                            setShowConfirmClear(null);
                          } else {
                            setShowConfirmClear(item.code);
                            setTimeout(() => setShowConfirmClear(null), 2000);
                          }
                        }}
                        className={`transition-colors p-1 rounded ${
                          showConfirmClear === item.code
                            ? 'text-red-400 bg-red-400/10'
                            : 'text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100'
                        }`}
                        title={showConfirmClear === item.code ? '再次点击确认删除' : '删除'}
                      >
                        <i className={`fas ${showConfirmClear === item.code ? 'fa-check' : 'fa-trash'} text-xs`}></i>
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </>
            )}
          </motion.div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50">
        <div className="flex items-start gap-2 text-xs text-slate-500">
          <i className="fas fa-info-circle mt-0.5"></i>
          <span>点击股票切换到该股票</span>
        </div>
      </div>
    </div>
  );
};
