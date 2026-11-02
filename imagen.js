/**
 * Tabla "imagen": cada foto de una publicación.
 *
 * La imagen NO se guarda en la base de datos: aquí solo están las "keys"
 * (rutas dentro del bucket S3) de la foto original, sus versiones para
 * mostrar (mediana y miniatura) y sus 3 transformaciones automáticas.
 */
const { DataTypes } = require('sequelize');
const { sequelize, columnaJSON } = require('../basededatos/conexion');

const Imagen = sequelize.define('imagen', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  publicacion_id: { type: DataTypes.INTEGER, allowNull: false },
  orden: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },

  // Ubicación de cada versión en S3
  key_original: { type: DataTypes.STRING(255), allowNull: false },   // resolución completa (máx. 2048 px)
  key_mediana: { type: DataTypes.STRING(255), allowNull: false },    // 1080 px para el feed
  key_miniatura: { type: DataTypes.STRING(255), allowNull: false },  // 320x320 para cuadrículas
  key_bn: { type: DataTypes.STRING(255), allowNull: false },         // transformación 1: blanco y negro
  key_sepia: { type: DataTypes.STRING(255), allowNull: false },      // transformación 2: sepia
  key_escala: { type: DataTypes.STRING(255), allowNull: false },     // transformación 3: reducción al 50 %

  ancho: { type: DataTypes.SMALLINT, allowNull: false },
  alto: { type: DataTypes.SMALLINT, allowNull: false },
  tamano_bytes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  color: { type: DataTypes.STRING(7), allowNull: false, defaultValue: '#dbdbdb' }, // color dominante (fondo mientras carga)

  // Reconocimiento de imágenes
  rostros: columnaJSON('rostros'),     // face-api.js: [{x, y, w, h, puntaje}] relativos (0 a 1)
  etiquetas: columnaJSON('etiquetas'), // Amazon Rekognition (opcional): [{nombre, confianza}]
  sensible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false } // Rekognition detectó contenido inapropiado
}, {
  indexes: [{ name: 'ix_imagen_publicacion_orden', fields: ['publicacion_id', 'orden'] }]
});

module.exports = Imagen;
