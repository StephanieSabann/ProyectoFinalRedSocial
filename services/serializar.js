/**
 * Convierte filas de la base de datos en el JSON que recibe el frontend.
 * Aquí se transforman las "keys" de S3 en URLs que el navegador puede cargar.
 */
const { Op } = require('sequelize');
const { MeGusta, Guardado } = require('../modelos');
const almacenamiento = require('./almacenamiento');

/** Campos públicos de un usuario (nunca correo ni contraseña). */
const CAMPOS_USUARIO = ['id', 'nombre', 'username', 'imagen_key'];

async function usuario(u, { completo = false, propio = false } = {}) {
  if (!u) return null;
  const datos = {
    id: u.id,
    nombre: u.nombre,
    username: u.username,
    imagen: await almacenamiento.url(u.imagen_key)
  };
  if (completo) {
    datos.biografia = u.biografia;
    datos.sitioWeb = u.sitio_web;
    datos.fechaRegistro = u.fecha_registro;
  }
  if (propio) {
    datos.correo = u.correo;
    datos.proveedor = u.proveedor;
  }
  return datos;
}

async function imagen(img) {
  const [miniatura, mediana, original, bn, sepia, escala] = await Promise.all([
    almacenamiento.url(img.key_miniatura),
    almacenamiento.url(img.key_mediana),
    almacenamiento.url(img.key_original),
    almacenamiento.url(img.key_bn),
    almacenamiento.url(img.key_sepia),
    almacenamiento.url(img.key_escala)
  ]);
  return {
    id: img.id,
    ancho: img.ancho,
    alto: img.alto,
    color: img.color,
    rostros: img.rostros || [],
    etiquetas: img.etiquetas || [],
    sensible: Boolean(img.sensible),
    urls: { miniatura, mediana, original },
    transformaciones: { bn, sepia, escala }
  };
}

/**
 * Lista de publicaciones -> JSON, indicando si "yo" le di me gusta o la guardé.
 * Se hacen solo 2 consultas extra para toda la lista (no una por publicación).
 */
async function publicaciones(lista, yoId) {
  if (lista.length === 0) return [];
  const ids = lista.map((p) => p.id);
  const [likes, guardados] = await Promise.all([
    MeGusta.findAll({ where: { usuario_id: yoId, publicacion_id: { [Op.in]: ids } }, attributes: ['publicacion_id'] }),
    Guardado.findAll({ where: { usuario_id: yoId, publicacion_id: { [Op.in]: ids } }, attributes: ['publicacion_id'] })
  ]);
  const meGusta = new Set(likes.map((l) => l.publicacion_id));
  const guardadas = new Set(guardados.map((g) => g.publicacion_id));

  return Promise.all(lista.map(async (p) => ({
    id: p.id,
    usuario: await usuario(p.usuario),
    descripcion: p.descripcion,
    ubicacion: p.ubicacion,
    fecha: p.fecha,
    likes: p.likes,
    totalComentarios: p.total_comentarios,
    meGusta: meGusta.has(p.id),
    guardada: guardadas.has(p.id),
    imagenes: await Promise.all((p.imagenes || []).sort((a, b) => a.orden - b.orden).map(imagen))
  })));
}

module.exports = { CAMPOS_USUARIO, usuario, imagen, publicaciones };
