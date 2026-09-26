#!/usr/bin/env python3
"""
Independent Model Evaluation Script — Phase 6
Evaluates a trained model checkpoint against the held-out test set.
Computes accuracy, precision, recall, F1, per-class metrics, and confusion matrix.
"""

import sys
import json
from pathlib import Path
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

ORDERED_FEATURE_NAMES = [
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

def resolve_data_path() -> Path:
    candidates = [
        Path(__file__).resolve().parent.parent / "data" / "fire_dataset.csv.xls",
        Path.cwd() / "data" / "fire_dataset.csv.xls",
        Path.cwd().parent / "data" / "fire_dataset.csv.xls"
    ]
    for c in candidates:
        if c.exists():
            return c
    raise FileNotFoundError("Could not find data/fire_dataset.csv.xls")

def main():
    model_path = Path(__file__).resolve().parent / "model" / "fire_type_model.pkl"
    if len(sys.argv) > 1:
        model_path = Path(sys.argv[1])

    if not model_path.exists():
        print(f"[ERROR] Model file not found: {model_path}")
        sys.exit(1)

    print(f"[INFO] Loading model from: {model_path}")
    model = joblib.load(model_path)

    data_path = resolve_data_path()
    print(f"[INFO] Loading test data from: {data_path}")
    df = pd.read_csv(data_path)

    X = df[ORDERED_FEATURE_NAMES]
    y = df["fire_type"]

    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    print(f"[INFO] Evaluating model on {len(X_test):,} held-out test samples...")
    preds = model.predict(X_test)
    acc = accuracy_score(y_test, preds)

    print("\n" + "=" * 65)
    print(f"  HELD-OUT TEST SET EVALUATION REPORT (N={len(X_test):,})")
    print("=" * 65)
    print(f"Overall Accuracy: {acc * 100:.2f}%\n")
    print(classification_report(y_test, preds, labels=model.classes_, digits=4))

    cm = confusion_matrix(y_test, preds, labels=model.classes_)
    print("Confusion Matrix:")
    print(f"Classes: {list(model.classes_)}")
    for i, row in enumerate(cm):
        print(f"  {model.classes_[i]:26s}: {row.tolist()}")
    print("=" * 65)

if __name__ == "__main__":
    main()
