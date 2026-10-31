/**
 * Crear publicación (2 pasos, como Instagram):
 *   1. Elegir o arrastrar de 1 a 10 fotos.
 *   2. Vista previa + RECONOCIMIENTO DE ROSTROS con face-api.js + descripción y ubicación.
 *
 * face-api.js se carga solo cuando se abre esta ventana (es pesado) y usa los modelos
 * de la carpeta public/modelos-face (TinyFaceDetector + expresiones).
 * Los rostros se envían al servidor junto con las fotos y quedan guardados en SQL Server.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icono from '../utilidades/Icono';
import { Avatar, Modal } from './Basicos';
import { Carrusel } from './Publicacion';
import { useSesion } from '../contexto/Sesion';
import { useInterfaz } from '../contexto/Interfaz';
import { guardarPublicacion } from '../almacen';
import { api } from '../api';

const MAX_FOTOS = 10;
const MAX_BYTES = 8 * 1024 * 1024;
const EXPRESIONES = { neutral: 'neutral', happy: 'feliz', sad: 'triste', angry: 'enojado', fearful: 'asustado', disgusted: 'disgustado', surprised: 'sorprendido' };

// face-api.js y sus modelos se cargan una sola vez
let promesaFaceApi = null;
function cargarFaceApi() {
  if (!promesaFaceApi) {
    promesaFaceApi = (async () => {
      const faceapi = await import('@vladmandic/face-api');
      await faceapi.tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/modelos-face'),
        faceapi.nets.faceExpressionNet.loadFromUri('/modelos-face')
      ]);
      return faceapi;
    })().catch((error) => { promesaFaceApi = null; throw error; });
  }
  return promesaFaceApi;
}

/** Detecta rostros en una imagen y devuelve cajas relativas (0 a 1) con su expresión. */
async function detectarRostros(faceapi, url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const resultados = await faceapi
    .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceExpressions();
  return resultados.map((r) => {
    const { x, y, width, height } = r.detection.box;
    const [principal] = r.expressions.asSortedArray();
    return {
      x: x / img.naturalWidth,
      y: y / img.naturalHeight,
      w: width / img.naturalWidth,
      h: height / img.naturalHeight,
      puntaje: r.detection.score,
      expresion: EXPRESIONES[principal?.expression] || ''
    };
  });
}

export default function ModalCrear() {
  const { crear, cerrarCrear, mostrarMensaje, refrescar } = useInterfaz();
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const [fotos, setFotos] = useState([]);            // [{ archivo, url, rostros: null | [] }]
  const [estadoRostros, setEstadoRostros] = useState('');  // '', 'cargando', 'listo', 'error'
  const [descripcion, setDescripcion] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [compartiendo, setCompartiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const selector = useRef(null);
  const urls = useRef([]);

  // Libera las URLs temporales de las vistas previas
  const liberar = () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current = []; };
  useEffect(() => {
    if (!crear) { liberar(); setFotos([]); setDescripcion(''); setUbicacion(''); setEstadoRostros(''); setCompartiendo(false); }
  }, [crear]);

  if (!crear) return null;

  const elegir = async (lista) => {
    const archivos = [...lista].filter((a) => a.type.startsWith('image/'));
    if (archivos.length === 0) return mostrarMensaje('Selecciona fotos (jpg, png, webp o gif)', 'error');
    if (archivos.length > MAX_FOTOS) return mostrarMensaje(`Puedes elegir como máximo ${MAX_FOTOS} fotos`, 'error');
    const pesada = archivos.find((a) => a.size > MAX_BYTES);
    if (pesada) return mostrarMensaje(`"${pesada.name}" pesa más de 8 MB`, 'error');

    liberar();
    const conUrl = archivos.map((archivo) => ({ archivo, url: URL.createObjectURL(archivo), rostros: null }));
    urls.current = conUrl.map((f) => f.url);
    // Proporción de cada foto (para dibujar la vista previa y los recuadros en su lugar)
    const nuevas = await Promise.all(conUrl.map(async (f) => {
      try {
        const img = new Image();
        img.src = f.url;
        await img.decode();
        return { ...f, proporcion: img.naturalWidth / img.naturalHeight };
      } catch (e) {
        return { ...f, proporcion: 1 };
      }
    }));
    setFotos(nuevas);

    // Reconocimiento de rostros con face-api.js
    setEstadoRostros('cargando');
    try {
      const faceapi = await cargarFaceApi();
      const conRostros = [];
      for (const f of nuevas) conRostros.push({ ...f, rostros: await detectarRostros(faceapi, f.url) });
      setFotos(conRostros);
      setEstadoRostros('listo');
    } catch (error) {
      console.error('face-api.js:', error);
      setFotos(nuevas.map((f) => ({ ...f, rostros: [] })));
      setEstadoRostros('error');
    }
  };

  // POST /api/publicaciones  (multipart: imagenes, descripcion, ubicacion, rostros)
  const compartir = async () => {
    setCompartiendo(true);
    const formulario = new FormData();
    fotos.forEach((f) => formulario.append('imagenes', f.archivo));
    formulario.append('descripcion', descripcion.trim());
    formulario.append('ubicacion', ubicacion.trim());
    formulario.append('rostros', JSON.stringify(fotos.map((f) => f.rostros || [])));
    try {
      const datos = await api('/publicaciones', { method: 'POST', body: formulario });
      guardarPublicacion(datos.publicacion);
      cerrarCrear();
      mostrarMensaje('Se compartió tu publicación');
      refrescar('feed', 'perfil');
      if (!['#/', ''].includes(location.hash) && !location.hash.startsWith(`#/perfil/${usuario.id}`)) navegar(`/perfil/${usuario.id}`);
    } catch (error) {
      mostrarMensaje(error.message, 'error');
      setCompartiendo(false);
    }
  };

  const totalRostros = fotos.reduce((s, f) => s + (f.rostros?.length || 0), 0);
  const paso2 = fotos.length > 0;

  return (
    <Modal id="modal-crear" oscuro botonFuera alCerrar={compartiendo ? () => {} : cerrarCrear}>
      <div className={`crear-caja ${paso2 ? 'paso-2' : ''}`}>
        <header className="crear-encabezado">
          {paso2 && !compartiendo && (
            <button id="crear-atras" className="btn-icono" aria-label="Atrás" onClick={() => { liberar(); setFotos([]); setEstadoRostros(''); }}>
              <Icono nombre="atras" />
            </button>
          )}
          <h2>{compartiendo ? 'Procesando y subiendo...' : 'Crear nueva publicación'}</h2>
          {paso2 && (
            <button id="crear-compartir" className="link-azul" disabled={compartiendo || estadoRostros === 'cargando'} onClick={compartir}>
              Compartir
            </button>
          )}
        </header>

        {!paso2 ? (
          <div
            className={`crear-paso-1 ${arrastrando ? 'arrastrando' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files); }}
          >
            <Icono nombre="fotos" className="icono-gigante" />
            <p>Arrastra las fotos aquí</p>
            <button className="btn btn-primario" onClick={() => selector.current.click()}>Seleccionar del dispositivo</button>
            <input ref={selector} type="file" accept="image/*" multiple hidden onChange={(e) => elegir(e.target.files)} />
            <small>Hasta 10 fotos · máximo 8 MB cada una · se detectarán rostros automáticamente</small>
          </div>
        ) : (
          <div className="crear-paso-2">
            <div className="crear-vista-previa">
              <Carrusel
                cuadrado
                diapositivas={fotos.map((f) => (
                  <div
                    className="marco-previa"
                    key={f.url}
                    style={{ aspectRatio: f.proporcion, width: `min(100%, ${f.proporcion * 100}%)`, height: 'auto' }}
                  >
                    <img src={f.url} alt="Vista previa" />
                    {f.rostros?.map((r, i) => (
                      <span key={i} className="caja-rostro" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}>
                        {r.expresion && <em>{r.expresion}</em>}
                      </span>
                    ))}
                  </div>
                ))}
              />
            </div>
            <div className="crear-detalles">
              <div className="fila-persona">
                <Avatar persona={usuario} clase="avatar-xs" conHistoria={false} alClic={() => {}} />
                <strong>{usuario.username}</strong>
              </div>
              <div className={`estado-rostros ${estadoRostros}`}>
                <Icono nombre="rostro" />
                {estadoRostros === 'cargando' && 'Detectando rostros con face-api.js...'}
                {estadoRostros === 'listo' && (totalRostros === 0
                  ? 'No se detectaron rostros'
                  : `Se detectaron ${totalRostros} rostro${totalRostros === 1 ? '' : 's'}`)}
                {estadoRostros === 'error' && 'No se pudo cargar el detector de rostros (la foto se publica igual)'}
              </div>
              <textarea rows={6} maxLength={2200} placeholder="Escribe una descripción..." value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)} disabled={compartiendo} />
              <div className="contador-caracteres">{descripcion.length.toLocaleString('es')}/2,200</div>
              <label className="campo-icono">
                <input type="text" maxLength={100} placeholder="Agregar ubicación" value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)} disabled={compartiendo} />
                <Icono nombre="ubicacion" />
              </label>
              <p className="nota-transformaciones">
                Al compartir, el servidor creará automáticamente una miniatura y 3 transformaciones de cada foto:
                blanco y negro, sepia y escala al 50 %.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
