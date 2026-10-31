/**
 * Funciones de apoyo para seguidores, sugerencias y contadores del perfil.
 */
const { Op } = require('sequelize');
const { Seguidor, Publicacion, Usuario } = require('../modelos');

/** IDs de los usuarios a los que sigue "usuarioId". */
const idsSiguiendo = async (usuarioId) => {
  const filas = await Seguidor.findAll({ where: { usuario_id: usuarioId }, attributes: ['seguido_id'] });
  return filas.map((f) => f.seguido_id);
};

/** IDs de los usuarios que siguen a "usuarioId". */
const idsSeguidores = async (usuarioId) => {
  const filas = await Seguidor.findAll({ where: { seguido_id: usuarioId }, attributes: ['usuario_id'] });
  return filas.map((f) => f.usuario_id);
};

/** Contadores del perfil: publicaciones, seguidores, seguidos y likes recibidos. */
const obtenerContadores = async (usuarioId) => {
  const [seguidores, siguiendo, publicaciones, suma] = await Promise.all([
    Seguidor.count({ where: { seguido_id: usuarioId } }),
    Seguidor.count({ where: { usuario_id: usuarioId } }),
    Publicacion.count({ where: { usuario_id: usuarioId } }),
    Publicacion.sum('likes', { where: { usuario_id: usuarioId } })
  ]);
  return { seguidores, siguiendo, publicaciones, likesRecibidos: Number(suma || 0) };
};

/** ¿Yo sigo a "otro"? ¿"otro" me sigue a mí? (para el botón "Seguir también") */
const relacion = async (yo, otro) => {
  const [loSigo, meSigue] = await Promise.all([
    Seguidor.count({ where: { usuario_id: yo, seguido_id: otro } }),
    Seguidor.count({ where: { usuario_id: otro, seguido_id: yo } })
  ]);
  return { loSigo: loSigo > 0, meSigue: meSigue > 0 };
};

/**
 * "Sugerencias para ti": primero quien me sigue y yo no sigo,
 * luego amigos de mis amigos y al final los usuarios más nuevos.
 */
const sugerencias = async (yo, limite = 10) => {
  const siguiendo = await idsSiguiendo(yo);
  const excluir = new Set([...siguiendo, yo]);
  const resultado = new Map(); // id -> motivo

  const agregar = (id, motivo) => {
    if (!excluir.has(id) && !resultado.has(id) && resultado.size < limite) resultado.set(id, motivo);
  };

  (await idsSeguidores(yo)).forEach((id) => agregar(id, 'Te sigue'));

  if (resultado.size < limite && siguiendo.length > 0) {
    const amigos = await Seguidor.findAll({
      where: { usuario_id: { [Op.in]: siguiendo } },
      include: [{ model: Usuario, as: 'quien_sigue', attributes: ['username'] }],
      order: [['fecha', 'DESC']],
      limit: 200
    });
    amigos.forEach((f) => agregar(f.seguido_id, `Seguido por ${f.quien_sigue.username}`));
  }

  if (resultado.size < limite) {
    const nuevos = await Usuario.findAll({
      where: { id: { [Op.notIn]: [...excluir, ...resultado.keys()] } },
      order: [['fecha_registro', 'DESC']],
      limit: limite,
      attributes: ['id']
    });
    nuevos.forEach((u) => agregar(u.id, 'Nuevo en la red'));
  }

  const usuarios = await Usuario.findAll({ where: { id: { [Op.in]: [...resultado.keys()] } } });
  return [...resultado.entries()]
    .map(([id, motivo]) => ({ usuario: usuarios.find((u) => u.id === id), motivo }))
    .filter((s) => s.usuario);
};

module.exports = { idsSiguiendo, idsSeguidores, obtenerContadores, relacion, sugerencias };
