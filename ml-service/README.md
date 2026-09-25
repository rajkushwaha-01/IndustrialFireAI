# ML Inference Service (FastAPI)

This service provides machine learning inference for Problem Statement 26162 (NTRO), loading the pre-trained, authoritative `fire_type_model.pkl` via `joblib`.

## Authoritative Model
- **File:** `model/fire_type_model.pkl`
- **Algorithm:** `RandomForestClassifier` (200 estimators)
- **Status:** Loaded directly via `joblib.load()`. Zero retraining or modifying.
- **Classes:**
  - `Industrial Fire`
  - `Natural Fire`
  - `Other`
  - `Persistent Thermal Source`

## Features (Ordered Feature Vector)
The 14 features are explicitly constructed in the exact order expected by the model:
1. `persistence_days` (float >= 0)
2. `detections` (int >= 1)
3. `avg_frp` (float >= 0)
4. `max_frp` (float >= 0)
5. `total_frp` (float >= 0)
6. `avg_bright_ti4` (float > 0, Kelvin)
7. `avg_bright_ti5` (float > 0, Kelvin)
8. `night_ratio` (float 0.0 to 1.0)
9. `distance_to_industrial_area_km` (float >= 0)
10. `distance_to_power_plant_km` (float >= 0)
11. `distance_to_quarry_km` (float >= 0)
12. `distance_to_substation_km` (float >= 0)
13. `distance_to_storage_tank_km` (float >= 0)
14. `distance_to_works_km` (float >= 0)

## API Endpoints

### 1. `GET /health`
Returns service and model load health:
```json
{
  "status": "ok",
  "service": "industrial-fire-ml-service",
  "version": "1.0.0",
  "model_loaded": true,
  "model_type": "RandomForestClassifier",
  "classes": ["Industrial Fire", "Natural Fire", "Other", "Persistent Thermal Source"],
  "feature_count": 14,
  "expected_features": [...],
  "timestamp": "..."
}
```

### 2. `GET /model-info`
Returns model inspection details:
```json
{
  "model_type": "RandomForestClassifier",
  "n_estimators": 200,
  "feature_names": [
    "persistence_days", "detections", "avg_frp", "max_frp", "total_frp",
    "avg_bright_ti4", "avg_bright_ti5", "night_ratio",
    "distance_to_industrial_area_km", "distance_to_power_plant_km",
    "distance_to_quarry_km", "distance_to_substation_km",
    "distance_to_storage_tank_km", "distance_to_works_km"
  ],
  "classes": ["Industrial Fire", "Natural Fire", "Other", "Persistent Thermal Source"]
}
```

### 3. `POST /predict`
Executes classification using the authoritative Random Forest model.

**Sample Input Payload:**
```json
{
  "persistence_days": 77.0,
  "detections": 244,
  "avg_frp": 2.778033,
  "max_frp": 10.25,
  "total_frp": 677.84,
  "avg_bright_ti4": 316.973525,
  "avg_bright_ti5": 292.503484,
  "night_ratio": 0.827869,
  "distance_to_industrial_area_km": 1.2568,
  "distance_to_power_plant_km": 9.1787,
  "distance_to_quarry_km": 1.2721,
  "distance_to_substation_km": 3.4375,
  "distance_to_storage_tank_km": 3.1084,
  "distance_to_works_km": 29.3907
}
```

**Response Format:**
```json
{
  "prediction": "Industrial Fire",
  "confidence": 0.83,
  "probabilities": {
    "Industrial Fire": 0.83,
    "Natural Fire": 0.0,
    "Other": 0.0,
    "Persistent Thermal Source": 0.17
  }
}
```

## Strict Pydantic Validation
- Missing fields return `HTTP 422 Unprocessable Entity`.
- Non-numeric or invalid types return `HTTP 422 Unprocessable Entity`.
- Negative detections or out-of-range night ratios return `HTTP 422 Unprocessable Entity`.
- Extra, unexpected fields are strictly forbidden (`extra="forbid"`) to avoid fabricated input vectors.

## Running Tests
Run the comprehensive automated test suite with pytest:
```bash
.\venv\Scripts\python.exe -m pytest tests/ -v
```
All 10 tests validate health, model info, real authoritative sample predictions, and schema constraint enforcement.
