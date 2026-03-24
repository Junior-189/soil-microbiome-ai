const express = require('express');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

async function verifyFarmOwnership(farmId, userId) {
  const farm = await prisma.farm.findFirst({ where: { id: farmId, userId } });
  return farm;
}

// GET /api/soil-readings?farmId=&page=&limit=
router.get('/', async (req, res, next) => {
  try {
    const { farmId, page = 1, limit = 20 } = req.query;
    if (!farmId) return res.status(400).json({ error: 'farmId is required' });

    const farm = await verifyFarmOwnership(farmId, req.user.userId);
    if (!farm) return res.status(403).json({ error: 'Access denied' });

    const safeLimit = Math.min(parseInt(limit) || 20, 100); // cap at 100
    const skip = (parseInt(page) - 1) * safeLimit;
    const [readings, total] = await Promise.all([
      prisma.soilReading.findMany({
        where: { farmId },
        orderBy: { readingAt: 'desc' },
        skip,
        take: safeLimit,
        include: { device: { select: { deviceName: true, deviceType: true } } },
      }),
      prisma.soilReading.count({ where: { farmId } }),
    ]);

    res.json({ readings, total, page: parseInt(page), limit: safeLimit });
  } catch (err) { next(err); }
});

// POST /api/soil-readings
router.post('/', async (req, res, next) => {
  try {
    const { farmId, ...fields } = req.body;
    if (!farmId) return res.status(400).json({ error: 'farmId is required' });

    const farm = await verifyFarmOwnership(farmId, req.user.userId);
    if (!farm) return res.status(403).json({ error: 'Access denied' });

    const reading = await prisma.soilReading.create({
      data: { farmId, source: 'MANUAL', ...fields },
    });
    res.status(201).json(reading);
  } catch (err) { next(err); }
});

// GET /api/soil-readings/trends/:farmId — weekly averages for last 90 days
// IMPORTANT: must be declared BEFORE /:id to avoid Express matching "trends" as an id
router.get('/trends/:farmId', async (req, res, next) => {
  try {
    const { farmId } = req.params;
    const farm = await verifyFarmOwnership(farmId, req.user.userId);
    if (!farm) return res.status(403).json({ error: 'Access denied' });

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const readings = await prisma.soilReading.findMany({
      where: { farmId, readingAt: { gte: since } },
      orderBy: { readingAt: 'asc' },
      select: {
        readingAt: true,
        soilPh: true,
        soilMoisture: true,
        nitrogenPpm: true,
        phosphorusPpm: true,
        potassiumPpm: true,
        organicMatter: true,
        microbialDiversityIndex: true,
      },
    });

    // Group by ISO week
    const weekMap = {};
    readings.forEach((r) => {
      const d = new Date(r.readingAt);
      const startOfWeek = new Date(d);
      startOfWeek.setUTCHours(0, 0, 0, 0);
      startOfWeek.setUTCDate(d.getUTCDate() - d.getUTCDay());
      const key = startOfWeek.toISOString().slice(0, 10);

      if (!weekMap[key]) weekMap[key] = { week: key, readings: [] };
      weekMap[key].readings.push(r);
    });

    const avg = (arr, key) => {
      const vals = arr.map(r => r[key]).filter(v => v !== null && v !== undefined);
      return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
    };

    const trends = Object.values(weekMap)
      .sort((a, b) => a.week.localeCompare(b.week))
      .map(({ week, readings }) => ({
        week,
        soilPh: avg(readings, 'soilPh'),
        soilMoisture: avg(readings, 'soilMoisture'),
        nitrogenPpm: avg(readings, 'nitrogenPpm'),
        phosphorusPpm: avg(readings, 'phosphorusPpm'),
        potassiumPpm: avg(readings, 'potassiumPpm'),
        organicMatter: avg(readings, 'organicMatter'),
        microbialDiversityIndex: avg(readings, 'microbialDiversityIndex'),
        count: readings.length,
      }));

    res.json(trends);
  } catch (err) { next(err); }
});

// GET /api/soil-readings/:id
router.get('/:id', async (req, res, next) => {
  try {
    const reading = await prisma.soilReading.findUnique({
      where: { id: req.params.id },
      include: { farm: true, device: true },
    });
    if (!reading) return res.status(404).json({ error: 'Reading not found' });

    const farm = await verifyFarmOwnership(reading.farmId, req.user.userId);
    if (!farm) return res.status(403).json({ error: 'Access denied' });

    res.json(reading);
  } catch (err) { next(err); }
});

// DELETE /api/soil-readings/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const reading = await prisma.soilReading.findUnique({ where: { id: req.params.id } });
    if (!reading) return res.status(404).json({ error: 'Reading not found' });

    const farm = await verifyFarmOwnership(reading.farmId, req.user.userId);
    if (!farm) return res.status(403).json({ error: 'Access denied' });

    await prisma.soilReading.delete({ where: { id: req.params.id } });
    res.json({ message: 'Reading deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
