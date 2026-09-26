const assert = require('assert');
const classificationEvidenceService = require('../src/services/classificationEvidenceService');
const Event = require('../src/models/Event');

console.log('--- Starting Multi-Source Classification & Evidence Test Suite (Phase 7) ---');

// Test 1: Industrial Fire with strong multi-source evidence
{
  const industrialInput = {
    frp: 65.5,
    max_frp: 98.0,
    brightness_temperature: 368.5,
    detections: 22,
    persistence_days: 6.0,
    night_ratio: 0.75,
    distance_to_industrial_area_km: 0.8,
    distance_to_power_plant_km: 12.0,
    distance_to_quarry_km: 15.0,
    distance_to_substation_km: 2.1,
    distance_to_storage_tank_km: 0.45,
    distance_to_works_km: 3.2,
    classification: 'Industrial Fire',
    confidence: 0.91,
    probabilities: {
      'Industrial Fire': 0.91,
      'Persistent Thermal Source': 0.06,
      'Natural Fire': 0.02,
      'Other': 0.01
    }
  };

  const evidence = classificationEvidenceService.evaluateEvidence(industrialInput);

  assert.strictEqual(evidence.classification, 'Industrial Fire');
  assert.strictEqual(evidence.confidence, 0.91);
  assert.strictEqual(evidence.thermal.frp_level, 'high');
  assert.strictEqual(evidence.thermal.temperature_level, 'high');
  assert.strictEqual(evidence.spatial.proximity_level, 'high');
  assert.strictEqual(evidence.spatial.density_level, 'high');
  assert.strictEqual(evidence.temporal.persistence_level, 'medium');
  assert.strictEqual(evidence.temporal.diurnal_pattern, 'CONTINUOUS_24_7');

  // Verify factors format: industrial proximity: high, etc.
  assert(evidence.summary_text.includes('industrial proximity: high'));
  assert(evidence.summary_text.includes('persistence: medium'));
  assert(evidence.summary_text.includes('FRP: high'));
  assert(evidence.summary_text.includes('infrastructure density: high'));

  assert(evidence.scientific_disclaimer.includes('Satellite data alone cannot establish'));
  console.log('✓ PASSED: Industrial Fire receives high multi-source evidence ratings');
}

// Test 2: Scientific Guardrail - Remote fire cannot be claimed as Industrial Fire
{
  const remoteInput = {
    frp: 85.0,
    max_frp: 120.0,
    brightness_temperature: 375.0,
    detections: 10,
    persistence_days: 2.0,
    night_ratio: 0.1,
    distance_to_industrial_area_km: 45.0,
    distance_to_power_plant_km: 55.0,
    distance_to_quarry_km: 38.0,
    distance_to_substation_km: 62.0,
    distance_to_storage_tank_km: 70.0,
    distance_to_works_km: 50.0,
    classification: 'Industrial Fire',
    confidence: 0.88
  };

  const evidence = classificationEvidenceService.evaluateEvidence(remoteInput);

  // Guardrail must reclassify because 38km remote distance contradicts Industrial Fire hypothesis
  assert.strictEqual(evidence.classification, 'Natural Fire');
  assert(evidence.guardrail_note.includes('contradicts Industrial Fire hypothesis'));
  assert.strictEqual(evidence.spatial.proximity_level, 'negligible');
  console.log('✓ PASSED: Scientific guardrail prevents classifying remote wilderness fire as Industrial Fire');
}

// Test 3: Scientific Guardrail - Single-day transient observation cannot be Persistent Thermal Source
{
  const transientInput = {
    frp: 12.0,
    brightness_temperature: 330.0,
    detections: 1,
    persistence_days: 1.0,
    night_ratio: 0.0,
    distance_to_industrial_area_km: 1.2,
    classification: 'Persistent Thermal Source',
    confidence: 0.85
  };

  const evidence = classificationEvidenceService.evaluateEvidence(transientInput);

  assert.strictEqual(evidence.classification, 'Other');
  assert(evidence.guardrail_note.includes('contradicts Persistent Thermal Source hypothesis'));
  assert.strictEqual(evidence.temporal.persistence_level, 'low');
  console.log('✓ PASSED: Scientific guardrail prevents classifying transient fire as Persistent Thermal Source');
}

// Test 4: Persistent Thermal Source with 24/7 continuous operation
{
  const persistentInput = {
    frp: 28.0,
    brightness_temperature: 345.0,
    detections: 45,
    persistence_days: 42.0,
    night_ratio: 0.82,
    distance_to_storage_tank_km: 0.9,
    distance_to_industrial_area_km: 1.1,
    classification: 'Persistent Thermal Source',
    confidence: 0.94
  };

  const evidence = classificationEvidenceService.evaluateEvidence(persistentInput);

  assert.strictEqual(evidence.classification, 'Persistent Thermal Source');
  assert.strictEqual(evidence.temporal.persistence_level, 'high');
  assert.strictEqual(evidence.temporal.diurnal_pattern, 'CONTINUOUS_24_7');
  assert(evidence.summary_text.includes('persistence: high'));
  console.log('✓ PASSED: Persistent Thermal Source correctly identifies multi-week 24/7 signature');
}

// Test 5: Event Model Integration - toJSON and toGeoJSON contain evidence
{
  const event = new Event({
    id: 99991,
    latitude: 21.15,
    longitude: 72.85,
    frp: 45.0,
    brightness_temperature: 360.0,
    persistence_days: 4,
    detections: 8,
    night_ratio: 0.65,
    distance_to_industrial_area_km: 1.2,
    distance_to_storage_tank_km: 0.8,
    fire_type: 'Industrial Fire',
    confidence: 0.89
  });

  const json = event.toJSON();
  assert(json.evidence !== null);
  assert(json.evidence.classification === 'Industrial Fire');
  assert(Array.isArray(json.evidence.factors));
  assert(json.evidence.factors.length >= 4);

  const geoJson = event.toGeoJSON();
  assert(geoJson !== null);
  assert(geoJson.properties.evidence !== null);
  assert(Array.isArray(geoJson.properties.evidence_summary));
  assert(geoJson.properties.evidence_summary.length >= 4);
  console.log('✓ PASSED: Event model toJSON and toGeoJSON include comprehensive evidence structures');
}

// Test 6: Probability Preservation (No Fabrication)
{
  const probInput = {
    frp: 18.0,
    brightness_temperature: 340.0,
    persistence_days: 2,
    detections: 3,
    night_ratio: 0.4,
    distance_to_industrial_area_km: 2.5,
    classification: 'Natural Fire',
    confidence: 0.7723,
    probabilities: {
      'Natural Fire': 0.7723,
      'Other': 0.1512,
      'Industrial Fire': 0.0521,
      'Persistent Thermal Source': 0.0244
    }
  };

  const evidence = classificationEvidenceService.evaluateEvidence(probInput);
  assert.strictEqual(evidence.confidence, 0.772);
  assert.strictEqual(evidence.probabilities['Natural Fire'], 0.7723);
  assert.strictEqual(evidence.probabilities['Other'], 0.1512);
  console.log('✓ PASSED: Authentic probabilities and calibrated confidence are faithfully preserved');
}

console.log('--- All Phase 7 Classification & Evidence Tests Passed Successfully ---');
