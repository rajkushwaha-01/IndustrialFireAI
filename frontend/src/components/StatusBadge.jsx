import React from 'react';
import { DESIGN_TOKENS } from '../theme/tokens';

export default function StatusBadge({ status, type = 'classification', showDot = true, className = '' }) {
  if (!status) return null;

  let style = {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400'
  };

  if (type === 'classification') {
    const matched = DESIGN_TOKENS.classificationStyles[status];
    if (matched) style = matched;
  } else if (type === 'confidence') {
    const matched = DESIGN_TOKENS.confidenceStyles[status];
    if (matched) style = matched;
  } else if (type === 'health') {
    if (status === 'healthy' || status === 'ok' || status === true) {
      style = {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500'
      };
    } else {
      style = {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500'
      };
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      {showDot && style.dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      )}
      <span>{status}</span>
    </span>
  );
}
