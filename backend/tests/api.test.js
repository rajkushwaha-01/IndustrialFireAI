const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- Starting Backend API Test Suite ---');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✓ PASSED: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAILED: ${name}`);
      console.error(err);
      failed++;
    }
  }

  // 1. Health Endpoint
  await test('GET /health returns healthy status and data layer counts', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
    assert.strictEqual(data.dataLayer.mode, 'csv_repository');
    assert.strictEqual(data.dataLayer.eventsCount, 224029);
    assert.strictEqual(data.dataLayer.infrastructureCount, 139682);
    assert.strictEqual(data.services.mlService.reachable, true);
  });

  // 2. Events Pagination
  await test('GET /events returns paginated results', async () => {
    const res = await fetch(`${BASE_URL}/events?page=1&limit=10`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.pagination.page, 1);
    assert.strictEqual(data.pagination.limit, 10);
    assert.strictEqual(data.pagination.total, 224029);
    assert.strictEqual(data.data.length, 10);
    assert.strictEqual(data.data[0].id, 1);
  });

  // 3. Events Filtering
  await test('GET /events filters by classification and confidence', async () => {
    const res = await fetch(`${BASE_URL}/events?classification=Industrial%20Fire&minConfidence=0.8&limit=5`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.pagination.total > 0);
    for (const item of data.data) {
      assert.strictEqual(item.fire_type, 'Industrial Fire');
      assert(item.prediction_confidence >= 0.8);
    }
  });

  // 4. Event by ID
  await test('GET /events/:id returns specific event', async () => {
    const res = await fetch(`${BASE_URL}/events/1`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.id, 1);
    assert.strictEqual(data.data.fire_type, 'Persistent Thermal Source');
  });

  // 5. Event by non-existent ID (404)
  await test('GET /events/:id returns 404 for invalid ID', async () => {
    const res = await fetch(`${BASE_URL}/events/999999`);
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert(data.error.includes('not found'));
  });

  // 6. Events Stats
  await test('GET /events/stats returns statistical aggregations', async () => {
    const res = await fetch(`${BASE_URL}/events/stats`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.totalEvents, 224029);
    assert(data.data.byClassification['Industrial Fire'].count > 0);
    assert(data.data.byClassification['Natural Fire'].count > 0);
    assert(data.data.byClassification['Persistent Thermal Source'].count > 0);
    assert(data.data.byClassification['Other'].count > 0);
  });

  // 7. Events GeoJSON
  await test('GET /events/geojson returns valid FeatureCollection with notice', async () => {
    const res = await fetch(`${BASE_URL}/events/geojson`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.type, 'FeatureCollection');
    assert.strictEqual(data.features.length, 0);
    assert(data.metadata.notice.includes('synthetic coordinates are not fabricated'));
  });

  // 8. Infrastructure
  await test('GET /infrastructure returns paginated OSM points', async () => {
    const res = await fetch(`${BASE_URL}/infrastructure?page=1&limit=5`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.pagination.total, 139682);
    assert.strictEqual(data.data.length, 5);
  });

  // 9. Infrastructure GeoJSON
  await test('GET /infrastructure?format=geojson returns FeatureCollection of Points', async () => {
    const res = await fetch(`${BASE_URL}/infrastructure?category=power_plant&format=geojson&limit=5`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.type, 'FeatureCollection');
    assert.strictEqual(data.features.length, 5);
    assert.strictEqual(data.features[0].geometry.type, 'Point');
    assert.strictEqual(data.features[0].properties.feature_category, 'power_plant');
  });

  // 10. Model Info (ML proxy)
  await test('GET /model-info proxies to ML service', async () => {
    const res = await fetch(`${BASE_URL}/model-info`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.model_type, 'RandomForestClassifier');
    assert.strictEqual(data.n_estimators, 200);
    assert.strictEqual(data.feature_names.length, 14);
  });

  // 11. Predict (ML proxy)
  await test('POST /predict proxies inference to ML service', async () => {
    const sample = {
      persistence_days: 77.0,
      detections: 244,
      avg_frp: 2.778033,
      max_frp: 10.25,
      total_frp: 677.84,
      avg_bright_ti4: 316.973525,
      avg_bright_ti5: 292.503484,
      night_ratio: 0.827869,
      distance_to_industrial_area_km: 1.2568,
      distance_to_power_plant_km: 9.1787,
      distance_to_quarry_km: 1.2721,
      distance_to_substation_km: 3.4375,
      distance_to_storage_tank_km: 3.1084,
      distance_to_works_km: 29.3907
    };

    const res = await fetch(`${BASE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample)
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.prediction, 'Industrial Fire');
    assert(data.confidence > 0.5);
    assert(data.probabilities['Industrial Fire'] > 0.5);
  });

  // 12. Predict validation error
  await test('POST /predict rejects invalid payload with 422', async () => {
    const res = await fetch(`${BASE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persistence_days: 77 })
    });
    assert.strictEqual(res.status, 422);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  console.log(`\n--- Test Summary: ${passed} Passed, ${failed} Failed ---`);
  if (failed > 0) process.exit(1);
}

runTests();
