/**
 * Tabla "usuario": cuentas de la red social.
 *
 * Contraseñas: se guarda el hash bcrypt y, en su propia columna, la sal única
 * que se generó para ese usuario (bcrypt.genSalt). Nunca se guarda la contraseña.
 * Las cuentas creadas con Google no tienen contraseña (proveedor = 'google').
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../basededatos/conexion');

const Usuario = sequelize.define('usuario', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nombre: { type: DataTypes.STRING(60), allowNull: false },
  correo: { type: DataTypes.STRING(120), allowNull: false, unique: true },
  username: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING(60), allowNull: true },
  password_salt: { type: DataTypes.STRING(29), allowNull: true },
  proveedor: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'local', validate: { isIn: [['local', 'google']] } },
  google_id: { type: DataTypes.STRING(64), allowNull: true }, // único solo cuando no es NULL (índice filtrado en SQL Server)
  biografia: { type: DataTypes.STRING(150), allowNull: false, defaultValue: '' },
  sitio_web: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '' },
  imagen_key: { type: DataTypes.STRING(255), allowNull: true }, // ubicación de la foto de perfil en S3
  fecha_registro: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  indexes: [{ name: 'uq_usuario_google', unique: true, fields: ['google_id'] }],
  // Por defecto nunca se leen el hash ni la sal
  defaultScope: { attributes: { exclude: ['password_hash', 'password_salt'] } },
  scopes: { conPassword: { attributes: { include: ['password_hash', 'password_salt'] } } }
});

// Al convertir a JSON tampoco salen nunca
Usuario.prototype.toJSON = function () {
  const datos = { ...this.get() };
  delete datos.password_hash;
  delete datos.password_salt;
  return datos;
};

module.exports = Usuario;
