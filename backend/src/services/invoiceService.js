const { Booking, Guest, Company, Payment, Invoice, Setting } = require('../models');
const gti = require('./gtiProvider');

// Emision automatica: cuando el saldo de una reserva llega a cero se
// encola la factura y un job en segundo plano la emite via GTI, que
// firma, valida ante Hacienda y envia el correo al cliente con XML + PDF.
// Los abonos parciales NO facturan. Una reserva = una factura.

// Espera creciente entre reintentos (Hacienda y el proveedor se caen)
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

// Payment.method -> codigo de medio de pago de Hacienda (v4.4)
const MEDIO_PAGO = {
  cash: '01', // efectivo
  card: '02', // tarjeta
  transfer: '04', // transferencia
  sinpe: '04', // SINPE se reporta como transferencia (confirmar codigo propio 4.4 con el contador)
  other: '99'
};

// Datos del emisor: se leen de Settings para poder corregirlos sin codigo.
// Valores por defecto = los de las facturas reales ya emitidas en GTI.
const EMITTER_DEFAULTS = {
  nombre: 'HELLEN PAMELA AGUILAR NOGUERA',
  nombreComercial: 'CABINAS EL RIO',
  idType: 'fisica',
  idNumber: '1-1278-0447',
  direccion: '500 mts norte de la entrada principal de Canalete',
  telefono: '+506 8464-7187'
};

async function getEmitter() {
  const setting = await Setting.findOne({ key: 'invoiceEmitter' });
  return { ...EMITTER_DEFAULTS, ...(setting ? setting.value : {}) };
}

// Descripcion de una sola linea, como las facturas manuales:
// "2 noches, 1 cabina para 2 personas"
function buildDescription(booking) {
  const n = booking.nights;
  const c = booking.cabinCount || 1;
  const p = booking.guests;
  const noches = n === 1 ? '1 noche' : `${n} noches`;
  const cabinas = c === 1 ? '1 cabina' : `${c} cabinas`;
  const personas = p === 1 ? '1 persona' : `${p} personas`;
  return `Hospedaje: ${noches}, ${cabinas} para ${personas}`;
}

// Receptor: si el huesped viene por una empresa se factura a la empresa
// (cedula juridica + correo de cuentas por pagar). Si es particular y no
// tiene datos completos, sale a consumidor final: nunca se bloquea el flujo.
async function buildReceptor(booking) {
  const guest = await Guest.findById(booking.guestId);
  if (!guest) return null;

  if (guest.companyId) {
    const company = await Company.findById(guest.companyId);
    if (company && company.idNumber) {
      return {
        nombre: company.name,
        idType: 'juridica',
        idNumber: company.idNumber,
        email: company.email || guest.email || '',
        telefono: company.phone || '',
        direccion: company.address || ''
      };
    }
  }

  return {
    nombre: guest.fullName,
    idType: guest.idType === 'national' ? 'fisica' : 'extranjero',
    idNumber: guest.idNumber,
    email: guest.email || '',
    telefono: guest.phone || '',
    direccion: guest.address || ''
  };
}

async function computeBalance(booking) {
  const payments = await Payment.find({ bookingId: booking._id });
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  return { paid, balance: booking.total - paid, payments };
}

/**
 * Punto de entrada: se llama cada vez que se registra un pago.
 * Idempotente: si la reserva ya tiene factura (en cualquier estado que no
 * sea error definitivo) no hace nada. Nunca lanza: la pantalla de cobro
 * no debe fallar porque la facturacion tenga problemas.
 */
async function maybeInvoiceBooking(bookingId) {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking || booking.status === 'cancelled') return null;

    const { balance } = await computeBalance(booking);
    if (balance > 0) return null; // abono parcial: no factura

    const existing = await Invoice.findOne({ bookingId: booking._id });
    if (existing) return existing; // ya existe: no duplicar jamas

    const receptor = await buildReceptor(booking);
    const lastPayment = await Payment.findOne({ bookingId: booking._id }).sort({ paidAt: -1 });

    let invoice;
    try {
      invoice = await Invoice.create({
        bookingId: booking._id,
        provider: 'gti',
        status: 'queued',
        receptor,
        lines: [
          {
            cantidad: 1,
            descripcion: buildDescription(booking),
            precioUnitario: booking.netTotal || booking.total,
            subtotal: booking.netTotal || booking.total
          }
        ],
        netTotal: booking.netTotal || booking.total,
        taxRate: booking.taxRate || 0,
        taxAmount: booking.taxAmount || 0,
        total: booking.total,
        condicionVenta: '01',
        medioPago: MEDIO_PAGO[lastPayment ? lastPayment.method : 'cash'] || '99'
      });
    } catch (error) {
      if (error.code === 11000) return Invoice.findOne({ bookingId: booking._id });
      throw error;
    }

    scheduleProcess(invoice._id, 0);
    return invoice;
  } catch (error) {
    console.error('Fallo al encolar factura de la reserva', String(bookingId), error.message);
    return null;
  }
}

// Timers en proceso; al reiniciar el server, resumePendingInvoices retoma la cola
const timers = new Map();

function scheduleProcess(invoiceId, delayMs) {
  const key = String(invoiceId);
  if (timers.has(key)) return;
  const timer = setTimeout(() => {
    timers.delete(key);
    processInvoice(invoiceId).catch((error) =>
      console.error('Error procesando factura', key, error.message)
    );
  }, delayMs);
  if (timer.unref) timer.unref();
  timers.set(key, timer);
}

async function processInvoice(invoiceId) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return;
  // Solo se procesan las que siguen en cola; una aceptada no se reemite NUNCA
  // (duplicar un comprobante ante Hacienda es un problema tributario)
  if (!['queued', 'processing'].includes(invoice.status)) return;

  invoice.status = 'processing';
  invoice.attempts += 1;
  await invoice.save();

  const emisor = await getEmitter();

  try {
    const result = await gti.emit({
      emisor,
      receptor: invoice.receptor,
      lines: invoice.lines,
      netTotal: invoice.netTotal,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      condicionVenta: invoice.condicionVenta,
      medioPago: invoice.medioPago
    });

    invoice.status = 'accepted';
    invoice.consecutivo = result.consecutivo;
    invoice.claveNumerica = result.claveNumerica;
    invoice.xmlFirmado = result.xmlFirmado;
    invoice.xmlRespuesta = result.xmlRespuesta;
    invoice.pdfUrl = result.pdfUrl;
    // GTI envia el correo al receptor con XML + PDF apenas Hacienda acepta
    if (result.emailSentByProvider) invoice.emailSentAt = new Date();
    invoice.lastError = undefined;
    await invoice.save();
    console.log('Factura aceptada para reserva', String(invoice.bookingId));
  } catch (error) {
    if (error.notConfigured) {
      // Sin credenciales de GTI no hay nada que reintentar
      invoice.status = 'manual_required';
      invoice.lastError = error.message;
      await invoice.save();
      return;
    }

    invoice.lastError = error.message;
    if (invoice.attempts >= MAX_ATTEMPTS) {
      invoice.status = 'error';
      await invoice.save();
      console.error('Factura agoto reintentos, reserva', String(invoice.bookingId));
    } else {
      invoice.status = 'queued';
      await invoice.save();
      scheduleProcess(invoice._id, RETRY_DELAYS_MS[invoice.attempts - 1]);
    }
  }
}

/**
 * Reenvio de cortesia: manda la factura otra vez, al correo registrado o a
 * uno alterno que pida el cliente. Si llega un correo nuevo se guarda en la
 * factura y en el huesped, para que las siguientes salgan bien a la primera.
 */
async function resendInvoice(invoiceId, email) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return null;

  const target = (email || '').trim().toLowerCase();
  if (target) {
    invoice.receptor = { ...(invoice.receptor?.toObject?.() ?? invoice.receptor ?? {}), email: target };
    await invoice.save();

    const booking = await Booking.findById(invoice.bookingId);
    if (booking) await Guest.updateOne({ _id: booking.guestId }, { email: target });
  }

  const to = target || invoice.receptor?.email;
  if (!to) {
    return { invoice, sent: false, message: 'No hay correo del cliente: digite uno para reenviar.' };
  }

  if (invoice.status !== 'accepted') {
    return {
      invoice,
      sent: false,
      message: 'La factura aun no fue aceptada por Hacienda; se enviara sola cuando lo sea.'
    };
  }

  if (!gti.isConfigured()) {
    return {
      invoice,
      sent: false,
      message: `GTI sin configurar: reenviela desde el portal de GTI (consecutivo ${invoice.consecutivo ?? 'sin numero'}) a ${to}.`
    };
  }

  // PENDIENTE (bloqueado por GTI): reenvio via API. El portal de GTI ya
  // tiene la funcion de reenvio; aqui se conectara cuando den la especificacion.
  return { invoice, sent: false, message: 'El reenvio por API de GTI aun no esta disponible.' };
}

/** Reintento manual (solo admin): resetea intentos y vuelve a encolar. */
async function retryInvoice(invoiceId) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return null;
  if (invoice.status === 'accepted') return invoice; // jamas reemitir una aceptada

  invoice.status = 'queued';
  invoice.attempts = 0;
  invoice.lastError = undefined;
  await invoice.save();
  scheduleProcess(invoice._id, 0);
  return invoice;
}

/** Al arrancar el server: retoma facturas que quedaron en cola o a medias. */
async function resumePendingInvoices() {
  const pending = await Invoice.find({ status: { $in: ['queued', 'processing'] } });
  for (const invoice of pending) {
    invoice.status = 'queued';
    await invoice.save();
    scheduleProcess(invoice._id, 5_000);
  }
  if (pending.length > 0) {
    console.log(`Retomando ${pending.length} factura(s) pendiente(s)`);
  }
}

/** Estado de factura por reserva, para pintar badges en las pantallas. */
async function invoicesByBooking(bookingIds) {
  const invoices = await Invoice.find({ bookingId: { $in: bookingIds } });
  const map = {};
  for (const inv of invoices) map[String(inv.bookingId)] = inv;
  return map;
}

module.exports = {
  maybeInvoiceBooking,
  processInvoice,
  retryInvoice,
  resendInvoice,
  resumePendingInvoices,
  invoicesByBooking,
  buildDescription
};
