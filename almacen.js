/**
 * Almacén de publicaciones compartido por toda la app.
 *
 * Cuando una publicación cambia (me gusta, guardado, comentario, edición), todas las
 * tarjetas que la muestran (feed, cuadrícula, detalle) se actualizan a la vez.
 */
import { useSyncExternalStore } from 'react';

const publicaciones = new Map();   // id -> publicación
const oyentes = new Map();         // id -> Set de funciones

/** Guarda (o mezcla) una publicación y avisa a quienes la muestran. */
export function guardarPublicacion(pub) {
  const nueva = { ...(publicaciones.get(pub.id) || {}), ...pub };
  publicaciones.set(pub.id, nueva);
  (oyentes.get(pub.id) || []).forEach((f) => f());
  return nueva;
}

export const leerPublicacion = (id) => publicaciones.get(id);

export function quitarPublicacion(id) {
  publicaciones.delete(id);
  (oyentes.get(id) || []).forEach((f) => f());
}

export function vaciarAlmacen() {
  publicaciones.clear();
}

// ---------- Historias (barra de historias) ----------
let historias = [];
const oyentesHistorias = new Set();

export function guardarHistorias(lista) {
  historias = lista;
  oyentesHistorias.forEach((f) => f());
}
export const leerHistorias = () => historias;

/** Marca una historia como vista sin volver a pedirla al servidor. */
export function marcarHistoriaVista(historiaId) {
  historias = historias.map((g) => {
    if (!g.historias.some((h) => h.id === historiaId)) return g;
    const lista = g.historias.map((h) => (h.id === historiaId ? { ...h, vista: true } : h));
    return { ...g, historias: lista, todasVistas: lista.every((h) => h.vista) };
  });
  oyentesHistorias.forEach((f) => f());
}

export function useHistorias() {
  return useSyncExternalStore(
    (avisar) => { oyentesHistorias.add(avisar); return () => oyentesHistorias.delete(avisar); },
    () => historias
  );
}

/** Hook: devuelve la versión más reciente de la publicación y se repinta si cambia. */
export function usePublicacion(id) {
  return useSyncExternalStore(
    (avisar) => {
      if (!oyentes.has(id)) oyentes.set(id, new Set());
      oyentes.get(id).add(avisar);
      return () => oyentes.get(id).delete(avisar);
    },
    () => publicaciones.get(id)
  );
}
