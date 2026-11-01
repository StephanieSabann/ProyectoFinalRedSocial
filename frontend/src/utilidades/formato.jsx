/**
 * Utilidades de formato: tiempos relativos, números y texto con #hashtags / @menciones.
 */
import { Fragment } from 'react';

/** "ahora", "5 min", "3 h", "2 d", "4 sem" */
export function tiempoCorto(fecha) {
  const segundos = Math.floor((Date.now() - new Date(fecha)) / 1000);
  if (segundos < 60) return 'ahora';
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `${dias} d`;
  return `${Math.floor(dias / 7)} sem`;
}

/** "hace 3 horas", "12 de octubre" */
export function tiempoLargo(fecha) {
  const segundos = Math.floor((Date.now() - new Date(fecha)) / 1000);
  if (segundos < 60) return 'hace un momento';
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} minuto${minutos === 1 ? '' : 's'}`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} hora${horas === 1 ? '' : 's'}`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `hace ${dias} día${dias === 1 ? '' : 's'}`;
  const d = new Date(fecha);
  const mismoAnio = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long', ...(mismoAnio ? {} : { year: 'numeric' }) });
}

/**
 * Números como en Instagram: completos hasta 9 999 y abreviados desde 10 000
 * ("12,5 mil", "1,2 M"). Solo cambia cómo se muestran, no el valor.
 */
export function formatearNumero(n) {
  const valor = Number(n || 0);
  const abreviar = (x, sufijo) => `${(Math.floor(x * 10) / 10).toLocaleString('es')} ${sufijo}`;
  if (valor >= 1000000) return abreviar(valor / 1000000, 'M');
  if (valor >= 10000) return abreviar(valor / 1000, 'mil');
  return valor.toLocaleString('es');
}
export const plural = (n, uno, varios) => `${formatearNumero(n)} ${n === 1 ? uno : varios}`;

const PATRON = /([#@][\wáéíóúüñÁÉÍÓÚÜÑ.]+)/g;

/** Texto con #hashtags y @menciones resaltados (React escapa todo el texto: sin riesgo de inyección). */
export function TextoConEtiquetas({ texto, alMencion }) {
  const partes = String(texto || '').split(PATRON);
  return partes.map((parte, i) => {
    if (/^[#@][\wáéíóúüñÁÉÍÓÚÜÑ.]+$/.test(parte)) {
      const esMencion = parte.startsWith('@');
      return (
        <span
          key={i}
          className="etiqueta"
          onClick={esMencion && alMencion ? (e) => { e.stopPropagation(); alMencion(parte.slice(1).replace(/\.$/, '')); } : undefined}
        >
          {parte}
        </span>
      );
    }
    return <Fragment key={i}>{parte}</Fragment>;
  });
}
