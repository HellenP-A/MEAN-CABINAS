const express = require('express');
const {
  getCorporateRate,
  setCorporateRate,
  getFullPropertyRate,
  setFullPropertyRate,
  getTax,
  setTax
} = require('../services/rateService');
const { getCleaningWindow, setCleaningWindow } = require('../services/cleaningService');

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

router.get('/cleaning', async (req, res, next) => {
  try {
    res.json(await getCleaningWindow());
  } catch (error) {
    next(error);
  }
});

router.put('/cleaning', async (req, res, next) => {
  try {
    const setting = await setCleaningWindow(req.body);
    res.json(setting.value);
  } catch (error) {
    next(error);
  }
});

router.get('/tax', async (req, res, next) => {
  try {
    res.json(await getTax());
  } catch (error) {
    next(error);
  }
});

router.put('/tax', async (req, res, next) => {
  try {
    const setting = await setTax(req.body);
    res.json(setting.value);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
