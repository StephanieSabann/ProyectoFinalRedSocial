/**
 * Detalle de una publicación.
 *
 * Muestra la foto en RESOLUCIÓN COMPLETA con pestañas para ver sus 3 transformaciones
 * automáticas (blanco y negro, sepia y reducción al 50 %), los rostros que detectó
 * face-api.js, las etiquetas de Amazon Rekognition (si está activo) y los comentarios.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icono from '../utilidades/Icono';
import { TextoConEtiquetas, tiempoCorto, tiempoLargo } from '../utilidades/formato';
import { Avatar, Modal } from './Basicos';
import { Acciones, Carrusel, ContadorLikes, ContenidoSensible, EncabezadoPublicacion, useAbrirMencion, useAcciones } from './Publicacion';
import { useSesion } from '../contexto/Sesion';
import { useInterfaz } from '../contexto/Interfaz';
import { guardarPublicacion, leerPublicacion, usePublicacion } from '../almacen';
import { api } from '../api';

const VERSIONES = [
  { clave: 'original', nombre: 'Original' },
  { clave: 'bn', nombre: 'Blanco y negro' },
  { clave: 'sepia', nombre: 'Sepia' },
  { clave: 'escala', nombre: 'Escala 50 %' }
];

const urlDe = (img, version) => (version === 'original' ? img.urls.original : img.transformaciones[version]);

/** Una foto a resolución completa con los recuadros de rostros encima. */
function FotoCompleta({ imagen, version, verRostros }) {
  const [mostrar, setMostrar] = useState(!imagen.sensible);
  const [cargada, setCargada] = useState(false);
  const url = urlDe(imagen, version);
  useEffect(() => setCargada(false), [url]);

  return (
    <div className="foto-completa">
      {/* El marco tiene la proporción exacta de la foto, así los recuadros de rostros coinciden.
          La versión "escala" se muestra a su tamaño real (la mitad) para que se note la reducción. */}
      <div
        className="marco-foto"
        style={{
          '--r': imagen.ancho / imagen.alto,
          '--max-ancho': version === 'escala' ? `${Math.round(imagen.ancho / 2)}px` : '100000px',
          backgroundColor: cargada ? 'transparent' : imagen.color
        }}
      >
        <img
          src={url}
          alt={`Foto (${VERSIONES.find((v) => v.clave === version).nombre})`}
          className={mostrar ? '' : 'borrosa'}
          onLoad={() => setCargada(true)}
          draggable={false}
        />
        {verRostros && mostrar && imagen.rostros.map((r, i) => (
          <span
            key={i}
            className="caja-rostro"
            style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
            title={`Rostro ${i + 1} · confianza ${Math.round(r.puntaje * 100)} %${r.expresion ? ` · ${r.expresion}` : ''}`}
          />
        ))}
        {!mostrar && <ContenidoSensible alVer={() => setMostrar(true)} />}
      </div>
    </div>
  );
}

function Comentario({ comentario, eliminable, alEliminar, alMencion }) {
  const navegar = useNavigate();
  const { cerrarPublicacion } = useInterfaz();
  const autor = comentario.usuario || { username: 'usuario_eliminado' };
  return (
    <div className="comentario">
      <Avatar persona={autor} />
      <div className="cuerpo">
        <p>
          <strong onClick={() => { if (autor.id) { cerrarPublicacion(); navegar(`/perfil/${autor.id}`); } }}>{autor.username}</strong>
          <TextoConEtiquetas texto={comentario.comentario} alMencion={alMencion} />
        </p>
        <div className="meta">
          <time>{tiempoCorto(comentario.fecha)}</time>
          {eliminable && <button onClick={alEliminar}>Eliminar</button>}
        </div>
      </div>
    </div>
  );
}

function Detalle({ id, empezarEditando }) {
  const pub = usePublicacion(id);
  const { usuario } = useSesion();
  const { mostrarMensaje, confirmar } = useInterfaz();
  const { alternarLike } = useAcciones();
  const abrirMencion = useAbrirMencion();
  const [comentarios, setComentarios] = useState([]);
  const [indice, setIndice] = useState(0);
  const [version, setVersion] = useState('original');
  const [verRostros, setVerRostros] = useState(true);
  const [editando, setEditando] = useState(empezarEditando);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef(null);
  const lista = useRef(null);
  const [edicion, setEdicion] = useState({ descripcion: pub.descripcion, ubicacion: pub.ubicacion });

  useEffect(() => {
    api(`/publicaciones/${id}/comentarios`).then(setComentarios).catch(() => {});
  }, [id]);

  const mia = pub.usuario.id === usuario.id;
  const imagen = pub.imagenes[indice];

  const comentar = async (e) => {
    e.preventDefault();
    const valor = texto.trim();
    if (!valor) return;
    setEnviando(true);
    try {
      const datos = await api(`/publicaciones/${id}/comentarios`, { method: 'POST', json: { comentario: valor } });
      setComentarios((c) => [...c, datos.comentario]);
      guardarPublicacion({ id, totalComentarios: (leerPublicacion(id).totalComentarios || 0) + 1 });
      setTexto('');
      setTimeout(() => { if (lista.current) lista.current.scrollTop = lista.current.scrollHeight; }, 50);
    } catch (error) {
      mostrarMensaje(error.message, 'error');
    } finally {
      setEnviando(false);
    }
  };

  const eliminarComentario = async (c) => {
    if (!(await confirmar({ titulo: '¿Eliminar comentario?' }))) return;
    try {
      await api(`/comentarios/${c.id}`, { method: 'DELETE' });
      setComentarios((lista) => lista.filter((x) => x.id !== c.id));
      guardarPublicacion({ id, totalComentarios: Math.max(0, (leerPublicacion(id).totalComentarios || 1) - 1) });
      mostrarMensaje('Comentario eliminado');
    } catch (error) {
      mostrarMensaje(error.message, 'error');
    }
  };

  const guardarEdicion = async () => {
    try {
      const datos = await api(`/publicaciones/${id}`, { method: 'PUT', json: edicion });
      guardarPublicacion(datos.publicacion);
      setEditando(false);
      mostrarMensaje(datos.mensaje);
    } catch (error) {
      mostrarMensaje(error.message, 'error');
    }
  };

  const descargar = () => window.open(urlDe(imagen, version), '_blank', 'noopener');

  return (
    <div className="detalle">
      <div className="detalle-media">
        <Carrusel
          ajustar
          indice={indice}
          alCambiar={(n) => setIndice(n)}
          alDobleToque={() => alternarLike(id, true)}
          diapositivas={pub.imagenes.map((img) => (
            <FotoCompleta key={img.id} imagen={img} version={version} verRostros={verRostros} />
          ))}
        />
        {/* Pestañas: original + 3 transformaciones automáticas */}
        <div className="barra-versiones" role="tablist" aria-label="Versiones de la foto">
          {VERSIONES.map((v) => (
            <button
              key={v.clave}
              role="tab"
              aria-selected={version === v.clave}
              className={version === v.clave ? 'activa' : ''}
              onClick={() => setVersion(v.clave)}
            >
              {v.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="detalle-lado">
        <EncabezadoPublicacion id={id} enDetalle alEditar={() => setEditando(true)} />

        {/* Información de la foto: resolución, rostros y etiquetas */}
        <div className="detalle-info">
          <span title="Resolución de la versión mostrada">
            {version === 'escala' ? `${Math.round(imagen.ancho / 2)} × ${Math.round(imagen.alto / 2)}` : `${imagen.ancho} × ${imagen.alto}`} px
          </span>
          <button
            className={`chip ${verRostros && imagen.rostros.length ? 'activo' : ''}`}
            onClick={() => setVerRostros((v) => !v)}
            title="Rostros detectados con face-api.js al subir la foto"
          >
            <Icono nombre="rostro" />
            {imagen.rostros.length === 0 ? 'Sin rostros' : `${imagen.rostros.length} rostro${imagen.rostros.length === 1 ? '' : 's'}`}
          </button>
          {imagen.etiquetas.map((e) => (
            <span key={e.nombre} className="chip" title={`Amazon Rekognition · ${e.confianza} %`}>
              <Icono nombre="etiqueta" />{e.nombre}
            </span>
          ))}
          <button className="chip" onClick={descargar} title="Abrir esta versión en tamaño completo">
            <Icono nombre="descargar" />Abrir
          </button>
        </div>

        <div className="detalle-comentarios" ref={lista}>
          {editando ? (
            <div className="detalle-editar">
              <textarea rows={6} maxLength={2200} value={edicion.descripcion} placeholder="Escribe una descripción..."
                onChange={(e) => setEdicion({ ...edicion, descripcion: e.target.value })} autoFocus />
              <input maxLength={100} value={edicion.ubicacion} placeholder="Agregar ubicación"
                onChange={(e) => setEdicion({ ...edicion, ubicacion: e.target.value })} />
              <div className="botones">
                <button className="btn btn-gris" onClick={() => setEditando(false)}>Cancelar</button>
                <button className="btn btn-primario" onClick={guardarEdicion}>Listo</button>
              </div>
            </div>
          ) : (
            <>
              {pub.descripcion && (
                <Comentario comentario={{ usuario: pub.usuario, comentario: pub.descripcion, fecha: pub.fecha }} alMencion={abrirMencion} />
              )}
              {comentarios.map((c) => (
                <Comentario
                  key={c.id}
                  comentario={c}
                  alMencion={abrirMencion}
                  eliminable={c.usuario?.id === usuario.id || mia}
                  alEliminar={() => eliminarComentario(c)}
                />
              ))}
              {!pub.descripcion && comentarios.length === 0 && (
                <div className="feed-vacio"><h3>Aún no hay comentarios.</h3><p>Inicia la conversación.</p></div>
              )}
            </>
          )}
        </div>

        <div className="detalle-pie">
          <Acciones id={id} alComentar={() => entrada.current?.focus()} />
          <ContadorLikes id={id} />
          <time title={new Date(pub.fecha).toLocaleString('es')}>{tiempoLargo(pub.fecha)}</time>
        </div>

        <form className="form-comentar" onSubmit={comentar}>
          <input ref={entrada} type="text" value={texto} maxLength={500} placeholder="Agrega un comentario..."
            disabled={enviando} onChange={(e) => setTexto(e.target.value)} />
          <button type="submit" disabled={!texto.trim() || enviando}>Publicar</button>
        </form>
      </div>
    </div>
  );
}

export default function ModalPublicacion() {
  const { publicacion, cerrarPublicacion, mostrarMensaje } = useInterfaz();
  const [lista, setLista] = useState(false);

  // Siempre se pide la versión más reciente al servidor
  useEffect(() => {
    if (!publicacion) return;
    setLista(false);
    api(`/publicaciones/${publicacion.id}`)
      .then((p) => { guardarPublicacion(p); setLista(true); })
      .catch((e) => {
        cerrarPublicacion();
        mostrarMensaje(e.message === 'Publicación no encontrada' ? 'Esta publicación ya no está disponible' : e.message, 'error');
      });
  }, [publicacion, cerrarPublicacion, mostrarMensaje]);

  if (!publicacion) return null;
  return (
    <Modal id="modal-publicacion" oscuro botonFuera alCerrar={cerrarPublicacion}>
      {lista
        ? <Detalle key={publicacion.id} id={publicacion.id} empezarEditando={Boolean(publicacion.editar)} />
        : <div className="detalle"><div className="cargando-mas activo" style={{ margin: 'auto' }} /></div>}
    </Modal>
  );
}
