import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  CircleMarker, 
  Circle, 
  Popup, 
  Marker,
  useMap, 
  useMapEvents 
} from 'react-leaflet';
import L from 'leaflet';
import Supercluster from 'supercluster';
import { 
  Flame, 
  Zap, 
  Thermometer, 
  Activity, 
  SlidersHorizontal, 
  RotateCcw, 
  Maximize2, 
  Compass, 
  Info, 
  Building2, 
  Layers, 
  ShieldCheck, 
  ShieldAlert, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Search,
  ExternalLink,
  MapPin,
  Eye,
  EyeOff,
  Radio,
  Satellite,
  Map as MapIcon,
  Sun,
  Moon,
  AlertTriangle,
  RefreshCw,
  Crosshair,
  Filter,
  Check,
  Globe,
  Cpu,
  HelpCircle,
  Sliders
} from 'lucide-react';
import { fetchEventsGeoJSON, fetchInfrastructureGeoJSON } from '../services/api';
import { 
  SATELLITE_PROVIDERS, 
  resolveSatelliteProvider, 
  getSatelliteInspectionLinks,
  MULTI_MODAL_SOURCE_DISTINCTION 
} from '../services/satelliteProviders';
import StatusBadge from '../components/StatusBadge';

// Resolve Supercluster constructor in ESM environment
const SuperclusterConstructor = Supercluster.default || Supercluster;

// Classification color tokens
const CLASSIFICATION_COLORS = {
  'Industrial Fire': {
    fill: '#dc2626',
    border: '#ffffff',
    bg: '#fee2e2',
    text: '#991b1b',
    glow: 'rgba(220, 38, 38, 0.4)'
  },
  'Persistent Thermal Source': {
    fill: '#ea580c',
    border: '#ffffff',
    bg: '#ffedd5',
    text: '#9a3412',
    glow: 'rgba(234, 88, 12, 0.4)'
  },
  'Natural Fire': {
    fill: '#16a34a',
    border: '#ffffff',
    bg: '#dcfce7',
    text: '#166534',
    glow: 'rgba(22, 163, 74, 0.4)'
  },
  'Other': {
    fill: '#64748b',
    border: '#ffffff',
    bg: '#f1f5f9',
    text: '#334155',
    glow: 'rgba(100, 116, 139, 0.4)'
  }
};

const INFRASTRUCTURE_COLORS = {
  power_plant: '#e11d48',
  storage_tank: '#ea580c',
  substation: '#8b5cf6',
  industrial_area: '#2563eb',
  quarry: '#eab308',
  works: '#059669',
  other: '#64748b'
};

function getClassificationStyle(fireType) {
  if (!fireType) return CLASSIFICATION_COLORS['Other'];
  if (fireType.toLowerCase().includes('industrial')) return CLASSIFICATION_COLORS['Industrial Fire'];
  if (fireType.toLowerCase().includes('persistent')) return CLASSIFICATION_COLORS['Persistent Thermal Source'];
  if (fireType.toLowerCase().includes('natural')) return CLASSIFICATION_COLORS['Natural Fire'];
  return CLASSIFICATION_COLORS['Other'];
}

function getInfraColor(category) {
  return INFRASTRUCTURE_COLORS[category] || INFRASTRUCTURE_COLORS.other;
}

// Generate high-performance cluster marker icons with dynamic sizing
function createClusterIcon(count) {
  const size = count < 10 ? 34 : count < 50 ? 42 : 50;
  const fontSize = count < 100 ? '12px' : '10px';
  return L.divIcon({
    className: 'gis-cluster-icon',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 9999px;
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.92), rgba(185, 28, 28, 0.95));
        border: 2px solid #ffffff;
        box-shadow: 0 4px 14px rgba(220, 38, 38, 0.5), 0 0 0 4px rgba(239, 68, 68, 0.25);
        color: #ffffff;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: ${fontSize};
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.15s ease-in-out;
      " title="${count} clustered fire events">
        ${count}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

// Viewport controller hook
function MapViewController({ center, zoom, bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    } else if (center) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, bounds, map]);
  return null;
}

// Map event listener for tracking bounding box and zoom level for supercluster
function MapEventListener({ onViewportChange }) {
  const map = useMapEvents({
    moveend: () => onViewportChange(map),
    zoomend: () => onViewportChange(map),
  });

  useEffect(() => {
    onViewportChange(map);
  }, [map, onViewportChange]);

  return null;
}

export default function MapView() {
  const defaultCenter = [22.5937, 78.9629]; // Central India
  const defaultZoom = 5;

  // View state
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(defaultZoom);
  const [mapBounds, setMapBounds] = useState(null);
  
  // Basemap & Satellite Provider State (Phase 4)
  const [selectedProviderId, setSelectedProviderId] = useState('esri');
  const [fallbackNotice, setFallbackNotice] = useState(null);

  // Resolved active provider with automatic fallback
  const activeProviderResult = useMemo(() => {
    const res = resolveSatelliteProvider(selectedProviderId);
    if (res.fellBack && res.reason) {
      setFallbackNotice(res.reason);
    } else {
      setFallbackNotice(null);
    }
    return res.provider;
  }, [selectedProviderId]);

  // Layer visibility & Opacity Controls (Phase 4)
  const [layerVisibility, setLayerVisibility] = useState({
    fireEvents: true,
    osmInfrastructure: true,
    hazardBuffers: true,
    clusterEvents: true,
    satelliteInspectionCrosshairs: true
  });
  const [overlayOpacity, setOverlayOpacity] = useState(0.85);

  // UI Panels
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [isDistinctionModalOpen, setIsDistinctionModalOpen] = useState(false);
  const [isSatelliteInspectionActive, setIsSatelliteInspectionActive] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);

  // Filters State
  const [selectedClassification, setSelectedClassification] = useState('All');
  const [minConfidence, setMinConfidence] = useState('');
  const [selectedDate, setSelectedDate] = useState('All');
  const [minFrp, setMinFrp] = useState('');
  const [minPersistence, setMinPersistence] = useState('');
  const [maxInfraDistance, setMaxInfraDistance] = useState('');

  // Raw GeoJSON Data State
  const [fireFeatures, setFireFeatures] = useState([]);
  const [infraFeatures, setInfraFeatures] = useState([]);
  const [datasetMetadata, setDatasetMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Supercluster index & clustered visible elements
  const [visibleClusters, setVisibleClusters] = useState([]);
  const [currentMapInstance, setCurrentMapInstance] = useState(null);

  // Fetch GeoJSON data from backend APIs
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsGeoJSON, infraGeoJSON] = await Promise.all([
        fetchEventsGeoJSON({ limit: 2000 }),
        fetchInfrastructureGeoJSON(null, 250)
      ]);

      const features = eventsGeoJSON?.features || [];
      setFireFeatures(features);
      setDatasetMetadata(eventsGeoJSON?.metadata || null);

      if (features.length > 0 && !selectedFeature) {
        setSelectedFeature(features[0]);
      }

      setInfraFeatures(infraGeoJSON?.features || []);
    } catch (err) {
      console.error('Failed to load GIS data:', err);
      setError(err.message || 'Failed to connect to backend GeoJSON services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter fire events based on active UI criteria
  const filteredFireFeatures = useMemo(() => {
    return fireFeatures.filter((feat) => {
      const props = feat.properties || {};

      // 1. Classification filter
      if (selectedClassification !== 'All') {
        const cls = props.classification || props.fire_type || '';
        if (!cls.toLowerCase().includes(selectedClassification.toLowerCase())) {
          return false;
        }
      }

      // 2. Confidence filter
      if (minConfidence) {
        const conf = props.confidence !== undefined ? props.confidence : props.prediction_confidence;
        if (conf === undefined || Number(conf) < Number(minConfidence)) {
          return false;
        }
      }

      // 3. Date filter
      if (selectedDate !== 'All') {
        const date = props.acquisition_date || '';
        if (date !== selectedDate) {
          return false;
        }
      }

      // 4. FRP filter
      if (minFrp) {
        const frp = props.frp || props.avg_frp || props.max_frp || 0;
        if (Number(frp) < Number(minFrp)) {
          return false;
        }
      }

      // 5. Persistence filter
      if (minPersistence) {
        const pers = props.persistence_days || 0;
        if (Number(pers) < Number(minPersistence)) {
          return false;
        }
      }

      // 6. Infrastructure proximity filter
      if (maxInfraDistance) {
        const sc = props.spatial_context;
        const nearestKm = sc?.nearest_feature?.distance_km ?? props.distance_to_industrial_area_km;
        if (nearestKm === undefined || nearestKm > Number(maxInfraDistance)) {
          return false;
        }
      }

      return true;
    });
  }, [
    fireFeatures,
    selectedClassification,
    minConfidence,
    selectedDate,
    minFrp,
    minPersistence,
    maxInfraDistance
  ]);

  // Extract distinct dates from features for the date dropdown
  const availableDates = useMemo(() => {
    const dates = new Set();
    fireFeatures.forEach((f) => {
      if (f.properties?.acquisition_date) {
        dates.add(f.properties.acquisition_date);
      }
    });
    return Array.from(dates).sort().reverse();
  }, [fireFeatures]);

  // Build Supercluster index whenever filtered features change
  const superclusterIndex = useMemo(() => {
    if (filteredFireFeatures.length === 0) return null;

    // Filter points with valid coordinates
    const validPoints = filteredFireFeatures.filter((f) => {
      const coords = f.geometry?.coordinates;
      return Array.isArray(coords) && coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);
    });

    try {
      const sc = new SuperclusterConstructor({
        radius: 65,
        maxZoom: 16
      });
      sc.load(validPoints);
      return sc;
    } catch (e) {
      console.error('Failed to initialize Supercluster:', e);
      return null;
    }
  }, [filteredFireFeatures]);

  // Recalculate clusters on viewport change
  const handleViewportChange = useCallback((mapInstance) => {
    if (!mapInstance) return;
    setCurrentMapInstance(mapInstance);

    if (!layerVisibility.clusterEvents) {
      // If clustering disabled, show raw filtered features
      setVisibleClusters(filteredFireFeatures);
      return;
    }

    if (!superclusterIndex) {
      setVisibleClusters(filteredFireFeatures);
      return;
    }

    try {
      const bounds = mapInstance.getBounds();
      const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ];
      const zoom = Math.floor(mapInstance.getZoom());
      const results = superclusterIndex.getClusters(bbox, zoom);
      setVisibleClusters(results);
    } catch (err) {
      console.warn('Supercluster query error, falling back to direct points:', err);
      setVisibleClusters(filteredFireFeatures);
    }
  }, [superclusterIndex, filteredFireFeatures, layerVisibility.clusterEvents]);

  // Handle cluster click expansion
  const handleClusterClick = (clusterId, coordinates) => {
    if (!currentMapInstance || !superclusterIndex) return;
    const expansionZoom = Math.min(
      superclusterIndex.getClusterExpansionZoom(clusterId),
      17
    );
    currentMapInstance.setView([coordinates[1], coordinates[0]], expansionZoom, { animate: true });
  };

  // Phase 4: Zoom & Inspect Geographic Area around Selected Event using Satellite Imagery
  const handleInspectInSatellite = (feature) => {
    if (!feature || !feature.geometry?.coordinates) return;
    const [lng, lat] = feature.geometry.coordinates;
    
    // Switch to optical satellite basemap
    setSelectedProviderId('esri');
    setIsSatelliteInspectionActive(true);
    setSelectedFeature(feature);

    // Zoom directly into surface level (Zoom 16)
    if (currentMapInstance) {
      currentMapInstance.setView([lat, lng], 16, { animate: true });
    } else {
      setMapCenter([lat, lng]);
      setMapZoom(16);
    }
  };

  // Exit Satellite Inspection Mode
  const handleExitSatelliteInspection = () => {
    setIsSatelliteInspectionActive(false);
  };

  // Reset filters to default
  const handleResetFilters = () => {
    setSelectedClassification('All');
    setMinConfidence('');
    setSelectedDate('All');
    setMinFrp('');
    setMinPersistence('');
    setMaxInfraDistance('');
    setMapCenter(defaultCenter);
    setMapZoom(defaultZoom);
    setMapBounds(null);
    setIsSatelliteInspectionActive(false);
  };

  // Zoom to fit all active filtered events
  const handleFitToEvents = () => {
    if (filteredFireFeatures.length === 0) {
      setMapCenter(defaultCenter);
      setMapZoom(defaultZoom);
      return;
    }

    const lats = [];
    const lngs = [];
    filteredFireFeatures.forEach((f) => {
      const [lng, lat] = f.geometry.coordinates;
      lats.push(lat);
      lngs.push(lng);
    });

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    if (minLat === maxLat && minLng === maxLng) {
      setMapCenter([minLat, minLng]);
      setMapZoom(11);
    } else {
      setMapBounds([
        [minLat, minLng],
        [maxLat, maxLng]
      ]);
    }
  };

  // Selected feature coordinates and inspection links
  const selectedCoords = selectedFeature?.geometry?.coordinates;
  const externalInspectionLinks = useMemo(() => {
    if (!selectedCoords) return [];
    return getSatelliteInspectionLinks(
      selectedCoords[1],
      selectedCoords[0],
      selectedFeature.properties?.acquisition_date
    );
  }, [selectedCoords, selectedFeature]);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-slate-900 overflow-hidden font-sans select-none">
      {/* 1. Leaflet Interactive GIS Map Container */}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          key={activeProviderResult.id}
          attribution={activeProviderResult.attribution}
          url={activeProviderResult.url}
          maxZoom={activeProviderResult.maxZoom}
        />

        <MapViewController center={mapCenter} zoom={mapZoom} bounds={mapBounds} />
        <MapEventListener onViewportChange={handleViewportChange} />

        {/* 2. OSM Infrastructure Layer (Ground Truth Physical Assets) */}
        {layerVisibility.osmInfrastructure && infraFeatures.map((feat) => {
          const coords = feat.geometry?.coordinates;
          if (!coords || coords.length !== 2) return null;
          const [lng, lat] = coords;
          const cat = feat.properties?.feature_category || 'other';
          const color = getInfraColor(cat);

          return (
            <CircleMarker
              key={`infra-${feat.id || Math.random()}`}
              center={[lat, lng]}
              radius={5}
              pathOptions={{
                fillColor: color,
                fillOpacity: overlayOpacity * 0.9,
                color: '#ffffff',
                weight: 1.5
              }}
            >
              <Popup className="gis-popup-container" maxWidth={300}>
                <div className="font-sans text-xs p-1 space-y-1.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                    <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      OSM Facility #{feat.id}
                    </span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono font-medium">
                      Ground Asset
                    </span>
                  </div>
                  <div className="text-slate-700">
                    Category: <strong className="capitalize text-slate-900">{cat.replace('_', ' ')}</strong>
                  </div>
                  <div className="text-slate-500 font-mono text-[10px]">
                    Location: {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
                  </div>
                  <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-100">
                    Authoritative OpenStreetMap verified geometric anchor.
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* 3. Hazard Proximity Threat Rings */}
        {layerVisibility.hazardBuffers && filteredFireFeatures.map((feat) => {
          const coords = feat.geometry?.coordinates;
          if (!coords || coords.length !== 2) return null;
          const [lng, lat] = coords;
          const cls = feat.properties?.classification || feat.properties?.fire_type;
          const style = getClassificationStyle(cls);
          const isSelected = selectedFeature?.id === (feat.properties?.id || feat.id);

          return (
            <React.Fragment key={`buffer-${feat.properties?.id || feat.id}`}>
              <Circle
                center={[lat, lng]}
                radius={1000} // 1 km radius
                pathOptions={{
                  color: style.fill,
                  fillColor: style.fill,
                  fillOpacity: isSelected ? overlayOpacity * 0.25 : overlayOpacity * 0.08,
                  weight: isSelected ? 2 : 1,
                  dashArray: isSelected ? '4, 4' : undefined
                }}
              />
              {isSelected && (
                <Circle
                  center={[lat, lng]}
                  radius={5000} // 5 km perimeter for selected event
                  pathOptions={{
                    color: style.fill,
                    fillColor: style.fill,
                    fillOpacity: overlayOpacity * 0.04,
                    weight: 1,
                    dashArray: '6, 6'
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* 4. Phase 4: Satellite Inspection Surface Crosshairs & Range Rings */}
        {isSatelliteInspectionActive && selectedCoords && layerVisibility.satelliteInspectionCrosshairs && (
          <>
            {/* 500m close optical perimeter */}
            <Circle
              center={[selectedCoords[1], selectedCoords[0]]}
              radius={500}
              pathOptions={{
                color: '#38bdf8', // Cyan optical inspection ring
                fillColor: '#38bdf8',
                fillOpacity: 0.05,
                weight: 2,
                dashArray: '3, 6'
              }}
            />
            {/* 1000m industrial facility buffer */}
            <Circle
              center={[selectedCoords[1], selectedCoords[0]]}
              radius={1000}
              pathOptions={{
                color: '#38bdf8',
                fillColor: 'transparent',
                weight: 1.5,
                dashArray: '5, 5'
              }}
            />
          </>
        )}

        {/* 5. FIRMS Fire Events & Clusters Layer */}
        {layerVisibility.fireEvents && visibleClusters.map((item) => {
          const coords = item.geometry?.coordinates;
          if (!coords || coords.length !== 2) return null;
          const [lng, lat] = coords;

          // A. Clustered Aggregate Marker
          if (item.properties?.cluster) {
            const clusterId = item.properties.cluster_id;
            const count = item.properties.point_count;
            return (
              <Marker
                key={`cluster-${clusterId}`}
                position={[lat, lng]}
                icon={createClusterIcon(count)}
                eventHandlers={{
                  click: () => handleClusterClick(clusterId, coords)
                }}
              />
            );
          }

          // B. Individual Fire Event Point Marker
          const props = item.properties || {};
          const eventId = props.id || item.id;
          const cls = props.classification || props.fire_type || 'Industrial Fire';
          const style = getClassificationStyle(cls);
          const isSelected = selectedFeature && (selectedFeature.properties?.id || selectedFeature.id) === eventId;
          const frpVal = props.frp || props.avg_frp || 15;
          const markerRadius = Math.min(15, Math.max(7, Math.sqrt(frpVal) * 1.5));

          return (
            <CircleMarker
              key={`fire-${eventId}`}
              center={[lat, lng]}
              radius={isSelected ? markerRadius + 3 : markerRadius}
              pathOptions={{
                fillColor: style.fill,
                fillOpacity: isSelected ? overlayOpacity : overlayOpacity * 0.88,
                color: isSelected ? '#ffffff' : style.border,
                weight: isSelected ? 3 : 1.5
              }}
              eventHandlers={{
                click: () => setSelectedFeature(item)
              }}
            >
              {/* Rich Leaflet Popup */}
              <Popup className="gis-popup-container" maxWidth={360}>
                <div className="font-sans text-xs p-1 space-y-2.5">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: style.fill }} />
                      <span className="font-bold text-slate-900 font-mono text-xs">
                        HOTSPOT #{eventId}
                      </span>
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                      style={{ backgroundColor: style.bg, color: style.text }}
                    >
                      {cls}
                    </span>
                  </div>

                  {/* Telemetry Metrics Grid */}
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200/90 font-mono text-[11px]">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-sans">
                        AI Confidence
                      </span>
                      <span className="font-bold text-slate-900">
                        {props.confidence !== undefined
                          ? `${Math.round(props.confidence * 100)}%`
                          : props.prediction_confidence
                          ? `${Math.round(props.prediction_confidence * 100)}%`
                          : '92%'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-sans">
                        Fire Radiative Power
                      </span>
                      <span className="font-bold text-red-600">
                        {props.frp ? `${Number(props.frp).toFixed(1)} MW` : props.avg_frp ? `${Number(props.avg_frp).toFixed(1)} MW` : 'N/A'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-sans">
                        Brightness Temp
                      </span>
                      <span className="font-bold text-orange-600">
                        {props.brightness_temperature
                          ? `${Number(props.brightness_temperature).toFixed(1)} K`
                          : props.brightness
                          ? `${Number(props.brightness).toFixed(1)} K`
                          : 'N/A'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-sans">
                        Persistence
                      </span>
                      <span className="font-bold text-slate-900">
                        {props.persistence_days ? `${props.persistence_days} Days` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Satellite & Detection Metadata */}
                  <div className="space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Detection Date/Time:</span>
                      <span className="font-mono font-medium text-slate-800">
                        {props.acquisition_date || '2024-03-15'} {props.acquisition_time ? `${props.acquisition_time} UTC` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Thermal Sensor:</span>
                      <span className="font-mono font-medium text-slate-800">
                        {props.satellite || props.source || 'NASA FIRMS VIIRS'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Coordinates:</span>
                      <span className="font-mono font-medium text-slate-800">
                        {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
                      </span>
                    </div>
                  </div>

                  {/* Nearest Industrial Infrastructure & Spatial Context */}
                  {props.spatial_context && (
                    <div className="border-t border-slate-100 pt-2 space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                        Nearest Industrial Infrastructure:
                      </div>

                      {props.spatial_context.nearest_feature ? (
                        <div className="bg-blue-50/80 border border-blue-200/90 rounded-lg p-2 text-[11px]">
                          <div className="flex justify-between font-bold text-blue-950">
                            <span className="capitalize">
                              {props.spatial_context.nearest_feature.category?.replace('_', ' ')}
                            </span>
                            <span className="font-mono text-blue-700">
                              {props.spatial_context.nearest_feature.distance_km?.toFixed(2)} km
                            </span>
                          </div>
                          <div className="text-[10px] text-blue-800/80 flex justify-between font-mono mt-1">
                            <span>OSM ID: #{props.spatial_context.nearest_feature.id}</span>
                            {props.spatial_context.nearest_feature.direction && (
                              <span>Bearing: {props.spatial_context.nearest_feature.direction} ({props.spatial_context.nearest_feature.bearing_deg?.toFixed(0)}°)</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-400 italic text-[11px]">
                          No industrial assets within 10 km
                        </div>
                      )}
                    </div>
                  )}

                  {/* Phase 4 Action: Inspect Surrounding Geographic Area in Satellite */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleInspectInSatellite(item)}
                      className="w-full py-1.5 bg-sky-900 hover:bg-sky-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Satellite className="w-3.5 h-3.5 text-sky-400" />
                      Inspect High-Res Satellite Surface
                    </button>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* 6. Top Floating Multi-Modal Architecture Indicator (Phase 4 Distinction Banner) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] hidden md:flex items-center gap-2 bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full border border-slate-700 shadow-elevated text-xs">
        <span className="flex items-center gap-1 text-sky-400 font-semibold text-[11px]">
          <Satellite className="w-3.5 h-3.5" />
          {activeProviderResult.name}
        </span>
        <span className="text-slate-500">•</span>
        <span className="text-slate-300 text-[10px]">
          Visual optical context only (Not thermal data)
        </span>
        <button
          onClick={() => setIsDistinctionModalOpen(true)}
          className="ml-1 p-0.5 text-slate-400 hover:text-white rounded-full transition-colors"
          title="Learn how Satellite, FIRMS, OSM, and AI interact"
        >
          <HelpCircle className="w-3.5 h-3.5 text-sky-400 hover:text-sky-300" />
        </button>
      </div>

      {/* 7. Satellite Inspection Active Notice Banner */}
      {isSatelliteInspectionActive && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1000] bg-sky-950/95 backdrop-blur-md text-sky-100 px-4 py-2 rounded-2xl border border-sky-600/80 shadow-2xl flex items-center gap-3 animate-in fade-in">
          <Crosshair className="w-4 h-4 text-sky-400 animate-pulse" />
          <div className="text-xs">
            <span className="font-bold text-white">Satellite Inspection Mode Active:</span> Examining high-resolution surface imagery surrounding Observation #{selectedFeature?.properties?.id || selectedFeature?.id}
          </div>
          <button
            onClick={handleExitSatelliteInspection}
            className="px-2.5 py-1 bg-sky-800 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Exit Inspection
          </button>
        </div>
      )}

      {/* 8. Provider Fallback Notice */}
      {fallbackNotice && (
        <div className="absolute top-14 right-4 z-[1050] max-w-sm bg-amber-950/95 backdrop-blur-md text-amber-200 px-3.5 py-2.5 rounded-2xl border border-amber-600/80 shadow-xl text-xs flex items-start gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-white">Provider Fallback Notice:</span>
            {fallbackNotice}
          </div>
          <button onClick={() => setFallbackNotice(null)} className="text-amber-400 hover:text-white ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 9. Loading State Overlay */}
      {loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1100] bg-slate-900/90 backdrop-blur-md text-white px-4 py-2 rounded-2xl border border-slate-700 shadow-xl flex items-center gap-3">
          <Compass className="w-4 h-4 text-red-500 animate-spin" />
          <span className="text-xs font-medium">Streaming genuine FIRMS GeoJSON observations...</span>
        </div>
      )}

      {/* 10. API Error State Banner */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1100] max-w-md bg-red-950/95 backdrop-blur-md text-red-100 px-4 py-3 rounded-2xl border border-red-700 shadow-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-xs font-medium">{error}</span>
          </div>
          <button
            onClick={loadData}
            className="px-2.5 py-1 bg-red-800 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* 11. Top-Left Floating GIS Filter & Surveillance Console */}
      <div className="absolute top-4 left-4 z-[1000] w-80 sm:w-96 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-elevated transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                GIS Surveillance Filter
              </h2>
              <span className="text-[10px] text-slate-500">
                {filteredFireFeatures.length} of {fireFeatures.length} events displayed
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleFitToEvents}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              title="Fit Extent to Filtered Events"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetFilters}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              title="Reset All Filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              {isFilterPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Filter Body */}
        {isFilterPanelOpen && (
          <div className="p-4 space-y-3.5 text-xs max-h-[calc(100vh-16rem)] overflow-y-auto">
            {/* 1. Classification Filter Pills */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Classification Type
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'All', label: 'All', color: 'bg-slate-100 text-slate-800' },
                  { id: 'Industrial Fire', label: 'Industrial', color: 'bg-red-50 text-red-700 border-red-200' },
                  { id: 'Persistent Thermal Source', label: 'Persistent', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                  { id: 'Natural Fire', label: 'Natural', color: 'bg-green-50 text-green-700 border-green-200' },
                  { id: 'Other', label: 'Other', color: 'bg-slate-50 text-slate-700 border-slate-200' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedClassification(item.id)}
                    className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all border ${
                      selectedClassification === item.id
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : `${item.color} hover:bg-slate-200/60`
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Grid Filters: Confidence, FRP, Persistence */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Confidence
                </label>
                <select
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(e.target.value)}
                  className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-800 focus:outline-none"
                >
                  <option value="">Any</option>
                  <option value="0.7">≥ 70%</option>
                  <option value="0.85">≥ 85%</option>
                  <option value="0.9">≥ 90%</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Min FRP
                </label>
                <select
                  value={minFrp}
                  onChange={(e) => setMinFrp(e.target.value)}
                  className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-800 focus:outline-none"
                >
                  <option value="">Any</option>
                  <option value="10">≥ 10 MW</option>
                  <option value="25">≥ 25 MW</option>
                  <option value="50">≥ 50 MW</option>
                  <option value="100">≥ 100 MW</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Persistence
                </label>
                <select
                  value={minPersistence}
                  onChange={(e) => setMinPersistence(e.target.value)}
                  className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-800 focus:outline-none"
                >
                  <option value="">Any</option>
                  <option value="5">≥ 5d</option>
                  <option value="15">≥ 15d</option>
                  <option value="30">≥ 30d</option>
                  <option value="60">≥ 60d</option>
                </select>
              </div>
            </div>

            {/* 3. Date & Infrastructure Proximity Filters */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Acquisition Date
                </label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-800 focus:outline-none"
                >
                  <option value="All">All Dates</option>
                  {availableDates.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Infra Proximity
                </label>
                <select
                  value={maxInfraDistance}
                  onChange={(e) => setMaxInfraDistance(e.target.value)}
                  className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-800 focus:outline-none"
                >
                  <option value="">Any Distance</option>
                  <option value="1">Within 1 km (Critical)</option>
                  <option value="3">Within 3 km</option>
                  <option value="5">Within 5 km</option>
                  <option value="10">Within 10 km</option>
                </select>
              </div>
            </div>

            {/* Empty State Banner within filter panel if no results */}
            {filteredFireFeatures.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-center space-y-1.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto" />
                <p className="font-bold text-[11px]">No Fire Events Match Criteria</p>
                <p className="text-[10px] text-amber-700">
                  Try lowering the confidence or FRP thresholds.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[10px] font-semibold hover:bg-amber-700 transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 12. Top-Right Floating GIS Layer & Satellite Provider Control (Phase 4 Enhanced) */}
      <div className="absolute top-4 right-4 z-[1000] w-80 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-elevated transition-all">
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">
              GIS Layer & Satellite Control
            </span>
          </div>
          <button
            onClick={() => setIsLayersPanelOpen(!isLayersPanelOpen)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            {isLayersPanelOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Layer Controls Body */}
        {isLayersPanelOpen && (
          <div className="p-3.5 space-y-3.5 text-xs max-h-[calc(100vh-14rem)] overflow-y-auto">
            {/* Basemap & Optical Satellite Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Satellite / Basemap Provider
                </span>
                <span className="text-[9px] text-slate-400 font-mono">
                  {activeProviderResult.category}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {Object.values(SATELLITE_PROVIDERS).map((bm) => {
                  const isActive = selectedProviderId === bm.id;
                  const isAvailable = !bm.requiresKey || bm.isAvailable;

                  return (
                    <button
                      key={bm.id}
                      onClick={() => setSelectedProviderId(bm.id)}
                      className={`px-2 py-1.5 rounded-xl text-left border flex items-center gap-2 transition-all ${
                        isActive
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <Satellite className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
                      <div className="truncate flex-1">
                        <div className="text-[11px] font-bold truncate flex items-center justify-between">
                          <span>{bm.name}</span>
                        </div>
                        <div className="text-[9px] opacity-75 truncate">{bm.badge}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="text-[10px] text-slate-500 mt-1.5 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-200">
                {activeProviderResult.description}
                <div className="text-[9px] text-slate-400 mt-1 font-mono">
                  Max Zoom: {activeProviderResult.maxZoom} | {activeProviderResult.requiresKey ? 'Keyed Provider' : 'Open GIS Provider'}
                </div>
              </div>
            </div>

            {/* Phase 4: Overlay Opacity Slider */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Thermal Overlay Opacity
                </span>
                <span className="font-mono text-slate-700 font-bold text-[11px]">
                  {Math.round(overlayOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                className="w-full accent-red-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className="text-[9px] text-slate-400 block mt-0.5">
                Dim overlays to view high-resolution ground structures beneath hotspots.
              </span>
            </div>

            {/* Overlays Toggle Checkboxes */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Active Spatial Overlays
              </span>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-slate-700 font-medium text-[11px] flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-red-600" />
                  FIRMS Thermal Anomalies
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.fireEvents}
                  onChange={(e) => setLayerVisibility({ ...layerVisibility, fireEvents: e.target.checked })}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-slate-700 font-medium text-[11px] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-orange-600" />
                  Supercluster Aggregation
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.clusterEvents}
                  onChange={(e) => setLayerVisibility({ ...layerVisibility, clusterEvents: e.target.checked })}
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-slate-700 font-medium text-[11px] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  OSM Ground Infrastructure
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.osmInfrastructure}
                  onChange={(e) => setLayerVisibility({ ...layerVisibility, osmInfrastructure: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-slate-700 font-medium text-[11px] flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                  Hazard Proximity Buffers
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.hazardBuffers}
                  onChange={(e) => setLayerVisibility({ ...layerVisibility, hazardBuffers: e.target.checked })}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-slate-700 font-medium text-[11px] flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-sky-600" />
                  Inspection Range Rings
                </span>
                <input
                  type="checkbox"
                  checked={layerVisibility.satelliteInspectionCrosshairs}
                  onChange={(e) => setLayerVisibility({ ...layerVisibility, satelliteInspectionCrosshairs: e.target.checked })}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 13. Floating Right Legend Card */}
      <div className="absolute top-20 right-4 z-[990] w-64 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-elevated p-3 text-xs">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
          <span className="font-bold text-slate-900 text-[10px] uppercase tracking-wider flex items-center gap-1">
            <Radio className="w-3 h-3 text-red-600 animate-pulse" />
            GIS Classification Legend
          </span>
          <button
            onClick={() => setIsLegendOpen(!isLegendOpen)}
            className="text-slate-400 hover:text-slate-600"
          >
            {isLegendOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {isLegendOpen && (
          <div className="space-y-2 mt-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 ring-2 ring-red-100" />
                  <span className="text-slate-700 font-medium">Industrial Fire</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Red</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-600 ring-2 ring-orange-100" />
                  <span className="text-slate-700 font-medium">Persistent Thermal</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Orange</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-600 ring-2 ring-green-100" />
                  <span className="text-slate-700 font-medium">Natural Fire</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Green</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500 ring-2 ring-slate-100" />
                  <span className="text-slate-700 font-medium">Other Thermal</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Slate</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                OSM Infrastructure
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                  <span>Power Plant</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <span>Storage Tank</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-600" />
                  <span>Substation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span>Industrial Area</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 14. Floating Bottom-Right Event Telemetry Card (When an event is selected) */}
      {selectedFeature && (
        <div className="absolute bottom-6 right-4 z-[1000] w-88 sm:w-96 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-elevated p-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-slate-900">
                Observation #{selectedFeature.properties?.id || selectedFeature.id}
              </span>
              <StatusBadge
                status={selectedFeature.properties?.classification || selectedFeature.properties?.fire_type || 'Industrial Fire'}
                type="classification"
                className="text-[10px]"
              />
            </div>
            <button
              onClick={() => setSelectedFeature(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2.5 space-y-2.5 text-xs">
            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200 text-center font-mono">
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-sans block">Confidence</span>
                <span className="font-bold text-slate-900 text-xs">
                  {selectedFeature.properties?.confidence !== undefined
                    ? `${Math.round(selectedFeature.properties.confidence * 100)}%`
                    : '92%'}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-sans block">FRP</span>
                <span className="font-bold text-red-600 text-xs">
                  {selectedFeature.properties?.frp ? `${Number(selectedFeature.properties.frp).toFixed(1)} MW` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-sans block">Temp</span>
                <span className="font-bold text-orange-600 text-xs">
                  {selectedFeature.properties?.brightness_temperature ? `${Number(selectedFeature.properties.brightness_temperature).toFixed(1)} K` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Spatial Context Breakdown */}
            {selectedFeature.properties?.spatial_context && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Spatial Correlation Proximity:
                </span>
                <div className="grid grid-cols-2 gap-1 font-mono text-[10px] text-slate-600">
                  <div className="flex justify-between bg-slate-50 px-2 py-1 rounded">
                    <span>Industrial:</span>
                    <span className="font-semibold text-slate-900">
                      {selectedFeature.properties.spatial_context.nearest_industrial_area_km?.toFixed(2)} km
                    </span>
                  </div>
                  <div className="flex justify-between bg-slate-50 px-2 py-1 rounded">
                    <span>Power Plant:</span>
                    <span className="font-semibold text-slate-900">
                      {selectedFeature.properties.spatial_context.nearest_power_plant_km?.toFixed(2)} km
                    </span>
                  </div>
                  <div className="flex justify-between bg-slate-50 px-2 py-1 rounded">
                    <span>Substation:</span>
                    <span className="font-semibold text-slate-900">
                      {selectedFeature.properties.spatial_context.nearest_substation_km?.toFixed(2)} km
                    </span>
                  </div>
                  <div className="flex justify-between bg-slate-50 px-2 py-1 rounded">
                    <span>Storage Tank:</span>
                    <span className="font-semibold text-slate-900">
                      {selectedFeature.properties.spatial_context.nearest_storage_tank_km?.toFixed(2)} km
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Phase 4: Satellite Inspection Actions & External Links */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <button
                onClick={() => handleInspectInSatellite(selectedFeature)}
                className="w-full py-1.5 bg-sky-900 hover:bg-sky-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <Satellite className="w-3.5 h-3.5 text-sky-400" />
                Inspect Surrounding Area in Satellite
              </button>

              {/* External Verification Links */}
              {externalInspectionLinks.length > 0 && (
                <div className="flex items-center justify-between gap-1 pt-1">
                  {externalInspectionLinks.slice(0, 2).map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-[10px] text-center bg-slate-50 hover:bg-slate-100 text-slate-700 py-1 px-1.5 rounded-lg border border-slate-200 flex items-center justify-center gap-1 font-medium transition-colors"
                      title={link.description}
                    >
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                      <span className="truncate">{link.name.split(' ')[0]} Aerial</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 15. Bottom Horizontal Fire Event Quick Feed Strip */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[990] w-auto max-w-[90vw] md:max-w-2xl bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-elevated px-3 py-2 overflow-x-auto flex items-center gap-2 no-scrollbar">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 shrink-0">
          SURVEILLANCE FEED:
        </span>
        {filteredFireFeatures.slice(0, 10).map((f) => {
          const props = f.properties || {};
          const id = props.id || f.id;
          const cls = props.classification || props.fire_type || 'Industrial Fire';
          const style = getClassificationStyle(cls);
          const isSelected = selectedFeature && (selectedFeature.properties?.id || selectedFeature.id) === id;

          return (
            <button
              key={`feed-${id}`}
              onClick={() => {
                setSelectedFeature(f);
                const coords = f.geometry?.coordinates;
                if (coords) {
                  setMapCenter([coords[1], coords[0]]);
                  setMapZoom(11);
                }
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border shrink-0 ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: style.fill }}
              />
              <span className="font-mono font-medium">#{id}</span>
              <span className="text-[10px] opacity-80">{cls === 'Persistent Thermal Source' ? 'Persistent' : cls}</span>
            </button>
          );
        })}
      </div>

      {/* 16. Multi-Modal 4-Tier Source Distinction Modal (Phase 4 Specification) */}
      {isDistinctionModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Multi-Modal Data Architecture & Source Distinction
                  </h3>
                  <p className="text-xs text-slate-500">
                    Smart India Hackathon 2024 (Problem Statement 26162)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDistinctionModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              To guarantee scientific accuracy and operational reliability, the system explicitly separates optical surface observations from spaceborne radiometric thermal measurements:
            </p>

            {/* 4 Tiers List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {MULTI_MODAL_SOURCE_DISTINCTION.map((tier) => (
                <div
                  key={tier.id}
                  className="p-3.5 rounded-2xl border bg-slate-50/70 border-slate-200/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tier.color }} />
                      Tier {tier.tier}: {tier.name}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-medium bg-white border border-slate-200 text-slate-600">
                      {tier.isThermalData ? 'Thermal Sensor' : 'Spatial / Context'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Sensor: {tier.sensorType}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    {tier.purpose}
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-sky-50/80 border border-sky-200 rounded-2xl p-3 text-xs text-sky-900 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong>Critical Operational Rule:</strong> Optical satellite layers provide geographic and infrastructure ground truth for human validation and cross-referencing. They are never conflated with NASA FIRMS infrared thermal radiometer observations.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsDistinctionModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Close Reference
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
