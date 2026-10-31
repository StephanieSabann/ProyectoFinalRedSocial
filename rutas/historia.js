const { Router } = require('express');
const router = Router();

const { auth } = require('../middlewares/auth');
const { subirHistoria } = require('../middlewares/subir');
const { validarId } = require('../middlewares/validar');
const {
  crearHistoria,
  feedHistorias,
  historiasDeUsuario,
  marcarVista,
  verVistas,
  borrarHistoria
} = require('../controladores/historia');

// Historias (duran 24 horas)
router.post('/historias', auth, subirHistoria, crearHistoria);       // campo "file0"
router.get('/historias', auth, feedHistorias);                       // barra de historias
router.get('/usuarios/:id/historias', auth, validarId('id'), historiasDeUsuario);
router.put('/historias/:id/vista', auth, validarId('id'), marcarVista);
router.get('/historias/:id/vistas', auth, validarId('id'), verVistas);
router.delete('/historias/:id', auth, validarId('id'), borrarHistoria);

module.exports = router;
