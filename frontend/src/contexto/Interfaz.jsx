/**
 * Contexto de interfaz: avisos (toast), hoja de opciones, confirmaciones,
 * ventanas (detalle, crear, editar perfil, listas, visor de historias), paneles
 * y "refrescos" para recargar vistas después de un cambio.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const Contexto = createContext(null);
export const useInterfaz = () => useContext(Contexto);

export function ProveedorInterfaz({ children }) {
  const [toast, setToast] = useState(null);
  const [hoja, setHoja] = useState(null);
  const [publicacion, setPublicacion] = useState(null);   // { id, editar }
  const [lista, setLista] = useState(null);               // { titulo, cargar }
  const [crear, setCrear] = useState(false);
  const [editarPerfil, setEditarPerfil] = useState(false);
  const [visor, setVisor] = useState(null);               // { grupos, indice }
  const [panel, setPanel] = useState(null);               // 'buscar' | 'notificaciones' | null
  const [refrescos, setRefrescos] = useState({ feed: 0, historias: 0, perfil: 0 });
  const temporizador = useRef(null);

  const mostrarMensaje = useCallback((texto, tipo = 'ok') => {
    clearTimeout(temporizador.current);
    setToast({ texto, tipo, clave: Date.now() });
    temporizador.current = setTimeout(() => setToast(null), 3000);
  }, []);

  /** Hoja de opciones: { titulo?, texto?, persona?, opciones: [{ texto, clase?, accion }] } */
  const hojaOpciones = useCallback((datos) => setHoja(datos), []);

  /** Confirmación: devuelve una promesa true/false. */
  const confirmar = useCallback(({ titulo, texto, boton = 'Eliminar', persona }) => new Promise((resolver) => {
    setHoja({
      titulo, texto, persona,
      opciones: [{ texto: boton, clase: 'peligro', accion: () => resolver(true) }],
      alCancelar: () => resolver(false)
    });
  }), []);

  const refrescar = useCallback((...que) => {
    setRefrescos((r) => {
      const nuevo = { ...r };
      que.forEach((q) => { nuevo[q] = (nuevo[q] || 0) + 1; });
      return nuevo;
    });
  }, []);

  // Funciones estables (no cambian entre renders) para poder usarlas en efectos
  const acciones = useMemo(() => ({
    cerrarHoja: () => setHoja(null),
    abrirPublicacion: (id, opciones = {}) => setPublicacion({ id, ...opciones }),
    cerrarPublicacion: () => setPublicacion(null),
    abrirLista: (titulo, cargar) => setLista({ titulo, cargar }),
    cerrarLista: () => setLista(null),
    abrirCrear: () => { setPanel(null); setCrear(true); },
    cerrarCrear: () => setCrear(false),
    abrirEditarPerfil: () => setEditarPerfil(true),
    cerrarEditarPerfil: () => setEditarPerfil(false),
    abrirVisor: (grupos, indice) => { if (grupos.length && indice >= 0) setVisor({ grupos, indice }); },
    cerrarVisor: () => setVisor(null),
    alternarPanel: (nombre) => setPanel((p) => (p === nombre ? null : nombre)),
    cerrarPanel: () => setPanel(null)
  }), []);

  const valor = useMemo(() => ({
    ...acciones,
    toast, mostrarMensaje, hoja, hojaOpciones, confirmar,
    publicacion, lista, crear, editarPerfil, visor, panel,
    refrescos, refrescar,
    hayModal: Boolean(hoja || publicacion || lista || crear || editarPerfil)
  }), [acciones, toast, mostrarMensaje, hoja, hojaOpciones, confirmar, publicacion, lista, crear, editarPerfil, visor, panel, refrescos, refrescar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
