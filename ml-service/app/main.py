import os
from datetime import datetime, timezone
from contextlib import asynccontextmanager
import pandas as pd
from fastapi import FastAPI, HTTPException, status, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .model_loader import load_model, get_metadata
from .schemas import (
    FireFeaturesInput, 
    PredictResponse, 
    ModelInfoResponse, 
    HealthResponse, 
    ORDERED_FEATURE_NAMES
)
from .evidence import compute_evidence

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-load and validate authoritative model during server startup
    load_model()
    metadata = get_metadata()
    if metadata["loaded"]:
        print(f"[STARTUP VALIDATION OK] Model '{metadata['model_type']}' v{metadata['version']} loaded with {metadata['n_features']} features.")
    else:
        print(f"[STARTUP VALIDATION FAILED] Model failed to load: {metadata.get('error')}")
    yield

app = FastAPI(
    title="NTRO Industrial Fire & Persistent Thermal Source Inference Service",
    description="Machine Learning service for Problem Statement 26162",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "service": "industrial-fire-ml-service",
        "problem_statement_id": "26162",
        "organization": "National Technical Research Organisation (NTRO)",
        "phase": "Phase 2 - ML Inference Service",
        "endpoints": {
            "health": "/health",
            "model_info": "/model-info",
            "predict": "/predict",
            "docs": "/docs"
        }
    }

@app.get("/health", response_model=HealthResponse)
def get_health(response: Response):
    metadata = get_metadata()
    if not metadata["loaded"]:
        load_model()
        metadata = get_metadata()

    if not metadata["loaded"]:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthResponse(
        status="ok" if metadata["loaded"] else "degraded",
        service="industrial-fire-ml-service",
        version="1.0.0",
        model_loaded=metadata["loaded"],
        model_type=metadata["model_type"],
        classes=metadata["classes"],
        feature_count=metadata["n_features"],
        expected_features=ORDERED_FEATURE_NAMES,
        timestamp=datetime.now(timezone.utc).isoformat()
    )

@app.get("/model-info", response_model=ModelInfoResponse)
def get_model_info():
    metadata = get_metadata()
    if not metadata["loaded"]:
        model = load_model()
        if model is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authoritative ML model is unavailable"
            )
        metadata = get_metadata()

    return ModelInfoResponse(
        model_type=metadata["model_type"] or "RandomForestClassifier",
        n_estimators=metadata["n_estimators"],
        feature_names=metadata["feature_names"],
        classes=metadata["classes"],
        version=metadata.get("version", "2.0.0"),
        trained_at=metadata.get("trained_at"),
        hyperparameters=metadata.get("hyperparameters"),
        evaluation=metadata.get("evaluation"),
        feature_importances=metadata.get("feature_importances"),
        dataset_summary=metadata.get("dataset_summary")
    )

@app.post("/predict", response_model=PredictResponse)
def predict_fire_type(payload: FireFeaturesInput):
    model = load_model()
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authoritative ML model is not loaded"
        )

    # Explicitly construct the feature vector in the exact model feature order
    feature_vector = payload.to_feature_vector()
    df = pd.DataFrame([feature_vector], columns=ORDERED_FEATURE_NAMES)

    try:
        # Predict class probabilities across all 4 classes
        probabilities = model.predict_proba(df)[0]
        
        # Determine highest probability class
        best_index = int(probabilities.argmax())
        predicted_class = str(model.classes_[best_index])
        confidence = float(probabilities[best_index])

        # Map each class name to its exact probability
        prob_dict = {
            str(cls): round(float(prob), 6)
            for cls, prob in zip(model.classes_, probabilities)
        }

        # Compute multi-source classification evidence layer
        features_dict = payload.model_dump()
        evidence = compute_evidence(
            features=features_dict,
            raw_prediction=predicted_class,
            confidence=confidence,
            probabilities=prob_dict
        )

        return PredictResponse(
            prediction=evidence.classification,
            confidence=evidence.confidence,
            probabilities=prob_dict,
            evidence=evidence.model_dump()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference execution failed: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
