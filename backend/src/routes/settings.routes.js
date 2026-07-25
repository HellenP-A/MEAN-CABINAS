const express = require('express');
const {
  getCorporateRate,
  setCorporateRate,
  getFullPropertyRate,
  setFullPropertyRate
} = require('../services/rateService');

const router = express.Router();

router.get('/corporate-rate', async (req, res, next) => {
  try {
    res.json({ rate: await getCorporateRate() });
  } catch (error) {
    next(error);
  }
});

router.put('/corporate-rate', async (req, res, next) => {
  try {
    const setting = await setCorporateRate(req.body.rate);
    res.json({ rate: Number(setting.value) });
  } catch (error) {
    next(error);
  }
});

router.get('/full-property-rate', async (req, res, next) => {
  try {
    res.json(await getFullPropertyRate());
  } catch (error) {
    next(error);
  }
});

router.put('/full-property-rate', async (req, res, next) => {
  try {
    const setting = await setFullPropertyRate(req.body);
    res.json(setting.value);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
