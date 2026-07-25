const mongoose = require('mongoose');

// Ajuste manual del estado de limpieza de una cabina en un dia.
// Existe solo cuando alguien lo marca a mano: si no hay registro,
// el estado se deduce del horario configurado.
const cleaningSchema = new mongoose.Schema(
  {
    cabinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cabin', required: true },
    date: { type: Date, required: true },
    state: { type: String, enum: ['ready', 'dirty'], required: true },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

cleaningSchema.index({ cabinId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Cleaning', cleaningSchema);
