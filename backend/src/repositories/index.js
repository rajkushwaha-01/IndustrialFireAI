const csvRepository = require('./csvRepository');

class DataRepository {
  constructor() {
    this.activeRepo = csvRepository;
    this.mode = 'csv';
  }

  async init() {
    try {
      await csvRepository.init();
      this.mode = 'csv';
      return true;
    } catch (err) {
      console.error('[DataRepository ERROR] Failed to initialize data repository:', err);
      throw err;
    }
  }

  async getEvents(filters, pagination) {
    return this.activeRepo.getEvents(filters, pagination);
  }

  async getEventById(id, options) {
    return this.activeRepo.getEventById(id, options);
  }

  async getEventStats() {
    return this.activeRepo.getEventStats();
  }

  async getEventsGeoJSON(filters) {
    return this.activeRepo.getEventsGeoJSON(filters);
  }

  async addEvents(newEvents) {
    return this.activeRepo.addEvents(newEvents);
  }

  async getInfrastructure(filters, pagination) {
    return this.activeRepo.getInfrastructure(filters, pagination);
  }

  calculateSpatialContext(lat, lon, options) {
    return this.activeRepo.calculateSpatialContext(lat, lon, options);
  }

  findNearbyInfrastructure(lat, lon, radiusKm, options) {
    return this.activeRepo.findNearbyInfrastructure(lat, lon, radiusKm, options);
  }

  getStatus() {
    return this.activeRepo.getStatus();
  }
}

const dataRepository = new DataRepository();

module.exports = dataRepository;
