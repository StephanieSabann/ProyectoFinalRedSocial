/**
 * Tabla "historia": fotos que desaparecen 24 horas después de publicarse.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../basededatos/conexion');

const VEINTICUATRO_HORAS = 24 * 60 * 60 * 1000;

const Historia = sequelize.define('historia', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  key_imagen: { type: DataTypes.STRING(255), allowNull: false }, // ubicación en S3
  fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  expira: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: () => new Date(Date.now() + VEINTICUATRO_HORAS)
  }
}, {
  indexes: [{ name: 'ix_historia_usuario_expira', fields: ['usuario_id', 'expira'] }, { name: 'ix_historia_expira', fields: ['expira'] }]
});

module.exports = Historia;
