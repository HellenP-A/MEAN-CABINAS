const mongoose = require('mongoose');

// Huesped: se identifica por cedula para no duplicar registros entre visitas.
const guestSchema = new mongoose.Schema(
  {
    idNumber: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Guest', guestSchema);
