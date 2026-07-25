const express = require('express');
const { Booking } = require('../models');
const {
  createBooking,
  cancelBooking,
  updateBooking,
  getBookingDetail,
  quote
} = require('../services/bookingService');
const { toUtcDate } = require('../services/dateUtils');

const router = express.Router();

// Cotiza sin guardar: para mostrar el monto mientras se llena el formulario
router.post('/quote', async (req, res, next) => {
  try {
    res.json(await quote(req.body));
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { status, from } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (from) filter.checkOut = { $gte: toUtcDate(from) };

    res.json(
      await Booking.find(filter)
        .populate('cabinId', 'code name')
        .populate('guestId', 'idNumber fullName')
        .sort({ checkIn: 1 })
    );
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await getBookingDetail(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await createBooking(req.body));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    res.json(await updateBooking(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    if (!booking) return res.status(404).json({ message: 'La reserva no existe' });
    res.json(booking);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    res.json(await cancelBooking(req.params.id));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
