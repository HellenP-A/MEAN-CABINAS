const mongoose = require('mongoose');

// Cabina: unidad que se alquila.
// El campo number existe para ordenar del 1 al 15; el codigo es texto
// y ordenaria C10 antes que C2.
const cabinSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true, min: 1 },
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1, max: 20 },
    basePrice: { type: Number, required: true, min: 0 },
    extraGuestPrice: { type: Number, required: true, min: 0, default: 0 },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cabin', cabinSchema);
