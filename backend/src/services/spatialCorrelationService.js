const { calculateHaversineDistance, calculateBearing, getCompassDirection } = require('../utils/haversine');
const { isValidLatitude, isValidLongitude } = require('../utils/geoValidation');

/**
 * 2D Spatial Grid Index & Geospatial Correlation Engine
 * 
 * Provides sub-millisecond geodesic spatial correlation across 139,000+ OpenStreetMap
 * industrial infrastructure geometries in India without requiring external spatial daemons.
 */
class SpatialCorrelationService {
  constructor(cellSizeDeg = 0.1) {
    this.cellSize = cellSizeDeg; // ~11km per cell
    this.allGrid = new Map(); // cellKey -> Point[]
    this.categoryGrids = new Map(); // category -> (cellKey -> Point[])
    this.allPoints = [];
    this.isIndexed = false;
    this.totalIndexed = 0;
    this.categories = new Set();
  }

  /**
   * Generates a spatial cell hash key from latitude and longitude.
   * @param {number} lat
   * @param {number} lon
   * @returns {string}
   */
  getCellKey(lat, lon) {
    const latIndex = Math.floor(lat / this.cellSize);
    const lonIndex = Math.floor(lon / this.cellSize);
    return `${latIndex}:${lonIndex}`;
  }

  /**
   * Normalizes category string to standard industrial vocabulary.
   * @param {string} cat
   * @returns {string}
   */
  normalizeCategory(cat) {
    if (!cat) return 'other';
    const c = String(cat).trim().toLowerCase();
    if (c === 'industrial' || c === 'industrial_area') return 'industrial_area';
    if (c === 'power' || c === 'power_plant') return 'power_plant';
    if (c === 'quarry' || c === 'mine') return 'quarry';
    if (c === 'substation') return 'substation';
    if (c === 'storage_tank' || c === 'tank') return 'storage_tank';
    if (c === 'works' || c === 'factory') return 'works';
    return c;
  }

  /**
   * Builds the spatial grid index from an array of Infrastructure instances or points.
   * @param {Array<{ id: number, latitude: number, longitude: number, feature_category: string }>} infrastructurePoints
   */
  buildIndex(infrastructurePoints = []) {
    const startTime = Date.now();
    this.allGrid.clear();
    this.categoryGrids.clear();
    this.allPoints = [];
    this.categories.clear();

    for (let i = 0; i < infrastructurePoints.length; i++) {
      const item = infrastructurePoints[i];
      const lat = Number(item.latitude);
      const lon = Number(item.longitude);

      if (!isValidLatitude(lat) || !isValidLongitude(lon)) {
        continue;
      }

      const rawCat = item.feature_category || 'other';
      const category = this.normalizeCategory(rawCat);
      this.categories.add(category);

      const pt = {
        id: item.id,
        latitude: lat,
        longitude: lon,
        category: category,
        rawCategory: rawCat
      };

      this.allPoints.push(pt);

      const key = this.getCellKey(lat, lon);

      // 1. Add to global spatial grid
      if (!this.allGrid.has(key)) {
        this.allGrid.set(key, []);
      }
      this.allGrid.get(key).push(pt);

      // 2. Add to category-specific spatial grid
      if (!this.categoryGrids.has(category)) {
        this.categoryGrids.set(category, new Map());
      }
      const catMap = this.categoryGrids.get(category);
      if (!catMap.has(key)) {
        catMap.set(key, []);
      }
      catMap.get(key).push(pt);
    }

    this.totalIndexed = this.allPoints.length;
    this.isIndexed = true;
    const duration = Date.now() - startTime;
    console.log(`[Spatial Index] Indexed ${this.totalIndexed} infrastructure geometries across ${this.categories.size} categories in ${duration}ms.`);
  }

  /**
   * Finds the single nearest infrastructure feature matching category (or any category if null).
   * Uses expanding concentric grid rings for rapid convergence.
   *
   * @param {number} lat - Query latitude
   * @param {number} lon - Query longitude
   * @param {string|null} category - Optional category filter (e.g. 'power_plant')
   * @param {number} maxRadiusKm - Max search distance in km (default: 250km)
   * @returns {{ id: number, category: string, distance_km: number, coordinates: [number, number], bearing_deg: number, direction: string } | null}
   */
  getNearestFeature(lat, lon, category = null, maxRadiusKm = 250.0) {
    if (!this.isIndexed || this.totalIndexed === 0) return null;

    const normalizedCat = category ? this.normalizeCategory(category) : null;
    const targetGrid = normalizedCat ? this.categoryGrids.get(normalizedCat) : this.allGrid;

    if (normalizedCat && !targetGrid) {
      return null;
    }

    const centerLatIndex = Math.floor(lat / this.cellSize);
    const centerLonIndex = Math.floor(lon / this.cellSize);

    // Approximate degrees for maxRadiusKm
    const maxDegreeDelta = maxRadiusKm / 111.0;
    const maxRings = Math.ceil(maxDegreeDelta / this.cellSize);

    let nearest = null;
    let minDistance = Infinity;

    // Search outwards in concentric rings of cells
    for (let ring = 0; ring <= maxRings; ring++) {
      let foundCandidateInRing = false;

      const minLatIdx = centerLatIndex - ring;
      const maxLatIdx = centerLatIndex + ring;
      const minLonIdx = centerLonIndex - ring;
      const maxLonIdx = centerLonIndex + ring;

      for (let latIdx = minLatIdx; latIdx <= maxLatIdx; latIdx++) {
        for (let lonIdx = minLonIdx; lonIdx <= maxLonIdx; lonIdx++) {
          // Process perimeter only for ring > 0
          if (ring > 0 && latIdx > minLatIdx && latIdx < maxLatIdx && lonIdx > minLonIdx && lonIdx < maxLonIdx) {
            continue;
          }

          const key = `${latIdx}:${lonIdx}`;
          const cellPoints = targetGrid.get(key);
          if (!cellPoints || cellPoints.length === 0) continue;

          for (let p = 0; p < cellPoints.length; p++) {
            const pt = cellPoints[p];
            const dist = calculateHaversineDistance(lat, lon, pt.latitude, pt.longitude);

            if (dist < minDistance && dist <= maxRadiusKm) {
              minDistance = dist;
              nearest = pt;
              foundCandidateInRing = true;
            }
          }
        }
      }

      // If we found a point and the current ring boundary is further than our candidate,
      // subsequent outer rings cannot contain a closer point.
      const currentRingDistanceKm = (ring + 1) * this.cellSize * 111.0;
      if (foundCandidateInRing && currentRingDistanceKm > minDistance) {
        break;
      }
    }

    if (!nearest) return null;

    const bearing = calculateBearing(lat, lon, nearest.latitude, nearest.longitude);

    return {
      id: nearest.id,
      category: nearest.category,
      distance_km: minDistance,
      coordinates: [nearest.longitude, nearest.latitude],
      bearing_deg: bearing,
      direction: getCompassDirection(bearing)
    };
  }

  /**
   * Retrieves all infrastructure features within a radius threshold.
   *
   * @param {number} lat - Query latitude
   * @param {number} lon - Query longitude
   * @param {number} radiusKm - Radius in kilometers (default: 10km)
   * @param {Object} options - { category, limit }
   * @returns {Array} List of nearby infrastructure features sorted by distance
   */
  getFeaturesWithinRadius(lat, lon, radiusKm = 10.0, options = {}) {
    if (!this.isIndexed || this.totalIndexed === 0) return [];

    const { category = null, limit = 100 } = options;
    const normalizedCat = category ? this.normalizeCategory(category) : null;
    const targetGrid = normalizedCat ? this.categoryGrids.get(normalizedCat) : this.allGrid;

    if (normalizedCat && !targetGrid) return [];

    // Compute bounding box in degrees
    const latDelta = radiusKm / 111.0;
    const radLat = (lat * Math.PI) / 180.0;
    const lonCos = Math.max(0.1, Math.cos(radLat));
    const lonDelta = radiusKm / (111.0 * lonCos);

    const minLatIdx = Math.floor((lat - latDelta) / this.cellSize);
    const maxLatIdx = Math.floor((lat + latDelta) / this.cellSize);
    const minLonIdx = Math.floor((lon - lonDelta) / this.cellSize);
    const maxLonIdx = Math.floor((lon + lonDelta) / this.cellSize);

    const matches = [];

    for (let latIdx = minLatIdx; latIdx <= maxLatIdx; latIdx++) {
      for (let lonIdx = minLonIdx; lonIdx <= maxLonIdx; lonIdx++) {
        const key = `${latIdx}:${lonIdx}`;
        const cellPoints = targetGrid.get(key);
        if (!cellPoints) continue;

        for (let i = 0; i < cellPoints.length; i++) {
          const pt = cellPoints[i];
          const dist = calculateHaversineDistance(lat, lon, pt.latitude, pt.longitude);
          if (dist <= radiusKm) {
            const bearing = calculateBearing(lat, lon, pt.latitude, pt.longitude);
            matches.push({
              id: pt.id,
              category: pt.category,
              distance_km: dist,
              coordinates: [pt.longitude, pt.latitude],
              bearing_deg: bearing,
              direction: getCompassDirection(bearing)
            });
          }
        }
      }
    }

    // Sort by distance ascending
    matches.sort((a, b) => a.distance_km - b.distance_km);

    return matches.slice(0, limit);
  }

  /**
   * Calculates complete spatial context for a geographic coordinate.
   *
   * Computes exact distances to the 6 primary industrial categories and counts
   * nearby industrial, power, and general facilities within a configurable radius.
   *
   * @param {number} lat
   * @param {number} lon
   * @param {Object} options - { radiusKm: 10.0 }
   * @returns {Object} Comprehensive spatial context
   */
  calculateSpatialContext(lat, lon, options = {}) {
    const radiusKm = Number(options.radiusKm) > 0 ? Number(options.radiusKm) : 10.0;

    if (!isValidLatitude(lat) || !isValidLongitude(lon)) {
      return {
        error: 'Invalid coordinates for spatial correlation',
        is_georeferenced: false
      };
    }

    // 1. Calculate distances to nearest features for each major category
    const nearestIndustrial = this.getNearestFeature(lat, lon, 'industrial_area');
    const nearestPower = this.getNearestFeature(lat, lon, 'power_plant');
    const nearestQuarry = this.getNearestFeature(lat, lon, 'quarry');
    const nearestStorage = this.getNearestFeature(lat, lon, 'storage_tank');
    const nearestSubstation = this.getNearestFeature(lat, lon, 'substation');
    const nearestWorks = this.getNearestFeature(lat, lon, 'works');
    const overallNearest = this.getNearestFeature(lat, lon, null);

    // 2. Query all features within radius threshold
    const nearbyFeatures = this.getFeaturesWithinRadius(lat, lon, radiusKm, { limit: 1000 });

    let nearbyIndustrialCount = 0;
    let nearbyPowerCount = 0;

    for (let i = 0; i < nearbyFeatures.length; i++) {
      const cat = nearbyFeatures[i].category;
      if (cat === 'industrial_area' || cat === 'works' || cat === 'storage_tank') {
        nearbyIndustrialCount++;
      }
      if (cat === 'power_plant' || cat === 'substation') {
        nearbyPowerCount++;
      }
    }

    return {
      nearest_industrial_area_km: nearestIndustrial ? nearestIndustrial.distance_km : null,
      nearest_power_plant_km: nearestPower ? nearestPower.distance_km : null,
      nearest_quarry_km: nearestQuarry ? nearestQuarry.distance_km : null,
      nearest_storage_tank_km: nearestStorage ? nearestStorage.distance_km : null,
      nearest_substation_km: nearestSubstation ? nearestSubstation.distance_km : null,
      nearest_works_km: nearestWorks ? nearestWorks.distance_km : null,
      nearby_industrial_feature_count: nearbyIndustrialCount,
      nearby_power_feature_count: nearbyPowerCount,
      nearby_infrastructure_count: nearbyFeatures.length,
      radius_threshold_km: radiusKm,
      nearest_feature: overallNearest,
      is_georeferenced: true
    };
  }

  /**
   * Correlates an Event model instance against the spatial infrastructure index.
   * If georeferenced, executes real-time geodesic calculations.
   * If legacy without coordinates, safely presents precomputed multi-temporal feature distances.
   *
   * @param {Object} event - Event instance
   * @param {Object} options - { radiusKm: 10.0 }
   * @returns {Object} Event object enriched with spatial_context
   */
  correlateEvent(event, options = {}) {
    const radiusKm = Number(options.radiusKm) > 0 ? Number(options.radiusKm) : 10.0;

    let spatialContext;

    if (event.has_coordinates && event.latitude !== null && event.longitude !== null) {
      spatialContext = this.calculateSpatialContext(event.latitude, event.longitude, { radiusKm });
    } else {
      // Legacy record fallback: preserve authentic precomputed ML feature distances
      spatialContext = {
        nearest_industrial_area_km: Number(event.distance_to_industrial_area_km || 0),
        nearest_power_plant_km: Number(event.distance_to_power_plant_km || 0),
        nearest_quarry_km: Number(event.distance_to_quarry_km || 0),
        nearest_storage_tank_km: Number(event.distance_to_storage_tank_km || 0),
        nearest_substation_km: Number(event.distance_to_substation_km || 0),
        nearest_works_km: Number(event.distance_to_works_km || 0),
        nearby_industrial_feature_count: null,
        nearby_power_feature_count: null,
        nearby_infrastructure_count: null,
        radius_threshold_km: radiusKm,
        nearest_feature: null,
        is_georeferenced: false,
        note: 'Spatial context derived from multi-temporal dataset proximity features.'
      };
    }

    const eventJson = typeof event.toJSON === 'function' ? event.toJSON() : { ...event };
    return {
      ...eventJson,
      classification: event.fire_type || event.classification || 'Unknown',
      spatial_context: spatialContext
    };
  }
}

// Singleton instance
const spatialCorrelationService = new SpatialCorrelationService();

module.exports = spatialCorrelationService;
