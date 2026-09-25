# Satellite Imagery & Multi-Modal Context — Phase 4 Specification
**Smart India Hackathon (SIH) Problem Statement 26162 (NTRO)**  
*AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data*

---

## 1. Executive Summary

Phase 4 integrates high-resolution optical Earth observation imagery into the GIS platform. The purpose of this layer is **optical geographic context** — allowing defense analysts, plant operators, and emergency responders to visually inspect physical structures (cooling towers, flare stacks, petrochemical tanks, smokestacks, and containment berms) beneath spaceborne infrared thermal anomalies.

> [!IMPORTANT]
> **Strict Non-Conflation Rule:**  
> Optical satellite surface photography is **NEVER** presented as or conflated with NASA FIRMS thermal radiometer data. The platform explicitly and visually distinguishes between optical surface features, infrared thermal detections, ground infrastructure geometries, and predictive AI classification.

---

## 2. The 4-Tier Multi-Modal Architecture

```
+-----------------------------------------------------------------------------------------------+
|                        MULTI-MODAL GIS SURVEILLANCE STACK                                     |
+-----------------------------------------------------------------------------------------------+
|  TIER 1: OPTICAL SATELLITE IMAGERY                                                           |
|  - Source: Esri World Imagery / Sentinel-2 / Mapbox HD                                       |
|  - Sensor: Visible & Near-Infrared (VNIR) optical surface photography                        |
|  - Purpose: Physical terrain, structure inspection, rooflines, flare stacks                 |
|  - Classification: Contextual Basemap ONLY (NOT thermal emission)                            |
+-----------------------------------------------------------------------------------------------+
|  TIER 2: NASA FIRMS THERMAL ANOMALIES                                                         |
|  - Source: Suomi-NPP / NOAA-20 VIIRS 375m & Terra / Aqua MODIS 1km                           |
|  - Sensor: Mid-Infrared (3.9um) & Thermal Infrared (11um) Radiometers                         |
|  - Purpose: Radiometric Fire Radiative Power (MW), Brightness Temp (K), Day/Night scan       |
|  - Classification: Active spaceborne physical thermal measurements                           |
+-----------------------------------------------------------------------------------------------+
|  TIER 3: OPENSTREETMAP (OSM) INFRASTRUCTURE                                                  |
|  - Source: Authoritative OpenStreetMap India Spatial Index (139,682 features)                |
|  - Geometry: Ground-truth WGS 84 Points / Polygons of refineries, substations, tanks         |
|  - Purpose: Geodesic proximity, facility vulnerability, and spatial feature extraction       |
+-----------------------------------------------------------------------------------------------+
|  TIER 4: MULTI-MODAL AI CLASSIFICATION                                                        |
|  - Source: Random Forest Inference Engine                                                    |
|  - Inputs: Multi-modal fusion of FIRMS FRP/persistence + OSM spatial proximity matrix        |
|  - Output: Industrial Fire vs. Persistent Thermal Source vs. Natural Fire (with % confidence) |
+-----------------------------------------------------------------------------------------------+
```

---

## 3. Satellite Imagery Providers & Attribution

All satellite providers are legally and technically compliant with open GIS and public API guidelines:

| Provider | Layer ID | Key Required? | Max Zoom | Resolution / Type | Legal Attribution Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Esri World Imagery** *(Default)* | `esri` | **No** | 19 | Sub-meter optical composite | `Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community` |
| **Sentinel-2 Cloudless** | `sentinel` | **No** | 16 | 10m multi-spectral optical | `Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2020)` |
| **Mapbox Satellite HD** | `mapbox` | **Yes** (`VITE_MAPBOX_TOKEN`) | 20 | High-resolution commercial composite | `© Mapbox © OpenStreetMap` |
| **OpenStreetMap Standard** | `osm` | **No** | 19 | Vector streets & corridors | `© OpenStreetMap contributors` |
| **CartoDB Dark Matter** | `dark` | **No** | 19 | High-contrast tactical dark base | `© OpenStreetMap contributors © CARTO` |
| **OpenTopoMap** | `topo` | **No** | 17 | Elevation contours & terrain relief | `Map data: © OpenStreetMap contributors, SRTM | Style: OpenTopoMap` |

---

## 4. Configuration & Environment Variables

No secrets or API keys are hard-coded into the repository. Configuration is managed via Vite environment variables:

```bash
# frontend/.env
VITE_API_URL=http://localhost:5000/api
VITE_ML_SERVICE_URL=http://localhost:8000

# Satellite Imagery Layer Configuration (Phase 4)
# Supported options: 'esri' | 'sentinel' | 'mapbox' | 'osm' | 'dark' | 'topo'
VITE_DEFAULT_SATELLITE_PROVIDER=esri

# Optional: Set VITE_MAPBOX_TOKEN to enable Mapbox Satellite HD tiles
VITE_MAPBOX_TOKEN=
```

---

## 5. Graceful Fallback Strategy

The satellite resolver (`frontend/src/services/satelliteProviders.js`) enforces zero-failure degradation:

1. **Missing Key Fallback**:
   - If the user or environment selects `mapbox` but `VITE_MAPBOX_TOKEN` is unset or empty, the system automatically redirects to **Esri World Imagery**.
   - A non-intrusive floating alert notifies the user:
     `"Provider Mapbox Satellite HD requires VITE_MAPBOX_TOKEN in .env. Falling back safely to Esri World Imagery."`
2. **Invalid Provider Fallback**:
   - If an unrecognized provider ID is requested, the system safely falls back to `esri`.
3. **Tile Load Network Degradation**:
   - If optical satellite tiles fail to load due to air-gapped or restricted network environments, standard OpenStreetMap tiles remain instantly accessible via the layer control.

---

## 6. Surrounding Area Satellite Inspection Mode

When an analyst or user selects any active fire event (via map marker click, quick feed, or table):

1. **"Inspect Surrounding Area in Satellite"**:
   - One-click trigger in the observation card and on-marker popup.
   - Automatically switches the basemap to High-Resolution Optical Satellite imagery.
   - Smoothly pans and zooms the camera directly to surface level (**Zoom 16**).
2. **Inspection HUD Overlays**:
   - **Target Crosshair**: Centers precisely on the FIRMS observation coordinates.
   - **Range Rings**: Renders 500m close-range and 1,000m industrial facility buffer rings.
   - **Thermal Overlay Opacity Slider**: Allows analysts to adjust hotspot opacity from 10% to 100% to clearly see physical rooftops, smokestacks, and storage tanks beneath the anomaly.
3. **Deep External Satellite Verification Links**:
   - 🌐 **Google Earth / Maps Aerial**: Ultra-high resolution 3D terrain and optical inspection.
   - 🛰️ **NASA Worldview**: Historical satellite true-color imagery aligned to the **exact acquisition date** of the FIRMS detection.
   - 🇪🇺 **Sentinel Hub EO Browser**: Multi-band shortwave infrared (SWIR) inspection for burn scar validation.

---

## 7. Verification & Automated Test Suite

The Phase 4 satellite engine is verified via automated unit and integration tests:

```bash
# Execute Frontend GIS & Satellite Tests (10/10 Passing)
cd frontend
npm test

# Execute Backend Integration Tests (31/31 Passing)
cd backend
npm test
```

### Verified Test Cases:
1. `Basemap provider configuration validation`
2. `Classification color mapping compliance`
3. `Supercluster low-zoom aggregation`
4. `Supercluster high-zoom leaf expansion`
5. `Multi-dimensional GIS filtering`
6. `Fire event popup telemetry completeness`
7. `Satellite Providers catalog validation (open vs. keyed)`
8. `resolveSatelliteProvider safe fallback when key is absent`
9. `getSatelliteInspectionLinks URL synthesis (Google Earth, NASA Worldview, Sentinel Hub)`
10. `Multi-modal 4-tier source distinction (asserts optical satellite is NOT thermal data)`
