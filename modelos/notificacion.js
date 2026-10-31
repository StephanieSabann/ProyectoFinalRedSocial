/**
 * Tabla "notificacion": likes, comentarios y nuevos seguidores.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../basededatos/conexion');

const Notificacion = sequelize.define('notificacion', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  para_id: { type: DataTypes.INTEGER, allowNull: false }, // quien recibe
  de_id: { type: DataTypes.INTEGER, allowNull: false },   // quien hizo la acción
  tipo: { type: DataTypes.STRING(12), allowNull: false, validate: { isIn: [['like', 'comentario', 'seguir']] } },
  publicacion_id: { type: DataTypes.INTEGER, allowNull: true },
  texto: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
  leida: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  indexes: [{ name: 'ix_notificacion_para_fecha', fields: ['para_id', 'fecha'] }]
});

module.exports = Notificacion;
