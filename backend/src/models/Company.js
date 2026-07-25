const mongoose = require('mongoose');

// Empresa que envia huespedes. Puede mandar siempre a las mismas personas
// o gente distinta cada vez; en ambos casos define la tarifa que se aplica.
const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    contactName: { type: String, trim: true },
    phone: { type: String, trim: true },
    rateType: { type: String, enum: ['general', 'corporate'], default: 'corporate' },
    discountPercent: { type: Number, default: 0, enum: [0, 5, 10, 15, 20] },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
