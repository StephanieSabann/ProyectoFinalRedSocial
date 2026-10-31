const { Router } = require('express');
const router = Router();

const { auth } = require('../middlewares/auth');
const {
  listarNotificaciones,
  contarSinLeer,
  marcarLeidas
} = require('../controladores/notificacion');

// Actividad: likes, comentarios y nuevos seguidores
router.get('/notificaciones', auth, listarNotificaciones);
router.get('/notificaciones/sin-leer', auth, contarSinLeer);
router.put('/notificaciones/leidas', auth, marcarLeidas);

module.exports = router;
