"""
Tabular regression model: trains RandomForest, GradientBoosting, XGBoost, and Ensemble.
Two independent model families: full (24 features) and sensor (9 features).
"""

import os
import json
import shutil
import logging
from datetime import datetime
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
from model.features_sensor import SENSOR_FEATURES, SENSOR_TARGET, REGIONAL_MEDIANS, DEFAULT_REGIONAL_MEDIAN

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

ARTIFACTS_DIR = "model/artifacts/tabular"
VERSIONS_DIR = os.path.join(ARTIFACTS_DIR, "versions")


def _ensure_artifacts_dir():
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    os.makedirs(VERSIONS_DIR, exist_ok=True)


def _load_current_metrics():
    metrics_path = os.path.join(ARTIFACTS_DIR, "metrics.json")
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            data = json.load(f)
            return data.get("ensemble", {})
    return {}


def save_model_with_versioning(ensemble, scaler, feature_names, metrics, all_metrics):
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    ens_rmse = metrics.get("rmse", float("inf"))

    version_path = os.path.join(VERSIONS_DIR, f"ensemble_{timestamp}.joblib")
    joblib.dump(ensemble, version_path)

    version_metrics_path = os.path.join(VERSIONS_DIR, f"metrics_{timestamp}.json")
    with open(version_metrics_path, "w") as f:
        json.dump({**all_metrics, "timestamp": timestamp, "file": version_path}, f, indent=2)

    current_metrics = _load_current_metrics()
    current_rmse = current_metrics.get("rmse", float("inf"))

    if ens_rmse < current_rmse:
        prod_path = os.path.join(ARTIFACTS_DIR, "ensemble.joblib")
        if os.path.exists(prod_path):
            backup_path = os.path.join(VERSIONS_DIR, f"ensemble_previous_{timestamp}.joblib")
            shutil.copy2(prod_path, backup_path)
        shutil.copy2(version_path, prod_path)
        joblib.dump(scaler, os.path.join(ARTIFACTS_DIR, "scaler.joblib"))
        with open(os.path.join(ARTIFACTS_DIR, "feature_names.json"), "w") as f:
            json.dump(feature_names, f)
        with open(os.path.join(ARTIFACTS_DIR, "metrics.json"), "w") as f:
            json.dump(all_metrics, f, indent=2)
        logger.info(f"Model PROMOTED: RMSE {current_rmse:.4f} → {ens_rmse:.4f}")
        return {"promoted": True, "previous_rmse": round(current_rmse, 4),
                "new_rmse": round(ens_rmse, 4)}
    else:
        logger.info(f"Model NOT promoted: new RMSE {ens_rmse:.4f} vs current {current_rmse:.4f}")
        return {"promoted": False, "previous_rmse": round(current_rmse, 4),
                "new_rmse": round(ens_rmse, 4),
                "reason": "New model RMSE worse than or equal to current"}


def list_model_versions():
    versions = []
    if not os.path.isdir(VERSIONS_DIR):
        return versions
    for fname in sorted(os.listdir(VERSIONS_DIR), reverse=True):
        if fname.startswith("metrics_") and fname.endswith(".json"):
            path = os.path.join(VERSIONS_DIR, fname)
            with open(path) as f:
                data = json.load(f)
                versions.append({
                    "timestamp": data.get("timestamp", fname.replace("metrics_", "").replace(".json", "")),
                    "rmse": data.get("ensemble", {}).get("rmse"),
                    "mae": data.get("ensemble", {}).get("mae"),
                    "r2": data.get("ensemble", {}).get("r2"),
                    "training_samples": data.get("ensemble", {}).get("training_samples"),
                })
    return versions


def rollback_to_version(timestamp):
    version_model = os.path.join(VERSIONS_DIR, f"ensemble_{timestamp}.joblib")
    if not os.path.exists(version_model):
        raise FileNotFoundError(f"Version {timestamp} not found")
    prod_path = os.path.join(ARTIFACTS_DIR, "ensemble.joblib")
    shutil.copy2(version_model, prod_path)
    version_metrics = os.path.join(VERSIONS_DIR, f"metrics_{timestamp}.json")
    if os.path.exists(version_metrics):
        prod_metrics = os.path.join(ARTIFACTS_DIR, "metrics.json")
        shutil.copy2(version_metrics, prod_metrics)
    logger.info(f"Rolled back to version {timestamp}")
    return {"rolled_back": True, "version": timestamp}


def train_tabular_models(data_path: str = "data/sensor_data.csv"):
    _ensure_artifacts_dir()
    logger.info("=" * 60)
    logger.info("TABULAR MODEL TRAINING STARTED")
    logger.info("=" * 60)

    raw_df = load_tabular_data(data_path)

    if len(raw_df) < 300:
        raw_df = generate_synthetic_supplement(raw_df)

    X_scaled, y, scaler, feature_names = preprocess_tabular(raw_df)
    logger.info(f"Training set: {X_scaled.shape[0]} samples, {X_scaled.shape[1]} features")

    rf = RandomForestRegressor(n_estimators=200, max_depth=15, random_state=42, n_jobs=-1)
    gb = GradientBoostingRegressor(n_estimators=150, learning_rate=0.05, random_state=42)
    models = [("random_forest", rf), ("gradient_boosting", gb)]
    if HAS_XGB:
        xgb = XGBRegressor(n_estimators=150, learning_rate=0.1, max_depth=8, random_state=42, verbosity=0)
        models.append(("xgboost", xgb))

    ensemble = VotingRegressor(estimators=models)
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    all_metrics = {}

    for name, model in models:
        logger.info(f"\nTraining {name}...")
        neg_rmse = np.asarray(cross_val_score(model, X_scaled, y, cv=kf, scoring="neg_root_mean_squared_error"))
        r2_scores = np.asarray(cross_val_score(model, X_scaled, y, cv=kf, scoring="r2"))
        neg_mae = np.asarray(cross_val_score(model, X_scaled, y, cv=kf, scoring="neg_mean_absolute_error"))
        model.fit(X_scaled, y)

        rmse = float(-neg_rmse.mean())
        mae = float(-neg_mae.mean())
        r2 = float(r2_scores.mean())
        all_metrics[name] = {"rmse": rmse, "mae": mae, "r2": r2,
                             "rmse_std": float(neg_rmse.std()),
                             "r2_std": float(r2_scores.std())}
        path = os.path.join(ARTIFACTS_DIR, f"{name}_model.joblib")
        joblib.dump(model, path)
        logger.info(f"  RMSE: {rmse:.4f}  MAE: {mae:.4f}  R²: {r2:.4f}")

    logger.info("\nTraining ensemble (VotingRegressor)...")
    ens_neg_rmse = np.asarray(cross_val_score(ensemble, X_scaled, y, cv=kf, scoring="neg_root_mean_squared_error"))
    ens_r2_arr = np.asarray(cross_val_score(ensemble, X_scaled, y, cv=kf, scoring="r2"))
    ens_mae_arr = np.asarray(cross_val_score(ensemble, X_scaled, y, cv=kf, scoring="neg_mean_absolute_error"))
    ensemble.fit(X_scaled, y)

    ens_rmse = float(-ens_neg_rmse.mean())
    ens_mae = float(-ens_mae_arr.mean())
    ens_r2 = float(ens_r2_arr.mean())

    all_metrics["ensemble"] = {
        "rmse": ens_rmse, "mae": ens_mae, "r2": ens_r2,
        "rmse_std": float(ens_neg_rmse.std()),
        "r2_std": float(ens_r2_arr.std()),
        "training_samples": int(X_scaled.shape[0]),
    }

    result = save_model_with_versioning(ensemble, scaler, feature_names, all_metrics["ensemble"], all_metrics)

    logger.info("\n" + "=" * 60)
    logger.info("TRAINING SUMMARY")
    logger.info(f"{'Model':<25} {'RMSE':>8} {'MAE':>8} {'R²':>8}")
    logger.info("-" * 55)
    for name, m in all_metrics.items():
        logger.info(f"{name:<25} {m['rmse']:>8.4f} {m['mae']:>8.4f} {m['r2']:>8.4f}")
    logger.info("=" * 60)

    return all_metrics


def predict_yield(sensor_data: dict) -> dict:
    from model.explainability import compute_shap_values, get_top_features

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

    data = dict(sensor_data)
    if "cropType" in data and "cropTypeEncoded" not in data:
        data["cropTypeEncoded"] = CROP_TYPE_ENCODING.get(str(data.get("cropType", "TOMATO")), 0)

    feature_vector = []
    for feat in feature_names:
        val = data.get(feat)
        if val is None:
            val = 0
        feature_vector.append(float(val))

    X = np.array([feature_vector])
    X_scaled = scaler.transform(X)

    ensemble_pred = float(ensemble.predict(X_scaled)[0])

    individual = {}
    model_preds = []
    for name, model in ensemble.estimators:
        pred = float(model.predict(X_scaled)[0])
        individual[name] = pred
        model_preds.append(pred)

    pred_std = float(np.std(model_preds))
    conf_low = max(0.0, ensemble_pred - 1.5 * pred_std)
    conf_high = ensemble_pred + 1.5 * pred_std

    if ensemble_pred < 2:
        yield_category = "POOR"
    elif ensemble_pred < 4:
        yield_category = "AVERAGE"
    elif ensemble_pred < 6:
        yield_category = "GOOD"
    else:
        yield_category = "EXCELLENT"

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


# ── Sensor-Only Model (9 features) ────────────────────────────────────────────

SENSOR_ARTIFACTS_DIR = os.path.join(ARTIFACTS_DIR, "sensor")
SENSOR_VERSIONS_DIR = os.path.join(SENSOR_ARTIFACTS_DIR, "versions")


def _ensure_sensor_artifacts_dir():
    os.makedirs(SENSOR_ARTIFACTS_DIR, exist_ok=True)
    os.makedirs(SENSOR_VERSIONS_DIR, exist_ok=True)


def _load_sensor_metrics():
    metrics_path = os.path.join(SENSOR_ARTIFACTS_DIR, "metrics.json")
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            data = json.load(f)
            return data.get("ensemble", {})
    return {}


def _save_sensor_model_with_versioning(ensemble, scaler, feature_names, metrics, all_metrics):
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    ens_rmse = metrics.get("rmse", float("inf"))

    version_path = os.path.join(SENSOR_VERSIONS_DIR, f"sensor_ensemble_{timestamp}.joblib")
    joblib.dump(ensemble, version_path)

    version_metrics_path = os.path.join(SENSOR_VERSIONS_DIR, f"sensor_metrics_{timestamp}.json")
    with open(version_metrics_path, "w") as f:
        json.dump({**all_metrics, "timestamp": timestamp, "file": version_path}, f, indent=2)

    current_metrics = _load_sensor_metrics()
    current_rmse = current_metrics.get("rmse", float("inf"))

    if ens_rmse < current_rmse:
        prod_path = os.path.join(SENSOR_ARTIFACTS_DIR, "sensor_ensemble.joblib")
        if os.path.exists(prod_path):
            backup_path = os.path.join(SENSOR_VERSIONS_DIR, f"sensor_ensemble_previous_{timestamp}.joblib")
            shutil.copy2(prod_path, backup_path)
        shutil.copy2(version_path, prod_path)
        joblib.dump(scaler, os.path.join(SENSOR_ARTIFACTS_DIR, "sensor_scaler.joblib"))
        with open(os.path.join(SENSOR_ARTIFACTS_DIR, "sensor_feature_names.json"), "w") as f:
            json.dump(feature_names, f)
        with open(os.path.join(SENSOR_ARTIFACTS_DIR, "metrics.json"), "w") as f:
            json.dump(all_metrics, f, indent=2)
        logger.info(f"Sensor model PROMOTED: RMSE {current_rmse:.4f} → {ens_rmse:.4f}")
        return {"promoted": True, "previous_rmse": round(current_rmse, 4),
                "new_rmse": round(ens_rmse, 4)}
    else:
        logger.info(f"Sensor model NOT promoted: new RMSE {ens_rmse:.4f} vs current {current_rmse:.4f}")
        return {"promoted": False, "previous_rmse": round(current_rmse, 4),
                "new_rmse": round(ens_rmse, 4),
                "reason": "New model RMSE worse than or equal to current"}


def train_sensor_models(data_path: str = "data/sensor_data.csv"):
    _ensure_sensor_artifacts_dir()
    logger.info("=" * 60)
    logger.info("SENSOR-ONLY MODEL TRAINING STARTED (9 features)")
    logger.info("=" * 60)

    raw_df = load_tabular_data(data_path)
    n_real = len(raw_df)

    if n_real < 300:
        raw_df = generate_synthetic_supplement(raw_df, feature_list=SENSOR_FEATURES)
    n_total = len(raw_df)
    synthetic_ratio = 1.0 - (n_real / n_total) if n_total > 0 else 1.0

    X_scaled, y, scaler, feature_names = preprocess_tabular(raw_df, feature_list=SENSOR_FEATURES)
    logger.info(f"Sensor training set: {X_scaled.shape[0]} samples, {X_scaled.shape[1]} features")

    rf = RandomForestRegressor(n_estimators=200, max_depth=15, random_state=42, n_jobs=-1)
    gb = GradientBoostingRegressor(n_estimators=150, learning_rate=0.05, random_state=42)
    models = [("random_forest", rf), ("gradient_boosting", gb)]
    if HAS_XGB:
        xgb = XGBRegressor(n_estimators=150, learning_rate=0.1, max_depth=8, random_state=42, verbosity=0)
        models.append(("xgboost", xgb))

    ensemble = VotingRegressor(estimators=models)
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    all_metrics = {}

    for name, model in models:
        logger.info(f"\nTraining sensor {name}...")
        neg_rmse = cross_val_score(model, X_scaled, y, cv=kf, scoring="neg_root_mean_squared_error")
        r2_scores = cross_val_score(model, X_scaled, y, cv=kf, scoring="r2")
        neg_mae = cross_val_score(model, X_scaled, y, cv=kf, scoring="neg_mean_absolute_error")
        model.fit(X_scaled, y)
        rmse = float(-neg_rmse.mean())
        mae = float(-neg_mae.mean())
        r2 = float(r2_scores.mean())
        all_metrics[name] = {"rmse": rmse, "mae": mae, "r2": r2,
                             "rmse_std": float(neg_rmse.std()),
                             "r2_std": float(r2_scores.std())}
        path = os.path.join(SENSOR_ARTIFACTS_DIR, f"sensor_{name}.joblib")
        joblib.dump(model, path)
        logger.info(f"  RMSE: {rmse:.4f}  MAE: {mae:.4f}  R²: {r2:.4f}")

    logger.info("\nTraining sensor ensemble (VotingRegressor)...")
    ens_neg_rmse = cross_val_score(ensemble, X_scaled, y, cv=kf, scoring="neg_root_mean_squared_error")
    ens_r2 = cross_val_score(ensemble, X_scaled, y, cv=kf, scoring="r2")
    ens_mae = cross_val_score(ensemble, X_scaled, y, cv=kf, scoring="neg_mean_absolute_error")
    ensemble.fit(X_scaled, y)

    ens_rmse = float(-ens_neg_rmse.mean())
    ens_mae = float(-ens_mae.mean())
    ens_r2 = float(ens_r2.mean())

    all_metrics["ensemble"] = {
        "rmse": ens_rmse, "mae": ens_mae, "r2": ens_r2,
        "rmse_std": float(ens_neg_rmse.std()),
        "r2_std": float(ens_r2.std()),
        "training_samples": int(X_scaled.shape[0]),
        "synthetic_ratio": round(synthetic_ratio, 3),
        "real_samples": n_real,
    }

    result = _save_sensor_model_with_versioning(ensemble, scaler, feature_names, all_metrics["ensemble"], all_metrics)

    logger.info("\n" + "=" * 60)
    logger.info("SENSOR MODEL TRAINING SUMMARY")
    logger.info(f"  Real rows: {n_real}, Synthetic rows: {n_total - n_real}, Synthetic ratio: {synthetic_ratio:.2f}")
    logger.info(f"{'Model':<25} {'RMSE':>8} {'MAE':>8} {'R²':>8}")
    logger.info("-" * 55)
    for name, m in all_metrics.items():
        logger.info(f"{name:<25} {m['rmse']:>8.4f} {m['mae']:>8.4f} {m['r2']:>8.4f}")
    logger.info("=" * 60)

    return all_metrics


def predict_yield_sensor(sensor_data: dict) -> dict:
    ensemble_path = os.path.join(SENSOR_ARTIFACTS_DIR, "sensor_ensemble.joblib")
    scaler_path = os.path.join(SENSOR_ARTIFACTS_DIR, "sensor_scaler.joblib")
    features_path = os.path.join(SENSOR_ARTIFACTS_DIR, "sensor_feature_names.json")
    metrics_path = os.path.join(SENSOR_ARTIFACTS_DIR, "metrics.json")

    if not os.path.exists(ensemble_path):
        raise FileNotFoundError(
            "Sensor model not trained. POST /tabular/train-sensor or place sensor_data.csv in ml-engine/data/"
        )

    ensemble = joblib.load(ensemble_path)
    scaler = joblib.load(scaler_path)

    with open(features_path) as f:
        feature_names = json.load(f)

    metrics = {}
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            metrics = json.load(f).get("ensemble", {})

    data = dict(sensor_data)
    if "cropType" in data and "cropTypeEncoded" not in data:
        data["cropTypeEncoded"] = CROP_TYPE_ENCODING.get(str(data.get("cropType", "TOMATO")), 0)

    missing_fields = []
    for feat in feature_names:
        val = data.get(feat)
        if val is None or (isinstance(val, float) and np.isnan(val)):
            missing_fields.append(feat)
        elif feat == "previousYieldTons" and (val is None or val == 0):
            missing_fields.append(feat)

    if "previousYieldTons" in missing_fields or data.get("previousYieldTons") in (None, 0):
        crop_enc = int(data.get("cropTypeEncoded", 0))
        data["previousYieldTons"] = REGIONAL_MEDIANS.get(crop_enc, DEFAULT_REGIONAL_MEDIAN)
        if "previousYieldTons" not in missing_fields:
            missing_fields.append("previousYieldTons")

    feature_vector = []
    for feat in feature_names:
        val = data.get(feat, 0)
        if val is None:
            val = 0
        feature_vector.append(float(val))

    X = np.array([feature_vector])
    X_scaled = scaler.transform(X)

    ensemble_pred = float(ensemble.predict(X_scaled)[0])

    individual = {}
    model_preds = []
    for name, model in ensemble.estimators:
        pred = float(model.predict(X_scaled)[0])
        individual[name] = pred
        model_preds.append(pred)

    pred_std = float(np.std(model_preds))
    conf_low = max(0.0, ensemble_pred - 1.5 * pred_std)
    conf_high = ensemble_pred + 1.5 * pred_std

    missing_count = len(missing_fields)
    conf_penalty = min(missing_count * 0.08, 0.40)

    # Downgrade confidence if model trained on mostly synthetic data
    if metrics.get("synthetic_ratio", 0) > 0.5:
        conf_penalty = min(conf_penalty + 0.2, 0.6)

    conf_low = max(0, conf_low * (1 - conf_penalty))
    conf_high = conf_high * (1 - conf_penalty * 0.5)

    if ensemble_pred < 2:
        yield_category = "POOR"
    elif ensemble_pred < 4:
        yield_category = "AVERAGE"
    elif ensemble_pred < 6:
        yield_category = "GOOD"
    else:
        yield_category = "EXCELLENT"

    result = {
        "predictedYieldTons": round(ensemble_pred, 3),
        "confidenceLow": round(conf_low, 3),
        "confidenceHigh": round(conf_high, 3),
        "yieldCategory": yield_category,
        "individualPredictions": {k: round(v, 3) for k, v in individual.items()},
        "missingFields": missing_fields,
        "missingCount": missing_count,
        "confidencePenalty": round(conf_penalty, 3),
    }

    if metrics.get("synthetic_ratio", 0) > 0.5:
        result["earlyModel"] = True

    return result
