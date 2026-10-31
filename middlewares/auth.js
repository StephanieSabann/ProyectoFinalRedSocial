/**
 * Middleware de autenticación: protege las rutas que necesitan login.
 * Espera la cabecera  Authorization: Bearer <token>
 */
const jwt = require('jwt-simple');
const moment = require('moment');
const { claveSecreta } = require('../services/jwt');

const auth = (req, res, next) => {
  // 1) Comprobar que llega la cabecera Authorization
  const cabecera = req.headers.authorization;
  if (!cabecera) {
    return res.status(401).json({ mensaje: 'La petición no tiene la cabecera de autenticación' });
  }

  // 2) Limpiar el token (acepta "Bearer TOKEN", "TOKEN" o con comillas)
  const token = cabecera.replace(/^Bearer\s+/i, '').replace(/['"]+/g, '').trim();

  try {
    // 3) Decodificar y verificar la firma
    const payload = jwt.decode(token, claveSecreta);

    // 4) Comprobar que no haya expirado
    if (payload.exp <= moment().unix()) {
      return res.status(401).json({ mensaje: 'El token ha expirado, vuelve a iniciar sesión' });
    }

    // 5) Guardar los datos del usuario en la petición (id numérico de la base de datos)
    req.usuario = { ...payload, id: Number(payload.id) };
  } catch (error) {
    return res.status(401).json({ mensaje: 'Token inválido' });
  }

  next();
};

module.exports = { auth };
