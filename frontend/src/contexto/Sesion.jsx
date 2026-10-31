/**
 * Contexto de sesión: usuario actual, token JWT, configuración pública
 * y el conjunto de personas que sigo (para los botones "Seguir / Siguiendo").
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, fijarToken, alExpirarSesion } from '../api';
import { vaciarAlmacen } from '../almacen';

const Contexto = createContext(null);
export const useSesion = () => useContext(Contexto);

const CLAVE = 'sesion';
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)); } catch (e) { return null; } };
const escribir = (v) => { try { v ? localStorage.setItem(CLAVE, JSON.stringify(v)) : localStorage.removeItem(CLAVE); } catch (e) { /* sin almacenamiento */ } };

export function ProveedorSesion({ config, children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [siguiendo, setSiguiendo] = useState(() => new Set());
  const [avisoSalida, setAvisoSalida] = useState('');

  const cargarSiguiendo = useCallback(async (id) => {
    const datos = await api(`/usuarios/${id}/siguiendo`);
    setSiguiendo(new Set(datos.siguiendo.map((p) => p.id)));
  }, []);

  /** Guarda la sesión que devuelve login / registro / Google. */
  const iniciarSesion = useCallback(async ({ token, usuario: u }) => {
    fijarToken(token);
    escribir({ token });
    setAvisoSalida('');
    await cargarSiguiendo(u.id);
    setUsuario(u);
  }, [cargarSiguiendo]);

  const cerrarSesion = useCallback((aviso = '') => {
    fijarToken(null);
    escribir(null);
    vaciarAlmacen();
    setUsuario(null);
    setSiguiendo(new Set());
    setAvisoSalida(aviso);
    window.location.hash = '#/';
  }, []);

  // Al abrir la página: si había un token guardado, se valida con GET /api/perfil
  useEffect(() => {
    alExpirarSesion(cerrarSesion);
    const guardada = leer();
    if (!guardada?.token) { setCargando(false); return; }
    fijarToken(guardada.token);
    api('/perfil')
      .then(async (u) => { await cargarSiguiendo(u.id); setUsuario(u); })
      .catch(() => { fijarToken(null); escribir(null); })
      .finally(() => setCargando(false));
  }, [cerrarSesion, cargarSiguiendo]);

  const marcarSiguiendo = useCallback((id, sigo) => {
    setSiguiendo((anterior) => {
      const nuevo = new Set(anterior);
      sigo ? nuevo.add(id) : nuevo.delete(id);
      return nuevo;
    });
  }, []);

  /** Tras editar el perfil: nuevo token y datos. */
  const actualizarUsuario = useCallback((datos) => {
    if (datos.token) { fijarToken(datos.token); escribir({ token: datos.token }); }
    setUsuario((u) => ({ ...u, ...(datos.usuario || datos) }));
  }, []);

  const valor = useMemo(() => ({
    config, usuario, cargando, siguiendo, avisoSalida,
    iniciarSesion, cerrarSesion, marcarSiguiendo, actualizarUsuario
  }), [config, usuario, cargando, siguiendo, avisoSalida, iniciarSesion, cerrarSesion, marcarSiguiendo, actualizarUsuario]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
