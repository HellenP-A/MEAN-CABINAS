const express = require('express');
const { Cabin } = require('../models');
const {
  findAvailableCabins,
  listCabinsWithAvailability,
  occupancyByDate,
  calendarRange,
  propertyAvailability
} = require('../services/bookingService');

const router = express.Router();

// Rejilla de ocupacion: /api/cabins/calendar?from=AAAA-MM-DD&days=14
router.get('/calendar', async (req, res, next) => {
  try {
    const { from, days } = req.query;
    res.json(await calendarRange(from, days));
  } catch (error) {
    next(error);
  }
});

// Quien esta en cada cabina en una fecha: /api/cabins/occupancy?date=AAAA-MM-DD
router.get('/occupancy', async (req, res, next) => {
  try {
    res.json(await occupancyByDate(req.query.date));
  } catch (error) {
    next(error);
  }
});

// Todas las cabinas con su estado: /api/cabins/availability?checkIn=&checkOut=
router.get('/availability', async (req, res, next) => {
  try {
    const { checkIn, checkOut } = req.query;
    res.json(await listCabinsWithAvailability(checkIn, checkOut));
  } catch (error) {
    next(error);
  }
});

// Solo las libres, para cuando se necesita filtrar por capacidad
router.get('/available', async (req, res, next) => {
  try {
    const { checkIn, checkOut, guests } = req.query;
    res.json(await findAvailableCabins(checkIn, checkOut, guests));
  } catch (error) {
    next(error);
  }
});

// Disponibilidad de la propiedad completa
router.get('/property', async (req, res, next) => {
  try {
    const { checkIn, checkOut } = req.query;
    res.json(await propertyAvailability(checkIn, checkOut));
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    res.json(await Cabin.find().sort({ number: 1 }));
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
