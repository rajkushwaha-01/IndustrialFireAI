"""
Multi-Source Classification & Evidence Reasoning Layer (Phase 7)

Provides transparent evidence synthesis across Thermal, Spatial, and Temporal dimensions
without fabricating probabilities. Grounded in NASA FIRMS radiometric principles and
OpenStreetMap spatial context.
"""
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class EvidenceFactor(BaseModel):
    factor: str
    level: str  # HIGH, MEDIUM, LOW, NEGLIGIBLE
    detail: str

class ThermalEvidence(BaseModel):
    frp_level: str
    frp_mw: float
    temperature_level: str
    brightness_kelvin: float
    detection_frequency_level: str
    detections: int

class SpatialEvidence(BaseModel):
    proximity_level: str
    min_distance_km: float
    nearest_category: str
    density_level: str
    nearby_facilities_estimated: int

class TemporalEvidence(BaseModel):
    persistence_level: str
    persistence_days: float
    diurnal_pattern: str
    night_ratio: float

class ClassificationEvidence(BaseModel):
    classification: str
    confidence: float
    probabilities: Dict[str, float]
    factors: List[EvidenceFactor]
    summary_text: List[str]
    thermal: ThermalEvidence
    spatial: SpatialEvidence
    temporal: TemporalEvidence
    scientific_disclaimer: str = (
        "Thermal anomaly classification is probabilistic and derived from VIIRS/MODIS radiometric measurements "
        "and OpenStreetMap spatial correlation. Satellite data alone cannot establish definitive on-the-ground "
        "physical root cause without field inspection."
    )


def compute_evidence(
    features: Dict[str, Any],
    raw_prediction: str,
    confidence: float,
    probabilities: Dict[str, float]
) -> ClassificationEvidence:
    """
    Computes qualitative evidence ratings and applies scientific consistency guardrails.
    """
    # Extract thermal metrics
    frp = float(features.get("avg_frp", features.get("frp", 0.0)))
    max_frp = float(features.get("max_frp", frp))
    bright_ti4 = float(features.get("avg_bright_ti4", features.get("brightness_temperature", 300.0)))
    detections = int(features.get("detections", features.get("detection_count", 1)))

    # Extract spatial metrics
    dist_industrial = float(features.get("distance_to_industrial_area_km", 99.0))
    dist_power = float(features.get("distance_to_power_plant_km", 99.0))
    dist_quarry = float(features.get("distance_to_quarry_km", 99.0))
    dist_substation = float(features.get("distance_to_substation_km", 99.0))
    dist_storage = float(features.get("distance_to_storage_tank_km", 99.0))
    dist_works = float(features.get("distance_to_works_km", 99.0))

    dist_map = {
        "storage_tank": dist_storage,
        "industrial_area": dist_industrial,
        "works": dist_works,
        "power_plant": dist_power,
        "quarry": dist_quarry,
        "substation": dist_substation,
    }
    nearest_category, min_distance_km = min(dist_map.items(), key=lambda x: x[1])

    # Extract temporal metrics
    persistence_days = float(features.get("persistence_days", 1.0))
    night_ratio = float(features.get("night_ratio", 0.0))

    # --- 1. Thermal Evidence Evaluation ---
    effective_frp = max(frp, max_frp * 0.7)
    if effective_frp >= 50.0:
        frp_level = "HIGH"
    elif effective_frp >= 15.0:
        frp_level = "MEDIUM"
    elif effective_frp >= 5.0:
        frp_level = "LOW"
    else:
        frp_level = "NEGLIGIBLE"

    if bright_ti4 >= 355.0:
        temp_level = "HIGH"
    elif bright_ti4 >= 325.0:
        temp_level = "MEDIUM"
    else:
        temp_level = "LOW"

    if detections >= 15:
        det_level = "HIGH"
    elif detections >= 4:
        det_level = "MEDIUM"
    else:
        det_level = "LOW"

    thermal = ThermalEvidence(
        frp_level=frp_level,
        frp_mw=round(frp, 2),
        temperature_level=temp_level,
        brightness_kelvin=round(bright_ti4, 1),
        detection_frequency_level=det_level,
        detections=detections
    )

    # --- 2. Spatial Evidence Evaluation ---
    if min_distance_km <= 1.5:
        prox_level = "HIGH"
    elif min_distance_km <= 5.0:
        prox_level = "MEDIUM"
    elif min_distance_km <= 15.0:
        prox_level = "LOW"
    else:
        prox_level = "NEGLIGIBLE"

    # Estimate nearby infrastructure density from distance thresholds
    close_facilities = sum(1 for d in dist_map.values() if d <= 5.0)
    if close_facilities >= 3 or min_distance_km <= 1.0:
        density_level = "HIGH"
    elif close_facilities >= 1 or min_distance_km <= 3.5:
        density_level = "MEDIUM"
    elif min_distance_km <= 10.0:
        density_level = "LOW"
    else:
        density_level = "NEGLIGIBLE"

    spatial = SpatialEvidence(
        proximity_level=prox_level,
        min_distance_km=round(min_distance_km, 2),
        nearest_category=nearest_category.replace("_", " "),
        density_level=density_level,
        nearby_facilities_estimated=close_facilities
    )

    # --- 3. Temporal Evidence Evaluation ---
    if persistence_days >= 15.0:
        pers_level = "HIGH"
    elif persistence_days >= 3.0:
        pers_level = "MEDIUM"
    else:
        pers_level = "LOW"

    if night_ratio >= 0.60:
        diurnal_pattern = "CONTINUOUS_24_7"
    elif night_ratio >= 0.25:
        diurnal_pattern = "MIXED_DIURNAL"
    else:
        diurnal_pattern = "DAYTIME_DOMINATED"

    temporal = TemporalEvidence(
        persistence_level=pers_level,
        persistence_days=round(persistence_days, 1),
        diurnal_pattern=diurnal_pattern,
        night_ratio=round(night_ratio, 2)
    )

    # --- 4. Scientific Consistency Guardrails ---
    # Guard against claiming an "Industrial Fire" when kilometers away in deep wilderness
    final_classification = raw_prediction
    final_confidence = confidence

    if raw_prediction == "Industrial Fire":
        if min_distance_km > 12.0:
            # Over-claiming guard: Remote fire cannot be industrial fire without industrial proximity
            final_classification = "Natural Fire" if effective_frp >= 15.0 else "Other"
            # Rebalance confidence without fabricating random numbers
            final_confidence = round(max(0.65, probabilities.get("Natural Fire", 0.65)), 4)
        elif prox_level in ["LOW", "NEGLIGIBLE"] and pers_level == "LOW" and effective_frp < 15.0:
            final_classification = "Other"

    elif raw_prediction == "Persistent Thermal Source":
        if pers_level == "LOW" and night_ratio < 0.35:
            # Persistent thermal sources require multi-day persistence or night-time operational cycles
            final_classification = "Natural Fire" if effective_frp >= 15.0 else "Other"

    # --- 5. Factors & Summary Output ---
    factors = [
        EvidenceFactor(
            factor="industrial proximity",
            level=prox_level.lower(),
            detail=f"{min_distance_km:.2f} km to nearest {nearest_category.replace('_', ' ')}"
        ),
        EvidenceFactor(
            factor="persistence",
            level=pers_level.lower(),
            detail=f"{persistence_days:.1f} days cluster duration"
        ),
        EvidenceFactor(
            factor="FRP",
            level=frp_level.lower(),
            detail=f"{frp:.1f} MW average radiative power"
        ),
        EvidenceFactor(
            factor="infrastructure density",
            level=density_level.lower(),
            detail=f"{close_facilities} industrial assets within 5km"
        ),
    ]

    summary_text = [
        f"industrial proximity: {prox_level.lower()}",
        f"persistence: {pers_level.lower()}",
        f"FRP: {frp_level.lower()}",
        f"infrastructure density: {density_level.lower()}"
    ]

    return ClassificationEvidence(
        classification=final_classification,
        confidence=round(final_confidence, 4),
        probabilities=probabilities,
        factors=factors,
        summary_text=summary_text,
        thermal=thermal,
        spatial=spatial,
        temporal=temporal
    )
