/**
 * Validaciones de los datos que llegan a la API.
 */
const validator = require('validator');

// Convierte cualquier valor en texto limpio para poder validarlo
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

// Responde 400 con el primer error encontrado
const responderErrores = (res, errores) => res.status(400).json({ mensaje: errores[0], errores });

/** Revisa que los IDs (en la URL o en el body) sean números enteros positivos. */
const validarId = (...campos) => (req, res, next) => {
  for (const campo of campos) {
    const valor = String(req.params[campo] ?? req.body?.[campo] ?? '');
    if (!/^[1-9]\d{0,9}$/.test(valor)) {
      return res.status(400).json({ mensaje: `El campo "${campo}" no es un ID válido` });
    }
  }
  next();
};

// Reglas de cada campo del usuario
const reglasUsuario = {
  nombre: (v) => validator.isLength(texto(v), { min: 3, max: 60 }) || 'El nombre debe tener entre 3 y 60 caracteres',
  correo: (v) => (validator.isEmail(texto(v)) && texto(v).length <= 120) || 'El correo electrónico no es válido',
  username: (v) => /^[a-zA-Z0-9_.]{3,30}$/.test(texto(v)) ||
    'El nombre de usuario debe tener de 3 a 30 caracteres (letras, números, punto o guion bajo)',
  password: (v) => (typeof v === 'string' && v.length >= 8 && v.length <= 72 && /[a-zA-Z]/.test(v) && /\d/.test(v)) ||
    'La contraseña debe tener de 8 a 72 caracteres, con al menos una letra y un número'
};

// Campos del perfil que se pueden dejar vacíos (para borrarlos)
const reglasPerfil = {
  biografia: (v) => validator.isLength(texto(v), { max: 150 }) || 'La presentación no puede pasar de 150 caracteres',
  sitioWeb: (v) => texto(v) === '' || (validator.isURL(texto(v)) && texto(v).length <= 200) || 'El sitio web no es válido'
};

/** Registro: todos los campos son obligatorios. */
const validarRegistro = (req, res, next) => {
  const datos = req.body || {};
  const errores = Object.keys(reglasUsuario)
    .map((campo) => reglasUsuario[campo](datos[campo]))
    .filter((r) => r !== true);
  if (errores.length > 0) return responderErrores(res, errores);
  next();
};

/** Editar perfil: solo se validan los campos que se envían. */
const validarActualizacion = (req, res, next) => {
  const datos = req.body || {};
  const enviados = Object.keys(reglasUsuario).filter((c) => datos[c] !== undefined && datos[c] !== '');
  const enviadosPerfil = Object.keys(reglasPerfil).filter((c) => datos[c] !== undefined);

  if (enviados.length === 0 && enviadosPerfil.length === 0) {
    return res.status(400).json({ mensaje: 'No se envió ningún dato para actualizar' });
  }
  const errores = [
    ...enviados.map((c) => reglasUsuario[c](datos[c])),
    ...enviadosPerfil.map((c) => reglasPerfil[c](datos[c]))
  ].filter((r) => r !== true);

  if (errores.length > 0) return responderErrores(res, errores);
  next();
};

/** Login: correo (o nombre de usuario) y contraseña. */
const validarLogin = (req, res, next) => {
  const { correo, username, password } = req.body || {};
  if (validator.isEmpty(texto(correo) || texto(username)) || !password) {
    return res.status(400).json({ mensaje: 'Escribe tu correo (o nombre de usuario) y tu contraseña' });
  }
  next();
};

// Pie de foto y ubicación (los dos opcionales)
const erroresTextoPublicacion = (body) => {
  const errores = [];
  if (!validator.isLength(texto(body?.descripcion), { max: 2200 })) errores.push('La descripción no puede pasar de 2200 caracteres');
  if (!validator.isLength(texto(body?.ubicacion), { max: 100 })) errores.push('La ubicación no puede pasar de 100 caracteres');
  return errores;
};

/**
 * Rostros detectados con face-api.js en el navegador.
 * Llega como texto JSON: un arreglo por foto con cajas {x, y, w, h, puntaje} relativas (0 a 1).
 * Se limpia y se limita para no guardar datos inválidos.
 */
const EXPRESIONES = ['neutral', 'feliz', 'triste', 'enojado', 'asustado', 'disgustado', 'sorprendido'];
const limpiarRostros = (crudo, totalFotos) => {
  let lista = [];
  try { lista = JSON.parse(crudo || '[]'); } catch (e) { lista = []; }
  if (!Array.isArray(lista)) lista = [];
  const numero = (v) => Math.min(1, Math.max(0, Number(v) || 0));
  return Array.from({ length: totalFotos }, (_, i) => (Array.isArray(lista[i]) ? lista[i] : [])
    .slice(0, 50)
    .map((r) => ({
      x: numero(r.x), y: numero(r.y), w: numero(r.w), h: numero(r.h),
      puntaje: Math.round(numero(r.puntaje) * 100) / 100,
      expresion: EXPRESIONES.includes(r.expresion) ? r.expresion : ''
    })));
};

/** Crear publicación: al menos una foto (Multer ya las dejó en req.files). */
const validarPublicacion = (req, res, next) => {
  const errores = erroresTextoPublicacion(req.body);
  if (!req.files || req.files.length === 0) errores.unshift('Selecciona al menos una foto (campo "imagenes")');
  if (errores.length > 0) return responderErrores(res, errores);
  req.rostros = limpiarRostros(req.body.rostros, req.files.length);
  next();
};

/** Editar publicación: solo descripción y ubicación. */
const validarEdicionPublicacion = (req, res, next) => {
  const { descripcion, ubicacion } = req.body || {};
  if (descripcion === undefined && ubicacion === undefined) {
    return res.status(400).json({ mensaje: 'Envía la descripción o la ubicación para actualizar' });
  }
  const errores = erroresTextoPublicacion(req.body);
  if (errores.length > 0) return responderErrores(res, errores);
  next();
};

/** Comentario: el texto es obligatorio. */
const validarComentario = (req, res, next) => {
  const comentario = texto(req.body?.comentario);
  if (validator.isEmpty(comentario)) return res.status(400).json({ mensaje: 'El comentario no puede estar vacío' });
  if (!validator.isLength(comentario, { max: 500 })) return res.status(400).json({ mensaje: 'El comentario no puede pasar de 500 caracteres' });
  next();
};

/** Paginación: ?pagina=1&limite=12  ->  req.paginacion = { pagina, limite, salto } */
const paginar = (limitePorDefecto = 12, limiteMaximo = 50) => (req, res, next) => {
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const limite = Math.min(limiteMaximo, Math.max(1, parseInt(req.query.limite, 10) || limitePorDefecto));
  req.paginacion = { pagina, limite, salto: (pagina - 1) * limite };
  next();
};

module.exports = {
  validarId,
  validarRegistro,
  validarActualizacion,
  validarLogin,
  validarPublicacion,
  validarEdicionPublicacion,
  validarComentario,
  paginar
};
