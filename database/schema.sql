-- PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Table for OpenStreetMap and geospatial features in India
CREATE TABLE IF NOT EXISTS osm_features (
    id SERIAL PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    feature_category VARCHAR(100) NOT NULL,
    geom geometry(Point, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_osm_latitude CHECK (latitude >= -90.0 AND latitude <= 90.0),
    CONSTRAINT chk_osm_longitude CHECK (longitude >= -180.0 AND longitude <= 180.0)
);

CREATE INDEX IF NOT EXISTS idx_osm_features_geom ON osm_features USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_osm_features_category ON osm_features (feature_category);

-- 2. Canonical Georeferenced Fire Events Table (NASA FIRMS + PostGIS)
CREATE TABLE IF NOT EXISTS fire_events (
    id SERIAL PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326),
    acquisition_date DATE,
    acquisition_time VARCHAR(10),
    satellite VARCHAR(50) DEFAULT 'NASA FIRMS VIIRS/MODIS',
    source VARCHAR(100) DEFAULT 'NASA FIRMS',
    frp DOUBLE PRECISION,
    brightness_temperature DOUBLE PRECISION,
    confidence DOUBLE PRECISION,
    persistence_days DOUBLE PRECISION DEFAULT 1.0,
    detection_count INTEGER DEFAULT 1,
    detections INTEGER DEFAULT 1,
    night_ratio DOUBLE PRECISION DEFAULT 0.0,
    avg_frp DOUBLE PRECISION,
    max_frp DOUBLE PRECISION,
    total_frp DOUBLE PRECISION,
    avg_bright_ti4 DOUBLE PRECISION,
    avg_bright_ti5 DOUBLE PRECISION,
    distance_to_industrial_area_km DOUBLE PRECISION,
    distance_to_power_plant_km DOUBLE PRECISION,
    distance_to_quarry_km DOUBLE PRECISION,
    distance_to_substation_km DOUBLE PRECISION,
    distance_to_storage_tank_km DOUBLE PRECISION,
    distance_to_works_km DOUBLE PRECISION,
    fire_type VARCHAR(100) DEFAULT 'Unknown',
    prediction_class VARCHAR(50),
    prediction_confidence DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_fire_events_latitude CHECK (latitude >= -90.0 AND latitude <= 90.0),
    CONSTRAINT chk_fire_events_longitude CHECK (longitude >= -180.0 AND longitude <= 180.0)
);

CREATE INDEX IF NOT EXISTS idx_fire_events_geom ON fire_events USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_fire_events_fire_type ON fire_events (fire_type);
CREATE INDEX IF NOT EXISTS idx_fire_events_confidence ON fire_events (prediction_confidence);
CREATE INDEX IF NOT EXISTS idx_fire_events_acq_date ON fire_events (acquisition_date);

-- 3. Legacy Table for Historical Multi-Temporal Model Records (Non-Georeferenced)
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
