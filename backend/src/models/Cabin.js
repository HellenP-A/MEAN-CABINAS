const mongoose = require('mongoose');

// Cabina: unidad que se alquila.
// El precio es por huesped por noche y lo administra el usuario desde la app.
const cabinSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1, max: 10 },
    pricePerGuest: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cabin', cabinSchema);
