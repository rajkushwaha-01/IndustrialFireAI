import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../services/api';
import PageContainer from '../components/PageContainer';
import SectionHeader from '../components/SectionHeader';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { 
  ListFilter, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  SlidersHorizontal,
  Flame,
  Zap,
  RotateCcw,
  X,
  Activity,
  Cpu,
  ShieldCheck,
  Building2,
  ExternalLink,
  Info,
  Clock,
  MapPin,
  Layers
} from 'lucide-react';

export default function Events() {
  const [searchParams] = useSearchParams();

  // Query parameters state
  const [search, setSearch] = useState('');
  const [classification, setClassification] = useState(searchParams.get('classification') || '');
  const [minConfidence, setMinConfidence] = useState(searchParams.get('minConfidence') || '');
  const [minPersistence, setMinPersistence] = useState(searchParams.get('minPersistence') || '');
  const [hasCoordinates, setHasCoordinates] = useState(searchParams.get('hasCoordinates') || '');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Data state
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal / Detail state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [detailProbabilities, setDetailProbabilities] = useState(null);
  const [detailEvidence, setDetailEvidence] = useState(null);
  const [loadingInference, setLoadingInference] = useState(false);

  // Fetch events list from backend
  const fetchEvents = async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', targetPage);
      params.append('limit', limit);
      if (search.trim()) params.append('search', search.trim());
      if (classification) params.append('classification', classification);
      if (minConfidence) params.append('minConfidence', minConfidence);
      if (minPersistence) params.append('minPersistence', minPersistence);
      if (hasCoordinates) params.append('hasCoordinates', hasCoordinates);

      const res = await apiClient.get(`/events?${params.toString()}`, { timeout: 6000 });
      if (res.data) {
        setEvents(res.data.data || []);
        setPagination(res.data.pagination || { page: targetPage, limit, total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err.message || 'Unable to load observation events from backend data layer.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cls = searchParams.get('classification') || '';
    const minC = searchParams.get('minConfidence') || '';
    const minP = searchParams.get('minPersistence') || '';
    const hasC = searchParams.get('hasCoordinates') || '';
    setClassification(cls);
    setMinConfidence(minC);
    setMinPersistence(minP);
    setHasCoordinates(hasC);
  }, [searchParams]);

  useEffect(() => {
    fetchEvents(1);
    setPage(1);
  }, [classification, minConfidence, minPersistence, hasCoordinates, limit]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchEvents(1);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setClassification('');
    setMinConfidence('');
    setMinPersistence('');
    setPage(1);
  };

  // Open detail modal and run live ML inference to retrieve exact probability breakdown
  const handleOpenDetail = async (evt) => {
    setSelectedEvent(evt);
    setDetailProbabilities(null);
    setDetailEvidence(evt.evidence || null);
    setLoadingInference(true);

    try {
      const payload = {
        persistence_days: Number(evt.persistence_days),
        detections: Number(evt.detections),
        avg_frp: Number(evt.avg_frp),
        max_frp: Number(evt.max_frp),
        total_frp: Number(evt.total_frp),
        avg_bright_ti4: Number(evt.avg_bright_ti4),
        avg_bright_ti5: Number(evt.avg_bright_ti5),
        night_ratio: Number(evt.night_ratio),
        distance_to_industrial_area_km: Number(evt.distance_to_industrial_area_km),
        distance_to_power_plant_km: Number(evt.distance_to_power_plant_km),
        distance_to_quarry_km: Number(evt.distance_to_quarry_km),
        distance_to_substation_km: Number(evt.distance_to_substation_km),
        distance_to_storage_tank_km: Number(evt.distance_to_storage_tank_km),
        distance_to_works_km: Number(evt.distance_to_works_km)
      };

      const res = await apiClient.post('/predict', payload, { timeout: 4000 });
      if (res.data?.probabilities) {
        setDetailProbabilities(res.data.probabilities);
      }
      if (res.data?.evidence) {
        setDetailEvidence(res.data.evidence);
      }
    } catch (err) {
      console.warn('Could not fetch dynamic probability breakdown:', err.message);
    } finally {
      setLoadingInference(false);
    }
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedEvent(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <PageContainer>
      {/* Page Header */}
      <SectionHeader
        badge="224,029 Observation Records"
        title="Thermal Events Explorer"
        description="Thermal anomaly observations evaluated across FIRMS telemetry and OpenStreetMap spatial metrics."
      />

      {/* Evaluator Demo Mode Bar */}
      <div className="bg-gradient-to-r from-amber-50/70 via-slate-50 to-blue-50/70 border border-amber-200/80 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg border border-amber-300 shrink-0">
              <Zap className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-900">
                  Filter Presets
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Preset filters for classification, persistence, and confidence thresholds.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap self-stretch md:self-auto shrink-0">
            <button
              onClick={() => {
                setClassification('Industrial Fire');
                setMinPersistence('5');
                setMinConfidence('0.7');
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-flame-50 hover:bg-flame-100 text-flame-800 border border-flame-200 transition-colors shadow-2xs"
            >
              <Flame className="w-3.5 h-3.5 text-flame-700" />
              <span>Industrial Fire Preset</span>
            </button>
            <button
              onClick={() => {
                setClassification('Persistent Thermal Source');
                setMinPersistence('15');
                setMinConfidence('');
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-persistent-50 hover:bg-persistent-100 text-persistent-800 border border-persistent-200 transition-colors shadow-2xs"
            >
              <Zap className="w-3.5 h-3.5 text-persistent-700" />
              <span>Persistent Source Preset</span>
            </button>
            <button
              onClick={() => {
                setClassification('Natural Fire');
                setMinPersistence('');
                setMinConfidence('0.85');
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-hazard-50 hover:bg-hazard-100 text-hazard-800 border border-hazard-200 transition-colors shadow-2xs"
            >
              <Activity className="w-3.5 h-3.5 text-hazard-700" />
              <span>Natural Fire Preset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-card space-y-4">
        {/* Search Input Row */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Event ID (e.g. 105, 5420) or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-geo-500/20 font-sans"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs shrink-0"
          >
            Search Registry
          </button>
          {(search || classification || minConfidence || minPersistence) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </form>

        {/* Secondary Filter Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Classification */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Classification
            </label>
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
            >
              <option value="">All Classifications</option>
              <option value="Industrial Fire">Industrial Fire (2,405)</option>
              <option value="Persistent Thermal Source">Persistent Thermal Source (3,052)</option>
              <option value="Natural Fire">Natural Fire (24,935)</option>
              <option value="Other">Other Anomaly (193,637)</option>
            </select>
          </div>

          {/* Confidence */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Confidence Filter
            </label>
            <select
              value={minConfidence}
              onChange={(e) => setMinConfidence(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
            >
              <option value="">Any Confidence</option>
              <option value="0.5">≥ 50% Confidence</option>
              <option value="0.7">≥ 70% Confidence</option>
              <option value="0.85">≥ 85% High Confidence</option>
              <option value="0.9">≥ 90% Very High Confidence</option>
            </select>
          </div>

          {/* Persistence */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Persistence Filter
            </label>
            <select
              value={minPersistence}
              onChange={(e) => setMinPersistence(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
            >
              <option value="">Any Persistence</option>
              <option value="5">≥ 5 Days Persistent</option>
              <option value="15">≥ 15 Days Persistent</option>
              <option value="30">≥ 30 Days (Industrial Signature)</option>
              <option value="60">≥ 60 Days (Flares & Kilns)</option>
            </select>
          </div>

          {/* Page Limit */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Rows Per Page
            </label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none font-mono"
            >
              <option value="15">15 rows</option>
              <option value="25">25 rows</option>
              <option value="50">50 rows</option>
              <option value="100">100 rows</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Events Table Area */}
      {loading ? (
        <LoadingState
          title="Streaming Observation Records..."
          description="Filtering authoritative thermal events from backend data layer"
        />
      ) : error ? (
        <ErrorState
          title="Failed to Load Events"
          error={error}
          onRetry={() => fetchEvents(page)}
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={ListFilter}
          title="No Thermal Events Found"
          description="No observation records match the specified filters or search query. Try clearing your filters to view more records."
          actionLabel="Reset All Filters"
          onAction={handleResetFilters}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4 font-mono">Event ID</th>
                  <th className="py-3.5 px-4">Classification</th>
                  <th className="py-3.5 px-4">Confidence</th>
                  <th className="py-3.5 px-4">Persistence</th>
                  <th className="py-3.5 px-4">Detections</th>
                  <th className="py-3.5 px-4">Avg FRP</th>
                  <th className="py-3.5 px-4">Max FRP</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((evt) => (
                  <tr
                    key={evt.id}
                    onClick={() => handleOpenDetail(evt)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      #{evt.id}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={evt.fire_type} type="classification" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="font-semibold text-slate-900">
                          {Math.round(evt.prediction_confidence * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {evt.persistence_days} days
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {evt.detections}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {evt.avg_frp.toFixed(2)} MW
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {evt.max_frp.toFixed(2)} MW
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge
                        status={evt.prediction_class}
                        type="confidence"
                        showDot={false}
                        className="font-mono text-[10px] px-2 py-0.5"
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-geo-600 group-hover:text-geo-800 font-semibold inline-flex items-center gap-1 text-[11px]">
                        Inspect <ExternalLink className="w-3 h-3" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
            <div>
              Showing <span className="font-semibold font-mono">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
              <span className="font-semibold font-mono">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-semibold font-mono">{pagination.total.toLocaleString()}</span> authoritative records
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                onClick={() => {
                  const newPage = Math.max(1, page - 1);
                  setPage(newPage);
                  fetchEvents(newPage);
                }}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors shadow-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <span className="font-mono text-slate-600 px-2 font-medium">
                Page {pagination.page} / {pagination.totalPages}
              </span>

              <button
                onClick={() => {
                  const newPage = Math.min(pagination.totalPages, page + 1);
                  setPage(newPage);
                  fetchEvents(newPage);
                }}
                disabled={page >= pagination.totalPages || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors shadow-xs"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-elevated w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-lg text-slate-900">
                    Observation Event #{selectedEvent.id}
                  </span>
                  <StatusBadge status={selectedEvent.fire_type} type="classification" />
                </div>
                <p className="text-xs text-slate-500">
                  Observation record details and spatial metrics
                </p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Model Probability Breakdown Card */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-geo-600" />
                  RandomForestClassifier Model Probabilities
                </span>
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
                  Confidence: {Math.round(selectedEvent.prediction_confidence * 100)}% ({selectedEvent.prediction_class})
                </span>
              </div>

              {loadingInference ? (
                <div className="py-2 text-center text-xs text-slate-400 font-mono">
                  Querying ML service...
                </div>
              ) : detailProbabilities ? (
                <div className="space-y-2 pt-1 text-xs">
                  {Object.entries(detailProbabilities).map(([clsName, prob]) => {
                    const pct = Math.round(prob * 100);
                    return (
                      <div key={clsName} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-medium text-slate-700">{clsName}</span>
                          <span className="font-mono font-semibold text-slate-900">{pct}% ({prob})</span>
                        </div>
                        <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              clsName === 'Industrial Fire'
                                ? 'bg-red-500'
                                : clsName === 'Persistent Thermal Source'
                                ? 'bg-orange-500'
                                : clsName === 'Natural Fire'
                                ? 'bg-green-500'
                                : 'bg-slate-400'
                            }`}
                            style={{ width: `${Math.max(pct, 1)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  Target Classified As: <strong className="text-slate-900">{selectedEvent.fire_type}</strong> ({Math.round(selectedEvent.prediction_confidence * 100)}% certainty)
                </div>
              )}
            </div>

            {/* Phase 7: Multi-Source Classification Evidence Layer */}
            {detailEvidence && (
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white rounded-2xl border border-slate-700/80 p-4 space-y-3.5 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Multi-Source Classification Evidence
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-sans">
                      Calibrated Confidence:
                    </span>
                    <span className="text-xs font-mono font-bold text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
                      {detailEvidence.confidence !== undefined ? `${(detailEvidence.confidence * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Evidence Factors Pills (Phase 7 exact requirement) */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
                    Contributing Evidence Factors:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {detailEvidence.factors?.map((f, idx) => {
                      const levelUpper = (f.level || '').toUpperCase();
                      const isHigh = levelUpper === 'HIGH';
                      const isMed = levelUpper === 'MEDIUM';
                      return (
                        <div
                          key={idx}
                          className="bg-slate-800/80 border border-slate-700 rounded-xl p-2 flex flex-col justify-between"
                        >
                          <span className="text-[10px] capitalize text-slate-400 block font-medium truncate">
                            {f.factor}
                          </span>
                          <div className="flex items-center justify-between mt-1">
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                isHigh
                                  ? 'bg-red-950 text-red-300 border border-red-800'
                                  : isMed
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-slate-700 text-slate-300 border border-slate-600'
                              }`}
                            >
                              {f.level}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-400 mt-1 font-mono truncate" title={f.detail}>
                            {f.detail}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detailed 3-Pillar Telemetry Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-800/80">
                  {/* Thermal Pillar */}
                  <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-700/60 space-y-1">
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1">
                      <Flame className="w-3 h-3 text-orange-400 shrink-0" />
                      <span>Thermal Evidence</span>
                    </span>
                    <div className="text-slate-300 flex justify-between">
                      <span className="text-slate-400">Radiative Power:</span>
                      <span className="font-mono text-orange-200">{detailEvidence.thermal?.frp_mw} MW</span>
                    </div>
                    <div className="text-slate-300 flex justify-between">
                      <span className="text-slate-400">Brightness Temp:</span>
                      <span className="font-mono text-orange-200">{detailEvidence.thermal?.brightness_kelvin} K</span>
                    </div>
                    <div className="text-slate-300 flex justify-between">
                      <span className="text-slate-400">Scans:</span>
                      <span className="font-mono text-orange-200">{detailEvidence.thermal?.detections} detections</span>
                    </div>
                  </div>

                  {/* Spatial Pillar */}
                  <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-700/60 space-y-1">
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-sky-400 shrink-0" />
                      <span>Spatial Evidence</span>
                    </span>
                    <div className="text-slate-300 flex justify-between">
                      <span className="text-slate-400">Min Distance:</span>
                      <span className="font-mono text-sky-200">{detailEvidence.spatial?.min_distance_km} km</span>
                    </div>
                    <div className="text-slate-300 flex justify-between">
                      <span className="text-slate-400">Nearest Asset:</span>
                      <span className="font-mono text-sky-200 capitalize truncate max-w-[90px]">{detailEvidence.spatial?.nearest_category}</span>
                    </div>
                    <div className="text-slate-300 flex justify-between">
                      <span className="text-slate-400">Cluster Density:</span>
                      <span className="font-mono text-sky-200">{detailEvidence.spatial?.density_level?.toUpperCase()}</span>
                    </div>
                  </div>

                  {/* Temporal Pillar */}
                  <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-700/60 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Temporal Evidence</span>
                    </span>
                    <div className="text-slate-300 flex justify-between">
                      <span className="text-slate-400">Persistence:</span>
                      <span className="font-mono text-emerald-200">{detailEvidence.temporal?.persistence_days} Days</span>
                    </div>
                    <div className="text-slate-300 flex justify-between">
                      <span className="text-slate-400">Night Ratio:</span>
                      <span className="font-mono text-emerald-200">{Math.round((detailEvidence.temporal?.night_ratio || 0) * 100)}%</span>
                    </div>
                    <div className="text-slate-300 flex justify-between">
                      <span className="text-slate-400">Pattern:</span>
                      <span className="font-mono text-emerald-200 text-[10px]">{detailEvidence.temporal?.diurnal_pattern}</span>
                    </div>
                  </div>
                </div>

                {/* Guardrail Note if triggered */}
                {detailEvidence.guardrail_note && (
                  <div className="p-2 bg-amber-950/70 border border-amber-800/80 rounded-xl text-[11px] text-amber-200 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Scientific Guardrail:</strong> {detailEvidence.guardrail_note}</span>
                  </div>
                )}

                {/* Scientific Disclaimer */}
                <div className="p-2 bg-slate-950/60 border border-slate-800 rounded-xl text-[10px] text-slate-400 italic flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-slate-400 shrink-0" />
                  <span><strong>Scientific Disclaimer:</strong> {detailEvidence.scientific_disclaimer}</span>
                </div>
              </div>
            )}

            {/* Core Satellite Thermal & Radiative Metrics */}
            <div>
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide block mb-2.5">
                Satellite Thermal & Multi-Temporal Metrics
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Persistence</span>
                  <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">{selectedEvent.persistence_days} Days</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Detection Scans</span>
                  <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">{selectedEvent.detections} scans</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Night Ratio</span>
                  <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">{Math.round(selectedEvent.night_ratio * 100)}%</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average FRP</span>
                  <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">{selectedEvent.avg_frp.toFixed(2)} MW</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Maximum FRP</span>
                  <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">{selectedEvent.max_frp.toFixed(2)} MW</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total FRP</span>
                  <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">{selectedEvent.total_frp.toFixed(2)} MW</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Temp (VIIRS TI-4)</span>
                  <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">{selectedEvent.avg_bright_ti4.toFixed(1)} K</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Temp (VIIRS TI-5)</span>
                  <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">{selectedEvent.avg_bright_ti5.toFixed(1)} K</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sensor Confidence</span>
                  <span className="text-sm font-bold font-mono text-emerald-700 mt-0.5 block">{selectedEvent.prediction_class}</span>
                </div>
              </div>
            </div>

            {/* Infrastructure Distances Grid */}
            <div>
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide block mb-2.5">
                Calculated Distance to Critical Infrastructure
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
                  <span className="text-slate-500">Industrial Area:</span>
                  <span className="font-bold text-slate-900">{selectedEvent.distance_to_industrial_area_km.toFixed(2)} km</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
                  <span className="text-slate-500">Power Plant:</span>
                  <span className="font-bold text-slate-900">{selectedEvent.distance_to_power_plant_km.toFixed(2)} km</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
                  <span className="text-slate-500">Quarry:</span>
                  <span className="font-bold text-slate-900">{selectedEvent.distance_to_quarry_km.toFixed(2)} km</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
                  <span className="text-slate-500">Substation:</span>
                  <span className="font-bold text-slate-900">{selectedEvent.distance_to_substation_km.toFixed(2)} km</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
                  <span className="text-slate-500">Storage Tank:</span>
                  <span className="font-bold text-slate-900">{selectedEvent.distance_to_storage_tank_km.toFixed(2)} km</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
                  <span className="text-slate-500">Works:</span>
                  <span className="font-bold text-slate-900">{selectedEvent.distance_to_works_km.toFixed(2)} km</span>
                </div>
              </div>
            </div>

            {/* Exact 14 Ordered Model Features Audit */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Exact 14 Input Features Passed to Random Forest Model:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700">
                <div>1. persistence_days: {selectedEvent.persistence_days}</div>
                <div>2. detections: {selectedEvent.detections}</div>
                <div>3. avg_frp: {selectedEvent.avg_frp.toFixed(2)}</div>
                <div>4. max_frp: {selectedEvent.max_frp.toFixed(2)}</div>
                <div>5. total_frp: {selectedEvent.total_frp.toFixed(2)}</div>
                <div>6. avg_bright_ti4: {selectedEvent.avg_bright_ti4.toFixed(2)}</div>
                <div>7. avg_bright_ti5: {selectedEvent.avg_bright_ti5.toFixed(2)}</div>
                <div>8. night_ratio: {selectedEvent.night_ratio.toFixed(2)}</div>
                <div>9. dist_industrial: {selectedEvent.distance_to_industrial_area_km.toFixed(2)}</div>
                <div>10. dist_power: {selectedEvent.distance_to_power_plant_km.toFixed(2)}</div>
                <div>11. dist_quarry: {selectedEvent.distance_to_quarry_km.toFixed(2)}</div>
                <div>12. dist_substation: {selectedEvent.distance_to_substation_km.toFixed(2)}</div>
                <div>13. dist_storage: {selectedEvent.distance_to_storage_tank_km.toFixed(2)}</div>
                <div>14. dist_works: {selectedEvent.distance_to_works_km.toFixed(2)}</div>
              </div>
            </div>

            {/* Modal Footer & Data Integrity Note */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-500 leading-relaxed">
                <strong className="text-slate-700">Observation Data:</strong> All 14 input features displayed above originate from <code className="font-mono text-slate-800">data/fire_dataset.csv.xls</code>. Model probabilities are generated dynamically by the ML service.
              </div>
              <div className="flex items-center justify-between gap-3">
                <Link
                  to={`/investigate/${selectedEvent.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-geo-700 hover:bg-geo-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                >
                  <Activity className="w-3.5 h-3.5 text-white/90" />
                  <span>Open Full Investigation Page</span>
                </Link>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
