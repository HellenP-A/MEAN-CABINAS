const { Setting } = require('../models');

const CORPORATE_RATE_KEY = 'corporateRatePerGuest';
const FULL_PROPERTY_KEY = 'fullPropertyRate';
const FULL_PROPERTY_MODES = ['per_guest', 'flat'];
const TAX_KEY = 'tax';

// Los precios configurados son netos: el impuesto se suma encima
const TAX_DEFAULTS = { rate: 13, applyToGeneral: true, applyToCorporate: true, applyToFull: true };

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** Tarifa corporativa vigente, por huesped por noche. */
async function getCorporateRate() {
  const setting = await Setting.findOne({ key: CORPORATE_RATE_KEY });
  if (!setting) throw fail('La tarifa corporativa no esta configurada');
  return Number(setting.value);
}

async function setCorporateRate(value) {
  return Setting.findOneAndUpdate(
    { key: CORPORATE_RATE_KEY },
    { value: Number(value), label: 'Tarifa corporativa por huesped por noche' },
    { new: true, upsert: true }
  );
}

/**
 * Tarifa del alquiler a puerta cerrada.
 * mode 'per_guest' cobra por persona; mode 'flat' cobra un monto fijo por noche.
 * Se guarda como objeto para poder cambiar de esquema sin tocar el codigo.
 */
async function getFullPropertyRate() {
  const setting = await Setting.findOne({ key: FULL_PROPERTY_KEY });
  if (!setting) throw fail('La tarifa de alquiler completo no esta configurada');
  return setting.value;
}

async function setFullPropertyRate({ mode, ratePerGuest, flatRate }) {
  if (!FULL_PROPERTY_MODES.includes(mode)) {
    throw fail('El modo debe ser por persona o monto fijo');
  }

  const value = {
    mode,
    ratePerGuest: Number(ratePerGuest) || 0,
    flatRate: Number(flatRate) || 0
  };

  return Setting.findOneAndUpdate(
    { key: FULL_PROPERTY_KEY },
    { value, label: 'Tarifa de alquiler a puerta cerrada' },
    { new: true, upsert: true }
  );
}

/** Porcentaje de IVA y a que tarifas se aplica. */
async function getTax() {
  const setting = await Setting.findOne({ key: TAX_KEY });
  return setting ? { ...TAX_DEFAULTS, ...setting.value } : TAX_DEFAULTS;
}

async function setTax(payload) {
  const current = await getTax();
  const value = {
    rate: payload.rate != null ? Number(payload.rate) : current.rate,
    applyToGeneral: payload.applyToGeneral ?? current.applyToGeneral,
    applyToCorporate: payload.applyToCorporate ?? current.applyToCorporate,
    applyToFull: payload.applyToFull ?? current.applyToFull
  };

  return Setting.findOneAndUpdate(
    { key: TAX_KEY },
    { value, label: 'IVA y tarifas a las que aplica' },
    { new: true, upsert: true }
  );
}

module.exports = {
  getTax,
  setTax,
  TAX_KEY,
  getCorporateRate,
  setCorporateRate,
  getFullPropertyRate,
  setFullPropertyRate,
  CORPORATE_RATE_KEY,
  FULL_PROPERTY_KEY
};
