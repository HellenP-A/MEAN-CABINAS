const express = require('express');
const { getCorporateRate, setCorporateRate } = require('../services/rateService');

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

module.exports = router;
