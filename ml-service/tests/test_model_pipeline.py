import pytest
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

from app.model_loader import load_model, get_model_path, MODEL_METADATA
from app.schemas import ORDERED_FEATURE_NAMES
from app.evidence import compute_evidence
from evaluate import resolve_data_path

def test_model_loading():
    """Verify model file exists, loads with joblib, and matches expected Scikit-Learn class."""
    model_path = get_model_path()
    assert model_path.exists(), f"Model file must exist at {model_path}"

    model = joblib.load(model_path)
    assert isinstance(model, RandomForestClassifier), "Model must be a RandomForestClassifier instance"
    assert model.n_estimators == 150, "Model must have 150 estimators"
    assert hasattr(model, "classes_"), "Model must have classes_ attribute"
    assert len(model.classes_) == 4, "Model must have 4 output classes"
    assert set(model.classes_) == {
        "Industrial Fire", "Persistent Thermal Source", "Natural Fire", "Other"
    }

def test_feature_compatibility():
    """Verify feature count, exact names, order, and shape compatibility with model."""
    model = load_model()
    assert model is not None, "Model must be loaded"

    # Exact 14 features in mandatory order
    assert len(ORDERED_FEATURE_NAMES) == 14, "Feature list must contain exactly 14 features"
    assert model.n_features_in_ == 14, "Model must accept exactly 14 features"

    expected_features = [
        "persistence_days",
        "detections",
        "avg_frp",
        "max_frp",
        "total_frp",
        "avg_bright_ti4",
        "avg_bright_ti5",
        "night_ratio",
        "distance_to_industrial_area_km",
        "distance_to_power_plant_km",
        "distance_to_quarry_km",
        "distance_to_substation_km",
        "distance_to_storage_tank_km",
        "distance_to_works_km"
    ]
    assert ORDERED_FEATURE_NAMES == expected_features, "Feature names and order must match canonical list"

    # Shape compatibility test with NumPy array (1, 14)
    dummy_input = np.ones((1, 14), dtype=np.float64)
    pred = model.predict(dummy_input)
    assert len(pred) == 1, "Prediction must return one output per sample"
    assert pred[0] in model.classes_, "Prediction must belong to model classes"

    probs = model.predict_proba(dummy_input)
    assert probs.shape == (1, 4), "Probability matrix must have shape (1, 4)"
    assert np.isclose(np.sum(probs[0]), 1.0), "Class probabilities must sum to 1.0"

def test_prediction_and_evidence():
    """Verify inference output, class probabilities, and multi-source evidence extraction."""
    model = load_model()
    assert model is not None

    sample_dict = {
        "persistence_days": 42.0,
        "detections": 88,
        "avg_frp": 68.4,
        "max_frp": 68.4,
        "total_frp": 68.4,
        "avg_bright_ti4": 365.2,
        "avg_bright_ti5": 300.0,
        "night_ratio": 0.5,
        "distance_to_industrial_area_km": 0.5,
        "distance_to_power_plant_km": 12.0,
        "distance_to_quarry_km": 8.0,
        "distance_to_substation_km": 1.1,
        "distance_to_storage_tank_km": 0.8,
        "distance_to_works_km": 2.5
    }

    feature_values = [sample_dict[name] for name in ORDERED_FEATURE_NAMES]
    X = np.array([feature_values], dtype=np.float64)

    pred = model.predict(X)[0]
    probs = model.predict_proba(X)[0]
    prob_map = {cls: float(probs[i]) for i, cls in enumerate(model.classes_)}
    confidence = float(np.max(probs))

    assert pred in model.classes_
    assert 0.0 <= confidence <= 1.0
    assert abs(sum(prob_map.values()) - 1.0) < 1e-4

    # Test evidence generation
    evidence = compute_evidence(sample_dict, pred, confidence, prob_map)
    ev_dict = evidence.model_dump()
    assert ev_dict["classification"] == pred
    assert len(ev_dict["factors"]) >= 4
    assert "scientific_disclaimer" in ev_dict
    assert "thermal" in ev_dict
    assert "spatial" in ev_dict
    assert "temporal" in ev_dict

def test_evaluation_pipeline():
    """Verify evaluation pipeline on held-out test data."""
    data_path = resolve_data_path()
    assert data_path.exists(), f"Dataset must exist at {data_path}"

    df = pd.read_csv(data_path)
    assert len(df) > 10000, "Dataset must have sufficient records for evaluation"

    X = df[ORDERED_FEATURE_NAMES]
    y = df["fire_type"]

    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    model = load_model()
    assert model is not None

    preds = model.predict(X_test)
    acc = accuracy_score(y_test, preds)

    # Scientific assertion: Model accuracy must be genuine and >= 90%
    assert acc >= 0.90, f"Model accuracy on held-out test set must be >= 90%, got {acc * 100:.2f}%"

    cm = confusion_matrix(y_test, preds, labels=model.classes_)
    assert cm.shape == (4, 4), "Confusion matrix must be 4x4"
    assert cm.sum() == len(X_test), "Confusion matrix sum must equal test set size"
