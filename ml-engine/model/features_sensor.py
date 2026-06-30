SENSOR_FEATURES = [
    "soilMoisture",
    "soilTemperature",
    "soilPh",
    "electricalConductivity",
    "organicMatter",
    "nitrogenPpm",
    "phosphorusPpm",
    "potassiumPpm",
    "cropTypeEncoded",
]

SENSOR_TARGET = "yieldTonsPerHa"

REGIONAL_MEDIANS = {
    0: 5.5,   # TOMATO
    1: 6.0,   # CORN
    2: 5.0,   # MIXED
    3: 1.5,   # BEANS
    4: 12.0,  # POTATO
    5: 1.5,   # SUNFLOWER
    6: 15.0,  # CASSAVA
    7: 1.0,   # MILLET
}

DEFAULT_REGIONAL_MEDIAN = 5.0
