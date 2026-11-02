/**
 * Crea y borra notificaciones (likes, comentarios y nuevos seguidores).
 */
const { Notificacion } = require('../modelos');

/** Crea una notificación. Nunca te notifica de tus propias acciones. */
const notificar = async ({ para, de, tipo, publicacion = null, texto = '' }) => {
  try {
    if (Number(para) === Number(de)) return;
    await Notificacion.create({ para_id: para, de_id: de, tipo, publicacion_id: publicacion, texto: texto.slice(0, 100) });
  } catch (error) {
    console.error('No se pudo crear la notificación:', error.message);
  }
};

/** Quita la notificación cuando se deshace la acción (quitar like, dejar de seguir). */
const quitarNotificacion = async ({ para, de, tipo, publicacion = null }) => {
  try {
    const filtro = { para_id: para, de_id: de, tipo };
    if (publicacion) filtro.publicacion_id = publicacion;
    await Notificacion.destroy({ where: filtro });
  } catch (error) {
    console.error('No se pudo quitar la notificación:', error.message);
  }
};

module.exports = { notificar, quitarNotificacion };
