/**
 * Tabla "guardado": publicaciones que cada usuario guardó (solo las ve él).
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../basededatos/conexion');

const Guardado = sequelize.define('guardado', {
  usuario_id: { type: DataTypes.INTEGER, primaryKey: true },
  publicacion_id: { type: DataTypes.INTEGER, primaryKey: true },
  fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
});

module.exports = Guardado;
