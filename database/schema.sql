-- PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Table for OpenStreetMap and geospatial features in India
CREATE TABLE IF NOT EXISTS osm_features (
    id SERIAL PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    feature_category VARCHAR(100) NOT NULL,
    geom geometry(Point, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_osm_features_geom ON osm_features USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_osm_features_category ON osm_features (feature_category);

-- Table for Thermal Anomalies and Fire Events (FIRMS / Model Features)
CREATE TABLE IF NOT EXISTS fire_observations (
    id SERIAL PRIMARY KEY,
    persistence_days DOUBLE PRECISION,
    detections INTEGER,
    avg_frp DOUBLE PRECISION,
    max_frp DOUBLE PRECISION,
    total_frp DOUBLE PRECISION,
    avg_bright_ti4 DOUBLE PRECISION,
    avg_bright_ti5 DOUBLE PRECISION,
    night_ratio DOUBLE PRECISION,
    distance_to_industrial_area_km DOUBLE PRECISION,
    distance_to_power_plant_km DOUBLE PRECISION,
    distance_to_quarry_km DOUBLE PRECISION,
    distance_to_substation_km DOUBLE PRECISION,
    distance_to_storage_tank_km DOUBLE PRECISION,
    distance_to_works_km DOUBLE PRECISION,
    prediction_class VARCHAR(50),
    prediction_confidence DOUBLE PRECISION,
    fire_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fire_observations_fire_type ON fire_observations (fire_type);
CREATE INDEX IF NOT EXISTS idx_fire_observations_confidence ON fire_observations (prediction_confidence);
