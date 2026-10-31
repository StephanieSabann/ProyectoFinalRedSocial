/**
 * Editar perfil: foto, nombre, usuario, sitio web, presentación, correo y contraseña.
 */
import { useEffect, useRef, useState } from 'react';
import Icono from '../utilidades/Icono';
import { Avatar, Modal } from './Basicos';
import { useSesion } from '../contexto/Sesion';
import { useInterfaz } from '../contexto/Interfaz';
import { api } from '../api';

export default function ModalEditarPerfil() {
  const { editarPerfil, cerrarEditarPerfil, mostrarMensaje, refrescar } = useInterfaz();
  const { usuario, actualizarUsuario } = useSesion();
  const [datos, setDatos] = useState({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const selector = useRef(null);

  useEffect(() => {
    if (!editarPerfil) return;
    setDatos({
      nombre: usuario.nombre || '', username: usuario.username || '', sitioWeb: usuario.sitioWeb || '',
      biografia: usuario.biografia || '', correo: usuario.correo || '', password: ''
    });
    setError('');
  }, [editarPerfil, usuario]);

  if (!editarPerfil) return null;
  const campo = (nombre) => ({ value: datos[nombre] ?? '', onChange: (e) => setDatos({ ...datos, [nombre]: e.target.value }) });

  // PUT /api/usuarios (solo lo que cambió)
  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    const cambios = {};
    Object.entries(datos).forEach(([c, v]) => {
      const valor = v.trim();
      const vacioPermitido = c === 'biografia' || c === 'sitioWeb';
      if ((valor || vacioPermitido) && valor !== (usuario[c] || '')) cambios[c] = c === 'password' ? v : valor;
    });
    if (Object.keys(cambios).length === 0) return cerrarEditarPerfil();

    setGuardando(true);
    try {
      const respuesta = await api('/usuarios', { method: 'PUT', json: cambios });
      actualizarUsuario(respuesta);
      cerrarEditarPerfil();
      mostrarMensaje(respuesta.mensaje);
      refrescar('perfil');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  // POST / DELETE /api/usuarios/avatar
  const cambiarFoto = async (archivo) => {
    if (!archivo) return;
    const formulario = new FormData();
    formulario.append('file0', archivo);
    try {
      const respuesta = await api('/usuarios/avatar', { method: 'POST', body: formulario });
      actualizarUsuario(respuesta.usuario);
      mostrarMensaje(respuesta.mensaje);
      refrescar('perfil', 'historias');
    } catch (err) { mostrarMensaje(err.message, 'error'); }
  };
  const quitarFoto = async () => {
    try {
      const respuesta = await api('/usuarios/avatar', { method: 'DELETE' });
      actualizarUsuario(respuesta.usuario);
      mostrarMensaje(respuesta.mensaje);
      refrescar('perfil', 'historias');
    } catch (err) { mostrarMensaje(err.message, 'error'); }
  };

  return (
    <Modal id="modal-perfil" alCerrar={cerrarEditarPerfil}>
      <div className="modal-caja">
        <header className="modal-encabezado">
          <h2>Editar perfil</h2>
          <button className="btn-icono" onClick={cerrarEditarPerfil} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
        </header>
        <form id="form-perfil" onSubmit={guardar} noValidate>
          <div className="editar-foto">
            <Avatar persona={usuario} clase="avatar-mediano" conHistoria={false} alClic={() => selector.current.click()} />
            <div>
              <strong>{usuario.username}</strong>
              <div className="editar-foto-botones">
                <button type="button" className="link-azul" onClick={() => selector.current.click()}>Cambiar foto</button>
                {usuario.imagen && <button type="button" className="link-rojo" onClick={quitarFoto}>Quitar foto</button>}
              </div>
              <input ref={selector} type="file" accept="image/*" hidden onChange={(e) => { cambiarFoto(e.target.files[0]); e.target.value = ''; }} />
            </div>
          </div>
          <label>Nombre<input type="text" maxLength={60} {...campo('nombre')} /></label>
          <label>Nombre de usuario<input type="text" maxLength={30} {...campo('username')} /></label>
          <label>Sitio web<input type="url" placeholder="https://" {...campo('sitioWeb')} /></label>
          <label>Presentación
            <textarea rows={3} maxLength={150} {...campo('biografia')} />
            <span className="contador-caracteres">{(datos.biografia || '').length}/150</span>
          </label>
          <label>Correo electrónico<input type="email" {...campo('correo')} /></label>
          <label>{usuario.proveedor === 'google' ? 'Crear contraseña (opcional)' : 'Nueva contraseña'}
            <input type="password" placeholder="Déjala en blanco para no cambiarla" autoComplete="new-password" {...campo('password')} />
          </label>
          {error && <p className="error-form">{error}</p>}
          <button type="submit" className="btn btn-primario" disabled={guardando}>Enviar</button>
        </form>
      </div>
    </Modal>
  );
}
