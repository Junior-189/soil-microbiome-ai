"""
Data preprocessing for both tabular and image models.
"""

import os
import logging
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_class_weight
from tensorflow.keras.preprocessing.image import ImageDataGenerator

from model.features import TABULAR_FEATURES, TARGET, CROP_TYPE_ENCODING, CNN_DATASETS

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Column name aliases -> canonical schema names
COLUMN_MAP = {
    "ph": "soilPh",
    "pH": "soilPh",
    "moisture": "soilMoisture",
    "moisture_%": "soilMoisture",
    "temp": "soilTemperature",
    "temperature": "soilTemperature",
    "N": "nitrogenPpm",
    "nitrogen": "nitrogenPpm",
    "P": "phosphorusPpm",
    "phosphorus": "phosphorusPpm",
    "K": "potassiumPpm",
    "potassium": "potassiumPpm",
    "EC": "electricalConductivity",
    "yield": "yieldTonsPerHa",
    "Yield": "yieldTonsPerHa",
    "crop": "cropTypeEncoded",
    "crop_type": "cropTypeEncoded",
}


def load_tabular_data(csv_path: str) -> pd.DataFrame:
    """Load CSV and rename columns using COLUMN_MAP."""
    logger.info(f"Loading tabular data from: {csv_path}")
    df = pd.read_csv(csv_path)
    logger.info(f"Loaded {len(df)} rows, {len(df.columns)} columns")

    renames = {}
    for old_name, new_name in COLUMN_MAP.items():
        if old_name in df.columns and new_name not in df.columns:
            renames[old_name] = new_name

    if renames:
        df.rename(columns=renames, inplace=True)
        for old_name, new_name in renames.items():
            logger.info(f"  Renamed column: '{old_name}' -> '{new_name}'")

    return df


def validate_and_align(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure all TABULAR_FEATURES exist; add missing columns filled with 0."""
    for feature in TABULAR_FEATURES:
        if feature not in df.columns:
            df[feature] = 0
            logger.warning(f"  Missing feature '{feature}' — added with default value 0")
    return df


def preprocess_tabular(df: pd.DataFrame):
    """
    Encode, fill missing, align, and scale tabular data.
    Returns: (X_scaled, y, scaler, feature_names)
    """
    # Encode crop type if string
    if "cropTypeEncoded" in df.columns and df["cropTypeEncoded"].dtype == object:
        df["cropTypeEncoded"] = df["cropTypeEncoded"].map(CROP_TYPE_ENCODING).fillna(0)
        logger.info("Encoded cropTypeEncoded from string to int")

    # Also handle 'cropType' column
    if "cropType" in df.columns and "cropTypeEncoded" not in df.columns:
        df["cropTypeEncoded"] = df["cropType"].map(CROP_TYPE_ENCODING).fillna(0)
        logger.info("Created cropTypeEncoded from cropType column")

    df = validate_and_align(df)

    # Fill missing values with column medians
    for col in TABULAR_FEATURES:
        if df[col].isnull().any():
            median_val = df[col].median()
            df[col] = df[col].fillna(median_val)

    # Target variable
    if TARGET not in df.columns:
        raise ValueError(
            f"Target column '{TARGET}' not found in data. "
            "Ensure your CSV has a 'yieldTonsPerHa' column (or 'yield'/'Yield')."
        )

    # Fill target nulls with median
    df[TARGET] = df[TARGET].fillna(df[TARGET].median())

    X = df[TABULAR_FEATURES].values
    y = df[TARGET].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    logger.info(f"Preprocessed {len(X)} samples with {len(TABULAR_FEATURES)} features")
    return X_scaled, y, scaler, TABULAR_FEATURES


def generate_synthetic_supplement(real_df: pd.DataFrame, n: int = 500) -> pd.DataFrame:
    """
    If real_df has fewer than 300 rows, generate n synthetic rows using
    agronomic rules to simulate realistic yield relationships.
    """
    if len(real_df) >= 300:
        return real_df

    logger.info(
        f"Only {len(real_df)} real rows found — generating {n} synthetic rows to supplement"
    )

    rows = []
    for _ in range(n):
        row = {}
        for col in TABULAR_FEATURES:
            if col in real_df.columns:
                mean = real_df[col].mean() if real_df[col].notna().any() else 0
                std = real_df[col].std() if real_df[col].notna().any() else 1
                std = max(std, 0.01)
                row[col] = np.random.normal(mean, std)
            else:
                row[col] = 0

        # Clamp to realistic ranges
        row["soilPh"] = np.clip(row["soilPh"], 4.0, 9.0)
        row["soilMoisture"] = np.clip(row["soilMoisture"], 5, 100)
        row["soilTemperature"] = np.clip(row["soilTemperature"], 5, 45)
        row["organicMatter"] = max(row["organicMatter"], 0.1)
        row["nitrogenPpm"] = max(row["nitrogenPpm"], 0)
        row["microbialDiversityIndex"] = max(row["microbialDiversityIndex"], 0)
        row["nitrogenFixingBacteriaRatio"] = np.clip(row["nitrogenFixingBacteriaRatio"], 0, 50)
        row["pathogenicFungiRatio"] = max(row["pathogenicFungiRatio"], 0)
        row["mycorrhizalFungiPresence"] = 1.0 if np.random.random() > 0.4 else 0.0
        row["cropTypeEncoded"] = int(np.random.choice([0, 1, 2]))

        # Agronomic yield rules
        base_yield = real_df[TARGET].mean() if TARGET in real_df.columns else 4.5
        noise = np.random.normal(0, base_yield * 0.1)
        yield_val = base_yield + noise

        # Shannon diversity 4-7 -> +15-25%
        mdi = row["microbialDiversityIndex"]
        if 4 <= mdi <= 7:
            yield_val *= np.random.uniform(1.15, 1.25)

        # pH 6-7 -> +10%
        if 6.0 <= row["soilPh"] <= 7.0:
            yield_val *= 1.10

        # pathogenic fungi > 10 -> -15 to -30%
        if row["pathogenicFungiRatio"] > 10:
            yield_val *= np.random.uniform(0.70, 0.85)

        # nitrogenPpm < 20 -> -10 to -20%
        if row["nitrogenPpm"] < 20:
            yield_val *= np.random.uniform(0.80, 0.90)

        # organicMatter > 3 -> +12%
        if row["organicMatter"] > 3:
            yield_val *= 1.12

        # mycorrhizalFungiPresence -> +8%
        if row["mycorrhizalFungiPresence"] >= 1:
            yield_val *= 1.08

        row[TARGET] = max(yield_val, 0.1)
        row["source"] = "synthetic"
        rows.append(row)

    synthetic_df = pd.DataFrame(rows)
    combined = pd.concat([real_df, synthetic_df], ignore_index=True)
    logger.info(f"Combined dataset: {len(combined)} rows ({len(real_df)} real + {n} synthetic)")
    return combined


def build_image_generators(dataset_name: str, img_size: int = 224):
    """
    Build Keras ImageDataGenerators with augmentation from data/{dataset_name}/.
    Returns: (train_gen, val_gen, class_indices)
    """
    data_path = CNN_DATASETS.get(dataset_name, {}).get("path", os.path.join("data", dataset_name))
    if not os.path.isdir(data_path):
        raise FileNotFoundError(f"Dataset directory not found: {data_path}")

    datagen = ImageDataGenerator(
        preprocessing_function=tf.keras.applications.efficientnet.preprocess_input,
        rotation_range=40,
        width_shift_range=0.3,
        height_shift_range=0.3,
        horizontal_flip=True,
        vertical_flip=True,
        zoom_range=0.3,
        shear_range=0.2,
        brightness_range=[0.7, 1.3],
        fill_mode="nearest",
        validation_split=0.2,
    )

    val_datagen = ImageDataGenerator(
        preprocessing_function=tf.keras.applications.efficientnet.preprocess_input,
        validation_split=0.2,
    )

    train_gen = datagen.flow_from_directory(
        data_path,
        target_size=(img_size, img_size),
        batch_size=32,
        class_mode="categorical",
        subset="training",
        shuffle=True,
    )

    val_gen = val_datagen.flow_from_directory(
        data_path,
        target_size=(img_size, img_size),
        batch_size=32,
        class_mode="categorical",
        subset="validation",
        shuffle=False,
    )

    logger.info(
        f"Dataset '{dataset_name}': {train_gen.samples} train, {val_gen.samples} val, "
        f"{len(train_gen.class_indices)} classes: {list(train_gen.class_indices.keys())}"
    )

    return train_gen, val_gen, train_gen.class_indices


def get_class_weights(generator) -> dict:
    """Compute balanced class weights with clipping to prevent training instability."""
    y = generator.classes
    classes = np.unique(y)
    weights = compute_class_weight(class_weight="balanced", classes=classes, y=y)
    class_weight_dict = dict(zip(classes, weights))

    # Clip extreme ratios — anything beyond 10:1 can cause gradient explosion
    max_w = max(class_weight_dict.values())
    min_w = min(class_weight_dict.values())
    if max_w / (min_w + 1e-9) > 10:
        class_weight_dict = {k: min(v, min_w * 5) for k, v in class_weight_dict.items()}
        logger.info("Class weights clipped to prevent instability (ratio was >10:1)")

    logger.info(f"Class weights: {class_weight_dict}")
    return class_weight_dict
