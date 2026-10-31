/**
 * Estructura de la aplicación: rutas, navegación y capas (ventanas, paneles, visor).
 *
 * Rutas (HashRouter):
 *   #/                         Inicio
 *   #/explorar                 Explorar
 *   #/perfil/:id               Perfil  (#/perfil/:id/guardados)
 *   #/p/:id                    Abre una publicación (enlace para compartir)
 */
import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSesion } from './contexto/Sesion';
import { ProveedorInterfaz, useInterfaz } from './contexto/Interfaz';
import { HojaOpciones, ModalLista, Toast } from './componentes/Basicos';
import { BarraInferior, BarraSuperior, NavLateral } from './componentes/Navegacion';
import { PanelBuscar, PanelNotificaciones } from './componentes/Paneles';
import ModalPublicacion from './componentes/ModalPublicacion';
import ModalCrear from './componentes/ModalCrear';
import ModalEditarPerfil from './componentes/ModalEditarPerfil';
import VisorHistorias from './componentes/VisorHistorias';
import Bienvenida from './vistas/Bienvenida';
import Inicio from './vistas/Inicio';
import Explorar from './vistas/Explorar';
import Perfil from './vistas/Perfil';
import { api } from './api';

/** #/p/:id -> abre la publicación encima del inicio */
function AbrirEnlace() {
  const { id } = useParams();
  const { abrirPublicacion } = useInterfaz();
  useEffect(() => { abrirPublicacion(Number(id)); }, [id, abrirPublicacion]);
  return <Navigate to="/" replace />;
}

/** Tema claro / oscuro guardado en el navegador */
function aplicarTema(tema) {
  if (tema) document.documentElement.dataset.tema = tema;
  else delete document.documentElement.dataset.tema;
}
const temaActual = () => document.documentElement.dataset.tema
  || (matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro');

function Aplicacion() {
  const { usuario, cerrarSesion } = useSesion();
  const { panel, cerrarPanel, hojaOpciones, abrirEditarPerfil } = useInterfaz();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const [hayNuevas, setHayNuevas] = useState(false);

  // Puntito rojo de notificaciones (se revisa cada 30 s)
  const revisar = useCallback(() => {
    api('/notificaciones/sin-leer').then((d) => setHayNuevas(d.total > 0)).catch(() => {});
  }, []);
  useEffect(() => { revisar(); const t = setInterval(revisar, 30000); return () => clearInterval(t); }, [revisar]);
  const alLeer = useCallback(() => setHayNuevas(false), []);

  // Al cambiar de página se cierran los paneles y se sube al inicio
  useEffect(() => { cerrarPanel(); window.scrollTo(0, 0); }, [pathname, cerrarPanel]);

  const menuMas = () => hojaOpciones({
    opciones: [
      { texto: 'Editar perfil', accion: abrirEditarPerfil },
      { texto: 'Guardado', accion: () => navegar(`/perfil/${usuario.id}/guardados`) },
      {
        texto: temaActual() === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
        accion: () => {
          const nuevo = temaActual() === 'oscuro' ? 'claro' : 'oscuro';
          aplicarTema(nuevo);
          try { localStorage.setItem('tema', nuevo); } catch (e) { /* nada */ }
        }
      },
      { texto: 'Cerrar sesión', clase: 'peligro', accion: () => cerrarSesion() }
    ]
  });

  return (
    <div id="pantalla-app">
      <NavLateral hayNuevas={hayNuevas} alMas={menuMas} />
      <BarraSuperior hayNuevas={hayNuevas} />
      <PanelBuscar />
      <PanelNotificaciones alLeer={alLeer} />
      {panel && <div className="fondo-panel" onClick={cerrarPanel} />}

      <main className="contenido">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/explorar" element={<Explorar />} />
          <Route path="/perfil/:id" element={<Perfil />} />
          <Route path="/perfil/:id/guardados" element={<Perfil guardados />} />
          <Route path="/p/:id" element={<AbrirEnlace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <BarraInferior />
      <ModalPublicacion />
      <ModalCrear />
      <ModalEditarPerfil />
      <VisorHistorias />
      <ModalLista />
      <HojaOpciones />
    </div>
  );
}

export default function App() {
  const { usuario, cargando } = useSesion();
  useEffect(() => { try { aplicarTema(localStorage.getItem('tema')); } catch (e) { /* nada */ } }, []);

  if (cargando) return <div className="pantalla-carga"><div className="cargando-mas activo" /></div>;
  return (
    <HashRouter>
      <ProveedorInterfaz>
        {usuario ? <Aplicacion /> : <Bienvenida />}
        <Toast />
      </ProveedorInterfaz>
    </HashRouter>
  );
}
