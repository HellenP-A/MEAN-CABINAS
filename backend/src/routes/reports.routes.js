const express = require('express');
const { incomeReport } = require('../services/reportService');

const router = express.Router();

// /api/reports/income?from=AAAA-MM-DD&to=AAAA-MM-DD&groupBy=day|week|month
router.get('/income', async (req, res, next) => {
  try {
    const { from, to, groupBy } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: 'Indique el rango de fechas' });
    }
    res.json(await incomeReport({ from, to, groupBy }));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
