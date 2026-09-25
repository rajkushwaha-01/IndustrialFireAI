/**
 * Geodesic Distance & Bearing Calculations (WGS 84 Sphere / Haversine)
 */

const EARTH_RADIUS_KM = 6371.0088; // WGS 84 mean earth radius in km

/**
 * Converts degrees to radians.
 * @param {number} deg
 * @returns {number}
 */
function toRadians(deg) {
  return (deg * Math.PI) / 180.0;
}

/**
 * Converts radians to degrees.
 * @param {number} rad
 * @returns {number}
 */
function toDegrees(rad) {
  return (rad * 180.0) / Math.PI;
}

/**
 * Calculate the great-circle distance between two points on Earth using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of point 1 in degrees
 * @param {number} lon1 - Longitude of point 1 in degrees
 * @param {number} lat2 - Latitude of point 2 in degrees
 * @param {number} lon2 - Longitude of point 2 in degrees
 * @returns {number} Distance in kilometers (rounded to 4 decimal places)
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0.0;

  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Number(distance.toFixed(4));
}

/**
 * Calculate the initial compass bearing (azimuth) from point 1 to point 2 in degrees [0, 360).
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Bearing in degrees from true North
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δλ = toRadians(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  const bearing = (toDegrees(θ) + 360) % 360;

  return Number(bearing.toFixed(1));
}

/**
 * Returns a human-readable compass direction (N, NE, E, SE, S, SW, W, NW).
 * @param {number} bearingDeg
 * @returns {string}
 */
function getCompassDirection(bearingDeg) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  const index = Math.round((bearingDeg % 360) / 45);
  return directions[index];
}

module.exports = {
  EARTH_RADIUS_KM,
  calculateHaversineDistance,
  calculateBearing,
  getCompassDirection,
  toRadians,
  toDegrees
};
