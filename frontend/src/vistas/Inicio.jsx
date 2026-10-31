/**
 * Página de inicio (usuarios autenticados):
 * historias, feed paginado con scroll infinito (mis fotos + las de quienes sigo)
 * y la opción de verlo como cuadrícula de MINIATURAS. A la derecha, sugerencias.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icono from '../utilidades/Icono';
import BarraHistorias from '../componentes/BarraHistorias';
import { Avatar, FilaPersona } from '../componentes/Basicos';
import { Celda, TarjetaPublicacion } from '../componentes/Publicacion';
import { useSesion } from '../contexto/Sesion';
import { useInterfaz } from '../contexto/Interfaz';
import { guardarHistorias, guardarPublicacion } from '../almacen';
import { api } from '../api';

/** Lista paginada con "cargar más" al llegar al final (IntersectionObserver). */
export function usePaginado(ruta, dependencia) {
  const [ids, setIds] = useState([]);
  const [estado, setEstado] = useState({ pagina: 0, totalPaginas: 1, total: null, cargando: false });
  const ocupado = useRef(false);

  const cargar = useCallback(async (reiniciar) => {
    if (ocupado.current) return;
    const pagina = reiniciar ? 1 : estado.pagina + 1;
    if (!reiniciar && pagina > estado.totalPaginas) return;
    ocupado.current = true;
    setEstado((e) => ({ ...e, cargando: true }));
    try {
      const datos = await api(`${ruta}${ruta.includes('?') ? '&' : '?'}pagina=${pagina}`);
      datos.publicaciones.forEach(guardarPublicacion);
      const nuevos = datos.publicaciones.map((p) => p.id);
      setIds((anteriores) => (reiniciar ? nuevos : [...anteriores, ...nuevos.filter((id) => !anteriores.includes(id))]));
      setEstado({ pagina: datos.pagina, totalPaginas: datos.totalPaginas, total: datos.total, cargando: false });
    } catch (e) {
      setEstado((s) => ({ ...s, cargando: false }));
    } finally {
      ocupado.current = false;
    }
  }, [ruta, estado.pagina, estado.totalPaginas]);

  // Primera página (y cada vez que cambie la dependencia)
  useEffect(() => { cargar(true); /* eslint-disable-next-line */ }, [ruta, dependencia]);

  const centinela = useRef(null);
  useEffect(() => {
    const el = centinela.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && estado.pagina > 0) cargar(false); }, { rootMargin: '400px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [cargar, estado.pagina]);

  return { ids, estado, centinela, quedan: estado.pagina < estado.totalPaginas };
}

function leerVista() { try { return localStorage.getItem('vista-inicio') || 'feed'; } catch (e) { return 'feed'; } }

export default function Inicio() {
  const { usuario, cerrarSesion } = useSesion();
  const { refrescos, abrirCrear } = useInterfaz();
  const [vista, setVista] = useState(leerVista);
  const [sugerencias, setSugerencias] = useState(null);
  const { ids, estado, centinela, quedan } = usePaginado('/feed', refrescos.feed);

  useEffect(() => { api('/historias').then(guardarHistorias).catch(() => {}); }, [refrescos.historias]);
  useEffect(() => { api('/sugerencias').then(setSugerencias).catch(() => setSugerencias([])); }, [refrescos.feed]);
  useEffect(() => { document.title = 'Inicio'; }, []);

  const cambiarVista = (v) => { setVista(v); try { localStorage.setItem('vista-inicio', v); } catch (e) { /* nada */ } };

  return (
    <section id="vista-inicio" className="vista">
      <div className="columna-feed">
        <BarraHistorias />

        <div className="selector-vista" role="tablist" aria-label="Forma de ver el inicio">
          <button role="tab" aria-selected={vista === 'feed'} className={vista === 'feed' ? 'activa' : ''} onClick={() => cambiarVista('feed')}>
            <Icono nombre="lista" />Feed
          </button>
          <button role="tab" aria-selected={vista === 'miniaturas'} className={vista === 'miniaturas' ? 'activa' : ''} onClick={() => cambiarVista('miniaturas')}>
            <Icono nombre="cuadricula" />Miniaturas
          </button>
        </div>

        {estado.total === 0 && (
          <div className="feed-vacio">
            <div className="circulo"><Icono nombre="camara" /></div>
            <h3>Bienvenido(a)</h3>
            <p>Cuando sigas a otras personas, aquí verás las fotos que compartan.</p>
            <button className="btn btn-primario" onClick={abrirCrear}>Comparte tu primera foto</button>
            <Link className="link-azul" to="/explorar">Descubre personas en Explorar</Link>
          </div>
        )}

        {vista === 'feed'
          ? <div className="feed">{ids.map((id) => <TarjetaPublicacion key={id} id={id} />)}</div>
          : <div className="cuadricula">{ids.map((id) => <Celda key={id} id={id} />)}</div>}

        <div ref={centinela} className={`cargando-mas ${estado.cargando ? 'activo' : ''}`} />
        {!quedan && estado.total > 0 && (
          <div className="feed-vacio">
            <div className="circulo" style={{ fontSize: 28 }}>✓</div>
            <h3>Ya viste todo</h3>
            <p>Ya viste todas las publicaciones nuevas.</p>
            <Link className="link-azul" to="/explorar">Ver publicaciones en Explorar</Link>
          </div>
        )}
      </div>

      <aside className="columna-sugerencias">
        <div className="fila-persona fila-yo">
          <Avatar persona={usuario} clase="avatar-44" />
          <div className="info"><strong>{usuario.username}</strong><span>{usuario.nombre}</span></div>
          <button className="seguir-inline" onClick={() => cerrarSesion()}>Salir</button>
        </div>
        <div className="sugerencias-titulo"><span>Sugerencias para ti</span></div>
        <div className="lista-personas compacta">
          {sugerencias?.length === 0 && <p className="vacio-texto">Ya sigues a todas las personas registradas.</p>}
          {sugerencias?.slice(0, 5).map((p) => <FilaPersona key={p.id} persona={p} subtitulo={p.motivo} estiloBoton="link" />)}
        </div>
        <p className="pie-pagina">Información · Ayuda · Privacidad · Condiciones<br />Proyecto final · Desarrollo Web · 2026</p>
      </aside>
    </section>
  );
}
