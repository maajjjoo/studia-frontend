pub mod ai_service;
pub mod helper_launcher;
pub mod hosts_manager;
pub mod ipc_protocol;
pub mod secure_pipe;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use sysinfo::System;
use tauri::async_runtime::JoinHandle;
use tauri::{Manager, State};
use tokio::sync::Mutex;

struct FocusMonitorState(Mutex<Option<(JoinHandle<()>, Arc<AtomicBool>)>>);

#[cfg(windows)]
pub struct WebsiteBlockerState(pub Mutex<Option<crate::helper_launcher::launcher::HelperClient>>);

#[cfg(not(windows))]
pub struct WebsiteBlockerState(pub Mutex<Option<()>>);

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
        || path_str.contains("\\programdata\\microsoft\\")
    {
        return true;
    }

    // Nombres de ejecutables crticos protegidos absolutamente (independientemente de donde estn)
    let file_name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let critical_names = [
        "explorer.exe",
        "svchost.exe",
        "csrss.exe",
        "smss.exe",
        "wininit.exe",
        "lsass.exe",
        "services.exe",
        "winlogon.exe",
        "taskmgr.exe",
        "cmd.exe",
        "powershell.exe",
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

                // Match personalizadas por ruta canónica real (identity estricta)
                if !should_kill && !safe_custom_paths.is_empty() {
                    if let Some(proc_exe) = process.exe() {
                        if let Ok(canon_proc_exe) = std::fs::canonicalize(proc_exe) {
                            if safe_custom_paths.iter().any(|p| {
                                p == &canon_proc_exe
                                    || p.to_string_lossy()
                                        .eq_ignore_ascii_case(&canon_proc_exe.to_string_lossy())
                            }) {
                                should_kill = true;
                            }
                        } else {
                            // Fallback si canonicalize falla en el proceso ejecutándose
                            let proc_str = proc_exe.to_string_lossy();
                            let proc_clean = proc_str.trim_start_matches(r"\\?\");
                            if safe_custom_paths.iter().any(|p| {
                                let p_str = p.to_string_lossy();
                                let p_clean = p_str.trim_start_matches(r"\\?\");
                                p_clean.eq_ignore_ascii_case(proc_clean)
                            }) {
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

#[cfg(windows)]
async fn unblock_and_keep_helper_ready(state: &WebsiteBlockerState) -> Result<(), String> {
    let mut client_guard = state.0.lock().await;
    if let Some(client) = client_guard.as_ref() {
        match client.unblock_domains() {
            Ok(()) => {
                if crate::hosts_manager::verify_studia_block_active(None)? {
                    return Err(
                        "Failed to remove Studia website blocking rules from hosts file.".into(),
                    );
                }
                return Ok(());
            }
            Err(err) => {
                *client_guard = None;
                if crate::hosts_manager::verify_studia_block_active(None).unwrap_or(false) {
                    return Err(err);
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
async fn enable_website_blocking(
    domains: Vec<String>,
    state: State<'_, WebsiteBlockerState>,
) -> Result<(), String> {
    // 1. Validate domains strictly BEFORE requesting privilege elevation
    for d in &domains {
        crate::hosts_manager::normalize_and_validate_domain(d)?;
    }

    #[cfg(windows)]
    {
        let mut client_guard = state.0.lock().await;

        // 2. Try existing helper client directly without a preliminary ping() round-trip
        if let Some(existing_client) = client_guard.as_ref() {
            match existing_client.try_block_domains(domains.clone(), Duration::from_millis(2000)) {
                Ok(()) => {
                    if !domains.is_empty()
                        && !crate::hosts_manager::verify_studia_block_active(None)?
                    {
                        return Err(
                            "Website blocking rules were not found in hosts file after helper update."
                                .into(),
                        );
                    }
                    return Ok(());
                }
                Err(crate::helper_launcher::launcher::HelperCallError::Operation(err)) => {
                    // Helper is alive and returned a real operation error; do not spawn a duplicate helper
                    return Err(err);
                }
                Err(crate::helper_launcher::launcher::HelperCallError::Transport(_)) => {
                    // Helper stopped running; clear stale client and launch a new one below
                    *client_guard = None;
                }
            }
        }

        // 3. Launch a new elevated helper and send Block on the initial pipe connection
        let client = crate::helper_launcher::launcher::launch_elevated_helper()?;
        match client.try_block_domains(domains.clone(), Duration::from_secs(5)) {
            Ok(()) => {
                if !domains.is_empty() && !crate::hosts_manager::verify_studia_block_active(None)? {
                    let _ = client.unblock_domains();
                    return Err(
                        "Website blocking rules were not found in hosts file after helper launch."
                            .into(),
                    );
                }
                *client_guard = Some(client);
                Ok(())
            }
            Err(crate::helper_launcher::launcher::HelperCallError::Operation(err))
            | Err(crate::helper_launcher::launcher::HelperCallError::Transport(err)) => Err(err),
        }
    }

    #[cfg(not(windows))]
    {
        let _ = (domains, state);
        Err("Website blocking is only supported on Windows".into())
    }
}

#[tauri::command]
async fn pause_website_blocking(state: State<'_, WebsiteBlockerState>) -> Result<(), String> {
    #[cfg(windows)]
    {
        unblock_and_keep_helper_ready(&state).await
    }

    #[cfg(not(windows))]
    {
        let _ = state;
        Ok(())
    }
}

#[tauri::command]
async fn disable_website_blocking(state: State<'_, WebsiteBlockerState>) -> Result<(), String> {
    #[cfg(windows)]
    {
        unblock_and_keep_helper_ready(&state).await
    }

    #[cfg(not(windows))]
    {
        let _ = state;
        Ok(())
    }
}

#[tauri::command]
async fn check_website_blocking_active(
    state: State<'_, WebsiteBlockerState>,
) -> Result<bool, String> {
    #[cfg(windows)]
    {
        // 1. Validate that the Studia markers and active entries exist in the Windows hosts file.
        //    Returns Err if the markers are corrupted or the state cannot be verified safely.
        let hosts_block_active = crate::hosts_manager::verify_studia_block_active(None)?;

        // 2. Verify that the elevated helper process is also responsive.
        let mut client_guard = state.0.lock().await;
        if let Some(client) = client_guard.as_ref() {
            if client.ping().is_ok() {
                return Ok(hosts_block_active);
            } else {
                *client_guard = None;
                return Ok(false);
            }
        }
        Ok(false)
    }

    #[cfg(not(windows))]
    {
        let _ = state;
        Ok(false)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(FocusMonitorState(Mutex::new(None)));
            app.manage(WebsiteBlockerState(Mutex::new(None)));
            app.manage(ai_service::AiClientState::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            start_focus_mode,
            stop_focus_mode,
            enable_website_blocking,
            pause_website_blocking,
            disable_website_blocking,
            check_website_blocking_active,
            ai_service::send_ai_chat,
            ai_service::test_gemini_connection
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
        assert!(is_protected_path(Path::new(
            "C:\\Windows\\System32\\cmd.exe"
        )));
        assert!(is_protected_path(Path::new(
            "D:\\programdata\\Microsoft\\defender.exe"
        )));
        assert!(is_protected_path(Path::new(
            "C:\\Users\\majos\\Downloads\\explorer.exe"
        ))); // protected by name
        assert!(is_protected_path(Path::new(
            "\\\\?\\C:\\windows\\notepad.exe"
        )));

        assert!(!is_protected_path(Path::new(
            "C:\\Users\\majos\\Games\\mi_juego.exe"
        )));
        assert!(!is_protected_path(Path::new(
            "D:\\Apps\\StudyTimer\\timer.exe"
        )));
    }
}
