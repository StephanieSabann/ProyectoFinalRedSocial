/**
 * Recepción de imágenes con Multer.
 *
 * Los archivos quedan en MEMORIA (req.file / req.files con .buffer); nunca se escriben
 * en el disco del servidor. Luego services/imagenes.js los procesa con Sharp y los sube a S3.
 */
const multer = require('multer');

const TAMANO_MAXIMO = 8 * 1024 * 1024; // 8 MB por foto
const MAXIMO_FOTOS = 10;               // carrusel de hasta 10 fotos
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif'];

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO, files: MAXIMO_FOTOS },
  fileFilter: (req, file, cb) => {
    if (TIPOS.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Solo se permiten imágenes (jpg, png, webp, gif)'));
  }
});

/** Convierte los errores de Multer en respuestas 400 con mensajes claros. */
const manejarErrores = (middleware) => (req, res, next) => {
  middleware(req, res, (error) => {
    if (!error) return next();
    let mensaje = error.message;
    if (error.code === 'LIMIT_FILE_SIZE') mensaje = 'Cada foto puede pesar como máximo 8 MB';
    if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
      mensaje = `Puedes subir como máximo ${MAXIMO_FOTOS} fotos (campo "imagenes")`;
    }
    return res.status(400).json({ mensaje });
  });
};

// Publicación: varias fotos en el campo "imagenes"
const subirImagenesPublicacion = manejarErrores(subida.array('imagenes', MAXIMO_FOTOS));

// Foto de perfil e historia: un archivo en el campo "file0"
const subirAvatar = manejarErrores(subida.single('file0'));
const subirHistoria = manejarErrores(subida.single('file0'));

module.exports = { subirImagenesPublicacion, subirAvatar, subirHistoria };
