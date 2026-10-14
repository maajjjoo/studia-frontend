use std::env;
use std::process;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use tauri_app_lib::ipc_protocol::{self, ProcessResult};
use tauri_app_lib::secure_pipe::windows_pipe;

fn main() {
    let args: Vec<String> = env::args().collect();

    // Usage: studia-helper.exe <pipe_name> <auth_token> <parent_pid> [debug_custom_hosts_path]
    #[cfg(debug_assertions)]
    let valid_args = args.len() == 4 || args.len() == 5;
    #[cfg(not(debug_assertions))]
    let valid_args = args.len() == 4;

    if !valid_args {
        eprintln!("Usage: studia-helper.exe <pipe_name> <auth_token> <parent_pid>");
        process::exit(1);
    }

    let pipe_name = &args[1];
    let auth_token = &args[2];
    let parent_pid: u32 = match args[3].parse() {
        Ok(pid) => pid,
        Err(_) => {
            eprintln!("Invalid parent_pid argument.");
            process::exit(1);
        }
    };

    #[cfg(debug_assertions)]
    let custom_hosts_path: Option<String> = args.get(4).cloned();
    #[cfg(not(debug_assertions))]
    let custom_hosts_path: Option<String> = None;

    if !pipe_name.starts_with(r"\\.\pipe\") {
        eprintln!("Invalid pipe name format.");
        process::exit(1);
    }

    // 1. Open an unforgeable Windows Process Handle with SYNCHRONIZE rights.
    // This pins the parent process identity in the Windows kernel and prevents PID recycling.
    let parent_handle = match windows_pipe::open_process_handle(parent_pid) {
        Ok(h) => h,
        Err(e) => {
            eprintln!(
                "Failed to acquire parent process handle: {}. Parent likely exited.",
                e
            );
            process::exit(1);
        }
    };

    println!(
        "Acquired parent process handle for PID {}. Starting Watchdog...",
        parent_pid
    );

    let shutdown_signal = Arc::new(AtomicBool::new(false));
    let watchdog_shutdown = shutdown_signal.clone();
    let watchdog_hosts_path = custom_hosts_path.clone();

    // 2. Spawn Watchdog Supervisor Thread
    // Continuously checks whether the parent process is still alive.
    // If the parent crashes or terminates, the watchdog triggers immediate exit.
    let watchdog_handle = thread::spawn(move || {
        loop {
            if watchdog_shutdown.load(Ordering::Relaxed) {
                break;
            }

            match windows_pipe::has_process_exited(parent_handle, 500) {
                Ok(true) => {
                    eprintln!(
                        "Watchdog: Parent process {} terminated. Forcing helper shutdown.",
                        parent_pid
                    );
                    let _ = tauri_app_lib::hosts_manager::update_hosts_file(
                        watchdog_hosts_path.as_deref(),
                        &[],
                    );
                    windows_pipe::close_handle(parent_handle);
                    process::exit(0);
                }
                Ok(false) => {
                    // Parent is still alive, continue monitoring
                }
                Err(e) => {
                    eprintln!(
                        "Watchdog: Error monitoring parent process: {}. Aborting.",
                        e
                    );
                    windows_pipe::close_handle(parent_handle);
                    process::exit(1);
                }
            }
        }
        windows_pipe::close_handle(parent_handle);
    });

    // 3. Initialize Secure Named Pipe
    let pipe_file = match windows_pipe::create_secure_pipe_server(pipe_name) {
        Ok(f) => f,
        Err(e) => {
            eprintln!("Failed to initialize secure pipe: {}", e);
            shutdown_signal.store(true, Ordering::Relaxed);
            let _ = watchdog_handle.join();
            process::exit(1);
        }
    };

    println!("Secure pipe initialized. Entering server loop...");

    // 4. Server Request-Response Loop
    loop {
        if shutdown_signal.load(Ordering::Relaxed) {
            break;
        }

        if let Err(e) = windows_pipe::accept_connection(&pipe_file) {
            eprintln!("Connection failed: {}", e);
            break;
        }

        // 5. Operating-System Level Client Verification
        // Query the kernel for the client's actual PID and verify it matches the parent PID
        let client_pid = match windows_pipe::get_client_pid(&pipe_file) {
            Ok(pid) => pid,
            Err(e) => {
                eprintln!(
                    "Security: Failed to query client PID: {}. Dropping connection.",
                    e
                );
                windows_pipe::disconnect_client(&pipe_file);
                continue;
            }
        };

        if client_pid != parent_pid {
            eprintln!(
                "Security: Unauthorized client PID {} attempted to connect (expected {}). Dropping connection.",
                client_pid, parent_pid
            );
            windows_pipe::disconnect_client(&pipe_file);
            continue;
        }

        // 6. Process Stream and Handle Protocol directly on &pipe_file
        match ipc_protocol::process_client_stream(
            &pipe_file,
            &pipe_file,
            auth_token,
            custom_hosts_path.as_deref(),
        ) {
            Ok(ProcessResult::Continue) => {
                windows_pipe::flush_and_disconnect_client(&pipe_file);
            }
            Ok(ProcessResult::Shutdown) => {
                println!("Orderly shutdown requested by authenticated parent. Exiting.");
                shutdown_signal.store(true, Ordering::Relaxed);
                windows_pipe::flush_and_disconnect_client(&pipe_file);
                break;
            }
            Err(e) => {
                eprintln!("Protocol error: {}", e);
                windows_pipe::disconnect_client(&pipe_file);
            }
        }
    }

    let _ = tauri_app_lib::hosts_manager::update_hosts_file(custom_hosts_path.as_deref(), &[]);
    shutdown_signal.store(true, Ordering::Relaxed);
    let _ = watchdog_handle.join();
    println!("Helper terminated cleanly.");
}
