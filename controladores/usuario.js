/**
 * Controlador de usuarios: registro, login (contraseña y Google), perfil, búsqueda y foto de perfil.
 */
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { Usuario, Publicacion, Imagen, Guardado } = require('../modelos');
const { escaparLike } = require('../basededatos/conexion');
const { crearToken } = require('../services/jwt');
const { verificarTokenGoogle } = require('../services/google');
const { auditar } = require('../services/auditoria');
const almacenamiento = require('../services/almacenamiento');
const { procesarAvatar } = require('../services/imagenes');
const serializar = require('../services/serializar');

const RONDAS_BCRYPT = 12;

/** Genera una sal única para el usuario y el hash de su contraseña con esa sal. */
async function cifrarPassword(password) {
  const salt = await bcrypt.genSalt(RONDAS_BCRYPT);
  const hash = await bcrypt.hash(password, salt);
  return { password_salt: salt, password_hash: hash };
}

/** Respuesta común de login: token + datos propios. */
async function respuestaSesion(usuario, mensaje) {
  return {
    mensaje,
    usuario: await serializar.usuario(usuario, { completo: true, propio: true }),
    token: crearToken(usuario)
  };
}

// Incluir publicaciones con sus imágenes ordenadas
const incluirPublicacion = [
  { model: Usuario, as: 'usuario', attributes: serializar.CAMPOS_USUARIO },
  { model: Imagen, as: 'imagenes', separate: true, order: [['orden', 'ASC']] }
];

// GET /api/prueba  (ruta de prueba protegida: muestra quién eres según tu token)
const prueba = (req, res) => res.status(200).json({ mensaje: 'Ruta de prueba funcionando', usuario: req.usuario });

// GET /api/config  (pública) -> llaves públicas que necesita el frontend
const configuracion = (req, res) => res.status(200).json({
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || '',
  almacenamiento: almacenamiento.DRIVER,
  rekognition: require('../services/rekognition').ACTIVO
});

// POST /api/usuarios  -> registro (requiere reCAPTCHA)
const crearUsuario = async (req, res) => {
  try {
    const nombre = req.body.nombre.trim();
    const correo = req.body.correo.trim().toLowerCase();
    const username = req.body.username.trim();

    // Control de duplicados (SQL Server compara sin distinguir mayúsculas por su collation)
    const existe = await Usuario.findOne({ where: { [Op.or]: [{ correo }, { username }] } });
    if (existe) {
      return res.status(400).json({ mensaje: 'El correo o el nombre de usuario ya están registrados' });
    }

    const usuario = await Usuario.create({ nombre, correo, username, ...(await cifrarPassword(req.body.password)) });
    await auditar(req, 'REGISTRO', { entidad: 'usuario', entidadId: usuario.id, usuarioId: usuario.id });

    return res.status(201).json(await respuestaSesion(usuario, 'Cuenta creada correctamente'));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al registrar usuario', error: error.message });
  }
};

// POST /api/login  -> body: { correo (o username), password, recaptcha }
const login = async (req, res) => {
  try {
    const identificador = (req.body.correo || req.body.username).trim();
    const usuario = await Usuario.scope('conPassword').findOne({
      where: { [Op.or]: [{ correo: identificador.toLowerCase() }, { username: identificador }] }
    });

    if (!usuario) {
      await auditar(req, 'LOGIN_FALLIDO', { detalle: { motivo: 'no existe', identificador } });
      return res.status(404).json({ mensaje: 'No existe una cuenta con ese correo o nombre de usuario' });
    }
    if (!usuario.password_hash) {
      return res.status(400).json({ mensaje: 'Esta cuenta se creó con Google. Usa "Continuar con Google".' });
    }

    // Se vuelve a calcular el hash con la sal guardada del usuario y se compara
    // (comparación en tiempo constante para no filtrar información por el tiempo de respuesta)
    const hash = Buffer.from(await bcrypt.hash(req.body.password, usuario.password_salt));
    const guardado = Buffer.from(usuario.password_hash);
    if (hash.length !== guardado.length || !crypto.timingSafeEqual(hash, guardado)) {
      await auditar(req, 'LOGIN_FALLIDO', { usuarioId: usuario.id, detalle: { motivo: 'contraseña incorrecta' } });
      return res.status(400).json({ mensaje: 'La contraseña es incorrecta' });
    }

    await auditar(req, 'LOGIN', { usuarioId: usuario.id, detalle: { metodo: 'password' } });
    return res.status(200).json(await respuestaSesion(usuario, 'Login exitoso'));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error en el proceso de login', error: error.message });
  }
};

/** Crea un username libre a partir del correo: ana.lopez, ana.lopez1, ana.lopez2... */
async function usernameDisponible(correo) {
  const base = (correo.split('@')[0] || 'usuario').replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 24) || 'usuario';
  let candidato = base.length >= 3 ? base : `${base}_ig`;
  for (let i = 1; await Usuario.count({ where: { username: candidato } }); i++) candidato = `${base}${i}`;
  return candidato;
}

// POST /api/login/google  -> body: { credential } (ID token de Google)
const loginGoogle = async (req, res) => {
  try {
    if (!req.body?.credential) return res.status(400).json({ mensaje: 'Falta la credencial de Google' });

    let datos;
    try {
      datos = await verificarTokenGoogle(req.body.credential);
    } catch (error) {
      await auditar(req, 'LOGIN_GOOGLE_FALLIDO', { detalle: { motivo: error.message } });
      return res.status(error.status || 401).json({ mensaje: error.status ? error.message : 'La credencial de Google no es válida' });
    }
    if (!datos.correoVerificado) return res.status(400).json({ mensaje: 'Tu correo de Google no está verificado' });

    // 1) ¿Ya existe con ese google_id?  2) ¿Existe con ese correo? -> se vincula  3) Si no, se crea
    let usuario = await Usuario.findOne({ where: { google_id: datos.googleId } });
    let nuevo = false;
    if (!usuario) {
      usuario = await Usuario.findOne({ where: { correo: datos.correo } });
      if (usuario) {
        usuario.google_id = datos.googleId;
        await usuario.save();
      } else {
        usuario = await Usuario.create({
          nombre: datos.nombre.slice(0, 60),
          correo: datos.correo,
          username: await usernameDisponible(datos.correo),
          proveedor: 'google',
          google_id: datos.googleId
        });
        nuevo = true;
        await auditar(req, 'REGISTRO', { entidad: 'usuario', entidadId: usuario.id, usuarioId: usuario.id, detalle: { metodo: 'google' } });
      }
    }

    await auditar(req, 'LOGIN', { usuarioId: usuario.id, detalle: { metodo: 'google' } });
    return res.status(nuevo ? 201 : 200).json(await respuestaSesion(usuario, nuevo ? 'Cuenta creada con Google' : 'Login exitoso'));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al iniciar sesión con Google', error: error.message });
  }
};

// GET /api/perfil  -> datos del usuario que inició sesión
const perfil = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.usuario.id);
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    return res.status(200).json(await serializar.usuario(usuario, { completo: true, propio: true }));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener el perfil', error: error.message });
  }
};

// GET /api/usuarios?buscar=ana  -> búsqueda por nombre de usuario o nombre (máx. 20)
const obtenerUsuarios = async (req, res) => {
  try {
    const buscar = typeof req.query.buscar === 'string' ? req.query.buscar.trim().slice(0, 50) : '';
    const patron = `%${escaparLike(buscar)}%`;
    const filtro = buscar ? { [Op.or]: [{ username: { [Op.like]: patron } }, { nombre: { [Op.like]: patron } }] } : {};
    const usuarios = await Usuario.findAll({ where: filtro, order: [['username', 'ASC']], limit: buscar ? 20 : 100 });
    return res.status(200).json(await Promise.all(usuarios.map((u) => serializar.usuario(u))));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener usuarios', error: error.message });
  }
};

// GET /api/usuarios/:id  -> perfil público (el correo solo lo ve su dueño)
const obtenerUsuarioPorId = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    const propio = usuario.id === req.usuario.id;
    return res.status(200).json(await serializar.usuario(usuario, { completo: true, propio }));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener el usuario', error: error.message });
  }
};

// PUT /api/usuarios  -> actualiza los datos del usuario que inició sesión
const actualizarUsuario = async (req, res) => {
  try {
    const id = req.usuario.id;
    const cambios = {};
    ['nombre', 'username'].forEach((c) => { if (req.body[c]) cambios[c] = req.body[c].trim(); });
    if (req.body.correo) cambios.correo = req.body.correo.trim().toLowerCase();
    if (typeof req.body.biografia === 'string') cambios.biografia = req.body.biografia.trim();
    if (typeof req.body.sitioWeb === 'string') cambios.sitio_web = req.body.sitioWeb.trim();

    // Que el nuevo correo o username no los tenga otra persona
    const condiciones = [];
    if (cambios.correo) condiciones.push({ correo: cambios.correo });
    if (cambios.username) condiciones.push({ username: cambios.username });
    if (condiciones.length > 0) {
      const ocupado = await Usuario.findOne({ where: { id: { [Op.ne]: id }, [Op.or]: condiciones } });
      if (ocupado) return res.status(400).json({ mensaje: 'El correo o el nombre de usuario ya los usa otra persona' });
    }

    if (req.body.password) Object.assign(cambios, await cifrarPassword(req.body.password));

    const usuario = await Usuario.findByPk(id);
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    await usuario.update(cambios);
    await auditar(req, 'PERFIL_ACTUALIZAR', {
      entidad: 'usuario', entidadId: id,
      detalle: { campos: Object.keys(cambios).filter((c) => !c.startsWith('password')).concat(cambios.password_hash ? ['password'] : []) }
    });

    return res.status(200).json(await respuestaSesion(usuario, 'Perfil actualizado correctamente'));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al actualizar usuario', error: error.message });
  }
};

// POST /api/usuarios/avatar  (campo "file0")
const subirAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ mensaje: 'No se ha adjuntado ninguna imagen (campo file0)' });
    const usuario = await Usuario.findByPk(req.usuario.id);
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    const nuevaKey = await procesarAvatar(req.file.buffer, usuario.id);
    const anterior = usuario.imagen_key;
    await usuario.update({ imagen_key: nuevaKey });
    await almacenamiento.borrar(anterior);

    return res.status(200).json({ mensaje: 'Foto de perfil actualizada', usuario: await serializar.usuario(usuario, { completo: true, propio: true }) });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al subir la foto de perfil', error: error.message });
  }
};

// DELETE /api/usuarios/avatar
const quitarAvatar = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.usuario.id);
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    if (!usuario.imagen_key) return res.status(400).json({ mensaje: 'No tienes foto de perfil' });

    await almacenamiento.borrar(usuario.imagen_key);
    await usuario.update({ imagen_key: null });
    return res.status(200).json({ mensaje: 'Foto de perfil eliminada', usuario: await serializar.usuario(usuario, { completo: true, propio: true }) });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al quitar la foto de perfil', error: error.message });
  }
};

// GET /api/usuarios/:id/publicaciones  -> cuadrícula del perfil (miniaturas)
const obtenerPublicacionesPorUsuario = async (req, res) => {
  try {
    const lista = await Publicacion.findAll({
      where: { usuario_id: req.params.id },
      include: incluirPublicacion,
      order: [['fecha', 'DESC']]
    });
    return res.status(200).json(await serializar.publicaciones(lista, req.usuario.id));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al consultar publicaciones del usuario', error: error.message });
  }
};

// GET /api/guardados  -> publicaciones que guardé (lo último guardado primero)
const obtenerGuardados = async (req, res) => {
  try {
    const filas = await Guardado.findAll({ where: { usuario_id: req.usuario.id }, order: [['fecha', 'DESC']], attributes: ['publicacion_id'] });
    const ids = filas.map((f) => f.publicacion_id);
    const lista = await Publicacion.findAll({ where: { id: { [Op.in]: ids } }, include: incluirPublicacion });
    lista.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    return res.status(200).json(await serializar.publicaciones(lista, req.usuario.id));
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al obtener guardados', error: error.message });
  }
};

module.exports = {
  incluirPublicacion,
  prueba,
  configuracion,
  crearUsuario,
  login,
  loginGoogle,
  perfil,
  obtenerUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuario,
  subirAvatar,
  quitarAvatar,
  obtenerPublicacionesPorUsuario,
  obtenerGuardados
};
