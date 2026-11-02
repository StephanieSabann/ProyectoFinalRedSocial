const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const router = Router();

const { auth } = require('../middlewares/auth');
const { exigirRecaptcha } = require('../middlewares/recaptcha');
const { subirAvatar: recibirAvatar } = require('../middlewares/subir');
const { validarId, validarRegistro, validarActualizacion, validarLogin } = require('../middlewares/validar');
const {
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
} = require('../controladores/usuario');

// Máximo 20 intentos de login/registro cada 15 minutos por IP (frena ataques de fuerza bruta)
const limiteAcceso = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LIMITE_INTENTOS) || 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { mensaje: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' }
});

// Rutas públicas (no necesitan token)
router.get('/config', configuracion);                                                  // llaves públicas para React
router.post('/usuarios', limiteAcceso, validarRegistro, exigirRecaptcha, crearUsuario); // registro
router.post('/login', limiteAcceso, validarLogin, exigirRecaptcha, login);              // login con contraseña
router.post('/login/google', limiteAcceso, loginGoogle);                                // login con Google

// Rutas protegidas (necesitan el token en la cabecera Authorization)
router.get('/prueba', auth, prueba);
router.get('/perfil', auth, perfil);
router.get('/usuarios', auth, obtenerUsuarios);                 // ?buscar=texto
router.put('/usuarios', auth, validarActualizacion, actualizarUsuario);

// Foto de perfil
router.post('/usuarios/avatar', auth, recibirAvatar, subirAvatar);
router.delete('/usuarios/avatar', auth, quitarAvatar);

router.get('/usuarios/:id', auth, validarId('id'), obtenerUsuarioPorId);
router.get('/usuarios/:id/publicaciones', auth, validarId('id'), obtenerPublicacionesPorUsuario);

// Publicaciones guardadas del usuario del token
router.get('/guardados', auth, obtenerGuardados);

module.exports = router;
