const { Router } = require('express');
const router = Router();

const { auth } = require('../middlewares/auth');
const { validarId, validarComentario } = require('../middlewares/validar');
const {
  crearComentario,
  obtenerComentariosPorPublicacion,
  borrarComentario
} = require('../controladores/comentario');

router.post('/publicaciones/:id/comentarios', auth, validarId('id'), validarComentario, crearComentario);
router.get('/publicaciones/:id/comentarios', auth, validarId('id'), obtenerComentariosPorPublicacion);
router.delete('/comentarios/:id', auth, validarId('id'), borrarComentario);

module.exports = router;
