# GIS Visualization Architecture — Phase 3 Specification
**Smart India Hackathon (SIH) Problem Statement 26162 (NTRO)**  
*AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data*

---

## 1. Executive Summary

Phase 3 elevates the Leaflet mapping component into the primary operational GIS surveillance console for the SIH PS 26162 platform. Rather than displaying isolated synthetic coordinates or disconnected graphs, the Leaflet map directly consumes authentic NASA FIRMS fire observations enriched by the backend's real-time spatial correlation engine (`GET /api/events/geojson`) and overlays verified OpenStreetMap (OSM) national industrial infrastructure (`GET /api/infrastructure?format=geojson`).

---

## 2. Key GIS Capabilities

```
+---------------------------------------------------------------------------------------+
|                               LEAFLET GIS CONSOLE                                    |
+---------------------------------------------------------------------------------------+
|  [Top-Left] Surveillance Controls      |  [Top-Right] GIS Layer & Basemap Controls    |
|  - Classification Pills (All/Ind/Pers) |  - Esri World Imagery (Satellite)            |
|  - Confidence Selector (>=70, 85, 90%) |  - OpenStreetMap Standard (Street)           |
|  - Date Picker (Acquisition Timestamp)|  - CartoDB Dark Matter (Tactical Dark)       |
|  - Min FRP Slider (>=10, 25, 50, 100MW)|  - OpenTopoMap (Topographic)                 |
|  - Persistence Filter (>=5, 15, 30d)   |  - Spatial Overlays Toggles                  |
|  - Infra Proximity (1km, 3km, 5km, 10) |    * FIRMS Fire Events                       |
|  - Fit Extent & Reset Actions          |    * Supercluster Aggregation                |
|                                        |    * OSM Infrastructure Anchors              |
|                                        |    * Spatial Hazard Proximity Rings          |
+----------------------------------------+----------------------------------------------+
|  [Map Canvas: Leaflet + Supercluster]                                                 |
|  - Dense thermal events aggregated into dynamic numeric cluster badges at low zoom   |
|  - Leaf nodes resolve into classification-colored circle markers with FRP-scaled radii|
|  - Interactive Popups: Event ID, FRP, Temp, Confidence, Satellite, Nearest OSM Asset  |
+---------------------------------------------------------------------------------------+
|  [Bottom] Active Surveillance Quick Feed & Bottom Selected Telemetry Inspector        |
+---------------------------------------------------------------------------------------+
```

---

## 3. Classification-Based Visual Hierarchy

Every thermal event is styled based on its multi-modal classification:

| Classification | Fill Color | Border / Glow | Radius Scaling | Operational Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **Industrial Fire** | `#dc2626` (Red) | High-contrast white ring, 1km hazard buffer | $r \propto \sqrt{\text{FRP}}$ | Critical industrial threat; flare or incident within industrial bounds |
| **Persistent Thermal Source** | `#ea580c` (Orange) | Concentric pulsating glow | $r \propto \sqrt{\text{FRP}}$ | Repeated stationary high-heat facility (smelter, refinery, brick kiln) |
| **Natural Fire** | `#16a34a` (Green) | Forest green ring | $r \propto \sqrt{\text{FRP}}$ | Forest, agricultural residue burning, or wildfire |
| **Other / Unknown** | `#64748b` (Slate) | Neutral slate ring | Fixed radius | Transient thermal anomaly or unclassified signature |

---

## 4. Multi-Basemap Integration

The GIS viewer provides 4 base layer providers selectable in the Layer Control widget:

1. **Esri World Imagery (Satellite)**:
   - URL: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
   - High-resolution multi-spectral satellite imagery allowing visual validation of industrial facilities, smokestacks, and flare stacks.
2. **OpenStreetMap Standard (Streets)**:
   - URL: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
   - High-contrast vector cartography showing transportation corridors, property parcels, and populated areas.
3. **CartoDB Dark Matter (Tactical Dark)**:
   - URL: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
   - Ultra-clean dark basemap optimized for high-contrast nighttime surveillance and thermal hotspot glow visualization.
4. **OpenTopoMap (Topographic)**:
   - URL: `https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png`
   - Elevation contours and terrain features showing valleys, hillsides, and quarry excavations.

---

## 5. Supercluster Geographic Clustering Strategy

To prevent DOM thrashing when handling hundreds of thousands of active fire events:
- **Hierarchical Indexing**: Evaluated dynamically using `supercluster` based on the map's current bounding box (`[west, south, east, north]`) and integer zoom level.
- **Cluster Aggregation (Zoom $\le 16$)**: Neighboring thermal events within a 65px radius are coalesced into a single cluster marker displaying event count with heat-gradient styling.
- **Cluster Expansion Click**: Clicking any cluster invokes `supercluster.getClusterExpansionZoom(clusterId)` and animates the map directly to the expanded bounds.
- **Leaf Node Rendering (Zoom $\ge 17$ or Isolated Events)**: Renders individual classification markers equipped with rich telemetry popups.

---

## 6. Fire Event Popup & Telemetry Schema

Every active fire marker Leaflet popup renders complete telemetry complying strictly with Phase 3 requirements:

1. **Identification**: Observation ID (`#1001`), Classification badge (`Industrial Fire`).
2. **AI Inference**: Model prediction class and confidence percentage (`96%`).
3. **Radiometric Measurements**:
   - Fire Radiative Power: `FRP (MW)`
   - Brightness Temperature: `Kelvin (K)`
4. **Temporal Persistence**:
   - Total detected persistence days (`42 Days`)
   - Sensor detection count / scans (`88 detections`)
5. **Acquisition Metadata**:
   - Date & Time: `YYYY-MM-DD HHMM UTC`
   - Satellite / Instrument: `VIIRS-NOAA20 (375m)` or `MODIS (1km)`
   - WGS 84 Coordinates: `Lat °N, Lon °E`
6. **Nearest Industrial Infrastructure Context**:
   - Facility category (e.g. `Substation`, `Industrial Area`, `Refinery`)
   - Geodesic distance in kilometers (`1.08 km`)
   - Bearing azimuth and compass quadrant (`SW 214°`)
   - OSM Node/Way ID (`OSM #127412`)
7. **Spatial Proximity Matrix**:
   - Distance to industrial area
   - Distance to power plant
   - Distance to storage tank
   - Distance to substation
   - Total industrial facility count within 10 km radius

---

## 7. Multi-Dimensional Map Filtering

The floating top-left surveillance console enables real-time client-side and server-side filtering:

1. **Classification**: `All`, `Industrial Fire`, `Persistent Thermal Source`, `Natural Fire`, `Other`.
2. **Confidence**: `Any`, $\ge 70\%$, $\ge 85\%$, $\ge 90\%$.
3. **Date Filter**: Dropdown populated dynamically with available acquisition dates.
4. **FRP Range**: `Any`, $\ge 10\text{ MW}$, $\ge 25\text{ MW}$, $\ge 50\text{ MW}$, $\ge 100\text{ MW}$.
5. **Persistence**: `Any`, $\ge 5\text{ days}$, $\ge 15\text{ days}$, $\ge 30\text{ days}$, $\ge 60\text{ days}$.
6. **Infrastructure Proximity**: `Any Distance`, $\le 1\text{ km}$ (Critical), $\le 3\text{ km}$, $\le 5\text{ km}$, $\le 10\text{ km}$.
7. **One-Click Actions**:
   - **Fit Extent**: Centers and bounds the map tightly around the filtered event subset.
   - **Reset Filters**: Restores all surveillance parameters to default state.

---

## 8. System States Handling

- **Loading State**: Displays a non-intrusive floating glassmorphic status badge with rotating compass icon during asynchronous GeoJSON data stream reception.
- **Empty State**: Renders an alert inside the surveillance console when query filters yield zero matching events, providing a prominent "Reset Filters" action button.
- **API Error State**: Displays an amber/rose banner detailing connection issues with an interactive "Retry" trigger.

---

## 9. Verification & Test Coverage

### Frontend GIS Test Suite (`frontend/tests/gis_map.test.js`)
- **Basemap URL Verification**: Validates all 4 tile providers.
- **Classification Color Engine**: Asserts compliance with Phase 3 color codes.
- **Supercluster Low-Zoom Aggregation**: Asserts clusters form properly at zoom 5.
- **Supercluster High-Zoom Expansion**: Asserts complete expansion at zoom 17.
- **Filter Precision**: Validates 6-dimension filtering.
- **Popup Telemetry Integrity**: Asserts all 10 required telemetry fields are present.

### Backend Test Suite (`backend/tests/`)
- All 31 backend integration tests pass cleanly (`npm test`).
