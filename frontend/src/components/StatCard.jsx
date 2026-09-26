import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export default function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  badgeText,
  badgeType = 'default',
  to,
  className = ''
}) {
  const badgeColors = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    hazard: 'bg-flame-50 text-flame-700 border-flame-200',
    geo: 'bg-geo-50 text-geo-700 border-geo-200',
    persistent: 'bg-purple-50 text-purple-700 border-purple-200'
  };

  const currentBadgeClass = badgeColors[badgeType] || badgeColors.default;

  const cardContent = (
    <div className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-card hover:shadow-card-hover transition-all relative overflow-hidden group ${to ? 'cursor-pointer hover:border-geo-400' : ''} ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          {Icon && (
            <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-100 transition-colors">
              <Icon className="w-4 h-4 text-slate-700" />
            </div>
          )}
          {to && (
            <div className="w-6 h-6 rounded-lg bg-geo-50 text-geo-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
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

      {to && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-geo-700 font-medium group-hover:text-geo-900">
          <span>View filtered events</span>
          <ArrowUpRight className="w-3 h-3 text-geo-600" />
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block no-underline">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
