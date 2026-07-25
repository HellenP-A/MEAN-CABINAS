const { getCorporateRate, getFullPropertyRate } = require('./rateService');

const ALLOWED_DISCOUNTS = [0, 5, 10, 15, 20];

/**
 * Calcula el monto de una reserva. Cada caso tiene su formula:
 *
 *   por cabina, general     -> base + adicional x (personas - 1)
 *   por cabina, corporativa -> tarifa por huesped x personas
 *   puerta cerrada          -> por persona, o un monto fijo por noche
 *
 * Sobre el subtotal se aplica el descuento y se redondea al colon.
 */
async function calculatePrice({
  bookingType = 'cabin',
  cabin,
  nights,
  guests,
  rateType = 'general',
  discountPercent = 0
}) {
  const percent = Number(discountPercent) || 0;
  if (!ALLOWED_DISCOUNTS.includes(percent)) {
    const error = new Error('El descuento debe ser 5, 10, 15 o 20 por ciento');
    error.status = 400;
    throw error;
  }

  let rate;
  let nightlyRate;

  if (bookingType === 'full') {
    const config = await getFullPropertyRate();
    if (config.mode === 'per_guest') {
      rate = config.ratePerGuest;
      nightlyRate = rate * guests;
    } else {
      rate = config.flatRate;
      nightlyRate = config.flatRate;
    }
  } else if (rateType === 'corporate') {
    rate = await getCorporateRate();
    nightlyRate = rate * guests;
  } else {
    rate = cabin.basePrice;
    nightlyRate = cabin.basePrice + cabin.extraGuestPrice * (guests - 1);
  }

  const subtotal = nights * nightlyRate;
  const discountAmount = Math.round((subtotal * percent) / 100);

  return {
    rate,
    nightlyRate,
    subtotal,
    discountPercent: percent,
    discountAmount,
    total: subtotal - discountAmount
  };
}

module.exports = { calculatePrice, ALLOWED_DISCOUNTS };
