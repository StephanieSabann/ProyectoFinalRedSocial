/**
 * Inicio de sesión con Google.
 *
 * El frontend (React + @react-oauth/google) obtiene un "ID token" de Google y lo envía
 * a POST /api/login/google. Aquí se verifica la firma y que el token sea para
 * nuestra aplicación (GOOGLE_CLIENT_ID). Nunca se confía en datos del navegador sin verificar.
 */
const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const cliente = new OAuth2Client(CLIENT_ID);

/**
 * @returns {{ googleId, correo, nombre, correoVerificado }}
 */
async function verificarTokenGoogle(credencial) {
  if (!CLIENT_ID) {
    const error = new Error('El inicio de sesión con Google no está configurado (falta GOOGLE_CLIENT_ID)');
    error.status = 503;
    throw error;
  }
  const ticket = await cliente.verifyIdToken({ idToken: credencial, audience: CLIENT_ID });
  const datos = ticket.getPayload();
  return {
    googleId: datos.sub,
    correo: (datos.email || '').toLowerCase(),
    nombre: datos.name || datos.given_name || 'Usuario',
    correoVerificado: Boolean(datos.email_verified)
  };
}

module.exports = { CLIENT_ID, verificarTokenGoogle };
