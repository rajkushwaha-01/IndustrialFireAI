from typing import List, Dict, Optional
from pydantic import BaseModel, Field, ConfigDict

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

class FireFeaturesInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    persistence_days: float = Field(..., ge=0.0, description="Number of persistence days")
    detections: int = Field(..., ge=1, description="Detection count (must be >= 1)")
    avg_frp: float = Field(..., ge=0.0, description="Average Fire Radiative Power (MW)")
    max_frp: float = Field(..., ge=0.0, description="Maximum Fire Radiative Power (MW)")
    total_frp: float = Field(..., ge=0.0, description="Total Fire Radiative Power (MW)")
    avg_bright_ti4: float = Field(..., gt=0.0, description="Average Brightness Temp I-4 (Kelvin)")
    avg_bright_ti5: float = Field(..., gt=0.0, description="Average Brightness Temp I-5 (Kelvin)")
    night_ratio: float = Field(..., ge=0.0, le=1.0, description="Night detection ratio (0.0 to 1.0)")
    distance_to_industrial_area_km: float = Field(..., ge=0.0, description="Distance to industrial area (km)")
    distance_to_power_plant_km: float = Field(..., ge=0.0, description="Distance to power plant (km)")
    distance_to_quarry_km: float = Field(..., ge=0.0, description="Distance to quarry (km)")
    distance_to_substation_km: float = Field(..., ge=0.0, description="Distance to electrical substation (km)")
    distance_to_storage_tank_km: float = Field(..., ge=0.0, description="Distance to storage tank (km)")
    distance_to_works_km: float = Field(..., ge=0.0, description="Distance to industrial works (km)")

    def to_feature_vector(self) -> List[float]:
        """Explicitly construct feature vector in the exact model feature order."""
        return [
            float(self.persistence_days),
            float(self.detections),
            float(self.avg_frp),
            float(self.max_frp),
            float(self.total_frp),
            float(self.avg_bright_ti4),
            float(self.avg_bright_ti5),
            float(self.night_ratio),
            float(self.distance_to_industrial_area_km),
            float(self.distance_to_power_plant_km),
            float(self.distance_to_quarry_km),
            float(self.distance_to_substation_km),
            float(self.distance_to_storage_tank_km),
            float(self.distance_to_works_km),
        ]

class PredictResponse(BaseModel):
    prediction: str
    confidence: float
    probabilities: Dict[str, float]

class ModelInfoResponse(BaseModel):
    model_type: str
    n_estimators: int
    feature_names: List[str]
    classes: List[str]

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    model_loaded: bool
    model_type: Optional[str] = None
    classes: Optional[List[str]] = None
    feature_count: int
    expected_features: List[str]
    timestamp: str
