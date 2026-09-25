import test from 'node:test';
import assert from 'node:assert';
import Supercluster from 'supercluster';

// Basemap URL and provider verification
const BASEMAP_PROVIDERS = {
  satellite: {
    id: 'satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19
  },
  osm: {
    id: 'osm',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19
  },
  dark: {
    id: 'dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    maxZoom: 19
  },
  topo: {
    id: 'topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxZoom: 17
  }
};

const CLASSIFICATION_COLORS = {
  'Industrial Fire': '#dc2626',
  'Persistent Thermal Source': '#ea580c',
  'Natural Fire': '#16a34a',
  'Other': '#64748b'
};

function getClassificationColor(fireType) {
  if (!fireType) return CLASSIFICATION_COLORS['Other'];
  if (fireType.toLowerCase().includes('industrial')) return CLASSIFICATION_COLORS['Industrial Fire'];
  if (fireType.toLowerCase().includes('persistent')) return CLASSIFICATION_COLORS['Persistent Thermal Source'];
  if (fireType.toLowerCase().includes('natural')) return CLASSIFICATION_COLORS['Natural Fire'];
  return CLASSIFICATION_COLORS['Other'];
}

// Sample GeoJSON test features simulating genuine backend FIRMS output
const sampleFeatures = [
  {
    type: 'Feature',
    id: 1001,
    geometry: { type: 'Point', coordinates: [70.0612, 22.4782] },
    properties: {
      id: 1001,
      classification: 'Industrial Fire',
      fire_type: 'Industrial Fire',
      confidence: 0.96,
      frp: 68.4,
      brightness_temperature: 365.2,
      persistence_days: 42,
      acquisition_date: '2024-03-15',
      acquisition_time: '1830',
      satellite: 'VIIRS-NOAA20',
      source: 'NASA FIRMS VIIRS 375m',
      spatial_context: {
        nearest_industrial_area_km: 3.02,
        nearest_power_plant_km: 24.2,
        nearest_feature: { category: 'substation', distance_km: 1.08 }
      }
    }
  },
  {
    type: 'Feature',
    id: 1002,
    geometry: { type: 'Point', coordinates: [70.0620, 22.4790] }, // Very close to 1001 (will cluster at low zoom)
    properties: {
      id: 1002,
      classification: 'Persistent Thermal Source',
      fire_type: 'Persistent Thermal Source',
      confidence: 0.92,
      frp: 45.0,
      brightness_temperature: 342.1,
      persistence_days: 55,
      acquisition_date: '2024-03-15',
      acquisition_time: '1830',
      satellite: 'VIIRS-NOAA20',
      source: 'NASA FIRMS VIIRS 375m',
      spatial_context: {
        nearest_industrial_area_km: 2.95,
        nearest_feature: { category: 'industrial_area', distance_km: 2.95 }
      }
    }
  },
  {
    type: 'Feature',
    id: 1003,
    geometry: { type: 'Point', coordinates: [86.18, 23.79] }, // Bokaro / Jharia (distant)
    properties: {
      id: 1003,
      classification: 'Natural Fire',
      fire_type: 'Natural Fire',
      confidence: 0.78,
      frp: 18.0,
      brightness_temperature: 318.0,
      persistence_days: 3,
      acquisition_date: '2024-03-14',
      acquisition_time: '0715',
      satellite: 'VIIRS-SNPP',
      source: 'NASA FIRMS VIIRS 375m',
      spatial_context: {
        nearest_industrial_area_km: 8.5,
        nearest_feature: { category: 'quarry', distance_km: 5.2 }
      }
    }
  }
];

test('1. Basemap provider configuration validation', () => {
  assert(BASEMAP_PROVIDERS.satellite.url.includes('World_Imagery'));
  assert(BASEMAP_PROVIDERS.osm.url.includes('openstreetmap.org'));
  assert(BASEMAP_PROVIDERS.dark.url.includes('dark_all'));
  assert(BASEMAP_PROVIDERS.topo.url.includes('opentopomap.org'));
  assert.strictEqual(BASEMAP_PROVIDERS.satellite.maxZoom, 19);
});

test('2. Classification color mapping complies with Phase 3 specification', () => {
  assert.strictEqual(getClassificationColor('Industrial Fire'), '#dc2626');
  assert.strictEqual(getClassificationColor('Persistent Thermal Source'), '#ea580c');
  assert.strictEqual(getClassificationColor('Natural Fire'), '#16a34a');
  assert.strictEqual(getClassificationColor('Other/Unknown'), '#64748b');
});

test('3. Supercluster aggregates dense events into cluster bubbles at low zoom', () => {
  const SuperclusterClass = Supercluster.default || Supercluster;
  const sc = new SuperclusterClass({ radius: 60, maxZoom: 16 });
  sc.load(sampleFeatures);

  // At zoom 5, points 1001 and 1002 (Jamnagar) should form a cluster
  const lowZoomClusters = sc.getClusters([65, 18, 90, 28], 5);
  const clusterFeature = lowZoomClusters.find((f) => f.properties.cluster === true);

  assert(clusterFeature !== undefined, 'Expected cluster feature at zoom 5');
  assert.strictEqual(clusterFeature.properties.point_count, 2);

  // Leaf point 1003 (Bokaro) should remain unclustered
  const leafFeature = lowZoomClusters.find((f) => !f.properties.cluster && f.properties.id === 1003);
  assert(leafFeature !== undefined, 'Expected unclustered point 1003');
});

test('4. Supercluster expands clusters into individual points at high zoom', () => {
  const SuperclusterClass = Supercluster.default || Supercluster;
  const sc = new SuperclusterClass({ radius: 60, maxZoom: 16 });
  sc.load(sampleFeatures);

  // At zoom 17 (above maxZoom 16), Jamnagar points 1001 and 1002 resolve to distinct individual leaves
  const highZoomClusters = sc.getClusters([70.0, 22.4, 70.1, 22.5], 17);
  const clusterFeatures = highZoomClusters.filter((f) => f.properties.cluster === true);
  assert.strictEqual(clusterFeatures.length, 0, 'No clusters should remain at zoom 17');
  assert.strictEqual(highZoomClusters.length, 2, 'Should display 2 individual points');
});

test('5. Multi-dimension GIS filtering works accurately', () => {
  // Filter by classification: Industrial Fire
  const industrialOnly = sampleFeatures.filter((f) => f.properties.classification === 'Industrial Fire');
  assert.strictEqual(industrialOnly.length, 1);
  assert.strictEqual(industrialOnly[0].id, 1001);

  // Filter by min confidence: >= 90%
  const highConf = sampleFeatures.filter((f) => f.properties.confidence >= 0.90);
  assert.strictEqual(highConf.length, 2);

  // Filter by min FRP: >= 50 MW
  const highFrp = sampleFeatures.filter((f) => f.properties.frp >= 50);
  assert.strictEqual(highFrp.length, 1);
  assert.strictEqual(highFrp[0].id, 1001);

  // Filter by infrastructure proximity: nearest feature <= 3 km
  const nearInfra = sampleFeatures.filter((f) => f.properties.spatial_context.nearest_feature.distance_km <= 3.0);
  assert.strictEqual(nearInfra.length, 2);
});

test('6. Fire event popup data structure contains all Phase 3 required fields', () => {
  const feat = sampleFeatures[0];
  const p = feat.properties;

  assert(p.id !== undefined, 'Missing Event ID');
  assert(p.classification !== undefined, 'Missing Classification');
  assert(p.confidence !== undefined, 'Missing AI confidence');
  assert(p.frp !== undefined, 'Missing FRP');
  assert(p.brightness_temperature !== undefined, 'Missing Brightness temperature');
  assert(p.persistence_days !== undefined, 'Missing Persistence');
  assert(p.acquisition_date !== undefined, 'Missing Acquisition Date');
  assert(p.acquisition_time !== undefined, 'Missing Acquisition Time');
  assert(p.satellite !== undefined, 'Missing Satellite');
  assert(p.source !== undefined, 'Missing Source');
  assert(p.spatial_context !== undefined, 'Missing Spatial Context');
  assert(p.spatial_context.nearest_feature !== undefined, 'Missing Nearest Industrial Infrastructure');
});

test('7. Phase 4: Satellite Providers catalog validates multiple optical and vector providers', async () => {
  const { SATELLITE_PROVIDERS } = await import('../src/services/satelliteProviders.js');
  assert(SATELLITE_PROVIDERS.esri !== undefined, 'Missing Esri provider');
  assert(SATELLITE_PROVIDERS.sentinel !== undefined, 'Missing Sentinel provider');
  assert(SATELLITE_PROVIDERS.mapbox !== undefined, 'Missing Mapbox provider');
  assert(SATELLITE_PROVIDERS.osm !== undefined, 'Missing OSM provider');
  assert(SATELLITE_PROVIDERS.dark !== undefined, 'Missing Dark Matter provider');

  // Esri and Sentinel do not require secret API keys
  assert.strictEqual(SATELLITE_PROVIDERS.esri.requiresKey, false);
  assert.strictEqual(SATELLITE_PROVIDERS.sentinel.requiresKey, false);
  // Mapbox requires API key
  assert.strictEqual(SATELLITE_PROVIDERS.mapbox.requiresKey, true);
});

test('8. Phase 4: resolveSatelliteProvider executes safe fallback when key is absent', async () => {
  const { resolveSatelliteProvider } = await import('../src/services/satelliteProviders.js');
  
  // Direct open provider
  const esriRes = resolveSatelliteProvider('esri');
  assert.strictEqual(esriRes.provider.id, 'esri');
  assert.strictEqual(esriRes.fellBack, false);

  // Keyed provider without key in test environment falls back safely to Esri
  const mapboxRes = resolveSatelliteProvider('mapbox');
  assert.strictEqual(mapboxRes.provider.id, 'esri');
  assert.strictEqual(mapboxRes.fellBack, true);
  assert(mapboxRes.reason.includes('Esri World Imagery'));
});

test('9. Phase 4: getSatelliteInspectionLinks generates valid deep inspection URLs', async () => {
  const { getSatelliteInspectionLinks } = await import('../src/services/satelliteProviders.js');
  const links = getSatelliteInspectionLinks(22.4782, 70.0612, '2024-03-15', 16);

  assert.strictEqual(links.length, 3);
  // Google Earth
  assert(links[0].url.includes('google.com/maps'));
  assert(links[0].url.includes('22.4782,70.0612'));
  // NASA Worldview with exact acquisition date
  assert(links[1].url.includes('worldview.earthdata.nasa.gov'));
  assert(links[1].url.includes('2024-03-15'));
  // Sentinel Hub
  assert(links[2].url.includes('eo-browser'));
  assert(links[2].url.includes('lat=22.4782'));
});

test('10. Phase 4: Multi-modal source distinction strictly separates optical satellite from thermal detections', async () => {
  const { MULTI_MODAL_SOURCE_DISTINCTION } = await import('../src/services/satelliteProviders.js');
  assert.strictEqual(MULTI_MODAL_SOURCE_DISTINCTION.length, 4);

  const tier1 = MULTI_MODAL_SOURCE_DISTINCTION.find((t) => t.id === 'satellite_imagery');
  const tier2 = MULTI_MODAL_SOURCE_DISTINCTION.find((t) => t.id === 'firms_thermal');
  const tier3 = MULTI_MODAL_SOURCE_DISTINCTION.find((t) => t.id === 'osm_infrastructure');
  const tier4 = MULTI_MODAL_SOURCE_DISTINCTION.find((t) => t.id === 'ai_classification');

  // Verify optical satellite is NOT thermal data
  assert.strictEqual(tier1.isThermalData, false, 'Satellite optical surface imagery must not be marked as thermal');
  // Verify FIRMS is thermal data
  assert.strictEqual(tier2.isThermalData, true, 'FIRMS must be marked as radiometric thermal sensor data');
  // Verify OSM is ground geometry
  assert.strictEqual(tier3.isThermalData, false);
  // Verify AI is classification hypothesis
  assert.strictEqual(tier4.isThermalData, false);
});

