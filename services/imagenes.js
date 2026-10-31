/**
 * Procesamiento de imágenes con Sharp.
 *
 * Al subir una foto se generan automáticamente:
 *   - original  : resolución completa (lado mayor hasta 2048 px), JPEG
 *   - mediana   : 1080 px de ancho, WebP  -> se usa en el feed
 *   - miniatura : 320 x 320 recortada en la zona de interés, WebP -> se usa en cuadrículas
 * y las 3 TRANSFORMACIONES AUTOMÁTICAS:
 *   1. bn     : blanco y negro
 *   2. sepia  : tono sepia (matriz de color)
 *   3. escala : reducción de escala al 50 %
 *
 * También se calcula el color dominante para pintar el fondo mientras la imagen carga.
 */
const sharp = require('sharp');
const almacenamiento = require('./almacenamiento');

const MATRIZ_SEPIA = [
  [0.393, 0.769, 0.189],
  [0.349, 0.686, 0.168],
  [0.272, 0.534, 0.131]
];

const aHex = ({ r, g, b }) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

/**
 * Procesa una foto de publicación y sube todas sus versiones.
 * @param {Buffer} buffer  archivo recibido
 * @param {number} usuarioId
 * @returns datos para la tabla "imagen" (keys, tamaño y color)
 */
async function procesarFotoPublicacion(buffer, usuarioId) {
  // 1) Original normalizado: respeta la orientación EXIF y limita el tamaño
  const { data: original, info } = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  // 2) Versiones y transformaciones (en paralelo)
  const [mediana, miniatura, bn, sepia, escala, estadisticas] = await Promise.all([
    sharp(original).resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    sharp(original).resize(320, 320, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 75 }).toBuffer(),
    sharp(original).grayscale().jpeg({ quality: 85 }).toBuffer(),
    sharp(original).recomb(MATRIZ_SEPIA).jpeg({ quality: 85 }).toBuffer(),
    sharp(original).resize({ width: Math.max(1, Math.round(info.width / 2)) }).jpeg({ quality: 85 }).toBuffer(),
    sharp(original).stats()
  ]);

  // 3) Subir todo a S3 (o a la carpeta local)
  const base = `usuarios/${usuarioId}/publicaciones/${almacenamiento.nuevoId()}`;
  const archivos = {
    key_original: [`${base}/original.jpg`, original, 'image/jpeg'],
    key_mediana: [`${base}/mediana.webp`, mediana, 'image/webp'],
    key_miniatura: [`${base}/miniatura.webp`, miniatura, 'image/webp'],
    key_bn: [`${base}/bn.jpg`, bn, 'image/jpeg'],
    key_sepia: [`${base}/sepia.jpg`, sepia, 'image/jpeg'],
    key_escala: [`${base}/escala.jpg`, escala, 'image/jpeg']
  };
  await Promise.all(Object.values(archivos).map(([key, datos, tipo]) => almacenamiento.guardar(key, datos, tipo)));

  const keys = Object.fromEntries(Object.entries(archivos).map(([campo, [key]]) => [campo, key]));
  return {
    ...keys,
    ancho: info.width,
    alto: info.height,
    tamano_bytes: original.length,
    color: aHex(estadisticas.dominant)
  };
}

/** Foto de perfil: cuadrada 320 x 320. */
async function procesarAvatar(buffer, usuarioId) {
  const datos = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(320, 320, { fit: 'cover', position: sharp.strategy.attention })
    .webp({ quality: 80 })
    .toBuffer();
  const key = `usuarios/${usuarioId}/avatar/${almacenamiento.nuevoId()}.webp`;
  await almacenamiento.guardar(key, datos, 'image/webp');
  return key;
}

/** Historia: vertical, máximo 1080 x 1920. */
async function procesarHistoria(buffer, usuarioId) {
  const datos = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: 1080, height: 1920, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  const key = `usuarios/${usuarioId}/historias/${almacenamiento.nuevoId()}.jpg`;
  await almacenamiento.guardar(key, datos, 'image/jpeg');
  return key;
}

/** Todas las keys de una fila de la tabla "imagen" (para borrarlas). */
const keysDeImagen = (img) => [img.key_original, img.key_mediana, img.key_miniatura, img.key_bn, img.key_sepia, img.key_escala];

module.exports = { procesarFotoPublicacion, procesarAvatar, procesarHistoria, keysDeImagen };
