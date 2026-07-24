const mongoose = require('mongoose');

// Abonos contra una reserva. El saldo es el total menos la suma de pagos.
const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ['cash', 'sinpe', 'transfer', 'card', 'other'],
      default: 'cash'
    },
    paidAt: { type: Date, default: Date.now },
    receivedBy: { type: String, trim: true },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

paymentSchema.index({ bookingId: 1, paidAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
