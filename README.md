# Studia — Aplicación de Escritorio (`studia-frontend`)

**Studia** es una aplicación de escritorio para estudiantes universitarios construida con **Tauri 2**, **React 19**, **TypeScript**, **Vite** y **Rust**. Permite gestionar materias, horarios de clases, tareas, calendario de actividades, sesiones de concentración (con bloqueo de aplicaciones de escritorio y sitios web en Windows), planificación inteligente del estudio y un **Asistente Académico con IA** conectado a **Google Gemini** a través de `studia-backend`.

---

## 1. Requisitos de desarrollo

Para compilar y ejecutar Studia desde el código fuente necesitas:

- **Sistema Operativo:** Windows 10/11 (64 bits).
- **Node.js:** `v22.0.0` o superior y **npm**.
- **Rust y Cargo:** Toolchain estable (`rustup` con target MSVC).
- **Microsoft Visual Studio C++ Build Tools** y **WebView2 Runtime** (incluido en Windows 10/11).

> **Nota para distribución:** El usuario final (por ejemplo, el profesor que instala Studia mediante el instalador `.msi` o `.exe`) **no** necesita instalar Node.js, Rust, ni configurar variables de entorno ni claves API.

---

## 2. Instalación de dependencias

En una terminal de **PowerShell**, instala las dependencias del frontend:

```powershell
cd C:\Users\majos\OneDrive\Escritorio\proyectos-InterfacesDeSoftware\Studia\studia-frontend
npm install
```

---

## 3. Configuración de variables de entorno

Studia separa estrictamente la configuración del servidor y la del cliente de escritorio:

1. **En el servidor (`../studia-backend`):**
   - `GEMINI_API_KEY`: Clave privada de Google AI Studio (almacenada **únicamente** en el servidor).
   - `GEMINI_MODEL`: Modelo de Gemini (por defecto `gemini-3.5-flash-lite`).
2. **En la aplicación de escritorio (`studia-frontend`):**
   - **Nunca** incluye `GEMINI_API_KEY`.
   - En desarrollo (`npm run tauri dev`), usa automáticamente `http://127.0.0.1:3000` (definido en `src/config/apiConfig.ts`).
   - Para producción (`npm run tauri build`), utiliza la variable `VITE_STUDIA_BACKEND_URL` con la URL pública HTTPS donde esté desplegado `studia-backend`.

---

## 4. Cómo ejecutar el backend y Studia en desarrollo local

Abre **dos terminales de PowerShell**:

### Terminal 1 — Iniciar `studia-backend`
```powershell
cd C:\Users\majos\OneDrive\Escritorio\proyectos-InterfacesDeSoftware\Studia\studia-backend
$env:GEMINI_API_KEY = "TU_CLAVE_PRIVADA_AQUI"
$env:GEMINI_MODEL = "gemini-3.5-flash-lite"
npm run dev
```

### Terminal 2 — Iniciar la aplicación de escritorio Studia
```powershell
cd C:\Users\majos\OneDrive\Escritorio\proyectos-InterfacesDeSoftware\Studia\studia-frontend
npm run tauri dev
```

Una vez abierta la ventana de Studia, ve a la pestaña **Asistente IA** y envía cualquier consulta sobre tus materias, tareas o planificación semanal.

---

## 5. Cómo ejecutar las pruebas automatizadas y probar la conexión con Gemini

### A. Pruebas automatizadas del backend (con mocks, sin gastar cuota)
```powershell
cd ..\studia-backend
npm test
```

### B. Pruebas automatizadas del frontend (validaciones de horario, tareas y privacidad de contexto IA)
```powershell
cd ..\studia-frontend
node --experimental-strip-types src/scheduleValidation.test.ts
node --experimental-strip-types src/aiIntegration.test.ts
```

### C. Pruebas automatizadas de Rust (bloqueo de apps/sitios, IPC y servicio IA)
```powershell
cd ..\studia-frontend
cargo test --manifest-path src-tauri/Cargo.toml
```

### D. Prueba manual de conexión real con Gemini (opcional, para diagnóstico en desarrollo)
```powershell
cd ..\studia-backend
$env:GEMINI_API_KEY = "TU_CLAVE_PRIVADA_AQUI"
npm run test:live-gemini
```

---

## 6. Despliegue del backend y configuración de la URL de producción

Antes de generar el instalador definitivo para entregar a tu profesor, el backend debe estar desplegado en una URL pública HTTPS (por ejemplo, en **Render**):

1. Despliega la carpeta `studia-backend` en Render siguiendo las instrucciones de `../studia-backend/README.md`.
2. Configura `GEMINI_API_KEY` y `GEMINI_MODEL=gemini-3.5-flash-lite` en el panel de variables de entorno de Render.
3. Obtén la URL pública de tu servicio (por ejemplo, `https://studia-backend.onrender.com`).
4. Configura esa URL en `studia-frontend` antes de compilar el instalador mediante cualquiera de estas dos opciones:
   - **Opción 1 (Variable de entorno en PowerShell antes del build):**
     ```powershell
     $env:VITE_STUDIA_BACKEND_URL = "https://tu-servicio-studia-backend.onrender.com"
     ```
   - **Opción 2 (Constante en `src/config/apiConfig.ts`):**
     Actualiza el valor de `CONFIGURED_PRODUCTION_BACKEND_URL` en `src/config/apiConfig.ts`.

> **Protección integrada:** Si intentas usar el asistente en una compilación de producción sin haber configurado la URL pública (o si apunta por error a `localhost`), Studia detectará la falta de configuración y mostrará un mensaje controlado sin intentar conectarse al `localhost` del computador del profesor.

---

## 7. Cómo generar y probar el instalador de Windows

1. Asegúrate de haber compilado también el ejecutable auxiliar de bloqueo web (`studia-helper.exe`) en modo `release` y ejecuta `tauri build`:
   ```powershell
   cd C:\Users\majos\OneDrive\Escritorio\proyectos-InterfacesDeSoftware\Studia\studia-frontend
   $env:VITE_STUDIA_BACKEND_URL = "https://tu-servicio-studia-backend.onrender.com"
   cargo build --manifest-path src-tauri/Cargo.toml --release --bins
   npm run tauri build
   ```
2. **Ubicación de los instaladores generados:**
   - **Instalador NSIS (`.exe`):** `src-tauri/target/release/bundle/nsis/tauri-app_0.1.0_x64-setup.exe`
   - **Instalador Windows Installer (`.msi`):** `src-tauri/target/release/bundle/msi/tauri-app_0.1.0_x64_en-US.msi`
3. **Cómo probar el instalador en otro computador:**
   - Copia el instalador `.exe` o `.msi` al computador de prueba e instálalo.
   - Abre Studia: verifica el onboarding inicial, la creación de materias/horarios, tareas, el planificador determinista y el Modo Enfoque.
   - Con conexión a Internet activa, abre la pestaña **Asistente IA** y realiza una consulta para verificar que responde a través del backend desplegado sin pedir ninguna clave API.

---

## 8. Funciones disponibles sin conexión a Internet (Modo Offline)

Studia está diseñada con arquitectura **Local-First**:
- **Funcionan 100% sin Internet:** Gestión de perfil, materias, horario semanal con detección de cruces, tareas académicas, calendario de actividades, **Planificador Inteligente determinista**, temporizador Pomodoro, estadísticas de progreso, bloqueo de aplicaciones de escritorio y bloqueo de sitios web.
- **Requiere conexión a Internet y backend activo:** Únicamente la conversación en tiempo real dentro de la pestaña **Asistente IA**. Si no hay conexión o el backend está inactivo, el chat informa el problema de forma clara y permite reintentar sin afectar el resto de la aplicación.
