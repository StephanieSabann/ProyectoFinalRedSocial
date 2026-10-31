/**
 * Tabla "publicacion": una publicación con 1 a 10 fotos (las fotos están en la tabla "imagen").
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../basededatos/conexion');

const Publicacion = sequelize.define('publicacion', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  descripcion: { type: DataTypes.TEXT, allowNull: false }, // NVARCHAR(MAX) en SQL Server
  ubicacion: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
  likes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  total_comentarios: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  indexes: [{ name: 'ix_publicacion_usuario_fecha', fields: ['usuario_id', 'fecha'] }, { name: 'ix_publicacion_fecha', fields: ['fecha'] }]
});

module.exports = Publicacion;
