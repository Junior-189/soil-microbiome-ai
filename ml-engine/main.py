"""
FastAPI ML Engine — Two independent models:
  1. Tabular Regression (soil sensor data -> yield prediction)
  2. CNN Classification (crop/soil images -> health classification)
"""

import os
import json
import logging
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Query, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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

@app.post("/tabular/predict")
async def tabular_predict(data: SensorDataInput):
    """Run yield prediction from soil sensor data (Tabular Regression Model)."""
    from model.tabular_trainer import predict_yield
    try:
        result = predict_yield(data.dict())
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Tabular prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/tabular/train")
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


# ── CNN / Image endpoints ─────────────────────────────────────────────────────

@app.post("/image/predict")
async def image_predict(
    file: UploadFile = File(...),
    dataset_type: str = Query(..., pattern="^(soil|tomato|corn)$"),
):
    """Classify a crop/soil image using the CNN model (Image Classification Model)."""
    from model.cnn_trainer import predict_image_from_bytes
    from model.recommendation_engine import generate_image_recommendations

    contents = await file.read()
    result = predict_image_from_bytes(contents, dataset_type)

    recs = generate_image_recommendations(
        result["predictedClass"], result["confidence"]
    )
    result["recommendations"] = recs
    return result


@app.post("/image/train")
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

@app.post("/train/all")
async def train_all(background_tasks: BackgroundTasks):
    """Trigger full training pipeline (tabular + all CNNs) in background."""
    from model.tabular_trainer import train_tabular_models
    from model.cnn_trainer import train_all_cnn_models

    def _train_all():
        try:
            logger.info("Starting full training pipeline...")
            train_tabular_models()
            train_all_cnn_models()
            logger.info("Full training pipeline complete.")
        except Exception as e:
            logger.error(f"Full training pipeline failed: {e}")

    background_tasks.add_task(_train_all)
    return {"status": "Full training pipeline started", "message": "Training both models in background."}


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
