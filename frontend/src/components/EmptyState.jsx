import React from 'react';
import { Layers, RotateCcw } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Layers,
  title = 'No Records Found',
  description = 'No matching observation events or infrastructure coordinates found for the selected criteria.',
  actionLabel,
  onAction,
  className = ''
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-card flex flex-col items-center justify-center space-y-4 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 shadow-xs">
        <Icon className="w-6 h-6 text-slate-600" />
      </div>

      <div className="max-w-md">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition-colors shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}
