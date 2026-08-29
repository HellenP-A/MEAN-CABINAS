const express = require('express');
const { Invoice } = require('../models');
const { retryInvoice, maybeInvoiceBooking, resendInvoice } = require('../services/invoiceService');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// Lista de facturas (filtro opcional por estado o reserva)
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.bookingId) filter.bookingId = req.query.bookingId;
    res.json(await Invoice.find(filter).sort({ createdAt: -1 }));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'La factura no existe' });
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

// Reenvio de cortesia al correo registrado o a uno alterno del cliente.
// Lo puede usar recepcion: reenviar no altera nada ante Hacienda.
router.post('/:id/resend', async (req, res, next) => {
  try {
    const result = await resendInvoice(req.params.id, req.body.email);
    if (!result) return res.status(404).json({ message: 'La factura no existe' });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Reintento manual, solo admin. Una factura aceptada nunca se reemite.
router.post('/:id/retry', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const invoice = await retryInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'La factura no existe' });
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

// Encolar a mano la factura de una reserva (por si el disparo automatico
// no corrio, p. ej. reservas pagadas antes de esta funcion)
router.post('/booking/:bookingId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const invoice = await maybeInvoiceBooking(req.params.bookingId);
    if (!invoice) {
      return res
        .status(400)
        .json({ message: 'La reserva no existe, esta cancelada o aun tiene saldo pendiente' });
    }
    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
