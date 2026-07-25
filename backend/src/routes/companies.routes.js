const express = require('express');
const { Company } = require('../models');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await Company.find({ active: true }).sort({ name: 1 }));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await Company.create(req.body));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ya existe una empresa con ese nombre' });
    }
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!company) return res.status(404).json({ message: 'La empresa no existe' });
    res.json(company);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
