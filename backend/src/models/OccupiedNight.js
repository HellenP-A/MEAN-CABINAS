const mongoose = require('mongoose');

// Una fila por cada noche ocupada de cada cabina.
// El indice unico es lo que impide fisicamente el traslape de reservas.
const occupiedNightSchema = new mongoose.Schema(
  {
    cabinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cabin', required: true },
    date: { type: Date, required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true }
  },
  { timestamps: true }
);

occupiedNightSchema.index({ cabinId: 1, date: 1 }, { unique: true });
occupiedNightSchema.index({ bookingId: 1 });

module.exports = mongoose.model('OccupiedNight', occupiedNightSchema);
