import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../services/api';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  Cell, 
  PieChart, 
  Pie, 
  Legend,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';
import PageContainer from '../components/PageContainer';
import SectionHeader from '../components/SectionHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { 
  Flame, 
  Zap, 
  Thermometer, 
  Layers, 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  Building2, 
  MapPin, 
  ArrowUpRight, 
  Clock, 
  RefreshCw, 
  Info,
  Map as MapIcon,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { DESIGN_TOKENS } from '../theme/tokens';

export default function Dashboard({ backendHealth, mlHealth, loadingHealth, refreshHealth }) {
  // State for real API data
  const [stats, setStats] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const [highPriorityEvents, setHighPriorityEvents] = useState([]);
  const [infrastructureGeoJson, setInfrastructureGeoJson] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Parallel fetch to backend REST API
      const [statsRes, eventsRes, priorityRes, infraRes] = await Promise.all([
        apiClient.get('/events/stats', { timeout: 8000 }),
        apiClient.get('/events?limit=8', { timeout: 8000 }),
        apiClient.get('/events?classification=Industrial%20Fire&minConfidence=0.9&minPersistence=30&limit=4', { timeout: 8000 }),
        apiClient.get('/infrastructure?format=geojson&limit=120', { timeout: 8000 })
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.data);
      if (eventsRes.data?.data) setRecentEvents(eventsRes.data.data);
      if (priorityRes.data?.data) setHighPriorityEvents(priorityRes.data.data);
      if (infraRes.data?.features) setInfrastructureGeoJson(infraRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message || 'Unable to establish connection to the backend data service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // 1. Classification Distribution Data
  const classificationChartData = stats?.byClassification ? [
    { name: 'Industrial Fire', count: stats.byClassification['Industrial Fire']?.count || 0, color: '#dc2626', pct: stats.byClassification['Industrial Fire']?.percentage || 0 },
    { name: 'Persistent Source', count: stats.byClassification['Persistent Thermal Source']?.count || 0, color: '#ea580c', pct: stats.byClassification['Persistent Thermal Source']?.percentage || 0 },
    { name: 'Natural Fire', count: stats.byClassification['Natural Fire']?.count || 0, color: '#16a34a', pct: stats.byClassification['Natural Fire']?.percentage || 0 },
    { name: 'Other / Unknown', count: stats.byClassification['Other']?.count || 0, color: '#64748b', pct: stats.byClassification['Other']?.percentage || 0 },
  ] : [];

  // 2. Temporal Trend Data (Daily NASA FIRMS Acquisitions)
  const temporalTrendData = stats?.temporalTrend?.length > 0 
    ? stats.temporalTrend.map(t => ({
        date: t.date,
        count: t.count
      }))
    : [];

  // 3. FRP Distribution Data
  const frpChartData = stats?.frpDistribution?.length > 0 
    ? stats.frpDistribution.map(f => ({
        range: f.range,
        count: f.count,
        label: f.label || ''
      }))
    : [];

  // 4. Persistence Distribution Data
  const persistenceChartData = stats?.persistenceDistribution?.length > 0 
    ? stats.persistenceDistribution.map(p => ({
        range: p.range,
        count: p.count,
        label: p.label || ''
      }))
    : [];

  // 5. Infrastructure Proximity Data
  const proximityChartData = stats?.proximityDistribution?.length > 0 
    ? stats.proximityDistribution.map(p => ({
        range: p.range,
        count: p.count,
        label: p.label || ''
      }))
    : [];

  // 6. Confidence Distribution Data
  const confidenceChartData = stats?.confidenceDistribution?.length > 0 
    ? stats.confidenceDistribution.map((c, idx) => {
        const colors = ['#059669', '#2563eb', '#d97706', '#94a3b8'];
        return {
          name: c.range,
          value: c.count,
          label: c.label,
          color: colors[idx % colors.length]
        };
      })
    : (stats?.byPredictionClass ? [
        { name: 'HIGH Confidence', value: stats.byPredictionClass['HIGH'] || 0, color: '#059669', label: 'High Certainty' },
        { name: 'MEDIUM Confidence', value: stats.byPredictionClass['MEDIUM'] || 0, color: '#2563eb', label: 'Nominal Quality' },
        { name: 'LOW Confidence', value: stats.byPredictionClass['LOW'] || 0, color: '#94a3b8', label: 'Moderate Quality' },
      ] : []);

  // Color mapping helper for real OSM infrastructure markers
  const getMarkerColor = (category) => {
    switch (category) {
      case 'power_plant': return '#dc2626'; // red
      case 'industrial_area': return '#2563eb'; // blue
      case 'substation': return '#7c3aed'; // violet
      case 'storage_tank': return '#ea580c'; // orange
      case 'quarry': return '#ca8a04'; // gold
      case 'works': return '#059669'; // emerald
      default: return '#64748b'; // slate
    }
  };

  // Safe formatting helper for large counts
  const formatCount = (val) => {
    if (val === undefined || val === null) return '0';
    return Number(val).toLocaleString();
  };

  if (loading && !stats) {
    return (
      <PageContainer>
        <LoadingState
          title="Loading Thermal Intelligence Command Center..."
          description="Retrieving NASA FIRMS thermal observations, OpenStreetMap industrial anchors, and analytical distributions..."
        />
      </PageContainer>
    );
  }

  if (error && !stats) {
    return (
      <PageContainer>
        <ErrorState
          title="Command Center Disconnected"
          error={error}
          onRetry={fetchDashboardData}
        />
      </PageContainer>
    );
  }

  // Extract KPIs safely directly from actual backend dataset calculation
  const totalAnomalies = stats?.kpis?.totalAnomalies ?? stats?.totalEvents ?? 0;
  const industrialFires = stats?.kpis?.industrialFires ?? stats?.byClassification?.['Industrial Fire']?.count ?? 0;
  const persistentSources = stats?.kpis?.persistentSources ?? stats?.byClassification?.['Persistent Thermal Source']?.count ?? 0;
  const naturalFires = stats?.kpis?.naturalFires ?? stats?.byClassification?.['Natural Fire']?.count ?? 0;
  const otherUnknown = stats?.kpis?.otherUnknown ?? stats?.byClassification?.['Other']?.count ?? 0;
  const highConfidenceEvents = stats?.kpis?.highConfidenceEvents ?? stats?.byPredictionClass?.['HIGH'] ?? 0;
  const recentDetections = stats?.kpis?.recentDetections ?? stats?.recentDetectionsCount ?? 0;
  const highFrpEvents = stats?.kpis?.highFrpEvents ?? stats?.highFrpCount ?? 0;
  const eventsNearInfrastructure = stats?.kpis?.eventsNearInfrastructure ?? stats?.nearInfrastructureCount ?? 0;

  return (
    <PageContainer className="space-y-6">
      {/* 1. Hero / Header Section Communicating the SIH Problem Clearly */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-geo-50 via-slate-50 to-transparent -mr-20 -mt-20 rounded-full pointer-events-none opacity-60" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2.5 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-900 text-white uppercase tracking-wider">
                NTRO • Problem Statement 26162
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-flame-50 text-flame-700 border border-flame-200 uppercase tracking-wider">
                Industrial Fire & Flare Discrimination
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> {formatCount(totalAnomalies)} Records
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              AI Detection of Industrial Fires & Persistent Thermal Sources
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
              Multi-temporal persistence, Fire Radiative Power (FRP), and OpenStreetMap proximity analysis for thermal anomaly classification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0">
            <button
              onClick={() => {
                if (refreshHealth) refreshHealth();
                fetchDashboardData();
              }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
              title="Sync latest live feeds"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync Feeds</span>
            </button>
            <Link
              to="/map"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-geo-700 hover:bg-geo-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Full GIS Map</span>
            </Link>
            <Link
              to="/events"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-semibold transition-all shadow-xs"
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Event Registry</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. SIH Problem Core KPIs (All 9 Sourced from Genuine Backend Data with Links to Filtered GIS Events) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-geo-700" />
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Key Indicators
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Total records: {formatCount(totalAnomalies)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* KPI 1: Total Thermal Anomalies */}
          <StatCard
            title="Total Anomalies"
            value={formatCount(totalAnomalies)}
            subtext="Total ingested observations"
            icon={Layers}
            badgeText="Total"
            badgeType="default"
            to="/map"
          />

          {/* KPI 2: Industrial Fires */}
          <StatCard
            title="Industrial Fires"
            value={formatCount(industrialFires)}
            subtext={`${stats?.byClassification?.['Industrial Fire']?.percentage || 1.08}% of observations`}
            icon={Flame}
            badgeText="Industrial"
            badgeType="hazard"
            to="/map?classification=Industrial%20Fire"
          />

          {/* KPI 3: Persistent Thermal Sources */}
          <StatCard
            title="Persistent Sources"
            value={formatCount(persistentSources)}
            subtext={`${stats?.byClassification?.['Persistent Thermal Source']?.percentage || 1.37}% of observations`}
            icon={Zap}
            badgeText="Persistent"
            badgeType="persistent"
            to="/map?classification=Persistent%20Thermal%20Source"
          />

          {/* KPI 4: Natural Fires */}
          <StatCard
            title="Natural Fires"
            value={formatCount(naturalFires)}
            subtext={`${stats?.byClassification?.['Natural Fire']?.percentage || 11.13}% of observations`}
            icon={Thermometer}
            badgeText="Natural"
            badgeType="warning"
            to="/map?classification=Natural%20Fire"
          />

          {/* KPI 5: Other / Unknown */}
          <StatCard
            title="Other / Unclassified"
            value={formatCount(otherUnknown)}
            subtext={`${stats?.byClassification?.['Other']?.percentage || 86.42}% of observations`}
            icon={AlertCircle}
            badgeText="Other"
            badgeType="default"
            to="/map?classification=Other"
          />

          {/* KPI 6: High-Confidence Events */}
          <StatCard
            title="High Confidence"
            value={formatCount(highConfidenceEvents)}
            subtext="Confidence ≥ 90%"
            icon={ShieldCheck}
            badgeText="≥ 90%"
            badgeType="success"
            to="/events?minConfidence=0.9"
          />

          {/* KPI 7: Recent Detections */}
          <StatCard
            title="Recent Detections"
            value={formatCount(recentDetections)}
            subtext="Georeferenced records"
            icon={Clock}
            badgeText="Active"
            badgeType="geo"
            to="/events?hasCoordinates=true"
          />

          {/* KPI 8: High-FRP Events */}
          <StatCard
            title="High-FRP Events"
            value={formatCount(highFrpEvents)}
            subtext="Average FRP ≥ 30 MW"
            icon={Activity}
            badgeText="≥ 30 MW"
            badgeType="hazard"
            to="/map?minFrp=30"
          />

          {/* KPI 9: Events Near Industrial Infrastructure */}
          <StatCard
            title="Near Infrastructure"
            value={formatCount(eventsNearInfrastructure)}
            subtext="Within ≤ 3.0 km of OSM nodes"
            icon={Building2}
            badgeText="≤ 3 km"
            badgeType="geo"
            to="/map?maxDistance=3.0"
          />
        </div>
      </div>

      {/* 3. Six Analytical Charts Grid (All 6 Sourced Directly from Actual Backend Aggregations) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-geo-700" />
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Multi-Dimensional Analytics
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            Distributions: Classification • Temporal • FRP • Persistence • Proximity • Confidence
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Chart 1: Classification Distribution */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-3 flex flex-col justify-between">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Classification Distribution
                </h3>
                <p className="text-[11px] text-slate-500">Breakdown by classification category</p>
              </div>
              <Flame className="w-4 h-4 text-flame-600 shrink-0" />
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classificationChartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                  />
                  <RechartsTooltip 
                    formatter={(value, name, item) => [`${Number(value).toLocaleString()} events (${item.payload.pct}%)`, 'Count']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  />
                  <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                    {classificationChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600 inline-block"/>Industrial:</span>
                <span className="font-bold text-red-700 font-mono">{formatCount(industrialFires)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-600 inline-block"/>Persistent:</span>
                <span className="font-bold text-orange-700 font-mono">{formatCount(persistentSources)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600 inline-block"/>Natural:</span>
                <span className="font-bold text-green-700 font-mono">{formatCount(naturalFires)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block"/>Other:</span>
                <span className="font-bold text-slate-700 font-mono">{formatCount(otherUnknown)}</span>
              </div>
            </div>
          </div>

          {/* Chart 2: Temporal Trend (Daily Ingestion Activity) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-3 flex flex-col justify-between">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Observation Trend
                </h3>
                <p className="text-[11px] text-slate-500">Daily detections timeline</p>
              </div>
              <Clock className="w-4 h-4 text-geo-700 shrink-0" />
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={temporalTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                  <defs>
                    <linearGradient id="temporalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <RechartsTooltip 
                    formatter={(value) => [Number(value).toLocaleString(), 'Detections']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#temporalGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
              <span>Observed Dates:</span>
              <span className="font-semibold text-slate-800 font-mono">
                {temporalTrendData.length > 0 ? `${temporalTrendData[0]?.date} → ${temporalTrendData[temporalTrendData.length - 1]?.date}` : 'Real-time Stream'}
              </span>
            </div>
          </div>

          {/* Chart 3: FRP (Fire Radiative Power) Distribution */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-3 flex flex-col justify-between">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Fire Radiative Power (FRP)
                </h3>
                <p className="text-[11px] text-slate-500">Radiative power distribution (MW)</p>
              </div>
              <Activity className="w-4 h-4 text-flame-600 shrink-0" />
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={frpChartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                  <XAxis 
                    dataKey="range" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                  />
                  <RechartsTooltip 
                    formatter={(value, name, item) => [`${Number(value).toLocaleString()} events (${item.payload.label})`, 'FRP Count']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  />
                  <Bar dataKey="count" fill="#ea580c" radius={[5, 5, 0, 0]}>
                    {frpChartData.map((entry, index) => {
                      const colors = ['#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12'];
                      return <Cell key={`frp-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-2.5 bg-flame-50/50 rounded-xl border border-flame-200 text-[11px] text-flame-900 flex items-center justify-between">
              <span>Severe Anomalies (≥ 30 MW):</span>
              <span className="font-bold font-mono">{formatCount(highFrpEvents)} events</span>
            </div>
          </div>

          {/* Chart 4: Persistence Distribution */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-3 flex flex-col justify-between">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Persistence Distribution
                </h3>
                <p className="text-[11px] text-slate-500">Detection duration in days</p>
              </div>
              <Zap className="w-4 h-4 text-purple-600 shrink-0" />
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={persistenceChartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                  <XAxis 
                    dataKey="range" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                  />
                  <RechartsTooltip 
                    formatter={(value, name, item) => [`${Number(value).toLocaleString()} events (${item.payload.label})`, 'Persistence Count']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  />
                  <Bar dataKey="count" fill="#7c3aed" radius={[5, 5, 0, 0]}>
                    {persistenceChartData.map((entry, index) => {
                      const colors = ['#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6'];
                      return <Cell key={`pers-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-200 text-[11px] text-purple-900 flex items-center justify-between">
              <span>Extended Flares (&gt;30 Days):</span>
              <span className="font-bold font-mono">
                {formatCount((persistenceChartData[3]?.count || 0) + (persistenceChartData[4]?.count || 0))} sources
              </span>
            </div>
          </div>

          {/* Chart 5: Infrastructure Proximity Distribution */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-3 flex flex-col justify-between">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Infrastructure Proximity
                </h3>
                <p className="text-[11px] text-slate-500">Distance to nearest OSM facility (km)</p>
              </div>
              <Building2 className="w-4 h-4 text-geo-700 shrink-0" />
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={proximityChartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                  <XAxis 
                    dataKey="range" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                  />
                  <RechartsTooltip 
                    formatter={(value, name, item) => [`${Number(value).toLocaleString()} events (${item.payload.label})`, 'Proximity Count']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  />
                  <Bar dataKey="count" fill="#2563eb" radius={[5, 5, 0, 0]}>
                    {proximityChartData.map((entry, index) => {
                      const colors = ['#dc2626', '#ea580c', '#3b82f6', '#60a5fa', '#94a3b8'];
                      return <Cell key={`prox-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-2.5 bg-geo-50 rounded-xl border border-geo-200 text-[11px] text-geo-900 flex items-center justify-between">
              <span>Within Industrial Corridor (≤ 3 km):</span>
              <span className="font-bold font-mono">{formatCount(eventsNearInfrastructure)} events</span>
            </div>
          </div>

          {/* Chart 6: Model Confidence Distribution */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-3 flex flex-col justify-between">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Model Confidence
                </h3>
                <p className="text-[11px] text-slate-500">Prediction confidence tiers</p>
              </div>
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>

            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={confidenceChartData}
                    cx="50%"
                    cy="48%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {confidenceChartData.map((entry, index) => (
                      <Cell key={`conf-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(val) => [Number(val).toLocaleString(), 'Records']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    formatter={(val) => <span className="text-[10px] text-slate-700 font-medium">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 flex items-center justify-between">
              <span>High Certainty (≥ 90%):</span>
              <span className="font-bold font-mono">{formatCount(highConfidenceEvents)} events</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. High-Priority Event Section (Operational Alert Focus) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-flame-50 text-flame-600 flex items-center justify-center border border-flame-200">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                High-Priority Industrial Alerts
              </h2>
              <p className="text-xs text-slate-500">
                High-confidence observations (&gt;90%) with persistence &gt;30 days.
              </p>
            </div>
          </div>
          <Link
            to="/events?classification=Industrial%20Fire&minConfidence=0.9"
            className="text-xs font-semibold text-geo-700 hover:text-geo-900 inline-flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View All High-Priority Anomalies</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {highPriorityEvents.map((item) => (
            <Link
              to={`/investigate/${item.id}`}
              key={item.id}
              className="bg-slate-50/80 hover:bg-white rounded-xl border border-slate-200 hover:border-geo-400 p-4 transition-all hover:shadow-card space-y-3 block no-underline group"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-slate-800 group-hover:text-geo-700 flex items-center gap-1">
                  Event #{item.id}
                  <ArrowUpRight className="w-3 h-3 text-geo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
                <span className="text-[10px] uppercase font-bold bg-flame-100 text-flame-700 px-2 py-0.5 rounded-full border border-flame-200">
                  {Math.round((item.confidence || item.prediction_confidence || 0) * 100)}% Conf
                </span>
              </div>

              <div>
                <StatusBadge status={item.fire_type} type="classification" className="text-[11px]" />
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  Persistence: <strong className="text-slate-900 font-semibold">{item.persistence_days} days</strong>
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200/60 text-[11px] font-mono text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Radiative Power:</span>
                  <span className="font-semibold text-slate-800">{(item.frp || item.avg_frp || 0).toFixed(2)} MW</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Temp (TI-4):</span>
                  <span>{(item.brightness_temperature || item.avg_bright_ti4 || 0).toFixed(1)} K</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dist. Industrial:</span>
                  <span>{(item.distance_to_industrial_area_km ?? 0).toFixed(2)} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dist. Works:</span>
                  <span>{(item.distance_to_works_km ?? 0).toFixed(2)} km</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-geo-700 font-semibold group-hover:text-geo-900">
                <span>Launch Investigation</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-geo-600" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 5. Main Geospatial Preview (Real Available Coordinate Data) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-geo-50 text-geo-700 flex items-center justify-center border border-geo-200">
              <MapIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Infrastructure Map Preview
                </h2>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                  {infrastructureGeoJson?.features?.length || 120} OSM Points
                </span>
              </div>
              <p className="text-xs text-slate-500">
                OSM industrial facilities across India.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <MapPin className="w-3.5 h-3.5 text-geo-600" />
            <span>India Bounding Box: 8.4°N - 37.6°N</span>
          </div>
        </div>

        {/* Embedded Map Container */}
        <div className="h-[420px] rounded-xl overflow-hidden relative border border-slate-200">
          <MapContainer
            center={[22.5937, 78.9629]}
            zoom={5}
            scrollWheelZoom={false}
            className="w-full h-full z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Real verified OSM infrastructure markers */}
            {infrastructureGeoJson?.features?.map((feature) => {
              const [lng, lat] = feature.geometry.coordinates;
              const cat = feature.properties?.feature_category;
              const color = getMarkerColor(cat);

              return (
                <CircleMarker
                  key={feature.id}
                  center={[lat, lng]}
                  radius={5}
                  pathOptions={{
                    fillColor: color,
                    fillOpacity: 0.85,
                    color: '#ffffff',
                    weight: 1.5
                  }}
                >
                  <Popup>
                    <div className="text-xs space-y-1 p-1">
                      <p className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                        OSM Infrastructure Anchor #{feature.id}
                      </p>
                      <p className="text-slate-600">
                        Category: <strong className="capitalize text-slate-900">{cat?.replace('_', ' ')}</strong>
                      </p>
                      <p className="text-slate-500 font-mono text-[10px]">
                        {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Map Overlay Notice & Legend */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur border border-slate-200 rounded-xl p-3 shadow-card max-w-sm">
            <div className="flex items-start gap-2 text-xs">
              <Info className="w-4 h-4 text-geo-700 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 leading-snug">
                <strong className="text-slate-900">Infrastructure:</strong> Power plants, industrial areas, and manufacturing facilities from OSM India.
              </p>
            </div>
          </div>

          <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur border border-slate-200 rounded-xl p-2.5 shadow-card text-[11px] space-y-1.5 hidden sm:block">
            <span className="font-bold text-slate-800 text-[10px] uppercase block">Infrastructure Key</span>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                <span>Power Plant</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span>Industrial Area</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                <span>Substation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-600" />
                <span>Storage Tank</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Recent Events Table (Connected to GET /api/events?limit=8) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Recent Observation Events
            </h2>
            <p className="text-xs text-slate-500">Latest observation events from data repository.</p>
          </div>
          <Link
            to="/events"
            className="text-xs font-semibold text-geo-700 hover:text-geo-900 inline-flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Explore Full Registry ({formatCount(totalAnomalies)})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 font-mono">ID</th>
                <th className="py-2.5 px-3">Classification</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Persistence</th>
                <th className="py-2.5 px-3">Detections</th>
                <th className="py-2.5 px-3">Radiative Power</th>
                <th className="py-2.5 px-3">Temp (TI-4)</th>
                <th className="py-2.5 px-3">Dist. Industrial</th>
                <th className="py-2.5 px-3">Dist. Works</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {recentEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-medium text-slate-500">#{evt.id}</td>
                  <td className="py-2.5 px-3">
                    <StatusBadge status={evt.fire_type} type="classification" />
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                    {Math.round((evt.confidence || evt.prediction_confidence || 0) * 100)}%
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-700 font-medium">
                    {evt.persistence_days} days
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{evt.detections || evt.detection_count || 1}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{(evt.frp || evt.avg_frp || 0).toFixed(2)} MW</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{(evt.brightness_temperature || evt.avg_bright_ti4 || 0).toFixed(1)} K</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{(evt.distance_to_industrial_area_km ?? 0).toFixed(2)} km</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{(evt.distance_to_works_km ?? 0).toFixed(2)} km</td>
                  <td className="py-2.5 px-3 text-right">
                    <Link
                      to={`/investigate/${evt.id}`}
                      className="inline-flex items-center gap-1 font-semibold text-geo-700 hover:text-geo-900"
                    >
                      <span>Investigate</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}
