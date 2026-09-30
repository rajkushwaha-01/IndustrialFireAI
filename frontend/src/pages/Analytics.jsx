import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import PageContainer from '../components/PageContainer';
import SectionHeader from '../components/SectionHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import {
  BarChart3,
  Flame,
  Activity,
  Clock,
  ShieldCheck,
  Zap,
  RefreshCw,
  Info,
  Layers,
  Target,
  Radar,
  CalendarOff
} from 'lucide-react';

// Custom Tooltip for charts
function CustomChartTooltip({ active, payload, label, unit = '' }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700/50 text-xs backdrop-blur-md">
        <p className="font-semibold text-slate-200 mb-1">{label || payload[0]?.name}</p>
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center gap-2 font-mono">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <span className="text-slate-400">{entry.name}:</span>
            <span className="font-bold text-white">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value} {unit}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

// Chart Container Card with Title, Explanation, Loading, and Empty States
function ChartCard({
  title,
  explanation,
  icon: Icon,
  badgeText,
  badgeColor = 'bg-slate-100 text-slate-700 border-slate-200',
  children,
  loading = false,
  empty = false,
  emptyMessage = 'No analytical records available for this distribution',
  action
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card hover:shadow-md transition-shadow flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-2.5">
            {Icon && (
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 mt-0.5">
                <Icon className="w-4 h-4 text-geo-700" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
                {badgeText && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                    {badgeText}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xl">{explanation}</p>
            </div>
          </div>
          {action}
        </div>
      </div>

      {/* Chart Content / State */}
      <div className="mt-5 min-h-[260px] flex items-center justify-center">
        {loading ? (
          <div className="w-full flex flex-col items-center justify-center py-10 space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-geo-600 border-t-transparent animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Aggregating empirical distribution...</p>
          </div>
        ) : empty ? (
          <div className="w-full">
            <EmptyState
              icon={Layers}
              title="Distribution Empty"
              description={emptyMessage}
              className="border-dashed border-slate-200 shadow-none py-8"
            />
          </div>
        ) : (
          <div className="w-full h-full min-h-[260px]">{children}</div>
        )}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('http://localhost:5000/api/events/stats', { timeout: 6000 });
      if (res.data?.success) {
        setStats(res.data.data);
      } else {
        setError('Unexpected API response structure');
      }
    } catch (err) {
      setError(err.message || 'Unable to retrieve statistics from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Format Classification Data for Recharts
  const classificationChartData = stats?.byClassification
    ? [
        {
          name: 'Industrial Fire',
          count: stats.byClassification['Industrial Fire']?.count || 0,
          pct: stats.byClassification['Industrial Fire']?.percentage || 0,
          color: '#dc2626'
        },
        {
          name: 'Persistent Thermal Source',
          count: stats.byClassification['Persistent Thermal Source']?.count || 0,
          pct: stats.byClassification['Persistent Thermal Source']?.percentage || 0,
          color: '#7c3aed'
        },
        {
          name: 'Natural Fire',
          count: stats.byClassification['Natural Fire']?.count || 0,
          pct: stats.byClassification['Natural Fire']?.percentage || 0,
          color: '#ea580c'
        },
        {
          name: 'Other',
          count: stats.byClassification['Other']?.count || 0,
          pct: stats.byClassification['Other']?.percentage || 0,
          color: '#64748b'
        }
      ]
    : [];

  // Format Confidence Data for Recharts
  const confidenceChartData = stats?.byConfidence
    ? [
        {
          name: 'HIGH (≥80%)',
          count: stats.byConfidence['HIGH']?.count || 0,
          pct: stats.byConfidence['HIGH']?.percentage || 0,
          color: '#10b981'
        },
        {
          name: 'MEDIUM (60-79%)',
          count: stats.byConfidence['MEDIUM']?.count || 0,
          pct: stats.byConfidence['MEDIUM']?.percentage || 0,
          color: '#f59e0b'
        },
        {
          name: 'LOW (<60%)',
          count: stats.byConfidence['LOW']?.count || 0,
          pct: stats.byConfidence['LOW']?.percentage || 0,
          color: '#94a3b8'
        }
      ]
    : [];

  // Comparative Data across Key Classes
  const classComparisonData = stats?.classComparison || [];

  return (
    <PageContainer>
      {/* Header */}
      <SectionHeader
        badge="Analytics"
        title="Thermal Anomaly Analytics & Distributions"
        description="Statistical distributions of classification density, model confidence, temporal persistence, radiative power, and infrastructure metrics."
        actions={
          <button
            onClick={fetchStats}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Analytics</span>
          </button>
        }
      />

      {/* Methodology & Data Integrity Note */}
      <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200/80 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-blue-100/80 text-blue-700 rounded-xl border border-blue-200 shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">
                Dataset & Methodology
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                API Data
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Distributions computed across 224,029 FIRMS observations and 139,682 OpenStreetMap infrastructure points using Random Forest classifications.
            </p>
            <div className="flex items-center gap-2 pt-1 text-[11px] text-amber-800 bg-amber-50/80 border border-amber-200/60 px-3 py-1.5 rounded-lg w-fit">
              <CalendarOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                <strong>Temporal Metric:</strong> Temporal duration is measured in cumulative persistence_days (1–179 days).
              </span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState
          title="Computing Statistical Distributions..."
          description="Aggregating metrics across 224,029 authoritative records"
        />
      ) : error ? (
        <ErrorState
          title="Analytics Pipeline Error"
          error={error}
          onRetry={fetchStats}
        />
      ) : stats ? (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Observations"
              value={stats.totalEvents?.toLocaleString()}
              subtext="Validated dataset records"
              icon={Activity}
              badgeText="Dataset"
              badgeType="default"
            />
            <StatCard
              title="High-Confidence Target Events"
              value={stats.highConfidenceStats?.total?.toLocaleString()}
              subtext={`${stats.highConfidenceStats?.industrialCount?.toLocaleString()} Industrial + ${stats.highConfidenceStats?.persistentCount?.toLocaleString()} Persistent`}
              icon={Target}
              badgeText="High Confidence"
              badgeType="hazard"
            />
            <StatCard
              title="Max Persistence Lifetime"
              value={`${stats.persistence?.max} Days`}
              subtext={`Empirical mean: ${stats.persistence?.avg} days`}
              icon={Clock}
              badgeText="Persistence"
              badgeType="persistent"
            />
            <StatCard
              title="Peak Radiative Power"
              value={`${stats.frp?.maxFrp?.toLocaleString()} MW`}
              subtext={`Mean FRP: ${stats.frp?.avgFrp} MW`}
              icon={Zap}
              badgeText="Radiative Energy"
              badgeType="flame"
            />
          </div>

          {/* Grid Row 1: Fire Classification Distribution & Model Confidence Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Fire Classification Distribution */}
            <ChartCard
              title="1. Fire Classification Distribution"
              explanation="Distribution across Industrial Fires, Persistent Thermal Sources, Natural Fires, and Other."
              icon={Flame}
              badgeText="All Observations"
              badgeColor="bg-flame-50 text-flame-700 border-flame-200"
              loading={loading}
              empty={!classificationChartData.length}
            >
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 h-full items-center">
                <div className="md:col-span-3 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={classificationChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="count"
                      >
                        {classificationChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomChartTooltip unit="events" />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="md:col-span-2 space-y-2.5">
                  {classificationChartData.map((item) => (
                    <div key={item.name} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="font-semibold text-slate-800">{item.name}</span>
                        </div>
                        <span className="font-mono text-slate-900 font-bold">{item.pct}%</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {item.count.toLocaleString()} detections
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>

            {/* Chart 2: Model Confidence Distribution */}
            <ChartCard
              title="2. Model Confidence Distribution"
              explanation="Confidence tiers: High (≥80%), Medium (60–79%), and Low (<60%)."
              icon={ShieldCheck}
              badgeText="RF Classifier (200 Trees)"
              badgeColor="bg-emerald-50 text-emerald-700 border-emerald-200"
              loading={loading}
              empty={!confidenceChartData.length}
            >
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 h-full items-center">
                <div className="md:col-span-3 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={confidenceChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="count"
                      >
                        {confidenceChartData.map((entry, index) => (
                          <Cell key={`conf-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomChartTooltip unit="events" />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="md:col-span-2 space-y-2.5">
                  {confidenceChartData.map((item) => (
                    <div key={item.name} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="font-semibold text-slate-800">{item.name}</span>
                        </div>
                        <span className="font-mono text-slate-900 font-bold">{item.pct}%</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {item.count.toLocaleString()} detections
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>
          </div>

          {/* Grid Row 2: Persistence Distribution & FRP Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 3: Persistence Distribution */}
            <ChartCard
              title="3. Persistence Distribution (Lifetimes)"
              explanation="Binned counts by active persistence days (1 to 179 days)."
              icon={Clock}
              badgeText="Duration in Days"
              badgeColor="bg-persistent-50 text-persistent-700 border-persistent-200"
              loading={loading}
              empty={!stats.persistenceDistribution?.length}
            >
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.persistenceDistribution} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="range"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      scale="sqrt"
                    />
                    <Tooltip content={<CustomChartTooltip unit="events" />} />
                    <Bar dataKey="count" name="Thermal Events" fill="#7c3aed" radius={[6, 6, 0, 0]}>
                      {stats.persistenceDistribution.map((entry, index) => (
                        <Cell
                          key={`pers-${index}`}
                          fill={index === 0 ? '#8b5cf6' : index < 3 ? '#6d28d9' : '#4c1d95'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Chart 4: FRP Distribution */}
            <ChartCard
              title="4. Fire Radiative Power (FRP) Distribution"
              explanation="Binned distribution of Fire Radiative Power (MW)."
              icon={Zap}
              badgeText="Megawatts (MW)"
              badgeColor="bg-flame-50 text-flame-700 border-flame-200"
              loading={loading}
              empty={!stats.frpDistribution?.length}
            >
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.frpDistribution} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="range"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      scale="sqrt"
                    />
                    <Tooltip content={<CustomChartTooltip unit="events" />} />
                    <Bar dataKey="count" name="Thermal Events" fill="#ea580c" radius={[6, 6, 0, 0]}>
                      {stats.frpDistribution.map((entry, index) => (
                        <Cell
                          key={`frp-${index}`}
                          fill={index === 0 ? '#f97316' : index < 3 ? '#ea580c' : '#c2410c'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          {/* Grid Row 3: Detection Count Distribution & High-Confidence Target Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 5: Detection Count Distribution */}
            <ChartCard
              title="5. Detection Count Distribution"
              explanation="Satellite overpass detection counts per event cluster."
              icon={Radar}
              badgeText="Satellite Scans"
              badgeColor="bg-geo-50 text-geo-700 border-geo-200"
              loading={loading}
              empty={!stats.detectionDistribution?.length}
            >
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.detectionDistribution} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="range"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      scale="sqrt"
                    />
                    <Tooltip content={<CustomChartTooltip unit="events" />} />
                    <Bar dataKey="count" name="Events Count" fill="#0284c7" radius={[6, 6, 0, 0]}>
                      {stats.detectionDistribution.map((entry, index) => (
                        <Cell
                          key={`det-${index}`}
                          fill={index === 0 ? '#38bdf8' : index < 3 ? '#0284c7' : '#0369a1'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Chart 7: High-Confidence Event Count */}
            <ChartCard
              title="7. High-Confidence Targets"
              explanation="Industrial Fires and Persistent Thermal Sources meeting operational confidence thresholds."
              icon={Target}
              badgeText="5,457 Priority Targets"
              badgeColor="bg-emerald-50 text-emerald-700 border-emerald-200"
              loading={loading}
              empty={!stats.highConfidenceStats}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-flame-50/70 border border-flame-200 rounded-xl">
                    <span className="text-[11px] font-semibold text-flame-700 block">Industrial Fires</span>
                    <span className="text-xl font-bold font-mono text-flame-900 mt-0.5 block">
                      {stats.highConfidenceStats?.industrialCount?.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-flame-600 mt-1 block">
                      44.1% of high-confidence target events
                    </span>
                  </div>
                  <div className="p-3.5 bg-persistent-50/70 border border-persistent-200 rounded-xl">
                    <span className="text-[11px] font-semibold text-persistent-700 block">Persistent Thermal Sources</span>
                    <span className="text-xl font-bold font-mono text-persistent-900 mt-0.5 block">
                      {stats.highConfidenceStats?.persistentCount?.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-persistent-600 mt-1 block">
                      55.9% of high-confidence target events
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Target Ratio: Industrial vs Persistent</span>
                    <span className="font-mono text-slate-900 font-bold">5,457 Total Targets</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="bg-flame-500 h-full transition-all duration-500"
                      style={{ width: '44.1%' }}
                      title="Industrial Fire: 2,405"
                    />
                    <div
                      className="bg-persistent-500 h-full transition-all duration-500"
                      style={{ width: '55.9%' }}
                      title="Persistent Thermal Source: 3,052"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-flame-500" />
                      Industrial Fire (44.1%)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-persistent-500" />
                      Persistent Thermal Source (55.9%)
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                  <span className="font-bold text-slate-800">Operational Note: </span>
                  Target events exhibit persistent thermal emission and proximity to industrial complexes.
                </div>
              </div>
            </ChartCard>
          </div>

          {/* Chart 6: Industrial vs Natural vs Persistent Comparative Analysis (Full Width) */}
          <ChartCard
            title="6. Class Comparison"
            explanation="Mean persistence, radiative power, night ratio, and industrial proximity across classifications."
            icon={Activity}
            badgeText="Cross-Class Signatures"
            badgeColor="bg-geo-50 text-geo-700 border-geo-200"
            loading={loading}
            empty={!classComparisonData.length}
          >
            <div className="space-y-6">
              {/* Comparative Metrics Table / Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {classComparisonData.map((cls) => {
                  const isIndustrial = cls.className === 'Industrial Fire';
                  const isPersistent = cls.className === 'Persistent Thermal Source';
                  return (
                    <div
                      key={cls.className}
                      className={`p-4 rounded-xl border ${
                        isIndustrial
                          ? 'border-flame-200 bg-flame-50/40'
                          : isPersistent
                          ? 'border-persistent-200 bg-persistent-50/40'
                          : 'border-hazard-200 bg-hazard-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                        <StatusBadge status={cls.className} type="classification" />
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {cls.count?.toLocaleString()} events
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                        <div>
                          <span className="text-[11px] text-slate-500 block">Avg Persistence</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {cls.avgPersistence} days
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">Avg FRP</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {cls.avgFrp} MW
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">Night Ratio</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {cls.avgNightRatioPct}%
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">Dist to Industrial</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {cls.avgDistIndustrialKm} km
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comparative Bar Chart Visualization */}
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classComparisonData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="className"
                      tick={{ fill: '#334155', fontSize: 12, fontWeight: 500 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="avgPersistence" name="Avg Persistence (Days)" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avgDistIndustrialKm" name="Distance to Industrial (km)" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avgFrp" name="Avg FRP (MW)" fill="#ea580c" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Key Insight Callout */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 leading-relaxed flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-geo-700 shrink-0" />
                <div>
                  <strong className="text-slate-900 font-semibold">Key Discriminators: </strong>
                  Industrial Fires exhibit an average persistence of{' '}
                  <span className="font-mono font-bold text-flame-700">7.27 days</span> and proximity of{' '}
                  <span className="font-mono font-bold text-flame-700">4.80 km</span> to industrial zones, whereas Natural Fires average only{' '}
                  <span className="font-mono font-bold text-hazard-700">1.04 days</span> and lie over{' '}
                  <span className="font-mono font-bold text-hazard-700">13.13 km</span> away.
                </div>
              </div>
            </div>
          </ChartCard>
        </div>
      ) : null}
    </PageContainer>
  );
}
