/**
 * Servidor principal (Express).
 *
 * - /api/...      API REST
 * - /imagenes/... fotos (solo cuando ALMACENAMIENTO=local; en producción se sirven desde S3 o Azure Blob)
 * - /             aplicación React ya compilada (carpeta frontend/dist)
 *
 * Configuración en el archivo .env (ver .env.example).
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { conexion } = require('./basededatos/conexion');
const { iniciarLimpiezaHistorias } = require('./services/historia');
const almacenamiento = require('./services/almacenamiento');

const app = express();
const puerto = process.env.PUERTO || 3000;

// Detrás de Nginx en EC2: confiar en la IP real que envía el proxy
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Conexión a SQL Server (y limpieza de historias vencidas cuando ya está conectada)
conexion().then(iniciarLimpiezaHistorias);
almacenamiento.preparar();

// Middlewares
app.use(cors({ origin: process.env.CORS_ORIGEN || true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Cabeceras de seguridad básicas
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Rutas de la API
app.use('/api', require('./rutas/usuario'));
app.use('/api', require('./rutas/publicacion'));
app.use('/api', require('./rutas/comentario'));
app.use('/api', require('./rutas/seguidor'));
app.use('/api', require('./rutas/historia'));
app.use('/api', require('./rutas/notificacion'));

// Ruta de salud (la usa el balanceador / monitoreo)
app.get('/salud', (req, res) => res.status(200).json({ estado: 'ok', almacenamiento: almacenamiento.DRIVER }));

// Ruta de la API que no existe -> 404
app.use('/api', (req, res) => res.status(404).json({ mensaje: 'Ruta no encontrada' }));

// Imágenes locales (solo en modo desarrollo sin S3)
if (almacenamiento.DRIVER === 'local') {
  app.use('/imagenes', express.static(almacenamiento.CARPETA_LOCAL, { maxAge: '365d', immutable: true }));
}

// Frontend React compilado (npm run build dentro de frontend/)
// (se revisa en cada petición, así funciona aunque compiles con el servidor ya encendido)
const carpetaFrontend = path.join(__dirname, 'frontend', 'dist');
const indexFrontend = path.join(carpetaFrontend, 'index.html');
app.use(express.static(carpetaFrontend, { index: false, maxAge: '7d' }));
app.get(/^(?!\/api|\/imagenes).*/, (req, res) => {
  if (fs.existsSync(indexFrontend)) return res.sendFile(indexFrontend);
  res.send('Compila el frontend: en la carpeta principal ejecuta  npm run build  y recarga la página');
});

// Errores inesperados (por ejemplo, un JSON mal escrito) -> 400 / 500
app.use((error, req, res, next) => {
  const codigo = error.status || 500;
  res.status(codigo).json({
    mensaje: codigo === 400 ? 'El JSON enviado no es válido' : 'Error del servidor',
    ...(process.env.NODE_ENV === 'production' ? {} : { error: error.message })
  });
});

app.listen(puerto, () => console.log(`Servidor escuchando en http://localhost:${puerto}`));

