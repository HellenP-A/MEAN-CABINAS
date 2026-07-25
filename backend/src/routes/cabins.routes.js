const express = require('express');
const { Cabin } = require('../models');
const { findAvailableCabins } = require('../services/bookingService');

const router = express.Router();

// Disponibles en un rango: /api/cabins/available?checkIn=&checkOut=&guests=
router.get('/available', async (req, res, next) => {
  try {
    const { checkIn, checkOut, guests } = req.query;
    res.json(await findAvailableCabins(checkIn, checkOut, guests));
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    res.json(await Cabin.find().sort({ code: 1 }));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await Cabin.create(req.body));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const cabin = await Cabin.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!cabin) return res.status(404).json({ message: 'La cabina no existe' });
    res.json(cabin);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
