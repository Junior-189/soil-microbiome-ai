"""
Tabular regression model: trains RandomForest, GradientBoosting, XGBoost, and Ensemble.
"""

import os
import json
import logging
import numpy as np
import joblib

from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, VotingRegressor
from sklearn.model_selection import cross_val_score, KFold
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

try:
    from xgboost import XGBRegressor
    HAS_XGB = True
except ImportError:
    HAS_XGB = False
    logging.warning("XGBoost not installed — ensemble will use RF + GB only.")

from model.preprocessor import load_tabular_data, preprocess_tabular, generate_synthetic_supplement
from model.features import TABULAR_FEATURES, TARGET, CROP_TYPE_ENCODING

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

ARTIFACTS_DIR = "model/artifacts/tabular"


def _ensure_artifacts_dir():
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)


def train_tabular_models(data_path: str = "data/sensor_data.csv"):
    """Full training pipeline: load → preprocess → train → evaluate → save."""
    _ensure_artifacts_dir()

    logger.info("=" * 60)
    logger.info("TABULAR MODEL TRAINING STARTED")
    logger.info("=" * 60)

    # Load data
    raw_df = load_tabular_data(data_path)

    # Supplement with synthetic data if needed
    if len(raw_df) < 300:
        raw_df = generate_synthetic_supplement(raw_df)

    # Preprocess
    X_scaled, y, scaler, feature_names = preprocess_tabular(raw_df)
    logger.info(f"Training set: {X_scaled.shape[0]} samples, {X_scaled.shape[1]} features")

    # Define models
    rf = RandomForestRegressor(n_estimators=200, max_depth=15, random_state=42, n_jobs=-1)
    gb = GradientBoostingRegressor(n_estimators=150, learning_rate=0.05, random_state=42)

    models = [("random_forest", rf), ("gradient_boosting", gb)]

    if HAS_XGB:
        xgb = XGBRegressor(
            n_estimators=150,
            learning_rate=0.1,
            max_depth=8,
            random_state=42,
            verbosity=0,
        )
        models.append(("xgboost", xgb))

    # Ensemble VotingRegressor
    ensemble = VotingRegressor(estimators=models)

    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    all_metrics = {}

    # Train + evaluate each model
    for name, model in models:
        logger.info(f"\nTraining {name}...")
        neg_rmse_scores = cross_val_score(
            model, X_scaled, y, cv=kf, scoring="neg_root_mean_squared_error"
        )
        r2_scores = cross_val_score(model, X_scaled, y, cv=kf, scoring="r2")
        neg_mae_scores = cross_val_score(
            model, X_scaled, y, cv=kf, scoring="neg_mean_absolute_error"
        )

        model.fit(X_scaled, y)

        rmse = float(-neg_rmse_scores.mean())
        mae = float(-neg_mae_scores.mean())
        r2 = float(r2_scores.mean())

        all_metrics[name] = {
            "rmse": rmse,
            "mae": mae,
            "r2": r2,
            "rmse_std": float(neg_rmse_scores.std()),
            "r2_std": float(r2_scores.std()),
        }

        path = os.path.join(ARTIFACTS_DIR, f"{name}_model.joblib")
        joblib.dump(model, path)
        logger.info(f"  Saved to {path}")
        logger.info(f"  RMSE: {rmse:.4f} (±{neg_rmse_scores.std():.4f})")
        logger.info(f"  MAE:  {mae:.4f}")
        logger.info(f"  R²:   {r2:.4f} (±{r2_scores.std():.4f})")

    # Train ensemble
    logger.info("\nTraining ensemble (VotingRegressor)...")
    ensemble_neg_rmse = cross_val_score(
        ensemble, X_scaled, y, cv=kf, scoring="neg_root_mean_squared_error"
    )
    ensemble_r2 = cross_val_score(ensemble, X_scaled, y, cv=kf, scoring="r2")
    ensemble_mae = cross_val_score(
        ensemble, X_scaled, y, cv=kf, scoring="neg_mean_absolute_error"
    )

    ensemble.fit(X_scaled, y)

    ens_rmse = float(-ensemble_neg_rmse.mean())
    ens_mae = float(-ensemble_mae.mean())
    ens_r2 = float(ensemble_r2.mean())

    all_metrics["ensemble"] = {
        "rmse": ens_rmse,
        "mae": ens_mae,
        "r2": ens_r2,
        "rmse_std": float(ensemble_neg_rmse.std()),
        "r2_std": float(ensemble_r2.std()),
        "training_samples": int(X_scaled.shape[0]),
    }

    # Save artifacts
    joblib.dump(ensemble, os.path.join(ARTIFACTS_DIR, "ensemble.joblib"))
    joblib.dump(scaler, os.path.join(ARTIFACTS_DIR, "scaler.joblib"))

    with open(os.path.join(ARTIFACTS_DIR, "feature_names.json"), "w") as f:
        json.dump(feature_names, f)

    with open(os.path.join(ARTIFACTS_DIR, "metrics.json"), "w") as f:
        json.dump(all_metrics, f, indent=2)

    # Summary table
    logger.info("\n" + "=" * 60)
    logger.info("TRAINING SUMMARY")
    logger.info(f"{'Model':<25} {'RMSE':>8} {'MAE':>8} {'R²':>8}")
    logger.info("-" * 55)
    for name, m in all_metrics.items():
        logger.info(f"{name:<25} {m['rmse']:>8.4f} {m['mae']:>8.4f} {m['r2']:>8.4f}")
    logger.info("=" * 60)

    return all_metrics


def predict_yield(sensor_data: dict) -> dict:
    """
    Run inference: returns prediction + confidence interval + SHAP + top features.
    """
    from model.explainability import compute_shap_values, get_top_features

    # Load artifacts
    ensemble_path = os.path.join(ARTIFACTS_DIR, "ensemble.joblib")
    scaler_path = os.path.join(ARTIFACTS_DIR, "scaler.joblib")
    features_path = os.path.join(ARTIFACTS_DIR, "feature_names.json")

    if not os.path.exists(ensemble_path):
        raise FileNotFoundError(
            "Tabular model not trained. POST /tabular/train or place sensor_data.csv in ml-engine/data/"
        )

    ensemble = joblib.load(ensemble_path)
    scaler = joblib.load(scaler_path)

    with open(features_path) as f:
        feature_names = json.load(f)

    # Handle cropType encoding
    data = dict(sensor_data)
    if "cropType" in data and "cropTypeEncoded" not in data:
        data["cropTypeEncoded"] = CROP_TYPE_ENCODING.get(str(data.get("cropType", "TOMATO")), 0)

    # Build feature vector
    feature_vector = []
    for feat in feature_names:
        val = data.get(feat)
        if val is None:
            val = 0
        feature_vector.append(float(val))

    X = np.array([feature_vector])
    X_scaled = scaler.transform(X)

    # Ensemble prediction
    ensemble_pred = float(ensemble.predict(X_scaled)[0])

    # Individual model predictions
    individual = {}
    model_preds = []
    for name, model in ensemble.estimators:
        pred = float(model.predict(X_scaled)[0])
        individual[name] = pred
        model_preds.append(pred)

    # Confidence interval from spread of individual model predictions
    pred_std = float(np.std(model_preds))
    conf_low = max(0.0, ensemble_pred - 1.5 * pred_std)
    conf_high = ensemble_pred + 1.5 * pred_std

    # Yield category
    if ensemble_pred < 2:
        yield_category = "POOR"
    elif ensemble_pred < 4:
        yield_category = "AVERAGE"
    elif ensemble_pred < 6:
        yield_category = "GOOD"
    else:
        yield_category = "EXCELLENT"

    # SHAP explainability
    try:
        shap_values = compute_shap_values(data)
        top_features = get_top_features(shap_values, n=10)
    except Exception as e:
        logger.warning(f"SHAP computation failed: {e}")
        shap_values = {}
        top_features = []

    return {
        "predictedYieldTons": round(ensemble_pred, 3),
        "confidenceLow": round(conf_low, 3),
        "confidenceHigh": round(conf_high, 3),
        "yieldCategory": yield_category,
        "individualPredictions": {k: round(v, 3) for k, v in individual.items()},
        "shapValues": shap_values,
        "topFeatures": top_features,
    }
