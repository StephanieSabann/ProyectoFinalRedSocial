/**
 * Controlador de publicaciones.
 *
 * Flujo al crear una publicación:
 *   1. Multer recibe las fotos en memoria.
 *   2. Sharp genera original, mediana, miniatura y las 3 transformaciones (services/imagenes.js).
 *   3. Todo se sube a S3; en SQL Server solo se guardan las keys (tabla "imagen").
 *   4. (Opcional) Amazon Rekognition etiqueta la foto y detecta contenido inapropiado.
 *   5. Los rostros que detectó face-api.js en el navegador se guardan con cada foto.
 */
const { Publicacion, Imagen, Guardado } = require('../modelos');
const { sequelize } = require('../basededatos/conexion');
const { procesarFotoPublicacion, keysDeImagen } = require('../services/imagenes');
const rekognition = require('../services/rekognition');
const almacenamiento = require('../services/almacenamiento');
const serializar = require('../services/serializar');
const { auditar } = require('../services/auditoria');
const { incluirPublicacion } = require('./usuario');

/** Busca una publicación con autor e imágenes y la devuelve serializada. */
async function publicacionJSON(id, yoId) {
  const pub = await Publicacion.findByPk(id, { include: incluirPublicacion });
  if (!pub) return null;
  return (await serializar.publicaciones([pub], yoId))[0];
}

// POST /api/publicaciones  (multipart: imagenes[] 1-10, descripcion, ubicacion, rostros)
const crear = async (req, res) => {
  const subidas = []; // keys ya subidas, para borrarlas si algo falla
  try {
    // 1) Procesar las fotos de 2 en 2 (Sharp usa mucha memoria en una t2.small)
    const procesadas = [];
    for (let i = 0; i < req.files.length; i += 2) {
      const lote = await Promise.all(req.files.slice(i, i + 2).map((f) => procesarFotoPublicacion(f.buffer, req.usuario.id)));
      lote.forEach((p) => subidas.push(...keysDeImagen(p)));
      procesadas.push(...lote);
    }

    // 2) Rekognition (opcional)
    const analisis = await Promise.all(procesadas.map((p) => rekognition.analizar(p.key_original)));

    // 3) Guardar en SQL Server dentro de una transacción (todo o nada)
    const publicacion = await sequelize.transaction(async (t) => {
      const pub = await Publicacion.create({
        usuario_id: req.usuario.id,
        descripcion: (req.body.descripcion || '').trim(),
        ubicacion: (req.body.ubicacion || '').trim()
      }, { transaction: t });

      await Imagen.bulkCreate(procesadas.map((p, orden) => ({
        ...p,
        publicacion_id: pub.id,
        orden,
        rostros: req.rostros[orden],
        etiquetas: analisis[orden]?.etiquetas || null,
        sensible: analisis[orden]?.sensible || false
      })), { transaction: t });
      return pub;
    });

    await auditar(req, 'PUBLICACION_CREAR', {
      entidad: 'publicacion', entidadId: publicacion.id,
      detalle: { fotos: procesadas.length, rostros: req.rostros.reduce((s, r) => s + r.length, 0) }
    });

    return res.status(201).json({ mensaje: 'Publicación compartida', publicacion: await publicacionJSON(publicacion.id, req.usuario.id) });
  } catch (error) {
    await almacenamiento.borrar(subidas);
    const esImagen = /unsupported image|Input buffer|corrupt/i.test(error.message);
    return res.status(esImagen ? 400 : 500).json({
      mensaje: esImagen ? 'Una de las fotos está dañada o tiene un formato no compatible' : 'Error al crear la publicación',
      error: error.message
    });
  }
};

// GET /api/publicaciones?pagina=1  -> Explorar: publicaciones de todos (miniaturas), más recientes primero
const listar = async (req, res) => {
  try {
    const { pagina, limite, salto } = req.paginacion;
    const { count, rows } = await Publicacion.findAndCountAll({
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
    return res.status(500).json({ mensaje: 'Error al obtener publicaciones', error: error.message });
  }
};

// GET /api/publicaciones/:id  -> detalle (resolución completa + transformaciones)
const uno = async (req, res) => {
  try {
    const pub = await publicacionJSON(req.params.id, req.usuario.id);
    if (!pub) return res.status(404).json({ mensaje: 'Publicación no encontrada' });
    return res.status(200).json(pub);
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener la publicación', error: error.message });
  }
};

// PUT /api/publicaciones/:id  -> editar descripción / ubicación (solo el autor)
const editar = async (req, res) => {
  try {
    const pub = await Publicacion.findByPk(req.params.id);
    if (!pub) return res.status(404).json({ mensaje: 'Publicación no encontrada' });
    if (pub.usuario_id !== req.usuario.id) return res.status(403).json({ mensaje: 'Solo puedes editar tus propias publicaciones' });

    const cambios = {};
    if (typeof req.body.descripcion === 'string') cambios.descripcion = req.body.descripcion.trim();
    if (typeof req.body.ubicacion === 'string') cambios.ubicacion = req.body.ubicacion.trim();
    await pub.update(cambios);
    await auditar(req, 'PUBLICACION_EDITAR', { entidad: 'publicacion', entidadId: pub.id });

    return res.status(200).json({ mensaje: 'Publicación actualizada', publicacion: await publicacionJSON(pub.id, req.usuario.id) });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al actualizar publicación', error: error.message });
  }
};

// DELETE /api/publicaciones/:id  -> solo el autor (borra fotos en S3; comentarios y likes se borran en cascada)
const borrar = async (req, res) => {
  try {
    const pub = await Publicacion.findByPk(req.params.id, { include: [{ model: Imagen, as: 'imagenes' }] });
    if (!pub) return res.status(404).json({ mensaje: 'Publicación no encontrada' });
    if (pub.usuario_id !== req.usuario.id) return res.status(403).json({ mensaje: 'Solo puedes eliminar tus propias publicaciones' });

    const keys = pub.imagenes.flatMap(keysDeImagen);
    await pub.destroy();
    await almacenamiento.borrar(keys);
    await auditar(req, 'PUBLICACION_BORRAR', { entidad: 'publicacion', entidadId: pub.id, detalle: { fotos: pub.imagenes.length } });

    return res.status(200).json({ mensaje: 'Publicación eliminada' });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al eliminar publicación', error: error.message });
  }
};

// PUT /api/publicaciones/:id/guardar  -> guardar / quitar de guardados
const guardar = async (req, res) => {
  try {
    const pub = await Publicacion.findByPk(req.params.id, { attributes: ['id'] });
    if (!pub) return res.status(404).json({ mensaje: 'Publicación no encontrada' });

    const filtro = { usuario_id: req.usuario.id, publicacion_id: pub.id };
    const borradas = await Guardado.destroy({ where: filtro });
    if (borradas === 0) await Guardado.create(filtro);

    return res.status(200).json({
      mensaje: borradas ? 'Se quitó de guardados' : 'Se guardó la publicación',
      guardada: borradas === 0
    });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al guardar la publicación', error: error.message });
  }
};

module.exports = { crear, listar, uno, editar, borrar, guardar };
