const { Booking, Cabin, Cleaning, OccupiedNight, Setting } = require('../models');
const { toUtcDate } = require('./dateUtils');

const CLEANING_KEY = 'cleaningWindow';
const DEFAULTS = { checkoutTime: '10:00', readyTime: '14:00' };

/** Horario vigente: salida de los huespedes y hora en que la cabina queda lista. */
async function getCleaningWindow() {
  const setting = await Setting.findOne({ key: CLEANING_KEY });
  return setting ? { ...DEFAULTS, ...setting.value } : DEFAULTS;
}

async function setCleaningWindow({ checkoutTime, readyTime }) {
  const value = {
    checkoutTime: checkoutTime || DEFAULTS.checkoutTime,
    readyTime: readyTime || DEFAULTS.readyTime
  };

  return Setting.findOneAndUpdate(
    { key: CLEANING_KEY },
    { value, label: 'Horario de salida y de disponibilidad' },
    { new: true, upsert: true }
  );
}

/** Marca o desmarca a mano el estado de una cabina en un dia. */
async function setCleaningState(cabinId, dateValue, state) {
  const date = toUtcDate(dateValue);

  if (!state) {
    await Cleaning.deleteOne({ cabinId, date });
    return null;
  }

  return Cleaning.findOneAndUpdate(
    { cabinId, date },
    { state },
    { new: true, upsert: true }
  );
}

/**
 * Estado de cada cabina en un momento dado: ocupada, en limpieza o disponible.
 *
 * La regla base es el horario: hasta la hora de salida la cabina sigue ocupada,
 * entre esa hora y la de disponibilidad esta en limpieza, y despues queda libre.
 * El ajuste manual gana sobre el horario, porque una cabina puede quedar lista
 * antes o seguir sucia todo el dia.
 */
async function cabinStatuses({ date, time }) {
  const dayIso = date || new Date().toISOString().slice(0, 10);
  const now = time || '00:00';
  const day = toUtcDate(dayIso);
  const window = await getCleaningWindow();

  const nights = await OccupiedNight.find({ date: day }).lean();
  const bookingByCabin = new Map(nights.map((n) => [String(n.cabinId), String(n.bookingId)]));

  const bookingIds = [...new Set(nights.map((n) => String(n.bookingId)))];
  const staying = await Booking.find({ _id: { $in: bookingIds } })
    .populate('guestId', 'fullName')
    .lean();
  const stayingById = new Map(staying.map((b) => [String(b._id), b]));

  // Quienes se van hoy: su cabina pasa a limpieza despues de la hora de salida
  const leaving = await Booking.find({ checkOut: day, status: { $ne: 'cancelled' } })
    .populate('guestId', 'fullName')
    .lean();

  const leavingByCabin = new Map();
  let leavingFull = null;
  leaving.forEach((booking) => {
    if (booking.bookingType === 'full') leavingFull = booking;
    else if (booking.cabinId) leavingByCabin.set(String(booking.cabinId), booking);
  });

  const overrides = await Cleaning.find({ date: day }).lean();
  const overrideByCabin = new Map(overrides.map((o) => [String(o.cabinId), o.state]));

  const cabins = await Cabin.find({ active: true }).sort({ number: 1 }).lean();

  return {
    date: dayIso,
    time: now,
    window,
    cabins: cabins.map((cabin) => {
      const id = String(cabin._id);
      const bookingId = bookingByCabin.get(id);
      const booking = bookingId ? stayingById.get(bookingId) : null;
      const leftToday = leavingByCabin.get(id) || leavingFull || null;
      const override = overrideByCabin.get(id) || null;

      let state = 'available';
      let guestName = null;
      const arrivesToday = booking && booking.checkIn.toISOString().slice(0, 10) === dayIso;

      if (booking) {
        guestName = booking.guestId?.fullName ?? null;
        // Dia de rotacion: sale uno en la manana y entra otro en la tarde
        state = leftToday && arrivesToday && now < window.readyTime ? 'cleaning' : 'occupied';
      } else if (leftToday) {
        if (now < window.checkoutTime) {
          state = 'occupied';
          guestName = leftToday.guestId?.fullName ?? null;
        } else if (now < window.readyTime) {
          state = 'cleaning';
        }
      }

      // El ajuste manual solo aplica si no hay huespedes adentro
      if (override && state !== 'occupied') {
        state = override === 'ready' ? 'available' : 'cleaning';
      }

      return {
        _id: id,
        number: cabin.number,
        name: cabin.name,
        capacity: cabin.capacity,
        state,
        override,
        guestName,
        leavingGuest: leftToday?.guestId?.fullName ?? null,
        arrivesToday: Boolean(arrivesToday)
      };
    })
  };
}

module.exports = {
  cabinStatuses,
  getCleaningWindow,
  setCleaningWindow,
  setCleaningState,
  CLEANING_KEY
};
