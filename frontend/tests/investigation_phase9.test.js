import test from 'node:test';
import assert from 'node:assert';

test('SIH PS 26162 Phase 9: Event Investigation Workflow Data Contract', async () => {
  // Query georeferenced event #1001 from running backend
  const res = await fetch('http://localhost:5000/api/events/1001');
  assert.strictEqual(res.status, 200, 'GET /api/events/1001 must return 200 OK');

  const json = await res.json();
  assert.strictEqual(json.success, true, 'Event query must succeed');
  const evt = json.data;

  // 1. EVENT details
  assert.strictEqual(evt.id, 1001, 'Must have correct event ID');
  assert.ok(evt.acquisition_date !== undefined, 'Must provide acquisition date');
  assert.ok(evt.acquisition_time !== undefined, 'Must provide acquisition time');
  assert.strictEqual(typeof evt.latitude, 'number', 'Latitude must be a valid number');
  assert.strictEqual(typeof evt.longitude, 'number', 'Longitude must be a valid number');
  assert.ok(evt.source || evt.satellite, 'Source / satellite must be present');

  // 2. THERMAL metrics
  assert.ok(typeof evt.frp === 'number' || typeof evt.avg_frp === 'number', 'FRP must be numeric');
  assert.ok(typeof evt.brightness_temperature === 'number' || typeof evt.avg_bright_ti4 === 'number', 'Brightness temperature must be numeric');
  assert.ok(typeof evt.confidence === 'number' || typeof evt.prediction_confidence === 'number', 'Confidence must be numeric');
  assert.ok(typeof evt.persistence_days === 'number', 'Persistence days must be numeric');
  assert.ok(typeof evt.detection_count === 'number' || typeof evt.detections === 'number', 'Detection count must be numeric');

  // 3. AI prediction & evidence
  assert.ok(evt.fire_type || evt.classification, 'Predicted class must be present');
  assert.ok(typeof evt.prediction_confidence === 'number', 'AI confidence must be numeric');
  assert.ok(evt.evidence, 'Classification evidence must be present');
  assert.ok(Array.isArray(evt.evidence.factors), 'Evidence factors must be an array');
  assert.ok(evt.evidence.factors.length >= 4, 'Must have at least 4 contributing evidence factors');

  // 4. SPATIAL CONTEXT
  assert.ok(evt.spatial_context, 'Spatial context must be attached');
  assert.ok(typeof evt.spatial_context.nearest_industrial_area_km === 'number', 'Nearest industrial area distance must be numeric');
  assert.ok(typeof evt.spatial_context.nearest_power_plant_km === 'number', 'Nearest power plant distance must be numeric');
  assert.ok(typeof evt.spatial_context.nearest_quarry_km === 'number', 'Nearest quarry distance must be numeric');
  assert.ok(typeof evt.spatial_context.nearest_storage_tank_km === 'number', 'Nearest storage tank distance must be numeric');
  assert.ok(typeof evt.spatial_context.nearest_substation_km === 'number', 'Nearest substation distance must be numeric');
  assert.ok(typeof evt.spatial_context.nearest_works_km === 'number', 'Nearest works distance must be numeric');
  assert.ok(typeof evt.spatial_context.nearby_infrastructure_count === 'number', 'Nearby infrastructure count must be numeric');
});

test('SIH PS 26162 Phase 9: Model Version and Probabilistic Classification Guardrails', async () => {
  // 1. Model Info Endpoint
  const modelRes = await fetch('http://localhost:5000/api/model-info');
  assert.strictEqual(modelRes.status, 200, 'GET /api/model-info must return 200 OK');
  const modelInfo = await modelRes.json();

  assert.strictEqual(modelInfo.version, '2.0.0', 'Model version must be v2.0.0');
  assert.strictEqual(modelInfo.model_type, 'RandomForestClassifier', 'Model must be RandomForestClassifier');
  assert.strictEqual(modelInfo.n_estimators, 150, 'Model must have 150 estimators');

  // 2. Scientific Disclaimer Guardrail (Do not claim absolute certainty)
  const eventRes = await fetch('http://localhost:5000/api/events/1001');
  const eventJson = await eventRes.json();
  const evidence = eventJson.data.evidence;

  assert.ok(evidence.scientific_disclaimer, 'Scientific disclaimer must be present');
  assert.ok(
    evidence.scientific_disclaimer.toLowerCase().includes('probabilistic'),
    'Disclaimer must explicitly state that classification is probabilistic'
  );
  assert.ok(
    evidence.scientific_disclaimer.toLowerCase().includes('cannot establish definitive'),
    'Disclaimer must clarify that satellite data alone cannot establish physical cause without field inspection'
  );
});

test('SIH PS 26162 Phase 9: Surrounding Infrastructure Query for Map Display', async () => {
  // Query nearby infrastructure within 10km for Jamnagar event #1001
  const res = await fetch('http://localhost:5000/api/events/nearby-infrastructure?lat=22.4782&lon=70.0612&radius=10&limit=20');
  assert.strictEqual(res.status, 200, 'Nearby infrastructure query must return 200 OK');

  const json = await res.json();
  assert.strictEqual(json.success, true, 'Nearby infrastructure query must succeed');
  assert.ok(Array.isArray(json.data), 'Features must be an array');
  assert.ok(json.data.length > 0, 'Must find surrounding infrastructure features within 10km');

  json.data.forEach(feat => {
    assert.ok(feat.category, 'Feature must have category');
    assert.ok(typeof feat.distance_km === 'number' && feat.distance_km <= 10.0, 'Feature must be within 10 km');
    assert.ok(Array.isArray(feat.coordinates) && feat.coordinates.length === 2, 'Feature must have valid coordinates');
  });
});
