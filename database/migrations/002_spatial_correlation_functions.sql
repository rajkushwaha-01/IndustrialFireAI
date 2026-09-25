-- Migration: 002_spatial_correlation_functions.sql
-- Description: PostGIS spatial correlation queries & functions for FIRMS fire events vs OSM infrastructure

-- 1. Function to calculate spatial correlation context for an arbitrary coordinate
CREATE OR REPLACE FUNCTION fn_calculate_spatial_context(
    p_lat DOUBLE PRECISION,
    p_lon DOUBLE PRECISION,
    p_radius_km DOUBLE PRECISION DEFAULT 10.0
)
RETURNS TABLE (
    nearest_industrial_area_km DOUBLE PRECISION,
    nearest_power_plant_km DOUBLE PRECISION,
    nearest_quarry_km DOUBLE PRECISION,
    nearest_storage_tank_km DOUBLE PRECISION,
    nearest_substation_km DOUBLE PRECISION,
    nearest_works_km DOUBLE PRECISION,
    nearby_industrial_feature_count BIGINT,
    nearby_power_feature_count BIGINT,
    nearby_infrastructure_count BIGINT
) AS $$
DECLARE
    v_query_geom geometry := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326);
    v_radius_meters DOUBLE PRECISION := p_radius_km * 1000.0;
BEGIN
    RETURN QUERY
    WITH distances AS (
        SELECT 
            feature_category,
            ROUND((MIN(ST_Distance(geom::geography, v_query_geom::geography)) / 1000.0)::numeric, 4)::DOUBLE PRECISION AS dist_km
        FROM osm_features
        WHERE ST_DWithin(geom::geography, v_query_geom::geography, 250000.0) -- max 250km search
        GROUP BY feature_category
    ),
    nearby_counts AS (
        SELECT
            COUNT(*) FILTER (WHERE feature_category IN ('industrial_area', 'works', 'storage_tank', 'industrial')) AS ind_count,
            COUNT(*) FILTER (WHERE feature_category IN ('power_plant', 'substation')) AS power_count,
            COUNT(*) AS total_count
        FROM osm_features
        WHERE ST_DWithin(geom::geography, v_query_geom::geography, v_radius_meters)
    )
    SELECT
        (SELECT dist_km FROM distances WHERE feature_category = 'industrial_area' LIMIT 1),
        (SELECT dist_km FROM distances WHERE feature_category = 'power_plant' LIMIT 1),
        (SELECT dist_km FROM distances WHERE feature_category = 'quarry' LIMIT 1),
        (SELECT dist_km FROM distances WHERE feature_category = 'storage_tank' LIMIT 1),
        (SELECT dist_km FROM distances WHERE feature_category = 'substation' LIMIT 1),
        (SELECT dist_km FROM distances WHERE feature_category = 'works' LIMIT 1),
        COALESCE((SELECT ind_count FROM nearby_counts), 0),
        COALESCE((SELECT power_count FROM nearby_counts), 0),
        COALESCE((SELECT total_count FROM nearby_counts), 0);
END;
$$ LANGUAGE plpgsql;

-- 2. Function to retrieve nearby infrastructure features within a radius
CREATE OR REPLACE FUNCTION fn_find_nearby_infrastructure(
    p_lat DOUBLE PRECISION,
    p_lon DOUBLE PRECISION,
    p_radius_km DOUBLE PRECISION DEFAULT 10.0,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id INTEGER,
    feature_category VARCHAR(100),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    distance_km DOUBLE PRECISION
) AS $$
DECLARE
    v_query_geom geometry := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326);
    v_radius_meters DOUBLE PRECISION := p_radius_km * 1000.0;
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.feature_category,
        o.latitude,
        o.longitude,
        ROUND((ST_Distance(o.geom::geography, v_query_geom::geography) / 1000.0)::numeric, 4)::DOUBLE PRECISION AS distance_km
    FROM osm_features o
    WHERE ST_DWithin(o.geom::geography, v_query_geom::geography, v_radius_meters)
    ORDER BY distance_km ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
