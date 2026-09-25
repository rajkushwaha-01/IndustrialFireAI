/**
 * Satellite & Basemap Providers Engine — Phase 4
 * Provides multi-provider optical satellite imagery, key validation,
 * automatic fallback mechanisms, and contextual external satellite inspection links.
 */

// Safely resolve environment variables in Vite (import.meta.env) or Node.js (process.env)
const env = (typeof import.meta !== 'undefined' && import.meta.env) 
  ? import.meta.env 
  : (typeof process !== 'undefined' && process.env ? process.env : {});

const MAPBOX_TOKEN = env.VITE_MAPBOX_TOKEN || '';
const DEFAULT_PROVIDER = env.VITE_DEFAULT_SATELLITE_PROVIDER || 'esri';

export const SATELLITE_PROVIDERS = {
  esri: {
    id: 'esri',
    name: 'Esri World Imagery',
    category: 'Optical Satellite',
    badge: 'High-Res Optical',
    requiresKey: false,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19,
    description: 'Global high-resolution optical satellite surface photography for visual facility inspection.'
  },
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel-2 Cloudless',
    category: 'Optical Satellite',
    badge: 'Copernicus 10m',
    requiresKey: false,
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
    attribution: 'Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2020)',
    maxZoom: 16,
    description: 'European Space Agency (ESA) Copernicus Sentinel-2 multi-spectral optical imagery.'
  },
  mapbox: {
    id: 'mapbox',
    name: 'Mapbox Satellite HD',
    category: 'Optical Satellite',
    badge: 'Commercial HD',
    requiresKey: true,
    isAvailable: Boolean(MAPBOX_TOKEN),
    url: MAPBOX_TOKEN
      ? `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 20,
    description: 'High-resolution composite commercial satellite imagery with high revisit rates.'
  },
  osm: {
    id: 'osm',
    name: 'OpenStreetMap Standard',
    category: 'Vector Streets',
    badge: 'Vector Cartography',
    requiresKey: false,
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    description: 'Community-driven vector cartography with transportation corridors and place names.'
  },
  dark: {
    id: 'dark',
    name: 'CartoDB Dark Matter',
    category: 'Tactical Base',
    badge: 'Night Surveillance',
    requiresKey: false,
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    description: 'High-contrast dark cartography optimized for thermal anomaly and hotspot glow detection.'
  },
  topo: {
    id: 'topo',
    name: 'OpenTopoMap',
    category: 'Topographic',
    badge: 'Elevation Contours',
    requiresKey: false,
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Style: OpenTopoMap',
    maxZoom: 17,
    description: 'Digital elevation model relief shading and topographic contour contours.'
  }
};

/**
 * Resolves active provider with automatic fallback if key is missing or provider unsupported
 */
export function resolveSatelliteProvider(requestedId = DEFAULT_PROVIDER) {
  const provider = SATELLITE_PROVIDERS[requestedId];
  if (!provider) {
    return {
      provider: SATELLITE_PROVIDERS.esri,
      fellBack: true,
      reason: `Unknown provider "${requestedId}". Defaulted to Esri World Imagery.`
    };
  }

  if (provider.requiresKey && !provider.isAvailable) {
    return {
      provider: SATELLITE_PROVIDERS.esri,
      fellBack: true,
      reason: `Provider "${provider.name}" requires VITE_MAPBOX_TOKEN in .env. Falling back safely to Esri World Imagery.`
    };
  }

  return {
    provider,
    fellBack: false,
    reason: null
  };
}

/**
 * Generates external inspection links for deep visual satellite verification
 */
export function getSatelliteInspectionLinks(lat, lon, date = null, zoom = 16) {
  const formattedDate = date || new Date().toISOString().split('T')[0];
  const delta = 0.05;

  return [
    {
      name: 'Google Earth / Maps Satellite',
      url: `https://www.google.com/maps/@${lat},${lon},${zoom}z/data=!3m1!1e3`,
      description: 'Ultra high-resolution optical imagery and 3D terrain inspection'
    },
    {
      name: 'NASA Worldview (FIRMS Source Satellite)',
      url: `https://worldview.earthdata.nasa.gov/?v=${lon - delta},${lat - delta},${lon + delta},${lat + delta}&t=${formattedDate}`,
      description: 'Historical daily optical imagery matching exact FIRMS acquisition date'
    },
    {
      name: 'Sentinel Hub EO Browser',
      url: `https://apps.sentinel-hub.com/eo-browser/?lat=${lat}&lng=${lon}&zoom=${zoom}`,
      description: 'Copernicus Sentinel-2 multi-band shortwave infrared (SWIR) inspection'
    }
  ];
}

/**
 * 4-Tier Data Distinction Specification
 */
export const MULTI_MODAL_SOURCE_DISTINCTION = [
  {
    tier: 1,
    id: 'satellite_imagery',
    name: 'Satellite Optical Imagery',
    sensorType: 'Visible & Near-Infrared (VNIR) Surface Photography',
    purpose: 'Physical ground truth, spatial context, identifying cooling towers, flare stacks, rooflines, and storage facilities.',
    isThermalData: false,
    color: '#0284c7', // Sky Blue
    icon: 'Satellite'
  },
  {
    tier: 2,
    id: 'firms_thermal',
    name: 'NASA FIRMS Thermal Detections',
    sensorType: 'Mid-Infrared & Thermal Radiometry (VIIRS 375m / MODIS 1km)',
    purpose: 'Radiometric fire radiative power (MW), brightness temperature (K), and persistent hotspot coordinates.',
    isThermalData: true,
    color: '#dc2626', // Red
    icon: 'Flame'
  },
  {
    tier: 3,
    id: 'osm_infrastructure',
    name: 'OpenStreetMap (OSM) Infrastructure',
    sensorType: 'Human-Verified Ground GIS Geometries',
    purpose: 'Identifies industrial perimeters, power plants, refineries, quarries, substations, and storage tanks.',
    isThermalData: false,
    color: '#2563eb', // Blue
    icon: 'Building2'
  },
  {
    tier: 4,
    id: 'ai_classification',
    name: 'Multi-Modal AI Classification',
    sensorType: 'Random Forest Inference Engine',
    purpose: 'Synthesizes thermal emission dynamics with geospatial infrastructure distance signatures to classify anomalies.',
    isThermalData: false,
    color: '#ea580c', // Orange
    icon: 'Cpu'
  }
];

export default {
  SATELLITE_PROVIDERS,
  resolveSatelliteProvider,
  getSatelliteInspectionLinks,
  MULTI_MODAL_SOURCE_DISTINCTION
};
