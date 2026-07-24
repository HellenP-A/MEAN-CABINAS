const mongoose = require('mongoose');

// Reserva: checkOut es exclusivo, esa noche no se ocupa ni se cobra.
const bookingSchema = new mongoose.Schema(
  {
    cabinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cabin', required: true },
    guestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest', required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true, min: 1 },
    ratePerNight: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['reserved', 'checked_in', 'closed', 'cancelled'],
      default: 'reserved'
    },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

bookingSchema.index({ cabinId: 1, checkIn: 1 });
bookingSchema.index({ status: 1, checkIn: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
