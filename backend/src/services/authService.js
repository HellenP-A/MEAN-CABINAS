const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const EXPIRES_IN = '12h';

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw fail('Falta configurar JWT_SECRET', 500);
  return value;
}

/** Crea un usuario con la contrasena ya cifrada. */
async function createUser({ username, fullName, password, role }) {
  if (!password || password.length < 8) {
    throw fail('La contrasena debe tener al menos 8 caracteres');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  return User.create({ username, fullName, passwordHash, role: role || 'reception' });
}

/** Verifica credenciales y entrega el token de sesion. */
async function login(username, password) {
  const user = await User.findOne({ username: String(username || '').toLowerCase() });

  // Mismo mensaje para usuario inexistente o clave incorrecta:
  // no conviene revelar cual de las dos fallo
  if (!user || !user.active) throw fail('Usuario o contrasena incorrectos', 401);

  const valid = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!valid) throw fail('Usuario o contrasena incorrectos', 401);

  const token = jwt.sign(
    { sub: String(user._id), username: user.username, role: user.role },
    secret(),
    { expiresIn: EXPIRES_IN }
  );

  return {
    token,
    user: { _id: user._id, username: user.username, fullName: user.fullName, role: user.role }
  };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, secret());
  } catch {
    throw fail('Sesion invalida o vencida', 401);
  }
}

module.exports = { createUser, login, verifyToken };
