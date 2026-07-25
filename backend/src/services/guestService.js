const { Booking, Guest } = require('../models');

/**
 * Huespedes que mas se repiten, con su cantidad de visitas y la ultima vez
 * que estuvieron. No hace falta marcarlos a mano: se cuentan las reservas.
 */
async function frequentGuests(limit = 12) {
  const grouped = await Booking.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: '$guestId',
        visits: { $sum: 1 },
        lastCheckIn: { $max: '$checkIn' }
      }
    },
    { $sort: { visits: -1, lastCheckIn: -1 } },
    { $limit: Number(limit) || 12 }
  ]);

  const guests = await Guest.find({ _id: { $in: grouped.map((item) => item._id) } })
    .populate('companyId', 'name rateType discountPercent')
    .lean();

  const byId = new Map(guests.map((guest) => [String(guest._id), guest]));

  // Se conserva el orden del conteo, que es lo que interesa mostrar arriba
  return grouped
    .filter((item) => byId.has(String(item._id)))
    .map((item) => ({
      ...byId.get(String(item._id)),
      visits: item.visits,
      lastCheckIn: item.lastCheckIn
    }));
}

module.exports = { frequentGuests };
