// Adaptador del proveedor GTI (facturaelectronica.cr).
//
// GTI no publica su documentacion de API: la entrega bajo contrato
// ("GTI Conectividad", credenciales = numero de cuenta + usuario + clave,
// con ambiente de pruebas que se solicita aparte). Este adaptador deja el
// contrato interno listo; cuando GTI entregue la especificacion solo hay
// que completar emit() sin tocar el resto del sistema.
//
// Variables en backend/.env (NUNCA en el repo):
//   GTI_API_URL   base de la API que indique GTI
//   GTI_ACCOUNT   numero de cuenta asignado por GTI
//   GTI_USER      usuario (la cedula, sin guiones)
//   GTI_PASSWORD  contrasena de la cuenta
//   GTI_ENV       'pruebas' | 'produccion' (empezar SIEMPRE en pruebas)

class ProviderNotConfiguredError extends Error {
  constructor() {
    super(
      'GTI Conectividad sin configurar: faltan credenciales de API en .env. ' +
        'Solicitar a GTI (ventas@gticr.com / WhatsApp 6222-3030) el acceso a su API ' +
        'y el ambiente de pruebas. Mientras tanto la factura debe emitirse en el portal.'
    );
    this.name = 'ProviderNotConfiguredError';
    this.notConfigured = true;
  }
}

function isConfigured() {
  return Boolean(
    process.env.GTI_API_URL &&
      process.env.GTI_ACCOUNT &&
      process.env.GTI_USER &&
      process.env.GTI_PASSWORD
  );
}

/**
 * Emite la factura ante GTI y devuelve los datos del comprobante aceptado.
 *
 * payload (formato interno, independiente del proveedor):
 * { emisor, receptor, lines, netTotal, taxRate, taxAmount, total,
 *   condicionVenta, medioPago }
 *
 * Debe devolver:
 * { consecutivo, claveNumerica, xmlFirmado, xmlRespuesta, pdfUrl, emailSentByProvider }
 *
 * GTI firma el XML 4.4, lo valida ante Hacienda (TRIBU-CR) y envia el correo
 * al receptor con XML + PDF, por eso emailSentByProvider llega true.
 */
async function emit(payload) {
  if (!isConfigured()) throw new ProviderNotConfiguredError();

  // ---------------------------------------------------------------
  // PENDIENTE (bloqueado por GTI): completar cuando entreguen la
  // especificacion real. La estructura esperada es una llamada HTTP
  // autenticada con cuenta+usuario+clave que reciba los datos de la
  // factura y devuelva clave numerica, consecutivo, XML y PDF.
  //
  // const response = await fetch(`${process.env.GTI_API_URL}/facturas`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', ...credenciales },
  //   body: JSON.stringify(mapToGtiFormat(payload))
  // });
  // ---------------------------------------------------------------
  throw new Error(
    'Credenciales GTI presentes pero el mapeo de su API aun no esta implementado: ' +
      'falta la especificacion oficial de GTI Conectividad.'
  );
}

module.exports = { emit, isConfigured, ProviderNotConfiguredError };
