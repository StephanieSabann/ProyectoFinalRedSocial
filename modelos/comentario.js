/**
 * Tabla "comentario": comentarios de una publicación.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../basededatos/conexion');

const Comentario = sequelize.define('comentario', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  publicacion_id: { type: DataTypes.INTEGER, allowNull: false },
  comentario: { type: DataTypes.STRING(500), allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  indexes: [{ name: 'ix_comentario_publicacion_fecha', fields: ['publicacion_id', 'fecha'] }]
});

module.exports = Comentario;
