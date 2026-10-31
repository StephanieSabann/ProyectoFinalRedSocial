/**
 * Todo lo que muestra una publicación: carrusel, acciones, encabezado,
 * tarjeta del feed y celda de la cuadrícula (miniatura).
 */
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icono from '../utilidades/Icono';
import { TextoConEtiquetas, formatearNumero, plural, tiempoCorto } from '../utilidades/formato';
import { Avatar } from './Basicos';
import { useSesion } from '../contexto/Sesion';
import { useInterfaz } from '../contexto/Interfaz';
import { guardarPublicacion, leerPublicacion, quitarPublicacion, usePublicacion } from '../almacen';
import { api } from '../api';

// ----------------------------------------------------------------
//  Acciones sobre publicaciones (compartidas por feed, cuadrícula y detalle)
// ----------------------------------------------------------------
export function useAcciones() {
  const { siguiendo, marcarSiguiendo, usuario } = useSesion();
  const { mostrarMensaje, confirmar, hojaOpciones, abrirPublicacion, cerrarPublicacion, refrescar } = useInterfaz();
  const navegar = useNavigate();

  /** Me gusta: se pinta al instante y luego se confirma con la API. */
  const alternarLike = useCallback(async (id, soloDar = false) => {
    const pub = leerPublicacion(id);
    if (!pub || (soloDar && pub.meGusta)) return;
    guardarPublicacion({ id, meGusta: !pub.meGusta, likes: pub.likes + (pub.meGusta ? -1 : 1) });
    try {
      const datos = await api(`/publicaciones/${id}/like`, { method: 'PUT' });
      guardarPublicacion({ id, meGusta: datos.meGusta, likes: datos.likes });
    } catch (error) {
      guardarPublicacion({ id, meGusta: pub.meGusta, likes: pub.likes });
      mostrarMensaje(error.message, 'error');
    }
  }, [mostrarMensaje]);

  const alternarGuardado = useCallback(async (id) => {
    const pub = leerPublicacion(id);
    guardarPublicacion({ id, guardada: !pub.guardada });
    try {
      const datos = await api(`/publicaciones/${id}/guardar`, { method: 'PUT' });
      guardarPublicacion({ id, guardada: datos.guardada });
      mostrarMensaje(datos.mensaje);
    } catch (error) {
      guardarPublicacion({ id, guardada: pub.guardada });
      mostrarMensaje(error.message, 'error');
    }
  }, [mostrarMensaje]);

  const copiarEnlace = useCallback((id) => {
    const enlace = `${location.origin}${location.pathname}#/p/${id}`;
    navigator.clipboard?.writeText(enlace).then(() => mostrarMensaje('Enlace copiado'), () => mostrarMensaje(enlace));
  }, [mostrarMensaje]);

  const borrar = useCallback(async (id) => {
    const ok = await confirmar({ titulo: '¿Eliminar publicación?', texto: 'También se borrarán sus fotos, transformaciones y comentarios.' });
    if (!ok) return;
    try {
      const datos = await api(`/publicaciones/${id}`, { method: 'DELETE' });
      cerrarPublicacion();
      quitarPublicacion(id);
      mostrarMensaje(datos.mensaje);
      refrescar('feed', 'perfil');
    } catch (error) {
      mostrarMensaje(error.message, 'error');
    }
  }, [confirmar, cerrarPublicacion, mostrarMensaje, refrescar]);

  /** Menú "⋯" */
  const menu = useCallback((pub, { enDetalle = false, alEditar } = {}) => {
    const autor = pub.usuario;
    const mia = autor?.id === usuario.id;
    const opciones = [];
    if (mia) {
      opciones.push({ texto: 'Eliminar', clase: 'peligro', accion: () => borrar(pub.id) });
      opciones.push({ texto: 'Editar', accion: () => (enDetalle && alEditar ? alEditar() : abrirPublicacion(pub.id, { editar: true })) });
    } else if (siguiendo.has(autor.id)) {
      opciones.push({
        texto: 'Dejar de seguir', clase: 'peligro',
        accion: async () => {
          if (!(await confirmar({ persona: autor, titulo: `¿Dejar de seguir a @${autor.username}?`, boton: 'Dejar de seguir' }))) return;
          try {
            await api(`/seguidores/${autor.id}`, { method: 'DELETE' });
            marcarSiguiendo(autor.id, false);
            mostrarMensaje(`Dejaste de seguir a ${autor.username}`);
          } catch (e) { mostrarMensaje(e.message, 'error'); }
        }
      });
    }
    opciones.push({ texto: leerPublicacion(pub.id)?.guardada ? 'Quitar de guardados' : 'Guardar', accion: () => alternarGuardado(pub.id) });
    if (!enDetalle) opciones.push({ texto: 'Ir a la publicación', accion: () => abrirPublicacion(pub.id) });
    opciones.push({ texto: 'Copiar enlace', accion: () => copiarEnlace(pub.id) });
    opciones.push({ texto: 'Ver perfil', accion: () => { cerrarPublicacion(); navegar(`/perfil/${autor.id}`); } });
    hojaOpciones({ opciones });
  }, [usuario, siguiendo, borrar, abrirPublicacion, confirmar, marcarSiguiendo, mostrarMensaje, alternarGuardado, copiarEnlace, cerrarPublicacion, navegar, hojaOpciones]);

  return { alternarLike, alternarGuardado, copiarEnlace, borrar, menu };
}

// ----------------------------------------------------------------
//  Carrusel de fotos (flechas, puntos, deslizar y doble toque)
// ----------------------------------------------------------------
export function Carrusel({ diapositivas, cuadrado = false, ajustar = false, alDobleToque, indice: indiceControlado, alCambiar }) {
  const [indicePropio, setIndicePropio] = useState(0);
  const indice = indiceControlado ?? indicePropio;
  const total = diapositivas.length;
  const ir = (n) => {
    const nuevo = Math.max(0, Math.min(total - 1, n));
    setIndicePropio(nuevo);
    alCambiar?.(nuevo);
  };
  const [corazon, setCorazon] = useState(0);
  const ultimoToque = useRef(0);
  const inicioX = useRef(null);

  const clic = (e) => {
    if (!alDobleToque || e.target.closest('.carrusel-flecha, .boton-sensible')) return;
    const ahora = Date.now();
    if (ahora - ultimoToque.current < 300) {
      setCorazon((c) => c + 1);
      alDobleToque();
      ultimoToque.current = 0;
    } else {
      ultimoToque.current = ahora;
    }
  };

  return (
    <div
      className={`carrusel ${cuadrado ? 'cuadrado' : ''} ${ajustar ? 'ajustar' : ''}`.trim()}
      onClick={clic}
      onTouchStart={(e) => { inicioX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (inicioX.current === null) return;
        const dx = e.changedTouches[0].clientX - inicioX.current;
        if (Math.abs(dx) > 40) ir(indice + (dx < 0 ? 1 : -1));
        inicioX.current = null;
      }}
    >
      <div className="carrusel-pista" style={{ transform: `translateX(-${indice * 100}%)` }}>
        {diapositivas.map((d, i) => <div className="carrusel-diapositiva" key={i}>{d}</div>)}
      </div>
      {total > 1 && (
        <>
          {indice > 0 && (
            <button className="carrusel-flecha izq" aria-label="Foto anterior" onClick={(e) => { e.stopPropagation(); ir(indice - 1); }}>
              <Icono nombre="atras" />
            </button>
          )}
          {indice < total - 1 && (
            <button className="carrusel-flecha der" aria-label="Foto siguiente" onClick={(e) => { e.stopPropagation(); ir(indice + 1); }}>
              <Icono nombre="adelante" />
            </button>
          )}
          <div className="carrusel-puntos">{diapositivas.map((_, i) => <span key={i} className={i === indice ? 'activo' : ''} />)}</div>
          <span className="carrusel-indice">{indice + 1}/{total}</span>
        </>
      )}
      {alDobleToque && (
        <div key={corazon} className={`corazon-grande ${corazon ? 'animar' : ''}`}><Icono nombre="corazon" relleno /></div>
      )}
    </div>
  );
}

/** Foto del feed: fondo con su color dominante mientras carga, y borrosa si Rekognition la marcó. */
export function FotoFeed({ imagen }) {
  const [mostrar, setMostrar] = useState(!imagen.sensible);
  return (
    <div className="foto-feed" style={{ backgroundColor: imagen.color }}>
      <img
        src={imagen.urls.mediana}
        alt={imagen.etiquetas?.length ? imagen.etiquetas.map((e) => e.nombre).join(', ') : 'Foto de la publicación'}
        loading="lazy"
        decoding="async"
        draggable={false}
        className={mostrar ? '' : 'borrosa'}
      />
      {!mostrar && <ContenidoSensible alVer={() => setMostrar(true)} />}
    </div>
  );
}

export function ContenidoSensible({ alVer }) {
  return (
    <div className="capa-sensible">
      <Icono nombre="ojo" />
      <strong>Contenido sensible</strong>
      <span>Amazon Rekognition marcó esta foto como posiblemente inapropiada.</span>
      <button className="boton-sensible" onClick={(e) => { e.stopPropagation(); alVer(); }}>Ver foto</button>
    </div>
  );
}

// ----------------------------------------------------------------
//  Acciones, contador de likes y encabezado
// ----------------------------------------------------------------
export function Acciones({ id, alComentar }) {
  const pub = usePublicacion(id);
  const { alternarLike, alternarGuardado, copiarEnlace } = useAcciones();
  return (
    <div className="post-acciones">
      <button className={`btn-icono btn-like ${pub.meGusta ? 'activo' : ''}`} aria-label={pub.meGusta ? 'Ya no me gusta' : 'Me gusta'} onClick={() => alternarLike(id)}>
        <Icono nombre="corazon" relleno={pub.meGusta} />
      </button>
      <button className="btn-icono" aria-label="Comentar" onClick={alComentar}><Icono nombre="comentario" /></button>
      <button className="btn-icono" aria-label="Copiar enlace" onClick={() => copiarEnlace(id)}><Icono nombre="enviar" /></button>
      <span className="espacio" />
      <button className={`btn-icono btn-guardar ${pub.guardada ? 'activo' : ''}`} aria-label={pub.guardada ? 'Quitar de guardados' : 'Guardar'} onClick={() => alternarGuardado(id)}>
        <Icono nombre="guardar" relleno={pub.guardada} />
      </button>
    </div>
  );
}

export function ContadorLikes({ id }) {
  const pub = usePublicacion(id);
  const { abrirLista } = useInterfaz();
  if (!pub.likes) return null;
  return (
    <button className="post-likes" onClick={() => abrirLista('Me gusta', async () => (await api(`/publicaciones/${id}/likes`)).usuarios)}>
      {plural(pub.likes, 'Me gusta', 'Me gusta')}
    </button>
  );
}

export function EncabezadoPublicacion({ id, enDetalle = false, alEditar }) {
  const pub = usePublicacion(id);
  const { usuario, siguiendo, marcarSiguiendo } = useSesion();
  const { mostrarMensaje, cerrarPublicacion } = useInterfaz();
  const { menu } = useAcciones();
  const navegar = useNavigate();
  const autor = pub.usuario;
  const puedoSeguir = autor.id !== usuario.id && !siguiendo.has(autor.id);

  const seguir = async () => {
    try {
      await api('/seguidores', { method: 'POST', json: { seguido: autor.id } });
      marcarSiguiendo(autor.id, true);
      mostrarMensaje(`Ahora sigues a ${autor.username}`);
    } catch (e) { mostrarMensaje(e.message, 'error'); }
  };

  return (
    <header className="post-encabezado">
      <Avatar persona={autor} />
      <div className="post-autor">
        <div className="linea">
          <strong onClick={() => { cerrarPublicacion(); navegar(`/perfil/${autor.id}`); }}>{autor.username}</strong>
          {!enDetalle && <><span className="punto">•</span><time title={new Date(pub.fecha).toLocaleString('es')}>{tiempoCorto(pub.fecha)}</time></>}
          {puedoSeguir && <><span className="punto">•</span><button className="seguir-inline" onClick={seguir}>Seguir</button></>}
        </div>
        {pub.ubicacion && <span className="ubicacion">{pub.ubicacion}</span>}
      </div>
      <button className="btn-icono" aria-label="Más opciones" onClick={() => menu(leerPublicacion(id), { enDetalle, alEditar })}>
        <Icono nombre="opciones" />
      </button>
    </header>
  );
}

/** Busca un usuario por @username y abre su perfil. */
export function useAbrirMencion() {
  const navegar = useNavigate();
  const { mostrarMensaje, cerrarPublicacion } = useInterfaz();
  return useCallback(async (username) => {
    try {
      const lista = await api(`/usuarios?buscar=${encodeURIComponent(username)}`);
      const persona = lista.find((u) => u.username.toLowerCase() === username.toLowerCase());
      if (!persona) return mostrarMensaje(`No existe el usuario @${username}`, 'error');
      cerrarPublicacion();
      navegar(`/perfil/${persona.id}`);
    } catch (e) { mostrarMensaje(e.message, 'error'); }
  }, [navegar, mostrarMensaje, cerrarPublicacion]);
}

// ----------------------------------------------------------------
//  Tarjeta del feed
// ----------------------------------------------------------------
export function TarjetaPublicacion({ id }) {
  const pub = usePublicacion(id);
  const { usuario, } = useSesion();
  const { mostrarMensaje, abrirPublicacion } = useInterfaz();
  const { alternarLike } = useAcciones();
  const abrirMencion = useAbrirMencion();
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [misComentarios, setMisComentarios] = useState([]);
  const [verMas, setVerMas] = useState(false);
  const entrada = useRef(null);

  if (!pub) return null;

  const descripcion = pub.descripcion || '';
  const larga = descripcion.length > 125 || descripcion.split('\n').length > 2;
  const corta = descripcion.split('\n').slice(0, 2).join('\n').slice(0, 125);

  const comentar = async (e) => {
    e.preventDefault();
    const valor = texto.trim();
    if (!valor) return;
    setEnviando(true);
    try {
      await api(`/publicaciones/${id}/comentarios`, { method: 'POST', json: { comentario: valor } });
      setMisComentarios((c) => [...c, valor]);
      setTexto('');
      guardarPublicacion({ id, totalComentarios: (leerPublicacion(id).totalComentarios || 0) + 1 });
    } catch (error) {
      mostrarMensaje(error.message, 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <article className="post">
      <EncabezadoPublicacion id={id} />
      <Carrusel
        diapositivas={pub.imagenes.map((img) => <FotoFeed key={img.id} imagen={img} />)}
        alDobleToque={() => alternarLike(id, true)}
      />
      <div className="post-cuerpo">
        <Acciones id={id} alComentar={() => entrada.current?.focus()} />
        <ContadorLikes id={id} />
        {descripcion && (
          <div className="post-descripcion">
            <strong onClick={() => navegar(`/perfil/${pub.usuario.id}`)}>{pub.usuario.username}</strong>
            <TextoConEtiquetas texto={larga && !verMas ? corta : descripcion} alMencion={abrirMencion} />
            {larga && !verMas && <button className="mas-texto" onClick={() => setVerMas(true)}>... más</button>}
          </div>
        )}
        {pub.totalComentarios > 0 && (
          <button className="post-ver-comentarios" onClick={() => abrirPublicacion(id)}>
            {pub.totalComentarios === 1 ? 'Ver 1 comentario' : `Ver los ${formatearNumero(pub.totalComentarios)} comentarios`}
          </button>
        )}
        <div className="post-mis-comentarios">
          {misComentarios.map((c, i) => <p key={i}><strong>{usuario.username}</strong><TextoConEtiquetas texto={c} /></p>)}
        </div>
        <form className="form-comentar" onSubmit={comentar}>
          <input
            ref={entrada}
            type="text"
            value={texto}
            maxLength={500}
            placeholder="Agrega un comentario..."
            aria-label="Agrega un comentario"
            disabled={enviando}
            onChange={(e) => setTexto(e.target.value)}
          />
          <button type="submit" disabled={!texto.trim() || enviando}>Publicar</button>
        </form>
      </div>
    </article>
  );
}

// ----------------------------------------------------------------
//  Celda de cuadrícula: MINIATURA de 320x320 generada con Sharp
// ----------------------------------------------------------------
export function Celda({ id, alta = false }) {
  const pub = usePublicacion(id);
  const { abrirPublicacion } = useInterfaz();
  if (!pub) return null;
  const primera = pub.imagenes[0];
  return (
    <div
      className={`celda ${alta ? 'alta' : ''}`.trim()}
      style={{ backgroundColor: primera.color }}
      tabIndex={0}
      role="button"
      aria-label={`Publicación de ${pub.usuario.username}`}
      onClick={() => abrirPublicacion(id)}
      onKeyDown={(e) => { if (e.key === 'Enter') abrirPublicacion(id); }}
    >
      <img
        src={alta ? primera.urls.mediana : primera.urls.miniatura}
        alt={pub.descripcion ? pub.descripcion.slice(0, 80) : `Publicación de ${pub.usuario.username}`}
        loading="lazy"
        decoding="async"
        width="320"
        height="320"
        className={primera.sensible ? 'borrosa' : ''}
      />
      {pub.imagenes.length > 1 && <span className="icono-multiple"><Icono nombre="multiple" /></span>}
      <div className="capa">
        <span><Icono nombre="corazon" relleno />{formatearNumero(pub.likes)}</span>
        <span><Icono nombre="comentario" relleno />{formatearNumero(pub.totalComentarios)}</span>
      </div>
    </div>
  );
}
