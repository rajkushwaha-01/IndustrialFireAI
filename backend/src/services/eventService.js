const dataRepository = require('../repositories');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { isValidLatitude, isValidLongitude } = require('../utils/geoValidation');

class EventService {
  async getEvents(query = {}) {
    const filters = {
      classification: query.classification,
      search: query.search || query.q,
      minConfidence: query.minConfidence !== undefined ? query.minConfidence : query.min_confidence,
      maxConfidence: query.maxConfidence !== undefined ? query.maxConfidence : query.max_confidence,
      minPersistence: query.minPersistence !== undefined ? query.minPersistence : query.min_persistence,
      maxPersistence: query.maxPersistence !== undefined ? query.maxPersistence : query.max_persistence,
      hasCoordinates: query.hasCoordinates !== undefined ? query.hasCoordinates : query.has_coordinates,
      radiusKm: query.radiusKm || query.radius || 10.0
    };

    const pagination = {
      page: query.page || 1,
      limit: query.limit || 50
    };

    return dataRepository.getEvents(filters, pagination);
  }

  async getEventById(id, query = {}) {
    const radiusKm = query.radiusKm || query.radius || 10.0;
    const event = await dataRepository.getEventById(id, { radiusKm: Number(radiusKm) });
    if (!event) {
      throw new NotFoundError(`Thermal event not found with ID ${id}`);
    }
    return event;
  }

  async getStats() {
    return dataRepository.getEventStats();
  }

  async getGeoJSON(query = {}) {
    const filters = {
      classification: query.classification,
      minConfidence: query.minConfidence !== undefined ? query.minConfidence : query.min_confidence,
      maxConfidence: query.maxConfidence !== undefined ? query.maxConfidence : query.max_confidence,
      minPersistence: query.minPersistence !== undefined ? query.minPersistence : query.min_persistence,
      maxPersistence: query.maxPersistence !== undefined ? query.maxPersistence : query.max_persistence,
      minFrp: query.minFrp !== undefined ? query.minFrp : query.min_frp,
      bbox: query.bbox,
      limit: query.limit || 1000,
      radiusKm: query.radiusKm || query.radius || 10.0
    };

    return dataRepository.getEventsGeoJSON(filters);
  }

  async getSpatialCorrelation(lat, lon, query = {}) {
    if (!isValidLatitude(lat) || !isValidLongitude(lon)) {
      throw new ValidationError(`Invalid query coordinates: lat=${lat}, lon=${lon}. Latitude must be [-90, 90], Longitude must be [-180, 180].`);
    }

    const radiusKm = Number(query.radiusKm || query.radius || 10.0);
    const spatialContext = dataRepository.calculateSpatialContext(Number(lat), Number(lon), { radiusKm });

    return {
      latitude: Number(lat),
      longitude: Number(lon),
      radius_threshold_km: radiusKm,
      spatial_context: spatialContext
    };
  }

  async getNearbyInfrastructure(lat, lon, query = {}) {
    if (!isValidLatitude(lat) || !isValidLongitude(lon)) {
      throw new ValidationError(`Invalid query coordinates: lat=${lat}, lon=${lon}. Latitude must be [-90, 90], Longitude must be [-180, 180].`);
    }

    const radiusKm = Number(query.radiusKm || query.radius || 10.0);
    const limit = Number(query.limit || 50);
    const category = query.category || null;

    const features = dataRepository.findNearbyInfrastructure(Number(lat), Number(lon), radiusKm, { category, limit });

    return {
      query: {
        latitude: Number(lat),
        longitude: Number(lon),
        radius_km: radiusKm,
        category: category || 'all',
        limit
      },
      count: features.length,
      data: features
    };
  }
}

module.exports = new EventService();
