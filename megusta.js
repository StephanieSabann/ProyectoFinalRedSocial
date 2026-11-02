/**
 * Tabla "me_gusta": un "Me gusta" por usuario y publicación.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../basededatos/conexion');

const MeGusta = sequelize.define('me_gusta', {
  usuario_id: { type: DataTypes.INTEGER, primaryKey: true },
  publicacion_id: { type: DataTypes.INTEGER, primaryKey: true },
  fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  indexes: [{ name: 'ix_me_gusta_publicacion', fields: ['publicacion_id'] }]
});

module.exports = MeGusta;
