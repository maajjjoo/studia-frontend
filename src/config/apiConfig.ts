/**
 * Configuración centralizada del servidor backend de Studia (`studia-backend`).
 *
 * - Por defecto, tanto en desarrollo (`npm run tauri dev`) como en producción (`npm run tauri build`),
 *   apunta a la URL pública del backend desplegado en Render:
 *   `https://studia-backend-8mf8.onrender.com`.
 * - Permite sobrescribir opcionalmente la URL mediante la variable `VITE_STUDIA_BACKEND_URL`
 *   (por ejemplo, para apuntar a un backend local en `http://127.0.0.1:3000` durante desarrollo).
 * - En modo producción (`isProd === true`), rechaza URLs de localhost para evitar distribuir
 *   instaladores que apunten al computador del usuario final.
 * - La clave GEMINI_API_KEY se almacena exclusivamente en el servidor backend y nunca se
 *   incluye en el frontend ni en el instalador.
 */

export const DEFAULT_BACKEND_URL = 'https://studia-backend-8mf8.onrender.com';
export const LOCAL_DEVELOPMENT_BACKEND_URL = 'http://127.0.0.1:3000';
export const DEVELOPMENT_BACKEND_URL = DEFAULT_BACKEND_URL;
export const CONFIGURED_PRODUCTION_BACKEND_URL = DEFAULT_BACKEND_URL;

export interface BackendUrlResolutionOptions {
  isProd?: boolean;
  envUrl?: string;
}

export function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}

export function resolveBackendBaseUrl(options?: BackendUrlResolutionOptions): string {
  let isProd = options?.isProd;
  let rawEnvUrl = options?.envUrl;

  if (rawEnvUrl === undefined) {
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        if (typeof import.meta.env.VITE_STUDIA_BACKEND_URL === 'string') {
          rawEnvUrl = import.meta.env.VITE_STUDIA_BACKEND_URL;
        }
      }
    } catch {
      // Entornos donde import.meta.env no está definido
    }
  }

  if (isProd === undefined) {
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        isProd = Boolean(import.meta.env.PROD);
      }
    } catch {
      // Entornos donde import.meta.env no está definido
    }
  }

  rawEnvUrl = rawEnvUrl ?? '';
  isProd = isProd ?? false;

  const trimmedEnv = rawEnvUrl.trim().replace(/\/+$/, '');

  // 1. Si se configuró explícitamente una URL (vía VITE_STUDIA_BACKEND_URL u options.envUrl):
  if (trimmedEnv.length > 0) {
    if (isProd && isLocalhostUrl(trimmedEnv)) {
      const err = new Error(
        'No se puede utilizar una URL de localhost en modo de producción para la distribución de Studia. Configura una URL pública HTTPS.'
      ) as Error & { code?: string };
      err.code = 'BACKEND_NOT_CONFIGURED';
      throw err;
    }
    return trimmedEnv;
  }

  // 2. Destino predeterminado tanto en desarrollo como en producción: Render
  const defaultUrl = DEFAULT_BACKEND_URL.trim().replace(/\/+$/, '');
  if (!defaultUrl || (isProd && isLocalhostUrl(defaultUrl))) {
    const err = new Error(
      'El servidor de IA aún no está configurado. Configura VITE_STUDIA_BACKEND_URL con la URL pública del backend.'
    ) as Error & { code?: string };
    err.code = 'BACKEND_NOT_CONFIGURED';
    throw err;
  }

  return defaultUrl;
}

/**
 * Resumen legible de la configuración activa para diagnóstico y verificación.
 */
export function getBackendConfigSummary(options?: BackendUrlResolutionOptions): {
  resolvedUrl: string;
  isCustomUrl: boolean;
  isProduction: boolean;
  defaultUrl: string;
} {
  const resolvedUrl = resolveBackendBaseUrl(options);
  const isCustomUrl = resolvedUrl !== DEFAULT_BACKEND_URL;
  const isProduction =
    options?.isProd ?? (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.PROD));
  return {
    resolvedUrl,
    isCustomUrl,
    isProduction,
    defaultUrl: DEFAULT_BACKEND_URL,
  };
}
