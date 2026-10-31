/**
 * Controlador de comentarios.
 */
const { Comentario, Publicacion, Usuario } = require('../modelos');
const { sequelize } = require('../basededatos/conexion');
const { notificar } = require('../services/notificacion');
const serializar = require('../services/serializar');

const comentarioJSON = async (c) => ({
  id: c.id,
  comentario: c.comentario,
  fecha: c.fecha,
  usuario: await serializar.usuario(c.usuario)
});

// POST /api/publicaciones/:id/comentarios  -> el autor es el usuario del token
const crearComentario = async (req, res) => {
  try {
    const pub = await Publicacion.findByPk(req.params.id, { attributes: ['id', 'usuario_id'] });
    if (!pub) return res.status(404).json({ mensaje: 'Publicación no encontrada' });

    const texto = req.body.comentario.trim();
    const comentario = await sequelize.transaction(async (t) => {
      const nuevo = await Comentario.create({ usuario_id: req.usuario.id, publicacion_id: pub.id, comentario: texto }, { transaction: t });
      await pub.increment('total_comentarios', { transaction: t });
      return nuevo;
    });
    await comentario.reload({ include: [{ model: Usuario, as: 'usuario', attributes: serializar.CAMPOS_USUARIO }] });
    await notificar({ para: pub.usuario_id, de: req.usuario.id, tipo: 'comentario', publicacion: pub.id, texto });

    return res.status(201).json({ mensaje: 'Comentario publicado', comentario: await comentarioJSON(comentario) });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al guardar comentario', error: error.message });
  }
};

// GET /api/publicaciones/:id/comentarios
const obtenerComentariosPorPublicacion = async (req, res) => {
  try {
    const lista = await Comentario.findAll({
      where: { publicacion_id: req.params.id },
      include: [{ model: Usuario, as: 'usuario', attributes: serializar.CAMPOS_USUARIO }],
      order: [['fecha', 'ASC'], ['id', 'ASC']]
    });
    return res.status(200).json(await Promise.all(lista.map(comentarioJSON)));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener comentarios', error: error.message });
  }
};

// DELETE /api/comentarios/:id  -> lo borra su autor o el dueño de la publicación
const borrarComentario = async (req, res) => {
  try {
    const comentario = await Comentario.findByPk(req.params.id, {
      include: [{ model: Publicacion, as: 'publicacion', attributes: ['id', 'usuario_id'] }]
    });
    if (!comentario) return res.status(404).json({ mensaje: 'Comentario no encontrado' });

    const esAutor = comentario.usuario_id === req.usuario.id;
    const esDueno = comentario.publicacion?.usuario_id === req.usuario.id;
    if (!esAutor && !esDueno) return res.status(403).json({ mensaje: 'No puedes eliminar este comentario' });

    await sequelize.transaction(async (t) => {
      await comentario.destroy({ transaction: t });
      await Publicacion.decrement('total_comentarios', {
        where: { id: comentario.publicacion_id, total_comentarios: { [require('sequelize').Op.gt]: 0 } },
        transaction: t
      });
    });
    return res.status(200).json({ mensaje: 'Comentario eliminado' });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al eliminar comentario', error: error.message });
  }
};

module.exports = { crearComentario, obtenerComentariosPorPublicacion, borrarComentario };
