"""
FastAPI ML Engine — Two independent models:
  1. Tabular Regression (soil sensor data -> yield prediction)
  2. CNN Classification (crop/soil images -> health classification)
"""

import os
import io
import json
import asyncio
import logging
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Query, BackgroundTasks, HTTPException, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ── Pydantic schemas ───────────────────────────────────────────────────────────

class SensorDataInput(BaseModel):
    soilMoisture: Optional[float] = Field(default=None, ge=0, le=100)          # % volumetric
    soilTemperature: Optional[float] = Field(default=None, ge=-10, le=60)       # °C
    soilPh: Optional[float] = Field(default=None, ge=0, le=14)                  # pH scale
    electricalConductivity: Optional[float] = Field(default=None, ge=0, le=20)  # dS/m
    bulkDensity: Optional[float] = Field(default=None, ge=0, le=3)              # g/cm³
    organicMatter: Optional[float] = Field(default=None, ge=0, le=100)          # %
    nitrogenPpm: Optional[float] = Field(default=None, ge=0, le=10000)
    phosphorusPpm: Optional[float] = Field(default=None, ge=0, le=10000)
    potassiumPpm: Optional[float] = Field(default=None, ge=0, le=10000)
    calciumPpm: Optional[float] = Field(default=None, ge=0, le=100000)
    magnesiumPpm: Optional[float] = Field(default=None, ge=0, le=10000)
    sulfurPpm: Optional[float] = Field(default=None, ge=0, le=10000)
    microbialDiversityIndex: Optional[float] = Field(default=None, ge=0, le=20)
    nitrogenFixingBacteriaRatio: Optional[float] = Field(default=None, ge=0, le=100)
    mycorrhizalFungiPresence: Optional[float] = Field(default=None, ge=0, le=1)
    pathogenicFungiRatio: Optional[float] = Field(default=None, ge=0, le=100)
    bacterialCountCfu: Optional[float] = Field(default=None, ge=0, le=100000)
    rainfallMm: Optional[float] = Field(default=None, ge=0, le=5000)
    ambientTemperature: Optional[float] = Field(default=None, ge=-50, le=60)    # °C
    humidity: Optional[float] = Field(default=None, ge=0, le=100)               # %
    fertilizerKgPerHa: Optional[float] = Field(default=None, ge=0, le=10000)
    previousYieldTons: Optional[float] = Field(default=None, ge=0, le=1000)
    growingSeasonDays: Optional[float] = Field(default=None, ge=0, le=730)
    cropTypeEncoded: Optional[float] = Field(default=None, ge=0, le=10)
    cropType: Optional[str] = None


# ── Internal API Key ───────────────────────────────────────────────────────────
ML_API_KEY_HEADER = APIKeyHeader(name="X-Internal-Key", auto_error=False)
VALID_API_KEY = os.getenv("ML_ENGINE_API_KEY")
APP_ENV = os.getenv("APP_ENV", "development")

def verify_api_key(api_key: str = Security(ML_API_KEY_HEADER)):
    if not VALID_API_KEY:
        if APP_ENV == "production":
            raise HTTPException(
                status_code=503,
                detail="ML Engine misconfigured: API key required in production."
            )
        return  # dev only
    if api_key != VALID_API_KEY:
        raise HTTPException(
            status_code=403,
            detail="ML Engine: Unauthorized. Valid X-Internal-Key required."
        )
    return api_key

# ── Module-level CNN model storage ────────────────────────────────────────────
_cnn_models = {}
_cnn_classes = {}
_training_locks = {
    "tabular": asyncio.Lock(),
    "cnn_soil": asyncio.Lock(),
    "cnn_tomato": asyncio.Lock(),
    "cnn_corn": asyncio.Lock(),
}

def load_cnn_models():
    import tensorflow as tf
    artifact_dir = "model/artifacts/cnn"
    for crop in ["soil", "tomato", "corn"]:
        model_path = f"{artifact_dir}/{crop}_model.keras"
        classes_path = f"{artifact_dir}/{crop}_classes.json"
        if os.path.exists(model_path) and os.path.exists(classes_path):
            try:
                _cnn_models[crop] = tf.keras.models.load_model(model_path)
                with open(classes_path) as f:
                    _cnn_classes[crop] = json.load(f)
                logger.info(f"Loaded {crop} CNN model")
            except Exception as e:
                logger.warning(f"Failed to load {crop} model: {e}")
        else:
            logger.info(f"No pre-trained {crop} model found")

def get_cnn_model(crop_type: str):
    import tensorflow as tf
    if crop_type in _cnn_models:
        return _cnn_models[crop_type], _cnn_classes[crop_type]
    model_path = f"model/artifacts/cnn/{crop_type}_model.keras"
    classes_path = f"model/artifacts/cnn/{crop_type}_classes.json"
    if not os.path.exists(model_path) or not os.path.exists(classes_path):
        raise HTTPException(status_code=400, detail=f"Mfano wa {crop_type} haujapatikana.")
    model = tf.keras.models.load_model(model_path)
    with open(classes_path) as f:
        classes = json.load(f)
    _cnn_models[crop_type] = model
    _cnn_classes[crop_type] = classes
    return model, classes


# ── Image relevance check ──────────────────────────────────────────────────────

def is_plant_image(image_bytes: bytes):
    import numpy as np
    from PIL import Image as PILImage
    img = PILImage.open(io.BytesIO(image_bytes)).convert("RGB")
    img_array = np.array(img, dtype=np.float32)
    green_mean = img_array[:, :, 1].mean()
    overall_mean = img_array.mean() + 1e-6
    green_ratio = green_mean / overall_mean
    brown_ratio = (img_array[:, :, 0].mean() * 0.5 + img_array[:, :, 1].mean() * 0.3) / 255.0
    is_plant = green_ratio > 0.35 or brown_ratio > 0.3
    confidence = min(1.0, float(max(green_ratio, brown_ratio)))
    message_sw = "Picha hii haionekani kuwa ya mmea au udongo. Tafadhali pakia picha ya jani au udongo." if not is_plant else None
    message_en = "This image does not appear to be a plant or soil. Please upload a leaf or soil photo." if not is_plant else None
    return is_plant, confidence, message_sw, message_en


def _check_cnn_models() -> dict:
    status = {}
    for ds in ["soil", "tomato", "corn"]:
        path = f"model/artifacts/cnn/{ds}_model.keras"
        status[f"{ds}_cnn"] = os.path.exists(path)
    return status


def _check_tabular_model() -> bool:
    return os.path.exists("model/artifacts/tabular/ensemble.joblib")


def _has_images(dataset: str) -> bool:
    from model.features import CNN_DATASETS
    data_path = CNN_DATASETS.get(dataset, {}).get("path", os.path.join("data", dataset))
    if not os.path.isdir(data_path):
        return False
    for subdir in os.listdir(data_path):
        subdir_path = os.path.join(data_path, subdir)
        if os.path.isdir(subdir_path):
            files = [
                f for f in os.listdir(subdir_path)
                if f.lower().endswith((".jpg", ".jpeg", ".png", ".bmp"))
            ]
            if files:
                return True
    return False


# ── Lifespan (startup logic) ───────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ML Engine starting up...")
    logger.info("Loading CNN models into memory...")
    load_cnn_models()
    logger.info(f"Loaded {len(_cnn_models)} CNN models")
    auto_train = os.environ.get("AUTO_TRAIN_ON_STARTUP", "true").lower() == "true"

    if auto_train:
        # Tabular model
        if not _check_tabular_model():
            if os.path.exists("data/sensor_data.csv"):
                logger.info("sensor_data.csv found — training tabular model on startup...")
                try:
                    from model.tabular_trainer import train_tabular_models
                    train_tabular_models()
                except Exception as e:
                    logger.warning(f"Auto-training tabular model failed: {e}")
            else:
                logger.info(
                    "No sensor_data.csv found at data/sensor_data.csv — "
                    "skipping tabular model auto-training. POST /tabular/train when ready."
                )
        else:
            logger.info("✓ Tabular ensemble model loaded")

        # CNN models
        for ds in ["soil", "tomato", "corn"]:
            cnn_path = f"model/artifacts/cnn/{ds}_model.keras"
            if not os.path.exists(cnn_path):
                if _has_images(ds):
                    logger.info(f"Images found for '{ds}' — training CNN on startup...")
                    try:
                        from model.cnn_trainer import train_cnn_model
                        train_cnn_model(ds)
                    except Exception as e:
                        logger.warning(f"Auto-training {ds} CNN failed: {e}")
                else:
                    logger.info(
                        f"No images found at data/{ds}/ — skipping {ds} CNN auto-training. "
                        f"Add images and POST /image/train."
                    )
            else:
                logger.info(f"✓ {ds} CNN model loaded")

    logger.info("ML Engine ready.")
    yield
    logger.info("ML Engine shutting down.")
    _cnn_models.clear()
    _cnn_classes.clear()


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Soil Microbiome AI — ML Engine",
    description=(
        "Two independent AI models:\n"
        "1. Tabular regression (soil sensor data → crop yield prediction)\n"
        "2. CNN classification (crop/soil images → health classification)"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ML engine is called server-to-server only (Node backend → FastAPI).
# Wildcard origin + allow_credentials=True is disallowed by CORS spec and a security risk.
# Credentials are not needed here; restrict to the backend origin when set.
_allowed_origins = (
    [os.environ["SERVER_URL"]]
    if os.environ.get("SERVER_URL")
    else ["http://localhost:5000"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


# ── Tabular endpoints ─────────────────────────────────────────────────────────

@app.post("/tabular/predict", dependencies=[Depends(verify_api_key)])
async def tabular_predict(data: SensorDataInput):
    """Run yield prediction from soil sensor data (Tabular Regression Model)."""
    from model.tabular_trainer import predict_yield
    try:
        result = predict_yield(data.model_dump())
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Tabular prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/tabular/train", dependencies=[Depends(verify_api_key)])
async def tabular_train(background_tasks: BackgroundTasks):
    """Trigger tabular model training in background."""
    from model.tabular_trainer import train_tabular_models

    def _train():
        try:
            train_tabular_models()
        except Exception as e:
            logger.error(f"Background tabular training failed: {e}")

    background_tasks.add_task(_train)
    return {
        "status": "training started",
        "message": (
            "Tabular model training started in background. "
            "Ensure data/sensor_data.csv exists. "
            "GET /tabular/metrics to check results when complete."
        ),
    }


@app.get("/tabular/metrics")
async def tabular_metrics():
    """Return tabular model training metrics."""
    path = "model/artifacts/tabular/metrics.json"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Tabular model not trained yet.")
    with open(path) as f:
        return json.load(f)


@app.get("/tabular/features")
async def tabular_features():
    """Return feature list with metadata."""
    from model.features import TABULAR_FEATURES, FEATURE_METADATA
    return {
        "features": TABULAR_FEATURES,
        "metadata": FEATURE_METADATA,
    }


# ── Sensor-Only Tabular endpoints (9 real-hardware features) ───────────────────

@app.post("/tabular/predict-sensor", dependencies=[Depends(verify_api_key)])
async def tabular_predict_sensor(data: SensorDataInput):
    from model.tabular_trainer import predict_yield_sensor
    try:
        result = predict_yield_sensor(data.dict())
        result["modelUsed"] = "sensor"
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Sensor prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Sensor prediction failed: {str(e)}")


@app.post("/tabular/train-sensor", dependencies=[Depends(verify_api_key)])
async def tabular_train_sensor(background_tasks: BackgroundTasks):
    from model.tabular_trainer import train_sensor_models
    async def _train():
        try:
            train_sensor_models()
        except Exception as e:
            logger.error(f"Background sensor training failed: {e}")
    background_tasks.add_task(_train)
    return {"status": "training started",
            "message": "Sensor-only model training started. GET /tabular/metrics-sensor to check."}


@app.get("/tabular/metrics-sensor")
async def tabular_metrics_sensor():
    path = "model/artifacts/tabular/sensor/metrics.json"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Sensor model not trained yet.")
    with open(path) as f:
        return json.load(f)


# ── CNN / Image endpoints ─────────────────────────────────────────────────────

@app.post("/image/predict", dependencies=[Depends(verify_api_key)])
async def image_predict(
    file: UploadFile = File(...),
    dataset_type: str = Query(..., pattern="^(soil|tomato|corn)$"),
):
    """Classify a crop/soil image using the CNN model."""
    from model.cnn_trainer import predict_image_from_bytes
    from model.recommendation_engine import generate_image_recommendations
    from model.cnn_registry import CNN_REGISTRY

    contents = await file.read()

    is_plant, plant_conf, msg_sw, msg_en = is_plant_image(contents)
    if not is_plant:
        return {
            "predictedClass": "not_a_plant", "confidence": round(1.0 - plant_conf, 4),
            "confidence_tier": "low", "healthStatus": "AT_RISK",
            "message_sw": msg_sw, "message_en": msg_en, "valid": False,
        }

    get_cnn_model(dataset_type)
    result = predict_image_from_bytes(contents, dataset_type)

    confidence = result["confidence"]
    if confidence >= 0.80: confidence_tier = "high"
    elif confidence >= 0.60: confidence_tier = "medium"
    else: confidence_tier = "low"

    result["confidence_tier"] = confidence_tier
    result["valid"] = confidence >= 0.60
    result["production_validated"] = True

    if confidence < 0.60:
        result["message_sw"] = "Picha si wazi ya kutosha. Tafadhali piga picha karibu zaidi."
        result["message_en"] = "Image not clear enough. Take a closer photo."

    registry_entry = CNN_REGISTRY.get(dataset_type, {"production_ready": False})
    if not registry_entry.get("production_ready", False):
        crop_names = {"corn": "mahindi", "tomato": "nyanya", "soil": "udongo"}
        crop_name = crop_names.get(dataset_type, dataset_type)
        result["production_validated"] = False
        result["model_status"] = registry_entry.get("kind", "UNVALIDATED")
        result["message_sw"] = f"Mfumo bado haujafunzwa vizuri kutambua magonjwa ya {crop_name}. Tunafanya kazi kuiboresha. Kwa sasa, tafadhali wasiliana na afisa ugani kwa ushauri."
        result["message_en"] = f"The system is not yet trained to identify {dataset_type} diseases. We are improving it. For now, please consult an extension officer."
        result["recommendations"] = []
        result["healthStatus"] = "AT_RISK"
        return result

    result["recommendations"] = generate_image_recommendations(result["predictedClass"], result["confidence"])
    return result


@app.post("/image/train", dependencies=[Depends(verify_api_key)])
async def image_train(background_tasks: BackgroundTasks):
    """Trigger CNN training for all datasets in background."""
    from model.cnn_trainer import train_all_cnn_models

    def _train():
        try:
            train_all_cnn_models()
        except Exception as e:
            logger.error(f"Background CNN training failed: {e}")

    background_tasks.add_task(_train)
    return {
        "status": "CNN training started",
        "message": (
            "CNN training started in background. "
            "Ensure images are in data/soil/, data/tomato/, data/corn/ with class subfolders. "
            "GET /image/metrics to check results when complete."
        ),
    }


@app.get("/image/metrics")
async def image_metrics():
    """Return CNN model training metrics."""
    path = "model/artifacts/cnn/cnn_metrics.json"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="No CNN models trained yet.")
    with open(path) as f:
        return json.load(f)


@app.get("/image/classes/{dataset_type}")
async def image_classes(dataset_type: str):
    """Return class labels for a trained CNN model."""
    path = f"model/artifacts/cnn/{dataset_type}_classes.json"
    if not os.path.exists(path):
        raise HTTPException(
            status_code=404,
            detail=f"{dataset_type} CNN model not trained yet.",
        )
    with open(path) as f:
        return json.load(f)


# ── Combined training ─────────────────────────────────────────────────────────

@app.post("/train/all", dependencies=[Depends(verify_api_key)])
async def train_all(background_tasks: BackgroundTasks):
    """Trigger full training pipeline (tabular + all CNNs) in background."""
    from model.tabular_trainer import train_tabular_models
    from model.cnn_trainer import train_all_cnn_models
    from datetime import datetime

    def _train_all():
        os.makedirs("model/artifacts", exist_ok=True)
        status_path = "model/artifacts/training_status.json"
        try:
            logger.info("Starting full training pipeline...")
            with open(status_path, "w") as f:
                json.dump({"status": "running", "started_at": datetime.utcnow().isoformat()}, f)

            train_tabular_models()
            logger.info("Tabular training complete.")
            train_all_cnn_models()
            logger.info("Full training pipeline complete.")

            with open(status_path, "w") as f:
                json.dump({"status": "complete", "completed_at": datetime.utcnow().isoformat()}, f)
        except Exception as e:
            logger.error(f"Full training pipeline failed: {e}")
            with open(status_path, "w") as f:
                json.dump({"status": "failed", "error": str(e), "failed_at": datetime.utcnow().isoformat()}, f)

    background_tasks.add_task(_train_all)
    return {"status": "Full training pipeline started", "message": "Training both models in background."}

@app.get("/training/status")
async def training_status():
    """Return current training job status."""
    path = "model/artifacts/training_status.json"
    if not os.path.exists(path):
        return {"status": "idle"}
    with open(path) as f:
        return json.load(f)


# ── Models status + health ────────────────────────────────────────────────────

@app.get("/models/status")
async def models_status():
    """Check which model artifacts exist."""
    return {
        "tabular": _check_tabular_model(),
        **_check_cnn_models(),
    }


@app.get("/health")
async def health():
    """Health check."""
    return {
        "status": "ok",
        "models": {
            "tabular": _check_tabular_model(),
            **_check_cnn_models(),
        },
    }
