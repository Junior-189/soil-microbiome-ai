"""
Feature definitions for both AI models.
"""

TABULAR_FEATURES = [
    "soilMoisture",
    "soilTemperature",
    "soilPh",
    "electricalConductivity",
    "bulkDensity",
    "organicMatter",
    "nitrogenPpm",
    "phosphorusPpm",
    "potassiumPpm",
    "calciumPpm",
    "magnesiumPpm",
    "sulfurPpm",
    "microbialDiversityIndex",
    "nitrogenFixingBacteriaRatio",
    "mycorrhizalFungiPresence",
    "pathogenicFungiRatio",
    "bacterialCountCfu",
    "rainfallMm",
    "ambientTemperature",
    "humidity",
    "fertilizerKgPerHa",
    "previousYieldTons",
    "growingSeasonDays",
    "cropTypeEncoded",
]

TARGET = "yieldTonsPerHa"

FEATURE_METADATA = {
    "soilMoisture": {
        "unit": "%",
        "description": "Volumetric soil moisture content",
        "optimal_min": 40,
        "optimal_max": 70,
    },
    "soilTemperature": {
        "unit": "°C",
        "description": "Soil temperature at 10cm depth",
        "optimal_min": 15,
        "optimal_max": 30,
    },
    "soilPh": {
        "unit": "pH",
        "description": "Soil acidity/alkalinity level",
        "optimal_min": 5.5,
        "optimal_max": 7.5,
    },
    "electricalConductivity": {
        "unit": "dS/m",
        "description": "Soil electrical conductivity (salinity)",
        "optimal_min": 0.2,
        "optimal_max": 2.0,
    },
    "bulkDensity": {
        "unit": "g/cm³",
        "description": "Soil bulk density (compaction)",
        "optimal_min": 1.0,
        "optimal_max": 1.4,
    },
    "organicMatter": {
        "unit": "%",
        "description": "Soil organic matter content",
        "optimal_min": 3.0,
        "optimal_max": 6.0,
    },
    "nitrogenPpm": {
        "unit": "ppm",
        "description": "Available nitrogen in soil",
        "optimal_min": 20,
        "optimal_max": 60,
    },
    "phosphorusPpm": {
        "unit": "ppm",
        "description": "Available phosphorus in soil",
        "optimal_min": 15,
        "optimal_max": 40,
    },
    "potassiumPpm": {
        "unit": "ppm",
        "description": "Available potassium in soil",
        "optimal_min": 100,
        "optimal_max": 300,
    },
    "calciumPpm": {
        "unit": "ppm",
        "description": "Available calcium in soil",
        "optimal_min": 500,
        "optimal_max": 2000,
    },
    "magnesiumPpm": {
        "unit": "ppm",
        "description": "Available magnesium in soil",
        "optimal_min": 50,
        "optimal_max": 200,
    },
    "sulfurPpm": {
        "unit": "ppm",
        "description": "Available sulfur in soil",
        "optimal_min": 10,
        "optimal_max": 50,
    },
    "microbialDiversityIndex": {
        "unit": "Shannon index",
        "description": "Shannon diversity index of soil microbiome",
        "optimal_min": 4.0,
        "optimal_max": 7.0,
    },
    "nitrogenFixingBacteriaRatio": {
        "unit": "%",
        "description": "Percentage of nitrogen-fixing bacteria in microbiome",
        "optimal_min": 15,
        "optimal_max": 40,
    },
    "mycorrhizalFungiPresence": {
        "unit": "bool",
        "description": "Presence of beneficial mycorrhizal fungi (0=absent, 1=present)",
        "optimal_min": 1,
        "optimal_max": 1,
    },
    "pathogenicFungiRatio": {
        "unit": "%",
        "description": "Percentage of pathogenic fungi in microbiome",
        "optimal_min": 0,
        "optimal_max": 5.0,
    },
    "bacterialCountCfu": {
        "unit": "CFU×10⁶/g",
        "description": "Total bacterial count in colony forming units",
        "optimal_min": 10,
        "optimal_max": 100,
    },
    "rainfallMm": {
        "unit": "mm",
        "description": "Rainfall in the past 7 days",
        "optimal_min": 10,
        "optimal_max": 50,
    },
    "ambientTemperature": {
        "unit": "°C",
        "description": "Ambient air temperature",
        "optimal_min": 18,
        "optimal_max": 32,
    },
    "humidity": {
        "unit": "%",
        "description": "Relative humidity",
        "optimal_min": 50,
        "optimal_max": 80,
    },
    "fertilizerKgPerHa": {
        "unit": "kg/ha",
        "description": "Fertilizer applied in current season",
        "optimal_min": 100,
        "optimal_max": 400,
    },
    "previousYieldTons": {
        "unit": "tons/ha",
        "description": "Yield from previous growing season",
        "optimal_min": 3,
        "optimal_max": 8,
    },
    "growingSeasonDays": {
        "unit": "days",
        "description": "Length of current growing season",
        "optimal_min": 90,
        "optimal_max": 150,
    },
    "cropTypeEncoded": {
        "unit": "int",
        "description": "Crop type (0=Tomato, 1=Corn, 2=Mixed)",
        "optimal_min": 0,
        "optimal_max": 2,
    },
}

CROP_TYPE_ENCODING = {"TOMATO": 0, "CORN": 1, "MIXED": 2}

CNN_DATASETS = {
    # Soil type classification — 7 classes, CyAUG augmented dataset
    "soil":   {"path": "data/soil/CyAUG-Dataset", "img_size": 224},
    # Disease classifier — potato images used (pattern matching handles Potato___ names)
    "tomato": {"path": "data/potato",             "img_size": 224},
    # Corn disease classifier — images live inside an extra data/ subfolder
    "corn":   {"path": "data/corn/data",           "img_size": 224},
}

def get_yield_impact_note(predicted_class: str) -> str:
    """
    Pattern-based yield impact note. Works regardless of exact folder/class name —
    matches Tomato___, Potato___, Corn___, Soil___, etc. via substring matching.
    """
    c = predicted_class.lower()

    if "healthy" in c:
        return "No disease detected. Optimal yield expected."
    elif "early_blight" in c or "early blight" in c:
        return "Early blight detected. Estimated 20–35% yield reduction if untreated."
    elif "late_blight" in c or "late blight" in c:
        return "Late blight detected. Severe risk — 40–100% yield loss possible. Immediate action required."
    elif "leaf_mold" in c or "leaf mold" in c:
        return "Leaf mold detected. 15–25% yield reduction expected. Improve ventilation."
    elif "septoria" in c:
        return "Septoria leaf spot detected. 10–20% yield reduction. Apply copper-based fungicide."
    elif "spider_mite" in c or "spider mite" in c:
        return "Spider mite infestation. 10–30% yield reduction. Apply miticide or predatory mites."
    elif "target_spot" in c or "target spot" in c:
        return "Target spot detected. 10–20% yield reduction. Fungicide and crop rotation recommended."
    elif "yellow_leaf_curl" in c or "ylcv" in c:
        return "Yellow leaf curl virus detected. Up to 70–100% yield loss. Immediate action required."
    elif "mosaic_virus" in c or "mosaic virus" in c:
        return "Mosaic virus detected. 10–25% yield loss. Remove infected plants, sanitize tools."
    elif "bacterial_spot" in c or "bacterial spot" in c:
        return "Bacterial spot detected. 15–30% yield loss. Apply copper bactericide."
    elif "common_rust" in c or "common rust" in c:
        return "Common rust detected. 10–35% yield reduction in susceptible varieties."
    elif "northern_leaf_blight" in c or "northern blight" in c:
        return "Northern leaf blight. 30–50% yield loss possible. Fungicide at VT stage."
    elif "cercospora" in c or "gray_leaf_spot" in c:
        return "Gray leaf spot detected. 5–25% yield reduction. Plant resistant hybrids next season."
    elif "dry" in c:
        return "Soil appears dry. Irrigation and mulching recommended immediately."
    elif "degrad" in c:
        return "Soil degradation visible. Apply compost and consider cover cropping."
    elif "waterlog" in c:
        return "Waterlogging detected. Root hypoxia risk — drainage intervention required."
    else:
        return f"Condition '{predicted_class}' detected. Monitor crop closely and consult agronomist."


def get_health_status(predicted_class: str, confidence: float) -> str:
    """
    Pattern-based health status mapping. Works with any class name format.
    """
    if "healthy" in predicted_class.lower():
        return "HEALTHY"
    elif confidence < 0.6:
        return "AT_RISK"
    elif confidence < 0.85:
        return "DISEASED"
    else:
        return "CRITICAL"
