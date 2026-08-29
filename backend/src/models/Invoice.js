const mongoose = require('mongoose');

// Factura electronica emitida por reserva. Una reserva = una factura.
// El documento legal es el XML aceptado por Hacienda; aqui se guarda la
// trazabilidad completa (estado, intentos, archivos que devuelve el proveedor).
const invoiceSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true // idempotencia: nunca dos facturas para la misma reserva
    },
    provider: { type: String, default: 'gti' },

    // Estados del ciclo de vida:
    // queued          -> pago completo detectado, en cola para emitir
    // processing      -> enviada al proveedor, esperando respuesta
    // accepted        -> Hacienda acepto; correo enviado al cliente
    // rejected        -> Hacienda rechazo el comprobante (revisar datos)
    // error           -> fallo tecnico tras agotar reintentos
    // manual_required -> el proveedor no esta configurado; emitir en el portal
    status: {
      type: String,
      enum: ['queued', 'processing', 'accepted', 'rejected', 'error', 'manual_required'],
      default: 'queued'
    },

    // Identificadores que asigna el proveedor al aceptarse
    consecutivo: { type: String, trim: true },
    claveNumerica: { type: String, trim: true },

    receptor: {
      nombre: { type: String, trim: true },
      idType: { type: String, trim: true }, // fisica, juridica, extranjero
      idNumber: { type: String, trim: true },
      email: { type: String, trim: true },
      telefono: { type: String, trim: true },
      direccion: { type: String, trim: true }
    },

    lines: [
      {
        _id: false,
        cantidad: { type: Number, default: 1 },
        descripcion: { type: String, trim: true },
        precioUnitario: { type: Number, min: 0 },
        subtotal: { type: Number, min: 0 }
      }
    ],

    // Montos congelados desde el Booking al momento de emitir
    netTotal: { type: Number, min: 0 },
    taxRate: { type: Number, min: 0 },
    taxAmount: { type: Number, min: 0 },
    total: { type: Number, min: 0 },

    condicionVenta: { type: String, default: '01' }, // contado: solo se factura saldo en cero
    medioPago: { type: String, default: '01' },

    // Archivos que devuelve el proveedor (rutas o base64 segun la API)
    xmlFirmado: { type: String },
    xmlRespuesta: { type: String },
    pdfUrl: { type: String },

    emailSentAt: { type: Date },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, trim: true }
  },
  { timestamps: true }
);

invoiceSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
