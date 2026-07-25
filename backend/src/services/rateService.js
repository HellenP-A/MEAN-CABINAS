const { Setting } = require('../models');

const CORPORATE_RATE_KEY = 'corporateRatePerGuest';

/** Tarifa corporativa vigente, editable por el administrador. */
async function getCorporateRate() {
  const setting = await Setting.findOne({ key: CORPORATE_RATE_KEY });
  if (!setting) {
    const error = new Error('La tarifa corporativa no esta configurada');
    error.status = 400;
    throw error;
  }
  return Number(setting.value);
}

/** Actualiza la tarifa corporativa, o la crea si aun no existe. */
async function setCorporateRate(value) {
  return Setting.findOneAndUpdate(
    { key: CORPORATE_RATE_KEY },
    { value: Number(value), label: 'Tarifa corporativa por huesped por noche' },
    { new: true, upsert: true }
  );
}

/**
 * Precio unitario que corresponde a una reserva.
 * Un valor explicito gana sobre ambas tarifas: permite casos puntuales
 * sin tener que cambiar la configuracion.
 */
async function resolveRate({ rateType, cabin, explicitRate }) {
  if (explicitRate != null && explicitRate !== '') return Number(explicitRate);
  if (rateType === 'corporate') return getCorporateRate();
  return cabin.pricePerGuest;
}

module.exports = { getCorporateRate, setCorporateRate, resolveRate, CORPORATE_RATE_KEY };
