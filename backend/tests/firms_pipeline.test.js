const assert = require('assert');
const firmsIngestionService = require('../src/services/firmsIngestionService');
const dataRepository = require('../src/repositories');
const Event = require('../src/models/Event');

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ PASSED: ${name}`);
  } catch (err) {
    console.error(`✗ FAILED: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runPipelineTests() {
  console.log('--- Starting NASA FIRMS Ingestion Pipeline Test Suite (Phase 5) ---');
  await dataRepository.init();

  // 1. Column Validation
  await test('Pipeline rejects CSV missing mandatory coordinates', () => {
    assert.throws(() => {
      firmsIngestionService.parseCsvLines([
        'frp,acq_date,satellite',
        '45.0,2024-03-15,VIIRS'
      ]);
    }, /missing mandatory geographic coordinate columns/);
  });

  // 2. Coordinate Validation (Never silently discards invalid data)
  await test('validateRecord catches invalid latitude & longitude without silent discard', () => {
    const colMap = { latitude: 0, longitude: 1, frp: 2 };
    
    // Out-of-bounds latitude (95 > 90)
    const badLat = firmsIngestionService.validateRecord({ rowIdx: 1, parts: ['95.0', '70.0', '50'], raw: '95.0,70.0,50' }, colMap);
    assert.strictEqual(badLat.valid, false);
    assert(badLat.error.includes('Invalid latitude'));

    // Non-numeric longitude
    const badLon = firmsIngestionService.validateRecord({ rowIdx: 2, parts: ['22.5', 'not_a_number', '50'], raw: '22.5,not_a_number,50' }, colMap);
    assert.strictEqual(badLon.valid, false);
    assert(badLon.error.includes('Invalid longitude'));

    // Valid coordinates
    const good = firmsIngestionService.validateRecord({ rowIdx: 3, parts: ['22.4782', '70.0612', '50'], raw: '22.4782,70.0612,50' }, colMap);
    assert.strictEqual(good.valid, true);
    assert.strictEqual(good.lat, 22.4782);
    assert.strictEqual(good.lon, 70.0612);
  });

  // 3. Date & Time Normalization
  await test('Normalizers standardize heterogeneous dates and times', () => {
    // ISO YYYY-MM-DD
    assert.strictEqual(firmsIngestionService.normalizeDate('2024-03-15'), '2024-03-15');
    // Slashes YYYY/MM/DD
    assert.strictEqual(firmsIngestionService.normalizeDate('2024/03/15'), '2024-03-15');
    // Compact 8-digit YYYYMMDD
    assert.strictEqual(firmsIngestionService.normalizeDate('20240315'), '2024-03-15');

    // Time: 3 digits zero padded
    assert.strictEqual(firmsIngestionService.normalizeTime('830'), '0830');
    // Time with colon
    assert.strictEqual(firmsIngestionService.normalizeTime('18:30'), '1830');
    // Standard 4 digits
    assert.strictEqual(firmsIngestionService.normalizeTime('1830'), '1830');
  });

  // 4. FRP & Temperature Normalization
  await test('Normalizers clean FRP and convert temperatures', () => {
    // FRP negative or corrupt
    assert.strictEqual(firmsIngestionService.normalizeFrp(-10), 0.0);
    assert.strictEqual(firmsIngestionService.normalizeFrp('invalid'), 0.0);
    assert.strictEqual(firmsIngestionService.normalizeFrp('68.423'), 68.42);

    // Kelvin preserved
    assert.strictEqual(firmsIngestionService.normalizeBrightness(365.2), 365.2);
    // Celsius converted to Kelvin
    const kelvinConverted = firmsIngestionService.normalizeBrightness(100.0); // 100°C -> 373.15K
    assert(kelvinConverted >= 373.0 && kelvinConverted <= 373.3);
  });

  // 5. Confidence Normalization
  await test('Confidence normalizer handles categorical and percentage inputs', () => {
    assert.strictEqual(firmsIngestionService.normalizeConfidence('h'), 0.95);
    assert.strictEqual(firmsIngestionService.normalizeConfidence('nominal'), 0.75);
    assert.strictEqual(firmsIngestionService.normalizeConfidence('low'), 0.40);
    assert.strictEqual(firmsIngestionService.normalizeConfidence('95'), 0.95);
    assert.strictEqual(firmsIngestionService.normalizeConfidence('0.88'), 0.88);
  });

  // 6. Full Pipeline Ingestion with Deduplication & Statistics Format
  await test('executePipeline processes raw CSV with deduplication, statistics, and error logging', async () => {
    const csvContent = [
      'latitude,longitude,acq_date,acq_time,frp,bright_ti4,confidence,satellite',
      '24.1234,75.1234,2024-04-01,1200,68.4,365.2,high,VIIRS_NOAA20', // Valid 1
      '24.1234,75.1234,2024-04-01,1200,68.4,365.2,high,VIIRS_NOAA20', // Duplicate of 1!
      '999.0,75.1234,2024-04-01,1200,50.0,340.0,high,VIIRS_NOAA20',   // Invalid lat!
      '25.5678,76.5678,2024-04-01,1300,45.0,342.1,nominal,VIIRS_NOAA20' // Valid 2
    ].join('\n');

    const stats = await firmsIngestionService.executePipeline({
      source: 'csv_content',
      csvContent,
      runSpatialCorrelation: true,
      runMlInference: true
    });

    assert.strictEqual(stats.records_received, 4);
    assert.strictEqual(stats.records_inserted, 2);
    assert.strictEqual(stats.duplicates, 1);
    assert.strictEqual(stats.invalid_records, 1);
    assert(stats.processing_time.endsWith('s'));
    assert.strictEqual(stats.spatial_correlation_completed, 2);
    assert.strictEqual(stats.ml_inferences_completed, 2);
    assert.strictEqual(stats.error_samples.length, 1);
    assert(stats.error_samples[0].error.includes('Invalid latitude'));
  });

  // 7. Security: Credentials are never exposed in status
  await test('getStatus returns pipeline health without exposing secret credentials', () => {
    const status = firmsIngestionService.getStatus();
    assert.strictEqual(typeof status.has_map_key, 'boolean');
    assert.strictEqual(status.mapKey, undefined, 'Secret map key must never be exposed');
    assert.strictEqual(status.api_key, undefined, 'Secret api key must never be exposed');
  });

  console.log('\n--- All Phase 5 FIRMS Ingestion Pipeline Tests Passed Successfully ---');
}

runPipelineTests();
