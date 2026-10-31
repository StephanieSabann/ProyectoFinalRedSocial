const { Router } = require('express');
const router = Router();

const { auth } = require('../middlewares/auth');
const { subirImagenesPublicacion } = require('../middlewares/subir');
const { validarId, validarPublicacion, validarEdicionPublicacion, paginar } = require('../middlewares/validar');
const { crear, listar, uno, editar, borrar, guardar } = require('../controladores/publicacion');

// Crear: multipart/form-data con las fotos en "imagenes" (1 a 10) + descripcion + ubicacion + rostros (JSON)
router.post('/publicaciones', auth, subirImagenesPublicacion, validarPublicacion, crear);
router.get('/publicaciones', auth, paginar(24), listar);        // Explorar (miniaturas)
router.get('/publicaciones/:id', auth, validarId('id'), uno);   // resolución completa + transformaciones
router.put('/publicaciones/:id', auth, validarId('id'), validarEdicionPublicacion, editar);
router.delete('/publicaciones/:id', auth, validarId('id'), borrar);

// Guardar / quitar de guardados
router.put('/publicaciones/:id/guardar', auth, validarId('id'), guardar);

module.exports = router;
