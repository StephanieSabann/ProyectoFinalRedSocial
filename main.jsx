/**
 * Punto de entrada de React.
 * 1. Pide al backend la configuración pública (llaves de Google y reCAPTCHA).
 * 2. Si hay Client ID de Google, envuelve la app con GoogleOAuthProvider.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import { ProveedorSesion } from './contexto/Sesion';
import './estilos.css';

const raiz = createRoot(document.getElementById('raiz'));

fetch('/api/config')
  .then((r) => r.json())
  .catch(() => ({}))
  .then((config) => {
    const app = (
      <ProveedorSesion config={config}>
        <App />
      </ProveedorSesion>
    );
    raiz.render(
      <StrictMode>
        {config.googleClientId
          ? <GoogleOAuthProvider clientId={config.googleClientId}>{app}</GoogleOAuthProvider>
          : app}
      </StrictMode>
    );
  });
