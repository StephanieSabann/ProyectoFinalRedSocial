/**
 * Controlador de historias (duran 24 horas).
 */
const { Op } = require('sequelize');
const { Historia, HistoriaVista, Usuario } = require('../modelos');
const { idsSiguiendo } = require('../services/seguidor');
const { procesarHistoria } = require('../services/imagenes');
const almacenamiento = require('../services/almacenamiento');
const serializar = require('../services/serializar');
const { auditar } = require('../services/auditoria');

const vigentes = () => ({ expira: { [Op.gt]: new Date() } });
const incluir = (yo) => [
  { model: Usuario, as: 'usuario', attributes: serializar.CAMPOS_USUARIO },
  { model: HistoriaVista, as: 'vistas', attributes: ['usuario_id'] }
];

/** Fila -> JSON. "totalVistas" solo para el autor. */
const historiaJSON = async (h, yo) => ({
  id: h.id,
  imagen: await almacenamiento.url(h.key_imagen),
  fecha: h.fecha,
  expira: h.expira,
  vista: h.vistas.some((v) => v.usuario_id === yo),
  ...(h.usuario_id === yo ? { totalVistas: h.vistas.filter((v) => v.usuario_id !== yo).length } : {})
});

// POST /api/historias  (campo "file0")
const crearHistoria = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ mensaje: 'Selecciona una foto para tu historia (campo file0)' });
    const key = await procesarHistoria(req.file.buffer, req.usuario.id);
    const historia = await Historia.create({ usuario_id: req.usuario.id, key_imagen: key });
    await auditar(req, 'HISTORIA_CREAR', { entidad: 'historia', entidadId: historia.id });
    return res.status(201).json({ mensaje: 'Historia publicada (dura 24 horas)', historia: { id: historia.id } });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al publicar la historia', error: error.message });
  }
};

// GET /api/historias  -> barra de historias agrupada por usuario: las mías primero, luego las no vistas
const feedHistorias = async (req, res) => {
  try {
    const yo = req.usuario.id;
    const ids = [...(await idsSiguiendo(yo)), yo];
    const historias = await Historia.findAll({
      where: { usuario_id: { [Op.in]: ids }, ...vigentes() },
      include: incluir(yo),
      order: [['fecha', 'ASC']]
    });

    const grupos = new Map();
    for (const h of historias) {
      if (!grupos.has(h.usuario_id)) grupos.set(h.usuario_id, { usuario: await serializar.usuario(h.usuario), historias: [], ultima: h.fecha });
      const g = grupos.get(h.usuario_id);
      g.historias.push(await historiaJSON(h, yo));
      g.ultima = h.fecha;
    }

    const lista = [...grupos.values()].map((g) => ({ ...g, todasVistas: g.historias.every((h) => h.vista) }));
    lista.sort((a, b) => {
      const aMia = a.usuario.id === yo;
      const bMia = b.usuario.id === yo;
      if (aMia !== bMia) return aMia ? -1 : 1;
      if (a.todasVistas !== b.todasVistas) return a.todasVistas ? 1 : -1;
      return new Date(b.ultima) - new Date(a.ultima);
    });
    return res.status(200).json(lista);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener historias', error: error.message });
  }
};

// GET /api/usuarios/:id/historias  -> historias vigentes de un usuario
const historiasDeUsuario = async (req, res) => {
  try {
    const yo = req.usuario.id;
    const historias = await Historia.findAll({
      where: { usuario_id: req.params.id, ...vigentes() },
      include: incluir(yo),
      order: [['fecha', 'ASC']]
    });
    return res.status(200).json(await Promise.all(historias.map((h) => historiaJSON(h, yo))));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener las historias', error: error.message });
  }
};

// PUT /api/historias/:id/vista  -> marcar como vista
const marcarVista = async (req, res) => {
  try {
    const historia = await Historia.findOne({ where: { id: req.params.id, ...vigentes() } });
    if (!historia) return res.status(404).json({ mensaje: 'La historia ya no está disponible' });
    await HistoriaVista.findOrCreate({ where: { historia_id: historia.id, usuario_id: req.usuario.id } });
    return res.status(200).json({ mensaje: 'Historia vista' });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al marcar la historia', error: error.message });
  }
};

// GET /api/historias/:id/vistas  -> quién vio mi historia (solo el autor)
const verVistas = async (req, res) => {
  try {
    const historia = await Historia.findByPk(req.params.id);
    if (!historia) return res.status(404).json({ mensaje: 'Historia no encontrada' });
    if (historia.usuario_id !== req.usuario.id) return res.status(403).json({ mensaje: 'Solo el autor puede ver quién vio la historia' });

    const vistas = await HistoriaVista.findAll({
      where: { historia_id: historia.id, usuario_id: { [Op.ne]: req.usuario.id } },
      include: [{ model: Usuario, as: 'usuario', attributes: serializar.CAMPOS_USUARIO }],
      order: [['fecha', 'DESC']]
    });
    const usuarios = await Promise.all(vistas.map((v) => serializar.usuario(v.usuario)));
    return res.status(200).json({ total: usuarios.length, usuarios });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener las vistas', error: error.message });
  }
};

// DELETE /api/historias/:id  -> solo el autor
const borrarHistoria = async (req, res) => {
  try {
    const historia = await Historia.findByPk(req.params.id);
    if (!historia) return res.status(404).json({ mensaje: 'Historia no encontrada' });
    if (historia.usuario_id !== req.usuario.id) return res.status(403).json({ mensaje: 'Solo puedes eliminar tus propias historias' });

    await historia.destroy();
    await almacenamiento.borrar(historia.key_imagen);
    return res.status(200).json({ mensaje: 'Historia eliminada' });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al eliminar la historia', error: error.message });
  }
};

module.exports = { crearHistoria, feedHistorias, historiasDeUsuario, marcarVista, verVistas, borrarHistoria };
