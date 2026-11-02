# 05 · Seguridad, auditoría y mantenimiento de la base de datos (SQL Server)

## 1. Manual de seguridad de la base de datos

### 1.1 Inicios de sesión, usuarios y permisos (mínimo privilegio)

| Usuario | Usado por | Permisos |
|---|---|---|
| `admin` (maestro de RDS) / `adminsql` (Azure) / `sa` o tu usuario de Windows (local) | Solo administración | Todos. **No** se usa en la aplicación |
| `insta_app` | La aplicación (`DB_USUARIO` en `.env`) | `db_datareader` + `db_datawriter`. **DENY** `UPDATE`/`DELETE` en `dbo.auditoria` y **DENY** `EXECUTE` en `dbo.sp_eliminar_usuario` |
| `insta_respaldo` | Revisión y respaldos | Solo `db_datareader` |

Los permisos están en [`basededatos/sqlserver/03-usuarios.sql`](../basededatos/sqlserver/03-usuarios.sql)
(local y RDS) y [`03-usuarios-azure.sql`](../basededatos/sqlserver/03-usuarios-azure.sql) (Azure, usuarios contenidos).
`insta_app` no puede crear ni borrar tablas, ni alterar la auditoría:

```sql
-- Conectado como insta_app
DELETE FROM dbo.auditoria;
-- Msg 229: The DELETE permission was denied on the object 'auditoria'
```

Las contraseñas de los logins usan la política de contraseñas de Windows (`CHECK_POLICY = ON`).

### 1.2 Red

| Entorno | Control |
|---|---|
| AWS | RDS en subred privada (**Public access: No**); el grupo `sg-bd-insta` solo acepta el puerto 1433 desde la EC2. La administración se hace por túnel SSH |
| Azure | Firewall del servidor de Azure SQL: solo la IP de la aplicación (y temporalmente la del administrador) |
| Local | SQL Server Express solo escucha en la computadora del desarrollador |

### 1.3 Datos sensibles

| Dato | Protección |
|---|---|
| Contraseñas | Hash bcrypt (12 rondas) + **sal única por usuario** en `password_salt`. Nunca salen de la API |
| Correo | Solo lo ve su dueño; nunca se devuelve en perfiles ajenos ni en búsquedas |
| Imágenes | No están en la base de datos; S3 privado con cifrado SSE-S3 y URLs firmadas que vencen en 1 hora |
| Credenciales de la base | En `.env` (fuera de Git), nunca en el código |
| Datos en tránsito | HTTPS entre usuario y Nginx; **TLS** entre la app y SQL Server (`DB_CIFRAR=true`), verificando el certificado de Amazon RDS (`DB_CA_ARCHIVO`) o de Azure |
| Datos en reposo | Azure SQL: cifrado TDE activado por defecto. S3: SSE-S3 |

### 1.4 Integridad

- Llaves foráneas en todas las relaciones; cascadas solo donde SQL Server lo permite (ver doc. 01, sección 4).
- Restricciones `CHECK`: valores válidos de `proveedor` y `tipo`, contadores no negativos, no seguirse a uno mismo,
  y `ISJSON` en las columnas JSON (`rostros`, `etiquetas`, `detalle`).
- Llaves primarias compuestas: no hay likes, guardados, seguidores ni vistas duplicadas.
- Transacciones al crear publicaciones, comentar y dar me gusta; `sp_eliminar_usuario` usa `SET XACT_ABORT ON`.
- `NVARCHAR` en todos los textos (Unicode: acentos y emojis).

## 2. Sistema de auditoría de transacciones

Cada acción importante se registra en `dbo.auditoria` con usuario, IP, navegador, fecha y detalle (JSON).
La aplicación solo puede **insertar**: el historial no se puede alterar.

| Acción | Cuándo |
|---|---|
| `REGISTRO` | Cuenta nueva (correo o Google) |
| `LOGIN` | Inicio de sesión correcto (detalle: método `password` o `google`) |
| `LOGIN_FALLIDO` | Usuario inexistente o contraseña incorrecta |
| `LOGIN_GOOGLE_FALLIDO` | Token de Google inválido |
| `PERFIL_ACTUALIZAR` | Cambio de datos (detalle: campos cambiados, nunca valores de contraseña) |
| `PUBLICACION_CREAR` / `_EDITAR` / `_BORRAR` | Publicaciones (detalle: número de fotos y rostros) |
| `HISTORIA_CREAR` | Historias |
| `SEGUIR` / `DEJAR_DE_SEGUIR` | Relaciones |

**Consultas** (más en [`04-consultas-utiles.sql`](../basededatos/sqlserver/04-consultas-utiles.sql)):

```sql
-- Intentos fallidos de login en las últimas 24 h, por IP
SELECT ip, COUNT(*) AS intentos, MAX(fecha) AS ultimo
FROM dbo.auditoria
WHERE accion = N'LOGIN_FALLIDO' AND fecha > DATEADD(DAY, -1, SYSDATETIMEOFFSET())
GROUP BY ip ORDER BY intentos DESC;

-- Historial de un usuario
SELECT TOP 100 fecha, accion, entidad, entidad_id, ip, JSON_VALUE(detalle, '$.metodo') AS metodo
FROM dbo.auditoria WHERE usuario_id = 5 ORDER BY fecha DESC;

-- Publicaciones creadas por día
SELECT CAST(fecha AS DATE) AS dia, COUNT(*) AS publicaciones
FROM dbo.auditoria WHERE accion = N'PUBLICACION_CREAR'
GROUP BY CAST(fecha AS DATE) ORDER BY dia DESC;
```

## 3. Plan de mantenimiento de la base de datos

| Frecuencia | Tarea | Cómo |
|---|---|---|
| Continua (automática) | Respaldos con recuperación a un punto en el tiempo | RDS: *Backup retention* 7 días · Azure SQL: respaldos automáticos de 7 días |
| Cada 10 min (automática) | Borrar historias vencidas (filas + fotos en S3) | `services/historia.js` |
| Semanal | Revisar intentos fallidos y errores | Consultas de la sección 2, `pm2 logs` |
| Semanal | Actualizar estadísticas | `EXEC sp_updatestats;` |
| Mensual | Reorganizar índices fragmentados | `ALTER INDEX ALL ON dbo.publicacion REORGANIZE;` (igual para `imagen`, `me_gusta`, `notificacion`) |
| Mensual | Depurar notificaciones leídas de más de 90 días | `DELETE FROM dbo.notificacion WHERE leida = 1 AND fecha < DATEADD(DAY, -90, SYSDATETIMEOFFSET());` (con el usuario administrador) |
| Mensual | Probar una restauración | Ver plan de recuperación (doc. 06) |
| Trimestral | Archivar auditoría de más de 1 año | Exportar con SSMS (*Tasks → Export Data*) y borrar con el administrador |
| Trimestral | Rotar contraseñas | `ALTER LOGIN insta_app WITH PASSWORD = N'...';` (Azure: `ALTER USER`) + `.env` + `pm2 restart` |
| Según AWS/Azure | Parches de SQL Server | Ventana de mantenimiento de RDS / automático en Azure |

**Monitoreo:** CloudWatch de RDS o *Metrics* de Azure SQL (CPU, conexiones, espacio). Alarma sugerida:
espacio libre < 2 GB.

## 4. Plan de capacitación para el personal de TI

| Sesión | Duración | Contenido | Material |
|---|---|---|---|
| 1. Arquitectura | 1 h | Componentes, flujo de subida, S3 y URLs firmadas | docs 01 y 04 |
| 2. Entorno local | 1 h | SQL Server Express, SSMS, scripts y `.env` | doc 00 |
| 3. Despliegue | 2 h | AWS (VPC, S3, RDS, EC2, Route 53) o Azure SQL; script de instalación y HTTPS | doc 02 + práctica |
| 4. Operación | 1 h | PM2, registros, Nginx, actualizar la app | doc 02 (comandos) |
| 5. Base de datos | 1.5 h | Logins y permisos, auditoría, mantenimiento, `sp_eliminar_usuario` | este documento |
| 6. Recuperación | 1.5 h | Restaurar a un punto en el tiempo y levantar una instancia nueva | doc 06 + simulacro |

Al terminar, cada persona debe poder restaurar la base en una copia de prueba sin ayuda.
