import React from 'react';
import { Loader2, Compass } from 'lucide-react';

export default function LoadingState({
  title = 'Querying Geospatial Intelligence Pipeline...',
  description = 'Loading observation records and aggregating metrics',
  className = ''
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-card flex flex-col items-center justify-center space-y-4 ${className}`}>
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-geo-50 border border-geo-200 flex items-center justify-center text-geo-600 animate-pulse">
          <Compass className="w-6 h-6 animate-spin text-geo-700" style={{ animationDuration: '3s' }} />
        </div>
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-geo-500 rounded-full animate-ping" />
      </div>

      <div className="max-w-md">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
