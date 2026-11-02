/**
 * Carga todos los modelos y define las relaciones (llaves foráneas) entre tablas.
 * ON DELETE CASCADE: si se borra un usuario o una publicación, se borra lo que depende de él.
 */
const Usuario = require('./usuario');
const Publicacion = require('./publicacion');
const Imagen = require('./imagen');
const Comentario = require('./comentario');
const Seguidor = require('./seguidor');
const MeGusta = require('./megusta');
const Guardado = require('./guardado');
const Historia = require('./historia');
const HistoriaVista = require('./historia_vista');
const Notificacion = require('./notificacion');
const Auditoria = require('./auditoria');

const cascada = { onDelete: 'CASCADE', onUpdate: 'CASCADE' };

// Usuario 1 — N Publicación
Usuario.hasMany(Publicacion, { foreignKey: 'usuario_id', as: 'publicaciones', ...cascada });
Publicacion.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario', ...cascada });

// Publicación 1 — N Imagen
Publicacion.hasMany(Imagen, { foreignKey: 'publicacion_id', as: 'imagenes', ...cascada });
Imagen.belongsTo(Publicacion, { foreignKey: 'publicacion_id', ...cascada });

// Comentarios
Publicacion.hasMany(Comentario, { foreignKey: 'publicacion_id', as: 'comentarios', ...cascada });
Comentario.belongsTo(Publicacion, { foreignKey: 'publicacion_id', as: 'publicacion', ...cascada });
Comentario.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario', ...cascada });
Usuario.hasMany(Comentario, { foreignKey: 'usuario_id', ...cascada });

// Seguidores (N — N entre usuarios)
Seguidor.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'quien_sigue', ...cascada });
Seguidor.belongsTo(Usuario, { foreignKey: 'seguido_id', as: 'seguido', ...cascada });
Usuario.hasMany(Seguidor, { foreignKey: 'usuario_id', ...cascada });
Usuario.hasMany(Seguidor, { foreignKey: 'seguido_id', ...cascada });

// Me gusta y guardados (N — N entre usuario y publicación)
MeGusta.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario', ...cascada });
MeGusta.belongsTo(Publicacion, { foreignKey: 'publicacion_id', ...cascada });
Publicacion.hasMany(MeGusta, { foreignKey: 'publicacion_id', ...cascada });
Usuario.hasMany(MeGusta, { foreignKey: 'usuario_id', ...cascada });

Guardado.belongsTo(Usuario, { foreignKey: 'usuario_id', ...cascada });
Guardado.belongsTo(Publicacion, { foreignKey: 'publicacion_id', as: 'publicacion', ...cascada });
Publicacion.hasMany(Guardado, { foreignKey: 'publicacion_id', ...cascada });
Usuario.hasMany(Guardado, { foreignKey: 'usuario_id', ...cascada });

// Historias y sus vistas
Usuario.hasMany(Historia, { foreignKey: 'usuario_id', ...cascada });
Historia.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario', ...cascada });
Historia.hasMany(HistoriaVista, { foreignKey: 'historia_id', as: 'vistas', ...cascada });
HistoriaVista.belongsTo(Historia, { foreignKey: 'historia_id', ...cascada });
HistoriaVista.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario', ...cascada });
Usuario.hasMany(HistoriaVista, { foreignKey: 'usuario_id', ...cascada });

// Notificaciones
Notificacion.belongsTo(Usuario, { foreignKey: 'para_id', as: 'para', ...cascada });
Notificacion.belongsTo(Usuario, { foreignKey: 'de_id', as: 'de', ...cascada });
Notificacion.belongsTo(Publicacion, { foreignKey: 'publicacion_id', as: 'publicacion', ...cascada });
Usuario.hasMany(Notificacion, { foreignKey: 'para_id', ...cascada });
Usuario.hasMany(Notificacion, { foreignKey: 'de_id', ...cascada });
Publicacion.hasMany(Notificacion, { foreignKey: 'publicacion_id', ...cascada });

// Auditoría: si se borra el usuario, el registro se conserva (usuario_id queda en NULL)
Auditoria.belongsTo(Usuario, { foreignKey: 'usuario_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

module.exports = {
  Usuario,
  Publicacion,
  Imagen,
  Comentario,
  Seguidor,
  MeGusta,
  Guardado,
  Historia,
  HistoriaVista,
  Notificacion,
  Auditoria
};
