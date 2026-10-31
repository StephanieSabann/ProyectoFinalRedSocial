/**
 * Tabla "seguidor": quién sigue a quién.
 * La llave primaria compuesta (usuario_id, seguido_id) impide seguir dos veces a la misma persona.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../basededatos/conexion');

const Seguidor = sequelize.define('seguidor', {
  usuario_id: { type: DataTypes.INTEGER, primaryKey: true }, // quien SIGUE
  seguido_id: { type: DataTypes.INTEGER, primaryKey: true }, // quien ES SEGUIDO
  fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  indexes: [{ name: 'ix_seguidor_seguido', fields: ['seguido_id'] }]
});

module.exports = Seguidor;
