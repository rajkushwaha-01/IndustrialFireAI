#!/usr/bin/env python3
"""
Reproducible Model Training & Evaluation Pipeline — Phase 6
Smart India Hackathon (SIH) Problem Statement 26162 (NTRO)
AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources

Pipeline:
1. Load dataset (data/fire_dataset.csv.xls)
2. Verify feature schema & integrity (14 features)
3. Stratified 80/20 train/test split (random_state=42)
4. Train regularized, class-balanced RandomForestClassifier
5. Comprehensive evaluation on held-out test set (N=44,806)
6. Export model binary (model/fire_type_model.pkl) and metadata (model/model_metadata.json)
"""

import os
import sys
import time
import json
import shutil
from pathlib import Path
from datetime import datetime, timezone

import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    classification_report,
    confusion_matrix
)

# 14 Canonical Input Features
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

TARGET_COLUMN = "fire_type"

def resolve_data_path() -> Path:
    candidates = [
        Path(__file__).resolve().parent.parent / "data" / "fire_dataset.csv.xls",
        Path.cwd() / "data" / "fire_dataset.csv.xls",
        Path.cwd().parent / "data" / "fire_dataset.csv.xls"
    ]
    for c in candidates:
        if c.exists():
            return c
    raise FileNotFoundError("Could not find data/fire_dataset.csv.xls in standard project paths.")

def main():
    print("=" * 70)
    print("  INDUSTRIAL FIRE AI — REPRODUCIBLE ML TRAINING PIPELINE (PHASE 6)")
    print("=" * 70)
    start_time = time.time()

    data_path = resolve_data_path()
    print(f"\n[1/6] Loading dataset from: {data_path}")
    df = pd.read_csv(data_path)
    total_records = len(df)
    print(f"      Loaded {total_records:,} records, {len(df.columns)} columns.")

    # Validate required columns
    missing_features = [f for f in ORDERED_FEATURE_NAMES if f not in df.columns]
    if missing_features:
        raise ValueError(f"Missing required features in dataset: {missing_features}")
    if TARGET_COLUMN not in df.columns:
        raise ValueError(f"Missing target column '{TARGET_COLUMN}' in dataset.")

    # Class distribution analysis
    class_counts = df[TARGET_COLUMN].value_counts().to_dict()
    class_pcts = (df[TARGET_COLUMN].value_counts(normalize=True) * 100).to_dict()
    print("\n[2/6] Dataset Class Distribution:")
    for cls, count in class_counts.items():
        print(f"      - {cls:26s}: {count:6,} ({class_pcts[cls]:5.2f}%)")

    # Data Leakage & Feature Guardrail Audit
    print("\n[3/6] Data Leakage & Feature Audit:")
    leaked_candidates = ["prediction_class", "prediction_confidence"]
    for lc in leaked_candidates:
        if lc in df.columns:
            print(f"      [CONFIRMED GUARD] Column '{lc}' exists in CSV but is EXCLUDED from training features.")

    X = df[ORDERED_FEATURE_NAMES].copy()
    y = df[TARGET_COLUMN].copy()

    # Stratified Train/Test Split
    test_ratio = 0.20
    random_state = 42
    print(f"\n[4/6] Creating Stratified Split ({int((1-test_ratio)*100)}% Train / {int(test_ratio*100)}% Held-Out Test)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_ratio, random_state=random_state, stratify=y
    )
    print(f"      Train Set Size:    {len(X_train):,} samples")
    print(f"      Held-Out Test Size: {len(X_test):,} samples")

    # Hyperparameters
    hyperparams = {
        "n_estimators": 150,
        "max_depth": 22,
        "min_samples_split": 4,
        "min_samples_leaf": 2,
        "max_features": "sqrt",
        "class_weight": {
            "Other": 1.0,
            "Natural Fire": 1.8,
            "Persistent Thermal Source": 3.8,
            "Industrial Fire": 3.2
        },
        "bootstrap": True,
        "random_state": random_state,
        "n_jobs": -1
    }

    print("\n[5/6] Training Regularized & Weighted RandomForestClassifier...")
    print(f"      - Estimators:        {hyperparams['n_estimators']}")
    print(f"      - Max Depth:         {hyperparams['max_depth']}")
    print(f"      - Class Weights:     {hyperparams['class_weight']}")
    
    clf = RandomForestClassifier(**hyperparams)
    fit_start = time.time()
    clf.fit(X_train, y_train)
    fit_duration = time.time() - fit_start
    print(f"      Training completed in {fit_duration:.2f} seconds.")

    # Held-Out Evaluation
    print("\n[6/6] Evaluating on Held-Out Test Set (N=44,806)...")
    y_pred = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)

    acc = accuracy_score(y_test, y_pred)
    report_dict = classification_report(y_test, y_pred, output_dict=True, digits=4)
    report_text = classification_report(y_test, y_pred, digits=4)
    cm = confusion_matrix(y_test, y_pred, labels=clf.classes_)

    print("\n" + "=" * 70)
    print("                HELD-OUT TEST SET EVALUATION REPORT")
    print("=" * 70)
    print(f"Overall Accuracy: {acc * 100:.2f}%\n")
    print(report_text)
    print("Confusion Matrix (rows: True Class, cols: Predicted Class):")
    print(f"Classes: {list(clf.classes_)}")
    for i, row in enumerate(cm):
        print(f"  {clf.classes_[i]:26s}: {row.tolist()}")
    print("=" * 70)

    # Feature Importances
    importances = dict(zip(ORDERED_FEATURE_NAMES, [round(float(v), 5) for v in clf.feature_importances_]))
    sorted_importances = sorted(importances.items(), key=lambda x: x[1], reverse=True)
    print("\nTop Feature Importances:")
    for feat, imp in sorted_importances[:6]:
        print(f"  - {feat:30s}: {imp * 100:5.2f}%")

    # Target output paths
    model_dir = Path(__file__).resolve().parent / "model"
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "fire_type_model.pkl"
    legacy_backup_path = model_dir / "fire_type_model_legacy_v1.pkl"

    # Backup legacy model if not already backed up
    if model_path.exists() and not legacy_backup_path.exists():
        shutil.copy2(model_path, legacy_backup_path)
        print(f"\n[INFO] Backed up legacy model to: {legacy_backup_path}")

    # Export newly trained model
    joblib.dump(clf, model_path, compress=3)
    file_size_mb = model_path.stat().st_size / (1024 * 1024)
    print(f"[INFO] Saved regularized model to: {model_path} ({file_size_mb:.2f} MB)")

    # Export structured model metadata
    metadata = {
        "model_version": "2.0.0",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "algorithm": "RandomForestClassifier",
        "scikit_learn_version": "1.9.1",
        "dataset": {
            "name": "fire_dataset.csv.xls",
            "total_records": total_records,
            "train_samples": len(X_train),
            "test_samples": len(X_test),
            "test_ratio": test_ratio,
            "class_distribution": class_counts,
            "class_proportions": class_pcts
        },
        "features": {
            "count": len(ORDERED_FEATURE_NAMES),
            "names": ORDERED_FEATURE_NAMES,
            "importances": importances
        },
        "classes": list(clf.classes_),
        "hyperparameters": {
            "n_estimators": hyperparams["n_estimators"],
            "max_depth": hyperparams["max_depth"],
            "min_samples_split": hyperparams["min_samples_split"],
            "min_samples_leaf": hyperparams["min_samples_leaf"],
            "max_features": hyperparams["max_features"],
            "class_weight": hyperparams["class_weight"],
            "bootstrap": hyperparams["bootstrap"],
            "random_state": hyperparams["random_state"]
        },
        "evaluation": {
            "evaluated_on": "Stratified Held-Out Test Set",
            "test_size": len(X_test),
            "overall_accuracy": round(float(acc), 4),
            "macro_avg": {
                "precision": round(float(report_dict["macro avg"]["precision"]), 4),
                "recall": round(float(report_dict["macro avg"]["recall"]), 4),
                "f1_score": round(float(report_dict["macro avg"]["f1-score"]), 4)
            },
            "weighted_avg": {
                "precision": round(float(report_dict["weighted avg"]["precision"]), 4),
                "recall": round(float(report_dict["weighted avg"]["recall"]), 4),
                "f1_score": round(float(report_dict["weighted avg"]["f1-score"]), 4)
            },
            "per_class": {
                cls: {
                    "precision": round(float(report_dict[cls]["precision"]), 4),
                    "recall": round(float(report_dict[cls]["recall"]), 4),
                    "f1_score": round(float(report_dict[cls]["f1-score"]), 4),
                    "support": int(report_dict[cls]["support"])
                }
                for cls in clf.classes_
            },
            "confusion_matrix": {
                "classes": list(clf.classes_),
                "matrix": cm.tolist()
            }
        },
        "limitations_and_assumptions": [
            "Dataset fire_dataset.csv.xls lacks raw coordinates and uses heuristic pseudo-labels.",
            "Strong class imbalance: positive classes comprise only 2.43% of total data.",
            "Model is calibrated for multi-modal spatial context but must be verified with optical satellite imagery."
        ]
    }

    metadata_path = model_dir / "model_metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"[INFO] Saved comprehensive metadata to: {metadata_path}")

    total_duration = time.time() - start_time
    print(f"\n[DONE] Pipeline completed in {total_duration:.2f} seconds.")

if __name__ == "__main__":
    main()
