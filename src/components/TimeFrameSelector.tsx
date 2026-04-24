import React from 'react';
import type { TimeFrame } from '../types/stock';

interface TimeFrameSelectorProps {
  value: TimeFrame;
  onChange: (timeFrame: TimeFrame) => void;
}

const timeFrames: { value: TimeFrame; label: string }[] = [
  { value: 'minute', label: '分时' },
  { value: '1m', label: '1分钟' },
  { value: '5m', label: '5分钟' },
  { value: '10m', label: '10分钟' },
  { value: '15m', label: '15分钟' },
  { value: '30m', label: '30分钟' },
  { value: '60m', label: '60分钟' },
  { value: '1d', label: '日线' },
  { value: '1w', label: '周线' }
];

export const TimeFrameSelector: React.FC<TimeFrameSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg p-1">
      {timeFrames.map((tf) => (
        <button
          key={tf.value}
          onClick={() => onChange(tf.value)}
          className={`
            px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200
            ${value === tf.value
              ? 'bg-blue-500 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-600/50'
            }
          `}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
};
