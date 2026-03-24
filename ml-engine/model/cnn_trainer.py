"""
CNN image classification model using EfficientNetB0 with transfer learning.
Trains three independent models: soil, tomato, corn.
"""

import math
import os
import json
import logging
from io import BytesIO

import numpy as np
from PIL import Image

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

CNN_ARTIFACTS_DIR = "model/artifacts/cnn"


def _ensure_artifacts_dir():
    os.makedirs(CNN_ARTIFACTS_DIR, exist_ok=True)


def get_cosine_lr_schedule(initial_lr: float, total_epochs: int):
    """Cosine decay learning rate schedule for fine-tuning."""
    import tensorflow as tf

    def lr_schedule(epoch):
        cosine_decay = 0.5 * (1 + math.cos(math.pi * epoch / total_epochs))
        return initial_lr * cosine_decay

    return tf.keras.callbacks.LearningRateScheduler(lr_schedule, verbose=0)


def build_efficientnet_model(num_classes: int, img_size: int = 224):
    """
    Build EfficientNetB0 transfer learning model.
    BUG 1 FIX: No rescale — EfficientNet preprocessing is applied in the generator.
    BUG 4 FIX: Simplified head with BatchNorm; reduced Dropout for small datasets.
    """
    import tensorflow as tf
    from tensorflow.keras.applications import EfficientNetB0
    from tensorflow.keras.layers import (
        GlobalAveragePooling2D, Dense, Dropout, BatchNormalization
    )
    from tensorflow.keras.optimizers import Adam

    base = EfficientNetB0(
        weights="imagenet",
        include_top=False,
        input_shape=(img_size, img_size, 3),
    )
    base.trainable = False  # Freeze all base layers for Phase 1

    inputs = tf.keras.Input(shape=(img_size, img_size, 3))
    x = base(inputs, training=False)
    x = GlobalAveragePooling2D()(x)
    x = BatchNormalization()(x)            # stabilises activations after pooling
    x = Dense(256, activation="relu")(x)
    x = BatchNormalization()(x)            # reduces internal covariate shift
    x = Dropout(0.3)(x)                    # reduced from 0.4 for small datasets
    outputs = Dense(num_classes, activation="softmax")(x)

    model = tf.keras.Model(inputs, outputs)
    model.compile(
        optimizer=Adam(learning_rate=0.001),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    logger.info(f"Built EfficientNetB0 model: {num_classes} classes")
    return model, base


def train_cnn_model(dataset_name: str):
    """
    Train a CNN model for the given dataset (soil/tomato/corn).
    Two-phase: feature extraction then fine-tuning.

    BUG 1 FIX: EfficientNet preprocessing applied in generators (preprocessor.py).
    BUG 2 FIX: Phase 2 ModelCheckpoint uses initial_value_threshold from Phase 1 best.
    BUG 4 FIX: Phase 1 runs 10 epochs; Phase 2 runs 25 with cosine LR and unfreeze 30 layers.
    """
    import tensorflow as tf
    from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau
    from tensorflow.keras.optimizers import Adam
    from sklearn.metrics import classification_report

    from model.preprocessor import build_image_generators, get_class_weights

    _ensure_artifacts_dir()

    logger.info(f"\n{'=' * 60}")
    logger.info(f"CNN TRAINING: {dataset_name.upper()}")
    logger.info(f"{'=' * 60}")

    train_gen, val_gen, class_indices = build_image_generators(dataset_name)
    num_classes = len(class_indices)

    if num_classes < 2:
        logger.error(f"Need at least 2 classes in {dataset_name} dataset, found {num_classes}")
        return

    class_weights = get_class_weights(train_gen)
    best_model_path = os.path.join(CNN_ARTIFACTS_DIR, f"{dataset_name}_model.keras")

    model, base = build_efficientnet_model(num_classes)

    # -------------------------
    # Phase 1: Feature extraction (10 epochs, base frozen)
    # BUG 4 FIX: 10 epochs instead of 5; patience=5 instead of 3
    # -------------------------
    logger.info("\nPhase 1: Feature extraction (base frozen, up to 10 epochs)...")
    p1_callbacks = [
        ModelCheckpoint(
            best_model_path,
            save_best_only=True,
            monitor="val_accuracy",
            mode="max",
            verbose=1,
        ),
        EarlyStopping(patience=5, restore_best_weights=True, monitor="val_accuracy"),
    ]

    history1 = model.fit(
        train_gen,
        epochs=10,
        validation_data=val_gen,
        callbacks=p1_callbacks,
        class_weight=class_weights,
        verbose=1,
    )

    # Track the best val_accuracy achieved in Phase 1
    best_phase1_acc = max(history1.history.get("val_accuracy", [0.0]))
    logger.info(f"\nPhase 1 best val_accuracy: {best_phase1_acc:.4f}")

    # -------------------------
    # Phase 2: Fine-tuning (unfreeze last 30 base layers)
    # BUG 2 FIX: initial_value_threshold prevents Phase 2 from overwriting Phase 1's best.
    # BUG 4 FIX: 30 layers unfrozen (not 20), LR=0.00005, 25 epochs, patience=8.
    # -------------------------
    logger.info("\nPhase 2: Fine-tuning (unfreeze last 30 base layers, up to 25 epochs)...")
    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False

    # Reload best weights from Phase 1 before compiling
    if os.path.exists(best_model_path):
        model.load_weights(best_model_path)
        logger.info("Loaded Phase 1 best weights for fine-tuning")

    model.compile(
        optimizer=Adam(learning_rate=0.00005),   # more conservative for fine-tuning
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    # BUG 2 FIX: Phase 2 checkpoint only saves if it beats Phase 1's best accuracy.
    checkpoint_phase2 = ModelCheckpoint(
        filepath=best_model_path,
        monitor="val_accuracy",
        save_best_only=True,
        mode="max",
        verbose=1,
        initial_value_threshold=best_phase1_acc,
    )

    p2_callbacks = [
        checkpoint_phase2,
        EarlyStopping(patience=8, restore_best_weights=True, monitor="val_accuracy"),
        get_cosine_lr_schedule(initial_lr=0.00005, total_epochs=25),
        ReduceLROnPlateau(monitor="val_loss", patience=5, factor=0.5, min_lr=1e-7, verbose=1),
    ]

    model.fit(
        train_gen,
        epochs=25,
        validation_data=val_gen,
        callbacks=p2_callbacks,
        class_weight=class_weights,
        verbose=1,
    )

    # -------------------------
    # Evaluation
    # -------------------------
    logger.info("\nEvaluating model...")

    # Load best saved weights (whichever phase won)
    if os.path.exists(best_model_path):
        model.load_weights(best_model_path)

    val_loss, val_acc = model.evaluate(val_gen, verbose=0)

    val_gen.reset()
    y_pred_proba = model.predict(val_gen, verbose=0)
    y_pred = np.argmax(y_pred_proba, axis=1)
    y_true = val_gen.classes

    label_names = [k for k, v in sorted(class_indices.items(), key=lambda x: x[1])]
    report = classification_report(y_true, y_pred, target_names=label_names, output_dict=True)

    # Save class indices
    with open(os.path.join(CNN_ARTIFACTS_DIR, f"{dataset_name}_classes.json"), "w") as f:
        json.dump(class_indices, f, indent=2)

    # Append metrics
    metrics_path = os.path.join(CNN_ARTIFACTS_DIR, "cnn_metrics.json")
    existing = {}
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            existing = json.load(f)

    existing[dataset_name] = {
        "accuracy": round(float(val_acc), 4),
        "loss": round(float(val_loss), 4),
        "num_classes": num_classes,
        "training_samples": train_gen.samples,
        "validation_samples": val_gen.samples,
        "class_indices": class_indices,
        "per_class": {
            cls: {
                "precision": round(report[cls]["precision"], 4),
                "recall": round(report[cls]["recall"], 4),
                "f1_score": round(report[cls]["f1-score"], 4),
                "support": int(report[cls]["support"]),
            }
            for cls in label_names
            if cls in report
        },
    }

    with open(metrics_path, "w") as f:
        json.dump(existing, f, indent=2)

    logger.info(f"\n{dataset_name} CNN: val_accuracy={val_acc:.4f}, val_loss={val_loss:.4f}")
    logger.info(f"Model saved to {best_model_path}")
    return existing[dataset_name]


def train_all_cnn_models():
    """Train CNN models for all available datasets."""
    from model.features import CNN_DATASETS

    results = {}

    for dataset in CNN_DATASETS:
        data_path = CNN_DATASETS[dataset]["path"]
        if not os.path.isdir(data_path):
            logger.warning(f"No data found at {data_path}/ — skipping.")
            continue

        subdirs = [
            d
            for d in os.listdir(data_path)
            if os.path.isdir(os.path.join(data_path, d))
        ]
        if not subdirs:
            logger.warning(f"No class subdirectories found in {data_path}/ — skipping.")
            continue

        has_images = False
        for subdir in subdirs:
            subdir_path = os.path.join(data_path, subdir)
            files = [
                f for f in os.listdir(subdir_path)
                if f.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".tiff"))
            ]
            if files:
                has_images = True
                break

        if not has_images:
            logger.warning(
                f"No images found in {data_path}/ subdirectories — skipping. "
                "Add images organized in class folders."
            )
            continue

        try:
            results[dataset] = train_cnn_model(dataset)
        except Exception as e:
            logger.error(f"Failed to train {dataset} CNN: {e}")

    return results


def predict_image_from_bytes(image_bytes: bytes, dataset_type: str) -> dict:
    """
    Run CNN inference on raw image bytes.

    BUG 1 FIX: Uses EfficientNet preprocess_input instead of naive /255 normalisation.
    BUG 3 FIX: Uses pattern-based get_yield_impact_note() and get_health_status()
               instead of hardcoded exact class-name lookups.
    """
    import tensorflow as tf
    from tensorflow.keras.applications.efficientnet import preprocess_input
    from fastapi import HTTPException

    from model.features import get_yield_impact_note, get_health_status

    model_path = os.path.join(CNN_ARTIFACTS_DIR, f"{dataset_type}_model.keras")
    classes_path = os.path.join(CNN_ARTIFACTS_DIR, f"{dataset_type}_classes.json")

    if not os.path.exists(model_path):
        raise HTTPException(
            status_code=422,
            detail=(
                f"{dataset_type} CNN model not trained yet. "
                f"Add images to ml-engine/data/{dataset_type}/ organised in class folders, "
                f"then POST /image/train to train the model."
            ),
        )

    model = tf.keras.models.load_model(model_path)

    with open(classes_path) as f:
        class_indices = json.load(f)

    idx_to_class = {v: k for k, v in class_indices.items()}

    # BUG 1 FIX: use EfficientNet preprocessing (not /255)
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    img = img.resize((224, 224))
    img_array = np.array(img, dtype=np.float32)
    img_array = preprocess_input(img_array)
    img_array = np.expand_dims(img_array, axis=0)

    preds = model.predict(img_array, verbose=0)[0]
    top_idx = int(np.argmax(preds))
    predicted_class = idx_to_class[top_idx]
    confidence = float(preds[top_idx])

    all_class_scores = {
        idx_to_class[i]: round(float(preds[i]), 4) for i in range(len(preds))
    }

    # BUG 3 FIX: pattern-based functions — work with any class name format
    health_status = get_health_status(predicted_class, confidence)
    yield_impact_note = get_yield_impact_note(predicted_class)

    return {
        "predictedClass": predicted_class,
        "confidence": round(confidence, 4),
        "healthStatus": health_status,
        "allClassScores": all_class_scores,
        "yieldImpactNote": yield_impact_note,
        "modelVersion": "1.0.0",
    }
