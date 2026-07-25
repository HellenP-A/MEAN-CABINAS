const mongoose = require('mongoose');
const { Booking, Cabin, Payment, OccupiedNight } = require('../models');
const { toUtcDate, countNights, listNights } = require('./dateUtils');
const { calculatePrice } = require('./priceService');

const DUPLICATE_KEY = 11000;

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Resuelve que cabinas participan y valida la cantidad de personas.
 * En el alquiler completo participan todas las cabinas activas.
 */
async function resolveTarget({ bookingType = 'cabin', cabinId, guests }) {
  const guestCount = Number(guests);
  if (!guestCount || guestCount < 1) throw fail('Indique la cantidad de huespedes', 400);

  if (bookingType === 'full') {
    const cabins = await Cabin.find({ active: true }).sort({ number: 1 });
    if (cabins.length === 0) throw fail('No hay cabinas activas', 400);

    const capacity = cabins.reduce((sum, cabin) => sum + cabin.capacity, 0);
    if (guestCount > capacity) {
      throw fail(`La propiedad completa admite un maximo de ${capacity} personas`, 400);
    }
    return { bookingType, cabins, cabin: null, guestCount };
  }

  const cabin = await Cabin.findById(cabinId);
  if (!cabin) throw fail('La cabina no existe', 404);
  if (!cabin.active) throw fail('La cabina esta inactiva', 400);
  if (guestCount > cabin.capacity) {
    throw fail(`La cabina admite un maximo de ${cabin.capacity} huespedes`, 400);
  }

  return { bookingType: 'cabin', cabins: [cabin], cabin, guestCount };
}

function resolveNights(checkIn, checkOut) {
  const nights = countNights(checkIn, checkOut);
  if (nights < 1) throw fail('La fecha de salida debe ser posterior a la de entrada', 400);
  return nights;
}

/** Cotiza sin guardar: para mostrar el monto mientras se llena el formulario. */
async function quote(payload) {
  const { checkIn, checkOut, rateType = 'general', discountPercent } = payload;
  const { bookingType, cabin, guestCount } = await resolveTarget(payload);
  const nights = resolveNights(checkIn, checkOut);

  const price = await calculatePrice({
    bookingType,
    cabin,
    nights,
    guests: guestCount,
    rateType,
    discountPercent
  });

  return { bookingType, nights, guests: guestCount, rateType, ...price };
}

/**
 * Crea la reserva ocupando primero las noches de cada cabina involucrada.
 * Si alguna ya esta tomada, el indice unico rechaza el insert y se limpian
 * las que alcanzaron a entrar. Sirve igual para una cabina que para las quince.
 */
async function createBooking(payload) {
  const { guestId, checkIn, checkOut, rateType = 'general', discountPercent, notes } = payload;
  const { bookingType, cabins, cabin, guestCount } = await resolveTarget(payload);
  const nights = resolveNights(checkIn, checkOut);

  const price = await calculatePrice({
    bookingType,
    cabin,
    nights,
    guests: guestCount,
    rateType,
    discountPercent
  });

  const bookingId = new mongoose.Types.ObjectId();
  const dates = listNights(checkIn, checkOut);
  const nightDocs = cabins.flatMap((item) =>
    dates.map((date) => ({ cabinId: item._id, date, bookingId }))
  );

  try {
    await OccupiedNight.insertMany(nightDocs, { ordered: true });
  } catch (error) {
    await OccupiedNight.deleteMany({ bookingId });

    if (error.code === DUPLICATE_KEY || error?.writeErrors?.[0]?.err?.code === DUPLICATE_KEY) {
      const message =
        bookingType === 'full'
          ? 'Hay cabinas ocupadas en esas fechas, no se puede alquilar completo'
          : 'La cabina ya esta ocupada en alguna de esas fechas';
      throw fail(message, 409);
    }
    throw error;
  }

  try {
    return await Booking.create({
      _id: bookingId,
      bookingType,
      cabinId: bookingType === 'cabin' ? cabin._id : undefined,
      guestId,
      checkIn: toUtcDate(checkIn),
      checkOut: toUtcDate(checkOut),
      nights,
      guests: guestCount,
      rateType,
      ...price,
      notes
    });
  } catch (error) {
    // Si falla la reserva liberamos las noches, para no dejar fechas bloqueadas
    await OccupiedNight.deleteMany({ bookingId });
    throw error;
  }
}

/** Cancela la reserva y libera todas sus noches. */
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
    .populate('guestId', 'idNumber idType fullName phone');

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

  return Cabin.find(filter).sort({ number: 1 });
}

/** Indica si toda la propiedad esta libre, para habilitar el alquiler completo. */
async function propertyAvailability(checkIn, checkOut) {
  const available = await findAvailableCabins(checkIn, checkOut);
  const total = await Cabin.countDocuments({ active: true });
  const capacity = available.reduce((sum, cabin) => sum + cabin.capacity, 0);

  return {
    total,
    available: available.length,
    free: available.length === total,
    capacity
  };
}

/**
 * Las 15 cabinas en orden, cada una con su estado en el rango indicado.
 * La interfaz las muestra todas: las ocupadas salen deshabilitadas.
 */
async function listCabinsWithAvailability(checkIn, checkOut) {
  const nights = listNights(checkIn, checkOut);
  if (nights.length === 0) throw fail('Rango de fechas invalido', 400);

  const busyIds = await OccupiedNight.distinct('cabinId', { date: { $in: nights } });
  const busy = new Set(busyIds.map(String));

  const cabins = await Cabin.find({ active: true }).sort({ number: 1 }).lean();
  return cabins.map((cabin) => ({ ...cabin, available: !busy.has(String(cabin._id)) }));
}

/**
 * Estado de las 15 cabinas en una fecha concreta.
 * Se parte de las noches ocupadas, que es la fuente de verdad,
 * y se trae la reserva de cada una con su responsable.
 */
async function occupancyByDate(value) {
  const date = toUtcDate(value);

  const nights = await OccupiedNight.find({ date }).lean();
  const bookingByCabin = new Map(nights.map((n) => [String(n.cabinId), String(n.bookingId)]));
  const bookingIds = [...new Set(nights.map((n) => String(n.bookingId)))];

  const bookings = await Booking.find({ _id: { $in: bookingIds } })
    .populate('guestId', 'idNumber idType fullName phone')
    .lean();
  const bookingById = new Map(bookings.map((b) => [String(b._id), b]));

  const cabins = await Cabin.find({ active: true }).sort({ number: 1 }).lean();

  return cabins.map((cabin) => {
    const id = bookingByCabin.get(String(cabin._id));
    return { ...cabin, booking: id ? bookingById.get(id) ?? null : null };
  });
}

/**
 * Rejilla de ocupacion: cada cabina con el estado de cada dia del rango.
 *
 * Devuelve las reservas aparte y en los dias solo su identificador, para no
 * repetir los mismos datos en cada celda. La interfaz arma la barra uniendo
 * los dias consecutivos que comparten identificador.
 */
async function calendarRange(fromValue, dayCount = 14) {
  const from = toUtcDate(fromValue);
  const days = Math.min(Math.max(Number(dayCount) || 14, 1), 62);

  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + days);

  const dates = listNights(from, to).map((date) => date.toISOString().slice(0, 10));

  const nights = await OccupiedNight.find({ date: { $gte: from, $lt: to } }).lean();

  // Clave cabina|fecha para resolver cada celda en una sola pasada
  const byCell = new Map();
  nights.forEach((night) => {
    byCell.set(`${night.cabinId}|${night.date.toISOString().slice(0, 10)}`, String(night.bookingId));
  });

  const bookingIds = [...new Set(nights.map((night) => String(night.bookingId)))];
  const bookings = await Booking.find({ _id: { $in: bookingIds } })
    .populate('guestId', 'idNumber idType fullName phone')
    .lean();

  const bookingById = {};
  bookings.forEach((booking) => {
    bookingById[String(booking._id)] = {
      _id: String(booking._id),
      bookingType: booking.bookingType,
      guestName: booking.guestId?.fullName ?? 'Sin responsable',
      idNumber: booking.guestId?.idNumber ?? '',
      idType: booking.guestId?.idType ?? 'national',
      idType: booking.guestId?.idType ?? 'national',
      phone: booking.guestId?.phone ?? '',
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights: booking.nights,
      guests: booking.guests,
      rateType: booking.rateType,
      discountPercent: booking.discountPercent,
      total: booking.total,
      status: booking.status
    };
  });

  const cabins = await Cabin.find({ active: true }).sort({ number: 1 }).lean();

  return {
    from: dates[0],
    to: dates[dates.length - 1],
    dates,
    bookings: bookingById,
    cabins: cabins.map((cabin) => ({
      _id: String(cabin._id),
      number: cabin.number,
      name: cabin.name,
      capacity: cabin.capacity,
      days: dates.map((date) => byCell.get(`${cabin._id}|${date}`) ?? null)
    }))
  };
}

/**
 * Edita una reserva existente.
 *
 * Primero libera sus propias noches, para que no choque consigo misma, y
 * despues intenta tomar las nuevas. Si alguna esta ocupada por otra reserva,
 * se restauran las anteriores y la reserva queda como estaba: nunca se pierde
 * el lugar por un intento fallido.
 */
async function updateBooking(bookingId, payload) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw fail('La reserva no existe', 404);
  if (booking.status === 'cancelled') throw fail('La reserva esta cancelada', 400);

  // Lo que no venga en el payload conserva el valor actual
  const merged = {
    bookingType: payload.bookingType ?? booking.bookingType,
    cabinId: payload.cabinId ?? booking.cabinId,
    checkIn: payload.checkIn ?? booking.checkIn,
    checkOut: payload.checkOut ?? booking.checkOut,
    guests: payload.guests ?? booking.guests,
    rateType: payload.rateType ?? booking.rateType,
    discountPercent: payload.discountPercent ?? booking.discountPercent,
    notes: payload.notes ?? booking.notes
  };

  const { bookingType, cabins, cabin, guestCount } = await resolveTarget(merged);
  const nights = resolveNights(merged.checkIn, merged.checkOut);

  const price = await calculatePrice({
    bookingType,
    cabin,
    nights,
    guests: guestCount,
    rateType: merged.rateType,
    discountPercent: merged.discountPercent
  });

  const previous = await OccupiedNight.find({ bookingId: booking._id }).lean();
  await OccupiedNight.deleteMany({ bookingId: booking._id });

  const dates = listNights(merged.checkIn, merged.checkOut);
  const nightDocs = cabins.flatMap((item) =>
    dates.map((date) => ({ cabinId: item._id, date, bookingId: booking._id }))
  );

  try {
    await OccupiedNight.insertMany(nightDocs, { ordered: true });
  } catch (error) {
    await OccupiedNight.deleteMany({ bookingId: booking._id });

    // Devuelve la reserva a las noches que tenia antes del intento
    if (previous.length > 0) {
      await OccupiedNight.insertMany(
        previous.map((night) => ({
          cabinId: night.cabinId,
          date: night.date,
          bookingId: night.bookingId
        })),
        { ordered: false }
      );
    }

    if (error.code === DUPLICATE_KEY || error?.writeErrors?.[0]?.err?.code === DUPLICATE_KEY) {
      const message =
        bookingType === 'full'
          ? 'Hay cabinas ocupadas en esas fechas, no se puede alquilar completo'
          : 'La cabina ya esta ocupada en alguna de esas fechas';
      throw fail(message, 409);
    }
    throw error;
  }

  booking.set({
    bookingType,
    cabinId: bookingType === 'cabin' ? cabin._id : undefined,
    checkIn: toUtcDate(merged.checkIn),
    checkOut: toUtcDate(merged.checkOut),
    nights,
    guests: guestCount,
    rateType: merged.rateType,
    notes: merged.notes,
    ...price
  });

  await booking.save();
  return booking;
}

module.exports = {
  createBooking,
  cancelBooking,
  updateBooking,
  getBookingDetail,
  findAvailableCabins,
  occupancyByDate,
  calendarRange,
  listCabinsWithAvailability,
  propertyAvailability,
  quote
};
