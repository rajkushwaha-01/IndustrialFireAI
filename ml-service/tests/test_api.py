import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas import ORDERED_FEATURE_NAMES

client = TestClient(app)

# Real authoritative samples extracted directly from data/fire_dataset.csv.xls
REAL_SAMPLE_INDUSTRIAL_FIRE = {
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

REAL_SAMPLE_PERSISTENT_SOURCE = {
    "persistence_days": 179.0,
    "detections": 551,
    "avg_frp": 5.626933,
    "max_frp": 28.09,
    "total_frp": 3100.44,
    "avg_bright_ti4": 327.268621,
    "avg_bright_ti5": 296.089238,
    "night_ratio": 0.718693,
    "distance_to_industrial_area_km": 1.2339,
    "distance_to_power_plant_km": 8.0146,
    "distance_to_quarry_km": 52.6206,
    "distance_to_substation_km": 1.545,
    "distance_to_storage_tank_km": 1.0637,
    "distance_to_works_km": 5.1657
}

REAL_SAMPLE_NATURAL_FIRE = {
    "persistence_days": 77.0,
    "detections": 186,
    "avg_frp": 4.305484,
    "max_frp": 12.37,
    "total_frp": 800.82,
    "avg_bright_ti4": 329.004624,
    "avg_bright_ti5": 296.511505,
    "night_ratio": 0.537634,
    "distance_to_industrial_area_km": 1.7987,
    "distance_to_power_plant_km": 8.8341,
    "distance_to_quarry_km": 0.4856,
    "distance_to_substation_km": 4.1463,
    "distance_to_storage_tank_km": 5.3568,
    "distance_to_works_km": 55.3331
}

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "industrial-fire-ml-service"
    assert data["model_loaded"] is True
    assert data["model_type"] == "RandomForestClassifier"
    assert data["feature_count"] == 14
    assert data["expected_features"] == ORDERED_FEATURE_NAMES
    assert set(data["classes"]) == {
        "Industrial Fire", "Natural Fire", "Other", "Persistent Thermal Source"
    }

def test_model_info_endpoint():
    response = client.get("/model-info")
    assert response.status_code == 200
    data = response.json()
    assert data["model_type"] == "RandomForestClassifier"
    assert data["n_estimators"] == 200
    assert len(data["feature_names"]) == 14
    assert data["feature_names"] == ORDERED_FEATURE_NAMES
    assert len(data["classes"]) == 4

def test_predict_industrial_fire_sample():
    response = client.post("/predict", json=REAL_SAMPLE_INDUSTRIAL_FIRE)
    assert response.status_code == 200
    data = response.json()
    
    assert "prediction" in data
    assert "confidence" in data
    assert "probabilities" in data
    
    # Must be valid class
    assert data["prediction"] in [
        "Industrial Fire", "Natural Fire", "Other", "Persistent Thermal Source"
    ]
    assert 0.0 <= data["confidence"] <= 1.0
    
    # Probabilities should contain all 4 classes and sum to ~1.0
    probs = data["probabilities"]
    assert set(probs.keys()) == {
        "Industrial Fire", "Natural Fire", "Other", "Persistent Thermal Source"
    }
    total_prob = sum(probs.values())
    assert abs(total_prob - 1.0) < 0.01

def test_predict_persistent_source_sample():
    response = client.post("/predict", json=REAL_SAMPLE_PERSISTENT_SOURCE)
    assert response.status_code == 200
    data = response.json()
    assert data["prediction"] in [
        "Industrial Fire", "Natural Fire", "Other", "Persistent Thermal Source"
    ]
    assert data["confidence"] > 0.5

def test_predict_natural_fire_sample():
    response = client.post("/predict", json=REAL_SAMPLE_NATURAL_FIRE)
    assert response.status_code == 200
    data = response.json()
    assert data["prediction"] in [
        "Industrial Fire", "Natural Fire", "Other", "Persistent Thermal Source"
    ]

def test_validation_rejects_missing_field():
    # Payload missing 'distance_to_works_km'
    incomplete = REAL_SAMPLE_INDUSTRIAL_FIRE.copy()
    del incomplete["distance_to_works_km"]
    response = client.post("/predict", json=incomplete)
    assert response.status_code == 422

def test_validation_rejects_non_numeric():
    invalid = REAL_SAMPLE_INDUSTRIAL_FIRE.copy()
    invalid["avg_frp"] = "not_a_number"
    response = client.post("/predict", json=invalid)
    assert response.status_code == 422

def test_validation_rejects_invalid_night_ratio():
    invalid = REAL_SAMPLE_INDUSTRIAL_FIRE.copy()
    invalid["night_ratio"] = 1.8  # Must be between 0.0 and 1.0
    response = client.post("/predict", json=invalid)
    assert response.status_code == 422

def test_validation_rejects_negative_detections():
    invalid = REAL_SAMPLE_INDUSTRIAL_FIRE.copy()
    invalid["detections"] = 0  # Must be >= 1
    response = client.post("/predict", json=invalid)
    assert response.status_code == 422

def test_validation_rejects_extra_fields():
    invalid = REAL_SAMPLE_INDUSTRIAL_FIRE.copy()
    invalid["fabricated_metric"] = 999.0  # Extra field forbidden
    response = client.post("/predict", json=invalid)
    assert response.status_code == 422
