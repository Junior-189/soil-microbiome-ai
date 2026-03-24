"""
Rule-based recommendation engine for soil sensor predictions and image analysis.
"""

from typing import List, Dict, Any


def generate_soil_recommendations(sensor_data: dict, shap_values: dict) -> List[Dict[str, Any]]:
    """
    Generate agronomic recommendations based on sensor readings and SHAP values.
    Returns list of recommendation dicts.
    """
    recommendations = []

    def add(category, title, description, severity, action_items):
        recommendations.append({
            "category": category,
            "title": title,
            "description": description,
            "severity": severity,
            "actionItems": action_items,
        })

    n = float(sensor_data.get("nitrogenPpm", 30))
    p = float(sensor_data.get("phosphorusPpm", 20))
    k = float(sensor_data.get("potassiumPpm", 150))
    ph = float(sensor_data.get("soilPh", 6.5))
    om = float(sensor_data.get("organicMatter", 3.0))
    moisture = float(sensor_data.get("soilMoisture", 50))
    mdi = float(sensor_data.get("microbialDiversityIndex", 4.0))
    nfb = float(sensor_data.get("nitrogenFixingBacteriaRatio", 20))
    myc = bool(sensor_data.get("mycorrhizalFungiPresence", False))
    path_fungi = float(sensor_data.get("pathogenicFungiRatio", 2.0))
    humidity = float(sensor_data.get("humidity", 60))
    rainfall = float(sensor_data.get("rainfallMm", 20))

    # ----- FERTILIZER -----
    if n < 20 and nfb < 15:
        add(
            "FERTILIZER",
            "Critical Nitrogen Deficiency",
            "Both soil nitrogen and nitrogen-fixing bacteria are below optimal levels. "
            "Immediate nitrogen amendment is required to prevent significant yield loss.",
            "HIGH",
            [
                "Apply urea or ammonium nitrate at 80–120 kg N/ha",
                "Inoculate with Rhizobium or Azospirillum biofertilizer",
                "Consider slow-release nitrogen fertilizer to reduce leaching",
                "Re-test soil nitrogen levels after 2 weeks",
                "Monitor leaf color for nitrogen deficiency symptoms (yellowing of older leaves)",
            ],
        )
    elif n < 20:
        add(
            "FERTILIZER",
            "Low Soil Nitrogen",
            "Soil nitrogen is below optimal. Apply nitrogen fertilizer to support crop growth.",
            "MEDIUM",
            [
                "Apply 60–80 kg N/ha as urea or ammonium sulfate",
                "Split application: 50% at planting, 50% at first fruiting",
                "Monitor plant for yellowing (N deficiency) vs. other nutrient issues",
            ],
        )

    if p < 15:
        add(
            "FERTILIZER",
            "Phosphorus Deficiency",
            "Soil phosphorus is below optimal levels. Phosphorus is critical for root development "
            "and energy transfer in plants.",
            "MEDIUM",
            [
                "Apply triple superphosphate (TSP) at 40–60 kg P₂O₅/ha",
                "Incorporate phosphate into the soil before planting",
                "Consider rock phosphate for long-term soil improvement",
                "Check soil pH — low pH reduces phosphorus availability",
            ],
        )

    if k < 100:
        add(
            "FERTILIZER",
            "Potassium Deficiency",
            "Potassium levels are below optimal. Potassium improves fruit quality, "
            "disease resistance, and water use efficiency.",
            "MEDIUM",
            [
                "Apply muriate of potash (MOP) or sulfate of potash at 60–100 kg K₂O/ha",
                "Avoid excessive potassium — can inhibit magnesium uptake",
                "Monitor for leaf scorching on margins (K deficiency symptom)",
            ],
        )

    # ----- SOIL_HEALTH -----
    if ph < 5.5:
        add(
            "SOIL_HEALTH",
            "Critically Low Soil pH — Apply Lime",
            f"Soil pH {ph:.1f} is below 5.5. Strongly acidic soils reduce nutrient availability "
            "and can cause aluminum and manganese toxicity.",
            "CRITICAL",
            [
                "Apply agricultural lime (calcitic or dolomitic) at 2–4 tons/ha",
                "Incorporate lime into top 15–20 cm of soil",
                "Retest pH 6–8 weeks after liming",
                "Target pH 6.0–6.8 for most crops",
                "Avoid applying lime near seeding time (wait 2+ weeks)",
            ],
        )
    elif ph > 7.5:
        add(
            "SOIL_HEALTH",
            "High Soil pH — Acidify Soil",
            f"Soil pH {ph:.1f} is above 7.5. High pH reduces iron, manganese, zinc availability "
            "and can lead to micronutrient deficiencies.",
            "HIGH",
            [
                "Apply elemental sulfur at 150–300 kg/ha (takes 3–6 months to act)",
                "Use acidifying fertilizers like ammonium sulfate",
                "Apply organic matter (compost) to buffer pH",
                "Consider irrigation with slightly acidified water",
                "Retest pH after 2–3 months",
            ],
        )

    if om < 2.0:
        add(
            "SOIL_HEALTH",
            "Low Organic Matter",
            f"Organic matter at {om:.1f}% is below 2%. Low organic matter reduces "
            "water-holding capacity, microbial activity, and soil structure.",
            "HIGH",
            [
                "Apply 10–15 tons/ha of well-composted manure or compost",
                "Incorporate cover crops (legumes or grasses) before next season",
                "Minimize tillage to prevent organic matter oxidation",
                "Apply mulch to soil surface",
                "Avoid burning crop residues — incorporate them instead",
            ],
        )

    if moisture < 30:
        add(
            "SOIL_HEALTH",
            "Critical Soil Moisture Deficit",
            f"Soil moisture at {moisture:.0f}% is below 30%. Crops are experiencing drought stress.",
            "HIGH",
            [
                "Begin irrigation immediately — apply 25–35 mm of water",
                "Check and repair irrigation system",
                "Apply mulch (straw/plastic) to reduce evaporation",
                "Consider drip irrigation for water efficiency",
                "Schedule irrigation for early morning to reduce evaporation loss",
            ],
        )
    elif moisture > 80:
        add(
            "SOIL_HEALTH",
            "Waterlogging Risk",
            f"Soil moisture at {moisture:.0f}% exceeds 80%. Waterlogging causes root asphyxiation "
            "and increases disease pressure.",
            "HIGH",
            [
                "Install or check drainage channels and tile drains",
                "Stop irrigation immediately",
                "Add raised beds or mounds for affected areas",
                "Check for compaction layers preventing drainage",
                "Monitor for root rot and fungal diseases",
            ],
        )

    # ----- MICROBIAL_AMENDMENT -----
    if mdi < 3.0:
        add(
            "MICROBIAL_AMENDMENT",
            "Low Microbial Diversity",
            f"Shannon diversity index {mdi:.2f} is below 3.0. Low microbial diversity reduces "
            "nutrient cycling efficiency and disease suppression.",
            "HIGH",
            [
                "Apply diverse compost (5–10 tons/ha) to introduce microbial communities",
                "Use biofertilizers containing multiple bacterial/fungal species",
                "Reduce fungicide and pesticide use to allow microbiome recovery",
                "Practice crop rotation to diversify root exudates",
                "Add molasses or humic acid to feed soil microbes",
            ],
        )

    if not myc and p < 20:
        add(
            "MICROBIAL_AMENDMENT",
            "Apply Mycorrhizal Inoculant",
            "Mycorrhizal fungi are absent and phosphorus is low. Mycorrhizae greatly increase "
            "phosphorus uptake and drought tolerance.",
            "MEDIUM",
            [
                "Apply mycorrhizal inoculant (Glomus spp.) at planting — seed coat or soil drench",
                "Reduce phosphorus fertilizer temporarily — excess P inhibits mycorrhizal colonization",
                "Avoid using soil fumigants before planting",
                "Use transplants with pre-inoculated root systems when possible",
            ],
        )

    if path_fungi > 8.0:
        add(
            "MICROBIAL_AMENDMENT",
            "Dangerous Pathogenic Fungi Level",
            f"Pathogenic fungi ratio at {path_fungi:.1f}% exceeds safe threshold. "
            "This is a critical disease risk that can devastate yields.",
            "CRITICAL",
            [
                "Apply biological fungicide (Trichoderma harzianum or Bacillus subtilis)",
                "Drench soil with systemic fungicide (propiconazole or azoxystrobin)",
                "Remove and destroy infected plant material",
                "Improve drainage to reduce favorable conditions for fungi",
                "Practice 2–3 year crop rotation away from susceptible hosts",
                "Solarize soil in off-season to reduce pathogen populations",
            ],
        )

    # ----- IRRIGATION -----
    if humidity < 40 and rainfall < 10:
        add(
            "IRRIGATION",
            "Increase Irrigation Frequency",
            f"Low humidity ({humidity:.0f}%) combined with minimal rainfall ({rainfall:.0f} mm) "
            "creates high evapotranspiration demand.",
            "HIGH",
            [
                "Increase irrigation frequency — consider daily watering during peak heat",
                "Apply 25–30 mm per irrigation event",
                "Install weather-based irrigation controllers",
                "Use deficit irrigation strategy to maximize water use efficiency",
                "Consider windbreaks to reduce evapotranspiration",
            ],
        )

    return recommendations


# ---- Image Recommendations ----

IMAGE_RECOMMENDATIONS = {
    "Tomato___healthy": {
        "title": "Maintain Healthy Conditions",
        "description": "Tomato crop appears healthy. Continue current management practices.",
        "severity": "LOW",
        "actionItems": [
            "Continue regular monitoring — inspect weekly for early disease signs",
            "Maintain balanced fertilization program",
            "Ensure consistent irrigation to prevent stress",
            "Apply preventive copper-based spray at flowering stage",
        ],
    },
    "Tomato___Early_blight": {
        "title": "Treat Early Blight (Alternaria solani)",
        "description": "Early blight detected. Concentric ring lesions on lower/older leaves. "
                       "Can cause 20–35% yield reduction if untreated.",
        "severity": "HIGH",
        "actionItems": [
            "Apply chlorothalonil or mancozeb fungicide at 7–10 day intervals",
            "Remove and dispose of heavily infected lower leaves",
            "Avoid overhead irrigation — use drip irrigation",
            "Apply mulch to prevent soil splash to lower leaves",
            "Stake plants to improve air circulation",
            "Rotate crops next season (avoid Solanaceae for 2+ years)",
        ],
    },
    "Tomato___Late_blight": {
        "title": "URGENT: Treat Late Blight (Phytophthora infestans)",
        "description": "Late blight detected — HIGHLY DESTRUCTIVE. Can cause 50–100% crop loss. "
                       "The pathogen that caused the Irish Potato Famine.",
        "severity": "CRITICAL",
        "actionItems": [
            "Apply metalaxyl + mancozeb or cymoxanil immediately",
            "Spray every 5–7 days in wet/cool weather",
            "Remove and bag all infected plant material — do NOT compost",
            "Alert neighboring farmers — disease spreads rapidly via wind",
            "Consider emergency harvest of salvageable fruit",
            "Drench soil around plant base with fungicide",
        ],
    },
    "Tomato___Leaf_Mold": {
        "title": "Treat Leaf Mold (Passalora fulva)",
        "description": "Leaf mold detected. Yellow spots on upper leaf surface with olive-green "
                       "mold beneath. Reduces photosynthesis 15–25%.",
        "severity": "MEDIUM",
        "actionItems": [
            "Improve greenhouse/crop ventilation to reduce humidity",
            "Apply copper-based fungicide or chlorothalonil",
            "Remove infected leaves and dispose of them",
            "Reduce overhead irrigation frequency",
            "Maintain humidity below 85% in greenhouse settings",
        ],
    },
    "Tomato___Septoria_leaf_spot": {
        "title": "Treat Septoria Leaf Spot",
        "description": "Septoria leaf spot detected. Small circular spots with dark borders. "
                       "Causes premature leaf drop and 10–20% yield loss.",
        "severity": "MEDIUM",
        "actionItems": [
            "Apply copper fungicide or chlorothalonil preventively",
            "Remove infected lower leaves immediately",
            "Avoid working in crop when foliage is wet",
            "Water at base of plant — avoid wetting foliage",
            "Use resistant cultivars in next season",
        ],
    },
    "Tomato___Spider_mites": {
        "title": "Control Spider Mite Infestation",
        "description": "Spider mite infestation detected. Fine webbing and stippled yellow leaves "
                       "indicate active infestation. Can reduce yield 10–30%.",
        "severity": "HIGH",
        "actionItems": [
            "Apply abamectin or spiromesifen miticide — avoid spraying in hot weather",
            "Introduce predatory mites (Phytoseiulus persimilis) as biological control",
            "Increase irrigation to raise humidity — mites prefer dry conditions",
            "Remove heavily infested leaves and dispose",
            "Rotate miticide class to prevent resistance",
            "Avoid broad-spectrum insecticides that kill natural predators",
        ],
    },
    "Tomato___Target_Spot": {
        "title": "Treat Target Spot (Corynespora cassiicola)",
        "description": "Target spot detected. Concentric ring lesions on leaves and fruit. "
                       "Can reduce yield 10–20%.",
        "severity": "MEDIUM",
        "actionItems": [
            "Apply azoxystrobin or tebuconazole fungicide",
            "Remove infected plant debris",
            "Improve air circulation through pruning",
            "Implement crop rotation for next season",
        ],
    },
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": {
        "title": "URGENT: Yellow Leaf Curl Virus Control",
        "description": "TYLCV detected — transmitted by silverleaf whitefly. "
                       "Can cause 50–100% yield loss. No curative treatment.",
        "severity": "CRITICAL",
        "actionItems": [
            "Remove and destroy all infected plants immediately",
            "Apply imidacloprid or thiamethoxam to control whitefly vector",
            "Install yellow sticky traps throughout crop",
            "Use reflective mulch to deter whiteflies",
            "Plant TYLCV-resistant cultivars next season",
            "Install insect-proof mesh on greenhouse openings",
        ],
    },
    "Tomato___Tomato_mosaic_virus": {
        "title": "Manage Tomato Mosaic Virus (ToMV)",
        "description": "ToMV detected. No chemical cure. Causes mottling, distortion, "
                       "and 10–25% yield reduction.",
        "severity": "HIGH",
        "actionItems": [
            "Remove and destroy infected plants — do NOT compost",
            "Disinfect tools with 10% bleach solution between plants",
            "Wash hands thoroughly after handling infected plants",
            "Control aphids that may spread virus mechanically",
            "Plant ToMV-resistant cultivars (Tm-2² gene) next season",
            "Avoid tobacco near crops — ToMV closely related to TMV",
        ],
    },
    "Tomato___Bacterial_spot": {
        "title": "Treat Bacterial Spot (Xanthomonas)",
        "description": "Bacterial spot detected. Dark water-soaked lesions on leaves and fruit. "
                       "Can reduce marketable yield 15–30%.",
        "severity": "HIGH",
        "actionItems": [
            "Apply copper bactericide (copper hydroxide) every 7 days",
            "Remove heavily infected plant material",
            "Avoid overhead irrigation — use drip irrigation",
            "Avoid working in field when plants are wet",
            "Use certified disease-free seed next season",
            "Practice 2-year crop rotation away from Solanaceae",
        ],
    },
    "Corn___healthy": {
        "title": "Maintain Healthy Corn Management",
        "description": "Corn crop appears healthy. Continue monitoring and maintain "
                       "optimal growing conditions.",
        "severity": "LOW",
        "actionItems": [
            "Continue regular weekly scouting for disease signs",
            "Ensure adequate nitrogen at V6 stage (side-dress application)",
            "Monitor for early signs of common rust at tasseling",
            "Maintain even irrigation especially during silking",
        ],
    },
    "Corn___Common_rust": {
        "title": "Treat Common Rust (Puccinia sorghi)",
        "description": "Common rust detected. Cinnamon-brown pustules on leaf surfaces. "
                       "Can reduce yield 10–35% in susceptible varieties.",
        "severity": "MEDIUM",
        "actionItems": [
            "Apply triazole fungicide (propiconazole or tebuconazole) if infection is moderate/severe",
            "Treat at early stages — before VT/R1 stage for best efficacy",
            "Scout weekly to monitor rust progression",
            "Plant rust-resistant hybrid varieties next season",
            "Note: fungicide application economically justified only at >10% leaf area infected",
        ],
    },
    "Corn___Northern_Leaf_Blight": {
        "title": "Treat Northern Leaf Blight (Exserohilum turcicum)",
        "description": "NLB detected. Long cigar-shaped gray-green lesions. "
                       "Can cause 30–50% yield loss in severe cases.",
        "severity": "HIGH",
        "actionItems": [
            "Apply azoxystrobin + propiconazole at VT/early R1 stage",
            "Scout every 5–7 days in humid weather",
            "Remove and incorporate infected crop residue after harvest",
            "Plant resistant hybrids with Ht1, Ht2, or HtN genes next season",
            "Practice crop rotation — avoid continuous corn",
        ],
    },
    "Corn___Cercospora_leaf_spot": {
        "title": "Treat Gray Leaf Spot (Cercospora zeae-maydis)",
        "description": "Gray leaf spot detected. Rectangular lesions parallel to leaf veins. "
                       "Can cause 5–25% yield loss.",
        "severity": "MEDIUM",
        "actionItems": [
            "Apply strobilurin fungicide (azoxystrobin, picoxystrobin) at VT/R1",
            "Improve air flow — avoid dense plant populations",
            "Rotate corn with non-host crops (soybeans, wheat)",
            "Plant GLS-resistant corn hybrids next season",
            "Till soil to bury infected residue",
        ],
    },
    "Soil___healthy": {
        "title": "Maintain Healthy Soil Structure",
        "description": "Soil appears healthy with good moisture and structure.",
        "severity": "LOW",
        "actionItems": [
            "Continue regular soil testing — at least once per season",
            "Maintain organic matter levels with compost applications",
            "Minimize compaction — avoid heavy machinery when soil is wet",
            "Continue current crop rotation strategy",
        ],
    },
    "Soil___dry": {
        "title": "Address Soil Dryness and Compaction",
        "description": "Soil appears dry, cracked, or excessively compacted. "
                       "Drought stress can reduce yields 20–50%.",
        "severity": "HIGH",
        "actionItems": [
            "Irrigate immediately — apply 30–40 mm of water",
            "Apply 10 cm layer of organic mulch to retain soil moisture",
            "Consider subsoil aeration if compaction is deep",
            "Increase organic matter to improve water-holding capacity",
            "Install soil moisture sensors to schedule irrigation precisely",
            "Evaluate crop water requirements and adjust irrigation plan",
        ],
    },
    "Soil___degraded": {
        "title": "Soil Rehabilitation Required",
        "description": "Soil degradation detected. Degraded soil has poor structure, "
                       "low organic matter, and reduced productivity.",
        "severity": "CRITICAL",
        "actionItems": [
            "Apply 15–20 tons/ha of mature compost immediately",
            "Plant nitrogen-fixing cover crop (cowpea, vetch, or clover)",
            "Perform deep tillage (subsoiling) to break hardpan layers",
            "Test full nutrient panel and correct all deficiencies",
            "Implement conservation tillage for future seasons",
            "Apply gypsum to improve soil structure (1–2 tons/ha)",
            "Conduct biological soil test to assess microbial health",
        ],
    },
    "Soil___waterlogged": {
        "title": "URGENT: Drain Waterlogged Soil",
        "description": "Waterlogged soil detected. Root asphyxiation is occurring. "
                       "Can reduce yield 20–60% and cause root rot diseases.",
        "severity": "CRITICAL",
        "actionItems": [
            "Cease all irrigation immediately",
            "Install or clean drainage ditches — create surface drainage channels",
            "Install subsurface tile drains if problem is recurring",
            "Check and unblock any drainage infrastructure",
            "Apply lime to prevent pH crash in flooded soils",
            "Scout for Phytophthora root rot and fungal diseases",
            "Avoid any soil disturbance while waterlogged",
        ],
    },
}


def generate_image_recommendations(predicted_class: str, confidence: float) -> list:
    """
    Generate image-based recommendations using pattern matching.
    Works with any class name format (Tomato___, Potato___, Corn___, Soil___, etc.).
    Severity is scaled down when confidence is low.
    """
    c = predicted_class.lower()
    severity_order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

    # First try exact lookup in the detailed dict for maximum specificity
    rec = None
    if predicted_class in IMAGE_RECOMMENDATIONS:
        rec = dict(IMAGE_RECOMMENDATIONS[predicted_class])
        rec["actionItems"] = list(rec["actionItems"])

    # Pattern-based fallback — handles Potato___, unknown crops, etc.
    if rec is None:
        if "healthy" in c:
            rec = {
                "title": "Crop Appears Healthy",
                "description": "No disease detected in the uploaded image.",
                "severity": "LOW",
                "actionItems": [
                    "Continue current crop management practices",
                    "Maintain regular monitoring schedule",
                    "Ensure consistent irrigation and fertilization",
                    "Document current conditions for future comparison",
                ],
            }
        elif "early_blight" in c or "early blight" in c:
            rec = {
                "title": "Early Blight Detected",
                "description": "Fungal disease caused by Alternaria solani. 20–35% yield reduction if untreated.",
                "severity": "HIGH",
                "actionItems": [
                    "Remove and destroy all infected leaves immediately",
                    "Apply copper-based or mancozeb fungicide every 7–10 days",
                    "Avoid overhead watering — switch to drip irrigation",
                    "Ensure adequate spacing between plants for air circulation",
                    "Apply mulch to prevent soil splash onto lower leaves",
                    "Monitor neighbouring plants for spread",
                ],
            }
        elif "late_blight" in c or "late blight" in c:
            rec = {
                "title": "Late Blight Detected — URGENT",
                "description": "Highly destructive disease (Phytophthora infestans). 50–100% crop loss if uncontrolled.",
                "severity": "CRITICAL",
                "actionItems": [
                    "IMMEDIATE: Remove and bag all infected plant material",
                    "Do NOT compost infected material — burn or bury deeply",
                    "Apply systemic fungicide (metalaxyl or mefenoxam) immediately",
                    "Spray every 5–7 days until conditions improve",
                    "Isolate affected area from healthy plants",
                    "Alert neighbouring farmers — spreads rapidly via wind and rain",
                ],
            }
        elif "leaf_mold" in c or "leaf mold" in c:
            rec = {
                "title": "Leaf Mold Detected",
                "description": "Passalora fulva detected. Reduces photosynthesis — 15–25% yield reduction.",
                "severity": "MEDIUM",
                "actionItems": [
                    "Improve greenhouse or field ventilation to reduce humidity",
                    "Apply copper-based fungicide or chlorothalonil",
                    "Remove and dispose of infected leaves",
                    "Reduce overhead irrigation frequency",
                    "Maintain humidity below 85% in enclosed settings",
                ],
            }
        elif "septoria" in c:
            rec = {
                "title": "Septoria Leaf Spot Detected",
                "description": "Septoria sp. causes premature leaf drop — 10–20% yield reduction.",
                "severity": "MEDIUM",
                "actionItems": [
                    "Apply copper fungicide or chlorothalonil preventively",
                    "Remove infected lower leaves immediately",
                    "Avoid working in crop when foliage is wet",
                    "Water at base — avoid wetting foliage",
                    "Use resistant cultivars next season",
                ],
            }
        elif "spider_mite" in c or "spider mite" in c:
            rec = {
                "title": "Spider Mite Infestation Detected",
                "description": "Fine webbing and stippling indicate active mite infestation — 10–30% yield loss.",
                "severity": "HIGH",
                "actionItems": [
                    "Apply abamectin or spiromesifen miticide",
                    "Introduce predatory mites (Phytoseiulus persimilis) for biological control",
                    "Increase irrigation to raise humidity — mites prefer dry conditions",
                    "Remove heavily infested leaves and dispose",
                    "Rotate miticide class to prevent resistance",
                ],
            }
        elif "target_spot" in c or "target spot" in c:
            rec = {
                "title": "Target Spot Detected",
                "description": "Corynespora cassiicola — concentric ring lesions. 10–20% yield reduction.",
                "severity": "MEDIUM",
                "actionItems": [
                    "Apply azoxystrobin or tebuconazole fungicide",
                    "Remove infected plant debris promptly",
                    "Improve air circulation through pruning",
                    "Implement crop rotation next season",
                ],
            }
        elif "yellow_leaf_curl" in c or "ylcv" in c:
            rec = {
                "title": "Yellow Leaf Curl Virus — URGENT",
                "description": "TYLCV (whitefly-transmitted). No curative treatment — 50–100% yield loss possible.",
                "severity": "CRITICAL",
                "actionItems": [
                    "Remove and destroy all infected plants immediately",
                    "Apply imidacloprid or thiamethoxam to control whitefly vectors",
                    "Install yellow sticky traps throughout the crop area",
                    "Use reflective mulch to deter whiteflies",
                    "Plant TYLCV-resistant cultivars next season",
                    "Install insect-proof mesh on greenhouse openings",
                ],
            }
        elif "mosaic_virus" in c or "mosaic virus" in c:
            rec = {
                "title": "Mosaic Virus Detected",
                "description": "Viral disease — mottling, distortion, 10–25% yield reduction. No chemical cure.",
                "severity": "HIGH",
                "actionItems": [
                    "Remove and destroy infected plants — do NOT compost",
                    "Disinfect tools with 10% bleach solution between plants",
                    "Wash hands thoroughly after handling infected material",
                    "Control aphids or other insect vectors",
                    "Plant virus-resistant cultivars next season",
                ],
            }
        elif "bacterial_spot" in c or "bacterial spot" in c:
            rec = {
                "title": "Bacterial Spot Detected",
                "description": "Xanthomonas sp. — dark water-soaked lesions. 15–30% marketable yield loss.",
                "severity": "HIGH",
                "actionItems": [
                    "Apply copper bactericide (copper hydroxide) every 7 days",
                    "Remove heavily infected plant material",
                    "Switch to drip irrigation — avoid overhead watering",
                    "Avoid field operations when plants are wet",
                    "Use certified disease-free seed next season",
                    "Practice 2-year crop rotation away from Solanaceae",
                ],
            }
        elif "common_rust" in c or "common rust" in c:
            rec = {
                "title": "Common Rust Detected",
                "description": "Puccinia sorghi — cinnamon-brown pustules. 10–35% yield reduction in susceptible varieties.",
                "severity": "MEDIUM",
                "actionItems": [
                    "Apply triazole fungicide (propiconazole or tebuconazole) at early infection",
                    "Scout weekly to monitor rust progression",
                    "Treat before VT/R1 stage for best efficacy",
                    "Plant rust-resistant hybrid varieties next season",
                ],
            }
        elif "northern_leaf_blight" in c or "northern blight" in c:
            rec = {
                "title": "Northern Leaf Blight Detected",
                "description": "Exserohilum turcicum — long cigar-shaped lesions. 30–50% yield loss possible.",
                "severity": "HIGH",
                "actionItems": [
                    "Apply azoxystrobin + propiconazole at VT/early R1 stage",
                    "Scout every 5–7 days in humid conditions",
                    "Remove and incorporate infected crop residue after harvest",
                    "Plant resistant hybrids (Ht1, Ht2, or HtN genes) next season",
                    "Avoid continuous corn — practice crop rotation",
                ],
            }
        elif "cercospora" in c or "gray_leaf_spot" in c:
            rec = {
                "title": "Gray Leaf Spot Detected",
                "description": "Cercospora zeae-maydis — rectangular lesions parallel to leaf veins. 5–25% yield loss.",
                "severity": "MEDIUM",
                "actionItems": [
                    "Apply strobilurin fungicide (azoxystrobin) at VT/R1",
                    "Improve air flow — avoid dense plant populations",
                    "Rotate corn with non-host crops (soybeans, wheat)",
                    "Plant GLS-resistant hybrids next season",
                    "Till soil to bury infected residue",
                ],
            }
        elif "dry" in c:
            rec = {
                "title": "Dry / Drought-Stressed Soil",
                "description": "Soil appears dry or compacted. Drought stress can reduce yields 20–50%.",
                "severity": "HIGH",
                "actionItems": [
                    "Irrigate immediately — apply 30–40 mm of water",
                    "Apply 10 cm layer of organic mulch to retain moisture",
                    "Install soil moisture sensors to schedule irrigation precisely",
                    "Increase organic matter to improve water-holding capacity",
                    "Evaluate crop water requirements and adjust irrigation plan",
                ],
            }
        elif "degrad" in c:
            rec = {
                "title": "Soil Degradation Detected",
                "description": "Degraded soil structure, low organic matter, or erosion visible.",
                "severity": "CRITICAL",
                "actionItems": [
                    "Apply 15–20 tons/ha of mature compost immediately",
                    "Plant nitrogen-fixing cover crop (cowpea, vetch, or clover)",
                    "Perform deep tillage (subsoiling) to break hardpan layers",
                    "Test full nutrient panel and correct all deficiencies",
                    "Implement conservation tillage for future seasons",
                    "Apply gypsum to improve soil structure (1–2 tons/ha)",
                ],
            }
        elif "waterlog" in c:
            rec = {
                "title": "Waterlogged Soil — URGENT",
                "description": "Root asphyxiation occurring. 20–60% yield loss and increased disease risk.",
                "severity": "CRITICAL",
                "actionItems": [
                    "Cease all irrigation immediately",
                    "Install or clean drainage ditches — create surface drainage channels",
                    "Install subsurface tile drains if problem is recurring",
                    "Check and unblock any existing drainage infrastructure",
                    "Apply lime to prevent pH crash in flooded soils",
                    "Scout for Phytophthora root rot and fungal diseases",
                ],
            }
        else:
            rec = {
                "title": f"Condition Detected: {predicted_class}",
                "description": (
                    "An abnormal condition was detected. Expert consultation recommended."
                ),
                "severity": "MEDIUM",
                "actionItems": [
                    "Consult local agricultural extension office",
                    "Take additional photos from different angles",
                    "Monitor progression over next 48 hours",
                    "Consider sending physical sample to a plant disease lab",
                ],
            }

    # Scale severity down when confidence is low
    if confidence < 0.6 and rec["severity"] != "LOW":
        current_idx = severity_order.index(rec["severity"])
        rec["severity"] = severity_order[max(0, current_idx - 1)]
        rec["description"] += (
            f" (Low confidence: {confidence:.0%} — consider retaking photo in better lighting)"
        )
        rec["actionItems"].insert(
            0,
            f"⚠️ Uncertain diagnosis ({confidence:.0%} confidence) — "
            "take additional photos and consult an agronomist before treatment",
        )

    return [rec]
