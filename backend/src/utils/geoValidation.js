/**
 * Geospatial Coordinate Validation & Utilities (WGS 84 / EPSG:4326)
 */

/**
 * Validates that latitude is a finite number between -90.0 and +90.0 degrees.
 * @param {number|string} lat
 * @returns {boolean}
 */
function isValidLatitude(lat) {
  if (lat === null || lat === undefined || lat === '') return false;
  const num = Number(lat);
  return Number.isFinite(num) && num >= -90.0 && num <= 90.0;
}

/**
 * Validates that longitude is a finite number between -180.0 and +180.0 degrees.
 * @param {number|string} lon
 * @returns {boolean}
 */
function isValidLongitude(lon) {
  if (lon === null || lon === undefined || lon === '') return false;
  const num = Number(lon);
  return Number.isFinite(num) && num >= -180.0 && num <= 180.0;
}

/**
 * Validates a pair of coordinates [longitude, latitude].
 * @param {number|string} lon
 * @param {number|string} lat
 * @returns {{ valid: boolean, error?: string, parsed?: { latitude: number, longitude: number } }}
 */
function validateCoordinates(lon, lat) {
  if (!isValidLatitude(lat)) {
    return {
      valid: false,
      error: `Invalid latitude: '${lat}'. Must be a valid numeric degree between -90.0 and +90.0.`
    };
  }
  if (!isValidLongitude(lon)) {
    return {
      valid: false,
      error: `Invalid longitude: '${lon}'. Must be a valid numeric degree between -180.0 and +180.0.`
    };
  }
  return {
    valid: true,
    parsed: {
      latitude: Number(lat),
      longitude: Number(lon)
    }
  };
}

/**
 * Parse and validate a bounding box string: "minLon,minLat,maxLon,maxLat"
 * @param {string} bboxStr
 * @returns {{ valid: boolean, bbox?: [number, number, number, number], error?: string }}
 */
function parseBBox(bboxStr) {
  if (!bboxStr || typeof bboxStr !== 'string') {
    return { valid: false, error: 'BBox must be a comma-separated string: minLon,minLat,maxLon,maxLat' };
  }
  const parts = bboxStr.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p))) {
    return { valid: false, error: 'BBox requires 4 numeric values: minLon,minLat,maxLon,maxLat' };
  }
  const [minLon, minLat, maxLon, maxLat] = parts;
  if (!isValidLongitude(minLon) || !isValidLongitude(maxLon)) {
    return { valid: false, error: 'BBox longitudes must be between -180.0 and +180.0' };
  }
  if (!isValidLatitude(minLat) || !isValidLatitude(maxLat)) {
    return { valid: false, error: 'BBox latitudes must be between -90.0 and +90.0' };
  }
  if (minLon > maxLon || minLat > maxLat) {
    return { valid: false, error: 'BBox minimums must be less than or equal to maximums' };
  }
  return { valid: true, bbox: [minLon, minLat, maxLon, maxLat] };
}

/**
 * Check if a coordinate point falls inside a bounding box [minLon, minLat, maxLon, maxLat]
 * @param {number} lon
 * @param {number} lat
 * @param {[number, number, number, number]} bbox
 * @returns {boolean}
 */
function isPointInBBox(lon, lat, bbox) {
  if (!bbox || bbox.length !== 4) return true;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

module.exports = {
  isValidLatitude,
  isValidLongitude,
  validateCoordinates,
  parseBBox,
  isPointInBBox
};
