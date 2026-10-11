use std::collections::HashSet;
use std::time::Duration;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::path::{Path, PathBuf};
use tauri::{Manager, State};
use tokio::sync::Mutex;
use tauri::async_runtime::JoinHandle;
use sysinfo::System;

struct FocusMonitorState(Mutex<Option<(JoinHandle<()>, Arc<AtomicBool>)>>);

const ALLOWLIST: &[&str] = &[
    "discord.exe",
    "whatsapp.exe",
    "steam.exe",
    "spotify.exe",
    "telegram.exe",
    "leagueclient.exe",
];

// Comprueba si la ruta de un ejecutable cruza directorios crticos o tiene nombre protegido.
fn is_protected_path(path: &Path) -> bool {
    let path_str = path.to_string_lossy().to_lowercase();

    // Directorios protegidos (bsqueda por substring simple para atrapar cannicos y relativos)
    if path_str.contains("\\windows\\")
        || path_str.contains("\\system32\\")
        || path_str.contains("\\syswow64\\")
        || path_str.contains("\\programdata\\microsoft\\") {
        return true;
    }

    // Nombres de ejecutables crticos protegidos absolutamente (independientemente de donde estn)
    let file_name = path.file_name()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let critical_names = [
        "explorer.exe", "svchost.exe", "csrss.exe", "smss.exe",
        "wininit.exe", "lsass.exe", "services.exe", "winlogon.exe",
        "taskmgr.exe", "cmd.exe", "powershell.exe"
    ];

    if critical_names.contains(&file_name.as_str()) {
        return true;
    }

    false
}

#[tauri::command]
async fn start_focus_mode(
    apps: Vec<String>,
    custom_apps: Vec<String>, // Nuevo array de rutas absolutas provistas por React
    state: State<'_, FocusMonitorState>,
) -> Result<(), String> {
    let mut state_guard = state.0.lock().await;

    // Abort existing worker safely
    if let Some((handle, is_active)) = state_guard.take() {
        is_active.store(false, Ordering::Relaxed);
        handle.abort();
        let _ = handle.await;
    }

    // 1. Filtrar las aplicaciones predefinidas (strict allowlist)
    let allowlist_set: HashSet<&str> = ALLOWLIST.iter().copied().collect();
    let safe_apps: Vec<String> = apps
        .into_iter()
        .map(|a| a.to_lowercase())
        .filter(|a| allowlist_set.contains(a.as_str()))
        .collect();

    // 2. Filtrar y validar las rutas de las aplicaciones personalizadas (validacin estricta nativa)
    let mut safe_custom_paths: Vec<PathBuf> = Vec::new();
    for custom_app_str in custom_apps {
        let p = Path::new(&custom_app_str);
        if let Ok(canon) = std::fs::canonicalize(p) {
            // Verificar si es archivo y termina en .exe
            if canon.is_file() {
                if let Some(ext) = canon.extension() {
                    if ext.to_string_lossy().to_lowercase() == "exe" {
                        // Verificar que no sea un proceso crtico o est en System32/Windows
                        if !is_protected_path(&canon) {
                            if !safe_custom_paths.contains(&canon) {
                                safe_custom_paths.push(canon);
                            }
                        } else {
                            eprintln!("Rejected protected custom path: {:?}", canon);
                        }
                    }
                }
            }
        }
    }

    if safe_apps.is_empty() && safe_custom_paths.is_empty() {
        // Nothing to monitor
        return Ok(());
    }

    let is_active = Arc::new(AtomicBool::new(true));
    let worker_is_active = is_active.clone();

    // Spawn new worker
    let handle = tauri::async_runtime::spawn(async move {
        let mut sys = System::new_all();
        loop {
            if !worker_is_active.load(Ordering::Relaxed) {
                break;
            }

            sys.refresh_all();

            for process in sys.processes().values() {
                if !worker_is_active.load(Ordering::Relaxed) {
                    return; // Exit task completely
                }

                // Match predefinidas por nombre
                let name = process.name().to_string_lossy().to_lowercase();
                let mut should_kill = safe_apps.iter().any(|safe_app| name == *safe_app);

                // Match personalizadas por ruta cannica real (identity stricta)
                if !should_kill && !safe_custom_paths.is_empty() {
                    if let Some(proc_exe) = process.exe() {
                        if let Ok(canon_proc_exe) = std::fs::canonicalize(proc_exe) {
                            if safe_custom_paths.contains(&canon_proc_exe) {
                                should_kill = true;
                            }
                        }
                    }
                }

                if should_kill {
                    if !process.kill() {
                        eprintln!("Failed to kill {}", name);
                    }
                }
            }

            // Wait 3 seconds, responds to .abort() immediately
            tokio::time::sleep(Duration::from_secs(3)).await;
        }
    });

    *state_guard = Some((handle, is_active));

    Ok(())
}

#[tauri::command]
async fn stop_focus_mode(state: State<'_, FocusMonitorState>) -> Result<(), String> {
    let mut state_guard = state.0.lock().await;
    if let Some((handle, is_active)) = state_guard.take() {
        is_active.store(false, Ordering::Relaxed);
        handle.abort();
        let _ = handle.await;
    }
    Ok(())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(FocusMonitorState(Mutex::new(None)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            start_focus_mode,
            stop_focus_mode
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allowlist_filtering() {
        let apps = vec![
            "Discord.exe".to_string(),
            "explorer.exe".to_string(),
            "STEAM.EXE".to_string(),
            "malware.exe".to_string(),
        ];

        let allowlist_set: std::collections::HashSet<&str> = ALLOWLIST.iter().copied().collect();
        let safe_apps: Vec<String> = apps
            .into_iter()
            .map(|a| a.to_lowercase())
            .filter(|a| allowlist_set.contains(a.as_str()))
            .collect();

        assert_eq!(safe_apps.len(), 2);
        assert!(safe_apps.contains(&"discord.exe".to_string()));
        assert!(safe_apps.contains(&"steam.exe".to_string()));
    }

    #[test]
    fn test_protected_paths() {
        assert!(is_protected_path(Path::new("C:\\Windows\\System32\\cmd.exe")));
        assert!(is_protected_path(Path::new("D:\\programdata\\Microsoft\\defender.exe")));
        assert!(is_protected_path(Path::new("C:\\Users\\majos\\Downloads\\explorer.exe"))); // protected by name
        assert!(is_protected_path(Path::new("\\\\?\\C:\\windows\\notepad.exe")));

        assert!(!is_protected_path(Path::new("C:\\Users\\majos\\Games\\mi_juego.exe")));
        assert!(!is_protected_path(Path::new("D:\\Apps\\StudyTimer\\timer.exe")));
    }
}
