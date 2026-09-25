import os
from pathlib import Path
import joblib
from .schemas import ORDERED_FEATURE_NAMES

MODEL = None
MODEL_METADATA = {
    "loaded": False,
    "model_type": None,
    "n_estimators": 0,
    "classes": [],
    "feature_names": [],
    "n_features": 0,
    "path": None,
    "error": None
}

def get_model_path() -> Path:
    env_path = os.getenv("MODEL_PATH")
    if env_path and os.path.exists(env_path):
        return Path(env_path)

    current_dir = Path(__file__).resolve().parent
    candidates = [
        current_dir.parent / "model" / "fire_type_model.pkl",
        Path.cwd() / "ml-service" / "model" / "fire_type_model.pkl",
        Path.cwd() / "model" / "fire_type_model.pkl"
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate

    return current_dir.parent / "model" / "fire_type_model.pkl"

def load_model():
    global MODEL, MODEL_METADATA
    if MODEL is not None:
        return MODEL

    model_path = get_model_path()
    MODEL_METADATA["path"] = str(model_path)

    if not model_path.exists():
        MODEL_METADATA["loaded"] = False
        MODEL_METADATA["error"] = f"Model file not found at: {model_path}"
        print(f"[ERROR] {MODEL_METADATA['error']}")
        return None

    try:
        loaded = joblib.load(model_path)
        MODEL = loaded
        MODEL_METADATA["loaded"] = True
        MODEL_METADATA["model_type"] = type(loaded).__name__
        MODEL_METADATA["n_estimators"] = int(getattr(loaded, "n_estimators", len(getattr(loaded, "estimators_", []))))
        MODEL_METADATA["classes"] = [str(c) for c in getattr(loaded, "classes_", [])]
        feature_names_in = getattr(loaded, "feature_names_in_", None)
        if feature_names_in is not None:
            MODEL_METADATA["feature_names"] = [str(f) for f in feature_names_in]
        else:
            MODEL_METADATA["feature_names"] = ORDERED_FEATURE_NAMES
        MODEL_METADATA["n_features"] = int(getattr(loaded, "n_features_in_", 14))

        print(f"[INFO] Authoritative RandomForestClassifier loaded from {model_path}")
        print(f"[INFO] Classes ({len(MODEL_METADATA['classes'])}): {MODEL_METADATA['classes']}")
        print(f"[INFO] Estimators: {MODEL_METADATA['n_estimators']}, Features: {MODEL_METADATA['n_features']}")
        return MODEL
    except Exception as e:
        MODEL_METADATA["loaded"] = False
        MODEL_METADATA["error"] = str(e)
        print(f"[ERROR] Failed to load model: {e}")
        return None

def get_metadata():
    return MODEL_METADATA
