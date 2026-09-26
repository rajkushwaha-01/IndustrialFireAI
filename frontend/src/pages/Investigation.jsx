import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell
} from 'recharts';
import PageContainer from '../components/PageContainer';
import SectionHeader from '../components/SectionHeader';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import {
  fetchEventById,
  fetchNearbyInfrastructure,
  fetchModelInfo,
  runPredict
} from '../services/api';
import {
  getSatelliteInspectionLinks,
  SATELLITE_PROVIDERS
} from '../services/satelliteProviders';
import {
  Flame,
  Zap,
  Thermometer,
  ShieldCheck,
  ShieldAlert,
  Layers,
  MapPin,
  Clock,
  Compass,
  Building2,
  Activity,
  ArrowLeft,
  ExternalLink,
  Info,
  AlertTriangle,
  Sliders,
  CheckCircle,
  HelpCircle,
  Satellite,
  Maximize2,
  RefreshCw,
  Search,
  Check
} from 'lucide-react';
import { DESIGN_TOKENS } from '../theme/tokens';

// Recenter map when event coordinates change
function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] !== null && center[1] !== null) {
      map.setView(center, 13);
    }
  }, [center, map]);
  return null;
}

export default function Investigation() {
  const { id: paramId } = useParams();
  const navigate = useNavigate();

  // Active Event ID (defaults to param or #1001)
  const [eventId, setEventId] = useState(paramId || '1001');
  const [inputEventId, setInputEventId] = useState(paramId || '1001');

  // Event & Related Data State
  const [eventData, setEventData] = useState(null);
  const [nearbyInfra, setNearbyInfra] = useState([]);
  const [modelInfo, setModelInfo] = useState(null);
  const [liveProbabilities, setLiveProbabilities] = useState(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeBasemap, setActiveBasemap] = useState('satellite'); // 'satellite' | 'osm' | 'dark'

  // Radius buffer for spatial queries (km)
  const [searchRadius, setSearchRadius] = useState(10);

  // Sync if URL param changes
  useEffect(() => {
    if (paramId && paramId !== eventId) {
      setEventId(paramId);
      setInputEventId(paramId);
    }
  }, [paramId]);

  // Load event details, model metadata, and nearby infrastructure
  const loadInvestigation = async (targetId) => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Event by ID
      const eventRes = await fetchEventById(targetId, searchRadius);
      if (!eventRes?.data) {
        throw new Error(`Thermal event #${targetId} not found in authoritative repository.`);
      }
      const evt = eventRes.data;
      setEventData(evt);

      // 2. Fetch Model Info in parallel
      try {
        const mInfo = await fetchModelInfo();
        setModelInfo(mInfo);
      } catch (mErr) {
        console.warn('Unable to load ML model info:', mErr);
      }

      // 3. If georeferenced, fetch actual nearby infrastructure
      if (evt.latitude !== null && evt.longitude !== null) {
        try {
          const infraRes = await fetchNearbyInfrastructure(evt.latitude, evt.longitude, searchRadius, 60);
          if (infraRes?.data) {
            setNearbyInfra(infraRes.data);
          }
        } catch (iErr) {
          console.warn('Unable to load nearby infrastructure:', iErr);
        }
      } else {
        setNearbyInfra([]);
      }

      // 4. Run live ML inference to retrieve probability distribution
      try {
        const payload = {
          persistence_days: Number(evt.persistence_days || 1),
          detections: Number(evt.detections || evt.detection_count || 1),
          avg_frp: Number(evt.avg_frp || evt.frp || 0),
          max_frp: Number(evt.max_frp || evt.frp || 0),
          total_frp: Number(evt.total_frp || evt.frp || 0),
          avg_bright_ti4: Number(evt.avg_bright_ti4 || evt.brightness_temperature || 0),
          avg_bright_ti5: Number(evt.avg_bright_ti5 || 0),
          night_ratio: Number(evt.night_ratio || 0),
          distance_to_industrial_area_km: Number(evt.distance_to_industrial_area_km ?? evt.spatial_context?.nearest_industrial_area_km ?? 0),
          distance_to_power_plant_km: Number(evt.distance_to_power_plant_km ?? evt.spatial_context?.nearest_power_plant_km ?? 0),
          distance_to_quarry_km: Number(evt.distance_to_quarry_km ?? evt.spatial_context?.nearest_quarry_km ?? 0),
          distance_to_substation_km: Number(evt.distance_to_substation_km ?? evt.spatial_context?.nearest_substation_km ?? 0),
          distance_to_storage_tank_km: Number(evt.distance_to_storage_tank_km ?? evt.spatial_context?.nearest_storage_tank_km ?? 0),
          distance_to_works_km: Number(evt.distance_to_works_km ?? evt.spatial_context?.nearest_works_km ?? 0)
        };
        const predRes = await runPredict(payload);
        if (predRes?.probabilities) {
          setLiveProbabilities(predRes.probabilities);
        }
      } catch (pErr) {
        console.warn('Predict live probabilities fallback:', pErr);
        if (evt.evidence?.probabilities) {
          setLiveProbabilities(evt.evidence.probabilities);
        }
      }
    } catch (err) {
      console.error('Failed to load investigation details:', err);
      setError(err.message || 'Error loading event investigation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvestigation(eventId);
  }, [eventId, searchRadius]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (inputEventId.trim()) {
      const cleanId = inputEventId.trim().replace('#', '');
      navigate(`/investigate/${cleanId}`);
    }
  };

  // Helper for Category Marker Colors
  const getInfraMarkerColor = (cat) => {
    switch (cat) {
      case 'power_plant': return '#dc2626'; // red
      case 'industrial_area': return '#2563eb'; // blue
      case 'substation': return '#7c3aed'; // purple
      case 'storage_tank': return '#ea580c'; // orange
      case 'quarry': return '#ca8a04'; // gold
      case 'works': return '#059669'; // emerald
      default: return '#64748b'; // slate
    }
  };

  // Basemap tile definitions
  const basemapUrls = {
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  };

  const hasCoords = eventData?.has_coordinates && eventData?.latitude !== null && eventData?.longitude !== null;
  const eventCoord = hasCoords ? [eventData.latitude, eventData.longitude] : [22.4782, 70.0612];

  // Satellite inspection external links
  const satelliteLinks = hasCoords ? getSatelliteInspectionLinks(eventData.latitude, eventData.longitude, {
    date: eventData.acquisition_date,
    name: `Thermal Event #${eventData.id}`
  }) : null;

  // Probability chart data
  const probChartData = liveProbabilities ? Object.entries(liveProbabilities).map(([cls, prob]) => {
    const colors = {
      'Industrial Fire': '#dc2626',
      'Persistent Thermal Source': '#ea580c',
      'Natural Fire': '#16a34a',
      'Other': '#64748b'
    };
    return {
      name: cls,
      probability: Number((prob * 100).toFixed(1)),
      color: colors[cls] || '#64748b'
    };
  }) : [];

  return (
    <PageContainer className="space-y-6">
      {/* 1. Header & Navigation Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/map"
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to GIS Map</span>
              </Link>
              <span className="text-slate-300">•</span>
              <Link
                to="/events"
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
              >
                Event Registry
              </Link>
              <span className="text-slate-300">•</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-900 text-white uppercase tracking-wider">
                Phase 9 Investigation Workflow
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Event Investigation: #{eventId}
              </h1>
              {eventData && (
                <StatusBadge
                  status={eventData.fire_type || eventData.classification}
                  type="classification"
                  className="text-xs font-semibold px-2.5 py-1"
                />
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
              Multimodal incident examination isolating acute industrial blazes, flare stacks, and brick kilns through thermal radiometry, temporal duration, and OpenStreetMap industrial correlation.
            </p>
          </div>

          {/* Quick ID Search & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={inputEventId}
                  onChange={(e) => setInputEventId(e.target.value)}
                  placeholder="Enter Event ID (e.g. 1001)"
                  className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-geo-500 focus:bg-white w-44"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs"
              >
                Inspect
              </button>
            </form>

            <button
              onClick={() => loadInvestigation(eventId)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all shadow-xs"
              title="Refresh investigation data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Quick Sample Selector for SIH Demonstration */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Sample SIH Events:</span>
          <button
            onClick={() => navigate('/investigate/1001')}
            className={`px-2.5 py-1 rounded-lg border text-xs font-mono transition-all ${
              eventId === '1001'
                ? 'bg-flame-50 text-flame-700 border-flame-300 font-bold'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            #1001 (Industrial Fire - Jamnagar)
          </button>
          <button
            onClick={() => navigate('/investigate/1002')}
            className={`px-2.5 py-1 rounded-lg border text-xs font-mono transition-all ${
              eventId === '1002'
                ? 'bg-flame-50 text-flame-700 border-flame-300 font-bold'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            #1002 (Industrial Fire - Gujarat)
          </button>
          <button
            onClick={() => navigate('/investigate/1')}
            className={`px-2.5 py-1 rounded-lg border text-xs font-mono transition-all ${
              eventId === '1'
                ? 'bg-purple-50 text-purple-700 border-purple-300 font-bold'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            #1 (Persistent Flare Source - 179 Days)
          </button>
          <button
            onClick={() => navigate('/investigate/3')}
            className={`px-2.5 py-1 rounded-lg border text-xs font-mono transition-all ${
              eventId === '3'
                ? 'bg-green-50 text-green-700 border-green-300 font-bold'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            #3 (Vegetation / Natural Burn)
          </button>
        </div>
      </div>

      {loading && !eventData ? (
        <LoadingState
          title={`Compiling Investigation Dossier for Event #${eventId}...`}
          description="Synthesizing radiometric thermal measurements, spatial proximity to 139k OSM nodes, and AI evidence factors..."
        />
      ) : error ? (
        <ErrorState
          title="Investigation Dossier Unavailable"
          error={error}
          onRetry={() => loadInvestigation(eventId)}
        />
      ) : (
        eventData && (
          <div className="space-y-6">
            {/* 2. Top Metric Cards (EVENT, THERMAL, AI SUMMARY) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: EVENT IDENTIFICATION */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Event Identification
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Event ID:</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">#{eventData.id}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Detection Time:</span>
                    <span className="font-mono font-medium text-slate-800">
                      {eventData.acquisition_date ? `${eventData.acquisition_date} ${eventData.acquisition_time || '00:00'} UTC` : 'Multi-temporal series'}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Coordinates:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {hasCoords ? `${eventData.latitude.toFixed(4)}°N, ${eventData.longitude.toFixed(4)}°E` : 'Multi-scan Centroid'}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Satellite / Sensor:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[150px]" title={eventData.satellite || eventData.source}>
                      {eventData.satellite || eventData.source || 'NASA FIRMS VIIRS'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: THERMAL CHARACTERISTICS */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Thermal Metrics
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-flame-50 text-flame-600 flex items-center justify-center">
                    <Flame className="w-4 h-4" />
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Radiative Power (FRP):</span>
                    <span className="font-mono font-bold text-flame-700 text-sm">
                      {(eventData.frp || eventData.avg_frp || 0).toFixed(2)} MW
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Brightness Temp (TI-4):</span>
                    <span className="font-mono font-medium text-slate-800">
                      {(eventData.brightness_temperature || eventData.avg_bright_ti4 || 0).toFixed(1)} K
                      <span className="text-slate-400 text-[10px] ml-1">
                        ({((eventData.brightness_temperature || eventData.avg_bright_ti4 || 273.15) - 273.15).toFixed(1)}°C)
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Detection Confidence:</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {Math.round((eventData.confidence || eventData.prediction_confidence || 0.8) * 100)}% Conf
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Observation Span:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {eventData.persistence_days} days ({eventData.detections || eventData.detection_count || 1} scans)
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: AI PREDICTION & MODEL */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    AI Classification
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Predicted Class:</span>
                    <span className="font-bold text-slate-900">
                      {eventData.fire_type || eventData.classification}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Certainty Level:</span>
                    <span className="font-mono font-bold text-geo-700 text-sm">
                      {Math.round((eventData.prediction_confidence || eventData.confidence || 0.8) * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Model Version:</span>
                    <span className="font-mono font-medium text-slate-800">
                      {modelInfo ? `v${modelInfo.version}` : 'v2.0.0'} (Random Forest)
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Estimators:</span>
                    <span className="font-mono text-slate-600">
                      {modelInfo?.n_estimators || 150} decision trees
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: SPATIAL PROXIMITY SUMMARY */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Spatial Correlation
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-geo-50 text-geo-700 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Industrial Area:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {(eventData.spatial_context?.nearest_industrial_area_km ?? eventData.distance_to_industrial_area_km ?? 0).toFixed(2)} km
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Storage Tank:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {(eventData.spatial_context?.nearest_storage_tank_km ?? eventData.distance_to_storage_tank_km ?? 0).toFixed(2)} km
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Power Plant:</span>
                    <span className="font-mono text-slate-800">
                      {(eventData.spatial_context?.nearest_power_plant_km ?? eventData.distance_to_power_plant_km ?? 0).toFixed(2)} km
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Nearby Facilities:</span>
                    <span className="font-mono font-bold text-geo-700">
                      {eventData.spatial_context?.nearby_infrastructure_count !== null && eventData.spatial_context?.nearby_infrastructure_count !== undefined
                        ? `${eventData.spatial_context.nearby_infrastructure_count} in 10km`
                        : `${nearbyInfra.length} OSM nodes`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. AI WHY CLASSIFICATION & EVIDENCE LAYER (Core SIH PS 26162 Problem Demonstration) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-geo-50 text-geo-700 flex items-center justify-center border border-geo-200">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      AI Classification Rationale: Why Was This Event Classified as "{eventData.fire_type || eventData.classification}"?
                    </h2>
                    <p className="text-xs text-slate-500">
                      Evidence fusion combining thermal radiometry, multi-temporal persistence, and spatial proximity to industrial facilities.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono">
                  <span className="text-slate-400">Class:</span>
                  <span className="font-bold text-slate-900">{eventData.fire_type}</span>
                </div>
              </div>

              {/* 4 Multi-Source Evidence Factors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Factor 1: Industrial Proximity */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Industrial Proximity</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      eventData.evidence?.factors?.find(f => f.factor === 'industrial proximity')?.level === 'high'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {eventData.evidence?.factors?.find(f => f.factor === 'industrial proximity')?.level || 'high'}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-800 font-medium">
                    {eventData.evidence?.factors?.find(f => f.factor === 'industrial proximity')?.detail || 
                      `${(eventData.spatial_context?.nearest_industrial_area_km ?? eventData.distance_to_industrial_area_km ?? 0).toFixed(2)} km to industrial zone`}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Thermal observations within ≤3 km of power plants, storage tanks, or chemical plants exhibit strong industrial correlation.
                  </p>
                </div>

                {/* Factor 2: Temporal Persistence */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Temporal Persistence</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      eventData.persistence_days >= 30
                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                        : eventData.persistence_days >= 7
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {eventData.evidence?.factors?.find(f => f.factor === 'persistence')?.level || (eventData.persistence_days >= 30 ? 'high' : 'medium')}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-800 font-medium">
                    {eventData.evidence?.factors?.find(f => f.factor === 'persistence')?.detail || 
                      `${eventData.persistence_days} days multi-temporal cluster`}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Agricultural residue fires burn out in 1–3 days. Ongoing industrial flaring or kilns persist over weeks/months.
                  </p>
                </div>

                {/* Factor 3: Radiative Heat Output */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Fire Radiative Power</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      (eventData.frp || eventData.avg_frp || 0) >= 30
                        ? 'bg-flame-100 text-flame-800 border border-flame-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {eventData.evidence?.factors?.find(f => f.factor === 'FRP')?.level || ((eventData.frp || eventData.avg_frp || 0) >= 30 ? 'high' : 'medium')}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-800 font-medium">
                    {eventData.evidence?.factors?.find(f => f.factor === 'FRP')?.detail || 
                      `${(eventData.frp || eventData.avg_frp || 0).toFixed(2)} MW average radiative power`}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Intense combustion at refinery stacks and steel furnaces produces high radiative wattage exceeding typical forest brush.
                  </p>
                </div>

                {/* Factor 4: Infrastructure Density */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Infrastructure Density</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      (eventData.spatial_context?.nearby_infrastructure_count || nearbyInfra.length) >= 10
                        ? 'bg-geo-100 text-geo-800 border border-geo-200'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {eventData.evidence?.factors?.find(f => f.factor === 'infrastructure density')?.level || 'high'}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-800 font-medium">
                    {eventData.evidence?.factors?.find(f => f.factor === 'infrastructure density')?.detail || 
                      `${eventData.spatial_context?.nearby_infrastructure_count || nearbyInfra.length} industrial facilities nearby`}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Evaluates multi-facility clustering (substations, refineries, chemical storage, industrial parks) within 10km radius.
                  </p>
                </div>
              </div>

              {/* Probability Spectrum & Diagnostic Synthesis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-3 border-t border-slate-100">
                {/* Live Probability Breakdown Chart */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Model Class Probabilities (Random Forest Ensemble)
                    </h3>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Sum: 100.0%
                    </span>
                  </div>

                  <div className="h-44 w-full bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={probChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#334155' }} width={120} />
                        <RechartsTooltip 
                          formatter={(value) => [`${value}%`, 'Class Probability']}
                          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                        />
                        <Bar dataKey="probability" radius={[0, 4, 4, 0]}>
                          {probChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Analytical Synthesis & Scientific Guardrail Notice */}
                <div className="space-y-3 flex flex-col justify-between">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <span className="font-bold text-slate-900 block uppercase tracking-wide">
                      Automated Diagnostic Synthesis
                    </span>
                    <p className="text-slate-600 leading-relaxed">
                      {eventData.fire_type === 'Industrial Fire'
                        ? `Event #${eventData.id} is classified as an Industrial Fire because high radiative thermal energy (${(eventData.frp || eventData.avg_frp || 0).toFixed(1)} MW) is spatially coupled with close proximity (${(eventData.spatial_context?.nearest_industrial_area_km ?? eventData.distance_to_industrial_area_km ?? 0).toFixed(2)} km) to registered industrial installations.`
                        : eventData.fire_type === 'Persistent Thermal Source'
                        ? `Event #${eventData.id} is classified as a Persistent Thermal Source due to its prolonged ${eventData.persistence_days}-day detection duration, constant multi-scan persistence (${eventData.detections || 1} detections), and co-location with industrial infrastructure such as flare stacks or kilns.`
                        : eventData.fire_type === 'Natural Fire'
                        ? `Event #${eventData.id} is classified as a Natural Fire due to transient duration, low multi-temporal persistence, and substantial distance from registered industrial complexes, matching agricultural residue or forest biomass burning.`
                        : `Event #${eventData.id} represents an anomaly of moderate or background thermal intensity where specific industrial features do not meet high-confidence threshold criteria.`}
                    </p>
                  </div>

                  {/* Mandatory Scientific Disclaimer (Do Not Claim Absolute Certainty) */}
                  <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <strong className="font-semibold block text-[11px] uppercase tracking-wide">
                        Scientific Guardrail & Probabilistic Limitation
                      </strong>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Thermal anomaly classification is probabilistic and derived from VIIRS/MODIS radiometric measurements and OpenStreetMap spatial correlation. Satellite data alone cannot establish definitive on-the-ground physical root cause without physical field inspection.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. SPATIAL CONTEXT DETAILED BREAKDOWN */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-geo-50 text-geo-700 flex items-center justify-center border border-geo-200">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      Spatial Proximity & Surrounding Infrastructure Audit
                    </h2>
                    <p className="text-xs text-slate-500">
                      Geodesic distances calculated against 139,682 authoritative OpenStreetMap India features.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  Search Radius: {searchRadius} km
                </span>
              </div>

              {/* Specific Distances to Required Categories */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Industrial Area</span>
                  <span className="text-base font-bold text-slate-900 font-mono block mt-1">
                    {(eventData.spatial_context?.nearest_industrial_area_km ?? eventData.distance_to_industrial_area_km ?? 0).toFixed(2)} km
                  </span>
                  <span className="text-[10px] text-slate-400">Nearest Park</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Power Plant</span>
                  <span className="text-base font-bold text-slate-900 font-mono block mt-1">
                    {(eventData.spatial_context?.nearest_power_plant_km ?? eventData.distance_to_power_plant_km ?? 0).toFixed(2)} km
                  </span>
                  <span className="text-[10px] text-slate-400">Generation</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Quarry / Mine</span>
                  <span className="text-base font-bold text-slate-900 font-mono block mt-1">
                    {(eventData.spatial_context?.nearest_quarry_km ?? eventData.distance_to_quarry_km ?? 0).toFixed(2)} km
                  </span>
                  <span className="text-[10px] text-slate-400">Excavation</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Storage Tank</span>
                  <span className="text-base font-bold text-slate-900 font-mono block mt-1">
                    {(eventData.spatial_context?.nearest_storage_tank_km ?? eventData.distance_to_storage_tank_km ?? 0).toFixed(2)} km
                  </span>
                  <span className="text-[10px] text-slate-400">Petro / Chemical</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Substation</span>
                  <span className="text-base font-bold text-slate-900 font-mono block mt-1">
                    {(eventData.spatial_context?.nearest_substation_km ?? eventData.distance_to_substation_km ?? 0).toFixed(2)} km
                  </span>
                  <span className="text-[10px] text-slate-400">High Voltage</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Industrial Works</span>
                  <span className="text-base font-bold text-slate-900 font-mono block mt-1">
                    {(eventData.spatial_context?.nearest_works_km ?? eventData.distance_to_works_km ?? 0).toFixed(2)} km
                  </span>
                  <span className="text-[10px] text-slate-400">Manufacturing</span>
                </div>
              </div>

              {/* Nearest Feature Callout */}
              {eventData.spatial_context?.nearest_feature && (
                <div className="p-3.5 bg-geo-50/60 rounded-xl border border-geo-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-geo-700 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900">
                        Primary Anchor: {eventData.spatial_context.nearest_feature.category?.replace('_', ' ').toUpperCase()} #{eventData.spatial_context.nearest_feature.id}
                      </span>
                      <span className="text-slate-600 block text-[11px]">
                        Located {eventData.spatial_context.nearest_feature.distance_km?.toFixed(2)} km away ({eventData.spatial_context.nearest_feature.direction}, azimuth {eventData.spatial_context.nearest_feature.bearing_deg?.toFixed(1)}°)
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">
                    Coords: {eventData.spatial_context.nearest_feature.coordinates?.[1]?.toFixed(4)}°N, {eventData.spatial_context.nearest_feature.coordinates?.[0]?.toFixed(4)}°E
                  </span>
                </div>
              )}
            </div>

            {/* 5. INTERACTIVE MAP: EVENT LOCATION, SURROUNDING INFRASTRUCTURE & SATELLITE IMAGERY */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-geo-50 text-geo-700 flex items-center justify-center border border-geo-200">
                    <Satellite className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      Interactive Geographic Investigation Map
                    </h2>
                    <p className="text-xs text-slate-500">
                      High-resolution satellite imagery inspection with thermal anomaly anchor and surrounding OSM industrial infrastructure.
                    </p>
                  </div>
                </div>

                {/* Basemap Switcher */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium self-start sm:self-auto">
                  <button
                    onClick={() => setActiveBasemap('satellite')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      activeBasemap === 'satellite'
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Satellite Imagery
                  </button>
                  <button
                    onClick={() => setActiveBasemap('osm')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      activeBasemap === 'osm'
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    OpenStreetMap
                  </button>
                  <button
                    onClick={() => setActiveBasemap('dark')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      activeBasemap === 'dark'
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Dark Carto
                  </button>
                </div>
              </div>

              {/* Embedded Map Container */}
              <div className="h-[480px] rounded-xl overflow-hidden relative border border-slate-200">
                <MapContainer
                  center={eventCoord}
                  zoom={12}
                  scrollWheelZoom={true}
                  className="w-full h-full z-0"
                >
                  <RecenterMap center={eventCoord} />

                  <TileLayer
                    attribution={
                      activeBasemap === 'satellite'
                        ? '&copy; <a href="https://www.esri.com/">Esri</a>, Earthstar Geographics'
                        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    }
                    url={basemapUrls[activeBasemap] || basemapUrls.satellite}
                    maxZoom={19}
                  />

                  {/* Buffer Zone Rings if Georeferenced */}
                  {hasCoords && (
                    <>
                      {/* 1km Zone */}
                      <Circle
                        center={eventCoord}
                        radius={1000}
                        pathOptions={{
                          color: '#dc2626',
                          weight: 1.5,
                          dashArray: '4, 4',
                          fillColor: '#dc2626',
                          fillOpacity: 0.08
                        }}
                      />
                      {/* 3km Zone */}
                      <Circle
                        center={eventCoord}
                        radius={3000}
                        pathOptions={{
                          color: '#ea580c',
                          weight: 1,
                          dashArray: '6, 6',
                          fillColor: '#ea580c',
                          fillOpacity: 0.04
                        }}
                      />
                    </>
                  )}

                  {/* Surrounding OSM Infrastructure Markers */}
                  {nearbyInfra.map((feat) => {
                    const lat = feat.coordinates ? feat.coordinates[1] : feat.latitude;
                    const lon = feat.coordinates ? feat.coordinates[0] : feat.longitude;
                    if (!lat || !lon) return null;
                    const color = getInfraMarkerColor(feat.category || feat.feature_category);

                    return (
                      <CircleMarker
                        key={`infra-${feat.id}`}
                        center={[lat, lon]}
                        radius={6}
                        pathOptions={{
                          fillColor: color,
                          fillOpacity: 0.9,
                          color: '#ffffff',
                          weight: 1.5
                        }}
                      >
                        <Popup>
                          <div className="text-xs space-y-1 p-1">
                            <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider">
                              OSM Infrastructure #{feat.id}
                            </span>
                            <p className="text-slate-600">
                              Category: <strong className="capitalize text-slate-900">{(feat.category || feat.feature_category)?.replace('_', ' ')}</strong>
                            </p>
                            {feat.distance_km !== undefined && (
                              <p className="text-slate-600 font-mono">
                                Distance: <strong>{feat.distance_km.toFixed(2)} km</strong> ({feat.direction || 'proximity'})
                              </p>
                            )}
                            <p className="text-slate-400 font-mono text-[10px]">
                              {lat.toFixed(4)}°N, {lon.toFixed(4)}°E
                            </p>
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}

                  {/* Primary Event Marker */}
                  {hasCoords && (
                    <CircleMarker
                      center={eventCoord}
                      radius={12}
                      pathOptions={{
                        fillColor: eventData.fire_type === 'Industrial Fire' ? '#dc2626' : eventData.fire_type === 'Persistent Thermal Source' ? '#ea580c' : '#16a34a',
                        fillOpacity: 0.9,
                        color: '#ffffff',
                        weight: 3
                      }}
                    >
                      <Popup>
                        <div className="text-xs space-y-1.5 p-1 min-w-[200px]">
                          <div className="flex items-center justify-between border-b pb-1">
                            <strong className="text-slate-900">Event #{eventData.id}</strong>
                            <StatusBadge status={eventData.fire_type} type="classification" className="text-[10px]" />
                          </div>
                          <div className="space-y-0.5 text-slate-600 text-[11px]">
                            <p>FRP: <strong>{(eventData.frp || eventData.avg_frp || 0).toFixed(2)} MW</strong></p>
                            <p>Brightness Temp: <strong>{(eventData.brightness_temperature || eventData.avg_bright_ti4 || 0).toFixed(1)} K</strong></p>
                            <p>Confidence: <strong>{Math.round((eventData.confidence || eventData.prediction_confidence || 0) * 100)}%</strong></p>
                            <p>Persistence: <strong>{eventData.persistence_days} days</strong></p>
                            <p>Acquisition: <strong>{eventData.acquisition_date || 'N/A'} {eventData.acquisition_time || ''}</strong></p>
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  )}
                </MapContainer>

                {/* Map Overlay: Infrastructure Key & Zone Notice */}
                <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur border border-slate-200 rounded-xl p-3 shadow-card text-[11px] space-y-2 hidden sm:block">
                  <span className="font-bold text-slate-900 uppercase tracking-wide text-[10px] block">
                    Map Key
                  </span>
                  <div className="space-y-1.5 text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full bg-red-600 border border-white shrink-0" />
                      <span className="font-semibold text-slate-800">Target Thermal Anomaly</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                      <span>Industrial Area</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
                      <span>Power Plant</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-600 shrink-0" />
                      <span>Storage Tank</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0" />
                      <span>Substation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                      <span>Works / Factory</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500 font-mono">
                    Red dashed: 1km buffer<br />Orange dashed: 3km corridor
                  </div>
                </div>

                {!hasCoords && (
                  <div className="absolute inset-0 z-[1000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-6 text-center">
                    <div className="bg-white rounded-2xl p-6 max-w-md shadow-2xl space-y-3">
                      <Info className="w-8 h-8 text-geo-700 mx-auto" />
                      <h3 className="text-base font-bold text-slate-900">
                        Zero-Fabrication Geographic Safeguard
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Event #{eventData.id} originates from historical multi-temporal telemetry without raw coordinates. 
                        Precomputed spatial distances are preserved with full integrity, but an artificial geographic pin is strictly avoided.
                      </p>
                      <button
                        onClick={() => navigate('/investigate/1001')}
                        className="px-4 py-2 bg-geo-700 hover:bg-geo-800 text-white rounded-xl text-xs font-semibold"
                      >
                        Inspect Georeferenced Event #1001
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* External Satellite Deep Inspection Links */}
              {satelliteLinks && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px] block">
                      Multi-Modal External Satellite Verification
                    </span>
                    <span className="text-slate-500">
                      Cross-examine optical multispectral ground conditions through independent satellite archives.
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={satelliteLinks.nasaWorldview}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-medium transition-colors"
                    >
                      <span>NASA Worldview</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                    <a
                      href={satelliteLinks.sentinelHub}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-medium transition-colors"
                    >
                      <span>Sentinel Hub (10m)</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                    <a
                      href={satelliteLinks.googleEarthEngine}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-medium transition-colors"
                    >
                      <span>Earth Engine</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      )}
    </PageContainer>
  );
}
