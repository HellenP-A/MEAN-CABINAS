const mongoose = require('mongoose');

// Cabina: unidad que se alquila. El precio base sirve como sugerencia al reservar.
const cabinSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    basePrice: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cabin', cabinSchema);
