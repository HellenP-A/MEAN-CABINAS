require('dotenv').config();
const mongoose = require('mongoose');
const { Booking, OccupiedNight } = require('../models');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const bookings = await Booking.find({ cabinCount: { $exists: false } });

  for (const booking of bookings) {
    const cabins = await OccupiedNight.distinct('cabinId', { bookingId: booking._id });
    booking.cabinCount = Math.max(cabins.length, 1);
    await booking.save();
  }

  console.log(`Reservas actualizadas: ${bookings.length}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
