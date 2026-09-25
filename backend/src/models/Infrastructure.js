/**
 * Infrastructure Point Model Schema & Formatter
 */
class Infrastructure {
  constructor(data) {
    this.id = Number(data.id);
    this.latitude = Number(data.latitude);
    this.longitude = Number(data.longitude);
    this.feature_category = String(data.feature_category || '').trim();
  }

  toJSON() {
    return {
      id: this.id,
      latitude: this.latitude,
      longitude: this.longitude,
      feature_category: this.feature_category
    };
  }

  toGeoJSON() {
    return {
      type: 'Feature',
      id: this.id,
      geometry: {
        type: 'Point',
        coordinates: [this.longitude, this.latitude]
      },
      properties: {
        id: this.id,
        feature_category: this.feature_category
      }
    };
  }
}

module.exports = Infrastructure;
