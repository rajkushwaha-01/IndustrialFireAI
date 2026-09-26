/**
 * Multi-Source Classification & Evidence Reasoning Service (Phase 7)
 * 
 * Provides transparent, scientifically defensible evidence synthesis across
 * Thermal, Spatial, and Temporal dimensions for SIH Problem Statement 26162.
 * 
 * Never fabricates probabilities. Corresponds directly to authoritative model
 * probability outputs and physical satellite/OSM telemetry.
 */

class ClassificationEvidenceService {
  constructor() {
    this.scientificDisclaimer = 
      'Thermal anomaly classification is probabilistic and derived from VIIRS/MODIS radiometric measurements ' +
      'and OpenStreetMap spatial correlation. Satellite data alone cannot establish definitive on-the-ground ' +
      'physical root cause without field inspection.';
  }

  /**
   * Evaluates qualitative evidence levels across Thermal, Spatial, and Temporal dimensions.
   * 
   * @param {Object} input - Features or Event instance
   * @param {Object} [mlPrediction] - Optional live prediction { prediction, confidence, probabilities }
   * @returns {Object} Complete classification evidence structure
   */
  evaluateEvidence(input = {}, mlPrediction = null) {
    // 1. Extract Thermal Inputs
    const frp = Number(input.avg_frp !== undefined ? input.avg_frp : (input.frp || 0));
    const maxFrp = Number(input.max_frp !== undefined ? input.max_frp : frp);
    const brightnessTemp = Number(input.avg_bright_ti4 !== undefined ? input.avg_bright_ti4 : (input.brightness_temperature || input.brightness || 300));
    const detections = Number(input.detections !== undefined ? input.detections : (input.detection_count || 1));

    // 2. Extract Spatial Inputs
    const distIndustrial = Number(input.distance_to_industrial_area_km !== undefined ? input.distance_to_industrial_area_km : 99.0);
    const distPower = Number(input.distance_to_power_plant_km !== undefined ? input.distance_to_power_plant_km : 99.0);
    const distQuarry = Number(input.distance_to_quarry_km !== undefined ? input.distance_to_quarry_km : 99.0);
    const distSubstation = Number(input.distance_to_substation_km !== undefined ? input.distance_to_substation_km : 99.0);
    const distStorage = Number(input.distance_to_storage_tank_km !== undefined ? input.distance_to_storage_tank_km : 99.0);
    const distWorks = Number(input.distance_to_works_km !== undefined ? input.distance_to_works_km : 99.0);

    const distMap = [
      { category: 'storage_tank', dist: distStorage },
      { category: 'industrial_area', dist: distIndustrial },
      { category: 'works', dist: distWorks },
      { category: 'power_plant', dist: distPower },
      { category: 'quarry', dist: distQuarry },
      { category: 'substation', dist: distSubstation }
    ];

    distMap.sort((a, b) => a.dist - b.dist);
    const nearestCategory = distMap[0].category;
    const minDistanceKm = distMap[0].dist;

    const nearbyCount = input.spatial_context?.nearby_infrastructure_count !== undefined && input.spatial_context?.nearby_infrastructure_count !== null
      ? Number(input.spatial_context.nearby_infrastructure_count)
      : distMap.filter(d => d.dist <= 5.0).length;

    // 3. Extract Temporal Inputs
    const persistenceDays = Number(input.persistence_days !== undefined ? input.persistence_days : 1);
    const nightRatio = Number(input.night_ratio !== undefined ? input.night_ratio : 0);

    // 4. Determine Qualitative Levels
    // Thermal FRP
    const effectiveFrp = Math.max(frp, maxFrp * 0.7);
    let frpLevel = 'low';
    if (effectiveFrp >= 50.0) frpLevel = 'high';
    else if (effectiveFrp >= 15.0) frpLevel = 'medium';
    else if (effectiveFrp >= 5.0) frpLevel = 'low';
    else frpLevel = 'negligible';

    // Thermal Temperature
    let tempLevel = 'low';
    if (brightnessTemp >= 355.0) tempLevel = 'high';
    else if (brightnessTemp >= 325.0) tempLevel = 'medium';
    else tempLevel = 'low';

    // Detection Frequency
    let detFreqLevel = 'low';
    if (detections >= 15) detFreqLevel = 'high';
    else if (detections >= 4) detFreqLevel = 'medium';
    else detFreqLevel = 'low';

    // Spatial Proximity
    let proximityLevel = 'low';
    if (minDistanceKm <= 1.5) proximityLevel = 'high';
    else if (minDistanceKm <= 4.0) proximityLevel = 'medium';
    else if (minDistanceKm <= 10.0) proximityLevel = 'low';
    else proximityLevel = 'negligible';

    // Spatial Infrastructure Density
    let densityLevel = 'low';
    if (nearbyCount >= 4 || minDistanceKm <= 1.0) densityLevel = 'high';
    else if (nearbyCount >= 1 || minDistanceKm <= 3.5) densityLevel = 'medium';
    else if (minDistanceKm <= 10.0) densityLevel = 'low';
    else densityLevel = 'negligible';

    // Temporal Persistence
    let persistenceLevel = 'low';
    if (persistenceDays >= 10.0) persistenceLevel = 'high';
    else if (persistenceDays >= 3.0) persistenceLevel = 'medium';
    else persistenceLevel = 'low';

    // Temporal Diurnal Pattern
    let diurnalPattern = 'DAYTIME_DOMINATED';
    if (nightRatio >= 0.60) diurnalPattern = 'CONTINUOUS_24_7';
    else if (nightRatio >= 0.25) diurnalPattern = 'MIXED_DIURNAL';

    // 5. Classification Determination & Scientific Guardrails
    let rawCls = mlPrediction?.prediction || input.classification || input.fire_type || 'Unknown';
    let rawConf = mlPrediction?.confidence !== undefined
      ? Number(mlPrediction.confidence)
      : Number(input.confidence !== undefined ? input.confidence : (input.prediction_confidence || 0.8));

    let finalCls = rawCls;
    let finalConf = rawConf;
    let guardrailApplied = null;

    // Scientific Guardrail 1: Remote Industrial Fire Contradiction
    if (rawCls === 'Industrial Fire' && minDistanceKm > 10.0) {
      finalCls = effectiveFrp >= 15.0 ? 'Natural Fire' : 'Other';
      guardrailApplied = `Remote distance (${minDistanceKm.toFixed(1)} km) contradicts Industrial Fire hypothesis. Reclassified to ${finalCls}.`;
      finalConf = Math.min(finalConf, 0.75);
    }

    // Scientific Guardrail 2: Transient Persistent Source Contradiction
    if (rawCls === 'Persistent Thermal Source' && persistenceDays <= 1 && nightRatio < 0.25) {
      finalCls = effectiveFrp >= 15.0 ? 'Natural Fire' : 'Other';
      guardrailApplied = `Single-day transient observation contradicts Persistent Thermal Source hypothesis. Reclassified to ${finalCls}.`;
      finalConf = Math.min(finalConf, 0.70);
    }

    // Standardize probabilities (never fabricate random numbers)
    let probabilities = mlPrediction?.probabilities || input.probabilities || null;
    if (!probabilities && input.prediction_confidence) {
      probabilities = {
        [finalCls]: Math.round(finalConf * 1000) / 1000
      };
    }

    // 6. Summary Factors (Matching format: industrial proximity: high, etc.)
    const factors = [
      {
        factor: 'industrial proximity',
        level: proximityLevel,
        detail: `${minDistanceKm.toFixed(2)} km to nearest ${nearestCategory.replace('_', ' ')}`
      },
      {
        factor: 'persistence',
        level: persistenceLevel,
        detail: `${persistenceDays.toFixed(1)} days cluster duration`
      },
      {
        factor: 'FRP',
        level: frpLevel,
        detail: `${frp.toFixed(1)} MW average radiative power`
      },
      {
        factor: 'infrastructure density',
        level: densityLevel,
        detail: `${nearbyCount} industrial facilities within radius`
      }
    ];

    const summaryText = [
      `industrial proximity: ${proximityLevel}`,
      `persistence: ${persistenceLevel}`,
      `FRP: ${frpLevel}`,
      `infrastructure density: ${densityLevel}`
    ];

    return {
      classification: finalCls,
      confidence: Math.round(finalConf * 1000) / 1000,
      probabilities,
      factors,
      summary_text: summaryText,
      thermal: {
        frp_level: frpLevel,
        frp_mw: Math.round(frp * 100) / 100,
        temperature_level: tempLevel,
        brightness_kelvin: Math.round(brightnessTemp * 10) / 10,
        detection_frequency_level: detFreqLevel,
        detections
      },
      spatial: {
        proximity_level: proximityLevel,
        min_distance_km: Math.round(minDistanceKm * 100) / 100,
        nearest_category: nearestCategory.replace('_', ' '),
        density_level: densityLevel,
        nearby_count: nearbyCount
      },
      temporal: {
        persistence_level: persistenceLevel,
        persistence_days: Math.round(persistenceDays * 10) / 10,
        diurnal_pattern: diurnalPattern,
        night_ratio: Math.round(nightRatio * 100) / 100
      },
      guardrail_note: guardrailApplied,
      scientific_disclaimer: this.scientificDisclaimer
    };
  }

  /**
   * Helper to attach synthesized evidence to an Event instance
   */
  attachEvidenceToEvent(event) {
    if (!event) return null;
    const ev = this.evaluateEvidence(event);
    event.evidence = ev;
    return ev;
  }
}

module.exports = new ClassificationEvidenceService();
