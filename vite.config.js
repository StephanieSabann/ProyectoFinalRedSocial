import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo (npm run dev) Vite reenvía /api e /imagenes al servidor Express (puerto 3000).
// En producción se compila con "npm run build" y Express sirve la carpeta dist/.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/imagenes': 'http://localhost:3000'
    }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600 // face-api.js se carga aparte y solo al crear una publicación
  }
});
