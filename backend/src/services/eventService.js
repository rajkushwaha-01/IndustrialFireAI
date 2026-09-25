const dataRepository = require('../repositories');
const { NotFoundError } = require('../utils/errors');
const { createFeatureCollection } = require('../utils/geojson');

class EventService {
  async getEvents(query = {}) {
    const filters = {
      classification: query.classification,
      search: query.search || query.q,
      minConfidence: query.minConfidence !== undefined ? query.minConfidence : query.min_confidence,
      maxConfidence: query.maxConfidence !== undefined ? query.maxConfidence : query.max_confidence,
      minPersistence: query.minPersistence !== undefined ? query.minPersistence : query.min_persistence,
      maxPersistence: query.maxPersistence !== undefined ? query.maxPersistence : query.max_persistence
    };

    const pagination = {
      page: query.page || 1,
      limit: query.limit || 50
    };

    return dataRepository.getEvents(filters, pagination);
  }

  async getEventById(id) {
    const event = await dataRepository.getEventById(id);
    if (!event) {
      throw new NotFoundError(`Thermal event not found with ID ${id}`);
    }
    return event.toJSON();
  }

  async getStats() {
    return dataRepository.getEventStats();
  }

  async getGeoJSON() {
    // Strictly adheres to data integrity rule:
    // fire_dataset.csv.xls does not contain native coordinates.
    // We return a valid GeoJSON FeatureCollection with 0 fabricated features and an explicit notice.
    return createFeatureCollection([], {
      totalFeatures: 0,
      dataset: 'fire_dataset.csv.xls',
      notice: 'Authoritative thermal observation dataset (fire_dataset.csv.xls) does not contain native coordinates (latitude/longitude). In accordance with strict data integrity rules, synthetic coordinates are not fabricated. Verified infrastructure coordinates are exposed via /api/infrastructure.'
    });
  }
}

module.exports = new EventService();
