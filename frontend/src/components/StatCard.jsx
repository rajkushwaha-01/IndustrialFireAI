import React from 'react';

export default function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  badgeText,
  badgeType = 'default',
  className = ''
}) {
  const badgeColors = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    hazard: 'bg-flame-50 text-flame-700 border-flame-200',
    geo: 'bg-geo-50 text-geo-700 border-geo-200',
    persistent: 'bg-persistent-50 text-persistent-700 border-persistent-200'
  };

  const currentBadgeClass = badgeColors[badgeType] || badgeColors.default;

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-card hover:shadow-card-hover transition-all ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <Icon className="w-4 h-4 text-slate-700" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
          {value}
        </span>
        {badgeText && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${currentBadgeClass}`}>
            {badgeText}
          </span>
        )}
      </div>

      {subtext && (
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
          {subtext}
        </p>
      )}
    </div>
  );
}
