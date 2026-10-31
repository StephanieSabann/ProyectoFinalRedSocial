/**
 * Paneles deslizables: Buscar (con búsquedas recientes) y Notificaciones.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icono from '../utilidades/Icono';
import { tiempoCorto } from '../utilidades/formato';
import { Avatar, BotonSeguir, FilaPersona } from './Basicos';
import { useInterfaz } from '../contexto/Interfaz';
import { api } from '../api';

const leerRecientes = () => { try { return JSON.parse(localStorage.getItem('busquedas-recientes')) || []; } catch (e) { return []; } };
const guardarRecientes = (l) => { try { localStorage.setItem('busquedas-recientes', JSON.stringify(l.slice(0, 10))); } catch (e) { /* sin almacenamiento */ } };

/** Búsqueda de usuarios con espera de 250 ms entre teclas. */
export function useBusqueda(texto) {
  const [resultados, setResultados] = useState(null);
  useEffect(() => {
    const consulta = texto.trim();
    if (!consulta) { setResultados(null); return undefined; }
    const t = setTimeout(() => {
      api(`/usuarios?buscar=${encodeURIComponent(consulta)}`).then(setResultados).catch(() => setResultados([]));
    }, 250);
    return () => clearTimeout(t);
  }, [texto]);
  return resultados;
}

export function PanelBuscar() {
  const { panel, cerrarPanel } = useInterfaz();
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  const [recientes, setRecientes] = useState(leerRecientes);
  const resultados = useBusqueda(texto);
  const entrada = useRef(null);
  const abierto = panel === 'buscar';

  useEffect(() => {
    if (abierto) { setTexto(''); setRecientes(leerRecientes()); setTimeout(() => entrada.current?.focus(), 200); }
  }, [abierto]);

  const abrir = (p) => {
    const nuevos = [{ id: p.id, username: p.username, nombre: p.nombre, imagen: p.imagen }, ...recientes.filter((r) => r.id !== p.id)];
    guardarRecientes(nuevos);
    cerrarPanel();
    navegar(`/perfil/${p.id}`);
  };
  const quitar = (id) => { const l = recientes.filter((r) => r.id !== id); guardarRecientes(l); setRecientes(l); };

  return (
    <aside id="panel-buscar" className={`panel-lateral ${abierto ? 'abierto' : ''}`} aria-label="Buscar" aria-hidden={!abierto}>
      <div className="panel-encabezado">
        <h2>Buscar</h2>
        <button className="btn-icono" onClick={cerrarPanel} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
      </div>
      <div className="buscador">
        <input ref={entrada} type="search" placeholder="Buscar" autoComplete="off" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <div className="panel-subtitulo">
        <h3>{texto.trim() ? 'Resultados' : 'Recientes'}</h3>
        {!texto.trim() && recientes.length > 0 && (
          <button className="link-azul" onClick={() => { guardarRecientes([]); setRecientes([]); }}>Borrar todo</button>
        )}
      </div>
      <div className="lista-personas">
        {texto.trim()
          ? (resultados === null ? <div className="cargando-mas activo" />
            : resultados.length === 0 ? <p className="vacio">No se encontraron resultados.</p>
              : resultados.map((p) => <FilaPersona key={p.id} persona={p} boton={false} alClic={() => abrir(p)} />))
          : (recientes.length === 0 ? <p className="vacio">No hay búsquedas recientes.</p>
            : recientes.map((p) => (
              <FilaPersona key={p.id} persona={p} boton={false} alClic={() => abrir(p)}
                extra={<button className="btn-quitar" aria-label="Quitar" onClick={() => quitar(p.id)}><Icono nombre="cerrar" /></button>} />
            )))}
      </div>
    </aside>
  );
}

const FRASES = { like: ' le gustó tu publicación. ', comentario: ' comentó: ', seguir: ' comenzó a seguirte. ' };
const GRUPOS = [['Hoy', 1], ['Esta semana', 7], ['Este mes', 30], ['Anteriores', Infinity]];

export function PanelNotificaciones({ alLeer }) {
  const { panel, cerrarPanel, abrirPublicacion } = useInterfaz();
  const navegar = useNavigate();
  const [lista, setLista] = useState(null);
  const abierto = panel === 'notificaciones';

  // GET /api/notificaciones y luego PUT /api/notificaciones/leidas
  useEffect(() => {
    if (!abierto) return;
    setLista(null);
    api('/notificaciones')
      .then(async (n) => { setLista(n); await api('/notificaciones/leidas', { method: 'PUT' }); alLeer(); })
      .catch(() => setLista([]));
  }, [abierto, alLeer]);

  const irPerfil = (id) => { cerrarPanel(); navegar(`/perfil/${id}`); };
  let grupoActual = null;

  return (
    <aside id="panel-notificaciones" className={`panel-lateral ${abierto ? 'abierto' : ''}`} aria-label="Notificaciones" aria-hidden={!abierto}>
      <div className="panel-encabezado">
        <h2>Notificaciones</h2>
        <button className="btn-icono" onClick={cerrarPanel} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
      </div>
      <div className="lista-notificaciones">
        {lista === null && <div className="cargando-mas activo" />}
        {lista?.length === 0 && (
          <div className="feed-vacio">
            <div className="circulo"><Icono nombre="corazon" /></div>
            <h3>Actividad en tus publicaciones</h3>
            <p>Cuando a alguien le guste o comente una de tus publicaciones, lo verás aquí.</p>
          </div>
        )}
        {lista?.map((n) => {
          const dias = (Date.now() - new Date(n.fecha)) / 86400000;
          const grupo = GRUPOS.find(([, limite]) => dias < limite)[0];
          const titulo = grupo !== grupoActual ? <h4>{grupo}</h4> : null;
          grupoActual = grupo;
          return (
            <div key={n.id}>
              {titulo}
              <div className={`notificacion ${n.leida ? '' : 'nueva'}`}>
                <Avatar persona={n.de} clase="avatar-44" />
                <div className="texto" onClick={() => (n.publicacion ? abrirPublicacion(n.publicacion.id) : irPerfil(n.de.id))}>
                  {n.tipo === 'like' && 'A '}<strong>{n.de.username}</strong>{FRASES[n.tipo]}
                  {n.tipo === 'comentario' && `${n.texto} `}
                  <time>{tiempoCorto(n.fecha)}</time>
                </div>
                {n.publicacion?.miniatura
                  ? <img className="miniatura" src={n.publicacion.miniatura} alt="Publicación" onClick={() => abrirPublicacion(n.publicacion.id)} />
                  : n.tipo === 'seguir' && <BotonSeguir persona={{ ...n.de, meSigue: true }} />}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
