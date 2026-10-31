/**
 * Íconos SVG propios (trazo de 2 px). Uso: <Icono nombre="corazon" relleno />
 */
const TRAZOS = {
  inicio: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  buscar: <><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></>,
  explorar: <><circle cx="12" cy="12" r="9.5" /><path d="m15.8 8.2-2.3 5.3-5.3 2.3 2.3-5.3z" /></>,
  corazon: <path d="M12 20.3s-7.6-4.6-9.3-9.4C1.4 7.6 3.5 4.2 7 4.2c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.5 0 5.6 3.4 4.3 6.7-1.7 4.8-9.3 9.4-9.3 9.4z" />,
  comentario: <path d="M20.7 16.4A9.3 9.3 0 1 0 17 20l4.2 1.2z" />,
  enviar: <path d="M22 3 11 13.5M22 3l-6.5 18-4.5-7.5L3 9.3z" />,
  guardar: <path d="M19 21 12 15.5 5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1z" />,
  crear: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 7.5v9M7.5 12h9" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  opciones: <><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></>,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  atras: <path d="M15 5l-7 7 7 7" />,
  adelante: <path d="m9 5 7 7-7 7" />,
  multiple: <><rect x="7" y="3" width="14" height="14" rx="2" fill="currentColor" stroke="none" /><path d="M3.5 7.5V19a1.5 1.5 0 0 0 1.5 1.5h11.5" /></>,
  cuadricula: <><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></>,
  lista: <><rect x="4" y="3" width="16" height="11" rx="1.5" /><path d="M4 18h16M4 21h10" /></>,
  fotos: <><rect x="2.5" y="5.5" width="15" height="15" rx="2" /><path d="M6.5 2.5h13a2 2 0 0 1 2 2v13" /><circle cx="7.5" cy="10.5" r="1.5" /><path d="m17.5 16-4.5-4.5-8 8" /></>,
  ubicacion: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  ojo: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  usuario: <><circle cx="12" cy="8" r="4.2" /><path d="M3.5 21.5c1.4-4.3 4.6-6.5 8.5-6.5s7.1 2.2 8.5 6.5" /></>,
  camara: <><path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.8" /></>,
  rostro: <><circle cx="12" cy="12" r="9.5" /><circle cx="9" cy="10" r="1" fill="currentColor" /><circle cx="15" cy="10" r="1" fill="currentColor" /><path d="M8.5 14.5c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2" /></>,
  etiqueta: <><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
  descargar: <path d="M12 3v12m0 0-5-5m5 5 5-5M4 20h16" />
};

export default function Icono({ nombre, relleno = false, className = '', titulo }) {
  return (
    <svg
      className={`icono ${className}`.trim()}
      viewBox="0 0 24 24"
      fill={relleno ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={titulo ? undefined : 'true'}
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
    >
      {TRAZOS[nombre]}
    </svg>
  );
}

/** Logo propio (círculo con lente). */
export function Logo({ tamano = 28 }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="16" cy="16" r="12.7" />
      <circle cx="16" cy="16" r="5.2" />
      <circle cx="23.6" cy="8.4" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
