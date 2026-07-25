const mongoose = require('mongoose');

// Parametros editables del sistema, en pares clave-valor.
// Hoy guarda la tarifa corporativa; sirve para lo que venga despues
// sin tener que tocar el codigo.
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    label: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
