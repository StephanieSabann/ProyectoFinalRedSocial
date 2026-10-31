/**
 * Cliente de la API REST.
 * Agrega el token JWT a cada petición y convierte los errores en excepciones con el mensaje del servidor.
 */
let token = null;
let alExpirar = () => {};

export const fijarToken = (nuevo) => { token = nuevo; };
export const alExpirarSesion = (funcion) => { alExpirar = funcion; };

export async function api(ruta, opciones = {}) {
  const cabeceras = { ...(opciones.headers || {}) };
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  let cuerpo = opciones.body;
  if (opciones.json !== undefined) {
    cabeceras['Content-Type'] = 'application/json';
    cuerpo = JSON.stringify(opciones.json);
  }

  const respuesta = await fetch(`/api${ruta}`, { method: opciones.method || 'GET', headers: cabeceras, body: cuerpo });
  const datos = await respuesta.json().catch(() => ({}));

  // Token vencido o inválido: se cierra la sesión
  if (respuesta.status === 401 && token) {
    alExpirar('Tu sesión expiró, vuelve a iniciar sesión');
    throw new Error('Sesión expirada');
  }
  if (!respuesta.ok) throw new Error(datos.mensaje || `Error ${respuesta.status}`);
  return datos;
}

// Atajos
export const get = (ruta) => api(ruta);
export const post = (ruta, json) => api(ruta, { method: 'POST', json });
export const put = (ruta, json) => api(ruta, { method: 'PUT', json });
export const del = (ruta) => api(ruta, { method: 'DELETE' });
export const enviarFormulario = (ruta, formulario) => api(ruta, { method: 'POST', body: formulario });
