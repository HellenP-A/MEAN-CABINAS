const { verifyToken } = require('../services/authService');

/** Exige una sesion valida. El token viaja en la cabecera Authorization. */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: 'Se requiere iniciar sesion' });

  try {
    req.user = verifyToken(token);
    next();
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
}

/** Restringe a administradores: precios y reportes. */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Solo un administrador puede ver esta seccion' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
