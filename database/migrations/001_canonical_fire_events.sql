-- Migration: 001_canonical_fire_events.sql
-- Description: Create canonical georeferenced fire_events table with PostGIS geometry and strict WGS 84 constraints

-- Ensure PostGIS is enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Canonical Fire Events Table
CREATE TABLE IF NOT EXISTS fire_events (
    id SERIAL PRIMARY KEY,
    
    -- Geographic Coordinates (WGS 84 / EPSG:4326)
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326),

    -- Satellite Telemetry & Sensor Acquisition
    acquisition_date DATE,
    acquisition_time VARCHAR(10),
    satellite VARCHAR(50) DEFAULT 'NASA FIRMS VIIRS/MODIS',
    source VARCHAR(100) DEFAULT 'NASA FIRMS',

    -- Radiometry
    frp DOUBLE PRECISION,
    brightness_temperature DOUBLE PRECISION,
    confidence DOUBLE PRECISION,

    -- Multi-Temporal Persistence
    persistence_days DOUBLE PRECISION DEFAULT 1.0,
    detection_count INTEGER DEFAULT 1,
    detections INTEGER DEFAULT 1,
    night_ratio DOUBLE PRECISION DEFAULT 0.0,

    -- Multi-Temporal & FRP Radiative Metrics
    avg_frp DOUBLE PRECISION,
    max_frp DOUBLE PRECISION,
    total_frp DOUBLE PRECISION,
    avg_bright_ti4 DOUBLE PRECISION,
    avg_bright_ti5 DOUBLE PRECISION,

    -- Spatial Euclidean Distances to OpenStreetMap Infrastructure (km)
    distance_to_industrial_area_km DOUBLE PRECISION,
    distance_to_power_plant_km DOUBLE PRECISION,
    distance_to_quarry_km DOUBLE PRECISION,
    distance_to_substation_km DOUBLE PRECISION,
    distance_to_storage_tank_km DOUBLE PRECISION,
    distance_to_works_km DOUBLE PRECISION,

    -- Classification & Predictions
    fire_type VARCHAR(100) DEFAULT 'Unknown',
    prediction_class VARCHAR(50),
    prediction_confidence DOUBLE PRECISION,

    -- Audit Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Strict Coordinate Integrity Constraints (Reject invalid coordinates)
    CONSTRAINT chk_fire_events_latitude CHECK (latitude >= -90.0 AND latitude <= 90.0),
    CONSTRAINT chk_fire_events_longitude CHECK (longitude >= -180.0 AND longitude <= 180.0)
);

-- Trigger to automatically populate geom geometry(Point, 4326) from latitude & longitude
CREATE OR REPLACE FUNCTION update_fire_events_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fire_events_geom ON fire_events;
CREATE TRIGGER trg_fire_events_geom
    BEFORE INSERT OR UPDATE OF latitude, longitude ON fire_events
    FOR EACH ROW
    EXECUTE FUNCTION update_fire_events_geom();

-- Geospatial & Query Indexes
CREATE INDEX IF NOT EXISTS idx_fire_events_geom ON fire_events USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_fire_events_fire_type ON fire_events (fire_type);
CREATE INDEX IF NOT EXISTS idx_fire_events_acq_date ON fire_events (acquisition_date);
CREATE INDEX IF NOT EXISTS idx_fire_events_confidence ON fire_events (prediction_confidence);
CREATE INDEX IF NOT EXISTS idx_fire_events_persistence ON fire_events (persistence_days);
