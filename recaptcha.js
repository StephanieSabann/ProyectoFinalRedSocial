/**
 * Google reCAPTCHA v2 ("No soy un robot").
 *
 * El frontend envía el token que genera el widget en el campo "recaptcha".
 * Aquí se valida con Google usando la clave secreta (RECAPTCHA_SECRET).
 * Si RECAPTCHA_SECRET no está definida (desarrollo), la verificación se omite.
 */
const SECRETO = process.env.RECAPTCHA_SECRET || '';
const ACTIVO = Boolean(SECRETO);

async function verificarRecaptcha(token, ip) {
  if (!ACTIVO) return { ok: true, omitido: true };
  if (!token) return { ok: false };

  const parametros = new URLSearchParams({ secret: SECRETO, response: token });
  if (ip) parametros.append('remoteip', ip);

  try {
    const respuesta = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: parametros
    });
    const datos = await respuesta.json();
    return { ok: Boolean(datos.success), errores: datos['error-codes'] };
  } catch (error) {
    console.error('No se pudo contactar a reCAPTCHA:', error.message);
    return { ok: false };
  }
}

module.exports = { ACTIVO, verificarRecaptcha };
