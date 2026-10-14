#[cfg(windows)]
pub mod launcher {
    use crate::ipc_protocol::{IpcCommand, IpcMessage, IpcResponse, CURRENT_PROTOCOL_VERSION};
    use rand::Rng;
    use std::env;
    use std::ffi::OsStr;
    use std::fs::OpenOptions;
    use std::io::{Read, Write};
    use std::os::windows::ffi::OsStrExt;
    use std::path::PathBuf;
    use std::ptr;
    use std::thread;
    use std::time::{Duration, Instant};
    use windows_sys::Win32::Foundation::GetLastError;
    use windows_sys::Win32::UI::Shell::{ShellExecuteExW, SEE_MASK_NOASYNC, SHELLEXECUTEINFOW};
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_HIDE;

    pub struct HelperClient {
        pub pipe_name: String,
        pub token: String,
    }

    /// Finds the path to studia-helper.exe safely across dev and packaged environments.
    pub fn locate_helper_binary() -> Result<PathBuf, String> {
        let current_exe =
            env::current_exe().map_err(|e| format!("Failed to get current exe path: {}", e))?;
        let exe_dir = current_exe
            .parent()
            .ok_or_else(|| "Failed to get exe directory".to_string())?;

        // 1. Same directory (packaged build or cargo run output)
        let same_dir_helper = exe_dir.join("studia-helper.exe");
        if same_dir_helper.exists() {
            return Ok(same_dir_helper);
        }

        // 2. Parent directory fallback (e.g. running inside target/debug/deps during tests)
        if let Some(parent) = exe_dir.parent() {
            let parent_helper = parent.join("studia-helper.exe");
            if parent_helper.exists() {
                return Ok(parent_helper);
            }
        }

        // 3. Project target/debug directory relative to workspace if running from frontend root
        let dev_target_helper = PathBuf::from("src-tauri/target/debug/studia-helper.exe");
        if dev_target_helper.exists() {
            return Ok(dev_target_helper);
        }

        Err(format!(
            "Could not locate studia-helper.exe near {:?}",
            current_exe
        ))
    }

    /// Launches the helper with UAC elevation using ShellExecuteExW (verb "runas").
    /// Never passes arbitrary command arguments or arbitrary file paths.
    /// Only passes the generated pipe name, cryptographic nonce, and parent PID.
    pub fn launch_elevated_helper() -> Result<HelperClient, String> {
        let helper_path = locate_helper_binary()?;
        let helper_path_str = helper_path
            .to_str()
            .ok_or_else(|| "Invalid helper path string".to_string())?;

        // Generate cryptographically secure random token (32 alphanumeric characters)
        let token: String = rand::thread_rng()
            .sample_iter(&rand::distributions::Alphanumeric)
            .take(32)
            .map(char::from)
            .collect();

        // Generate unique pipe name
        let random_suffix: u64 = rand::thread_rng().gen();
        let pipe_name = format!(r"\\.\pipe\studia_focus_{}", random_suffix);
        let parent_pid = std::process::id();

        let params = format!("{} {} {}", pipe_name, token, parent_pid);

        // Convert strings to wide (UTF-16) for Windows API
        let file_wide: Vec<u16> = OsStr::new(helper_path_str)
            .encode_wide()
            .chain(Some(0))
            .collect();
        let verb_wide: Vec<u16> = OsStr::new("runas").encode_wide().chain(Some(0)).collect();
        let params_wide: Vec<u16> = OsStr::new(&params).encode_wide().chain(Some(0)).collect();

        let mut exec_info = SHELLEXECUTEINFOW {
            cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
            fMask: SEE_MASK_NOASYNC,
            hwnd: 0,
            lpVerb: verb_wide.as_ptr(),
            lpFile: file_wide.as_ptr(),
            lpParameters: params_wide.as_ptr(),
            lpDirectory: ptr::null(),
            nShow: SW_HIDE as i32,
            hInstApp: 0,
            lpIDList: ptr::null_mut(),
            lpClass: ptr::null(),
            hkeyClass: 0,
            dwHotKey: 0,
            Anonymous: windows_sys::Win32::UI::Shell::SHELLEXECUTEINFOW_0 { hIcon: 0 },
            hProcess: 0,
        };

        let success = unsafe { ShellExecuteExW(&mut exec_info) };

        if success == 0 {
            let err = unsafe { GetLastError() };
            // ERROR_CANCELLED (1223) means user clicked "No" on UAC prompt
            if err == 1223 {
                return Err("UAC_CANCELLED: User declined administrator permissions.".into());
            } else {
                return Err(format!("Failed to launch elevated helper: Error {}", err));
            }
        }

        // Return client immediately; the first command (e.g., Block) will wait up to 5s
        // for the newly elevated helper to initialize its named pipe, avoiding a redundant Ping connection.
        Ok(HelperClient { pipe_name, token })
    }

    #[derive(Debug)]
    pub enum HelperCallError {
        Transport(String),
        Operation(String),
    }

    impl HelperClient {
        pub fn send_command(&self, command: IpcCommand) -> Result<IpcResponse, String> {
            self.send_command_with_timeout(command, Duration::from_millis(2000))
        }

        pub fn send_command_with_timeout(
            &self,
            command: IpcCommand,
            connect_timeout: Duration,
        ) -> Result<IpcResponse, String> {
            let msg = IpcMessage {
                version: CURRENT_PROTOCOL_VERSION,
                token: self.token.clone(),
                command,
            };

            let payload = serde_json::to_vec(&msg).map_err(|e| e.to_string())?;
            let len = payload.len() as u32;

            let start_conn = Instant::now();
            let mut file = loop {
                match OpenOptions::new()
                    .read(true)
                    .write(true)
                    .open(&self.pipe_name)
                {
                    Ok(f) => break f,
                    Err(e) => {
                        if start_conn.elapsed() > connect_timeout {
                            return Err(format!("Failed to connect to helper pipe: {}", e));
                        }
                        thread::sleep(Duration::from_millis(50));
                    }
                }
            };

            // Send length prefix + JSON
            file.write_all(&len.to_be_bytes())
                .map_err(|e| e.to_string())?;
            file.write_all(&payload).map_err(|e| e.to_string())?;
            file.flush().map_err(|e| e.to_string())?;

            // Read response
            let mut len_buf = [0u8; 4];
            file.read_exact(&mut len_buf).map_err(|e| e.to_string())?;
            let resp_len = u32::from_be_bytes(len_buf) as usize;

            let mut resp_buf = vec![0u8; resp_len];
            file.read_exact(&mut resp_buf).map_err(|e| e.to_string())?;

            let response: IpcResponse =
                serde_json::from_slice(&resp_buf).map_err(|e| e.to_string())?;
            Ok(response)
        }

        pub fn try_block_domains(
            &self,
            domains: Vec<String>,
            connect_timeout: Duration,
        ) -> Result<(), HelperCallError> {
            match self.send_command_with_timeout(IpcCommand::Block(domains), connect_timeout) {
                Ok(IpcResponse::Ok) => Ok(()),
                Ok(IpcResponse::Error(e)) => Err(HelperCallError::Operation(e)),
                Err(e) => Err(HelperCallError::Transport(e)),
            }
        }

        pub fn ping(&self) -> Result<(), String> {
            match self.send_command(IpcCommand::Ping) {
                Ok(IpcResponse::Ok) => Ok(()),
                Ok(IpcResponse::Error(e)) => Err(e),
                Err(e) => Err(e),
            }
        }

        pub fn block_domains(&self, domains: Vec<String>) -> Result<(), String> {
            match self.send_command(IpcCommand::Block(domains)) {
                Ok(IpcResponse::Ok) => Ok(()),
                Ok(IpcResponse::Error(e)) => Err(e),
                Err(e) => Err(e),
            }
        }

        pub fn unblock_domains(&self) -> Result<(), String> {
            match self.send_command(IpcCommand::Unblock) {
                Ok(IpcResponse::Ok) => Ok(()),
                Ok(IpcResponse::Error(e)) => Err(e),
                Err(e) => Err(e),
            }
        }

        pub fn shutdown(&self) -> Result<(), String> {
            match self.send_command(IpcCommand::Shutdown) {
                Ok(IpcResponse::Ok) => Ok(()),
                Ok(IpcResponse::Error(e)) => Err(e),
                Err(e) => Err(e),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::launcher::*;
    use crate::hosts_manager::{verify_studia_block_active, END_MARKER, START_MARKER};
    use std::env;
    use std::fs;
    use std::process::Command;
    use std::time::Duration;

    #[test]
    fn test_helper_client_flow() {
        let helper_exe = locate_helper_binary().expect("locate_helper_binary failed");
        let pipe_name = format!(r"\\.\pipe\studia_diag_{}", std::process::id());
        let token = "diag_secret_token_12345678901234".to_string();
        let parent_pid = std::process::id();

        let mut temp_hosts = env::temp_dir();
        temp_hosts.push(format!("studia_helper_flow_{}", rand::random::<u32>()));
        let temp_hosts_str = temp_hosts.to_str().unwrap().to_string();
        fs::write(&temp_hosts, "127.0.0.1 localhost\r\n::1 localhost\r\n").unwrap();

        let mut child = Command::new(&helper_exe)
            .args([&pipe_name, &token, &parent_pid.to_string(), &temp_hosts_str])
            .stdout(std::process::Stdio::inherit())
            .stderr(std::process::Stdio::inherit())
            .spawn()
            .expect("Failed to spawn studia-helper");

        let client = HelperClient {
            pipe_name: pipe_name.clone(),
            token: token.clone(),
        };

        let domains = vec!["instagram.com".to_string(), "x.com".to_string()];

        // 1. Start session: Block domains and verify hosts rules are active
        let block_res = client.try_block_domains(domains.clone(), Duration::from_secs(5));
        assert!(block_res.is_ok(), "Initial block failed: {:?}", block_res);
        assert_eq!(
            verify_studia_block_active(Some(&temp_hosts_str)).unwrap(),
            true,
            "Hosts block must be active after start"
        );
        let content_after_start = fs::read_to_string(&temp_hosts).unwrap();
        assert!(content_after_start.contains("127.0.0.1 instagram.com"));
        assert!(content_after_start.contains("::1 www.instagram.com"));
        assert!(content_after_start.contains("127.0.0.1 x.com"));
        assert!(content_after_start.contains("127.0.0.1 mobile.x.com"));

        // 2. Pause session: Unblock removes rules while helper stays alive
        let pause_res = client.unblock_domains();
        assert!(pause_res.is_ok(), "Pause unblock failed: {:?}", pause_res);
        assert_eq!(
            verify_studia_block_active(Some(&temp_hosts_str)).unwrap(),
            false,
            "Hosts block must be removed during pause"
        );
        assert!(
            client.ping().is_ok(),
            "Helper must remain alive during pause"
        );

        // 3. Resume session: Re-apply block with the same domain list on the existing helper
        let resume_res = client.try_block_domains(domains.clone(), Duration::from_millis(2000));
        assert!(resume_res.is_ok(), "Resume block failed: {:?}", resume_res);
        assert_eq!(
            verify_studia_block_active(Some(&temp_hosts_str)).unwrap(),
            true,
            "Hosts block must be active again after resume"
        );

        // 4. Reset session: Clean previous state safely and re-apply on new start
        let reset_res = client.unblock_domains();
        assert!(reset_res.is_ok(), "Reset unblock failed: {:?}", reset_res);
        assert_eq!(
            verify_studia_block_active(Some(&temp_hosts_str)).unwrap(),
            false,
            "Hosts block must be removed on reset"
        );

        let restart_res = client.try_block_domains(domains.clone(), Duration::from_millis(2000));
        assert!(
            restart_res.is_ok(),
            "Restart after reset failed: {:?}",
            restart_res
        );
        assert_eq!(
            verify_studia_block_active(Some(&temp_hosts_str)).unwrap(),
            true,
            "Hosts block must be active after restart"
        );

        // 5. IPC Operation error on invalid domain must be reported explicitly (no silent success)
        let bad_res = client.try_block_domains(
            vec!["invalid_domain_without_tld".to_string()],
            Duration::from_millis(2000),
        );
        assert!(
            matches!(bad_res, Err(HelperCallError::Operation(_))),
            "Expected Operation error for invalid domain, got: {:?}",
            bad_res
        );

        // 6. Session completion & Shutdown: removes Studia rules and preserves unrelated entries
        let shutdown_res = client.shutdown();
        assert!(shutdown_res.is_ok(), "Shutdown failed: {:?}", shutdown_res);

        let _ = child.wait();

        let final_content = fs::read_to_string(&temp_hosts).unwrap();
        assert!(final_content.contains("127.0.0.1 localhost"));
        assert!(!final_content.contains(START_MARKER));
        assert!(!final_content.contains(END_MARKER));
        assert_eq!(
            verify_studia_block_active(Some(&temp_hosts_str)).unwrap(),
            false,
            "Hosts block must be inactive after completion/shutdown"
        );

        // 7. Unexpected helper termination / dead pipe detection: must return Transport error and ping must fail
        let dead_ping = client.ping();
        assert!(
            dead_ping.is_err(),
            "Ping to terminated helper must fail so UI does not stay falsely active"
        );
        let dead_block = client.try_block_domains(domains, Duration::from_millis(150));
        assert!(
            matches!(dead_block, Err(HelperCallError::Transport(_))),
            "Expected Transport error when helper is terminated, got: {:?}",
            dead_block
        );

        let _ = fs::remove_file(&temp_hosts);
    }
}
