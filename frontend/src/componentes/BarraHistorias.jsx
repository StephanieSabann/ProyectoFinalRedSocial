/**
 * Barra de historias del inicio: "Tu historia" + historias de quienes sigo.
 * Anillo de color = hay historias sin ver; gris = ya vistas.
 */
import { useRef } from 'react';
import Icono from '../utilidades/Icono';
import { useSesion } from '../contexto/Sesion';
import { useInterfaz } from '../contexto/Interfaz';
import { useHistorias } from '../almacen';
import { api } from '../api';

function FotoAvatar({ persona }) {
  return (
    <span className="avatar avatar-historia">
      {persona.imagen ? <img src={persona.imagen} alt="" /> : <Icono nombre="usuario" relleno />}
    </span>
  );
}

/** Hook para subir una historia (POST /api/historias, campo file0). */
export function useSubirHistoria() {
  const { mostrarMensaje, refrescar } = useInterfaz();
  const selector = useRef(null);
  const subir = async (archivo) => {
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) return mostrarMensaje('Solo se permiten imágenes', 'error');
    if (archivo.size > 8 * 1024 * 1024) return mostrarMensaje('La foto no puede pesar más de 8 MB', 'error');
    const formulario = new FormData();
    formulario.append('file0', archivo);
    mostrarMensaje('Subiendo tu historia...');
    try {
      const datos = await api('/historias', { method: 'POST', body: formulario });
      mostrarMensaje(datos.mensaje);
      refrescar('historias', 'perfil');
    } catch (e) {
      mostrarMensaje(e.message, 'error');
    }
  };
  const entrada = <input ref={selector} type="file" accept="image/*" hidden onChange={(e) => { subir(e.target.files[0]); e.target.value = ''; }} />;
  return { abrirSelector: () => selector.current?.click(), entrada };
}

export default function BarraHistorias() {
  const { usuario } = useSesion();
  const { abrirVisor } = useInterfaz();
  const historias = useHistorias();
  const { abrirSelector, entrada } = useSubirHistoria();
  const mia = historias.find((gr) => gr.usuario.id === usuario.id);

  return (
    <div className="historias" aria-label="Historias">
      {entrada}
      <div className="historia-item" onClick={() => (mia ? abrirVisor(historias, historias.indexOf(mia)) : abrirSelector())}>
        <span className={mia ? `anillo ${mia.todasVistas ? 'visto' : ''}` : 'anillo-vacio'}>
          <FotoAvatar persona={usuario} />
          <span className="mas" title="Agregar a tu historia" onClick={(e) => { e.stopPropagation(); abrirSelector(); }}>+</span>
        </span>
        <span className="nombre">Tu historia</span>
      </div>
      {historias.map((grupo, indice) => grupo.usuario.id !== usuario.id && (
        <div className="historia-item" key={grupo.usuario.id} onClick={() => abrirVisor(historias, indice)}>
          <span className={`anillo ${grupo.todasVistas ? 'visto' : ''}`.trim()}><FotoAvatar persona={grupo.usuario} /></span>
          <span className="nombre">{grupo.usuario.username}</span>
        </div>
      ))}
    </div>
  );
}
