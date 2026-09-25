import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorState({
  title = 'Service Unavailable',
  error = 'Unable to establish connection to the backend data layer.',
  onRetry,
  className = ''
}) {
  return (
    <div className={`bg-rose-50/50 rounded-2xl border border-rose-200 p-8 text-center shadow-card flex flex-col items-center justify-center space-y-4 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-rose-100/70 border border-rose-200 flex items-center justify-center text-rose-600 shadow-xs">
        <AlertCircle className="w-6 h-6 text-rose-600" />
      </div>

      <div className="max-w-md">
        <h2 className="text-sm font-bold text-rose-900">{title}</h2>
        <p className="text-xs text-rose-700/80 mt-1 leading-relaxed font-mono">
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-medium transition-colors shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      )}
    </div>
  );
}
