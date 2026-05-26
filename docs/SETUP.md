# 🚀 NeuroAlert · Guía paso a paso para correr el proyecto

> Yeremi: esta guía está escrita asumiendo que **NO tienes nada instalado**. Te llevo de la mano desde cero hasta ver la app funcionando en tu navegador. Léela completa **una vez** antes de empezar a ejecutar nada. Cada paso tiene una sección "✅ ¿Cómo sé que funcionó?" para que verifiques antes de avanzar.

---

## 📌 Resumen rápido

Esto es lo que vas a hacer:
1. Instalar 4 herramientas en tu Windows: **WSL2**, **Docker Desktop**, **Git** y **VS Code** (15-30 min, una sola vez en tu vida).
2. Descomprimir el proyecto y ponerlo en una carpeta.
3. Configurar un archivo de variables de entorno (copy/paste literal).
4. Ejecutar **un solo comando**: `docker compose up`.
5. Abrir el navegador y verlo funcionando.

Si algo no funciona, hay una sección de troubleshooting al final.

---

## PASO 1 · Instalar WSL2 (Windows Subsystem for Linux 2)

WSL2 es lo que permite que Docker corra "Linux dentro de Windows". Sin esto, Docker Desktop no funciona.

### 1.1 Abrir PowerShell como administrador

1. Haz clic en el botón de **Inicio** de Windows.
2. Escribe `PowerShell`.
3. Haz **clic derecho** sobre "Windows PowerShell" → **Ejecutar como administrador**.
4. Si aparece "¿Quieres permitir que esta app...?", clic en **Sí**.

### 1.2 Ejecutar el comando de instalación

Copia y pega exactamente esto en PowerShell, presiona **Enter**:

```powershell
wsl --install
```

Esto va a:
- Activar las características de Windows necesarias.
- Descargar e instalar el kernel de Linux.
- Instalar Ubuntu como distribución por defecto.

**⏰ Esto tarda 5-10 minutos.** Verás texto en pantalla, déjalo terminar.

### 1.3 Reiniciar la computadora

Cuando termine, **reinicia tu PC**. Es obligatorio.

### 1.4 Configurar Ubuntu

Después de reiniciar, Ubuntu se abrirá automáticamente y te pedirá:
- **Username:** pon el que quieras (ej: `yeremi`). Debe ser todo en minúsculas, sin espacios.
- **Password:** crea una contraseña que recuerdes. **No verás ningún caracter mientras escribes** — eso es normal en Linux. Escríbela y dale Enter, luego te la pedirá una segunda vez para confirmar.

### ✅ ¿Cómo sé que WSL2 funcionó?

En PowerShell ejecuta:
```powershell
wsl --version
```

Si te muestra algo como "WSL versión: 2.x.x", está perfecto.

---

## PASO 2 · Instalar Docker Desktop

Docker es el "motor" que va a correr toda la app. Es como una caja mágica que contiene todo lo que el proyecto necesita.

### 2.1 Descargar

1. Ve a: **https://www.docker.com/products/docker-desktop/**
2. Clic en **Download for Windows**.
3. Espera a que se descargue el archivo `Docker Desktop Installer.exe` (~600 MB).

### 2.2 Instalar

1. **Doble clic** en el archivo descargado.
2. En la primera pantalla, asegúrate de que esté **marcada** la opción "Use WSL 2 instead of Hyper-V".
3. Clic en **Ok** y deja que instale.
4. Cuando termine, te pedirá **cerrar sesión y volver a iniciar sesión en Windows**. Hazlo.

### 2.3 Primer arranque

1. Abre **Docker Desktop** desde el menú Inicio.
2. La primera vez te pedirá aceptar términos de servicio. Acepta.
3. Si te pregunta sobre login, **puedes saltarlo** ("Skip" o "Continue without signing in").
4. Espera a que el ícono de la ballena de Docker (esquina inferior derecha de Windows) **deje de animarse**. Eso significa que está listo.

### ✅ ¿Cómo sé que Docker funcionó?

Abre PowerShell y ejecuta:
```powershell
docker --version
docker compose version
```

Debes ver algo como:
- `Docker version 27.x.x`
- `Docker Compose version v2.x.x`

Si te dice "command not found", **reinicia Docker Desktop** y espera 1 min antes de probar de nuevo.

---

## PASO 3 · Instalar Git y VS Code

### 3.1 Git

1. Descarga desde: **https://git-scm.com/download/win**
2. Doble clic en el `.exe` descargado.
3. **Acepta todas las opciones por defecto** clicando "Next" hasta el final.

✅ Verifica con: `git --version`

### 3.2 VS Code

1. Descarga desde: **https://code.visualstudio.com/**
2. Instala con opciones por defecto.
3. Asegúrate de que esté marcada **"Add to PATH"**.

---

## PASO 4 · Descomprimir y abrir el proyecto

### 4.1 Crear la carpeta de proyectos

1. Abre el **Explorador de archivos** (la carpeta amarilla).
2. Ve a `C:\Users\TuNombre\` (donde "TuNombre" es tu usuario de Windows).
3. Crea una carpeta nueva: **clic derecho → Nuevo → Carpeta** → llámala `proyectos`.

### 4.2 Descomprimir el zip

1. Toma el archivo `neuroalert.zip` que te dio Claude.
2. **Clic derecho → Extraer todo...**
3. Como destino, elige `C:\Users\TuNombre\proyectos\`
4. Clic en **Extraer**.

Resultado: deberías tener una carpeta `C:\Users\TuNombre\proyectos\neuroalert\` con todos los archivos dentro.

### 4.3 Abrir en VS Code

1. Abre VS Code.
2. **File → Open Folder...**
3. Navega hasta `C:\Users\TuNombre\proyectos\neuroalert` y clic **Select Folder**.
4. Si te pregunta "Do you trust the authors?", clic en **Yes, I trust the authors**.

---

## PASO 5 · Configurar las variables de entorno (CRÍTICO)

Esto es lo único que tienes que editar manualmente. Es un archivo donde van los secretos.

### 5.1 Abrir terminal en VS Code

1. En VS Code, presiona **Ctrl + Ñ** (o ` ` ` debajo de Esc).
2. Se abrirá una terminal abajo.
3. Asegúrate de que diga **PowerShell** o **pwsh** en la esquina superior derecha de la terminal. Si dice `cmd`, dale al menú desplegable y elige PowerShell.

### 5.2 Copiar el archivo

En la terminal de VS Code, ejecuta:

```powershell
Copy-Item .env.example .env
```

Esto crea una copia del archivo de ejemplo llamada `.env`.

### 5.3 Generar secrets seguros

Los secrets son contraseñas largas que la app usa internamente. Los generamos así:

```powershell
# Genera 4 secrets aleatorios y los muestra:
1..4 | ForEach-Object {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
  [Convert]::ToBase64String($bytes)
}
```

Te mostrará 4 líneas como esta (las tuyas serán distintas):
```
hQ7T+9k3xR2nFzL8mP4vWyA1bC6dE5fG8hI2jK4lM5o=
xR9k7L3mP4vN8wQ2yA1bC6dE5fG8hI2jK4lM5oR9k7L=
F8hI2jK4lM5oR9k7L3mP4vN8wQ2yA1bC6dE5fG8hI2j=
4vN8wQ2yA1bC6dE5fG8hI2jK4lM5oR9k7L3mP4vN8wQ=
```

**Cópialas, las vamos a usar en el siguiente paso.**

### 5.4 Editar el archivo `.env`

1. En VS Code, en el panel izquierdo, busca el archivo `.env` (sin extensión visible).
2. Doble clic para abrirlo.
3. Verás muchas líneas. Busca estas y reemplaza los valores:

```env
# Sustituye CADA UNA con uno de los secrets que generaste
JWT_ACCESS_SECRET=PEGA_AQUÍ_EL_PRIMERO
JWT_REFRESH_SECRET=PEGA_AQUÍ_EL_SEGUNDO
COOKIE_SECRET=PEGA_AQUÍ_EL_TERCERO
SESSION_SECRET=PEGA_AQUÍ_EL_CUARTO
```

4. **Para Resend (envío de correos)**: déjalo vacío:
```env
RESEND_API_KEY=
```
La app funcionará perfectamente sin esto. Los correos saldrán impresos en la consola de Docker (puedes verlos ahí).

5. **Guarda con Ctrl + S**.

### ✅ ¿Cómo sé que está bien?

Abre el archivo `.env` y verifica:
- Las 4 variables `*_SECRET` tienen un valor largo (no están vacías).
- `DATABASE_URL` apunta a `postgres:5432` (no a `localhost`).
- No has dejado ningún `cambialo` en el archivo.

---

## PASO 6 · ¡LEVANTAR EL PROYECTO! 🚀

Este es el momento mágico. Un solo comando.

### 6.1 Asegúrate de que Docker Desktop esté abierto

Mira el ícono de la ballena en la esquina inferior derecha de Windows. Si no está, abre **Docker Desktop** desde el menú Inicio y espera a que termine de cargar.

### 6.2 Levantar todo

En la terminal de VS Code, ejecuta:

```powershell
cd infra
docker compose -f docker-compose.dev.yml up --build
```

**¿Qué va a pasar?**
- La primera vez tarda **10-20 minutos** (descarga ~3 GB de imágenes Docker).
- Verás MUCHO texto pasando. **Esto es normal**, no te asustes.
- Texto en color **rojo** que diga "warning" → ignóralo, no es error.
- Texto en **rojo** que diga "error" → eso sí es problema (ve a troubleshooting).

### 6.3 Saber cuándo terminó

Cuando veas algo así, ya está listo:

```
neuroalert-backend   | 🚀 NeuroAlert API corriendo en http://localhost:4000
neuroalert-frontend  | ▲ Next.js 15.x.x
neuroalert-frontend  | - Local:        http://localhost:3000
neuroalert-frontend  | ✓ Ready in 4.2s
```

**No cierres esa terminal.** Mientras esa terminal esté abierta y corriendo, la app está viva.

---

## PASO 7 · Inicializar la base de datos (PRIMERA VEZ SOLAMENTE)

La BD está creada pero vacía. Hay que aplicar migraciones y cargar datos de ejemplo.

### 7.1 Abrir una SEGUNDA terminal en VS Code

1. **No cierres** la terminal donde corre `docker compose`.
2. Arriba de esa terminal, hay un ícono **"+"** para abrir otra terminal nueva.
3. Clic ahí.

### 7.2 Aplicar migraciones

En la nueva terminal:

```powershell
docker compose -f infra/docker-compose.dev.yml exec backend npx prisma migrate deploy
```

Verás:
```
✔ All migrations have been successfully applied.
```

### 7.3 Cargar datos de ejemplo (seed)

```powershell
docker compose -f infra/docker-compose.dev.yml exec backend npx prisma db seed
```

Verás:
```
✅ Seed completado:
   👨‍💼 Admin:        admin@neuroalert.pe / Password2026!
   👩‍⚕️ Especialista: pediatra@neuroalert.pe / Password2026!
   👪 Padre:        padre@neuroalert.pe / Password2026!
   📚 Artículos:    4 publicados
```

### ✅ ¿Listo? ¡Sí!

---

## PASO 8 · Abrir la app en el navegador

1. Abre **Chrome / Edge / Firefox**.
2. Ve a: **http://localhost:3000**

Deberías ver la **landing page de NeuroAlert** con el "97.4%" gigante.

### Probar los 3 roles

| Rol | Email | Contraseña | Verás |
|---|---|---|---|
| 👪 **Padre** | `padre@neuroalert.pe` | `Password2026!` | Dashboard con M-CHAT-R, consultas, recursos |
| 👩‍⚕️ **Especialista** | `pediatra@neuroalert.pe` | `Password2026!` | Bandeja de consultas, gestión de artículos |
| 👨‍💼 **Admin** | `admin@neuroalert.pe` | `Password2026!` | Panel de verificación, métricas globales |

### Otras URLs útiles

- **Frontend**: http://localhost:3000
- **API**: http://localhost:4000
- **Documentación Swagger** (todos los endpoints): http://localhost:4000/api/docs
- **Prisma Studio** (BD visual, opcional): `docker compose -f infra/docker-compose.dev.yml exec backend npx prisma studio` y abrir http://localhost:5555
- **MinIO Console** (storage): http://localhost:9001 (user: `neuroalertadmin`, pass: `MinioSecurePass2026!`)

---

## PASO 9 · Subir a GitHub

### 9.1 Crear repositorio en GitHub

1. Ve a **https://github.com** y haz login.
2. Clic en el **+** arriba a la derecha → **New repository**.
3. Nombre: `neuroalert`
4. Visibilidad: **Private** (o Public si quieres mostrarlo).
5. **NO marques** "Add a README" ni nada, lo dejamos vacío.
6. Clic en **Create repository**.

### 9.2 Configurar Git la primera vez

En la terminal de VS Code:

```powershell
git config --global user.name "Tu Nombre Real"
git config --global user.email "tu_email@gmail.com"
```

### 9.3 Subir el proyecto

```powershell
# Posicionarte en la raíz del proyecto
cd C:\Users\TuNombre\proyectos\neuroalert

# Inicializar git
git init
git add .
git commit -m "feat: NeuroAlert MVP - plataforma de detección temprana del TEA"
git branch -M main

# Conectar con GitHub (reemplaza TU_USUARIO con tu usuario de GitHub)
git remote add origin https://github.com/TU_USUARIO/neuroalert.git
git push -u origin main
```

La primera vez te pedirá usuario/contraseña de GitHub. Si tienes 2FA activado, necesitas crear un **Personal Access Token**:
- GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new
- Marca el scope **repo**
- Cópialo y úsalo como contraseña.

### ✅ ¿Cómo sé que subió?

Abre tu repo `https://github.com/TU_USUARIO/neuroalert` en el navegador y deberías ver todos los archivos.

---

## 🎯 Para tu sustentación ABET

### Qué mostrar (en orden)

1. **Landing page** (http://localhost:3000) — habla del 97.4% y la brecha.
2. **Login como padre** → muestra el cuestionario M-CHAT-R completo, especialmente:
   - Las 20 preguntas validadas
   - El cálculo del riesgo en el servidor (Network tab del navegador → muestra la respuesta JSON)
   - Las recomendaciones según el nivel de riesgo
3. **Login como especialista** → tomar una consulta y responderla.
4. **Login como admin** → aprobar especialista, publicar contenido.
5. **Swagger** (http://localhost:4000/api/docs) → muestra todos los endpoints documentados.
6. **GitHub Actions** (en GitHub) → muestra el CI corriendo.
7. **El código** (VS Code):
   - `backend/src/auth/auth.service.ts` (anti-bruteforce timing-safe)
   - `backend/prisma/migrations/.../migration.sql` (políticas RLS)
   - `backend/src/storage/storage.service.ts` (validación de magic bytes)
   - `docs/SECURITY.md` (mapeo OWASP)

### Frase para el cierre

> "NeuroAlert no es solo una aplicación: es una respuesta técnica a un problema de salud pública. Cada decisión de arquitectura — desde Row-Level Security hasta el cálculo server-side del M-CHAT-R — protege a una población vulnerable: niños y sus familias. La detección temprana del TEA en Perú depende de herramientas como esta."

---

## 🆘 Troubleshooting

### Docker me dice "permission denied" o "no such file"

**Solución:** asegúrate de que Docker Desktop esté **abierto y corriendo** (ícono de ballena visible). Espera 1-2 min después de iniciarlo.

### El puerto 3000 / 4000 / 5432 está ocupado

**Solución:** otro programa está usando ese puerto. Para encontrarlo:
```powershell
netstat -ano | findstr :3000
# Verás un PID al final, ej: 12345
taskkill /PID 12345 /F
```

### `docker compose up` se queda colgado en "Building..."

**Solución:** primera vez tarda mucho. Espera al menos 20 minutos. Si pasa de 30 min sin actividad, **Ctrl+C** para cancelar y vuelve a ejecutar.

### Los correos no llegan

**Esperado:** sin RESEND_API_KEY, los correos salen impresos en la consola de Docker (la primera terminal). Eso es por diseño para que la app funcione en local sin servicios externos.

### "Module not found" en el frontend

**Solución:**
```powershell
docker compose -f infra/docker-compose.dev.yml exec frontend npm install
docker compose -f infra/docker-compose.dev.yml restart frontend
```

### Quiero borrar todo y empezar de cero

```powershell
# Esto borra contenedores, volúmenes (BD), e imágenes:
docker compose -f infra/docker-compose.dev.yml down -v
docker system prune -af
# Luego repites desde el PASO 6
```

### Cómo apagar todo cuando termines de usarlo

En la terminal donde está corriendo, presiona **Ctrl + C**. Espera a que se detengan los contenedores. Luego:
```powershell
docker compose -f infra/docker-compose.dev.yml down
```

Para volver a abrirlo después:
```powershell
docker compose -f infra/docker-compose.dev.yml up
```

---

## 📞 Si nada funciona

1. Captura de pantalla del error completo.
2. Asegúrate de que Docker Desktop esté **corriendo**.
3. Reinicia Docker Desktop (clic derecho en el ícono → Restart).
4. Si persiste, comparte la salida de:
   ```powershell
   docker compose -f infra/docker-compose.dev.yml logs --tail=100
   ```

---

**Yeremi, eso es todo. Tienes una app de salud pública lista para mostrar.** 💪
