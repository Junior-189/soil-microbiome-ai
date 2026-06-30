const express = require('express');
const prisma = require('../lib/prisma');
const { auth } = require('../middleware/auth');
const mlService = require('../services/mlService');

const router = express.Router();
router.use(auth);

// GET /api/analytics/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const farms = await prisma.farm.findMany({
      where: { userId },
      select: { id: true },
    });
    const farmIds = farms.map((f) => f.id);

    if (farmIds.length === 0) {
      return res.json({
        totalFarms: 0, totalPredictions: 0, totalImageAnalyses: 0,
        avgPredictedYield: null, latestHealthStatus: null,
        activeDevices: 0, predictionAccuracy: null,
      });
    }

    const [
      totalPredictions,
      totalImageAnalyses,
      yieldAgg,
      latestImage,
      activeDevices,
      predictionsWithActual,
    ] = await Promise.all([
      prisma.yieldPrediction.count({ where: { farmId: { in: farmIds } } }),
      prisma.imageAnalysis.count({ where: { farmId: { in: farmIds } } }),
      prisma.yieldPrediction.aggregate({
        where: { farmId: { in: farmIds } },
        _avg: { predictedYieldTons: true },
      }),
      prisma.imageAnalysis.findFirst({
        where: { farmId: { in: farmIds } },
        orderBy: { analyzedAt: 'desc' },
        select: { healthStatus: true, analyzedAt: true },
      }),
      prisma.sensorDevice.count({ where: { farmId: { in: farmIds }, isOnline: true } }),
      prisma.yieldPrediction.findMany({
        where: { farmId: { in: farmIds }, actualYieldTons: { not: null } },
        select: { predictedYieldTons: true, actualYieldTons: true },
      }),
    ]);

    let predictionAccuracy = null;
    if (predictionsWithActual.length > 0) {
      const errors = predictionsWithActual.map(
        (p) => Math.abs(p.predictedYieldTons - p.actualYieldTons)
      );
      const squaredErrors = predictionsWithActual.map(
        (p) => Math.pow(p.predictedYieldTons - p.actualYieldTons, 2)
      );
      const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
      const rmse = Math.sqrt(squaredErrors.reduce((a, b) => a + b, 0) / squaredErrors.length);
      predictionAccuracy = { mae: Math.round(mae * 100) / 100, rmse: Math.round(rmse * 100) / 100, n: predictionsWithActual.length };
    }

    res.json({
      totalFarms: farmIds.length,
      totalPredictions,
      totalImageAnalyses,
      avgPredictedYield: yieldAgg._avg.predictedYieldTons
        ? Math.round(yieldAgg._avg.predictedYieldTons * 100) / 100
        : null,
      latestHealthStatus: latestImage?.healthStatus || null,
      activeDevices,
      predictionAccuracy,
    });
  } catch (err) { next(err); }
});

// GET /api/analytics/model-performance
router.get('/model-performance', async (req, res, next) => {
  try {
    const [tabular, cnn] = await Promise.all([
      mlService.getTabularMetrics().catch(() => null),
      mlService.getCNNMetrics().catch(() => null),
    ]);
    res.json({ tabular, cnn });
  } catch (err) { next(err); }
});

// GET /api/analytics/prediction-accuracy?farmId=
router.get('/prediction-accuracy', async (req, res, next) => {
  try {
    const { farmId } = req.query;
    if (!farmId) return res.status(400).json({ error: 'farmId is required' });

    const farm = await prisma.farm.findFirst({ where: { id: farmId, userId: req.user.userId } });
    if (!farm) return res.status(403).json({ error: 'Access denied' });

    const predictions = await prisma.yieldPrediction.findMany({
      where: { farmId, actualYieldTons: { not: null } },
      select: { id: true, predictedYieldTons: true, actualYieldTons: true, createdAt: true, yieldCategory: true },
      orderBy: { createdAt: 'desc' },
    });

    if (predictions.length === 0) {
      return res.json({ n: 0, rmse: null, mae: null, r2: null, predictions: [] });
    }

    const n = predictions.length;
    const errors = predictions.map((p) => Math.abs(p.predictedYieldTons - p.actualYieldTons));
    const squaredErrors = predictions.map((p) => Math.pow(p.predictedYieldTons - p.actualYieldTons, 2));
    const mae = errors.reduce((a, b) => a + b, 0) / n;
    const rmse = Math.sqrt(squaredErrors.reduce((a, b) => a + b, 0) / n);

    const actualMean = predictions.reduce((a, p) => a + p.actualYieldTons, 0) / n;
    const ssTot = predictions.reduce((a, p) => a + Math.pow(p.actualYieldTons - actualMean, 2), 0);
    const ssRes = squaredErrors.reduce((a, b) => a + b, 0);
    const r2 = ssTot === 0 ? null : 1 - ssRes / ssTot;

    res.json({
      n,
      rmse: Math.round(rmse * 10000) / 10000,
      mae: Math.round(mae * 10000) / 10000,
      r2: r2 !== null ? Math.round(r2 * 10000) / 10000 : null,
      predictions,
    });
  } catch (err) { next(err); }
});

module.exports = router;
