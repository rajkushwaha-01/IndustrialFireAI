# ML Model Card: Industrial Fire & Persistent Thermal Source Classifier

**Document Version:** 2.0.0  
**Problem Statement ID:** 26162  
**Organization:** National Technical Research Organisation (NTRO)  
**System Title:** AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data  
**Model Name:** `fire_type_model.pkl`  
**Model Family:** Scikit-Learn `RandomForestClassifier`  
**Training Pipeline:** [`ml-service/train.py`](file:///c:/Users/rajku/Desktop/SIH-PS-2/IndustrialFireAI/ml-service/train.py)  
**Evaluation Suite:** [`ml-service/evaluate.py`](file:///c:/Users/rajku/Desktop/SIH-PS-2/IndustrialFireAI/ml-service/evaluate.py)  
**Metadata Artifact:** [`ml-service/model/model_metadata.json`](file:///c:/Users/rajku/Desktop/SIH-PS-2/IndustrialFireAI/ml-service/model/model_metadata.json)  

---

## 1. Executive Summary & Defensibility Statement

The goal of Phase 6 is to establish **scientific and technical defensibility** for the Machine Learning component of SIH PS 26162. Prior to this phase, the project utilized an unconstrained 208 MB Random Forest pickle trained without a documented validation methodology, suffering from hidden failure modes on minority classes despite high nominal accuracy.

Through systematic empirical audit, this document establishes:
1. **Full Transparency:** Complete documentation of all 10 diagnostic dimensions of data and modeling.
2. **Data Leakage Clearance:** Verification that no label-derived or predictive columns contaminate model inputs.
3. **Honest Metric Reporting:** Rejection of misleading overall accuracy metrics that mask catastrophic failure on critical minority classes (e.g. unweighted legacy recall of only 30.8% on Persistent Thermal Sources).
4. **Weak Labeling Acknowledgment:** Clear scientific documentation that the underlying training labels were heuristically generated rather than field-verified ground truth.
5. **Controlled Retraining:** Replacement of the overfit 208 MB legacy artifact with a regularized, class-weighted 27.6 MB model that increases minority class recall while maintaining 100% backwards compatibility with the prediction API.

---

## 2. Comprehensive Model & Data Diagnostic Audit

### 2.1 Dataset Size
- **Total Records:** 224,029 fire event records
- **Primary Source File:** [`data/fire_dataset.csv.xls`](file:///c:/Users/rajku/Desktop/SIH-PS-2/IndustrialFireAI/data/fire_dataset.csv.xls) (TSV/CSV format)
- **Train Set Size (80% Stratified):** 179,223 samples
- **Held-Out Test Set Size (20% Stratified):** 44,806 samples

### 2.2 Number of Classes
- **Class Count:** 4 distinct classification categories
- **Target Variable:** `fire_type`

### 2.3 Class Distribution & Class Imbalance Ratio

| Class Index | Class Name | Total Sample Count | Percentage of Dataset | Imbalance Ratio vs Majority |
|:---:|:---|---:|---:|:---:|
| 0 | **Other** | 193,637 | 86.434% | 1 : 1.0 (Majority) |
| 1 | **Natural Fire** | 24,935 | 11.130% | 1 : 7.8 |
| 2 | **Persistent Thermal Source** | 3,052 | 1.362% | 1 : 63.4 |
| 3 | **Industrial Fire** | 2,405 | 1.074% | 1 : 80.5 |
| **Total** | — | **224,029** | **100.0%** | — |

> [!WARNING]
> **Severe Class Imbalance Risk:** The dataset is dominated by `Other` (86.43%). In high-imbalance regimes, naive accuracy is a deceptive metric. A naive "dummy" model that predicts `Other` for 100% of samples would achieve **86.43% accuracy** while offering zero operational detection value to NTRO.

### 2.4 Feature List
The model operates strictly on 14 numerical features derived from satellite radiometry and geospatial infrastructure proximity:

| # | Feature Name | Description | Unit | Range / Constraints |
|:---:|:---|:---|:---:|:---:|
| 1 | `persistence_days` | Number of days fire anomaly persisted in spatial cluster | Days | $\ge 0.0$ |
| 2 | `detections` | Total count of satellite detections in cluster | Count | $\ge 1$ |
| 3 | `avg_frp` | Mean Fire Radiative Power | MW | $\ge 0.0$ |
| 4 | `max_frp` | Peak Fire Radiative Power | MW | $\ge 0.0$ |
| 5 | `total_frp` | Cumulative Fire Radiative Power | MW | $\ge 0.0$ |
| 6 | `avg_bright_ti4` | VIIRS I-4 (3.75 µm) Brightness Temperature | Kelvin | $> 0.0$ |
| 7 | `avg_bright_ti5` | VIIRS I-5 (11.0 µm) Brightness Temperature | Kelvin | $> 0.0$ |
| 8 | `night_ratio` | Ratio of night-time satellite overpass detections | Ratio | $[0.0, 1.0]$ |
| 9 | `distance_to_industrial_area_km` | Geodesic distance to nearest OSM industrial zone | km | $\ge 0.0$ |
| 10 | `distance_to_power_plant_km` | Geodesic distance to nearest power plant | km | $\ge 0.0$ |
| 11 | `distance_to_quarry_km` | Geodesic distance to nearest quarry / mining site | km | $\ge 0.0$ |
| 12 | `distance_to_substation_km` | Geodesic distance to nearest electrical substation | km | $\ge 0.0$ |
| 13 | `distance_to_storage_tank_km` | Geodesic distance to nearest fuel/gas storage tank | km | $\ge 0.0$ |
| 14 | `distance_to_works_km` | Geodesic distance to nearest industrial manufacturing works | km | $\ge 0.0$ |

### 2.5 Label Source & Limitation
- **Provenance:** The dataset `fire_dataset.csv.xls` was assembled from aggregated FIRMS cluster statistics cross-referenced with synthetic or heuristic classification labels.
- **Weak Supervision Limitation:** The labels in this historical dataset were generated through a heuristic decision rule (e.g., thresholding persistence, night ratio, and distance to industrial zones) rather than verified on-the-ground industrial fire reports or audited satellite sensor logs.
- **Scientific Implication:** High test accuracy indicates that the model has successfully learned the underlying heuristic mapping; it does **not** guarantee 96% real-world detection fidelity during live operational deployment without continual field-validation feedback.

### 2.6 Train / Test Methodology
- **Split Ratio:** 80% Training ($N=179,223$) and 20% Held-Out Testing ($N=44,806$).
- **Stratification:** Mandatory stratified split on target label `fire_type` using `sklearn.model_selection.train_test_split(..., stratify=y, random_state=42)`. This guarantees that minority classes (`Industrial Fire`: 481 test samples; `Persistent Thermal Source`: 610 test samples) are represented in exact proportions in the test set.
- **Strict Separation:** Test set is completely isolated prior to model fitting and used exclusively for post-training generalization evaluation.

### 2.7 Preprocessing
- **Type Casting:** Strict validation and conversion of all 14 input fields to 64-bit IEEE floating-point numbers.
- **Feature Ordering:** Deterministic alignment to `ORDERED_FEATURE_NAMES` via `payload.to_feature_vector()` to eliminate dict-ordering inconsistencies.
- **Scale Invariance:** Because Random Forest decision trees rely on invariant monotonic split points, numerical feature scaling (such as Z-score standardization or MinMax) is omitted to preserve original physical units (Kelvin, Megawatts, Kilometers) without numerical distortion.

### 2.8 Missing-Value Handling
- **API Ingestion:** Missing values in prediction payloads are strictly forbidden by Pydantic schemas (`FireFeaturesInput`), returning HTTP `422 Unprocessable Entity`.
- **Dataset Cleanliness:** Static training dataset exhibits 0 missing values across all 14 feature columns.
- **Zero-Imputation Policy:** Imputing zeros for distances is strictly prohibited, as a distance of `0.0 km` represents direct spatial intersection with high-risk infrastructure.

### 2.9 Class Imbalance Strategy
To counteract the 63:1 and 80:1 class imbalance without generating synthetic artifacts (such as SMOTE noise on physical distance features), a tuned cost-sensitive loss was applied:
- `Other`: Weight 1.0 (baseline)
- `Natural Fire`: Weight 1.8
- `Industrial Fire`: Weight 3.2
- `Persistent Thermal Source`: Weight 3.8

### 2.10 Model Hyperparameters (v2.0.0 Regularized)

```python
RandomForestClassifier(
    n_estimators=150,
    max_depth=22,
    min_samples_split=4,
    min_samples_leaf=2,
    max_features='sqrt',
    bootstrap=True,
    class_weight={
        'Other': 1.0, 
        'Natural Fire': 1.8, 
        'Persistent Thermal Source': 3.8, 
        'Industrial Fire': 3.2
    },
    random_state=42,
    n_jobs=-1
)
```

---

## 3. Data Leakage Audit

### 3.1 Direct Label Leakage Investigation
The training data file [`data/fire_dataset.csv.xls`](file:///c:/Users/rajku/Desktop/SIH-PS-2/IndustrialFireAI/data/fire_dataset.csv.xls) contains 17 columns:
1. `persistence_days`
2. `detections`
3. `avg_frp`
4. `max_frp`
5. `total_frp`
6. `avg_bright_ti4`
7. `avg_bright_ti5`
8. `night_ratio`
9. `distance_to_industrial_area_km`
10. `distance_to_power_plant_km`
11. `distance_to_quarry_km`
12. `distance_to_substation_km`
13. `distance_to_storage_tank_km`
14. `distance_to_works_km`
15. `fire_type` *(Target Label)*
16. `prediction_class` *(Heuristic Artifact)*
17. `prediction_confidence` *(Heuristic Artifact)*

#### Audit Findings:
1. **Critical Guardrail:** Columns `prediction_class` and `prediction_confidence` in the raw CSV are 1:1 identical to `fire_type`. If included, they would cause **100% artificial data leakage**.
2. **Codebase Inspection:** Both `ml-service/app/schemas.py` and the training pipeline [`ml-service/train.py`](file:///c:/Users/rajku/Desktop/SIH-PS-2/IndustrialFireAI/ml-service/train.py) explicitly whitelist only the 14 genuine physical features and completely exclude `prediction_class` and `prediction_confidence`.
3. **Assertion Guard:** Automated assertion checks are embedded in `train.py` and `evaluate.py` to raise an immediate `AssertionError` if any target-derived column is included in the feature matrix $X$.
4. **Temporal / Geographic Leakage:** The 14 features represent aggregated spatial and radiometric statistics. Because events in this historical dataset do not carry unique temporal IDs or spatial coordinates, cross-temporal leakage across test folds is minimized, though spatial autocorrelation remains an inherent feature of clustered satellite hotspots.

---

## 4. Empirical Evaluation on Held-Out Test Set ($N=44,806$)

### 4.1 Comparison: Legacy Model (v1.0.0) vs Regularized Defensible Model (v2.0.0)

| Metric | Legacy Unweighted Model (v1.0.0) | Regularized Defensible Model (v2.0.0) | Delta / Assessment |
|:---|:---:|:---:|:---|
| **Model Disk Footprint** | 208 MB | **27.63 MB** | **86.7% size reduction**, eliminates RAM spikes |
| **Max Tree Depth** | Unlimited (`None`) | **22** | Prevents memorization of majority class noise |
| **Scikit-Learn Version** | 1.8.0 (deserialization mismatch) | **1.9.1** (clean environment build) | Zero deserialization warnings |
| **Overall Accuracy** | 96.62% | **96.50%** | Realistically stable on test set |
| **`Industrial Fire` Precision** | 82.51% | **84.51%** | +2.0% Precision gain |
| **`Industrial Fire` Recall** | 87.32% | **87.32%** | Maintained high sensitivity |
| **`Industrial Fire` F1-Score** | 0.8485 | **0.8589** | Robust performance |
| **`Persistent Thermal Source` Precision** | 68.61% | **66.23%** | Controlled false alarms |
| **`Persistent Thermal Source` Recall** | **30.82%** (Catastrophic) | **41.80%** | **+35.6% Relative Recall Improvement** |
| **`Persistent Thermal Source` F1-Score** | 0.4253 | **0.5126** | Significantly improved harmonic balance |
| **`Natural Fire` F1-Score** | 0.8550 | **0.8670** | High detection reliability |
| **`Other` F1-Score** | 0.9855 | **0.9855** | Clean background filtering |

> [!IMPORTANT]
> **Why the Legacy 96.62% Accuracy Was Scientifically Misleading:**
> In the legacy model, 422 out of 610 Persistent Thermal Sources in the held-out test set were misclassified as `Other` or `Natural Fire`. The legacy model silently missed **69.18% of persistent thermal anomalies**.
> By introducing depth regularization and cost-sensitive class weights, Model v2.0.0 successfully increases detection recall on Persistent Thermal Sources by **+35.6% relative**, making it substantially more operationally reliable for surveillance.

---

### 4.2 Comprehensive Classification Report (Model v2.0.0)

```
Test Set Size: 44,806 samples (Stratified 20% Held-Out)
Overall Accuracy: 96.50%

                           Precision    Recall  F1-Score   Support
          Industrial Fire     0.8451    0.8732    0.8589       481
             Natural Fire     0.8253    0.9132    0.8670     4,987
                    Other     0.9897    0.9814    0.9855    38,728
Persistent Thermal Source     0.6623    0.4180    0.5126       610

                 Accuracy                         0.9650    44,806
                Macro Avg     0.8306    0.7965    0.8060    44,806
             Weighted Avg     0.9654    0.9650    0.9645    44,806
```

---

### 4.3 Confusion Matrix Analysis

```
True Class \ Predicted Class   | Industrial Fire | Natural Fire |   Other   | Persistent Source | Total
-------------------------------|-----------------|--------------|-----------|-------------------|------
Industrial Fire                |       420       |       0      |     7     |         54        |   481
Natural Fire                   |         8       |    4,554     |   358     |         67        | 4,987
Other                          |         0       |      710     | 38,009    |          9        |38,728
Persistent Thermal Source      |        69       |      254     |    32     |        255        |   610
-------------------------------|-----------------|--------------|-----------|-------------------|------
Predicted Totals               |       497       |    5,518     | 38,406    |        385        |44,806
```

#### Diagnostic Breakdown:
- **`Industrial Fire`:** 420 out of 481 correctly classified ($87.3\%$). 54 instances were classified as `Persistent Thermal Source` due to overlapping multi-day persistence signatures in industrial estates. Only 7 were missed as `Other`.
- **`Natural Fire`:** High recall ($91.3\%$). Minor confusion with `Other` (358 cases) corresponding to low-FRP, single-detection events near urban borders.
- **`Persistent Thermal Source`:** 255 detected correctly ($41.8\%$). The primary source of false negatives is misclassification as `Natural Fire` (254 cases), which occurs when intermittent agricultural burning exhibits seasonal recurrence similar to flare persistence.

---

### 4.4 Feature Importances (Gini Impurity Reduction)

| Rank | Feature Name | Importance | Physical Interpretation |
|:---:|:---|---:|:---|
| 1 | `avg_bright_ti4` | **22.44%** | Primary VIIRS thermal channel; intense flare/furnace emission |
| 2 | `night_ratio` | **21.35%** | Industrial flares run 24/7; wild fires usually peak mid-day |
| 3 | `avg_bright_ti5` | **15.10%** | Background longwave thermal infrared channel |
| 4 | `avg_frp` | **7.66%** | Average heat output magnitude |
| 5 | `max_frp` | **7.17%** | Peak heat burst magnitude |
| 6 | `persistence_days` | **6.57%** | Multi-day duration indicates stationary industrial process |
| 7 | `total_frp` | **6.28%** | Cumulative energy release |
| 8 | `detections` | **3.18%** | Cluster observation density |
| 9 | `distance_to_quarry_km` | **2.29%** | Mining/blasting site proximity |
| 10 | `distance_to_industrial_area_km` | **2.02%** | Distance to gazetted industrial estates |
| 11 | `distance_to_substation_km` | **1.92%** | High-voltage infrastructure proximity |
| 12 | `distance_to_power_plant_km` | **1.53%** | Thermal/gas power station proximity |
| 13 | `distance_to_storage_tank_km` | **1.38%** | Petrochemical tank farm proximity |
| 14 | `distance_to_works_km` | **1.12%** | Heavy manufacturing facilities proximity |

---

## 5. Model Card Metadata Specifications

### 5.1 Intended Use
- **Primary Domain:** Automated preliminary classification of satellite-detected thermal anomalies across the Indian subcontinent into operational categories (`Industrial Fire`, `Persistent Thermal Source`, `Natural Fire`, `Other`).
- **Target Audience:** NTRO monitoring analysts, disaster management coordinators, and geospatial intelligence officers.
- **Decision Context:** Triage tool designed to prioritize high-risk industrial anomalies for analyst review and high-resolution optical satellite tasking.

### 5.2 Out-of-Scope & Misuse Cases
- **Autonomous Weapon or Critical Action Triggering:** This model must **never** be used for fully autonomous kinetic or legal actions without human analyst verification.
- **Single-Overpass Definitive Labeling:** The model requires temporal persistence features (`persistence_days`, `night_ratio`). Applying it to isolated single detections without historical cluster aggregation degrades predictive validity.
- **Urban Structural Firefighting:** The model is trained on satellite footprint spatial scales (VIIRS 375 m pixel footprint); it cannot locate individual burning residential structures.

### 5.3 Limitations
1. **Heuristic Label Noise:** The historical training data contains weak labels. While the model achieves 96.5% test consistency against this dataset, true real-world ground truth may contain labeling discrepancies.
2. **Cloud & Smog Obscuration:** Thick monsoon cloud cover or extreme winter smog (e.g., Indo-Gangetic Plain) attenuates satellite sensor thermal radiance, artificially depressing `avg_bright_ti4` and `avg_frp`.
3. **OSM Coverage Density:** Geospatial proximity features depend on OpenStreetMap data completeness. In rural or remote industrial regions where OSM mapping is sparse, distances to infrastructure will be overestimated.

### 5.4 Known Risks & Bias
1. **Agricultural Stubble Burning Overlap:** During post-harvest seasons (October–November in Punjab/Haryana), high-density stubble fires can exhibit high temperatures and night-time burning, creating potential false alarms as industrial or persistent sources.
2. **Solar Glint & Specular Reflection:** Highly reflective metal roofs or solar panel farms during summer months can trigger false FIRMS thermal anomalies, classified as `Other` or `Persistent Thermal Source`.

### 5.5 Assumptions
1. Input data features strictly follow the units defined in Section 2.4 (Kelvin, Megawatts, Kilometers).
2. VIIRS I-band (375 m) sensor characteristics are assumed; applying this model directly to coarser sensors (MODIS 1 km) requires recalibration of FRP and brightness temperature distributions.
3. Coordinate reference system for geospatial distances is standard WGS 84 (EPSG:4326) geodesic distance calculated using the Haversine or Vincenty formula.

---

## 6. Reproducibility & Pipeline Integration

### 6.1 Training Script Execution
The training pipeline is fully automated and deterministic:
```powershell
cd ml-service
.\venv\Scripts\python train.py
```
This script:
1. Validates source data existence and schemas.
2. Guards against leakage of target or prediction columns.
3. Performs stratified train/test splitting (`random_state=42`).
4. Automatically backs up existing models to `fire_type_model_legacy_v1.pkl`.
5. Trains the regularized `RandomForestClassifier`.
6. Generates full evaluation metrics and confusion matrices.
7. Saves the model to `ml-service/model/fire_type_model.pkl` and writes comprehensive metadata to `ml-service/model/model_metadata.json`.

### 6.2 Independent Evaluation Script
To re-evaluate the saved model artifact at any time without retraining:
```powershell
cd ml-service
.\venv\Scripts\python evaluate.py
```

### 6.3 API Compatibility Verification
The FastAPI ML service exposes the model via:
- `GET /health`: Model status, feature counts, and expected inputs.
- `GET /model-info`: Rich model metadata including version (`2.0.0`), test set evaluation metrics, hyperparameters, and feature importances.
- `POST /predict`: Pydantic-validated inference returning predicted class, confidence, and full 4-class probability distribution.

All automated test suites in `ml-service` and `backend` pass with 100% success:
- ML Service API & Validation: **10/10 Passed**
- Backend Spatial & FIRMS Ingestion Pipeline: **40/40 Passed**
