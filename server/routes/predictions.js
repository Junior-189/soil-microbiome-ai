const express = require('express');
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');
const mlService = require('../services/mlService');
const { generateSoilRecommendations } = require('../services/recommendationEngine');

const router = express.Router();
router.use(auth);

// POST /api/predict
router.post('/', async (req, res, next) => {
  try {
    const { farmId, soilReadingId } = req.body;
    if (!farmId) return res.status(400).json({ error: 'farmId is required' });

    const farm = await prisma.farm.findFirst({ where: { id: farmId, userId: req.user.userId } });
    if (!farm) return res.status(403).json({ error: 'Access denied' });

    // Fetch reading
    let reading;
    if (soilReadingId) {
      reading = await prisma.soilReading.findUnique({ where: { id: soilReadingId } });
    } else {
      reading = await prisma.soilReading.findFirst({
        where: { farmId },
        orderBy: { readingAt: 'desc' },
      });
    }

    if (!reading) {
      return res.status(400).json({
        error: 'No soil readings found. Add sensor data first.',
      });
    }

    // Add cropType encoding from farm
    const cropTypeMap = { TOMATO: 0, CORN: 1, MIXED: 2 };
    const sensorPayload = {
      ...reading,
      cropTypeEncoded: cropTypeMap[farm.cropType] ?? 0,
      mycorrhizalFungiPresence: reading.mycorrhizalFungiPresence ? 1 : 0,
    };

    // ML prediction
    const mlResult = await mlService.predictYield(sensorPayload);

    // Generate recommendations
    const recs = generateSoilRecommendations(reading, mlResult.shapValues || {});

    // Regional average (simplified by crop type)
    const regionalAverages = { TOMATO: 5.5, CORN: 6.0, MIXED: 5.0 };
    const regionalAverage = regionalAverages[farm.cropType] || 5.0;

    // Save in transaction
    const prediction = await prisma.$transaction(async (tx) => {
      const pred = await tx.yieldPrediction.create({
        data: {
          farmId,
          soilReadingId: reading.id,
          predictedYieldTons: mlResult.predictedYieldTons,
          confidenceLow: mlResult.confidenceLow,
          confidenceHigh: mlResult.confidenceHigh,
          yieldCategory: mlResult.yieldCategory,
          regionalAverage,
          shapValues: mlResult.shapValues || {},
          topFeatures: mlResult.topFeatures || [],
          modelVersion: '1.0.0',
        },
      });

      if (recs.length > 0) {
        await tx.soilRecommendation.createMany({
          data: recs.map((r) => ({
            predictionId: pred.id,
            category: r.category,
            title: r.title,
            description: r.description,
            severity: r.severity,
            actionItems: r.actionItems,
          })),
        });
      }

      return tx.yieldPrediction.findUnique({
        where: { id: pred.id },
        include: { recommendations: true, soilReading: true },
      });
    });

    res.status(201).json(prediction);
  } catch (err) { next(err); }
});

// GET /api/predictions?farmId=&page=&limit=
router.get('/', async (req, res, next) => {
  try {
    const { farmId, page = 1, limit = 10 } = req.query;
    if (!farmId) return res.status(400).json({ error: 'farmId is required' });

    const farm = await prisma.farm.findFirst({ where: { id: farmId, userId: req.user.userId } });
    if (!farm) return res.status(403).json({ error: 'Access denied' });

    const safeLimit = Math.min(parseInt(limit) || 10, 100); // cap at 100
    const skip = (parseInt(page) - 1) * safeLimit;
    const [predictions, total] = await Promise.all([
      prisma.yieldPrediction.findMany({
        where: { farmId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
        include: { recommendations: true },
      }),
      prisma.yieldPrediction.count({ where: { farmId } }),
    ]);

    res.json({ predictions, total, page: parseInt(page), limit: safeLimit });
  } catch (err) { next(err); }
});

// GET /api/predictions/:id
router.get('/:id', async (req, res, next) => {
  try {
    const prediction = await prisma.yieldPrediction.findUnique({
      where: { id: req.params.id },
      include: { recommendations: true, soilReading: true, farm: true },
    });
    if (!prediction) return res.status(404).json({ error: 'Prediction not found' });

    const farm = await prisma.farm.findFirst({ where: { id: prediction.farmId, userId: req.user.userId } });
    if (!farm) return res.status(403).json({ error: 'Access denied' });

    res.json(prediction);
  } catch (err) { next(err); }
});

// PATCH /api/predictions/:id/actual
router.patch('/:id/actual', async (req, res, next) => {
  try {
    const { actualYieldTons } = req.body;
    const parsed = parseFloat(actualYieldTons);
    if (actualYieldTons === undefined || actualYieldTons === null || actualYieldTons === '' || isNaN(parsed) || parsed < 0) {
      return res.status(400).json({ error: 'actualYieldTons must be a non-negative number' });
    }

    const prediction = await prisma.yieldPrediction.findUnique({ where: { id: req.params.id } });
    if (!prediction) return res.status(404).json({ error: 'Prediction not found' });

    const farm = await prisma.farm.findFirst({ where: { id: prediction.farmId, userId: req.user.userId } });
    if (!farm) return res.status(403).json({ error: 'Access denied' });

    const updated = await prisma.yieldPrediction.update({
      where: { id: req.params.id },
      data: { actualYieldTons: parsed },
      include: { recommendations: true },
    });

    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
