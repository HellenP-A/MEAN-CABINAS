const { OccupiedNight, Payment } = require('../models');
const { toUtcDate } = require('./dateUtils');

// Costa Rica no tiene horario de verano: siempre seis horas detras de UTC
const TZ_OFFSET_HOURS = 6;
const HOUR = 60 * 60 * 1000;

function unitFor(groupBy) {
  if (groupBy === 'day') return 'day';
  if (groupBy === 'week') return 'week';
  if (groupBy === 'year') return 'year';
  return 'month';
}

/** Medianoche local expresada en UTC, para que los cortes caigan donde deben. */
function localMidnight(iso, addDays = 0) {
  const date = toUtcDate(iso);
  date.setUTCDate(date.getUTCDate() + addDays);
  return new Date(date.getTime() + TZ_OFFSET_HOURS * HOUR);
}

const key = (date) => date.toISOString().slice(0, 10);

/**
 * Dos miradas distintas del mismo negocio:
 *
 *   cobrado    -> dinero recibido, por fecha de pago. Sirve para caja.
 *   produccion -> monto de cada reserva repartido entre sus noches y cabinas.
 *                 Cae en el mes en que se durmio, no en el que se pago,
 *                 y por eso es la que revela temporada alta y baja.
 */
async function incomeReport({ from, to, groupBy = 'month' }) {
  const unit = unitFor(groupBy);

  const payments = await Payment.aggregate([
    { $match: { paidAt: { $gte: localMidnight(from), $lt: localMidnight(to, 1) } } },
    {
      $group: {
        _id: {
          $dateTrunc: {
            date: '$paidAt',
            unit,
            timezone: 'America/Costa_Rica',
            startOfWeek: 'monday'
          }
        },
        income: { $sum: '$amount' },
        payments: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const stays = await OccupiedNight.aggregate([
    { $match: { date: { $gte: toUtcDate(from), $lt: localMidnight(to, 1) } } },
    {
      $lookup: {
        from: 'bookings',
        localField: 'bookingId',
        foreignField: '_id',
        as: 'booking'
      }
    },
    { $unwind: '$booking' },
    { $match: { 'booking.status': { $ne: 'cancelled' } } },
    {
      $group: {
        _id: { $dateTrunc: { date: '$date', unit, timezone: 'UTC', startOfWeek: 'monday' } },
        nights: { $sum: 1 },
        revenue: {
          $sum: {
            $divide: [
              '$booking.total',
              { $multiply: ['$booking.nights', { $ifNull: ['$booking.cabinCount', 1] }] }
            ]
          }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const rows = new Map();

  payments.forEach((item) => {
    rows.set(key(item._id), {
      period: key(item._id),
      income: item.income,
      payments: item.payments,
      nights: 0,
      revenue: 0
    });
  });

  stays.forEach((item) => {
    const id = key(item._id);
    const current = rows.get(id) || { period: id, income: 0, payments: 0, nights: 0, revenue: 0 };
    current.nights = item.nights;
    current.revenue = Math.round(item.revenue);
    rows.set(id, current);
  });

  const list = [...rows.values()].sort((a, b) => a.period.localeCompare(b.period));

  const totals = list.reduce(
    (sum, row) => ({
      income: sum.income + row.income,
      payments: sum.payments + row.payments,
      nights: sum.nights + row.nights,
      revenue: sum.revenue + row.revenue
    }),
    { income: 0, payments: 0, nights: 0, revenue: 0 }
  );

  // La temporada se mide por produccion, no por cobros
  const active = list.filter((row) => row.revenue > 0);
  const best = active.reduce((max, row) => (!max || row.revenue > max.revenue ? row : max), null);
  const worst = active.reduce((min, row) => (!min || row.revenue < min.revenue ? row : min), null);

  return { from, to, groupBy, rows: list, totals, best, worst };
}

module.exports = { incomeReport };
