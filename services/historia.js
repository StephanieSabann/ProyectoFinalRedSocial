/**
 * Limpieza automática de historias que ya pasaron sus 24 horas
 * (borra la fila en la base de datos y la foto en S3).
 */
const { Op } = require('sequelize');
const { Historia } = require('../modelos');
const almacenamiento = require('./almacenamiento');

const limpiarHistoriasVencidas = async () => {
  try {
    const vencidas = await Historia.findAll({ where: { expira: { [Op.lte]: new Date() } }, attributes: ['id', 'key_imagen'] });
    if (vencidas.length === 0) return;

    await almacenamiento.borrar(vencidas.map((h) => h.key_imagen));
    await Historia.destroy({ where: { id: { [Op.in]: vencidas.map((h) => h.id) } } });
    console.log(`Se borraron ${vencidas.length} historias vencidas`);
  } catch (error) {
    console.error('Error al limpiar historias:', error.message);
  }
};

/** Revisa al arrancar y luego cada 10 minutos. */
const iniciarLimpiezaHistorias = () => {
  limpiarHistoriasVencidas();
  setInterval(limpiarHistoriasVencidas, 10 * 60 * 1000).unref();
};

module.exports = { limpiarHistoriasVencidas, iniciarLimpiezaHistorias };
