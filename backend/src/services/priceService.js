const { getCorporateRate, getFullPropertyRate, getTax } = require('./rateService');

const ALLOWED_DISCOUNTS = [0, 5, 10, 15, 20];

/**
 * Calcula el monto de una reserva.
 *
 *   por cabina, general     -> cada cabina cobra su base mas sus adicionales
 *   por cabina, corporativa -> tarifa por huesped x personas
 *   puerta cerrada          -> por persona, o un monto fijo por noche
 *
 * IVA: la general y la puerta cerrada son netas (el impuesto se suma encima).
 * La corporativa YA lo trae adentro: se desglosa, no se suma.
 * Si applyTax viene en false, la reserva se registra sin IVA.
 */
async function calculatePrice({
  bookingType = 'cabin',
  assignments = [],
  nights,
  guests,
  rateType = 'general',
  discountPercent = 0,
  applyTax
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
    nightlyRate = assignments.reduce(
      (sum, item) => sum + item.cabin.basePrice + item.cabin.extraGuestPrice * (item.guests - 1),
      0
    );
    rate = assignments[0]?.cabin.basePrice ?? 0;
  }

  const subtotal = nights * nightlyRate;
  const discountAmount = Math.round((subtotal * percent) / 100);
  const afterDiscount = subtotal - discountAmount;

  const tax = await getTax();

  let applies =
    bookingType === 'full'
      ? tax.applyToFull
      : rateType === 'corporate'
        ? tax.applyToCorporate
        : tax.applyToGeneral;

  // La eleccion al guardar manda: "sin IVA" registra la reserva sin impuesto
  if (applyTax === false) applies = false;

  const taxRate = applies ? Number(tax.rate) : 0;
  const included = applies && bookingType !== 'full' && rateType === 'corporate';

  let netTotal;
  let taxAmount;
  let total;

  if (included) {
    // El precio corporativo es bruto: la base sale de dividir, no de sumar
    total = afterDiscount;
    netTotal = Math.round(total / (1 + taxRate / 100));
    taxAmount = total - netTotal;
  } else {
    netTotal = afterDiscount;
    taxAmount = Math.round((netTotal * taxRate) / 100);
    total = netTotal + taxAmount;
  }

  return {
    rate,
    nightlyRate,
    subtotal,
    discountPercent: percent,
    discountAmount,
    netTotal,
    taxRate,
    taxAmount,
    total
  };
}

module.exports = { calculatePrice, ALLOWED_DISCOUNTS };
