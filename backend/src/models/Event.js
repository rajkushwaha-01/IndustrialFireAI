const { isValidLatitude, isValidLongitude } = require('../utils/geoValidation');
const classificationEvidenceService = require('../services/classificationEvidenceService');

/**
 * Canonical Event Model Schema & GeoJSON Formatter
 * 
 * Supports both:
 * 1. Genuine georeferenced FIRMS fire events (with validated latitude, longitude, and satellite telemetry).
 * 2. Legacy pre-aggregated observation records (with multi-temporal and spatial ML features).
 */
class Event {
  constructor(data = {}) {
    this.id = Number(data.id);

    // Coordinate validation (strict WGS 84 bounds [-90,90] and [-180,180])
    const rawLat = data.latitude !== undefined && data.latitude !== null && data.latitude !== '' ? data.latitude : null;
    const rawLon = data.longitude !== undefined && data.longitude !== null && data.longitude !== '' ? data.longitude : null;

    if (rawLat !== null && rawLon !== null && isValidLatitude(rawLat) && isValidLongitude(rawLon)) {
      this.latitude = Number(rawLat);
      this.longitude = Number(rawLon);
      this.has_coordinates = true;
    } else {
      this.latitude = null;
      this.longitude = null;
      this.has_coordinates = false;
    }

    // Telemetry & Sensor Metadata
    this.acquisition_date = data.acquisition_date ? String(data.acquisition_date).trim() : null;
    this.acquisition_time = data.acquisition_time ? String(data.acquisition_time).trim() : null;
    this.satellite = String(data.satellite || data.source || 'NASA FIRMS VIIRS/MODIS').trim();
    this.source = String(data.source || 'NASA FIRMS').trim();

    // Radiometry
    this.avg_frp = Number(data.avg_frp !== undefined ? data.avg_frp : (data.frp || 0));
    this.frp = Number(data.frp !== undefined ? data.frp : this.avg_frp);
    this.max_frp = Number(data.max_frp !== undefined ? data.max_frp : this.frp);
    this.total_frp = Number(data.total_frp !== undefined ? data.total_frp : this.frp);

    this.avg_bright_ti4 = Number(data.avg_bright_ti4 !== undefined ? data.avg_bright_ti4 : (data.brightness_temperature || 0));
    this.brightness_temperature = Number(data.brightness_temperature !== undefined ? data.brightness_temperature : this.avg_bright_ti4);
    this.avg_bright_ti5 = Number(data.avg_bright_ti5 || 0);

    // Multi-temporal persistence
    this.persistence_days = Number(data.persistence_days !== undefined ? data.persistence_days : 1);
    this.detections = Number(data.detections !== undefined ? data.detections : (data.detection_count || 1));
    this.detection_count = this.detections;
    this.night_ratio = Number(data.night_ratio || 0);

    // Spatial distances to OSM infrastructure (km)
    this.distance_to_industrial_area_km = Number(data.distance_to_industrial_area_km || 0);
    this.distance_to_power_plant_km = Number(data.distance_to_power_plant_km || 0);
    this.distance_to_quarry_km = Number(data.distance_to_quarry_km || 0);
    this.distance_to_substation_km = Number(data.distance_to_substation_km || 0);
    this.distance_to_storage_tank_km = Number(data.distance_to_storage_tank_km || 0);
    this.distance_to_works_km = Number(data.distance_to_works_km || 0);

    // Classification & Confidence
    this.fire_type = String(data.fire_type || data.classification || 'Unknown').trim();
    this.classification = this.fire_type;
    this.prediction_class = String(data.prediction_class || '').trim();
    this.prediction_confidence = Number(data.prediction_confidence !== undefined ? data.prediction_confidence : (data.confidence || 0));
    this.confidence = data.confidence !== undefined ? (isNaN(Number(data.confidence)) ? String(data.confidence) : Number(data.confidence)) : this.prediction_confidence;

    // Spatial context (geospatial correlation metrics)
    this.spatial_context = data.spatial_context || null;

    // Multi-source classification & evidence layer (Phase 7)
    this.evidence = data.evidence || null;

    // Timestamps
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  getEvidence() {
    if (!this.evidence) {
      this.evidence = classificationEvidenceService.evaluateEvidence(this);
    }
    return this.evidence;
  }

  toJSON() {
    return {
      id: this.id,
      latitude: this.latitude,
      longitude: this.longitude,
      has_coordinates: this.has_coordinates,
      classification: this.fire_type,
      fire_type: this.fire_type,
      confidence: this.confidence,
      frp: this.frp,
      spatial_context: this.spatial_context || {
        nearest_industrial_area_km: this.distance_to_industrial_area_km,
        nearest_power_plant_km: this.distance_to_power_plant_km,
        nearest_quarry_km: this.distance_to_quarry_km,
        nearest_storage_tank_km: this.distance_to_storage_tank_km,
        nearest_substation_km: this.distance_to_substation_km,
        nearest_works_km: this.distance_to_works_km,
        nearby_infrastructure_count: null
      },
      acquisition_date: this.acquisition_date,
      acquisition_time: this.acquisition_time,
      brightness_temperature: this.brightness_temperature,
      satellite: this.satellite,
      source: this.source,
      persistence_days: this.persistence_days,
      detection_count: this.detection_count,
      detections: this.detections,
      avg_frp: this.avg_frp,
      max_frp: this.max_frp,
      total_frp: this.total_frp,
      avg_bright_ti4: this.avg_bright_ti4,
      avg_bright_ti5: this.avg_bright_ti5,
      night_ratio: this.night_ratio,
      distance_to_industrial_area_km: this.distance_to_industrial_area_km,
      distance_to_power_plant_km: this.distance_to_power_plant_km,
      distance_to_quarry_km: this.distance_to_quarry_km,
      distance_to_substation_km: this.distance_to_substation_km,
      distance_to_storage_tank_km: this.distance_to_storage_tank_km,
      distance_to_works_km: this.distance_to_works_km,
      prediction_class: this.prediction_class,
      prediction_confidence: this.prediction_confidence,
      evidence: this.getEvidence(),
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Serializes this event into an RFC 7946 GeoJSON Point feature.
   * Returns null if event has no valid coordinates.
   * @returns {Object|null}
   */
  toGeoJSON() {
    if (!this.has_coordinates || this.longitude === null || this.latitude === null) {
      return null;
    }

    const evidenceObj = this.getEvidence();

    return {
      type: 'Feature',
      id: this.id,
      geometry: {
        type: 'Point',
        coordinates: [this.longitude, this.latitude]
      },
      properties: {
        id: this.id,
        classification: this.fire_type,
        fire_type: this.fire_type,
        confidence: this.confidence,
        prediction_class: this.prediction_class,
        prediction_confidence: this.prediction_confidence,
        evidence: evidenceObj,
        evidence_summary: evidenceObj.summary_text,
        evidence_factors: evidenceObj.factors,
        frp: this.frp,
        avg_frp: this.avg_frp,
        max_frp: this.max_frp,
        brightness_temperature: this.brightness_temperature,
        persistence_days: this.persistence_days,
        detection_count: this.detection_count,
        detections: this.detections,
        acquisition_date: this.acquisition_date,
        acquisition_time: this.acquisition_time,
        satellite: this.satellite,
        source: this.source,
        spatial_context: this.spatial_context || {
          nearest_industrial_area_km: this.distance_to_industrial_area_km,
          nearest_power_plant_km: this.distance_to_power_plant_km,
          nearest_quarry_km: this.distance_to_quarry_km,
          nearest_storage_tank_km: this.distance_to_storage_tank_km,
          nearest_substation_km: this.distance_to_substation_km,
          nearest_works_km: this.distance_to_works_km,
          nearby_infrastructure_count: null
        },
        distance_to_industrial_area_km: this.distance_to_industrial_area_km,
        distance_to_power_plant_km: this.distance_to_power_plant_km,
        distance_to_quarry_km: this.distance_to_quarry_km,
        distance_to_substation_km: this.distance_to_substation_km,
        distance_to_storage_tank_km: this.distance_to_storage_tank_km,
        distance_to_works_km: this.distance_to_works_km
      }
    };
  }
}

module.exports = Event;
