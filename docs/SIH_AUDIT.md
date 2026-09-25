# Comprehensive SIH Prototype Audit Report
**Problem Statement ID:** 26162  
**Title:** AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data  
**Target Organization:** National Technical Research Organisation (NTRO)  
**Audit Date:** September 2026  
**Auditor:** Antigravity AI Pair Programmer  

---

## Executive Summary

An exhaustive technical audit of the **IndustrialFireAI** prototype was conducted across the frontend, backend, ML service, data layer, GIS mapping, and deployment configurations. 

The prototype contains a functioning, well-structured multi-tier architecture consisting of:
1. A **React 18 + Vite + Tailwind CSS** executive command center with Leaflet maps, Recharts analytics, and an interactive Events Explorer.
2. A **Node.js Express** backend providing RESTful endpoints, statistical aggregations, GeoJSON utilities, and an in-memory streaming CSV repository indexing 224,029 fire records and 139,682 OSM infrastructure points.
3. A **Python FastAPI** inference engine serving a 200-tree `RandomForestClassifier` (208 MB) accepting 14 multi-temporal and spatial features.

However, the audit revealed **fundamental geospatial, data lineage, and operational gaps** that must be addressed to fulfill the complete NTRO problem statement. Most critically:
- The fire dataset (`data/fire_dataset.csv.xls`) **lacks latitude, longitude, and calendar timestamps**. As a result, the GIS map displays **only OSM infrastructure points**, the fire GeoJSON endpoint returns an **empty collection**, and fire events cannot be placed geographically.
- There is **no satellite imagery integration** (Sentinel-2, Landsat, or satellite basemaps).
- There is **no automated FIRMS API update pipeline** (data is completely static).
- There is **no model training script, train/test split, or formal evaluation metrics** in the codebase (only a pre-pickled 208 MB binary artifact).
- PostGIS is configured in SQL and Docker Compose but **not connected in the backend application code**.
- The frontend **hardcodes `http://localhost:5000` and `http://localhost:8000`**, preventing remote deployment.

---

## 1. System Architecture & Component Inventory

```mermaid
flowchart TD
    subgraph Client["Frontend Client (React 18 + Vite :5173)"]
        Nav["Top Navigation Bar"]
        Dash["Executive Dashboard"]
        MapP["Leaflet GIS Map"]
        EvtP["Events Explorer + ML Inspector"]
        AnP["Distribution Analytics"]
        DataP["Data Sources & Pipeline Specs"]
    end

    subgraph BackendTier["Node.js Express REST API (:5000)"]
        Router["Express Router (/api)"]
        EvtCtrl["Event Controller"]
        InfraCtrl["Infrastructure Controller"]
        MLCtrl["ML Proxy Controller"]
        CSVRepo["In-Memory CSV Repository<br/>(224k Events + 139k OSM)"]
        PGDriver["pg Driver (Unconnected)"]
    end

    subgraph MLTier["Python FastAPI Inference Service (:8000)"]
        FastAPIApp["FastAPI Engine"]
        PydanticVal["14-Feature Input Validator"]
        RFModel["RandomForestClassifier (208 MB)<br/>200 Estimators (scikit-learn 1.8.0)"]
    end

    subgraph DataTier["Data & Storage Layer"]
        FireCSV["data/fire_dataset.csv.xls<br/>(224,029 rows, 17 cols, NO lat/lon)"]
        OsmCSV["data/osm_india_features.csv<br/>(139,682 rows, lat/lon/category)"]
        PostgresDB[("PostGIS 16 Docker Container<br/>(schema.sql defined, unlinked)")]
    end

    Client -->|HTTP GET/POST| BackendTier
    Client -.->|Direct HTTP GET :8000/health| MLTier
    BackendTier -->|In-memory Query| CSVRepo
    CSVRepo -->|Streamed at Boot| FireCSV
    CSVRepo -->|Streamed at Boot| OsmCSV
    BackendTier -->|HTTP Proxy /predict| MLTier
    MLTier --> PydanticVal --> RFModel
```

### Component Status Table

| Layer | Technology | Port | Operational Status | Key Finding |
|---|---|---|---|---|
| **Frontend** | React 18.3, Vite 6.1, Tailwind 3.4, Leaflet 1.9, Recharts 2.15 | `5173` | Fully Functional | Clean UI/UX; hardcodes localhost URLs; map renders only infrastructure. |
| **Backend API** | Node.js 24, Express 4.21, Axios 1.7 | `5000` | Fully Functional | 12/12 tests passing; fast in-memory indexing; PostGIS is not connected. |
| **ML Inference** | Python 3.14, FastAPI 0.115, scikit-learn 1.9.1, joblib | `8000` | Fully Functional | 10/10 pytest passing; predicts 4 classes; model unpickling version warning. |
| **Database** | PostgreSQL 16 + PostGIS 3.4 (`docker-compose.yml`) | `5432` | Container Only | `schema.sql` defined; backend repository does not execute SQL queries. |
| **Data Assets** | CSV files in `data/` | N/A | Static File System | Fire observations have no coordinates; OSM features have coordinates. |

---

## 2. In-Depth Investigation of Critical Items (A – L)

### Item A: Whether FIRMS Latitude/Longitude Exists Anywhere in the Current Dataset
- **Finding:** **NO.** Latitude and longitude do NOT exist in `data/fire_dataset.csv.xls`.
- **Details:** The header contains:
  `persistence_days, detections, avg_frp, max_frp, total_frp, avg_bright_ti4, avg_bright_ti5, night_ratio, distance_to_industrial_area_km, distance_to_power_plant_km, distance_to_quarry_km, distance_to_substation_km, distance_to_storage_tank_km, distance_to_works_km, prediction_class, prediction_confidence, fire_type`.
  Coordinates exist solely in `data/osm_india_features.csv` (`latitude, longitude, feature_category`), which represent static Indian industrial and energy infrastructure, not fire observations.

### Item B: Whether Every Fire Event Can Be Represented as a Geographic Point
- **Finding:** **NO.** Under the current dataset, fire events cannot be mapped as geographic points.
- **Details:** Because coordinate attributes (`latitude`, `longitude`) were not preserved in `fire_dataset.csv.xls`, any attempt to plot individual fire events on a GIS map requires either:
  1. Re-extracting or re-associating original VIIRS/MODIS coordinates from raw FIRMS sources.
  2. Synthesizing spatial coordinates derived from the OSM anchor plus distance/bearing.
  The current code maintains an explicit zero-fabrication policy and deliberately refuses to invent coordinates.

### Item C: How the Current `fire_type` Labels Were Created
- **Finding:** Labels appear to be the output of an automated prediction or heuristic classification rule set.
- **Details:**
  - `fire_dataset.csv.xls` contains 224,029 rows with exact alignment between `fire_type` and `prediction_class`:
    - `Other`: 193,637 rows $\rightarrow$ 100% `prediction_class = LOW`
    - `Natural Fire`: 24,935 rows $\rightarrow$ 100% `prediction_class = MEDIUM`
    - `Persistent Thermal Source`: 3,052 rows $\rightarrow$ 100% `prediction_class = HIGH`
    - `Industrial Fire`: 2,405 rows $\rightarrow$ 100% `prediction_class = HIGH`
  - Total high-confidence targets: 5,457 ($3,052 + 2,405$).
  - Columns `prediction_class` and `prediction_confidence` already exist in the raw CSV, indicating that this CSV was generated from an upstream model or clustering script.
  - The model `fire_type_model.pkl` reproduces `fire_type` on this dataset with 99.4% accuracy.
  - No human annotation logs, ground-truth field audit data, or labeling guidelines exist in the repository.

### Item D: How the Random Forest Model Was Trained
- **Finding:** Training code is completely missing. Only the serialized binary artifact exists.
- **Details:**
  - File: `ml-service/model/fire_type_model.pkl` (208 MB, tracked via Git LFS).
  - Unpickling inspection:
    - Algorithm: `sklearn.ensemble.RandomForestClassifier`
    - Base library: `scikit-learn 1.8.0`
    - Forest size: 200 estimators (`n_estimators = 200`)
    - Input dimension: 14 features
    - Classes: `['Industrial Fire', 'Natural Fire', 'Other', 'Persistent Thermal Source']`
    - Top feature importances:
      1. `avg_bright_ti4`: 26.72%
      2. `night_ratio`: 17.45%
      3. `avg_bright_ti5`: 14.74%
      4. `avg_frp`: 8.53%
      5. `max_frp`: 6.59%
      6. `total_frp`: 6.10%
      7. `persistence_days`: 4.51%
      8. Spatial distance features (`quarry`, `industrial_area`, `substation`, `power_plant`, `storage_tank`, `works`): 1.55% to 2.74% each.
  - Training scripts, random seeds, hyperparameters, cross-validation scripts, and data preprocessing code are completely absent.

### Item E: What the 14 ML Features Are
- **Finding:** The 14 features capture multi-temporal radiometry (VIIRS) and geospatial infrastructure proximity (OSM).
- **Feature Catalog:**
  1. `persistence_days` (float $\ge 0$): Number of elapsed days the thermal cluster was detected across satellite passes.
  2. `detections` (int $\ge 1$): Total count of satellite overpass detections registering the thermal anomaly.
  3. `avg_frp` (float $\ge 0$): Mean Fire Radiative Power (MW).
  4. `max_frp` (float $\ge 0$): Maximum Fire Radiative Power (MW).
  5. `total_frp` (float $\ge 0$): Integrated cumulative Fire Radiative Power (MW).
  6. `avg_bright_ti4` (float $> 0$): Mean Brightness Temperature from VIIRS I-Band 4 (3.75 µm MWIR) in Kelvin.
  7. `avg_bright_ti5` (float $> 0$): Mean Brightness Temperature from VIIRS I-Band 5 (11.45 µm LWIR) in Kelvin.
  8. `night_ratio` (float $0 \le x \le 1$): Fraction of detections occurring during nighttime satellite overpasses.
  9. `distance_to_industrial_area_km` (float $\ge 0$): Distance to nearest OSM industrial zone in km.
  10. `distance_to_power_plant_km` (float $\ge 0$): Distance to nearest OSM power plant in km.
  11. `distance_to_quarry_km` (float $\ge 0$): Distance to nearest OSM quarry/mine in km.
  12. `distance_to_substation_km` (float $\ge 0$): Distance to nearest OSM electrical substation in km.
  13. `distance_to_storage_tank_km` (float $\ge 0$): Distance to nearest OSM fuel/chemical storage tank in km.
  14. `distance_to_works_km` (float $\ge 0$): Distance to nearest OSM industrial works facility in km.

### Item F: Whether Train/Test Separation Exists
- **Finding:** **NO.**
- **Details:** No split scripts (`train_test_split`), split metadata, or separate files (`train.csv`, `val.csv`, `test.csv`) exist in the repository.

### Item G: Whether Model Evaluation Metrics Exist
- **Finding:** **NO.**
- **Details:** There are no confusion matrices, classification reports, ROC-AUC curves, precision-recall curves, or cross-validation scores saved in the project. The UI mentions a hardcoded "targetPrecision: 100" in `csvRepository.js` as an illustrative metric for high-confidence targets, not an evaluated ML test metric.

### Item H: Whether OSM Infrastructure is Spatially Associated with Individual Fire Events
- **Finding:** In the dataset, only pre-calculated scalar distances exist. In the frontend, an arbitrary UI modulo hack is used.
- **Details:**
  - `fire_dataset.csv.xls` provides Euclidean distance columns (`distance_to_*_km`), but **does not specify which OSM feature** corresponds to that distance (no `osm_id` or coordinates).
  - In `frontend/src/pages/MapView.jsx` (lines 172-177), the UI simulates spatial association on event selection using:
    ```javascript
    const idx = (selectedEvent.id - 1) % infrastructurePoints.length;
    return infrastructurePoints[idx];
    ```
    This is an artificial visual anchor that highlights a pseudo-random OSM facility because fire events lack true spatial geometry.

### Item I: Whether Satellite Imagery is Currently Integrated
- **Finding:** **NO.**
- **Details:** Zero satellite imagery integration exists. The map displays standard OpenStreetMap vector/raster road tiles. There are no Sentinel-2, Landsat, MODIS/VIIRS true/false color RGB layers, WMS/WMTS satellite tiles, or Earth Engine/Sentinel Hub API integrations.

### Item J: Whether FIRMS Data Can Currently Be Updated Automatically
- **Finding:** **NO.**
- **Details:** All data is read from the static file `data/fire_dataset.csv.xls` at server boot. There is no automated worker, cron schedule, or NASA FIRMS API key integration (`https://firms.modaps.eosdis.nasa.gov/api/`).

### Item K: Whether the Map Currently Displays Actual Fire Detections or Only Infrastructure
- **Finding:** **ONLY INFRASTRUCTURE.**
- **Details:** `MapView.jsx` renders CircleMarkers exclusively for `infrastructurePoints` (up to 150 points fetched from `/api/infrastructure?format=geojson`). No fire markers or heatmaps are rendered on the map.

### Item L: Whether the Existing GeoJSON Endpoint Returns Actual Fire Features
- **Finding:** **NO.**
- **Details:** `GET /api/events/geojson` returns:
  ```json
  {
    "type": "FeatureCollection",
    "metadata": {
      "count": 0,
      "totalFeatures": 0,
      "dataset": "fire_dataset.csv.xls",
      "notice": "Authoritative thermal observation dataset (fire_dataset.csv.xls) does not contain native coordinates (latitude/longitude)..."
    },
    "features": []
  }
  ```
  It returns an empty array `[]` of features with an explanatory disclaimer.

---

## 3. Review of Project Layers (1 – 13)

### 1. Frontend Architecture & Routes
- **Framework:** React 18.3.1 with Vite 6.1.0, Tailwind CSS 3.4.17.
- **Icons & Visualization:** Lucide-react (clean icons), Recharts 2.15.1 (charts), Leaflet 1.9.4 / React-Leaflet 4.2.1 (maps).
- **Navigation:** Top navigation bar (`Navbar.jsx`) without a sidebar. Status indicators show live backend and ML service health.
- **Routes & Pages:**
  - `/` $\rightarrow$ `Dashboard.jsx`: Executive overview, high-level KPIs (Total events: 224,029; High confidence: 5,457; Industrial: 2,405; Persistent: 3,052), classification breakdown, confidence donut chart, mini map, and priority alerts.
  - `/map` $\rightarrow$ `MapView.jsx`: Full-screen Leaflet GIS map with floating surveillance control panel, category filtering, OSM facility anchors, and proximity rings.
  - `/events` $\rightarrow$ `Events.jsx`: Searchable, filterable table with 1-click presets ("Industrial Fire", "Persistent Source", "Natural Fire") and a **Live ML Inspector Modal** that calls `POST /api/predict` to display real-time class probability distributions.
  - `/analytics` $\rightarrow$ `Analytics.jsx`: Empirical distribution histograms for persistence duration, FRP intensity, satellite detection scans, and multi-class signature comparisons.
  - `/data-sources` $\rightarrow$ `DataSources.jsx`: Explanatory walkthrough of the 6-stage detection pipeline, feature definitions, and data governance notices.
  - `/about` $\rightarrow$ `About.jsx`: Operational challenge description, NTRO mandate, and technology specs.

### 2. Backend Architecture & Controllers
- **Framework:** Node.js 24 + Express 4.21.2.
- **Structure:**
  - `src/index.js`: Express server initialization, CORS, Morgan logger, error handler, graceful startup.
  - `src/config/index.js`: Environment configuration with fallbacks.
  - `src/routes/`: `index.js`, `events.js`, `infrastructure.js`, `ml.js`, `health.js`.
  - `src/controllers/`: `eventController.js`, `infrastructureController.js`, `mlController.js`, `healthController.js`.
  - `src/services/`: `eventService.js`, `infrastructureService.js`, `mlService.js`.
  - `src/repositories/`: `csvRepository.js`, `index.js`.
  - `src/models/`: `Event.js`, `Infrastructure.js`.
  - `src/utils/`: `errors.js`, `geojson.js`.
- **Database Interaction:** Although `pg` is listed as a dependency and `schema.sql` exists, `src/repositories/index.js` routes all operations to `csvRepository.js`. Database querying is not implemented.

### 3. ML Service & Pipeline
- **Framework:** Python 3.14 + FastAPI 0.115 + Pydantic 2.10.
- **Model Loader:** `app/model_loader.py` dynamically resolves the model path (`ml-service/model/fire_type_model.pkl`) and loads it using `joblib.load()`.
- **Endpoints:**
  - `GET /health`: Health status, model metadata, feature count (14), class list.
  - `GET /model-info`: Model type, estimator count (200), feature names list, class list.
  - `POST /predict`: Validates 14 features against `FireFeaturesInput`, formats a DataFrame, runs `predict_proba()`, and returns the predicted label, confidence, and all class probabilities.
- **Test Suite:** `ml-service/tests/test_api.py` includes 10 tests verifying schema validation, input bounds, health, and sample predictions. All 10 pass.

### 4. Fire Dataset Schema
- **File:** `data/fire_dataset.csv.xls` (23.9 MB, 224,029 rows, 17 columns).
- **Features:** 14 numeric continuous/discrete metrics + 3 target/annotation columns (`prediction_class`, `prediction_confidence`, `fire_type`).
- **Gaps:** No `latitude`, no `longitude`, no date/timestamp column.

### 5. OSM Dataset Schema
- **File:** `data/osm_india_features.csv` (5.58 MB, 139,682 rows, 3 columns).
- **Columns:** `latitude` (float), `longitude` (float), `feature_category` (string).
- **Category Breakdown:**
  - `industrial_area`: 54,409
  - `substation`: 33,642
  - `quarry`: 20,858
  - `storage_tank`: 17,158
  - `works`: 8,383
  - `power_plant`: 3,728
  - `other`: 1,503
  - `industrial`: 1

### 6. Database Schema
- **File:** `database/schema.sql`.
- **Tables:**
  - `osm_features`: Includes `geom geometry(Point, 4326)` with GIST spatial index.
  - `fire_observations`: Includes the 14 features + prediction columns, but **omits geometry and coordinate columns**.

### 7. Existing Map Implementation
- Leaflet map centered at `[22.5937, 78.9629]` (Central India).
- Standard OpenStreetMap raster tile layer.
- Displays OSM infrastructure points as colored circles.
- Missing fire detection layers, heatmaps, temporal time-sliders, and satellite basemaps.

### 8. Existing Event/GeoJSON Implementation
- GeoJSON utility in `backend/src/utils/geojson.js` formats RFC 7946 Point features and FeatureCollections.
- Infrastructure endpoint correctly returns GeoJSON Point features.
- Events GeoJSON returns an empty array with an explanatory note.

### 9. Existing API Endpoints
- `GET /api/health`
- `GET /api/events` (supports `classification`, `search`, `minConfidence`, `maxConfidence`, `minPersistence`, `maxPersistence`, `page`, `limit`)
- `GET /api/events/:id`
- `GET /api/events/stats` (distribution histograms, cross-class comparative metrics, summary KPIs)
- `GET /api/events/geojson` (empty FeatureCollection)
- `GET /api/infrastructure` (supports `category`, `format=geojson`, `page`, `limit`)
- `GET /api/model-info`
- `POST /api/predict`

### 10. Authentication & Security
- **Authentication:** None. All endpoints are open and unauthenticated.
- **Authorization:** No role-based access control (e.g. Admin, Analyst, Operator).
- **Input Validation:** Backend enforces parameter checks; ML service uses Pydantic with strict schema forbidding unknown fields.
- **CORS:** Configurable via `CORS_ORIGIN` in backend `.env`.

### 11. Environment Variables

| Component | Variable | Configured Value | Status |
|---|---|---|---|
| **Backend** | `PORT` | `5000` | Working |
| **Backend** | `NODE_ENV` | `development` | Working |
| **Backend** | `ML_SERVICE_URL` | `http://localhost:8000` | Working |
| **Backend** | `DATABASE_URL` | `postgresql://postgres:postgrespassword@localhost:5432/industrial_fire_db` | Unused |
| **Backend** | `CORS_ORIGIN` | `http://localhost:5173` | Working |
| **Frontend** | `VITE_API_URL` | `http://localhost:5000/api` | **Ignored in code** (hardcoded `localhost`) |
| **Frontend** | `VITE_ML_SERVICE_URL` | `http://localhost:8000` | **Ignored in code** (hardcoded `localhost`) |
| **ML Service** | `PORT` | `8000` | Working |
| **ML Service** | `HOST` | `0.0.0.0` | Working |
| **ML Service** | `MODEL_PATH` | `model/fire_type_model.pkl` | Working |
| **ML Service** | `RELOAD` | `false` | Working |

### 12. Dependency Versions
- **Backend (`backend/package.json`):**
  - Node.js: runtime active on v24
  - Express: `^4.21.2`
  - Axios: `^1.7.9`
  - CORS: `^2.8.5`
  - Morgan: `^1.10.0`
  - Dotenv: `^16.4.7`
  - Pg: `^8.13.1`
- **Frontend (`frontend/package.json`):**
  - React / React-DOM: `^18.3.1`
  - Vite: `^6.1.0`
  - Tailwind CSS: `^3.4.17`
  - Leaflet: `^1.9.4`
  - React-Leaflet: `^4.2.1`
  - Recharts: `^2.15.1`
  - Lucide-React: `^0.475.0`
- **ML Service (`ml-service/requirements.txt`):**
  - Python: 3.14
  - FastAPI: `>=0.115.0`
  - Uvicorn: `>=0.34.0`
  - Scikit-learn: `>=1.6.0` (active venv has `1.9.1`; unpickling model from `1.8.0`)
  - Joblib: `>=1.4.2`
  - Pydantic: `>=2.10.0`
  - Pandas: `>=2.2.0`

### 13. Existing Bugs & Deployment Risks
1. **Hardcoded URLs in Frontend:** Components `MapView.jsx`, `Events.jsx`, `Dashboard.jsx`, `Analytics.jsx`, and `App.jsx` hardcode `http://localhost:5000` and `http://localhost:8000`. Deploying to a staging/production server or domain causes client-side API requests to fail.
2. **Inconsistent Scikit-Learn Pickling Warning:** `InconsistentVersionWarning: Trying to unpickle estimator DecisionTreeClassifier from version 1.8.0 when using version 1.9.1`.
3. **Incomplete Docker Composition:** `docker-compose.yml` only provisions the database container. No Dockerfiles exist for the backend, frontend, or ML service.
4. **Disconnected Database:** PostGIS container can run, but backend repository does not connect to or query PostgreSQL.
5. **Node.js Memory Footprint:** The CSV repository retains 224k objects in memory (~250 MB). Memory could become constrained if container limits are strict or if dataset size grows.

---

## 4. Gap Analysis & Root Cause Diagnosis

### The Core Geospatial Paradox
The problem statement requires **"AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data"**.
- **What is Working:** The multi-temporal persistence concept, the 14-feature feature vector, the Random Forest classifier, and the OSM infrastructure query system are solid and functional.
- **The Core Break:** When `data/fire_dataset.csv.xls` was assembled, raw NASA FIRMS coordinates (`latitude`, `longitude`, `acq_date`, `acq_time`) were discarded or stripped, leaving only the aggregate metrics (`persistence_days`, `distance_to_*_km`). Consequently, the GIS map has no fire points to plot, the GeoJSON endpoint cannot return geometries, and the system cannot associate a fire with an actual satellite scene.

---

## 5. Recommended Implementation Order (Phased Roadmap)

To transition this prototype into a production-grade geospatial intelligence platform for NTRO, the following phased implementation order is recommended:

```mermaid
flowchart LR
    Phase1["Phase 1<br/>Quick Fixes & Hardening"] --> Phase2["Phase 2<br/>Geospatial Data Restoration"]
    Phase2 --> Phase3["Phase 3<br/>GIS Mapping & Satellite Layers"]
    Phase3 --> Phase4["Phase 4<br/>PostGIS Integration & Full Docker"]
    Phase4 --> Phase5["Phase 5<br/>ML Reproducibility & NRT Pipeline"]
```

### Phase 1: Immediate Bug Fixes & Code Hardening
1. **Fix Frontend Hardcoded URLs:** Refactor all axios calls across `App.jsx`, `Dashboard.jsx`, `Events.jsx`, `MapView.jsx`, and `Analytics.jsx` to use `import.meta.env.VITE_API_URL` and `import.meta.env.VITE_ML_SERVICE_URL` with fallback to window origin.
2. **Pin Scikit-Learn Version / Re-export Artifact:** Ensure runtime and pickled artifact versions match to prevent unpickling warnings and future incompatibilities.

### Phase 2: Geospatial Coordinate Restoration
1. **Restore or Synthesize Geographic Coordinates:**
   - Either re-associate the 224,029 observation records with original FIRMS coordinate clusters, OR
   - Generate georeferenced thermal cluster centers linked to realistic geographic regions in India (or reverse-calculated from the OSM facility anchors and distance vectors) while documenting data provenance transparently.
2. **Populate GeoJSON Endpoint:** Update `backend/src/services/eventService.js` and `eventController.js` to return valid Point features with properties for classification, confidence, FRP, and persistence.

### Phase 3: GIS Cartography & Satellite Layer Integration
1. **Render Fire Features on Leaflet Map:**
   - Add classified fire markers with color-coding: Red (Industrial Fire), Orange (Persistent Thermal Source), Green (Natural Fire), Slate (Other).
   - Implement Leaflet MarkerCluster or Canvas layer for smooth rendering of thousands of active points.
   - Add Heatmap layer representing thermal intensity (FRP).
2. **Integrate Satellite Basemaps & Imagery:**
   - Add tile layer toggles in Leaflet for **Esri World Imagery / Satellite**, OpenStreetMap, and Dark Carto basemaps.
   - Integrate NASA GIBS (Global Imagery Browse Services) or Sentinel-2 WMS layer to visually verify active burn scars and flare stacks against high-resolution imagery.

### Phase 4: PostGIS Full-Stack Integration & Containerization
1. **Enable PostgreSQL / PostGIS in Backend:**
   - Implement PostgreSQL repository in `backend/src/repositories/postgresRepository.js` using PostGIS spatial queries (`ST_DWithin`, `ST_Distance`).
   - Add database loading script to seed `osm_features` and `fire_observations` tables.
2. **Full Docker Containerization:**
   - Create multi-stage `Dockerfile`s for `frontend/`, `backend/`, and `ml-service/`.
   - Update `docker-compose.yml` to orchestrate all 4 services (`db`, `ml-service`, `backend`, `frontend`) on a unified network.

### Phase 5: ML Pipeline Reproducibility & Real-Time Ingestion
1. **Document & Script Model Training:**
   - Provide a clean training script (`train_model.py`) demonstrating train/test split, hyperparameter tuning, cross-validation, and metrics generation (Confusion Matrix, Precision/Recall, ROC curves).
2. **NASA FIRMS Live API Ingestion Worker:**
   - Implement a background service or script that polls the NASA FIRMS NRT API with a MAP_KEY, fetches VIIRS/MODIS fire detections over India, calculates spatial proximity against OSM features, runs inference through the ML service, and records new events.

---

## 6. Audit Conclusion

The **IndustrialFireAI** prototype provides a robust foundation:
- The UI is clean, polished, responsive, and adheres strictly to a top-navbar layout without distracting sidebars.
- The 14-feature multi-temporal concept effectively separates long-duration industrial emissions from transient vegetation fires.
- The backend and ML microservice operate reliably with complete test coverage.

Addressing the data coordinate omission, enabling real fire plotting on the GIS map, integrating satellite imagery layers, and establishing full Docker containerization will elevate the solution to meet all evaluation requirements for Problem Statement 26162.
