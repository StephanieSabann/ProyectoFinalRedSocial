/**
 * Componentes pequeños que se usan en toda la app:
 * Avatar, BotonSeguir, FilaPersona, Modal, Toast, HojaOpciones y ModalLista.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icono from '../utilidades/Icono';
import { useSesion } from '../contexto/Sesion';
import { useInterfaz } from '../contexto/Interfaz';
import { useHistorias } from '../almacen';
import { api } from '../api';

/** Foto de perfil (o silueta). Con "conHistoria" muestra el anillo si la persona tiene historias. */
export function Avatar({ persona, clase = '', conHistoria = true, alClic }) {
  const navegar = useNavigate();
  const { abrirVisor } = useInterfaz();
  const historias = useHistorias();
  const [fallo, setFallo] = useState(false);

  const grupo = conHistoria && persona?.id ? historias.find((g) => g.usuario.id === persona.id) : null;
  const imagen = persona?.imagen && !fallo
    ? <img src={persona.imagen} alt={`Foto de perfil de ${persona.username}`} loading="lazy" onError={() => setFallo(true)} />
    : <Icono nombre="usuario" relleno />;

  const avatar = (
    <span
      className={`avatar ${clase}`.trim()}
      title={persona?.username}
      onClick={grupo ? undefined : (e) => {
        if (alClic) return alClic(e);
        if (persona?.id) { e.stopPropagation(); navegar(`/perfil/${persona.id}`); }
      }}
    >
      {imagen}
    </span>
  );

  if (!grupo) return avatar;
  return (
    <span
      className={`anillo ${grupo.todasVistas ? 'visto' : ''}`.trim()}
      title={`Ver historia de ${persona.username}`}
      onClick={(e) => { e.stopPropagation(); abrirVisor(historias, historias.indexOf(grupo)); }}
    >
      {avatar}
    </span>
  );
}

/** Botón "Seguir" / "Siguiendo" / "Seguir también". estilo: 'btn' o 'link'. */
export function BotonSeguir({ persona, estilo = 'btn', alCambiar }) {
  const { siguiendo, marcarSiguiendo } = useSesion();
  const { confirmar, mostrarMensaje } = useInterfaz();
  const [ocupado, setOcupado] = useState(false);
  const loSigo = siguiendo.has(persona.id);

  const alternar = async (e) => {
    e.stopPropagation();
    setOcupado(true);
    try {
      if (loSigo) {
        const ok = await confirmar({ persona, titulo: `¿Dejar de seguir a @${persona.username}?`, boton: 'Dejar de seguir' });
        if (!ok) return;
        await api(`/seguidores/${persona.id}`, { method: 'DELETE' });
        marcarSiguiendo(persona.id, false);
      } else {
        await api('/seguidores', { method: 'POST', json: { seguido: persona.id } });
        marcarSiguiendo(persona.id, true);
      }
      alCambiar?.();
    } catch (error) {
      mostrarMensaje(error.message, 'error');
    } finally {
      setOcupado(false);
    }
  };

  const texto = loSigo ? 'Siguiendo' : (persona.meSigue ? 'Seguir también' : 'Seguir');
  if (estilo === 'link') {
    return <button className="seguir-inline" style={loSigo ? { color: 'var(--texto)' } : undefined} disabled={ocupado} onClick={alternar}>{texto}</button>;
  }
  return <button className={`btn ${loSigo ? 'btn-gris' : 'btn-primario'}`} disabled={ocupado} onClick={alternar}>{texto}</button>;
}

/** Fila: avatar + usuario + subtítulo + botón opcional. */
export function FilaPersona({ persona, subtitulo, boton = true, estiloBoton = 'btn', alClic, extra }) {
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const ir = () => (alClic ? alClic() : navegar(`/perfil/${persona.id}`));
  return (
    <div className="fila-persona">
      <Avatar persona={persona} clase="avatar-44" />
      <div className="info" onClick={ir}>
        <strong>{persona.username}</strong>
        <span>{subtitulo ?? persona.nombre}</span>
      </div>
      {boton && persona.id !== usuario.id && <BotonSeguir persona={persona} estilo={estiloBoton} />}
      {extra}
    </div>
  );
}

/** Ventana genérica: cierra con clic fuera o con Esc. */
export function Modal({ id, alCerrar, oscuro = false, botonFuera = false, children }) {
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') alCerrar(); };
    document.addEventListener('keydown', tecla);
    document.body.classList.add('sin-scroll');
    return () => {
      document.removeEventListener('keydown', tecla);
      if (!document.querySelector('.modal:not(.cerrando)')) document.body.classList.remove('sin-scroll');
    };
  }, [alCerrar]);

  return (
    <div id={id} className={`modal ${oscuro ? 'modal-oscuro' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      {botonFuera && (
        <button className="modal-cerrar-fuera" onClick={alCerrar} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
      )}
      {children}
    </div>
  );
}

export function Toast() {
  const { toast } = useInterfaz();
  return (
    <div className={`toast ${toast ? `visible ${toast.tipo}` : ''}`} role="status" aria-live="polite">
      {toast?.texto}
    </div>
  );
}

/** Hoja de opciones al estilo de las apps (lista de botones + Cancelar). */
export function HojaOpciones() {
  const { hoja, cerrarHoja } = useInterfaz();
  if (!hoja) return null;
  const cancelar = () => { cerrarHoja(); hoja.alCancelar?.(); };
  return (
    <Modal id="modal-opciones" alCerrar={cancelar}>
      <div className="hoja-opciones">
        {(hoja.titulo || hoja.persona) && (
          <div className="hoja-titulo">
            {hoja.persona && <Avatar persona={hoja.persona} conHistoria={false} alClic={() => {}} />}
            {hoja.titulo && <h3>{hoja.titulo}</h3>}
            {hoja.texto && <p>{hoja.texto}</p>}
          </div>
        )}
        {hoja.opciones.map((o, i) => (
          <button
            key={o.texto}
            className={o.clase || ''}
            style={i === 0 && !hoja.titulo && !hoja.persona ? { borderTop: 'none' } : undefined}
            onClick={() => { cerrarHoja(); o.accion?.(); }}
          >
            {o.texto}
          </button>
        ))}
        <button onClick={cancelar}>Cancelar</button>
      </div>
    </Modal>
  );
}

/** Ventana con lista de personas (seguidores, seguidos, me gusta, vistas). */
export function ModalLista() {
  const { lista, cerrarLista } = useInterfaz();
  const [personas, setPersonas] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lista) return;
    setPersonas(null);
    setError('');
    lista.cargar().then(setPersonas).catch((e) => setError(e.message));
  }, [lista]);

  if (!lista) return null;
  return (
    <Modal id="modal-lista" alCerrar={cerrarLista}>
      <div className="modal-caja modal-lista">
        <header className="modal-encabezado centrado">
          <h2>{lista.titulo}</h2>
          <button className="btn-icono" onClick={cerrarLista} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
        </header>
        <div className="lista-personas" onClick={(e) => { if (e.target.closest('.info')) cerrarLista(); }}>
          {error && <p className="vacio">{error}</p>}
          {!error && !personas && <div className="cargando-mas activo" />}
          {personas?.length === 0 && <p className="vacio">Todavía no hay nadie aquí.</p>}
          {personas?.map((p) => <FilaPersona key={p.id} persona={p} />)}
        </div>
      </div>
    </Modal>
  );
}
