/**
 * GeoJSON Formatting Utilities (RFC 7946)
 */

function createPointFeature(longitude, latitude, properties = {}, id = undefined) {
  const feature = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [Number(longitude), Number(latitude)]
    },
    properties
  };
  if (id !== undefined) {
    feature.id = id;
  }
  return feature;
}

function createFeatureCollection(features = [], metadata = {}) {
  return {
    type: 'FeatureCollection',
    metadata: {
      count: features.length,
      timestamp: new Date().toISOString(),
      ...metadata
    },
    features
  };
}

module.exports = {
  createPointFeature,
  createFeatureCollection
};
