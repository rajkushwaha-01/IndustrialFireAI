const dataRepository = require('../repositories');
const { createFeatureCollection } = require('../utils/geojson');

class InfrastructureService {
  async getInfrastructure(query = {}) {
    const filters = {
      category: query.category
    };

    const pagination = {
      page: query.page || 1,
      limit: query.limit || 50
    };

    const isGeoJson = String(query.format || '').toLowerCase() === 'geojson';

    const result = await dataRepository.getInfrastructure(filters, pagination);

    if (isGeoJson) {
      const features = result.data.map((item) => item.toGeoJSON());
      return createFeatureCollection(features, {
        page: result.pagination.page,
        limit: result.pagination.limit,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
        filters: result.filters,
        availableCategories: result.availableCategories,
        dataIntegrityNotice: 'This dataset contains verified OSM geospatial infrastructure coordinates across India. As per strict data integrity protocol, ML fire events are not joined with infrastructure coordinates by arbitrary row index.'
      });
    }

    return {
      success: true,
      pagination: result.pagination,
      filters: result.filters,
      availableCategories: result.availableCategories,
      dataIntegrityNotice: 'This dataset contains verified OSM geospatial infrastructure coordinates across India. As per strict data integrity protocol, ML fire events are not joined with infrastructure coordinates by arbitrary row index.',
      data: result.data.map((item) => item.toJSON())
    };
  }
}

module.exports = new InfrastructureService();
