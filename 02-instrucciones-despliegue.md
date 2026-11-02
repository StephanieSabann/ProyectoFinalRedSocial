# 02 · Instrucciones de despliegue en la nube

El PDF del proyecto pide **S3** para las imágenes y **Route 53** para el dominio, y permite que la aplicación
corra en **AWS EC2 t2.small** o en **Azure**. Hay tres combinaciones posibles:

| Opción | Aplicación | Base de datos SQL Server | Imágenes | DNS | Recomendación |
|---|---|---|---|---|---|
| **A** | EC2 t2.small | **Amazon RDS for SQL Server Express** | S3 | Route 53 | **Recomendada**: todo en AWS, como pide el PDF |
| **B** | EC2 t2.small | **Azure SQL Database** (oferta gratuita) | S3 | Route 53 | Si ya tienen Azure for Students |
| **C** | Azure VM (Ubuntu) | Azure SQL Database | S3 | Route 53 | Si no pueden usar EC2 |

Todo lo de AWS se crea en la región **us-east-1 (N. Virginia)**. Reemplaza los valores entre `< >`.

---

# Opción A · Todo en AWS (recomendada)

| Recurso | Nombre sugerido |
|---|---|
| VPC | `insta` |
| Bucket S3 | `<grupo>-insta-fotos` |
| Rol IAM de la EC2 | `EC2-RedSocialInsta` |
| Base de datos RDS | `red-social-sqlserver` (SQL Server Express, `db.t3.micro`) |
| Instancia EC2 | `red-social-insta` (t2.small, Ubuntu 24.04) |
| Par de claves | `red-social-insta.pem` |
| Zona de Route 53 | `<midominio.com>` |
| Usuario IAM del docente | `docente-desarrollo-web` |

## A0 · Red (VPC) segmentada

1. **VPC** → **Create VPC** → **VPC and more**.
2. Nombre `insta` · IPv4 CIDR `10.0.0.0/16` · **2 zonas de disponibilidad** · **2 subredes públicas** ·
   **2 subredes privadas**.
3. **NAT gateways: None** (tiene costo) · **VPC endpoints: S3 Gateway**.
4. **Create VPC**.

## A1 · Bucket de S3 para las fotos

1. **S3** → **Create bucket** → nombre `<grupo>-insta-fotos` · región `us-east-1`.
2. **Block all public access: activado** (las fotos se sirven con URLs firmadas).
3. **Bucket Versioning: Enable** · cifrado **SSE-S3** → **Create**.
4. Bucket → **Management** → **Create lifecycle rule** → todo el bucket → *Permanently delete noncurrent versions*
   después de **30 días**.

## A2 · Rol de IAM para la EC2 (sin llaves en el código)

1. **IAM** → **Policies** → **Create policy** → **JSON** → pega
   [`despliegue/politica-ec2-s3-rekognition.json`](../despliegue/politica-ec2-s3-rekognition.json)
   (cambia `NOMBRE-DEL-BUCKET`) → nombre `RedSocialInsta-S3-Rekognition`.
2. **IAM** → **Roles** → **Create role** → *AWS service* → **EC2** → adjunta esa política →
   nombre `EC2-RedSocialInsta`.

## A3 · Grupos de seguridad

**EC2** → **Security Groups** → **Create** (en la VPC `insta`):

| Grupo | Regla de entrada | Origen |
|---|---|---|
| `sg-web-insta` | HTTP 80, HTTPS 443 | `0.0.0.0/0` |
| `sg-web-insta` | SSH 22 | **My IP** |
| `sg-bd-insta` | MS SQL **1433** | el grupo `sg-web-insta` (solo la EC2 llega a la base) |

## A4 · Base de datos: Amazon RDS for SQL Server Express

1. **RDS** → **Create database** → **Standard create** → **Microsoft SQL Server**.
2. **Database management type:** Amazon RDS · **Edition:** **SQL Server Express Edition** ·
   **License:** License included · versión **SQL Server 2022** (o la más reciente).
3. **Templates:** **Free tier**.
4. **DB instance identifier:** `red-social-sqlserver` · **Master username:** `admin` · contraseña segura (guárdala).
5. **Instance class:** `db.t3.micro` · **Storage:** 20 GiB gp2.
6. **Connectivity:** VPC `insta` · *DB subnet group:* nuevo · **Public access: No** · grupo de seguridad
   `sg-bd-insta` · puerto 1433.
7. **Additional configuration → Backup retention period:** 7 días.
8. **Create database**. Tarda 10–20 minutos. Copia el **Endpoint**
   (ej. `red-social-sqlserver.abc123.us-east-1.rds.amazonaws.com`).

Las tablas se crean en el paso **A6b**, cuando ya exista la EC2.

## A5 · Llaves de Google Login y reCAPTCHA

**Google Login**
1. https://console.cloud.google.com → crea un proyecto → **APIs y servicios → Pantalla de consentimiento de OAuth**
   (tipo *Externo*; nombre de la app y tu correo) → publica la app (*Publicar aplicación*).
2. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
3. **Orígenes de JavaScript autorizados:** `https://<midominio.com>`, `https://www.<midominio.com>`,
   `http://localhost:5173`, `http://localhost:3000`.
4. Copia el **ID de cliente** → `GOOGLE_CLIENT_ID`.

**reCAPTCHA**
1. https://www.google.com/recaptcha/admin → **+** → tipo **reCAPTCHA v2 → casilla "No soy un robot"**.
2. Dominios: `<midominio.com>` y `localhost`.
3. **Clave del sitio** → `RECAPTCHA_SITE_KEY` · **Clave secreta** → `RECAPTCHA_SECRET`.

## A6 · Instancia EC2 t2.small

1. **EC2 → Launch instance** → nombre `red-social-insta`.
2. **Ubuntu Server 24.04 LTS (64-bit x86)** · tipo **t2.small**.
3. **Key pair → Create new key pair** → `red-social-insta` · RSA · **.pem** (se descarga: es un entregable).
4. **Network settings → Edit:** VPC `insta` · una **subred pública** · *Auto-assign public IP:* Enable ·
   grupo **`sg-web-insta`**.
5. Almacenamiento 20 GiB gp3.
6. **Advanced details → IAM instance profile:** `EC2-RedSocialInsta`.
7. **Launch instance**. Luego **Elastic IPs → Allocate → Associate** a la instancia.

Conéctate desde PowerShell en la carpeta donde está el `.pem`:

```powershell
ssh -i red-social-insta.pem ubuntu@<IP-elastica>
```

> Si Windows dice que el archivo `.pem` tiene permisos muy abiertos: clic derecho → Propiedades → Seguridad →
> Opciones avanzadas → Deshabilitar herencia → deja solo a tu usuario con *Lectura*.

## A6b · Crear las tablas en RDS desde SSMS (túnel SSH por la EC2)

La base es privada: tu computadora llega a ella **a través de la EC2** con un túnel SSH.

1. En PowerShell (déjala abierta mientras trabajas en SSMS):
   ```powershell
   ssh -i red-social-insta.pem -N -L 14330:<endpoint-de-RDS>:1433 ubuntu@<IP-elastica>
   ```
2. SSMS → **Connect** → *Server name:* `localhost,14330` · **SQL Server Authentication** · `admin` / tu
   contraseña maestra · marca **Trust server certificate** → **Connect**.
3. Ejecuta **`basededatos/sqlserver/01-crear-base.sql`** (F5).
4. En la lista de bases de la barra elige **red_social_insta** y ejecuta **`02-tablas.sql`**.
5. Cambia la contraseña de `insta_app` en **`03-usuarios.sql`** y ejecútalo.
6. Cierra el túnel con `Ctrl + C`.

## A7 · Instalar la aplicación en la EC2

```bash
git clone https://github.com/<usuario>/RedSocial_Insta.git
cd RedSocial_Insta
# Certificado de Amazon RDS para verificar la conexión cifrada a SQL Server
curl -o rds-global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
cp .env.example .env
nano .env
```

`.env` de producción (opción A):

```ini
PUERTO=3000
NODE_ENV=production
CORS_ORIGEN=https://<midominio.com>

DB_MOTOR=mssql
DB_HOST=<endpoint-de-RDS>
DB_PUERTO=1433
DB_INSTANCIA=
DB_NOMBRE=red_social_insta
DB_USUARIO=insta_app
DB_CLAVE=<contraseña de insta_app>
DB_CIFRAR=true
DB_CONFIAR_CERTIFICADO=false
DB_CA_ARCHIVO=/home/ubuntu/RedSocial_Insta/rds-global-bundle.pem

JWT_SECRETO=<genera uno: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
ALMACENAMIENTO=s3
AWS_REGION=us-east-1
S3_BUCKET=<grupo>-insta-fotos
REKOGNITION=on
GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com
RECAPTCHA_SITE_KEY=<clave del sitio>
RECAPTCHA_SECRET=<clave secreta>
```

Guarda con `Ctrl+O`, `Enter`, `Ctrl+X`. Instala todo (Node 20, Nginx, PM2, compilación de React y HTTPS):

```bash
sudo bash despliegue/instalar-ec2.sh <midominio.com>
```

Comprueba: `curl http://localhost:3000/salud` → `{"estado":"ok","almacenamiento":"s3"}` y
`pm2 logs red-social-insta` debe mostrar `Conectado a SQL Server: red_social_insta`.

## A8 · Dominio y DNS con Route 53

1. **Route 53 → Registered domains → Register domains** → busca y compra `<midominio.com>`
   (≈ USD 14/año para `.com`; también puedes usar uno de otro registrador).
2. **Hosted zones** → la zona `<midominio.com>` (se crea sola al registrar). Si el dominio es de otro registrador,
   crea la zona y copia sus 4 registros **NS** en tu registrador.
3. **Create record:**

| Nombre | Tipo | Valor | TTL |
|---|---|---|---|
| `<midominio.com>` | A | `<IP elástica>` | 300 |
| `www.<midominio.com>` | CNAME | `<midominio.com>` | 300 |

4. Cuando `nslookup <midominio.com>` devuelva la IP elástica, activa HTTPS (si el script no pudo):
   ```bash
   sudo certbot --nginx -d <midominio.com> -d www.<midominio.com>
   ```

## A9 · Usuario IAM para el docente

1. **IAM → Policies → Create policy → JSON** →
   [`despliegue/politica-docente.json`](../despliegue/politica-docente.json) (cambia `ID-DE-CUENTA`,
   `ID-DE-INSTANCIA` y `NOMBRE-DEL-BUCKET`) → nombre `Docente-IniciarDetener`.
2. **IAM → Users → Create user** `docente-desarrollo-web` → *Provide user access to the AWS Management Console* →
   contraseña personalizada → adjunta la política.
3. **Prueba la credencial**: en una ventana privada entra a `https://<ID-DE-CUENTA>.signin.aws.amazon.com/console`,
   detén e inicia la instancia y la base de datos.

## A10 · Antes de entregar

- [ ] Deja la base precargada: crea 2–3 cuentas de prueba con publicaciones, historias y seguidores.
- [ ] Revisa en `https://<midominio.com>`: login con Google, reCAPTCHA, subir foto, rostros y transformaciones.
- [ ] **Detén la EC2** (*Instance state → Stop*) y **la base** (*RDS → Actions → Stop temporarily*;
      RDS se vuelve a encender sola a los 7 días).
- [ ] Al encender: primero RDS, luego la EC2. La IP elástica se conserva y PM2 arranca la app solo.

---

# Opción B · EC2 + Azure SQL Database

Igual que la opción A, pero en lugar del paso **A4** se usa Azure SQL:

1. Activa **Azure for Students**: https://azure.microsoft.com/es-es/free/students (no pide tarjeta).
2. Portal de Azure → **Azure SQL** → **SQL databases** → **Create**.
   - Si aparece el banner **"Want to try Azure SQL Database for free?" → Apply offer**.
   - *Resource group:* nuevo `rg-insta` · *Database name:* **`red_social_insta`**.
   - *Server:* **Create new** → nombre `<grupo>-insta-sql` · región **East US** ·
     *Authentication:* **Use SQL authentication** → usuario `adminsql` + contraseña.
   - *Workload environment:* Development.
3. **Networking:** *Connectivity method:* **Public endpoint** · **Add current client IP address: Yes**.
4. **Review + create**.
5. Servidor → **Networking** → agrega una regla de firewall con la **IP elástica de tu EC2** (nombre `ec2-insta`).

**Crear tablas desde SSMS:**

1. *Server name:* `<grupo>-insta-sql.database.windows.net` · **SQL Server Authentication** · `adminsql`.
2. **Options >> → Connection Properties → Connect to database:** `red_social_insta` → **Connect**.
3. Ejecuta **`02-tablas.sql`** y luego **`03-usuarios-azure.sql`** (cambia la contraseña).
   **No** ejecutes `01-crear-base.sql` ni `03-usuarios.sql` en Azure.

**`.env` en la EC2 (cambia solo la parte de base de datos):**

```ini
DB_MOTOR=mssql
DB_HOST=<grupo>-insta-sql.database.windows.net
DB_PUERTO=1433
DB_NOMBRE=red_social_insta
DB_USUARIO=insta_app
DB_CLAVE=<contraseña de insta_app>
DB_CIFRAR=true
DB_CONFIAR_CERTIFICADO=false
DB_CA_ARCHIVO=
```

---

# Opción C · Azure VM + Azure SQL Database (+ S3 y Route 53)

1. Crea la base como en la **opción B**.
2. Portal de Azure → **Virtual machines → Create**:
   - Imagen **Ubuntu Server 24.04 LTS** · tamaño **B1s** o **B2s** (2 GB de RAM o más) · autenticación con
     **SSH public key** (descarga la llave `.pem`).
   - Puertos de entrada: **HTTP (80), HTTPS (443), SSH (22)**.
3. En el servidor de Azure SQL → **Networking** → agrega la **IP pública de la VM**.
4. Como la VM no está en AWS, la app necesita **llaves de un usuario IAM** para usar S3:
   **IAM → Users → Create user** `app-insta-s3` (sin consola) → adjunta la política
   `RedSocialInsta-S3-Rekognition` → **Security credentials → Create access key** (*Application running outside
   AWS*). Agrega en el `.env`:
   ```ini
   AWS_ACCESS_KEY_ID=<access key>
   AWS_SECRET_ACCESS_KEY=<secret key>
   ```
5. Conéctate por SSH (`ssh -i llave.pem azureuser@<IP-VM>`) y sigue el paso **A7** (el usuario de la VM es
   `azureuser` en lugar de `ubuntu`).
6. **Route 53**: el registro **A** apunta a la **IP pública de la VM de Azure** (en Azure, configúrala como
   *Static* en la IP pública de la VM).
7. Para el docente: crea un usuario en **Microsoft Entra ID** con el rol **Virtual Machine Contributor** sobre la VM
   (puede iniciarla y detenerla).

---

## Actualizar la aplicación después de cambios

```bash
cd ~/RedSocial_Insta && bash despliegue/actualizar.sh
```

## Comandos útiles en el servidor

| Acción | Comando |
|---|---|
| Ver estado | `pm2 status` |
| Ver registros | `pm2 logs red-social-insta` |
| Reiniciar la app | `pm2 restart red-social-insta` |
| Probar Nginx | `sudo nginx -t && sudo systemctl reload nginx` |
| Salud | `curl http://localhost:3000/salud` |

## Entregables para el docente

| Entregable | Valor |
|---|---|
| URL de la aplicación | `https://<midominio.com>` |
| Inicio de sesión de AWS | `https://<ID-DE-CUENTA>.signin.aws.amazon.com/console` |
| Usuario / contraseña IAM | `docente-desarrollo-web` / `<contraseña>` |
| Región | us-east-1 (N. Virginia) |
| ID de la instancia EC2 | `i-...` |
| Base de datos | `red-social-sqlserver` (RDS) o `<grupo>-insta-sql` (Azure) |
| Par de claves SSH | `red-social-insta.pem` · usuario `ubuntu` |
| Cuentas de prueba en la app | `<usuario>` / `<contraseña>` |
| Repositorio | `https://github.com/<usuario>/RedSocial_Insta` |
