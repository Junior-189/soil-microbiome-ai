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
}

DEFAULT_REGIONAL_MEDIAN = 5.0
