import React, { useState, useCallback } from 'react';

interface ToastMessage {
  id: number;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
}

let toastId = 0;

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2">
    {toasts.map(toast => (
      <div
        key={toast.id}
        className={`px-4 py-3 rounded-lg shadow-lg text-sm text-white flex items-center gap-2 max-w-sm ${
          toast.type === 'error' ? 'bg-red-600' :
          toast.type === 'warning' ? 'bg-amber-600' :
          toast.type === 'success' ? 'bg-emerald-600' :
          'bg-blue-600'
        }`}
      >
        <i className={`fas ${
          toast.type === 'error' ? 'fa-exclamation-circle' :
          toast.type === 'warning' ? 'fa-exclamation-triangle' :
          toast.type === 'success' ? 'fa-check-circle' :
          'fa-info-circle'
        }`}></i>
        <span className="flex-1">{toast.message}</span>
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-white/80 hover:text-white ml-2"
        >
          ×
        </button>
      </div>
    ))}
  </div>
);

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { showToast, toasts, dismissToast };
};
