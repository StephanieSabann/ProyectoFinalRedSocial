/**
 * Página de bienvenida y autenticación.
 * - Iniciar sesión con correo/usuario y contraseña (protegido con reCAPTCHA).
 * - Crear cuenta nueva (protegido con reCAPTCHA).
 * - Continuar con Google (Google Identity Services vía @react-oauth/google).
 */
import { useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { GoogleLogin } from '@react-oauth/google';
import { Marca } from '../componentes/Navegacion';
import { useSesion } from '../contexto/Sesion';
import { CONFIG } from '../config';
import { api } from '../api';

function Recaptcha({ llave, alCambiar, referencia }) {
  if (!llave) return null;
  return (
    <div className="recaptcha">
      <ReCAPTCHA ref={referencia} sitekey={llave} hl="es" onChange={(t) => alCambiar(t || '')} onExpired={() => alCambiar('')} />
    </div>
  );
}

function BotonGoogle({ alError, separadorArriba = true }) {
  const { config, iniciarSesion } = useSesion();
  if (!config.googleClientId) return null;
  const separador = <div className="separador"><span>o</span></div>;
  return (
    <>
      {separadorArriba && separador}
      <div className="google-login">
        <GoogleLogin
          locale="es"
          text="continue_with"
          shape="rectangular"
          width="268"
          onSuccess={async ({ credential }) => {
            try {
              const datos = await api('/login/google', { method: 'POST', json: { credential } });
              await iniciarSesion(datos);
            } catch (e) { alError(e.message); }
          }}
          onError={() => alError('No se pudo iniciar sesión con Google')}
        />
      </div>
      {!separadorArriba && separador}
    </>
  );
}

function FormularioLogin() {
  const { config, iniciarSesion, avisoSalida } = useSesion();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [recaptcha, setRecaptcha] = useState('');
  const [error, setError] = useState(avisoSalida);
  const [enviando, setEnviando] = useState(false);
  const captcha = useRef(null);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (config.recaptchaSiteKey && !recaptcha) return setError('Marca la casilla "No soy un robot"');
    setEnviando(true);
    try {
      const datos = await api('/login', { method: 'POST', json: { correo: correo.trim(), password, recaptcha } });
      await iniciarSesion(datos);
    } catch (err) {
      setError(err.message);
      captcha.current?.reset();
      setRecaptcha('');
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      <input type="text" placeholder="Correo electrónico o nombre de usuario" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} />
      <input type="password" placeholder="Contraseña" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Recaptcha llave={config.recaptchaSiteKey} alCambiar={setRecaptcha} referencia={captcha} />
      <button type="submit" className="btn btn-primario btn-bloque" disabled={enviando || !correo.trim() || !password}>Iniciar sesión</button>
      <BotonGoogle alError={setError} />
      {error && <p className="error-form">{error}</p>}
    </form>
  );
}

function FormularioRegistro() {
  const { config, iniciarSesion } = useSesion();
  const [datos, setDatos] = useState({ correo: '', nombre: '', username: '', password: '' });
  const [recaptcha, setRecaptcha] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const captcha = useRef(null);
  const campo = (c) => ({ value: datos[c], onChange: (e) => setDatos({ ...datos, [c]: e.target.value }) });

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (config.recaptchaSiteKey && !recaptcha) return setError('Marca la casilla "No soy un robot"');
    setEnviando(true);
    try {
      const respuesta = await api('/usuarios', { method: 'POST', json: { ...datos, recaptcha } });
      await iniciarSesion(respuesta);
    } catch (err) {
      setError(err.message);
      captcha.current?.reset();
      setRecaptcha('');
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      <BotonGoogle alError={setError} separadorArriba={false} />
      <input type="email" placeholder="Correo electrónico" autoComplete="email" {...campo('correo')} />
      <input type="text" placeholder="Nombre completo" autoComplete="name" {...campo('nombre')} />
      <input type="text" placeholder="Nombre de usuario" autoComplete="username" {...campo('username')} />
      <input type="password" placeholder="Contraseña (8+ caracteres, letras y números)" autoComplete="new-password" {...campo('password')} />
      <Recaptcha llave={config.recaptchaSiteKey} alCambiar={setRecaptcha} referencia={captcha} />
      <button type="submit" className="btn btn-primario btn-bloque" disabled={enviando}>Registrarte</button>
      {error && <p className="error-form">{error}</p>}
    </form>
  );
}

export default function Bienvenida() {
  const [modo, setModo] = useState('login');
  return (
    <section className="login-page">
      <div className="login-contenido">
        <div className="login-collage" aria-hidden="true">
          <div className="collage-telefono">
            <div className="collage-foto f1" /><div className="collage-foto f2" /><div className="collage-foto f3" />
          </div>
          <div className="collage-telefono atras"><div className="collage-foto f4" /></div>
        </div>

        <div className="login-columna">
          <div className="login-caja">
            <Marca grande />
            <p className="login-subtitulo">
              {modo === 'login'
                ? `Bienvenido(a) a ${CONFIG.nombreApp || 'la red'}. Comparte y explora fotos con tus amigos.`
                : 'Regístrate para ver fotos de tus amigos.'}
            </p>
            {modo === 'login' ? <FormularioLogin /> : <FormularioRegistro />}
          </div>
          <div className="login-caja login-cambiar">
            {modo === 'login'
              ? <>¿No tienes una cuenta? <button type="button" className="link-azul" onClick={() => setModo('registro')}>Regístrate</button></>
              : <>¿Tienes una cuenta? <button type="button" className="link-azul" onClick={() => setModo('login')}>Inicia sesión</button></>}
          </div>
          <p className="login-nota">Proyecto final · Desarrollo Web</p>
        </div>
      </div>
    </section>
  );
}
