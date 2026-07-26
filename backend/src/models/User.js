const mongoose = require('mongoose');

// Usuario del sistema. Nunca se guarda la contrasena, solo su hash.
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    fullName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    // admin puede ver precios y reportes; reception solo la operacion diaria
    role: { type: String, enum: ['admin', 'reception'], default: 'reception' },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
