# Database Layer

This directory contains the database schema and initialization scripts for PostgreSQL with the PostGIS extension.

## Modularity & Fallback
The prototype backend is designed with a modular data access layer:
1. **PostgreSQL + PostGIS Mode:** Used when a PostgreSQL connection is configured via `.env` (`DATABASE_URL`).
2. **Direct CSV Mode (Modular Fallback):** When PostgreSQL is not active or during initial lightweight local development, the backend can directly query the authoritative datasets in `data/` without fabricating records.

## Docker Setup
PostgreSQL with PostGIS can be started using the root `docker-compose.yml`:
```bash
docker compose up -d db
```
The initialization script `schema.sql` creates necessary PostGIS extensions, tables (`osm_features`, `fire_observations`), and spatial GIST indices.
