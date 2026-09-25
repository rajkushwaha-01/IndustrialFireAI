const assert = require('assert');
const { calculateHaversineDistance, calculateBearing, getCompassDirection } = require('../src/utils/haversine');
const spatialCorrelationService = require('../src/services/spatialCorrelationService');
const Event = require('../src/models/Event');
const csvRepository = require('../src/repositories/csvRepository');

async function runSpatialTests() {
  console.log('--- Starting Spatial Correlation Engine Test Suite ---');
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

  // 1. Haversine Distance Accuracy
  await test('Haversine distance accurately measures known geographic distances', () => {
    // New Delhi (28.6139°N, 77.2090°E) to Agra (27.1767°N, 78.0081°E) ~ 178 to 185 km
    const distDelhiAgra = calculateHaversineDistance(28.6139, 77.2090, 27.1767, 78.0081);
    assert(distDelhiAgra >= 175 && distDelhiAgra <= 190, `Expected ~180km, got ${distDelhiAgra}`);

    // Mumbai to Pune (~120km)
    const distMumbaiPune = calculateHaversineDistance(18.9220, 72.8347, 18.5204, 73.8567);
    assert(distMumbaiPune >= 110 && distMumbaiPune <= 130, `Expected ~120km, got ${distMumbaiPune}`);

    // Same point
    const zeroDist = calculateHaversineDistance(20.0, 80.0, 20.0, 80.0);
    assert.strictEqual(zeroDist, 0.0);
  });

  // 2. Compass Bearing and Direction
  await test('Compass bearing calculation computes correct azimuth and direction', () => {
    // Due East (lat1 == lat2, lon2 > lon1)
    const bearingEast = calculateBearing(20.0, 70.0, 20.0, 80.0);
    assert(bearingEast >= 80 && bearingEast <= 100, `Expected ~90 deg, got ${bearingEast}`);
    assert.strictEqual(getCompassDirection(bearingEast), 'E');

    // Due South
    const bearingSouth = calculateBearing(30.0, 75.0, 20.0, 75.0);
    assert(bearingSouth >= 175 && bearingSouth <= 185, `Expected ~180 deg, got ${bearingSouth}`);
    assert.strictEqual(getCompassDirection(bearingSouth), 'S');
  });

  // 3. Spatial Grid Index Construction
  await test('SpatialCorrelationService indexes multi-category infrastructure', () => {
    const mockInfra = [
      { id: 1, latitude: 22.50, longitude: 88.30, feature_category: 'industrial_area' },
      { id: 2, latitude: 22.52, longitude: 88.32, feature_category: 'power_plant' },
      { id: 3, latitude: 22.48, longitude: 88.28, feature_category: 'storage_tank' },
      { id: 4, latitude: 22.55, longitude: 88.35, feature_category: 'substation' },
      { id: 5, latitude: 22.45, longitude: 88.25, feature_category: 'quarry' },
      { id: 6, latitude: 22.51, longitude: 88.31, feature_category: 'works' },
      { id: 7, latitude: 25.00, longitude: 85.00, feature_category: 'power_plant' } // far away
    ];

    spatialCorrelationService.buildIndex(mockInfra);

    assert.strictEqual(spatialCorrelationService.isIndexed, true);
    assert.strictEqual(spatialCorrelationService.totalIndexed, 7);
    assert(spatialCorrelationService.categories.has('power_plant'));
    assert(spatialCorrelationService.categories.has('industrial_area'));
  });

  // 4. Nearest Infrastructure Queries by Category
  await test('SpatialCorrelationService finds nearest category-specific infrastructure', () => {
    // Query point at 22.51°N, 88.31°E
    const nearestPower = spatialCorrelationService.getNearestFeature(22.51, 88.31, 'power_plant');
    assert.notStrictEqual(nearestPower, null);
    assert.strictEqual(nearestPower.id, 2); // 22.52, 88.32 is ~1.5km away
    assert(nearestPower.distance_km < 3.0);

    const nearestStorage = spatialCorrelationService.getNearestFeature(22.51, 88.31, 'storage_tank');
    assert.notStrictEqual(nearestStorage, null);
    assert.strictEqual(nearestStorage.id, 3);
  });

  // 5. Configurable Radius Threshold Counting
  await test('SpatialCorrelationService computes nearby counts for configurable radii', () => {
    // Within 5km of 22.50, 88.30
    const context5km = spatialCorrelationService.calculateSpatialContext(22.50, 88.30, { radiusKm: 5.0 });
    assert.strictEqual(context5km.radius_threshold_km, 5.0);
    assert(context5km.nearby_infrastructure_count >= 1);

    // Within 25km of 22.50, 88.30: includes items 1-6 but excludes item 7 (far away in Bihar)
    const context25km = spatialCorrelationService.calculateSpatialContext(22.50, 88.30, { radiusKm: 25.0 });
    assert.strictEqual(context25km.nearby_infrastructure_count, 6);
    assert(context25km.nearby_industrial_feature_count >= 3); // industrial_area, storage_tank, works
    assert(context25km.nearby_power_feature_count >= 2); // power_plant, substation
  });

  // 6. Event Spatial Correlation Enrichment
  await test('correlateEvent enriches georeferenced and legacy events with schema compliance', () => {
    // Georeferenced event
    const geoEvent = new Event({
      id: 701,
      latitude: 22.50,
      longitude: 88.30,
      frp: 42.5,
      fire_type: 'Industrial Fire',
      confidence: 0.94
    });

    const correlatedGeo = spatialCorrelationService.correlateEvent(geoEvent, { radiusKm: 15.0 });

    assert.strictEqual(correlatedGeo.id, 701);
    assert.strictEqual(correlatedGeo.classification, 'Industrial Fire');
    assert.strictEqual(correlatedGeo.confidence, 0.94);
    assert.strictEqual(correlatedGeo.frp, 42.5);
    assert.strictEqual(typeof correlatedGeo.spatial_context, 'object');
    assert(correlatedGeo.spatial_context.nearest_industrial_area_km !== null);
    assert(correlatedGeo.spatial_context.nearest_power_plant_km !== null);
    assert(correlatedGeo.spatial_context.nearby_infrastructure_count > 0);
    assert.strictEqual(correlatedGeo.spatial_context.is_georeferenced, true);

    // Legacy event without coordinates
    const legacyEvent = new Event({
      id: 702,
      latitude: null,
      longitude: null,
      distance_to_industrial_area_km: 1.25,
      distance_to_power_plant_km: 8.4,
      fire_type: 'Persistent Thermal Source',
      prediction_confidence: 0.88
    });

    const correlatedLegacy = spatialCorrelationService.correlateEvent(legacyEvent);
    assert.strictEqual(correlatedLegacy.classification, 'Persistent Thermal Source');
    assert.strictEqual(correlatedLegacy.spatial_context.nearest_industrial_area_km, 1.25);
    assert.strictEqual(correlatedLegacy.spatial_context.nearest_power_plant_km, 8.4);
    assert.strictEqual(correlatedLegacy.spatial_context.is_georeferenced, false);
  });

  // 7. Full Integration against Genuine OSM India Dataset (139,682 points)
  await test('Full Repository Integration indexes authentic OSM India dataset in sub-second time', async () => {
    await csvRepository.init();

    assert.strictEqual(csvRepository.infrastructure.length, 139682);
    assert.strictEqual(spatialCorrelationService.totalIndexed, 139682);

    // Query near a major industrial / refinery hub in India (Jamnagar, Gujarat: ~22.47°N, 70.06°E)
    const t0 = Date.now();
    const jamnagarContext = csvRepository.calculateSpatialContext(22.47, 70.06, { radiusKm: 25.0 });
    const queryDuration = Date.now() - t0;

    console.log(`  [Benchmark] Spatial correlation query over 139k features completed in ${queryDuration}ms.`);
    assert(queryDuration < 50, `Expected query under 50ms, took ${queryDuration}ms`);

    assert(jamnagarContext.nearest_industrial_area_km !== null);
    assert(jamnagarContext.nearest_power_plant_km !== null);
    assert(jamnagarContext.nearby_infrastructure_count > 0);
    assert(jamnagarContext.nearest_feature !== null);
  });

  // 8. Event GeoJSON Properties Include Spatial Context
  await test('Events GeoJSON contains spatial_context inside feature properties', () => {
    const testGeoEvent = new Event({
      id: 8888,
      latitude: 22.47,
      longitude: 70.06,
      frp: 55.0,
      fire_type: 'Industrial Fire',
      prediction_confidence: 0.98
    });

    csvRepository.addEvents([testGeoEvent]);

    const geojson = csvRepository.getEventsGeoJSON({ limit: 100 });
    const feature = geojson.features.find((f) => f.id === 8888);

    assert.notStrictEqual(feature, undefined);
    assert.strictEqual(typeof feature.properties.spatial_context, 'object');
    assert.strictEqual(feature.properties.classification, 'Industrial Fire');
    assert(feature.properties.spatial_context.nearest_industrial_area_km !== null);
  });

  console.log(`\n--- Spatial Correlation Test Summary: ${passed} Passed, ${failed} Failed ---`);
  if (failed > 0) process.exit(1);
}

runSpatialTests();
