/**
 * Tabla "auditoria": registro de transacciones importantes
 * (registro, login, login fallido, crear/borrar publicación, seguir, etc.).
 * Solo se inserta; nunca se actualiza ni se borra desde la aplicación.
 */
const { DataTypes } = require('sequelize');
const { sequelize, columnaJSON } = require('../basededatos/conexion');

const Auditoria = sequelize.define('auditoria', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  usuario_id: { type: DataTypes.INTEGER, allowNull: true }, // null si no hay sesión (ej. login fallido)
  accion: { type: DataTypes.STRING(50), allowNull: false },
  entidad: { type: DataTypes.STRING(30), allowNull: true },
  entidad_id: { type: DataTypes.INTEGER, allowNull: true },
  ip: { type: DataTypes.STRING(45), allowNull: true },
  agente: { type: DataTypes.STRING(255), allowNull: true },
  detalle: columnaJSON('detalle'),
  fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  indexes: [{ name: 'ix_auditoria_usuario_fecha', fields: ['usuario_id', 'fecha'] }, { name: 'ix_auditoria_accion_fecha', fields: ['accion', 'fecha'] }]
});

module.exports = Auditoria;
