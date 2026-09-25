# NASA FIRMS Data Ingestion Pipeline — Phase 5 Specification
**Smart India Hackathon (SIH) Problem Statement 26162 (NTRO)**  
*AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data*

---

## 1. Executive Summary

Phase 5 establishes an end-to-end, automated ingestion pipeline that transforms raw NASA FIRMS (Fire Information for Resource Management System) observations into verified, georeferenced, spatially-correlated, and AI-classified thermal events queryable by the GIS surveillance API.

---

## 2. Conceptual Pipeline Architecture

```
               +--------------------------------------------+
               |        1. FIRMS SOURCE DATA STREAM         |
               |  - NASA FIRMS REST API (VIIRS 375m/MODIS)  |
               |  - Local / Staged Canonical CSV Files      |
               |  - Direct In-Memory CSV Upload Payloads    |
               +---------------------+----------------------+
                                     |
                                     v
               +--------------------------------------------+
               |             2. DOWNLOAD / FETCH            |
               |  - HTTPS Axios streaming with timeout      |
               |  - Zero hard-coded credentials             |
               +---------------------+----------------------+
                                     |
                                     v
               +--------------------------------------------+
               |                3. VALIDATE                 |
               |  - Mandatory coordinates (lat, lon)        |
               |  - Geodetic bounds check [-90,90],[-180,180|
               |  - Numeric type safety on FRP/temperature  |
               |  - NEVER silently discard invalid data     |
               +---------------------+----------------------+
                                     |
                                     v
               +--------------------------------------------+
               |                4. NORMALIZE                |
               |  - Date: YYYY-MM-DD standard               |
               |  - Time: 4-digit HHMM UTC                  |
               |  - FRP: non-negative float (MW)            |
               |  - Temp: Kelvin (200K - 500K)              |
               |  - Confidence: [0.0, 1.0] scale            |
               +---------------------+----------------------+
                                     |
                                     v
               +--------------------------------------------+
               |               5. DEDUPLICATE               |
               |  - Spatial-temporal hash signature         |
               |  - O(1) Set lookup vs batch & repository   |
               +---------------------+----------------------+
                                     |
                                     v
               +--------------------------------------------+
               |                  6. STORE                  |
               |  - Append unique records to Data Layer     |
               |  - Update global statistical indexes       |
               +---------------------+----------------------+
                                     |
                                     v
               +--------------------------------------------+
               |           7. SPATIAL CORRELATION           |
               |  - Real-time geodesic distance calculation |
               |  - Query 139,682 OSM ground infrastructure |
               |  - Compute distance to refinery, power, etc|
               +---------------------+----------------------+
                                     |
                                     v
               +--------------------------------------------+
               |              8. ML INFERENCE               |
               |  - Construct 14-feature multi-modal vector |
               |  - Query Random Forest /predict model      |
               |  - Classify: Industrial vs Persistent vs.. |
               +---------------------+----------------------+
                                     |
                                     v
               +--------------------------------------------+
               |             9. GIS SURVEILLANCE API        |
               |  - GET /api/events/geojson (Instant map)   |
               |  - GET /api/events (Paginated intelligence)|
               +--------------------------------------------+
```

---

## 3. Strict Validation & Non-Silent Rejection Guarantee

In compliance with NTRO requirements, the pipeline **never silently discards invalid data**:

1. **Header Validation**:
   - Asserts that mandatory coordinate columns exist in the header (`latitude` / `lat` and `longitude` / `lon`).
   - If missing, throws an immediate validation exception detailing missing vs received columns.
2. **Coordinate Validation**:
   - Latitude must be numeric, finite, and strictly within $[-90.0, 90.0]$.
   - Longitude must be numeric, finite, and strictly within $[-180.0, 180.0]$.
3. **Audit Trail Logging**:
   - Every rejected row is recorded into an in-memory and returnable rejection log containing:
     - `row`: Line index in source data.
     - `error`: Detailed explanation of rejection.
     - `raw`: Original line text.
   - Queryable via `GET /api/firms/rejections`.

---

## 4. Normalization Engine

| Field | Raw Variants | Normalized Canonical Format | Rule |
| :--- | :--- | :--- | :--- |
| **Acquisition Date** | `2024-03-15`, `2024/03/15`, `20240315`, ISO strings | `YYYY-MM-DD` | Clean ISO date string |
| **Acquisition Time** | `1830`, `830`, `18:30`, `18:30:00` | `HHMM` (UTC) | 4-digit zero-padded string |
| **Fire Radiative Power** | Strings, floats, nulls | `Float` (MW) | Non-negative, rounded to 2 decimal places |
| **Brightness Temp** | Kelvin, Celsius ($<200^\circ\text{C}$) | `Float` (Kelvin) | If $<200$, converts $T_K = T_C + 273.15$ |
| **Confidence** | `'h'`, `'n'`, `'l'`, percentages ($85$), floats | `Float` $[0.0, 1.0]$ | `'h'` $\to 0.95$, `'n'` $\to 0.75$, `'l'` $\to 0.40$ |
| **Satellite / Sensor** | `N20`, `VIIRS-NOAA20`, `Terra`, `Aqua` | Standard sensor string | Canonical satellite instrument label |

---

## 5. Deduplication Mechanism

To prevent redundant duplicate alerts when processing overlapping satellite swathes:

1. **Spatial-Temporal Signature**:
   ```
   sig = `${lat.toFixed(4)}_${lon.toFixed(4)}_${acqDate}_${acqTime}_${satellite.toLowerCase()}`
   ```
2. **$O(1)$ Hash Checking**:
   - Checked against both the in-process batch Set and the global repository's `eventSignatures` Set.
   - If the signature exists, `duplicates` counter increments and duplicate storage is bypassed.
   - If novel, signature is registered and record proceeds to storage and enrichment.

---

## 6. Pipeline Downstream Enrichment

1. **Spatial Correlation Engine Integration**:
   - Each newly ingested event is passed to `spatialCorrelationService.correlateEvent(event, { radiusKm: 10 })`.
   - Computes distance to nearest industrial areas, power plants, refineries, storage tanks, substations, and quarries.
2. **Multi-Modal ML Classification**:
   - Constructs the 14-feature vector:
     `[persistence_days, detections, avg_frp, max_frp, total_frp, avg_bright_ti4, avg_bright_ti5, night_ratio, distance_to_industrial_area_km, distance_to_power_plant_km, distance_to_quarry_km, distance_to_substation_km, distance_to_storage_tank_km, distance_to_works_km]`
   - Dispatches to `POST /predict` on the ML service.
   - If the ML service is temporarily offline, applies a deterministic rule-based fallback so ingestion never blocks.

---

## 7. Ingestion Statistics Schema

Every ingestion execution returns structured telemetry:

```json
{
  "records_received": 10000,
  "records_inserted": 9421,
  "duplicates": 421,
  "invalid_records": 158,
  "processing_time": "1.24s",
  "spatial_correlation_completed": 9421,
  "ml_inferences_completed": 9421,
  "temporal_range": {
    "start": "2024-03-01",
    "end": "2024-03-15"
  },
  "spatial_bounds": {
    "min_lat": 8.082,
    "max_lat": 35.491,
    "min_lon": 68.182,
    "max_lon": 97.391
  },
  "source": "NASA FIRMS API (IND VIIRS_NOAA20_NRT)",
  "error_samples": [
    {
      "row": 159,
      "error": "Invalid latitude value '999.0' at row 159 (must be numeric in [-90, 90])",
      "raw": "999.0,70.0612,50,2024-03-20"
    }
  ]
}
```

---

## 8. Admin / Developer Endpoints

### 1. `POST /api/firms/ingest`
Manually triggers ingestion.
**Request Body**:
```json
{
  "source": "file", // "file" | "api" | "csv_content"
  "filePath": "data/firms_canonical_events.csv",
  "country": "IND",
  "dayRange": 2,
  "runSpatialCorrelation": true,
  "runMlInference": true
}
```

### 2. `GET /api/firms/status`
Returns pipeline health, auto-sync settings, and credential status without exposing keys.
**Response**:
```json
{
  "success": true,
  "data": {
    "auto_sync_enabled": false,
    "sync_interval_hours": 24,
    "has_map_key": true,
    "default_source": "VIIRS_NOAA20_NRT",
    "default_country": "IND",
    "is_syncing": false,
    "last_batch_stats": { ... },
    "recent_rejection_count": 0
  }
}
```

### 3. `GET /api/firms/rejections`
Returns the rejection log containing samples and reasons for unaccepted records.

### 4. `POST /api/firms/sync`
Quick trigger to pull live active fire detections from NASA FIRMS API for India.

---

## 9. CLI Command Interface

Execute manual ingestion via the command line:

```bash
# Ingest from local file
node backend/src/scripts/importFirms.js --file ./data/firms_canonical_events.csv

# Ingest from NASA FIRMS API (Requires FIRMS_MAP_KEY in backend/.env)
node backend/src/scripts/importFirms.js --api --country IND --days 2

# Limit records and disable ML inference for quick testing
node backend/src/scripts/importFirms.js --file ./data/firms_canonical_events.csv --max 50 --no-ml
```

---

## 10. Automated Background Scheduled Sync

When enabled in `backend/.env`:
```bash
FIRMS_AUTO_SYNC_ENABLED=true
FIRMS_SYNC_INTERVAL_HOURS=24
FIRMS_MAP_KEY=your_secret_nasa_firms_key
```
The server automatically initializes a background interval task (`setInterval`) on startup. It executes the full pipeline non-blockingly, catches and logs network or ingestion errors safely, and enriches new observations into the GIS layer without human intervention.
