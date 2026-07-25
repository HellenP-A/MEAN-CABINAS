const express = require('express');
const { Payment, Booking } = require('../models');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const filter = req.query.bookingId ? { bookingId: req.query.bookingId } : {};
    res.json(await Payment.find(filter).sort({ paidAt: -1 }));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.body.bookingId);
    if (!booking) return res.status(404).json({ message: 'La reserva no existe' });

    const payment = await Payment.create(req.body);

    // Saldo actualizado, para mostrarlo de una vez en pantalla
    const payments = await Payment.find({ bookingId: booking._id });
    const paid = payments.reduce((sum, item) => sum + item.amount, 0);

    res.status(201).json({ payment, paid, balance: booking.total - paid });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) return res.status(404).json({ message: 'El pago no existe' });
    res.json({ message: 'Pago eliminado' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
