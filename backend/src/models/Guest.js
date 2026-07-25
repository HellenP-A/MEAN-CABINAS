const mongoose = require('mongoose');

// Huesped: se identifica por cedula para no duplicar registros entre visitas.
const guestSchema = new mongoose.Schema(
  {
    // national: identificacion costarricense, con formato 1-1234-0567
    // foreign: pasaporte, DIMEX u otro documento, sin formato fijo
    idType: { type: String, enum: ['national', 'foreign'], default: 'national' },
    idNumber: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    // Empresa que lo envia, si corresponde. Un huesped particular no lleva ninguna
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    // Se oculta del acceso rapido sin borrar al huesped ni sus reservas
    hiddenFromFrequent: { type: Boolean, default: false },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Guest', guestSchema);
