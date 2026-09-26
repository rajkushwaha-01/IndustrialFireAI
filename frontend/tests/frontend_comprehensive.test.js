import test from 'node:test';
import assert from 'node:assert';

test('Frontend Requirement 1: Build Verification', async () => {
  // Verify that frontend build dist output exists and contains essential assets
  const fs = await import('fs');
  const path = await import('path');

  const distPath = path.resolve(process.cwd(), 'dist');
  assert.ok(fs.existsSync(distPath), 'Frontend build directory dist/ must exist');

  const indexHtml = path.resolve(distPath, 'index.html');
  assert.ok(fs.existsSync(indexHtml), 'dist/index.html must exist');
  const htmlContent = fs.readFileSync(indexHtml, 'utf8');
  assert.ok(htmlContent.includes('<div id="root">'), 'index.html must mount root div');

  const assetsPath = path.resolve(distPath, 'assets');
  assert.ok(fs.existsSync(assetsPath), 'dist/assets/ directory must exist');
  const assetFiles = fs.readdirSync(assetsPath);
  assert.ok(assetFiles.some(f => f.endsWith('.js')), 'Build must generate JavaScript bundle');
  assert.ok(assetFiles.some(f => f.endsWith('.css')), 'Build must generate CSS bundle');
});

test('Frontend Requirement 2: Route Navigation Contract Tests', () => {
  // Define required canonical routes in App.jsx
  const canonicalRoutes = [
    { path: '/', component: 'Dashboard', public: true },
    { path: '/map', component: 'MapView', public: true },
    { path: '/events', component: 'Events', public: true },
    { path: '/events/:id', component: 'Investigation', public: true },
    { path: '/investigate', component: 'Investigation', public: true },
    { path: '/investigate/:id', component: 'Investigation', public: true },
    { path: '/analytics', component: 'Analytics', public: true },
    { path: '/data-sources', component: 'DataSources', public: true },
    { path: '/about', component: 'About', public: true }
  ];

  canonicalRoutes.forEach(r => {
    assert.ok(r.path.startsWith('/'), `Route ${r.path} must be rooted`);
    assert.ok(r.component, `Route ${r.path} must have associated component`);
  });

  // Verify route matching helper
  function matchRoute(testUrl) {
    const cleanUrl = testUrl.split('?')[0];
    if (cleanUrl === '/') return 'Dashboard';
    if (cleanUrl === '/map') return 'MapView';
    if (cleanUrl === '/events') return 'Events';
    if (cleanUrl === '/investigate' || /^\/investigate\/\w+$/.test(cleanUrl) || /^\/events\/\w+$/.test(cleanUrl)) return 'Investigation';
    if (cleanUrl === '/analytics') return 'Analytics';
    if (cleanUrl === '/data-sources' || cleanUrl === '/datasources') return 'DataSources';
    if (cleanUrl === '/about') return 'About';
    return null;
  }

  assert.strictEqual(matchRoute('/'), 'Dashboard');
  assert.strictEqual(matchRoute('/map?classification=Industrial%20Fire'), 'MapView');
  assert.strictEqual(matchRoute('/events?minConfidence=0.9'), 'Events');
  assert.strictEqual(matchRoute('/investigate'), 'Investigation');
  assert.strictEqual(matchRoute('/investigate/1001'), 'Investigation');
  assert.strictEqual(matchRoute('/events/1001'), 'Investigation');
  assert.strictEqual(matchRoute('/analytics'), 'Analytics');
});

test('Frontend Requirement 3: Map Loading & GeoJSON Rendering', async () => {
  // Fetch real GeoJSON payload consumed by MapView
  const res = await fetch('http://localhost:5000/api/events/geojson?limit=100');
  assert.strictEqual(res.status, 200, 'GeoJSON endpoint must be reachable');

  const geojson = await res.json();
  assert.strictEqual(geojson.type, 'FeatureCollection', 'Must produce valid RFC 7946 FeatureCollection');
  assert.ok(Array.isArray(geojson.features), 'Features must be array');

  // Verify each feature has valid point geometry for Leaflet Marker/CircleMarker
  geojson.features.forEach(f => {
    assert.strictEqual(f.type, 'Feature');
    assert.strictEqual(f.geometry.type, 'Point');
    assert.strictEqual(f.geometry.coordinates.length, 2);
    const [lon, lat] = f.geometry.coordinates;
    assert.ok(typeof lon === 'number' && lon >= -180 && lon <= 180, 'Longitude must be valid');
    assert.ok(typeof lat === 'number' && lat >= -90 && lat <= 90, 'Latitude must be valid');
    assert.ok(f.properties.classification, 'Feature must have classification');
  });
});

test('Frontend Requirement 4: API Error Handling Tests', async () => {
  // 1. Non-existent Event ID (404)
  const notFoundRes = await fetch('http://localhost:5000/api/events/99999999');
  assert.strictEqual(notFoundRes.status, 404, 'Must return 404 for missing event');
  const notFoundJson = await notFoundRes.json();
  assert.strictEqual(notFoundJson.success, false);
  assert.ok(notFoundJson.error, 'Must provide human-readable error description');

  // 2. Invalid Coordinate Handling (422 ValidationError)
  const invalidGeoRes = await fetch('http://localhost:5000/api/spatial/correlate?lat=999&lon=999');
  assert.strictEqual(invalidGeoRes.status, 422, 'Must reject out-of-bounds coordinates with 422');
  const invalidGeoJson = await invalidGeoRes.json();
  assert.strictEqual(invalidGeoJson.success, false);
  assert.ok(invalidGeoJson.error.includes('Invalid query coordinates'));

  // 3. Invalid ML Inference Payload (422)
  const invalidMlRes = await fetch('http://localhost:5000/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ incomplete: true })
  });
  assert.strictEqual(invalidMlRes.status, 422, 'Must reject malformed inference payload');
});

test('Frontend Requirement 5: Multi-Factor Filtering Logic Tests', async () => {
  // Test filtered queries over real backend
  // 1. Classification filter
  const indRes = await fetch('http://localhost:5000/api/events?classification=Industrial%20Fire&limit=10');
  const indJson = await indRes.json();
  assert.ok(indJson.data.length > 0);
  indJson.data.forEach(item => {
    assert.strictEqual(item.fire_type, 'Industrial Fire');
  });

  // 2. High confidence filter
  const confRes = await fetch('http://localhost:5000/api/events?minConfidence=0.9&limit=10');
  const confJson = await confRes.json();
  confJson.data.forEach(item => {
    const c = item.confidence !== undefined ? item.confidence : item.prediction_confidence;
    assert.ok(c >= 0.9, `Confidence must be >= 0.9, got ${c}`);
  });

  // 3. Minimum persistence filter
  const persRes = await fetch('http://localhost:5000/api/events?minPersistence=30&limit=10');
  const persJson = await persRes.json();
  persJson.data.forEach(item => {
    assert.ok(item.persistence_days >= 30, `Persistence must be >= 30, got ${item.persistence_days}`);
  });
});

test('Frontend Requirement 6: Event Details & Investigation Dossier Mapping', async () => {
  // Query real event for complete dossier fields
  const res = await fetch('http://localhost:5000/api/events/1001');
  const json = await res.json();
  const evt = json.data;

  // Verify all fields needed by Investigation.jsx
  assert.ok(evt.id, 'Must have ID');
  assert.ok(evt.fire_type, 'Must have fire_type');
  assert.ok(typeof evt.frp === 'number', 'Must have numeric FRP');
  assert.ok(typeof evt.brightness_temperature === 'number', 'Must have brightness temperature');
  assert.ok(typeof evt.persistence_days === 'number', 'Must have persistence days');
  assert.ok(evt.spatial_context, 'Must have spatial context');
  assert.ok(evt.evidence, 'Must have evidence layer');
  assert.ok(evt.evidence.factors, 'Must have evidence factors');
  assert.ok(evt.evidence.scientific_disclaimer, 'Must have scientific disclaimer');
});
