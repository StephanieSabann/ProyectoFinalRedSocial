/**
 * Conexión a la base de datos relacional con Sequelize.
 *
 * Motor principal: Microsoft SQL Server (local con SQL Server Express,
 * Amazon RDS for SQL Server o Azure SQL Database). También funciona con MySQL
 * cambiando DB_MOTOR=mysql (útil para pruebas).
 *
 * Variables del archivo .env:
 *   DB_MOTOR       mssql (por defecto) | mysql
 *   DB_HOST        localhost, endpoint de RDS o servidor.database.windows.net
 *   DB_PUERTO      1433 (SQL Server) | 3306 (MySQL)
 *   DB_INSTANCIA   (opcional) nombre de instancia, ej. SQLEXPRESS. Si se usa, no se usa el puerto.
 *   DB_NOMBRE, DB_USUARIO, DB_CLAVE
 *   DB_CIFRAR                true en RDS y Azure (conexión cifrada)
 *   DB_CONFIAR_CERTIFICADO   true en local (SQL Server Express usa un certificado autofirmado)
 *   DB_CA_ARCHIVO            (AWS RDS) ruta al certificado global-bundle.pem de Amazon RDS
 *                            para verificar el certificado del servidor.
 */
const fs = require('fs');
const { Sequelize, DataTypes } = require('sequelize');

const MOTOR = (process.env.DB_MOTOR || 'mssql').toLowerCase() === 'mysql' ? 'mysql' : 'mssql';
const esSqlServer = MOTOR === 'mssql';

const opcionesSqlServer = {
  dialect: 'mssql',
  port: process.env.DB_INSTANCIA ? undefined : (Number(process.env.DB_PUERTO) || 1433),
  dialectOptions: {
    options: {
      encrypt: process.env.DB_CIFRAR !== 'false',
      trustServerCertificate: process.env.DB_CONFIAR_CERTIFICADO === 'true',
      ...(process.env.DB_INSTANCIA ? { instanceName: process.env.DB_INSTANCIA } : {}),
      ...(process.env.DB_CA_ARCHIVO ? { cryptoCredentialsDetails: { ca: fs.readFileSync(process.env.DB_CA_ARCHIVO) } } : {}),
      requestTimeout: 30000
    }
  }
};

const opcionesMySql = {
  dialect: 'mysql',
  port: Number(process.env.DB_PUERTO) || 3306,
  timezone: '+00:00',
  define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' }
};

const base = esSqlServer ? opcionesSqlServer : opcionesMySql;

const sequelize = new Sequelize(
  process.env.DB_NOMBRE || 'red_social_insta',
  process.env.DB_USUARIO || 'insta_app',
  process.env.DB_CLAVE || '',
  {
    host: process.env.DB_HOST || 'localhost',
    logging: false,
    ...base,
    define: {
      underscored: true,      // columnas en snake_case: usuario_id, fecha_registro...
      freezeTableName: true,  // la tabla se llama igual que el modelo
      timestamps: false,
      ...(base.define || {})
    },
    pool: { max: 10, min: 0, idle: 10000 }
  }
);

/**
 * Columna que guarda un objeto/arreglo como texto JSON.
 * Funciona igual en SQL Server (NVARCHAR(MAX)) y en MySQL (TEXT).
 */
const columnaJSON = (campo) => ({
  type: DataTypes.TEXT,
  allowNull: true,
  get() {
    const valor = this.getDataValue(campo);
    if (valor === null || valor === undefined || typeof valor !== 'string') return valor ?? null;
    try { return JSON.parse(valor); } catch (e) { return null; }
  },
  set(valor) {
    this.setDataValue(campo, valor === null || valor === undefined ? null : JSON.stringify(valor));
  }
});

/**
 * Escapa los comodines de LIKE según el motor.
 * SQL Server: [%] [_] [[]     MySQL: \% \_ \\
 */
const escaparLike = (texto) => (esSqlServer
  ? texto.replace(/[[%_]/g, '[$&]')
  : texto.replace(/[%_\\]/g, '\\$&'));

/**
 * Abre la conexión y carga los modelos con sus relaciones.
 * - SQL Server: las tablas se crean con el script basededatos/sqlserver/02-tablas.sql
 *   (por las reglas de borrado en cascada de SQL Server). Aquí solo se verifica que existan.
 * - MySQL: se crean automáticamente las tablas que falten.
 */
// Azure SQL "serverless" se pausa cuando no se usa y tarda ~1 minuto en despertar:
// por eso se reintenta la conexión varias veces antes de rendirse.
const INTENTOS = 6;
const ESPERA_MS = 15000;

const autenticarConReintentos = async () => {
  for (let intento = 1; ; intento++) {
    try {
      return await sequelize.authenticate();
    } catch (error) {
      const despertando = /not currently available|40613|timeout|ETIMEOUT|ESOCKET/i.test(error.message);
      if (!despertando || intento >= INTENTOS) throw error;
      console.log(`La base de datos aún no responde (intento ${intento}/${INTENTOS}), reintentando en 15 s...`);
      await new Promise((r) => setTimeout(r, ESPERA_MS));
    }
  }
};

const conexion = async () => {
  try {
    await autenticarConReintentos();
    require('../modelos'); // registra modelos y relaciones

    if (esSqlServer) {
      const [filas] = await sequelize.query("SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN ('usuario','publicacion','imagen','auditoria')");
      if (filas[0].total < 4) {
        console.error('Faltan tablas. Ejecuta basededatos/sqlserver/02-tablas.sql en la base', sequelize.getDatabaseName());
        process.exit(1);
      }
    } else {
      await sequelize.sync();
    }
    console.log(`Conectado a ${esSqlServer ? 'SQL Server' : 'MySQL'}: ${sequelize.getDatabaseName()} en ${sequelize.config.host}`);
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error.message);
    if (esSqlServer) {
      console.error('Revisa: SQL Server encendido, autenticación de SQL Server activada, TCP/IP habilitado y los datos DB_* del .env.');
    }
    process.exit(1);
  }
};

module.exports = { sequelize, conexion, columnaJSON, escaparLike, MOTOR, esSqlServer };
