# SIH 2024 Final Demonstration Guide
## Problem Statement 26162 (NTRO): AI-Based Detection & Classification of Industrial Fires and Persistent Thermal Sources

**Organization:** National Technical Research Organisation (NTRO)  
**Target System:** IndustrialFireAI Geospatial Intelligence Platform  
**Target Audience:** SIH Evaluation Jury, Defense Specialists & Geospatial Analysts  
**System URL:** [http://localhost:3000](http://localhost:3000) (Docker) or [http://localhost:5173](http://localhost:5173) (Local Dev)

---

## Executive Summary & System Overview

IndustrialFireAI addresses the critical national security challenge of monitoring and classifying thermal anomalies detected by satellite remote sensing across the Indian subcontinent. Utilizing radiometric sensor feeds from **NASA FIRMS (VIIRS 375m & MODIS 1km)** and spatial correlation with **139,682 OpenStreetMap industrial infrastructure assets**, the platform distinguishes high-risk **Industrial Fires** and permanent **Persistent Thermal Sources** (e.g., flaring stacks, smelting furnaces, brick kilns) from transient **Natural/Agricultural Fires** and benign background anomalies.

This guide provides an end-to-end walkthrough script for a 5-to-10 minute live SIH evaluation presentation.

---

## 13-Step SIH Demonstration Flow

```
[1. Dashboard] ──────────► [2. Anomaly KPIs] ────────► [3. GIS Map]
       │                                                    │
       ▼                                                    ▼
[6. OSM Infrastructure] ◄─── [5. Satellite Imagery] ◄─── [4. FIRMS Events]
       │
       ▼
[7. Select Event] ───────► [8. AI Classification] ────► [9. Multi-Source Evidence]
                                                            │
                                                            ▼
[13. Data Pipeline] ◄─── [12. Investigation Page] ◄─── [10. Persistence & Spatial]
```

---

### Step 1: Open Dashboard
- **Action:** Open browser to `http://localhost:3000` (or `http://localhost:5173`).
- **Display:** The React Command Center displays the top navigation bar, system health indicators, and the Executive Overview dashboard.
- **Narrative:**
  > *"Respected evaluators, this is the IndustrialFireAI Command Center. The system provides real-time situational awareness for thermal anomalies across India, correlating satellite sensor radiometric detections with national industrial geospatial infrastructure."*

---

### Step 2: Show Thermal Anomaly Statistics
- **Action:** Highlight the 9 KPI Metric Cards and the 6 empirical distribution charts.
- **Data Points to Highlight:**
  1. **Total Thermal Anomalies:** `224,061` observations loaded and indexed.
  2. **Industrial Fires Identified:** `2,417` high-risk events (1.08%).
  3. **Persistent Thermal Sources:** `3,060` stationary industrial thermal sources (1.37%).
  4. **Natural / Stubble Fires:** `24,943` seasonal vegetation burns (11.13%).
  5. **Other / Low-Intensity Heat:** `193,641` transient ambient heat signatures (86.42%).
  6. **High-Confidence Targets:** `5,477` critical alerts requiring defense monitoring.
  7. **High-FRP Anomalies:** `2,312` intense thermal spikes exceeding 50 MW.
  8. **Proximity to Infrastructure:** `57,125` thermal events detected within 5 km of classified industrial assets.
- **Charts to Highlight:**
  - **Classification Breakdown:** Clear visual evidence of extreme class imbalance (97.5% non-industrial vs 2.5% target anomalies).
  - **FRP Distribution:** Logarithmic dispersion showing bulk radiative power in the 0–15 MW range, with industrial spikes reaching up to 2,160 MW.
  - **Infrastructure Proximity Distribution:** Shows 8,335 events in immediate hazard proximity (< 1 km).
- **Narrative:**
  > *"Every single figure displayed here is computed directly from backend data—zero mock figures. Notice that industrial fires and persistent thermal sources represent fewer than 2.5% of all thermal anomalies. Discarding noise without false alarms is the primary ML challenge."*

---

### Step 3: Open GIS Map
- **Action:** Click **"GIS Map"** in the top navigation bar or navigate to `/map`.
- **Display:** Interactive full-screen Leaflet GIS map centered on the Indian subcontinent, initialized with thermal anomaly layers and custom dark-theme cartography.
- **Narrative:**
  > *"The GIS visualization engine renders georeferenced thermal events alongside national infrastructure. The map supports dynamic superclustering, classification-based color rendering, and dual-layer cartography."*

---

### Step 4: Show FIRMS Thermal Events
- **Action:** Point out the colored pulsing circular markers:
  - **Red (#EF4444):** Industrial Fire
  - **Amber (#F59E0B):** Persistent Thermal Source
  - **Green (#10B981):** Natural Fire
  - **Gray (#6B7280):** Other / Unknown
- **Action:** Demonstrate the map filter controls in the left floating sidebar:
  - Filter by Classification: Select **"Industrial Fire"**.
  - Adjust Min Confidence slider to `80%`.
  - Adjust Min FRP to `20 MW`.
- **Narrative:**
  > *"Each marker represents a verified NASA FIRMS satellite detection. The color immediately communicates classification, and the radius reflects detection intensity. Filtering is dynamic and powered by spatial GeoJSON streams from our backend."*

---

### Step 5: Toggle Satellite Imagery
- **Action:** Open the **Layer Control** panel on the top-right corner of the map.
- **Action:** Switch the Base Map from **OpenStreetMap** to **Satellite Imagery (ESRI / MapTiler)**.
- **Action:** Zoom into an active industrial corridor (e.g., Jamnagar, Gujarat or Trombay, Maharashtra).
- **Critical Evaluator Distinction:**
  > *"We must emphasize a vital scientific distinction: The satellite imagery layer is high-resolution optical earth observation used strictly as a geographic base context. The thermal anomaly overlay on top comes from NASA FIRMS VIIRS I-band (375m) and MODIS (1km) thermal infrared sensors. We do not conflate optical satellite photos with radiometric infrared anomaly measurements."*

---

### Step 6: Show OSM Industrial Infrastructure
- **Action:** In the Layer Control panel, toggle the **"OSM Infrastructure"** overlay on.
- **Display:** Distinct colored infrastructure markers appear across the region:
  - 🏭 **Industrial Areas / Parks** (Purple)
  - ⚡ **Power Plants** (Yellow)
  - 🛢️ **Petrochemical Storage Tanks / Refineries** (Cyan)
  - ⛏️ **Mining & Quarries** (Brown)
  - 🔌 **Electrical Substations** (Orange)
- **Narrative:**
  > *"Here we display OpenStreetMap industrial infrastructure. The backend pre-indexes 139,682 infrastructure assets across India into spatial memory and PostGIS GIST indexes, computing Haversine spatial correlation distances to power plants, substations, and storage tanks in under 1 millisecond."*

---

### Step 7: Select an Event
- **Action:** Click on **Event ID 1001** on the map (located near Jamnagar, Gujarat: `22.4782°N, 70.0612°E`).
- **Display:** The interactive map popup displays:
  - Event ID: `1001`
  - Sensor: `NASA FIRMS VIIRS 375m (NOAA-20)`
  - Classification: `Industrial Fire`
  - Radiative Power: `68.4 MW`
  - Brightness Temperature: `365.2 K` (92.0 °C)
  - Persistence: `42 days` (88 cumulative detections)
  - Nearest Asset: `Industrial Area (1.26 km)`
- **Narrative:**
  > *"Selecting Event 1001 immediately reveals the event profile. Notice that this is not a single scan: it has been detected across 42 cumulative days with 88 satellite passes, emitting 68.4 MW of radiative power just 1.26 km from a major industrial asset."*

---

### Step 8: Show AI Classification
- **Action:** Highlight the AI prediction badge and confidence score (`96%`).
- **Narrative:**
  > *"Our Random Forest classifier analyzes 14 canonical features—radiometric, spatial, and multi-temporal—to predict one of four discrete classes. The model was trained with stratified cross-validation and rigorous feature hygiene to prevent data leakage."*

---

### Step 9: Show Confidence & Multi-Source Evidence
- **Action:** In the popup or side panel, expand the **Classification Evidence Breakdown**:
  1. **Spatial Proximity:** `HIGH` — Located 1.26 km from an active industrial zone.
  2. **Temporal Persistence:** `HIGH` — 42-day duration rules out transient agricultural burning.
  3. **Radiative Power (FRP):** `HIGH` — 68.4 MW indicates intensive industrial flare or thermal combustor.
  4. **Infrastructure Density:** `HIGH` — 4 major facilities situated within a 5 km operational buffer.
- **Narrative:**
  > *"Unlike black-box AI systems, our platform exposes a transparent evidence layer. Evaluators and defense analysts can inspect the exact four evidence vectors contributing to the score, backed by an explicit scientific disclaimer stating that satellite inferences are probabilistic."*

---

### Step 10: Show Persistence
- **Action:** Point to the **Persistence Metric**: `42 days` and `88 detection scans`.
- **Narrative:**
  > *"Persistence is the single most decisive differentiator in satellite thermal analysis. Stubble and forest fires burn out in 1 to 5 days. Stationary flare stacks, smelters, and industrial furnaces persist for weeks or months. This temporal dimension prevents false alarms."*

---

### Step 11: Show Spatial Relationship to Infrastructure
- **Action:** Point out the spatial distance matrix on the popup:
  - Distance to Industrial Area: `1.26 km`
  - Distance to Storage Tanks: `3.11 km`
  - Distance to Power Plant: `9.18 km`
  - Distance to Substation: `3.44 km`
- **Action:** Note the spatial buffer ring rendered around the event on the map.
- **Narrative:**
  > *"Every event is correlated against six critical infrastructure categories. If an anomaly occurs within 2 km of a petrochemical storage tank, the threat posture escalates dramatically."*

---

### Step 12: Open Event Investigation Workflow
- **Action:** In the popup, click the **"Deep Forensic Investigation"** button (or navigate to `/investigate/1001`).
- **Display:** The dedicated Forensic Investigation page opens, featuring:
  - **Forensic Header:** Event ID, coordinates, satellite sensor, detection timestamp.
  - **4 Analytical Cards:**
    1. *Detection Profile:* Coordinates, date/time, source satellite.
    2. *Thermal Telemetry:* FRP (68.4 MW), Brightness Temp (365.2 K), Diurnal Ratio (0.83 night ratio).
    3. *Temporal History:* Persistence days, detection frequency, cluster duration.
    4. *Spatial Infrastructure Matrix:* Exact distances to 6 infrastructure types.
  - **Focused Satellite Inspection Map:** Aerial view centered on the anomaly with proximity buffers.
  - **Classification Evidence Matrix:** Transparent breakdown of factors, weights, and probabilistic distribution.
  - **Scientific Limitations Disclaimer:** Explicit declaration regarding remote sensing constraints.
- **Narrative:**
  > *"The Investigation workflow is designed for operational intelligence officers. When an incident is flagged, the analyst can conduct a complete multi-source forensic review before dispatching field inspection units."*

---

### Step 13: Explain the End-to-End Data Pipeline
- **Action:** Navigate to **"Data Sources"** (`/datasources`) or present the Architecture Diagram.
- **Walkthrough:**
  1. **Satellite Ingestion:** NASA FIRMS API / VIIRS 375m NRT data ingested with coordinate bounding-box validation (India bounds: $6.0^\circ\text{N}$ to $37.5^\circ\text{N}$, $68.0^\circ\text{E}$ to $97.5^\circ\text{E}$).
  2. **Validation & Normalization:** Required columns validated, coordinates checked, date/time normalized, invalid records rejected with structured error logging.
  3. **Spatial Correlation:** Ingested coordinates correlated against 139,682 OSM infrastructure points using spatial Haversine algorithms and PostGIS GIST indexes.
  4. **ML Inference:** The validated 14-feature vector is dispatched to the Python FastAPI microservice running the trained Random Forest model.
  5. **GIS Delivery:** Classified events and multi-criteria evidence are served via GeoJSON REST endpoints to the React Leaflet frontend.
- **Narrative:**
  > *"The entire pipeline is automated, containerized with Docker Compose, and capable of processing thousands of raw satellite records into classified geospatial intelligence in seconds."*

---

## 4 Authentic Demo Presets for Quick Testing

During the presentation, evaluators can click any of these 4 preset events:

| Event ID | Name / Location | Coordinates | Ground Truth / Target Class | Key Features |
|---|---|---|---|---|
| **`1001`** | **Jamnagar Petrochemical Complex** | `22.4782°N, 70.0612°E` | **Industrial Fire** (96% Conf) | FRP 68.4 MW, 42 days persistence, 1.26 km to industrial zone |
| **`1004`** | **Mumbai Trombay Industrial Corridor** | `19.0125°N, 72.8950°E` | **Industrial Fire** (97% Conf) | FRP 82.5 MW, 65 days persistence, 142 scans, near storage tanks |
| **`1013`** | **Jharia Coalfield Subsurface Smolder** | `23.7540°N, 86.4150°E` | **Persistent Thermal Source** (95% Conf) | 178 days persistence, 350 scans, 28.4 MW steady thermal emission |
| **`1021`** | **Punjab Stubble Crop Residue Burn** | `30.3420°N, 75.8210°E` | **Natural Fire** (82% Conf) | 2 days duration, 3 scans, distant from industrial zones (>15 km) |

---

## Anticipated Evaluator Questions & Defensible Answers

### Q1: "How do you distinguish an industrial flare stack from an uncontrolled industrial fire?"
> **Answer:** *"Satellite thermal data detects thermal radiation (FRP) and persistence. A flare stack typically exhibits stable, recurring night-time thermal signatures over months, whereas an uncontrolled structural fire exhibits sudden exponential FRP spikes, abnormal brightness temperature ratios, and adjacent non-flare infrastructure proximity. Our system classifies permanent emitters as 'Persistent Thermal Sources' and sudden high-FRP uncontained events as 'Industrial Fires'. However, in accordance with our scientific transparency guidelines, definitive ground truth requires UAV or physical inspection."*

### Q2: "Why did you use Random Forest instead of Deep Learning / CNNs?"
> **Answer:** *"Thermal satellite active fire data from FIRMS is tabular (point coordinates, radiative power, temperature, persistence, and spatial distances), not raw imagery rasters. For structured tabular geospatial features, ensemble tree models (Random Forest, XGBoost) consistently outperform deep learning models in precision, avoid overfitting on small minority classes, require 100x less compute, and allow full feature importance explainability."*

### Q3: "Does your spatial correlation slow down when processing 140,000 infrastructure points?"
> **Answer:** *"No. We implemented a two-tier spatial indexing architecture: in PostGIS, we use two-dimensional GIST R-Tree spatial indices (`ST_DWithin`); in our Node memory engine, we use categorized bounding-box candidate pruning. Spatial correlation of an event against all 139,682 assets executes in under 2 milliseconds."*

### Q4: "What happens if cloud cover obscures the satellite?"
> **Answer:** *"Cloud cover and heavy smoke attenuate thermal infrared signals. This is an inherent physical limitation of optical/IR remote sensing. Our system mitigates this by tracking multi-day persistence over repeated satellite orbits (VIIRS passes twice daily) rather than relying on a single snapshot."*

---

## Demonstration Checklist

- [ ] Docker containers running (`docker compose ps` shows 4 healthy containers).
- [ ] Browser open to `http://localhost:3000` (or `http://localhost:5173`).
- [ ] Sound/projector resolution verified (1920x1080 recommended).
- [ ] Satellite base layer tiles pre-cached by browsing Jamnagar/Mumbai regions once.
- [ ] Preset Event IDs noted: `1001` (Industrial), `1013` (Persistent), `1021` (Natural).
