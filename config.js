/**
 * Configuración del frontend.
 * Las llaves de Google y reCAPTCHA NO van aquí: se leen del backend (GET /api/config),
 * así se cambian en el .env del servidor sin volver a compilar React.
 */
export const CONFIG = {
  // Nombre que aparece junto al logo y en la pestaña del navegador
  nombreApp: 'Instagram'
};
