/**
 * Traduce los errores a mensajes que la interfaz pueda mostrar tal cual.
 * El usuario final debe leer algo entendible, no un stack trace.
 */
function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(error);

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Datos incompletos o invalidos',
      details: Object.values(error.errors).map((item) => item.message)
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'Identificador invalido' });
  }

  res.status(error.status || 500).json({
    message: error.status ? error.message : 'Error interno del servidor'
  });
}

module.exports = errorHandler;
