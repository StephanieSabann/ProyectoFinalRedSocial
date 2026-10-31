/**
 * Controlador de notificaciones.
 */
const { Notificacion, Usuario, Publicacion, Imagen } = require('../modelos');
const almacenamiento = require('../services/almacenamiento');
const serializar = require('../services/serializar');

// GET /api/notificaciones  -> las 50 más recientes
const listarNotificaciones = async (req, res) => {
  try {
    const lista = await Notificacion.findAll({
      where: { para_id: req.usuario.id },
      include: [
        { model: Usuario, as: 'de', attributes: serializar.CAMPOS_USUARIO },
        {
          model: Publicacion,
          as: 'publicacion',
          attributes: ['id'],
          include: [{ model: Imagen, as: 'imagenes', attributes: ['key_miniatura', 'orden'] }]
        }
      ],
      order: [['fecha', 'DESC']],
      limit: 50
    });

    const resultado = await Promise.all(lista
      .filter((n) => n.de && (n.tipo === 'seguir' || n.publicacion))
      .map(async (n) => {
        const primera = n.publicacion?.imagenes?.sort((a, b) => a.orden - b.orden)[0];
        return {
          id: n.id,
          tipo: n.tipo,
          texto: n.texto,
          leida: n.leida,
          fecha: n.fecha,
          de: await serializar.usuario(n.de),
          publicacion: n.publicacion ? { id: n.publicacion.id, miniatura: await almacenamiento.url(primera?.key_miniatura) } : null
        };
      }));
    return res.status(200).json(resultado);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener notificaciones', error: error.message });
  }
};

// GET /api/notificaciones/sin-leer  -> número para el puntito rojo
const contarSinLeer = async (req, res) => {
  try {
    const total = await Notificacion.count({ where: { para_id: req.usuario.id, leida: false } });
    return res.status(200).json({ total });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al contar notificaciones', error: error.message });
  }
};

// PUT /api/notificaciones/leidas  -> marca todas como leídas
const marcarLeidas = async (req, res) => {
  try {
    await Notificacion.update({ leida: true }, { where: { para_id: req.usuario.id, leida: false } });
    return res.status(200).json({ mensaje: 'Notificaciones marcadas como leídas' });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al marcar notificaciones', error: error.message });
  }
};

module.exports = { listarNotificaciones, contarSinLeer, marcarLeidas };
