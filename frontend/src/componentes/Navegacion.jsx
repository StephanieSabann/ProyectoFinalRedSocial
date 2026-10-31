/**
 * Navegación: menú lateral (computadora), barra superior e inferior (celular).
 */
import { NavLink, useLocation } from 'react-router-dom';
import Icono, { Logo } from '../utilidades/Icono';
import { Avatar } from './Basicos';
import { useSesion } from '../contexto/Sesion';
import { useInterfaz } from '../contexto/Interfaz';
import { CONFIG } from '../config';

export function Marca({ grande = false }) {
  return (
    <span className={grande ? 'marca-grande' : 'marca'}>
      <span className="logo-icono"><Logo tamano={grande ? 56 : 28} /></span>
      {CONFIG.nombreApp && <span className="logo-texto">{CONFIG.nombreApp}</span>}
    </span>
  );
}

export function NavLateral({ hayNuevas, alMas }) {
  const { usuario } = useSesion();
  const { panel, alternarPanel, abrirCrear } = useInterfaz();
  const { pathname } = useLocation();
  const miPerfil = pathname === `/perfil/${usuario.id}` || pathname === `/perfil/${usuario.id}/guardados`;
  const clase = (activa) => `nav-item ${activa ? 'activa' : ''}`;

  return (
    <nav className={`nav-lateral ${panel ? 'compacta' : ''}`} aria-label="Navegación principal">
      <NavLink to="/" className="nav-logo"><Marca /></NavLink>
      <NavLink to="/" end className={({ isActive }) => clase(isActive && !panel)}><Icono nombre="inicio" /><span>Inicio</span></NavLink>
      <button className={clase(panel === 'buscar')} onClick={() => alternarPanel('buscar')}><Icono nombre="buscar" /><span>Buscar</span></button>
      <NavLink to="/explorar" className={({ isActive }) => clase(isActive && !panel)}><Icono nombre="explorar" /><span>Explorar</span></NavLink>
      <button className={clase(panel === 'notificaciones')} onClick={() => alternarPanel('notificaciones')}>
        <Icono nombre="corazon" /><span>Notificaciones</span>{hayNuevas && <b className="punto-rojo" />}
      </button>
      <button className="nav-item" onClick={abrirCrear}><Icono nombre="crear" /><span>Crear</span></button>
      <NavLink to={`/perfil/${usuario.id}`} className={clase(miPerfil && !panel)}>
        <Avatar persona={usuario} clase="avatar-nav" conHistoria={false} alClic={() => {}} /><span>Perfil</span>
      </NavLink>
      <div className="nav-espacio" />
      <button className="nav-item" onClick={alMas}><Icono nombre="menu" /><span>Más</span></button>
    </nav>
  );
}

export function BarraSuperior({ hayNuevas }) {
  const { alternarPanel, abrirCrear } = useInterfaz();
  return (
    <header className="barra-superior">
      <NavLink to="/" className="nav-logo"><Marca /></NavLink>
      <div className="barra-superior-acciones">
        <button className="btn-icono" onClick={abrirCrear} aria-label="Crear"><Icono nombre="crear" /></button>
        <button className="btn-icono con-badge" onClick={() => alternarPanel('notificaciones')} aria-label="Notificaciones">
          <Icono nombre="corazon" />{hayNuevas && <b className="punto-rojo" />}
        </button>
      </div>
    </header>
  );
}

export function BarraInferior() {
  const { usuario } = useSesion();
  const { alternarPanel, abrirCrear } = useInterfaz();
  const { pathname } = useLocation();
  return (
    <nav className="barra-inferior" aria-label="Navegación">
      <NavLink to="/" end aria-label="Inicio" className={({ isActive }) => (isActive ? 'activa' : '')}><Icono nombre="inicio" /></NavLink>
      <NavLink to="/explorar" aria-label="Explorar" className={({ isActive }) => (isActive ? 'activa' : '')}><Icono nombre="explorar" /></NavLink>
      <button onClick={abrirCrear} aria-label="Crear"><Icono nombre="crear" /></button>
      <button onClick={() => alternarPanel('buscar')} aria-label="Buscar"><Icono nombre="buscar" /></button>
      <NavLink to={`/perfil/${usuario.id}`} aria-label="Perfil" className={pathname.startsWith(`/perfil/${usuario.id}`) ? 'activa' : ''}>
        <Avatar persona={usuario} clase="avatar-nav" conHistoria={false} alClic={() => {}} />
      </NavLink>
    </nav>
  );
}
