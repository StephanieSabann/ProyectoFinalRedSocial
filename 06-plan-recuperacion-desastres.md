# 06 · Plan de recuperación ante desastres (Disaster Recovery Plan)

## 1. Objetivos

| Indicador | Objetivo | Cómo se logra |
|---|---|---|
| **RPO** (datos que se pueden perder) | ≤ 5 minutos | Respaldos automáticos con recuperación a un punto en el tiempo (RDS o Azure SQL) |
| **RTO** (tiempo para volver a operar) | ≤ 2 horas | Script de instalación automatizado + AMI de la instancia |
| Fotos | Sin pérdida | S3 (durabilidad de 99.999999999 %) con **versionado** activado |

## 2. Qué se respalda

| Componente | Respaldo | Retención | Dónde |
|---|---|---|---|
| Base de datos (AWS) | Automático de RDS + recuperación a un punto en el tiempo | 7 días | RDS |
| Base de datos (Azure) | Automático de Azure SQL + recuperación a un punto en el tiempo | 7 días | Azure |
| Base de datos (manual) | Copia `.bak` antes de cambios grandes (ver 3.C) | Las 3 últimas | S3 (`respaldos/`) |
| Fotos | Versionado de S3 | Versiones anteriores 30 días | El mismo bucket |
| Servidor | AMI de la instancia (manual tras cada cambio importante) | Las 2 últimas | EC2 → AMIs |
| Código | Git | Permanente | GitHub |
| Configuración | `.env` fuera del repositorio | Permanente | Gestor de contraseñas del equipo |

## 3. Escenarios y procedimientos

### Escenario A — La aplicación se cae (proceso Node)

PM2 la reinicia automáticamente. Si no:

```bash
ssh -i red-social-insta.pem ubuntu@<IP>
pm2 status && pm2 logs red-social-insta --lines 100
pm2 restart red-social-insta
```

### Escenario B — La instancia EC2 se pierde o se daña

1. **EC2 → AMIs** → la más reciente → **Launch instance from AMI** (t2.small, `sg-web-insta`,
   rol `EC2-RedSocialInsta`).
   Sin AMI: lanzar Ubuntu 24.04 y seguir el paso A7 de `docs/02` (≈ 20 min).
2. **Elastic IPs** → asociar la IP elástica a la nueva instancia (Route 53 no cambia).
3. Restaurar el `.env` y comprobar `curl http://localhost:3000/salud`.

### Escenario C — Datos borrados o dañados en SQL Server

**AWS RDS — recuperación a un punto en el tiempo:**
RDS → `red-social-sqlserver` → **Actions → Restore to point in time** → hora anterior al incidente → nueva
instancia (`red-social-sqlserver-restaurada`) → cambia `DB_HOST` en `.env` → `pm2 restart red-social-insta`.

**Azure SQL — recuperación a un punto en el tiempo:**
Portal → base `red_social_insta` → **Restore** → *Point-in-time* → elige la hora → se crea una base nueva →
cambia `DB_NOMBRE` en `.env` (o renómbrala) → reinicia la app.

**Copia manual `.bak` (RDS)** — requiere un *option group* con la opción `SQLSERVER_BACKUP_RESTORE` asociado a la
instancia y con permiso sobre el bucket:

```sql
-- Respaldo a S3
EXEC msdb.dbo.rds_backup_database
     @source_db_name = 'red_social_insta',
     @s3_arn_to_backup_to = 'arn:aws:s3:::<bucket>/respaldos/red_social_insta.bak',
     @overwrite_s3_backup_file = 1;

-- Restaurar desde S3 (en una base nueva)
EXEC msdb.dbo.rds_restore_database
     @restore_db_name = 'red_social_insta_restaurada',
     @s3_arn_to_restore_from = 'arn:aws:s3:::<bucket>/respaldos/red_social_insta.bak';

-- Ver el avance
EXEC msdb.dbo.rds_task_status;
```

**Local (SQL Server Express):**

```sql
BACKUP DATABASE red_social_insta TO DISK = N'C:\respaldos\red_social_insta.bak' WITH INIT;
-- Restaurar
RESTORE DATABASE red_social_insta FROM DISK = N'C:\respaldos\red_social_insta.bak' WITH REPLACE;
```

(La carpeta `C:\respaldos` debe existir y el servicio de SQL Server debe poder escribir en ella.)

### Escenario D — Fotos borradas por error en S3

Con el versionado activado, el borrado deja una marca (*delete marker*): S3 → bucket → activar **Show versions** →
borrar la marca de borrado de los objetos afectados (o restaurar la versión anterior).

### Escenario E — Credenciales comprometidas

| Credencial | Acción inmediata |
|---|---|
| `JWT_SECRETO` | Generar uno nuevo y reiniciar: todas las sesiones se cierran |
| Contraseña de `insta_app` | `ALTER LOGIN insta_app WITH PASSWORD = N'<nueva>';` (Azure: `ALTER USER insta_app WITH PASSWORD = N'<nueva>';`) + `.env` + reinicio |
| Contraseña maestra de RDS / Azure | Cambiarla en la consola (RDS → *Modify* · Azure → servidor → *Reset password*) |
| Par de claves SSH | Crear uno nuevo, reemplazar `~/.ssh/authorized_keys`, borrar el anterior |
| Usuario IAM del docente o llaves de S3 | Desactivarlas en IAM y crear nuevas |
| Llaves de Google / reCAPTCHA | Regenerarlas en sus consolas y actualizar `.env` |

Después, revisar `dbo.auditoria` (doc. 05) para ver qué se hizo con la credencial.

### Escenario F — Falla de toda la región us-east-1

Fuera del alcance del proyecto académico. Mejora futura: replicación del bucket a otra región
(S3 Cross-Region Replication) y copia de los respaldos de RDS a `us-west-2` (o *geo-restore* en Azure SQL).

## 4. Pruebas del plan

| Prueba | Frecuencia | Responsable |
|---|---|---|
| Restaurar la base a un punto en el tiempo en una copia de prueba | Mensual | [Integrante] |
| Lanzar una instancia desde la AMI y verificar `/salud` | Trimestral | [Integrante] |
| Recuperar una foto borrada usando versiones de S3 | Trimestral | [Integrante] |

## 5. Contactos

| Rol | Nombre | Contacto |
|---|---|---|
| Responsable de la nube | [Nombre] | [correo / teléfono] |
| Responsable de la base de datos | [Nombre] | [correo / teléfono] |
| Responsable de la aplicación | [Nombre] | [correo / teléfono] |
