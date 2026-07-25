const mongoose = require('mongoose');

// Reserva: checkOut es exclusivo, esa noche no se ocupa ni se cobra.
// bookingType 'full' es el alquiler a puerta cerrada: ocupa todas las cabinas
// y por eso no lleva cabinId.
const bookingSchema = new mongoose.Schema(
  {
    bookingType: { type: String, enum: ['cabin', 'full'], default: 'cabin' },
    cabinId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cabin',
      required: function () {
        return this.bookingType === 'cabin';
      }
    },
    guestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest', required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true, min: 1 },
    guests: { type: Number, required: true, min: 1 },
    rateType: { type: String, enum: ['general', 'corporate'], default: 'general' },
    rate: { type: Number, required: true, min: 0 },
    nightlyRate: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, enum: [0, 5, 10, 15, 20] },
    discountAmount: { type: Number, default: 0, min: 0 },
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
