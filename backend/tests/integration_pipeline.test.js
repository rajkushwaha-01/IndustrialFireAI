const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function runIntegrationPass() {
  console.log('--- Starting Complete End-to-End Integration Test Pass (Phase 10) ---');
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

  // Stage 1: FIRMS Ingestion
  let ingestedEventId = null;
  const uniqueTestLat = Number((22.4800 + Math.random() * 0.05).toFixed(4));
  const uniqueTestLon = Number((70.0600 + Math.random() * 0.05).toFixed(4));

  await test('Stage 1 -> Ingestion: Raw FIRMS stream validates, normalizes, and ingests record', async () => {
    const rawFirmsCsv = [
      'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight',
      `${uniqueTestLat},${uniqueTestLon},368.5,0.4,0.4,2024-03-27,0845,N,nominal,2.0N,298.2,74.5,D`
    ].join('\n');

    const res = await fetch(`${BASE_URL}/firms/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'csv_content',
        csvContent: rawFirmsCsv
      })
    });

    assert.strictEqual(res.status, 200, 'Ingest endpoint must return 200');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.records_received, 1);
    assert.strictEqual(data.data.records_inserted, 1);
    assert.strictEqual(data.data.invalid_records, 0);

    // Save ID of ingested event
    ingestedEventId = (data.data.inserted_ids && data.data.inserted_ids[0]) ||
                      (data.data.inserted_events && data.data.inserted_events[0].id);
    assert.ok(ingestedEventId, 'Ingestion must return an event ID');
  });

  // Stage 2: Database / Repository Persistence
  await test('Stage 2 -> Database: Ingested event is retrievable by ID from repository', async () => {
    assert.ok(ingestedEventId, 'Must have valid ingested ID from Stage 1');
    const res = await fetch(`${BASE_URL}/events/${ingestedEventId}`);
    assert.strictEqual(res.status, 200, 'Event must exist in repository');

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.id, ingestedEventId);
    assert.strictEqual(json.data.latitude, uniqueTestLat);
    assert.strictEqual(json.data.longitude, uniqueTestLon);
    assert.strictEqual(json.data.frp, 74.5);
    assert.strictEqual(json.data.brightness_temperature, 368.5);
    assert.strictEqual(json.data.acquisition_date, '2024-03-27');
    assert.ok(json.data.acquisition_time === '0845' || json.data.acquisition_time === '08:45');
  });

  // Stage 3: Spatial Correlation
  await test('Stage 3 -> Spatial Correlation: Event coordinates correlate against 139k OSM features', async () => {
    const res = await fetch(`${BASE_URL}/events/${ingestedEventId}`);
    const json = await res.json();
    const sc = json.data.spatial_context;

    assert.ok(sc, 'Spatial context must be populated');
    assert.strictEqual(sc.is_georeferenced, true);
    assert.ok(typeof sc.nearest_industrial_area_km === 'number');
    assert.ok(typeof sc.nearest_power_plant_km === 'number');
    assert.ok(typeof sc.nearest_quarry_km === 'number');
    assert.ok(typeof sc.nearest_storage_tank_km === 'number');
    assert.ok(typeof sc.nearest_substation_km === 'number');
    assert.ok(typeof sc.nearest_works_km === 'number');
    assert.ok(sc.nearby_infrastructure_count > 0, 'Must identify nearby OSM facilities within radius');
    assert.ok(sc.nearest_feature !== null, 'Must identify nearest feature geometry');
  });

  // Stage 4: ML Inference & Evidence
  await test('Stage 4 -> ML Inference: Spatial + Thermal telemetry feeds ML model and evidence layer', async () => {
    const eventRes = await fetch(`${BASE_URL}/events/${ingestedEventId}`);
    const eventJson = await eventRes.json();
    const evt = eventJson.data;

    const mlPayload = {
      persistence_days: Number(evt.persistence_days || 1),
      detections: Number(evt.detections || evt.detection_count || 1),
      avg_frp: Number(evt.frp),
      max_frp: Number(evt.frp),
      total_frp: Number(evt.frp),
      avg_bright_ti4: Number(evt.brightness_temperature),
      avg_bright_ti5: Number(evt.avg_bright_ti5 || 298.2),
      night_ratio: 0.0,
      distance_to_industrial_area_km: Number(evt.spatial_context.nearest_industrial_area_km),
      distance_to_power_plant_km: Number(evt.spatial_context.nearest_power_plant_km),
      distance_to_quarry_km: Number(evt.spatial_context.nearest_quarry_km),
      distance_to_substation_km: Number(evt.spatial_context.nearest_substation_km),
      distance_to_storage_tank_km: Number(evt.spatial_context.nearest_storage_tank_km),
      distance_to_works_km: Number(evt.spatial_context.nearest_works_km)
    };

    const predRes = await fetch(`${BASE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mlPayload)
    });

    assert.strictEqual(predRes.status, 200, 'ML inference proxy must succeed');
    const predData = await predRes.json();
    assert.ok(predData.prediction, 'Prediction must be returned');
    assert.ok(predData.confidence >= 0.0 && predData.confidence <= 1.0);
    assert.ok(predData.evidence, 'Evidence layer must be computed');
    assert.strictEqual(predData.evidence.classification, predData.prediction);
    assert.ok(predData.evidence.factors.length >= 4);
  });

  // Stage 5: GeoJSON API
  await test('Stage 5 -> GeoJSON API: Event is served in RFC 7946 FeatureCollection for Map', async () => {
    const res = await fetch(`${BASE_URL}/events/geojson?limit=1000`);
    assert.strictEqual(res.status, 200, 'GeoJSON endpoint must return 200');

    const geojson = await res.json();
    assert.strictEqual(geojson.type, 'FeatureCollection');
    assert.ok(Array.isArray(geojson.features));

    // Find our ingested feature
    const feature = geojson.features.find(f => f.id === ingestedEventId || f.properties?.id === ingestedEventId);
    assert.ok(feature, 'Ingested event must appear in GeoJSON FeatureCollection');
    assert.strictEqual(feature.geometry.type, 'Point');
    // Longitude first, latitude second (RFC 7946)
    assert.strictEqual(feature.geometry.coordinates[0], uniqueTestLon);
    assert.strictEqual(feature.geometry.coordinates[1], uniqueTestLat);
    assert.strictEqual(feature.properties.frp, 74.5);
  });

  // Stage 6: Surrounding Infrastructure for Map
  await test('Stage 6 -> Map Layers: Surrounding OSM infrastructure query serves map rendering', async () => {
    const res = await fetch(`${BASE_URL}/events/nearby-infrastructure?lat=${uniqueTestLat}&lon=${uniqueTestLon}&radius=10&limit=15`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length > 0, 'Must return surrounding facilities for map');

    const first = json.data[0];
    assert.ok(first.category);
    assert.ok(typeof first.distance_km === 'number');
    assert.ok(Array.isArray(first.coordinates));
    assert.strictEqual(first.coordinates.length, 2);
  });

  console.log(`\n--- Integration Pass Summary: ${passed} Passed, ${failed} Failed ---`);
  if (failed > 0) process.exit(1);
}

runIntegrationPass();
