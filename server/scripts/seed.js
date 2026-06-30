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

  // Clean up previous demo data for idempotent re-seeding
  const existing = await prisma.user.findUnique({ where: { email: 'demo@farm.ai' } });
  if (existing) {
    console.log('Cleaning previous demo data...');
    await prisma.soilRecommendation.deleteMany({ where: { prediction: { farm: { userId: existing.id } } } });
    await prisma.yieldPrediction.deleteMany({ where: { farm: { userId: existing.id } } });
    await prisma.imageRecommendation.deleteMany({ where: { analysis: { farm: { userId: existing.id } } } });
    await prisma.imageAnalysis.deleteMany({ where: { farm: { userId: existing.id } } });
    await prisma.soilReading.deleteMany({ where: { farm: { userId: existing.id } } });
    await prisma.sensorDevice.deleteMany({ where: { userId: existing.id } });
    await prisma.farm.deleteMany({ where: { userId: existing.id } });
    console.log('Cleanup complete.');
  }

  // ── Demo User ──────────────────────────────────────────────────
  const password = await bcrypt.hash('demo1234', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@farm.ai' },
    update: { role: 'admin', tokenVersion: 0 },
    create: {
      name: 'Demo Farmer',
      email: 'demo@farm.ai',
      password,
      role: 'admin',
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
    let farm = await prisma.farm.findFirst({ where: { name: fd.name, userId: user.id } });
    if (farm) {
      farm = await prisma.farm.update({ where: { id: farm.id }, data: fd });
      console.log(`✓ Farm (updated): ${farm.name}`);
    } else {
      farm = await prisma.farm.create({ data: { userId: user.id, ...fd } });
      console.log(`✓ Farm (created): ${farm.name}`);
    }
    farms.push(farm);
  }

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

    // 30 Soil Readings over past 6 months — correlated agronomic patterns
    const readingIds = [];
    const readingData = [];
    // Base profiles per crop type (realistic regional baselines)
    const profiles = {
      TOMATO: {
        soilMoisture: { base: 58, swing: 12 }, soilTemperature: { base: 24, swing: 6 },
        soilPh: { base: 6.4, swing: 0.5 }, organicMatter: { base: 3.8, swing: 1.2 },
        nitrogenPpm: { base: 38, swing: 15 }, phosphorusPpm: { base: 22, swing: 12 },
        potassiumPpm: { base: 180, swing: 60 }, microbialDiversityIndex: { base: 5.2, swing: 1.4 },
        nitrogenFixingBacteriaRatio: { base: 22, swing: 10 },
      },
      CORN: {
        soilMoisture: { base: 48, swing: 14 }, soilTemperature: { base: 28, swing: 5 },
        soilPh: { base: 6.1, swing: 0.7 }, organicMatter: { base: 2.8, swing: 1.0 },
        nitrogenPpm: { base: 28, swing: 12 }, phosphorusPpm: { base: 18, swing: 10 },
        potassiumPpm: { base: 140, swing: 50 }, microbialDiversityIndex: { base: 4.5, swing: 1.2 },
        nitrogenFixingBacteriaRatio: { base: 18, swing: 8 },
      },
      MIXED: {
        soilMoisture: { base: 62, swing: 10 }, soilTemperature: { base: 26, swing: 4 },
        soilPh: { base: 6.6, swing: 0.4 }, organicMatter: { base: 4.2, swing: 1.1 },
        nitrogenPpm: { base: 35, swing: 14 }, phosphorusPpm: { base: 25, swing: 11 },
        potassiumPpm: { base: 200, swing: 55 }, microbialDiversityIndex: { base: 5.8, swing: 1.3 },
        nitrogenFixingBacteriaRatio: { base: 25, swing: 9 },
      },
    };
    const pf = profiles[farm.cropType] || profiles.TOMATO;

    for (let i = 0; i < 30; i++) {
      const daysBack = Math.floor((30 - i) * 6);
      const readingAt = daysAgo(daysBack);
      // Seasonal drift: sine wave over 180 days, 0=now, 180=6 months ago
      const season = Math.sin((daysBack / 180) * Math.PI); // -1..1
      const wetBias = 1.0 + season * 0.3; // wetter in recent past, drier earlier
      const tempBias = 1.0 - season * 0.15; // warmer now, cooler earlier

      const baseMoisture = pf.soilMoisture.base * wetBias + rand(-pf.soilMoisture.swing, pf.soilMoisture.swing);
      const baseTemp = pf.soilTemperature.base * tempBias + rand(-pf.soilTemperature.swing, pf.soilTemperature.swing);
      const basePh = pf.soilPh.base + rand(-pf.soilPh.swing, pf.soilPh.swing);
      const baseOm = pf.organicMatter.base + rand(-pf.organicMatter.swing, pf.organicMatter.swing);
      // Nitrogen correlates with organic matter (r ~ 0.6)
      const baseN = pf.nitrogenPpm.base + (baseOm - pf.organicMatter.base) * 8 + rand(-pf.nitrogenPpm.swing, pf.nitrogenPpm.swing);
      const baseP = pf.phosphorusPpm.base + rand(-pf.phosphorusPpm.swing, pf.phosphorusPpm.swing);
      const baseK = pf.potassiumPpm.base + rand(-pf.potassiumPpm.swing, pf.potassiumPpm.swing);
      const baseMdi = pf.microbialDiversityIndex.base + (baseOm - pf.organicMatter.base) * 0.5 + rand(-pf.microbialDiversityIndex.swing, pf.microbialDiversityIndex.swing);
      const baseNfb = pf.nitrogenFixingBacteriaRatio.base + (baseOm - pf.organicMatter.base) * 4 + rand(-pf.nitrogenFixingBacteriaRatio.swing, pf.nitrogenFixingBacteriaRatio.swing);
      // Pathogenic fungi spikes when moisture is high and diversity is low
      const basePfRatio = Math.max(0.3, 4.0 - baseMdi * 0.5 + (baseMoisture - 50) * 0.1 + rand(0, 5));
      // Rainfall correlates with humidity
      const baseRainfall = Math.max(0, 25 * wetBias + rand(-12, 12));
      const baseHumidity = Math.min(98, 60 + baseRainfall * 0.6 + rand(-10, 10));
      const baseAmbientTemp = baseTemp + rand(1, 4);

      readingData.push({
        farmId: farm.id,
        deviceId: i % 3 === 0 ? device1.id : device2.id,
        source: i % 4 === 0 ? 'MANUAL' : 'SIMULATED',
        readingAt,
        soilMoisture: parseFloat(Math.max(5, Math.min(95, baseMoisture)).toFixed(1)),
        soilTemperature: parseFloat(Math.max(5, Math.min(45, baseTemp)).toFixed(1)),
        soilPh: parseFloat(Math.max(4.5, Math.min(8.5, basePh)).toFixed(2)),
        electricalConductivity: parseFloat(Math.max(0.1, Math.min(3.5, 0.8 + (baseMoisture * 0.01) + rand(-0.3, 0.3))).toFixed(2)),
        bulkDensity: parseFloat(Math.max(0.9, Math.min(1.8, 1.35 - baseOm * 0.06 + rand(-0.05, 0.05))).toFixed(2)),
        organicMatter: parseFloat(Math.max(1.0, Math.min(7.0, baseOm)).toFixed(1)),
        nitrogenPpm: parseFloat(Math.max(5, Math.min(80, baseN)).toFixed(1)),
        phosphorusPpm: parseFloat(Math.max(5, Math.min(60, baseP)).toFixed(1)),
        potassiumPpm: parseFloat(Math.max(50, Math.min(350, baseK)).toFixed(0)),
        calciumPpm: parseFloat(rand(400, 1800).toFixed(0)),
        magnesiumPpm: parseFloat(rand(30, 180).toFixed(0)),
        sulfurPpm: parseFloat(rand(6, 45).toFixed(1)),
        microbialDiversityIndex: parseFloat(Math.max(1.5, Math.min(7.5, baseMdi)).toFixed(2)),
        nitrogenFixingBacteriaRatio: parseFloat(Math.max(3, Math.min(45, baseNfb)).toFixed(1)),
        mycorrhizalFungiPresence: Math.random() > 0.35,
        pathogenicFungiRatio: parseFloat(Math.max(0.1, Math.min(15, basePfRatio)).toFixed(1)),
        bacterialCountCfu: parseFloat(Math.max(2, Math.min(140, baseMdi * 15 + rand(-10, 10))).toFixed(1)),
        rainfallMm: parseFloat(baseRainfall.toFixed(1)),
        ambientTemperature: parseFloat(Math.max(15, Math.min(40, baseAmbientTemp)).toFixed(1)),
        humidity: parseFloat(Math.max(35, Math.min(95, baseHumidity)).toFixed(1)),
        fertilizerKgPerHa: parseFloat(rand(90, 400).toFixed(0)),
        previousYieldTons: parseFloat(rand(2.5, 8.5, 2)),
        growingSeasonDays: randInt(85, 160),
      });
    }
    const readings = await prisma.$transaction(
      readingData.map((d) => prisma.soilReading.create({ data: d }))
    );
    readingIds.push(...readings.map((r) => r.id));
    console.log(`    ✓ 30 soil readings (correlated agronomic patterns)`);

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
