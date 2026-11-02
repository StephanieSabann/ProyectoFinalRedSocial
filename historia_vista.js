/**
 * Tabla "historia_vista": quién vio cada historia.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../basededatos/conexion');

const HistoriaVista = sequelize.define('historia_vista', {
  historia_id: { type: DataTypes.INTEGER, primaryKey: true },
  usuario_id: { type: DataTypes.INTEGER, primaryKey: true },
  fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
});

module.exports = HistoriaVista;
