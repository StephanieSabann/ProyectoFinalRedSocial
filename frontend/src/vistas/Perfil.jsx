/**
 * Perfil: cabecera (foto, contadores, presentación) y cuadrícula de MINIATURAS.
 * En el perfil propio aparece la pestaña "Guardados".
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icono from '../utilidades/Icono';
import { TextoConEtiquetas, formatearNumero } from '../utilidades/formato';
import { BotonSeguir } from '../componentes/Basicos';
import { Celda, useAbrirMencion } from '../componentes/Publicacion';
import { useSubirHistoria } from '../componentes/BarraHistorias';
import { useSesion } from '../contexto/Sesion';
import { useInterfaz } from '../contexto/Interfaz';
import { guardarPublicacion } from '../almacen';
import { api } from '../api';
import { CONFIG } from '../config';

function Vacio({ propio, guardados }) {
  const { abrirCrear } = useInterfaz();
  if (guardados) {
    return (
      <div className="perfil-vacio">
        <div className="circulo"><Icono nombre="guardar" /></div>
        <h3>Guardar</h3>
        <p>Guarda fotos que quieras volver a ver. Nadie recibe una notificación y solo tú puedes ver lo que guardaste.</p>
      </div>
    );
  }
  return (
    <div className="perfil-vacio">
      <div className="circulo"><Icono nombre="camara" /></div>
      <h3>{propio ? 'Compartir fotos' : 'Aún no hay publicaciones'}</h3>
      {propio && <><p>Cuando compartas fotos, aparecerán en tu perfil.</p><button className="link-azul" onClick={abrirCrear}>Comparte tu primera foto</button></>}
    </div>
  );
}

export default function Perfil({ guardados = false }) {
  const { id: parametro } = useParams();
  const id = Number(parametro);
  const { usuario, actualizarUsuario } = useSesion();
  const { refrescos, refrescar, abrirLista, abrirEditarPerfil, abrirVisor, mostrarMensaje } = useInterfaz();
  const abrirMencion = useAbrirMencion();
  const { abrirSelector, entrada } = useSubirHistoria();
  const [datos, setDatos] = useState(null);
  const [ids, setIds] = useState(null);
  const propio = id === usuario.id;
  const verGuardados = guardados && propio;

  useEffect(() => {
    let vigente = true;
    setIds(null);
    Promise.all([
      api(`/usuarios/${id}`),
      api(`/usuarios/${id}/contadores`),
      api(`/usuarios/${id}/historias`),
      verGuardados ? api('/guardados') : api(`/usuarios/${id}/publicaciones`)
    ]).then(([persona, contadores, historias, publicaciones]) => {
      if (!vigente) return;
      publicaciones.forEach(guardarPublicacion);
      setDatos({ persona: { ...persona, meSigue: contadores.meSigue }, contadores, historias });
      setIds(publicaciones.map((p) => p.id));
      document.title = `${persona.nombre} (@${persona.username}) • ${CONFIG.nombreApp}`;
      if (propio) actualizarUsuario(persona);
    }).catch((e) => mostrarMensaje(e.message, 'error'));
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, verGuardados, refrescos.perfil, refrescos.historias]);

  if (!datos) return <section id="vista-perfil" className="vista"><div className="cargando-mas activo" /></section>;
  const { persona, contadores, historias } = datos;
  const todasVistas = historias.every((h) => h.vista);
  const sitio = persona.sitioWeb && (/^https?:\/\//i.test(persona.sitioWeb) ? persona.sitioWeb : `https://${persona.sitioWeb}`);

  const foto = (
    <span className="avatar avatar-grande" onClick={historias.length || !propio ? undefined : abrirEditarPerfil}>
      {persona.imagen ? <img src={persona.imagen} alt={`Foto de perfil de ${persona.username}`} /> : <Icono nombre="usuario" relleno />}
    </span>
  );

  return (
    <section id="vista-perfil" className="vista">
      {entrada}
      <header className="perfil-cabecera">
        <div className="perfil-foto">
          {historias.length > 0
            ? <span className={`anillo ${todasVistas ? 'visto' : ''}`} title="Ver historia" onClick={() => abrirVisor([{ usuario: persona, historias, todasVistas }], 0)}>{foto}</span>
            : foto}
        </div>
        <section className="perfil-info">
          <div className="perfil-fila-1">
            <h2>{persona.username}</h2>
            {propio ? (
              <>
                <button className="btn btn-gris" onClick={abrirEditarPerfil}>Editar perfil</button>
                <button className="btn btn-gris" onClick={abrirSelector}>Agregar historia</button>
              </>
            ) : <BotonSeguir persona={persona} alCambiar={() => refrescar('perfil', 'feed', 'historias')} />}
          </div>
          <div className="perfil-numeros">
            <button style={{ cursor: 'default' }}><strong>{formatearNumero(contadores.publicaciones)}</strong> {contadores.publicaciones === 1 ? 'publicación' : 'publicaciones'}</button>
            <button onClick={() => abrirLista('Seguidores', async () => (await api(`/usuarios/${id}/seguidores`)).seguidores)}>
              <strong>{formatearNumero(contadores.seguidores)}</strong> {contadores.seguidores === 1 ? 'seguidor' : 'seguidores'}
            </button>
            <button onClick={() => abrirLista('Seguidos', async () => (await api(`/usuarios/${id}/siguiendo`)).siguiendo)}>
              <strong>{formatearNumero(contadores.siguiendo)}</strong> seguidos
            </button>
          </div>
          <div className="perfil-bio">
            <strong>{persona.nombre}</strong>
            {persona.biografia && <p><TextoConEtiquetas texto={persona.biografia} alMencion={abrirMencion} /></p>}
            {sitio && <a href={sitio} target="_blank" rel="noopener noreferrer">{persona.sitioWeb.replace(/^https?:\/\//i, '').replace(/\/$/, '')}</a>}
            {!propio && contadores.meSigue && <p className="mutuo">Te sigue</p>}
          </div>
        </section>
      </header>

      <nav className="perfil-pestanas">
        <Link to={`/perfil/${id}`} className={!verGuardados ? 'activa' : ''}><Icono nombre="cuadricula" />Publicaciones</Link>
        {propio && <Link to={`/perfil/${id}/guardados`} className={verGuardados ? 'activa' : ''}><Icono nombre="guardar" />Guardados</Link>}
      </nav>

      <div className="cuadricula">
        {ids === null && <div className="cargando-mas activo" style={{ gridColumn: '1 / -1' }} />}
        {ids?.length === 0 && <Vacio propio={propio} guardados={verGuardados} />}
        {ids?.map((pid) => <Celda key={pid} id={pid} />)}
      </div>
    </section>
  );
}
