/**
 * Database seed script — creates demo user, farms, readings, predictions, analyses.
 * Run: npm run seed
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function rand(min, max, decimals = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n) { return new Date(Date.now() - n * 24 * 60 * 60 * 1000); }

async function main() {
  console.log('\n🌱 Seeding database...\n');

  // ── Demo User ──────────────────────────────────────────────────
  const password = await bcrypt.hash('demo1234', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@farm.ai' },
    update: {},
    create: {
      name: 'Demo Farmer',
      email: 'demo@farm.ai',
      password,
      farmLocation: 'Arusha, Tanzania',
      farmSizeHa: 12.5,
    },
  });
  console.log(`✓ User: ${user.email}`);

  // ── Farms ──────────────────────────────────────────────────────
  const farmsData = [
    { name: 'Kilimanjaro Tomato Farm', location: 'Moshi, Tanzania', gpsLat: -3.35, gpsLng: 37.33, sizeHa: 8.0, cropType: 'TOMATO', region: 'East Africa' },
    { name: 'Volta Corn Farm',         location: 'Tamale, Ghana',   gpsLat:  9.40, gpsLng: -0.85, sizeHa: 15.0, cropType: 'CORN',   region: 'West Africa' },
    { name: 'Mekong Mixed Farm',       location: 'Can Tho, Vietnam', gpsLat: 10.03, gpsLng: 105.78, sizeHa: 5.5, cropType: 'MIXED',  region: 'Southeast Asia' },
  ];

  const farms = [];
  for (const fd of farmsData) {
    const farm = await prisma.farm.upsert({
      where: { id: (await prisma.farm.findFirst({ where: { name: fd.name, userId: user.id } }))?.id || 'nonexistent' },
      update: {},
      create: { userId: user.id, ...fd },
    });
    farms.push(farm);
    console.log(`✓ Farm: ${farm.name}`);
  }

  // ── Model Metrics ──────────────────────────────────────────────
  const tabularModels = [
    { modelName: 'random_forest',      rmse: 0.421, mae: 0.312, r2Score: 0.876 },
    { modelName: 'gradient_boosting',  rmse: 0.398, mae: 0.287, r2Score: 0.889 },
    { modelName: 'xgboost',            rmse: 0.385, mae: 0.271, r2Score: 0.896 },
    { modelName: 'ensemble',           rmse: 0.361, mae: 0.254, r2Score: 0.912 },
  ];
  for (const m of tabularModels) {
    await prisma.modelMetrics.create({
      data: { modelType: 'TABULAR', version: '1.0.0', trainingSamples: 1240, ...m },
    });
  }
  console.log('✓ Tabular model metrics');

  const cnnModels = [
    { modelName: 'soil_cnn',   accuracy: 0.921, precision: 0.918, recall: 0.914, f1Score: 0.916, classes: ['healthy','dry','degraded','waterlogged'], trainingSamples: 3200 },
    { modelName: 'tomato_cnn', accuracy: 0.947, precision: 0.944, recall: 0.941, f1Score: 0.942, classes: ['healthy','Early_blight','Late_blight','Leaf_Mold'], trainingSamples: 8500 },
    { modelName: 'corn_cnn',   accuracy: 0.933, precision: 0.930, recall: 0.928, f1Score: 0.929, classes: ['healthy','Common_rust','Northern_Leaf_Blight','Cercospora'], trainingSamples: 4100 },
  ];
  for (const m of cnnModels) {
    await prisma.modelMetrics.create({
      data: { modelType: 'CNN', version: '1.0.0', ...m },
    });
  }
  console.log('✓ CNN model metrics');

  // ── Per-Farm Data ──────────────────────────────────────────────
  const imageSamples = {
    TOMATO: [
      { cls: 'Tomato___healthy',            conf: 0.94, health: 'HEALTHY' },
      { cls: 'Tomato___Early_blight',       conf: 0.87, health: 'CRITICAL' },
      { cls: 'Tomato___Late_blight',        conf: 0.91, health: 'CRITICAL' },
      { cls: 'Tomato___Leaf_Mold',          conf: 0.78, health: 'DISEASED' },
      { cls: 'Tomato___Septoria_leaf_spot', conf: 0.73, health: 'DISEASED' },
      { cls: 'Tomato___Spider_mites',       conf: 0.65, health: 'DISEASED' },
      { cls: 'Tomato___healthy',            conf: 0.96, health: 'HEALTHY' },
      { cls: 'Tomato___Bacterial_spot',     conf: 0.82, health: 'CRITICAL' },
      { cls: 'Tomato___healthy',            conf: 0.89, health: 'HEALTHY' },
      { cls: 'Tomato___Target_Spot',        conf: 0.55, health: 'AT_RISK'  },
    ],
    CORN: [
      { cls: 'Corn___healthy',             conf: 0.92, health: 'HEALTHY' },
      { cls: 'Corn___Common_rust',         conf: 0.84, health: 'CRITICAL' },
      { cls: 'Corn___Northern_Leaf_Blight',conf: 0.88, health: 'CRITICAL' },
      { cls: 'Corn___Cercospora_leaf_spot',conf: 0.71, health: 'DISEASED' },
      { cls: 'Corn___healthy',             conf: 0.95, health: 'HEALTHY' },
      { cls: 'Corn___Common_rust',         conf: 0.67, health: 'DISEASED' },
      { cls: 'Corn___healthy',             conf: 0.90, health: 'HEALTHY' },
      { cls: 'Corn___Northern_Leaf_Blight',conf: 0.79, health: 'DISEASED' },
      { cls: 'Corn___healthy',             conf: 0.93, health: 'HEALTHY' },
      { cls: 'Corn___Cercospora_leaf_spot',conf: 0.58, health: 'AT_RISK'  },
    ],
    MIXED: [
      { cls: 'Soil___healthy',    conf: 0.88, health: 'HEALTHY' },
      { cls: 'Soil___dry',        conf: 0.82, health: 'CRITICAL' },
      { cls: 'Soil___degraded',   conf: 0.76, health: 'DISEASED' },
      { cls: 'Soil___waterlogged',conf: 0.91, health: 'CRITICAL' },
      { cls: 'Soil___healthy',    conf: 0.94, health: 'HEALTHY' },
      { cls: 'Tomato___healthy',  conf: 0.87, health: 'HEALTHY' },
      { cls: 'Corn___healthy',    conf: 0.89, health: 'HEALTHY' },
      { cls: 'Soil___dry',        conf: 0.63, health: 'DISEASED' },
      { cls: 'Soil___healthy',    conf: 0.92, health: 'HEALTHY' },
      { cls: 'Soil___degraded',   conf: 0.55, health: 'AT_RISK'  },
    ],
  };

  const yieldCategories = ['POOR', 'AVERAGE', 'GOOD', 'EXCELLENT'];

  for (const farm of farms) {
    console.log(`\n  Seeding data for: ${farm.name}`);

    // Devices
    const device1 = await prisma.sensorDevice.create({
      data: {
        userId: user.id, farmId: farm.id,
        deviceName: `ESP32-${farm.name.split(' ')[0]}`,
        deviceSerial: `ESP-${farm.id.slice(0,6).toUpperCase()}`,
        deviceType: 'ESP32', isOnline: Math.random() > 0.3,
        batteryLevel: rand(40, 100), firmwareVersion: '2.1.0',
        lastReadingAt: daysAgo(randInt(0, 2)),
      },
    });
    const device2 = await prisma.sensorDevice.create({
      data: {
        userId: user.id, farmId: farm.id,
        deviceName: `Simulator-${farm.name.split(' ')[0]}`,
        deviceSerial: `SIM-${farm.id.slice(0,6).toUpperCase()}`,
        deviceType: 'SIMULATED', isOnline: true,
        batteryLevel: null, firmwareVersion: '1.0.0',
        lastReadingAt: new Date(),
      },
    });
    console.log(`    ✓ 2 devices`);

    // 30 Soil Readings over past 6 months
    const readingIds = [];
    const readingData = [];
    for (let i = 0; i < 30; i++) {
      readingData.push({
        farmId: farm.id,
        deviceId: i % 3 === 0 ? device1.id : device2.id,
        source: i % 4 === 0 ? 'MANUAL' : 'SIMULATED',
        readingAt: daysAgo(Math.floor((30 - i) * 6)),
        soilMoisture: rand(25, 78),
        soilTemperature: rand(16, 35),
        soilPh: rand(5.2, 7.8, 2),
        electricalConductivity: rand(0.2, 2.8, 2),
        bulkDensity: rand(1.0, 1.7, 2),
        organicMatter: rand(1.2, 5.8),
        nitrogenPpm: rand(8, 75),
        phosphorusPpm: rand(6, 55),
        potassiumPpm: rand(60, 340),
        calciumPpm: rand(350, 2000),
        magnesiumPpm: rand(35, 190),
        sulfurPpm: rand(7, 50),
        microbialDiversityIndex: rand(2.1, 7.2, 2),
        nitrogenFixingBacteriaRatio: rand(5, 42),
        mycorrhizalFungiPresence: Math.random() > 0.4,
        pathogenicFungiRatio: rand(0.3, 14),
        bacterialCountCfu: rand(4, 130),
        rainfallMm: rand(0, 45),
        ambientTemperature: rand(18, 38),
        humidity: rand(38, 90),
        fertilizerKgPerHa: rand(80, 420),
        previousYieldTons: rand(2.0, 9.0, 2),
        growingSeasonDays: randInt(85, 165),
      });
    }
    const readings = await prisma.$transaction(
      readingData.map((d) => prisma.soilReading.create({ data: d }))
    );
    readingIds.push(...readings.map((r) => r.id));
    console.log(`    ✓ 30 soil readings`);

    // 10 Image Analyses
    const samples = imageSamples[farm.cropType] || imageSamples.MIXED;
    for (let i = 0; i < 10; i++) {
      const s = samples[i];
      const imgType = s.cls.startsWith('Tomato') ? 'TOMATO'
                    : s.cls.startsWith('Corn')   ? 'CORN'  : 'SOIL';
      const analysis = await prisma.imageAnalysis.create({
        data: {
          farmId: farm.id,
          imageType: imgType,
          imagePath: `uploads/images/${farm.id}/sample_${i}.jpg`,
          originalFilename: `crop_image_${i + 1}.jpg`,
          predictedClass: s.cls,
          confidence: s.conf,
          allClassScores: { [s.cls]: s.conf, 'other': parseFloat((1 - s.conf).toFixed(2)) },
          healthStatus: s.health,
          yieldImpactNote: `Sample note for ${s.cls}`,
          analyzedAt: daysAgo(randInt(1, 150)),
        },
      });
      await prisma.imageRecommendation.create({
        data: {
          analysisId: analysis.id,
          title: `Recommendation for ${s.cls}`,
          description: `Detected ${s.cls} with ${(s.conf * 100).toFixed(0)}% confidence.`,
          severity: s.health === 'CRITICAL' ? 'CRITICAL' : s.health === 'DISEASED' ? 'HIGH' : s.health === 'AT_RISK' ? 'MEDIUM' : 'LOW',
          actionItems: ['Monitor crop closely', 'Apply appropriate treatment', 'Consult agronomist'],
        },
      });
    }
    console.log(`    ✓ 10 image analyses`);

    // 20 Yield Predictions (first 15 with actual yield)
    for (let i = 0; i < 20; i++) {
      const predicted = rand(1.5, 9.0, 3);
      const hasActual = i < 15;
      const actual = hasActual
        ? parseFloat((predicted * rand(0.80, 1.20, 3)).toFixed(3))
        : null;
      const category = predicted < 2 ? 'POOR' : predicted < 4 ? 'AVERAGE' : predicted < 6 ? 'GOOD' : 'EXCELLENT';

      const pred = await prisma.yieldPrediction.create({
        data: {
          farmId: farm.id,
          soilReadingId: i < readings.length ? readings[i].id : null,
          predictedYieldTons: predicted,
          confidenceLow: parseFloat((predicted - rand(0.2, 0.6, 2)).toFixed(3)),
          confidenceHigh: parseFloat((predicted + rand(0.2, 0.6, 2)).toFixed(3)),
          yieldCategory: category,
          regionalAverage: farm.cropType === 'TOMATO' ? 5.5 : farm.cropType === 'CORN' ? 6.0 : 5.0,
          actualYieldTons: actual,
          shapValues: { nitrogenPpm: rand(-0.8, 0.8, 3), soilPh: rand(-0.5, 0.5, 3), organicMatter: rand(-0.4, 0.4, 3) },
          topFeatures: [
            { feature: 'nitrogenPpm', shapValue: rand(-0.8, 0.8, 3), direction: 'positive', interpretation: 'Nitrogen levels boosting yield' },
            { feature: 'soilPh',      shapValue: rand(-0.5, 0.5, 3), direction: 'positive', interpretation: 'Optimal pH range' },
          ],
          createdAt: daysAgo(randInt(1, 170)),
        },
      });

      await prisma.soilRecommendation.create({
        data: {
          predictionId: pred.id,
          category: 'FERTILIZER',
          title: 'Optimize Nutrient Application',
          description: 'Based on soil sensor data, nutrient levels could be improved.',
          severity: 'MEDIUM',
          actionItems: ['Apply balanced NPK fertilizer', 'Test soil every 30 days', 'Monitor plant response'],
        },
      });
    }
    console.log(`    ✓ 20 yield predictions (15 with actual yield)`);
  }

  console.log('\n✅ Seed complete!\n');
  console.log('  Demo login: demo@farm.ai / demo1234');
  console.log('  Open:       http://localhost:3000\n');
}

main()
  .catch((e) => { console.error('\n❌ Seed failed:', e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
