const assert = require('assert');
const path = require('path');
const fs = require('fs');
const Event = require('../src/models/Event');
const { isValidLatitude, isValidLongitude, parseBBox, isPointInBBox } = require('../src/utils/geoValidation');
const firmsIngestionService = require('../src/services/firmsIngestionService');
const csvRepository = require('../src/repositories/csvRepository');

async function runCanonicalTests() {
  console.log('--- Starting Canonical Event & FIRMS Pipeline Test Suite ---');
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

  // 1. Valid Latitude / Longitude Validation
  await test('Geospatial coordinate validation accepts valid WGS 84 degrees', () => {
    assert.strictEqual(isValidLatitude(22.5726), true);
    assert.strictEqual(isValidLatitude(-89.99), true);
    assert.strictEqual(isValidLatitude(0), true);
    assert.strictEqual(isValidLatitude(90.0), true);
    assert.strictEqual(isValidLatitude(-90.0), true);

    assert.strictEqual(isValidLongitude(88.3639), true);
    assert.strictEqual(isValidLongitude(-179.99), true);
    assert.strictEqual(isValidLongitude(180.0), true);
    assert.strictEqual(isValidLongitude(-180.0), true);
  });

  // 2. Out-of-bounds Latitude / Longitude Rejection
  await test('Geospatial coordinate validation rejects invalid WGS 84 degrees', () => {
    assert.strictEqual(isValidLatitude(90.001), false);
    assert.strictEqual(isValidLatitude(-91.5), false);
    assert.strictEqual(isValidLatitude('invalid_lat'), false);
    assert.strictEqual(isValidLatitude(null), false);
    assert.strictEqual(isValidLatitude(undefined), false);

    assert.strictEqual(isValidLongitude(180.001), false);
    assert.strictEqual(isValidLongitude(-181.0), false);
    assert.strictEqual(isValidLongitude('bad_lon'), false);
  });

  // 3. Event Model with Valid Coordinates
  await test('Event model stores coordinates and generates GeoJSON Point feature', () => {
    const event = new Event({
      id: 101,
      latitude: 23.4567,
      longitude: 85.1234,
      acquisition_date: '2024-04-10',
      acquisition_time: '13:45',
      frp: 45.2,
      brightness_temperature: 342.1,
      confidence: 0.92,
      satellite: 'VIIRS-N20',
      persistence_days: 12,
      fire_type: 'Industrial Fire'
    });

    assert.strictEqual(event.has_coordinates, true);
    assert.strictEqual(event.latitude, 23.4567);
    assert.strictEqual(event.longitude, 85.1234);

    const geojson = event.toGeoJSON();
    assert.notStrictEqual(geojson, null);
    assert.strictEqual(geojson.type, 'Feature');
    assert.strictEqual(geojson.geometry.type, 'Point');
    // GeoJSON standard: [longitude, latitude]
    assert.strictEqual(geojson.geometry.coordinates[0], 85.1234);
    assert.strictEqual(geojson.geometry.coordinates[1], 23.4567);
    assert.strictEqual(geojson.properties.fire_type, 'Industrial Fire');
    assert.strictEqual(geojson.properties.frp, 45.2);
  });

  // 4. Legacy Event without Coordinates
  await test('Legacy Event without coordinates returns null for GeoJSON feature without throwing', () => {
    const legacyEvent = new Event({
      id: 102,
      latitude: null,
      longitude: null,
      persistence_days: 5,
      fire_type: 'Natural Fire'
    });

    assert.strictEqual(legacyEvent.has_coordinates, false);
    assert.strictEqual(legacyEvent.latitude, null);
    assert.strictEqual(legacyEvent.longitude, null);
    assert.strictEqual(legacyEvent.toGeoJSON(), null);
  });

  // 5. Event with Malformed Coordinates is Sanitized
  await test('Event with out-of-bounds coordinates is sanitized to null coordinates', () => {
    const badEvent = new Event({
      id: 103,
      latitude: 120.5, // invalid
      longitude: 77.2,
      fire_type: 'Other'
    });

    assert.strictEqual(badEvent.has_coordinates, false);
    assert.strictEqual(badEvent.latitude, null);
    assert.strictEqual(badEvent.toGeoJSON(), null);
  });

  // 6. Bounding Box Parsing
  await test('parseBBox correctly parses and validates bounding boxes', () => {
    const valid = parseBBox('68.1,6.7,97.4,37.1'); // India bbox
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.bbox[0], 68.1);
    assert.strictEqual(valid.bbox[3], 37.1);

    assert.strictEqual(isPointInBBox(77.2, 28.6, valid.bbox), true); // New Delhi
    assert.strictEqual(isPointInBBox(0.0, 51.5, valid.bbox), false); // London

    const invalid = parseBBox('not,a,box');
    assert.strictEqual(invalid.valid, false);
  });

  // 7. FIRMS Ingestion Service parsing a sample CSV
  await test('FIRMS Ingestion Service parses genuine records and rejects invalid rows', async () => {
    const tempCsvPath = path.resolve(__dirname, 'temp_sample_firms.csv');
    const csvContent = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
22.5726,88.3639,335.8,0.4,0.4,2024-03-12,0745,N20,VIIRS,h,2.0NRT,295.2,24.6,N
28.6139,77.2090,320.1,0.5,0.4,2024-03-12,0746,N20,VIIRS,n,2.0NRT,290.1,12.3,D
150.0000,77.0000,310.0,0.4,0.4,2024-03-12,0747,N20,VIIRS,l,2.0NRT,285.0,5.0,D`; // Row 3 has invalid latitude 150.0

    fs.writeFileSync(tempCsvPath, csvContent, 'utf8');

    try {
      const { validEvents, stats } = await firmsIngestionService.parseFirmsCsv(tempCsvPath);

      assert.strictEqual(stats.totalRowsRead, 3);
      assert.strictEqual(stats.validEventsCount, 2);
      assert.strictEqual(stats.rejectedRowsCount, 1);
      assert.strictEqual(validEvents.length, 2);

      const evt1 = validEvents[0];
      assert.strictEqual(evt1.latitude, 22.5726);
      assert.strictEqual(evt1.longitude, 88.3639);
      assert.strictEqual(evt1.frp, 24.6);
      assert.strictEqual(evt1.night_ratio, 1.0); // daynight 'N' -> 1.0
      assert.strictEqual(evt1.has_coordinates, true);
    } finally {
      if (fs.existsSync(tempCsvPath)) {
        fs.unlinkSync(tempCsvPath);
      }
    }
  });

  // 8. Repository GeoJSON endpoint returns features when georeferenced events are added
  await test('Repository getEventsGeoJSON returns Point features for events with coordinates', () => {
    const mockEvents = [
      new Event({
        id: 9001,
        latitude: 22.1,
        longitude: 82.3,
        frp: 35.0,
        fire_type: 'Industrial Fire',
        prediction_confidence: 0.95
      }),
      new Event({
        id: 9002,
        latitude: null, // legacy event without coords
        longitude: null,
        frp: 10.0,
        fire_type: 'Other',
        prediction_confidence: 0.50
      })
    ];

    csvRepository.addEvents(mockEvents);

    const geojson = csvRepository.getEventsGeoJSON({ classification: 'Industrial Fire' });
    assert.strictEqual(geojson.type, 'FeatureCollection');
    assert(geojson.features.length >= 1);

    const feature = geojson.features.find((f) => f.id === 9001);
    assert.notStrictEqual(feature, undefined);
    assert.strictEqual(feature.geometry.coordinates[0], 82.3);
    assert.strictEqual(feature.geometry.coordinates[1], 22.1);
    assert.strictEqual(feature.properties.fire_type, 'Industrial Fire');
  });

  console.log(`\n--- Canonical Event Test Summary: ${passed} Passed, ${failed} Failed ---`);
  if (failed > 0) process.exit(1);
}

runCanonicalTests();
