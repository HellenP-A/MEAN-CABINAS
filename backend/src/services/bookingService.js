const mongoose = require('mongoose');
const { Booking, Cabin, Payment, OccupiedNight } = require('../models');
const { toUtcDate, countNights, listNights } = require('./dateUtils');
const { resolveRate } = require('./rateService');

const DUPLICATE_KEY = 11000;

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Crea una reserva ocupando primero las noches.
 * Si alguna ya esta tomada, el indice unico rechaza el insert y se limpian
 * las que alcanzaron a entrar. No requiere transacciones ni replica set.
 */
async function createBooking(payload) {
  const { cabinId, guestId, checkIn, checkOut, guests, rateType = 'general', rate, notes } = payload;

  const cabin = await Cabin.findById(cabinId);
  if (!cabin) throw fail('La cabina no existe', 404);
  if (!cabin.active) throw fail('La cabina esta inactiva', 400);

  const guestCount = Number(guests);
  if (!guestCount || guestCount < 1) throw fail('Indique la cantidad de huespedes', 400);
  if (guestCount > cabin.capacity) {
    throw fail(`La cabina admite un maximo de ${cabin.capacity} huespedes`, 400);
  }

  const nights = countNights(checkIn, checkOut);
  if (nights < 1) throw fail('La fecha de salida debe ser posterior a la de entrada', 400);

  const unitRate = await resolveRate({ rateType, cabin, explicitRate: rate });
  const bookingId = new mongoose.Types.ObjectId();
  const nightDocs = listNights(checkIn, checkOut).map((date) => ({ cabinId, date, bookingId }));

  try {
    await OccupiedNight.insertMany(nightDocs, { ordered: true });
  } catch (error) {
    await OccupiedNight.deleteMany({ bookingId });

    if (error.code === DUPLICATE_KEY || error?.writeErrors?.[0]?.err?.code === DUPLICATE_KEY) {
      throw fail('La cabina ya esta ocupada en alguna de esas fechas', 409);
    }
    throw error;
  }

  try {
    return await Booking.create({
      _id: bookingId,
      cabinId,
      guestId,
      checkIn: toUtcDate(checkIn),
      checkOut: toUtcDate(checkOut),
      nights,
      guests: guestCount,
      rateType,
      rate: unitRate,
      total: nights * guestCount * unitRate,
      notes
    });
  } catch (error) {
    // Si falla la reserva liberamos las noches, para no dejar fechas bloqueadas
    await OccupiedNight.deleteMany({ bookingId });
    throw error;
  }
}

/** Cancela la reserva y libera las noches ocupadas. */
async function cancelBooking(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw fail('La reserva no existe', 404);

  booking.status = 'cancelled';
  await booking.save();
  await OccupiedNight.deleteMany({ bookingId: booking._id });
  return booking;
}

/** Reserva con huesped, cabina, pagos y saldo pendiente. */
async function getBookingDetail(bookingId) {
  const booking = await Booking.findById(bookingId)
    .populate('cabinId', 'code name capacity')
    .populate('guestId', 'idNumber fullName phone');

  if (!booking) throw fail('La reserva no existe', 404);

  const payments = await Payment.find({ bookingId }).sort({ paidAt: -1 });
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return { booking, payments, paid, balance: booking.total - paid };
}

/** Cabinas libres en un rango, opcionalmente con capacidad suficiente. */
async function findAvailableCabins(checkIn, checkOut, guests) {
  const nights = listNights(checkIn, checkOut);
  if (nights.length === 0) throw fail('Rango de fechas invalido', 400);

  const busyCabinIds = await OccupiedNight.distinct('cabinId', { date: { $in: nights } });
  const filter = { active: true, _id: { $nin: busyCabinIds } };
  if (guests) filter.capacity = { $gte: Number(guests) };

  return Cabin.find(filter).sort({ code: 1 });
}

/** Cotiza sin reservar: sirve para mostrar el monto antes de confirmar. */
async function quote({ cabinId, checkIn, checkOut, guests, rateType = 'general', rate }) {
  const cabin = await Cabin.findById(cabinId);
  if (!cabin) throw fail('La cabina no existe', 404);

  const nights = countNights(checkIn, checkOut);
  if (nights < 1) throw fail('Rango de fechas invalido', 400);

  const guestCount = Number(guests);
  const unitRate = await resolveRate({ rateType, cabin, explicitRate: rate });

  return { nights, guests: guestCount, rateType, rate: unitRate, total: nights * guestCount * unitRate };
}

module.exports = {
  createBooking,
  cancelBooking,
  getBookingDetail,
  findAvailableCabins,
  quote
};
