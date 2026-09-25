const csvRepository = require('./csvRepository');

class DataRepository {
  constructor() {
    this.activeRepo = csvRepository;
    this.mode = 'csv';
  }

  async init() {
    // Attempt database check, fallback to CSV repository
    try {
      await csvRepository.init();
      this.mode = 'csv';
      return true;
    } catch (err) {
      console.error('[DataRepository ERROR] Failed to initialize CSV repository:', err);
      throw err;
    }
  }

  async getEvents(filters, pagination) {
    return this.activeRepo.getEvents(filters, pagination);
  }

  async getEventById(id) {
    return this.activeRepo.getEventById(id);
  }

  async getEventStats() {
    return this.activeRepo.getEventStats();
  }

  async getInfrastructure(filters, pagination) {
    return this.activeRepo.getInfrastructure(filters, pagination);
  }

  getStatus() {
    return this.activeRepo.getStatus();
  }
}

const dataRepository = new DataRepository();

module.exports = dataRepository;
