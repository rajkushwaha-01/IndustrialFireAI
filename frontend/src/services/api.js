import axios from 'axios';

// Accept either an API origin or an already configured /api base path.
const configuredApiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const API_BASE = configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`;

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000
});

/**
 * Fetch thermal events GeoJSON with query filters
 */
export async function fetchEventsGeoJSON(params = {}) {
  const query = new URLSearchParams();
  if (params.classification && params.classification !== 'All') query.append('classification', params.classification);
  if (params.minConfidence) query.append('minConfidence', params.minConfidence);
  if (params.minPersistence) query.append('minPersistence', params.minPersistence);
  if (params.minFrp) query.append('minFrp', params.minFrp);
  if (params.bbox) query.append('bbox', params.bbox);
  if (params.radiusKm) query.append('radiusKm', params.radiusKm);
  if (params.limit) query.append('limit', params.limit);

  const res = await apiClient.get(`/events/geojson?${query.toString()}`);
  return res.data;
}

/**
 * Fetch paginated thermal events
 */
export async function fetchEvents(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val);
    }
  });
  const res = await apiClient.get(`/events?${query.toString()}`);
  return res.data;
}

/**
 * Fetch single event by ID with spatial context
 */
export async function fetchEventById(id, radiusKm = 10) {
  const res = await apiClient.get(`/events/${id}?radius=${radiusKm}`);
  return res.data;
}

/**
 * Fetch infrastructure GeoJSON
 */
export async function fetchInfrastructureGeoJSON(category = null, limit = 200) {
  const query = new URLSearchParams();
  query.append('format', 'geojson');
  query.append('limit', limit);
  if (category && category !== 'all') query.append('category', category);

  const res = await apiClient.get(`/infrastructure?${query.toString()}`);
  return res.data;
}

/**
 * Fetch spatial correlation for arbitrary coordinate
 */
export async function fetchSpatialCorrelation(lat, lon, radiusKm = 10) {
  const res = await apiClient.get(`/spatial/correlate?lat=${lat}&lon=${lon}&radius=${radiusKm}`);
  return res.data;
}

/**
 * Fetch nearby infrastructure for given coordinate
 */
export async function fetchNearbyInfrastructure(lat, lon, radiusKm = 10, limit = 50) {
  const res = await apiClient.get(`/events/nearby-infrastructure?lat=${lat}&lon=${lon}&radius=${radiusKm}&limit=${limit}`);
  return res.data;
}

/**
 * Fetch ML Model Info
 */
export async function fetchModelInfo() {
  const res = await apiClient.get('/model-info');
  return res.data;
}

/**
 * Run ML Inference with probability output
 */
export async function runPredict(payload) {
  const res = await apiClient.post('/predict', payload);
  return res.data;
}

/**
 * Fetch system health
 */
export async function fetchHealth() {
  const res = await apiClient.get('/health');
  return res.data;
}

export default {
  API_BASE,
  apiClient,
  fetchEventsGeoJSON,
  fetchEvents,
  fetchEventById,
  fetchInfrastructureGeoJSON,
  fetchNearbyInfrastructure,
  fetchSpatialCorrelation,
  fetchModelInfo,
  runPredict,
  fetchHealth
};
