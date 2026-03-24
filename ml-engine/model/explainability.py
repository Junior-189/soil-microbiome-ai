"""
SHAP-based explainability for tabular model predictions.
"""

import os
import logging
import json
import numpy as np

logger = logging.getLogger(__name__)

_shap_cache = {}  # module-level cache

ARTIFACTS_DIR = "model/artifacts/tabular"


def compute_shap_values(input_data: dict, model_type: str = "ensemble") -> dict:
    """
    Compute SHAP values for a single prediction.
    Uses TreeExplainer on the Random Forest component of the ensemble.
    """
    try:
        import shap
        import joblib
    except ImportError:
        logger.warning("SHAP or joblib not available — returning empty SHAP values")
        return {}

    # Cache key
    try:
        cache_key = hash(frozenset(
            (k, round(float(v), 4) if isinstance(v, (int, float)) else str(v))
            for k, v in input_data.items()
        ))
    except Exception:
        cache_key = None

    if cache_key and cache_key in _shap_cache:
        return _shap_cache[cache_key]

    try:
        scaler_path = os.path.join(ARTIFACTS_DIR, "scaler.joblib")
        rf_path = os.path.join(ARTIFACTS_DIR, "random_forest_model.joblib")
        features_path = os.path.join(ARTIFACTS_DIR, "feature_names.json")

        if not all(os.path.exists(p) for p in [scaler_path, rf_path, features_path]):
            logger.warning("Model artifacts not found for SHAP computation")
            return {}

        scaler = joblib.load(scaler_path)
        rf_model = joblib.load(rf_path)

        with open(features_path) as f:
            feature_names = json.load(f)

        from model.features import CROP_TYPE_ENCODING
        data = dict(input_data)
        if "cropType" in data and "cropTypeEncoded" not in data:
            data["cropTypeEncoded"] = CROP_TYPE_ENCODING.get(str(data.get("cropType", "TOMATO")), 0)

        feature_vector = [float(data.get(feat, 0)) for feat in feature_names]
        X = np.array([feature_vector])
        X_scaled = scaler.transform(X)

        explainer = shap.TreeExplainer(rf_model)
        shap_vals = explainer.shap_values(X_scaled)

        # shap_vals may be a list (multi-output) or 2D array
        if isinstance(shap_vals, list):
            sv = shap_vals[0][0]
        else:
            sv = shap_vals[0]

        result = {name: round(float(val), 4) for name, val in zip(feature_names, sv)}

        if cache_key:
            _shap_cache[cache_key] = result

        return result

    except Exception as e:
        logger.warning(f"SHAP computation error: {e}")
        return {}


def get_top_features(shap_values: dict, n: int = 10) -> list:
    """
    Return top n features sorted by absolute SHAP value with interpretation.
    """
    from model.features import FEATURE_METADATA

    if not shap_values:
        return []

    sorted_features = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)
    top_n = sorted_features[:n]

    results = []
    for feature, shap_val in top_n:
        direction = "positive" if shap_val >= 0 else "negative"
        meta = FEATURE_METADATA.get(feature, {})
        unit = meta.get("unit", "")
        desc = meta.get("description", feature)
        abs_val = abs(shap_val)

        # Human-readable interpretation
        if direction == "positive":
            action = "boosting"
            sign = "+"
        else:
            action = "reducing"
            sign = ""

        interpretation = (
            f"{desc} is {action} the predicted yield by "
            f"{sign}{shap_val:.3f} tons/ha"
        )

        if unit and unit not in ("bool", "int"):
            interpretation = (
                f"{desc} ({unit}) is {action} the predicted yield by "
                f"{sign}{shap_val:.3f} tons/ha"
            )

        results.append({
            "feature": feature,
            "shapValue": shap_val,
            "direction": direction,
            "interpretation": interpretation,
        })

    return results
