/**
 * JavaScript recommendation engine (mirrors Python version).
 * Used as fallback when ML engine is unavailable.
 */

const IMAGE_RECOMMENDATIONS = {
  'Tomato___healthy': {
    title: 'Maintain Healthy Conditions',
    description: 'Tomato crop appears healthy. Continue current management practices.',
    severity: 'LOW',
    actionItems: [
      'Continue regular monitoring — inspect weekly for early disease signs',
      'Maintain balanced fertilization program',
      'Ensure consistent irrigation to prevent stress',
      'Apply preventive copper-based spray at flowering stage',
    ],
  },
  'Tomato___Early_blight': {
    title: 'Treat Early Blight (Alternaria solani)',
    description: 'Early blight detected. Can cause 20–35% yield reduction if untreated.',
    severity: 'HIGH',
    actionItems: [
      'Apply chlorothalonil or mancozeb fungicide at 7–10 day intervals',
      'Remove and dispose of heavily infected lower leaves',
      'Avoid overhead irrigation — use drip irrigation',
      'Apply mulch to prevent soil splash to lower leaves',
      'Rotate crops next season (avoid Solanaceae for 2+ years)',
    ],
  },
  'Tomato___Late_blight': {
    title: 'URGENT: Treat Late Blight (Phytophthora infestans)',
    description: 'Late blight detected — HIGHLY DESTRUCTIVE. Can cause 50–100% crop loss.',
    severity: 'CRITICAL',
    actionItems: [
      'Apply metalaxyl + mancozeb or cymoxanil immediately',
      'Spray every 5–7 days in wet/cool weather',
      'Remove and bag all infected plant material — do NOT compost',
      'Alert neighboring farmers — disease spreads rapidly via wind',
      'Consider emergency harvest of salvageable fruit',
    ],
  },
  'Tomato___Leaf_Mold': {
    title: 'Treat Leaf Mold (Passalora fulva)',
    description: 'Leaf mold reduces photosynthesis 15–25%.',
    severity: 'MEDIUM',
    actionItems: [
      'Improve ventilation to reduce humidity',
      'Apply copper-based fungicide or chlorothalonil',
      'Remove infected leaves and dispose',
      'Reduce overhead irrigation frequency',
    ],
  },
  'Tomato___Septoria_leaf_spot': {
    title: 'Treat Septoria Leaf Spot',
    description: 'Causes premature leaf drop and 10–20% yield loss.',
    severity: 'MEDIUM',
    actionItems: [
      'Apply copper fungicide or chlorothalonil preventively',
      'Remove infected lower leaves immediately',
      'Water at base of plant — avoid wetting foliage',
    ],
  },
  'Tomato___Spider_mites': {
    title: 'Control Spider Mite Infestation',
    description: 'Can reduce yield 10–30%.',
    severity: 'HIGH',
    actionItems: [
      'Apply abamectin or spiromesifen miticide',
      'Introduce predatory mites as biological control',
      'Increase irrigation to raise humidity',
      'Avoid broad-spectrum insecticides that kill natural predators',
    ],
  },
  'Tomato___Target_Spot': {
    title: 'Treat Target Spot',
    description: 'Can reduce yield 10–20%.',
    severity: 'MEDIUM',
    actionItems: [
      'Apply azoxystrobin or tebuconazole fungicide',
      'Remove infected plant debris',
      'Improve air circulation through pruning',
    ],
  },
  'Tomato___Tomato_Yellow_Leaf_Curl_Virus': {
    title: 'URGENT: Yellow Leaf Curl Virus Control',
    description: 'Can cause 50–100% yield loss. No curative treatment.',
    severity: 'CRITICAL',
    actionItems: [
      'Remove and destroy all infected plants immediately',
      'Apply imidacloprid to control whitefly vector',
      'Install yellow sticky traps throughout crop',
      'Plant TYLCV-resistant cultivars next season',
    ],
  },
  'Tomato___Tomato_mosaic_virus': {
    title: 'Manage Tomato Mosaic Virus',
    description: 'No chemical cure. Causes 10–25% yield reduction.',
    severity: 'HIGH',
    actionItems: [
      'Remove and destroy infected plants — do NOT compost',
      'Disinfect tools with 10% bleach solution between plants',
      'Plant ToMV-resistant cultivars next season',
    ],
  },
  'Tomato___Bacterial_spot': {
    title: 'Treat Bacterial Spot (Xanthomonas)',
    description: 'Can reduce marketable yield 15–30%.',
    severity: 'HIGH',
    actionItems: [
      'Apply copper bactericide every 7 days',
      'Remove heavily infected plant material',
      'Avoid overhead irrigation',
    ],
  },
  'Corn___healthy': {
    title: 'Maintain Healthy Corn Management',
    description: 'Corn appears healthy. Continue monitoring.',
    severity: 'LOW',
    actionItems: [
      'Continue regular weekly scouting',
      'Ensure adequate nitrogen at V6 stage',
      'Monitor for early rust signs at tasseling',
    ],
  },
  'Corn___Common_rust': {
    title: 'Treat Common Rust (Puccinia sorghi)',
    description: 'Can reduce yield 10–35%.',
    severity: 'MEDIUM',
    actionItems: [
      'Apply triazole fungicide if infection is moderate/severe',
      'Treat at early stages for best efficacy',
      'Plant rust-resistant hybrid varieties next season',
    ],
  },
  'Corn___Northern_Leaf_Blight': {
    title: 'Treat Northern Leaf Blight',
    description: 'Can cause 30–50% yield loss in severe cases.',
    severity: 'HIGH',
    actionItems: [
      'Apply azoxystrobin + propiconazole at VT/early R1 stage',
      'Remove and incorporate infected crop residue after harvest',
      'Plant resistant hybrids next season',
    ],
  },
  'Corn___Cercospora_leaf_spot': {
    title: 'Treat Gray Leaf Spot',
    description: 'Can cause 5–25% yield loss.',
    severity: 'MEDIUM',
    actionItems: [
      'Apply strobilurin fungicide at VT/R1',
      'Rotate corn with non-host crops',
      'Plant GLS-resistant corn hybrids next season',
    ],
  },
  'Soil___healthy': {
    title: 'Maintain Healthy Soil Structure',
    description: 'Soil appears healthy with good moisture and structure.',
    severity: 'LOW',
    actionItems: [
      'Continue regular soil testing',
      'Maintain organic matter levels',
      'Minimize compaction — avoid heavy machinery when wet',
    ],
  },
  'Soil___dry': {
    title: 'Address Soil Dryness',
    description: 'Drought stress can reduce yields 20–50%.',
    severity: 'HIGH',
    actionItems: [
      'Irrigate immediately — apply 30–40 mm of water',
      'Apply organic mulch to retain soil moisture',
      'Install soil moisture sensors for precise scheduling',
    ],
  },
  'Soil___degraded': {
    title: 'Soil Rehabilitation Required',
    description: 'Degraded soil has poor structure and reduced productivity.',
    severity: 'CRITICAL',
    actionItems: [
      'Apply 15–20 tons/ha of mature compost immediately',
      'Plant nitrogen-fixing cover crop',
      'Perform deep tillage to break hardpan layers',
      'Test full nutrient panel and correct all deficiencies',
    ],
  },
  'Soil___waterlogged': {
    title: 'URGENT: Drain Waterlogged Soil',
    description: 'Can reduce yield 20–60% and cause root rot diseases.',
    severity: 'CRITICAL',
    actionItems: [
      'Cease all irrigation immediately',
      'Install or clean drainage ditches',
      'Install subsurface tile drains if problem is recurring',
      'Scout for Phytophthora root rot',
    ],
  },
};

const SEVERITY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function generateSoilRecommendations(sensorData, shapValues = {}) {
  const recs = [];

  function add(category, title, description, severity, actionItems) {
    recs.push({ category, title, description, severity, actionItems });
  }

  const n = parseFloat(sensorData.nitrogenPpm ?? 30);
  const p = parseFloat(sensorData.phosphorusPpm ?? 20);
  const k = parseFloat(sensorData.potassiumPpm ?? 150);
  const ph = parseFloat(sensorData.soilPh ?? 6.5);
  const om = parseFloat(sensorData.organicMatter ?? 3.0);
  const moisture = parseFloat(sensorData.soilMoisture ?? 50);
  const mdi = parseFloat(sensorData.microbialDiversityIndex ?? 4.0);
  const nfb = parseFloat(sensorData.nitrogenFixingBacteriaRatio ?? 20);
  const myc = Boolean(sensorData.mycorrhizalFungiPresence);
  const pathFungi = parseFloat(sensorData.pathogenicFungiRatio ?? 2.0);
  const humidity = parseFloat(sensorData.humidity ?? 60);
  const rainfall = parseFloat(sensorData.rainfallMm ?? 20);

  // FERTILIZER
  if (n < 20 && nfb < 15) {
    add('FERTILIZER', 'Critical Nitrogen Deficiency',
      'Both soil nitrogen and nitrogen-fixing bacteria are below optimal. Immediate nitrogen amendment required.',
      'HIGH',
      ['Apply urea or ammonium nitrate at 80–120 kg N/ha',
       'Inoculate with Rhizobium or Azospirillum biofertilizer',
       'Consider slow-release nitrogen fertilizer',
       'Re-test soil nitrogen levels after 2 weeks']);
  } else if (n < 20) {
    add('FERTILIZER', 'Low Soil Nitrogen',
      'Soil nitrogen is below optimal. Apply nitrogen fertilizer.',
      'MEDIUM',
      ['Apply 60–80 kg N/ha as urea or ammonium sulfate',
       'Split application: 50% at planting, 50% at first fruiting']);
  }
  if (p < 15) {
    add('FERTILIZER', 'Phosphorus Deficiency',
      'Phosphorus below optimal. Critical for root development.',
      'MEDIUM',
      ['Apply triple superphosphate at 40–60 kg P₂O₅/ha',
       'Incorporate phosphate before planting',
       'Check soil pH — low pH reduces phosphorus availability']);
  }
  if (k < 100) {
    add('FERTILIZER', 'Potassium Deficiency',
      'Potassium below optimal. Improves fruit quality and disease resistance.',
      'MEDIUM',
      ['Apply muriate of potash at 60–100 kg K₂O/ha',
       'Monitor for leaf scorching on margins']);
  }

  // SOIL_HEALTH
  if (ph < 5.5) {
    add('SOIL_HEALTH', 'Critically Low Soil pH — Apply Lime',
      `Soil pH ${ph.toFixed(1)} is below 5.5. Strongly acidic soils reduce nutrient availability.`,
      'CRITICAL',
      ['Apply agricultural lime at 2–4 tons/ha',
       'Incorporate lime into top 15–20 cm',
       'Retest pH 6–8 weeks after liming',
       'Target pH 6.0–6.8']);
  } else if (ph > 7.5) {
    add('SOIL_HEALTH', 'High Soil pH — Acidify Soil',
      `Soil pH ${ph.toFixed(1)} exceeds 7.5. Reduces micronutrient availability.`,
      'HIGH',
      ['Apply elemental sulfur at 150–300 kg/ha',
       'Use acidifying fertilizers like ammonium sulfate',
       'Retest pH after 2–3 months']);
  }
  if (om < 2.0) {
    add('SOIL_HEALTH', 'Low Organic Matter',
      `Organic matter at ${om.toFixed(1)}% is below 2%. Reduces water-holding capacity.`,
      'HIGH',
      ['Apply 10–15 tons/ha of well-composted manure',
       'Incorporate cover crops before next season',
       'Minimize tillage']);
  }
  if (moisture < 30) {
    add('SOIL_HEALTH', 'Critical Soil Moisture Deficit',
      `Soil moisture at ${moisture.toFixed(0)}% is below 30%. Drought stress occurring.`,
      'HIGH',
      ['Begin irrigation immediately — apply 25–35 mm',
       'Apply mulch to reduce evaporation',
       'Schedule irrigation for early morning']);
  } else if (moisture > 80) {
    add('SOIL_HEALTH', 'Waterlogging Risk',
      `Soil moisture at ${moisture.toFixed(0)}% exceeds 80%.`,
      'HIGH',
      ['Install or check drainage channels',
       'Stop irrigation immediately',
       'Monitor for root rot']);
  }

  // MICROBIAL_AMENDMENT
  if (mdi < 3.0) {
    add('MICROBIAL_AMENDMENT', 'Low Microbial Diversity',
      `Shannon diversity index ${mdi.toFixed(2)} is below 3.0.`,
      'HIGH',
      ['Apply diverse compost (5–10 tons/ha)',
       'Use biofertilizers with multiple species',
       'Reduce fungicide use to allow microbiome recovery',
       'Practice crop rotation']);
  }
  if (!myc && p < 20) {
    add('MICROBIAL_AMENDMENT', 'Apply Mycorrhizal Inoculant',
      'Mycorrhizal fungi absent and phosphorus low.',
      'MEDIUM',
      ['Apply mycorrhizal inoculant at planting',
       'Reduce phosphorus temporarily — excess inhibits mycorrhizae']);
  }
  if (pathFungi > 8.0) {
    add('MICROBIAL_AMENDMENT', 'Dangerous Pathogenic Fungi Level',
      `Pathogenic fungi at ${pathFungi.toFixed(1)}% — critical disease risk.`,
      'CRITICAL',
      ['Apply biological fungicide (Trichoderma harzianum)',
       'Drench soil with systemic fungicide',
       'Remove and destroy infected plant material',
       'Improve drainage',
       'Practice 2–3 year crop rotation']);
  }

  // IRRIGATION
  if (humidity < 40 && rainfall < 10) {
    add('IRRIGATION', 'Increase Irrigation Frequency',
      `Low humidity (${humidity.toFixed(0)}%) + minimal rainfall (${rainfall.toFixed(0)} mm).`,
      'HIGH',
      ['Increase irrigation frequency — daily watering during peak heat',
       'Apply 25–30 mm per irrigation event',
       'Install weather-based irrigation controllers']);
  }

  return recs;
}

function generateImageRecommendations(predictedClass, confidence) {
  const template = IMAGE_RECOMMENDATIONS[predictedClass];

  if (!template) {
    return [{
      title: `Review Detected Class: ${predictedClass}`,
      description: `Class '${predictedClass}' detected with ${(confidence * 100).toFixed(0)}% confidence. Consult agronomist.`,
      severity: 'MEDIUM',
      actionItems: [
        'Take multiple photos for expert review',
        'Consult local extension service or agronomist',
        'Monitor crop closely for progression',
      ],
    }];
  }

  const baseIdx = SEVERITY_ORDER.indexOf(template.severity);
  let effectiveSeverity;

  if (confidence > 0.85) {
    effectiveSeverity = template.severity;
  } else if (confidence >= 0.6) {
    effectiveSeverity = SEVERITY_ORDER[Math.max(0, baseIdx - 1)];
  } else {
    effectiveSeverity = 'LOW';
  }

  const actionItems = [...template.actionItems];
  if (confidence < 0.6) {
    actionItems.unshift(
      `⚠️ Uncertain diagnosis (${(confidence * 100).toFixed(0)}% confidence) — take additional photos and consult an agronomist before treatment`
    );
  }

  return [{
    title: template.title,
    description: template.description,
    severity: effectiveSeverity,
    actionItems,
  }];
}

module.exports = { generateSoilRecommendations, generateImageRecommendations };
