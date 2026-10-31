/**
 * Creación del token JWT de cada usuario.
 * La clave se toma de JWT_SECRETO (obligatoria en producción).
 */
const jwt = require('jwt-simple');
const moment = require('moment');

const claveSecreta = process.env.JWT_SECRETO || 'CLAVE_SOLO_PARA_DESARROLLO_cambiar_en_produccion';

if (!process.env.JWT_SECRETO && process.env.NODE_ENV === 'production') {
  console.warn('ADVERTENCIA: JWT_SECRETO no está definido en producción');
}

/** Genera un token con los datos básicos del usuario (nunca la contraseña). Dura 7 días. */
const crearToken = (usuario) => {
  const payload = {
    id: usuario.id,
    nombre: usuario.nombre,
    username: usuario.username,
    iat: moment().unix(),
    exp: moment().add(7, 'days').unix()
  };
  return jwt.encode(payload, claveSecreta);
};

module.exports = { claveSecreta, crearToken };
