use std::collections::HashSet;
use std::time::Duration;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
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

#[tauri::command]
async fn start_focus_mode(
    apps: Vec<String>,
    state: State<'_, FocusMonitorState>,
) -> Result<(), String> {
    let mut state_guard = state.0.lock().await;

    // Abort existing worker safely
    if let Some((handle, is_active)) = state_guard.take() {
        is_active.store(false, Ordering::Relaxed);
        handle.abort();
        let _ = handle.await;
    }

    // Filter apps to ensure they are strictly in allowlist
    let allowlist_set: HashSet<&str> = ALLOWLIST.iter().copied().collect();
    let safe_apps: Vec<String> = apps
        .into_iter()
        .map(|a| a.to_lowercase())
        .filter(|a| allowlist_set.contains(a.as_str()))
        .collect();

    if safe_apps.is_empty() {
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
                // Guarantee cancellation before any termination attempt
                if !worker_is_active.load(Ordering::Relaxed) {
                    return; // Exit task completely
                }

                let name = process.name().to_string_lossy().to_lowercase();
                
                if safe_apps.iter().any(|safe_app| name == *safe_app) {
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
}
