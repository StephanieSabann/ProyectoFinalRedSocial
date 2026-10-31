const { Router } = require('express');
const router = Router();

const { auth } = require('../middlewares/auth');
const { validarId, paginar } = require('../middlewares/validar');
const {
  seguir,
  dejarDeSeguir,
  listarSeguidores,
  listarSiguiendo,
  verContadores,
  verSugerencias,
  feed,
  darLike,
  listarLikes
} = require('../controladores/seguidor');

// Seguir / dejar de seguir (quien sigue es el usuario del token)
router.post('/seguidores', auth, validarId('seguido'), seguir);
router.delete('/seguidores/:seguido', auth, validarId('seguido'), dejarDeSeguir);

// Consultas de seguidores
router.get('/usuarios/:id/seguidores', auth, validarId('id'), listarSeguidores);
router.get('/usuarios/:id/siguiendo', auth, validarId('id'), listarSiguiendo);
router.get('/usuarios/:id/contadores', auth, validarId('id'), verContadores);
router.get('/sugerencias', auth, verSugerencias);

// Inicio: mis publicaciones + las de quienes sigo (paginado)
router.get('/feed', auth, paginar(10), feed);

// Likes ("Me gusta")
router.put('/publicaciones/:id/like', auth, validarId('id'), darLike);
router.get('/publicaciones/:id/likes', auth, validarId('id'), listarLikes);

module.exports = router;
