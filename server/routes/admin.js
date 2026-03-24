const express = require('express');
const auth = require('../middleware/auth');
const mlService = require('../services/mlService');

const router = express.Router();
router.use(auth);

router.post('/train/tabular', async (req, res, next) => {
  try {
    const result = await mlService.trainTabular();
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/train/cnn', async (req, res, next) => {
  try {
    const result = await mlService.trainCNN();
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/train/all', async (req, res, next) => {
  try {
    const result = await mlService.trainAll();
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/models/status', async (req, res, next) => {
  try {
    const result = await mlService.getModelsStatus();
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
