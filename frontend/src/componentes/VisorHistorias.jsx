/**
 * Visor de historias a pantalla completa:
 * barras de progreso de 5 s, toque a la derecha/izquierda para avanzar/retroceder,
 * mantener presionado para pausar, flechas del teclado y Esc.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icono from '../utilidades/Icono';
import { tiempoCorto } from '../utilidades/formato';
import { Avatar } from './Basicos';
import { useSesion } from '../contexto/Sesion';
import { useInterfaz } from '../contexto/Interfaz';
import { marcarHistoriaVista } from '../almacen';
import { api } from '../api';

const DURACION = 5000;

export default function VisorHistorias() {
  const { visor, cerrarVisor, hayModal, hojaOpciones, abrirLista, mostrarMensaje, refrescar } = useInterfaz();
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const [grupos, setGrupos] = useState([]);
  const [g, setG] = useState(0);
  const [h, setH] = useState(0);
  const [progreso, setProgreso] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [cargada, setCargada] = useState(false);
  const transcurrido = useRef(0);
  const presion = useRef(0);

  // Al abrir: empezar en la primera historia sin ver del usuario elegido
  useEffect(() => {
    if (!visor) return;
    setGrupos(visor.grupos);
    setG(visor.indice);
    const primera = visor.grupos[visor.indice].historias.findIndex((x) => !x.vista);
    setH(primera >= 0 ? primera : 0);
  }, [visor]);

  const grupo = grupos[g];
  const historia = grupo?.historias[h];
  const esMia = grupo?.usuario.id === usuario.id;

  const cerrar = useCallback(() => { cerrarVisor(); refrescar('historias'); }, [cerrarVisor, refrescar]);

  const siguiente = useCallback(() => {
    if (!grupo) return;
    if (h < grupo.historias.length - 1) setH(h + 1);
    else if (g < grupos.length - 1) { setG(g + 1); setH(0); }
    else cerrar();
  }, [grupo, grupos, g, h, cerrar]);

  const anterior = useCallback(() => {
    if (h > 0) setH(h - 1);
    else if (g > 0) { setG(g - 1); setH(grupos[g - 1].historias.length - 1); }
    else { transcurrido.current = 0; setProgreso(0); }
  }, [g, h, grupos]);

  // Reiniciar al cambiar de historia y marcarla como vista (PUT /api/historias/:id/vista)
  useEffect(() => {
    if (!historia) return;
    transcurrido.current = 0;
    setProgreso(0);
    setCargada(false);
    if (!historia.vista) {
      historia.vista = true;
      marcarHistoriaVista(historia.id);
      api(`/historias/${historia.id}/vista`, { method: 'PUT' }).catch(() => {});
    }
  }, [historia]);

  // Avance automático (se detiene si hay una ventana encima o si está pausado)
  const detenido = pausado || hayModal || !cargada;
  useEffect(() => {
    if (!historia || detenido) return undefined;
    let marco;
    const inicio = performance.now() - transcurrido.current;
    const paso = (ahora) => {
      transcurrido.current = ahora - inicio;
      const avance = Math.min(1, transcurrido.current / DURACION);
      setProgreso(avance);
      if (avance >= 1) siguiente();
      else marco = requestAnimationFrame(paso);
    };
    marco = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(marco);
  }, [historia, detenido, siguiente]);

  // Teclado
  useEffect(() => {
    if (!visor) return undefined;
    const tecla = (e) => {
      if (hayModal) return;
      if (e.key === 'Escape') cerrar();
      if (e.key === 'ArrowRight') siguiente();
      if (e.key === 'ArrowLeft') anterior();
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [visor, hayModal, cerrar, siguiente, anterior]);

  if (!visor || !historia) return null;

  const opciones = () => hojaOpciones({
    opciones: [{
      texto: 'Eliminar', clase: 'peligro',
      accion: async () => {
        try {
          await api(`/historias/${historia.id}`, { method: 'DELETE' });
          mostrarMensaje('Historia eliminada');
          const restantes = grupo.historias.filter((x) => x.id !== historia.id);
          if (restantes.length === 0) return cerrar();
          setGrupos(grupos.map((x, i) => (i === g ? { ...x, historias: restantes } : x)));
          setH(Math.min(h, restantes.length - 1));
        } catch (e) { mostrarMensaje(e.message, 'error'); }
      }
    }]
  });

  const zona = (accion) => ({
    onPointerDown: () => { presion.current = Date.now(); setPausado(true); },
    onPointerUp: () => { setPausado(false); if (Date.now() - presion.current < 250) accion(); },
    onPointerLeave: () => setPausado(false)
  });

  return (
    <div className="visor-historias" onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <button className="visor-cerrar" onClick={cerrar} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
      <button className="visor-flecha izq" onClick={anterior} disabled={g === 0 && h === 0} aria-label="Anterior"><Icono nombre="atras" /></button>
      <div className="visor-marco">
        <div className="visor-barras">
          {grupo.historias.map((x, i) => (
            <span key={x.id} className={i < h ? 'completa' : ''}><i style={i === h ? { width: `${progreso * 100}%` } : undefined} /></span>
          ))}
        </div>
        <div className="visor-encabezado">
          <span className="visor-autor" onClick={() => { cerrar(); navegar(`/perfil/${grupo.usuario.id}`); }}>
            <Avatar persona={grupo.usuario} clase="avatar-xs" conHistoria={false} alClic={() => {}} />
            {grupo.usuario.username}
            <time>{tiempoCorto(historia.fecha)}</time>
          </span>
          {esMia && <button className="btn-icono claro" onClick={opciones} aria-label="Opciones"><Icono nombre="opciones" /></button>}
        </div>
        <img src={historia.imagen} alt="Historia" onLoad={() => setCargada(true)} onError={siguiente} />
        <div className="visor-zona izq" {...zona(anterior)} />
        <div className="visor-zona der" {...zona(siguiente)} />
        {esMia && (
          <button className="visor-vistas" onClick={() => abrirLista('Visto por', async () => (await api(`/historias/${historia.id}/vistas`)).usuarios)}>
            <Icono nombre="ojo" /><span>Visto por {historia.totalVistas ?? 0}</span>
          </button>
        )}
      </div>
      <button className="visor-flecha der" onClick={siguiente} aria-label="Siguiente"><Icono nombre="adelante" /></button>
    </div>
  );
}
