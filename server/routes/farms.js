const express = require('express');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/farms
router.get('/', async (req, res, next) => {
  try {
    const farms = await prisma.farm.findMany({
      where: { userId: req.user.userId },
      include: {
        _count: { select: { soilReadings: true, imageAnalyses: true } },
        yieldPredictions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { predictedYieldTons: true, yieldCategory: true, createdAt: true },
        },
        devices: { select: { id: true, isOnline: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(farms);
  } catch (err) { next(err); }
});

// POST /api/farms
router.post('/', async (req, res, next) => {
  try {
    const { name, location, gpsLat, gpsLng, sizeHa, cropType, region } = req.body;
    if (!name || !location) return res.status(400).json({ error: 'name and location are required' });

    const farm = await prisma.farm.create({
      data: { userId: req.user.userId, name, location, gpsLat, gpsLng, sizeHa, cropType, region },
    });
    res.status(201).json(farm);
  } catch (err) { next(err); }
});

// GET /api/farms/:id
router.get('/:id', async (req, res, next) => {
  try {
    const farm = await prisma.farm.findFirst({
      where: { id: req.params.id, userId: req.user.userId },
      include: {
        yieldPredictions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { recommendations: true },
        },
        imageAnalyses: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { recommendations: true },
        },
        devices: true,
        _count: { select: { soilReadings: true } },
      },
    });
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    res.json(farm);
  } catch (err) { next(err); }
});

// PUT /api/farms/:id
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.farm.findFirst({ where: { id: req.params.id, userId: req.user.userId } });
    if (!existing) return res.status(404).json({ error: 'Farm not found' });

    const { name, location, gpsLat, gpsLng, sizeHa, cropType, region } = req.body;
    const farm = await prisma.farm.update({
      where: { id: req.params.id },
      data: { name, location, gpsLat, gpsLng, sizeHa, cropType, region },
    });
    res.json(farm);
  } catch (err) { next(err); }
});

// DELETE /api/farms/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.farm.findFirst({ where: { id: req.params.id, userId: req.user.userId } });
    if (!existing) return res.status(404).json({ error: 'Farm not found' });

    await prisma.farm.delete({ where: { id: req.params.id } });
    res.json({ message: 'Farm deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
