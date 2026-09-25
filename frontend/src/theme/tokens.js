/**
 * ThermalWatch Geospatial Intelligence Design Tokens
 */

export const DESIGN_TOKENS = {
  appName: 'ThermalWatch',
  appSubtitle: 'AI-Based Thermal Source & Industrial Fire Detection',
  organization: 'National Technical Research Organisation (NTRO)',
  problemStatementId: '26162',
  
  // Status Color Mappings (Restrained light palette)
  classificationStyles: {
    'Industrial Fire': {
      bg: 'bg-flame-50',
      text: 'text-flame-700',
      border: 'border-flame-200',
      dot: 'bg-flame-500',
      iconColor: '#dc2626'
    },
    'Persistent Thermal Source': {
      bg: 'bg-persistent-50',
      text: 'text-persistent-700',
      border: 'border-persistent-200',
      dot: 'bg-persistent-500',
      iconColor: '#7c3aed'
    },
    'Natural Fire': {
      bg: 'bg-hazard-50',
      text: 'text-hazard-700',
      border: 'border-hazard-200',
      dot: 'bg-hazard-500',
      iconColor: '#ea580c'
    },
    'Other': {
      bg: 'bg-slate-50',
      text: 'text-slate-700',
      border: 'border-slate-200',
      dot: 'bg-slate-400',
      iconColor: '#64748b'
    }
  },

  // Confidence Badges
  confidenceStyles: {
    HIGH: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200'
    },
    MEDIUM: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200'
    },
    LOW: {
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-200'
    }
  }
};
