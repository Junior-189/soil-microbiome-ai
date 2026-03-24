const express = require('express');
const path = require('path');
const fs = require('fs');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const mlService = require('../services/mlService');
const { generateImageRecommendations } = require('../services/recommendationEngine');

const router = express.Router();
router.use(auth);

// POST /api/image/analyze
router.post('/analyze', uploadSingle, async (req, res, next) => {
  try {
    const { farmId, datasetType } = req.body;
    if (!farmId || !datasetType) {
      return res.status(400).json({ error: 'farmId and datasetType are required' });
    }
    if (!['soil', 'tomato', 'corn'].includes(datasetType)) {
      return res.status(400).json({ error: 'datasetType must be soil, tomato, or corn' });
    }
    if (!req.file) return res.status(400).json({ error: 'Image file is required' });

    const farm = await prisma.farm.findFirst({ where: { id: farmId, userId: req.user.userId } });
    if (!farm) return res.status(403).json({ error: 'Access denied' });

    // Read uploaded file as buffer for ML engine
    const imageBuffer = fs.readFileSync(req.file.path);

    // Call ML engine
    const mlResult = await mlService.analyzeImage(imageBuffer, req.file.filename, datasetType);

    // Generate recommendations
    const recs = generateImageRecommendations(mlResult.predictedClass, mlResult.confidence);

    // Save to DB in transaction
    const result = await prisma.$transaction(async (tx) => {
      const analysis = await tx.imageAnalysis.create({
        data: {
          farmId,
          imageType: datasetType.toUpperCase(),
          imagePath: req.file.path,
          originalFilename: req.file.originalname,
          predictedClass: mlResult.predictedClass,
          confidence: mlResult.confidence,
          allClassScores: mlResult.allClassScores,
          healthStatus: mlResult.healthStatus,
          yieldImpactNote: mlResult.yieldImpactNote,
          modelVersion: mlResult.modelVersion || '1.0.0',
        },
      });

      if (recs.length > 0) {
        await tx.imageRecommendation.createMany({
          data: recs.map((r) => ({
            analysisId: analysis.id,
            title: r.title,
            description: r.description,
            severity: r.severity,
            actionItems: r.actionItems,
          })),
        });
      }

      return tx.imageAnalysis.findUnique({
        where: { id: analysis.id },
        include: { recommendations: true },
      });
    });

    res.status(201).json(result);
  } catch (err) { next(err); }
});

// GET /api/image/analyses?farmId=&page=&limit=&imageType=
router.get('/analyses', async (req, res, next) => {
  try {
    const { farmId, page = 1, limit = 20, imageType } = req.query;
    if (!farmId) return res.status(400).json({ error: 'farmId is required' });

    const farm = await prisma.farm.findFirst({ where: { id: farmId, userId: req.user.userId } });
    if (!farm) return res.status(403).json({ error: 'Access denied' });

    const where = { farmId, ...(imageType ? { imageType: imageType.toUpperCase() } : {}) };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [analyses, total] = await Promise.all([
      prisma.imageAnalysis.findMany({
        where,
        orderBy: { analyzedAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: { recommendations: true },
      }),
      prisma.imageAnalysis.count({ where }),
    ]);

    res.json({ analyses, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// GET /api/image/analyses/:id
router.get('/analyses/:id', async (req, res, next) => {
  try {
    const analysis = await prisma.imageAnalysis.findUnique({
      where: { id: req.params.id },
      include: { recommendations: true, farm: true },
    });
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

    const farm = await prisma.farm.findFirst({ where: { id: analysis.farmId, userId: req.user.userId } });
    if (!farm) return res.status(403).json({ error: 'Access denied' });

    res.json(analysis);
  } catch (err) { next(err); }
});

// GET /api/image/analyses/:id/image — serve stored image file
router.get('/analyses/:id/image', async (req, res, next) => {
  try {
    const analysis = await prisma.imageAnalysis.findUnique({ where: { id: req.params.id } });
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

    const farm = await prisma.farm.findFirst({ where: { id: analysis.farmId, userId: req.user.userId } });
    if (!farm) return res.status(403).json({ error: 'Access denied' });

    if (!fs.existsSync(analysis.imagePath)) {
      return res.status(404).json({ error: 'Image file not found on disk' });
    }

    res.sendFile(path.resolve(analysis.imagePath));
  } catch (err) { next(err); }
});

module.exports = router;
