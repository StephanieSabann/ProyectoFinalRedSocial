/**
 * Middleware que exige un reCAPTCHA válido (campo "recaptcha" del body).
 * Se usa en el registro y en el login con contraseña.
 */
const { verificarRecaptcha } = require('../services/recaptcha');

const exigirRecaptcha = async (req, res, next) => {
  const resultado = await verificarRecaptcha(req.body?.recaptcha, req.ip);
  if (!resultado.ok) {
    return res.status(400).json({ mensaje: 'Confirma que no eres un robot (reCAPTCHA)' });
  }
  next();
};

module.exports = { exigirRecaptcha };
