/**
 * Controlador de seguidores, feed, sugerencias y "Me gusta".
 */
const { Op } = require('sequelize');
const { Seguidor, Usuario, Publicacion, MeGusta } = require('../modelos');
const { sequelize } = require('../basededatos/conexion');
const { idsSiguiendo, obtenerContadores, relacion, sugerencias } = require('../services/seguidor');
const { notificar, quitarNotificacion } = require('../services/notificacion');
const { auditar } = require('../services/auditoria');
const serializar = require('../services/serializar');
const { incluirPublicacion } = require('./usuario');

// POST /api/seguidores   body: { "seguido": ID }  (quien sigue = usuario del token)
const seguir = async (req, res) => {
  try {
    const yo = req.usuario.id;
    const seguido = Number(req.body.seguido);
    if (yo === seguido) return res.status(400).json({ mensaje: 'No puedes seguirte a ti mismo' });

    const persona = await Usuario.findByPk(seguido);
    if (!persona) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    const [, creado] = await Seguidor.findOrCreate({ where: { usuario_id: yo, seguido_id: seguido } });
    if (!creado) return res.status(400).json({ mensaje: 'Ya sigues a este usuario' });

    await notificar({ para: seguido, de: yo, tipo: 'seguir' });
    await auditar(req, 'SEGUIR', { entidad: 'usuario', entidadId: seguido });
    return res.status(201).json({ mensaje: `Ahora sigues a ${persona.username}` });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al seguir usuario', error: error.message });
  }
};

// DELETE /api/seguidores/:seguido
const dejarDeSeguir = async (req, res) => {
  try {
    const borrados = await Seguidor.destroy({ where: { usuario_id: req.usuario.id, seguido_id: req.params.seguido } });
    if (!borrados) return res.status(404).json({ mensaje: 'No sigues a este usuario' });

    await quitarNotificacion({ para: req.params.seguido, de: req.usuario.id, tipo: 'seguir' });
    await auditar(req, 'DEJAR_DE_SEGUIR', { entidad: 'usuario', entidadId: Number(req.params.seguido) });
    return res.status(200).json({ mensaje: 'Dejaste de seguir al usuario' });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al dejar de seguir', error: error.message });
  }
};

/** Lista de personas relacionadas con un usuario (seguidores o seguidos). */
const listarPersonas = (columnaFiltro, alias, clave) => async (req, res) => {
  try {
    const persona = await Usuario.findByPk(req.params.id);
    if (!persona) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    const filas = await Seguidor.findAll({
      where: { [columnaFiltro]: persona.id },
      include: [{ model: Usuario, as: alias, attributes: serializar.CAMPOS_USUARIO }],
      order: [['fecha', 'DESC']]
    });
    const lista = await Promise.all(filas.map((f) => serializar.usuario(f[alias])));
    return res.status(200).json({ usuario: await serializar.usuario(persona), total: lista.length, [clave]: lista });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener la lista', error: error.message });
  }
};

// GET /api/usuarios/:id/seguidores  -> quiénes siguen a este usuario
const listarSeguidores = listarPersonas('seguido_id', 'quien_sigue', 'seguidores');
// GET /api/usuarios/:id/siguiendo  -> a quiénes sigue este usuario
const listarSiguiendo = listarPersonas('usuario_id', 'seguido', 'siguiendo');

// GET /api/usuarios/:id/contadores  -> números del perfil + relación conmigo
const verContadores = async (req, res) => {
  try {
    const persona = await Usuario.findByPk(req.params.id);
    if (!persona) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    const [contadores, rel] = await Promise.all([obtenerContadores(persona.id), relacion(req.usuario.id, persona.id)]);
    return res.status(200).json({ usuario: await serializar.usuario(persona), ...contadores, ...rel });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener contadores', error: error.message });
  }
};

// GET /api/sugerencias  -> "Sugerencias para ti"
const verSugerencias = async (req, res) => {
  try {
    const lista = await sugerencias(req.usuario.id, 10);
    return res.status(200).json(await Promise.all(lista.map(async (s) => ({ ...(await serializar.usuario(s.usuario)), motivo: s.motivo }))));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener sugerencias', error: error.message });
  }
};

// GET /api/feed?pagina=1  -> mis publicaciones + las de las personas que sigo
const feed = async (req, res) => {
  try {
    const { pagina, limite, salto } = req.paginacion;
    const ids = [...(await idsSiguiendo(req.usuario.id)), req.usuario.id];
    const { count, rows } = await Publicacion.findAndCountAll({
      where: { usuario_id: { [Op.in]: ids } },
      include: incluirPublicacion,
      order: [['fecha', 'DESC'], ['id', 'DESC']],
      limit: limite,
      offset: salto,
      distinct: true
    });
    return res.status(200).json({
      pagina,
      totalPaginas: Math.ceil(count / limite),
      total: count,
      publicaciones: await serializar.publicaciones(rows, req.usuario.id)
    });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener el feed', error: error.message });
  }
};

// PUT /api/publicaciones/:id/like  -> "Me gusta" / "Ya no me gusta" (un like por usuario)
const darLike = async (req, res) => {
  try {
    const yo = req.usuario.id;
    const pub = await Publicacion.findByPk(req.params.id, { attributes: ['id', 'usuario_id'] });
    if (!pub) return res.status(404).json({ mensaje: 'Publicación no encontrada' });

    // Alternar dentro de una transacción y recalcular el contador
    const meGusta = await sequelize.transaction(async (t) => {
      const borrados = await MeGusta.destroy({ where: { usuario_id: yo, publicacion_id: pub.id }, transaction: t });
      if (!borrados) await MeGusta.create({ usuario_id: yo, publicacion_id: pub.id }, { transaction: t });
      const total = await MeGusta.count({ where: { publicacion_id: pub.id }, transaction: t });
      await Publicacion.update({ likes: total }, { where: { id: pub.id }, transaction: t });
      return borrados === 0;
    });

    const datos = { para: pub.usuario_id, de: yo, tipo: 'like', publicacion: pub.id };
    if (meGusta) await notificar(datos); else await quitarNotificacion(datos);

    const { likes } = await Publicacion.findByPk(pub.id, { attributes: ['likes'] });
    return res.status(200).json({ mensaje: meGusta ? 'Te gusta esta publicación' : 'Ya no te gusta esta publicación', meGusta, likes });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al procesar el like', error: error.message });
  }
};

// GET /api/publicaciones/:id/likes  -> personas a las que les gustó
const listarLikes = async (req, res) => {
  try {
    const filas = await MeGusta.findAll({
      where: { publicacion_id: req.params.id },
      include: [{ model: Usuario, as: 'usuario', attributes: serializar.CAMPOS_USUARIO }],
      order: [['fecha', 'DESC']]
    });
    const usuarios = await Promise.all(filas.map((f) => serializar.usuario(f.usuario)));
    return res.status(200).json({ total: usuarios.length, usuarios });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener los me gusta', error: error.message });
  }
};

module.exports = {
  seguir, dejarDeSeguir, listarSeguidores, listarSiguiendo,
  verContadores, verSugerencias, feed, darLike, listarLikes
};
