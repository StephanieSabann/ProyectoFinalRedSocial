# 00 · Correr el proyecto en tu computadora (Windows + SQL Server + SSMS)

Tiempo aproximado: 30–40 minutos la primera vez.

## Qué necesitas instalado

| Programa | Para qué | Descarga |
|---|---|---|
| **SQL Server 2022 Express** | El servidor de base de datos | https://www.microsoft.com/es-es/sql-server/sql-server-downloads → *Express* |
| **SQL Server Management Studio (SSMS)** | Administrar la base y ejecutar los scripts | https://aka.ms/ssmsfullsetup |
| **Node.js 20 LTS** (o 22) | Correr el backend y el frontend | https://nodejs.org |
| **Visual Studio Code** | Editar el código | https://code.visualstudio.com |

> SSMS solo es el programa para administrar. Lo que guarda los datos es **SQL Server**. Si ya puedes abrir SSMS y
> conectarte a algo como `localhost\SQLEXPRESS`, ya lo tienes instalado; sigue al paso 2.

---

## Paso 1 · Instalar SQL Server Express

1. Ejecuta el instalador de SQL Server 2022 Express → elige **Básica** (*Basic*) → acepta → **Instalar**.
2. Al terminar, anota el **nombre de la instancia**: normalmente `SQLEXPRESS`.
   La cadena para conectarte será `localhost\SQLEXPRESS`.
3. Instala SSMS (siguiente, siguiente, instalar).

## Paso 2 · Configurar SQL Server para que Node.js se pueda conectar

Node.js se conecta por red (TCP/IP) y con **usuario y contraseña de SQL Server**. Las dos cosas vienen
desactivadas en SQL Server Express, así que hay que activarlas una sola vez.

### 2.1 Activar la autenticación de SQL Server (modo mixto)

1. Abre **SSMS** → *Server name:* `localhost\SQLEXPRESS` · *Authentication:* **Windows Authentication** ·
   marca **Trust server certificate** → **Connect**.
2. En el Explorador de objetos, clic derecho sobre el servidor (la primera línea) → **Properties**.
3. Página **Security** → elige **SQL Server and Windows Authentication mode** → **OK**.

### 2.2 Activar TCP/IP y fijar el puerto 1433

1. Abre **SQL Server 2022 Configuration Manager** (búscalo en el menú Inicio).
2. **SQL Server Network Configuration** → **Protocols for SQLEXPRESS** → clic derecho en **TCP/IP** → **Enable**.
3. Doble clic en **TCP/IP** → pestaña **IP Addresses** → baja hasta **IPAll**:
   - **TCP Dynamic Ports:** déjalo **vacío** (borra el 0 o el número que tenga).
   - **TCP Port:** `1433`.
   - **OK**.
4. **SQL Server Services** → clic derecho en **SQL Server (SQLEXPRESS)** → **Restart**.

> Con esto la app se conecta a `localhost:1433`. Si prefieres no fijar el puerto, usa `DB_INSTANCIA=SQLEXPRESS`
> en el `.env` y enciende el servicio **SQL Server Browser** en el mismo Configuration Manager.

## Paso 3 · Crear la base de datos con el script

1. En SSMS: **File → Open → File...** → abre `basededatos\sqlserver\00-TODO-EN-UNO-local.sql`.
2. (Opcional) Busca `Insta_App_Cambiar_2026!` y cámbiala por tu propia contraseña. Debe tener mayúsculas,
   minúsculas, números y un símbolo.
3. Presiona **F5** (o **Execute**). Al final debe decir:
   ```
   Base de datos red_social_insta creada.
   Tablas, vista y procedimiento listos en red_social_insta
   Usuarios insta_app e insta_respaldo listos.
   ```
4. Clic derecho en **Databases** → **Refresh**: verás `red_social_insta` con 11 tablas.

**Comprueba el usuario de la app:** en SSMS, *Connect → Database Engine* → `localhost\SQLEXPRESS` ·
**SQL Server Authentication** · Login `insta_app` · tu contraseña → **Connect**. Si entra, todo está bien.

> Si prefieres hacerlo por partes: ejecuta `01-crear-base.sql`, luego `02-tablas.sql` (con la base
> **red_social_insta** elegida en la lista desplegable de la barra de SSMS) y luego `03-usuarios.sql`.

## Paso 4 · Configurar el proyecto

Abre la carpeta `RedSocial_Insta` en VS Code y en la terminal (**Terminal → New Terminal**):

```powershell
Copy-Item .env.example .env
```

Abre `.env` y revisa estas líneas:

```ini
DB_MOTOR=mssql
DB_HOST=localhost
DB_PUERTO=1433
DB_INSTANCIA=
DB_NOMBRE=red_social_insta
DB_USUARIO=insta_app
DB_CLAVE=Insta_App_Cambiar_2026!      # la misma contraseña del paso 3
DB_CIFRAR=true
DB_CONFIAR_CERTIFICADO=true
JWT_SECRETO=escribe_aqui_un_texto_largo_y_secreto
ALMACENAMIENTO=local
```

> Si no fijaste el puerto 1433 en el paso 2.2: deja `DB_PUERTO` como está y pon `DB_INSTANCIA=SQLEXPRESS`.

## Paso 5 · Instalar dependencias y arrancar

**Terminal 1 — backend (API):**

```powershell
npm install
npm run dev
```

Debe decir:

```
Servidor escuchando en http://localhost:3000
Conectado a SQL Server: red_social_insta en localhost
```

**Terminal 2 — frontend (React).** Abre otra terminal con el **+** del panel:

```powershell
cd frontend
npm install
npm run dev
```

Abre **http://localhost:5173** en el navegador, crea una cuenta y sube una foto.

## Paso 6 · Comprobar que todo funciona

| Prueba | Qué debe pasar |
|---|---|
| Registrarte | Entras directo al inicio |
| Crear → elegir una foto con una cara | Aparece "Se detectaron 1 rostro" y un recuadro |
| Compartir y tocar la miniatura | Se ve la foto completa con Original / Blanco y negro / Sepia / Escala 50 % |
| En SSMS: `SELECT * FROM dbo.vw_imagenes_por_usuario;` | Aparece la ubicación de cada versión de tu foto |
| En SSMS: `SELECT TOP 20 * FROM dbo.auditoria ORDER BY id DESC;` | Aparecen REGISTRO, LOGIN y PUBLICACION_CREAR |
| En SSMS: `SELECT username, password_salt, password_hash FROM dbo.usuario;` | Cada usuario tiene una sal distinta |

Las fotos quedan en la carpeta `imagenes\` mientras `ALMACENAMIENTO=local`. En la nube se guardan en S3.

## Google Login y reCAPTCHA en tu computadora (opcional)

Sin llaves la app funciona: el botón de Google no aparece y el reCAPTCHA se omite. Para probarlos:

1. Crea las llaves como dice `docs/02-instrucciones-despliegue.md`, paso 5. En Google agrega como origen
   `http://localhost:5173`; en reCAPTCHA agrega el dominio `localhost`.
2. Pon en `.env`: `GOOGLE_CLIENT_ID`, `RECAPTCHA_SITE_KEY` y `RECAPTCHA_SECRET`.
3. Reinicia el backend (`Ctrl + C` y `npm run dev`) y recarga la página.

## Problemas comunes

| Mensaje en la terminal | Solución |
|---|---|
| `Failed to connect to localhost:1433 - Could not connect (sequence)` o `ECONNREFUSED` | TCP/IP no está activo o el servicio no se reinició (paso 2.2). O usa `DB_INSTANCIA=SQLEXPRESS` |
| `Login failed for user 'insta_app'` | Falta el modo mixto (paso 2.1, y reiniciar el servicio) o la contraseña de `.env` no coincide |
| `Cannot open database "red_social_insta" requested by the login` | No ejecutaste el script del paso 3 |
| `self signed certificate` / `certificate` | Pon `DB_CONFIAR_CERTIFICADO=true` en `.env` |
| `Faltan tablas. Ejecuta basededatos/sqlserver/02-tablas.sql` | Ejecuta `02-tablas.sql` con la base `red_social_insta` elegida |
| `Access denied for user 'root'` (MySQL) | Tu `.env` dice `DB_MOTOR=mysql` o no existe el `.env`: créalo con el paso 4 |
| La página de `localhost:3000` dice "Compila el frontend" | Normal en desarrollo: usa `http://localhost:5173` |
| `npm` no se reconoce | Instala Node.js y abre de nuevo VS Code |
