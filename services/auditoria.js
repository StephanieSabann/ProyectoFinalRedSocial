/**
 * Sistema de auditoría de transacciones.
 * Guarda en la tabla "auditoria" quién hizo qué, cuándo y desde qué IP.
 * Un fallo al auditar nunca interrumpe la acción del usuario.
 */
const { Auditoria } = require('../modelos');

/**
 * @param {object} req       petición de Express (para IP, navegador y usuario del token)
 * @param {string} accion    ej. 'LOGIN', 'LOGIN_FALLIDO', 'PUBLICACION_CREAR'
 * @param {object} [extra]   { entidad, entidadId, usuarioId, detalle }
 */
async function auditar(req, accion, { entidad = null, entidadId = null, usuarioId, detalle = null } = {}) {
  try {
    await Auditoria.create({
      usuario_id: usuarioId ?? req.usuario?.id ?? null,
      accion,
      entidad,
      entidad_id: entidadId,
      ip: (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().slice(0, 45),
      agente: (req.headers['user-agent'] || '').slice(0, 255),
      detalle
    });
  } catch (error) {
    console.error('No se pudo registrar la auditoría:', error.message);
  }
}

module.exports = { auditar };
