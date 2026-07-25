/**
 * Las fechas se guardan como medianoche UTC del dia calendario.
 * Costa Rica no tiene horario de verano, asi que basta con normalizar una vez
 * y evitamos que un desfase de zona horaria corra las noches un dia.
 */

function toUtcDate(value) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Fecha invalida: ${value}`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

/** Cantidad de noches entre dos fechas (checkOut exclusivo). */
function countNights(checkIn, checkOut) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((toUtcDate(checkOut) - toUtcDate(checkIn)) / msPerDay);
}

/** Lista de fechas ocupadas: incluye checkIn, excluye checkOut. */
function listNights(checkIn, checkOut) {
  const nights = [];
  const cursor = toUtcDate(checkIn);
  const end = toUtcDate(checkOut);

  while (cursor < end) {
    nights.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

module.exports = { toUtcDate, countNights, listNights };
