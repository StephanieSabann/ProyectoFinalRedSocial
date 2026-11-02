/**
 * Configuración de PM2 (administrador de procesos en la EC2).
 * Uso: pm2 start despliegue/ecosystem.config.js --env production
 */
module.exports = {
  apps: [{
    name: 'red-social-insta',
    script: 'index.js',
    cwd: __dirname + '/..',
    instances: 1,                 // t2.small = 1 vCPU
    exec_mode: 'fork',
    max_memory_restart: '700M',   // se reinicia si usa demasiada memoria
    env_production: {
      NODE_ENV: 'production'
    },
    out_file: '/var/log/red-social/salida.log',
    error_file: '/var/log/red-social/errores.log',
    time: true
  }]
};
