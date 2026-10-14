#[cfg(windows)]
pub mod windows_pipe {
    use std::ffi::OsStr;
    use std::fs::File;
    use std::os::windows::ffi::OsStrExt;
    use std::os::windows::io::{AsRawHandle, FromRawHandle, RawHandle};
    use std::ptr;
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, HANDLE, INVALID_HANDLE_VALUE, WAIT_TIMEOUT,
    };
    use windows_sys::Win32::Security::Authorization::ConvertStringSecurityDescriptorToSecurityDescriptorW;
    use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
    use windows_sys::Win32::Storage::FileSystem::FlushFileBuffers;
    use windows_sys::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe, GetNamedPipeClientProcessId,
    };
    use windows_sys::Win32::System::Threading::{OpenProcess, WaitForSingleObject};

    const SDDL_REVISION_1: u32 = 1;
    const PIPE_ACCESS_DUPLEX: u32 = 3;
    const PIPE_TYPE_BYTE: u32 = 0;
    const PIPE_READMODE_BYTE: u32 = 0;
    const PIPE_WAIT: u32 = 0;
    const PIPE_REJECT_REMOTE_CLIENTS: u32 = 8;
    const FILE_FLAG_FIRST_PIPE_INSTANCE: u32 = 0x00080000;

    // Process access rights
    const SYNCHRONIZE: u32 = 0x00100000;
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    const WAIT_OBJECT_0: u32 = 0;

    /// Creates a secure named pipe configured for Medium-to-High IL communication.
    ///
    /// Security Analysis of SDDL `D:(A;;GA;;;IU)(A;;GA;;;BA)S:(ML;;NW;;;ME)`:
    /// 1. DACL `(A;;GA;;;IU)`: Allows Full Control to Interactive User (the console session user).
    ///    This is necessary because a Medium IL standard token cannot authenticate as `BA`
    ///    (which is deny-only in standard user tokens under UAC).
    /// 2. DACL `(A;;GA;;;BA)`: Allows Full Control to Built-in Administrators.
    /// 3. SACL `S:(ML;;NW;;;ME)`: Mandatory Integrity Label set to Medium (ME) with No-Write-Up policy.
    ///    This explicitly permits Medium IL processes (non-elevated Studia) to write to the pipe
    ///    created by a High IL process (elevated helper) without being blocked by Windows MIC.
    /// 4. Remote and cross-session network access is explicitly rejected by `PIPE_REJECT_REMOTE_CLIENTS`.
    pub fn create_secure_pipe_server(pipe_name: &str) -> Result<File, String> {
        let mut name_wide: Vec<u16> = OsStr::new(pipe_name).encode_wide().collect();
        name_wide.push(0);

        let sddl = "D:(A;;GA;;;IU)(A;;GA;;;BA)S:(ML;;NW;;;ME)";
        let mut sddl_wide: Vec<u16> = OsStr::new(sddl).encode_wide().collect();
        sddl_wide.push(0);

        let mut sd_ptr: *mut std::ffi::c_void = ptr::null_mut();

        unsafe {
            let res = ConvertStringSecurityDescriptorToSecurityDescriptorW(
                sddl_wide.as_ptr(),
                SDDL_REVISION_1,
                &mut sd_ptr,
                ptr::null_mut(),
            );
            if res == 0 {
                return Err(format!(
                    "Failed to create Security Descriptor: Error {}",
                    GetLastError()
                ));
            }
        }

        let mut sa = SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: sd_ptr,
            bInheritHandle: 0,
        };

        let handle = unsafe {
            CreateNamedPipeW(
                name_wide.as_ptr(),
                PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                1,
                65536,
                65536,
                0,
                &mut sa,
            )
        };

        unsafe {
            windows_sys::Win32::Foundation::LocalFree(sd_ptr as *mut std::ffi::c_void);
        }

        if handle == INVALID_HANDLE_VALUE {
            return Err(format!("Failed to create Named Pipe: Error {}", unsafe {
                GetLastError()
            }));
        }

        let file = unsafe { File::from_raw_handle(handle as RawHandle) };
        Ok(file)
    }

    pub fn accept_connection(file: &File) -> Result<(), String> {
        let handle = file.as_raw_handle() as HANDLE;
        let connected = unsafe { ConnectNamedPipe(handle, ptr::null_mut()) };

        if connected == 0 {
            let err = unsafe { GetLastError() };
            if err != 535 {
                return Err(format!("Failed to accept client connection: Error {}", err));
            }
        }
        Ok(())
    }

    /// Flushes the pipe buffer so the connected client reads all response bytes before disconnecting.
    /// Must only be called after writing a response to a verified client that reads the response.
    pub fn flush_and_disconnect_client(file: &File) {
        let handle = file.as_raw_handle() as HANDLE;
        unsafe {
            let _ = FlushFileBuffers(handle);
            DisconnectNamedPipe(handle);
        }
    }

    /// Immediately disconnects the pipe instance without waiting for unread buffers to drain.
    /// Used when dropping unauthorized or malformed connections so a stalled client cannot block the server.
    pub fn disconnect_client(file: &File) {
        let handle = file.as_raw_handle() as HANDLE;
        unsafe {
            DisconnectNamedPipe(handle);
        }
    }

    /// Queries the operating system for the process ID of the client connected to the named pipe.
    /// This provides kernel-level identity verification rather than relying on client-supplied data.
    pub fn get_client_pid(file: &File) -> Result<u32, String> {
        let handle = file.as_raw_handle() as HANDLE;
        let mut client_pid: u32 = 0;
        let success = unsafe { GetNamedPipeClientProcessId(handle, &mut client_pid) };
        if success == 0 {
            return Err(format!("Failed to query client PID: Error {}", unsafe {
                GetLastError()
            }));
        }
        Ok(client_pid)
    }

    /// Opens an unforgeable Windows Process Handle with SYNCHRONIZE rights.
    /// Holding this handle prevents Windows from recycling the PID while we are waiting on it.
    pub fn open_process_handle(pid: u32) -> Result<HANDLE, String> {
        let handle =
            unsafe { OpenProcess(SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
        if handle == 0 || handle == INVALID_HANDLE_VALUE {
            return Err(format!(
                "Failed to open handle for PID {}: Error {}",
                pid,
                unsafe { GetLastError() }
            ));
        }
        Ok(handle)
    }

    /// Checks if a process has terminated by waiting for its handle with a timeout.
    /// Returns Ok(true) if the process has exited, Ok(false) if it is still running (timeout).
    pub fn has_process_exited(handle: HANDLE, timeout_ms: u32) -> Result<bool, String> {
        let result = unsafe { WaitForSingleObject(handle, timeout_ms) };
        if result == WAIT_OBJECT_0 {
            Ok(true)
        } else if result == WAIT_TIMEOUT {
            Ok(false)
        } else {
            Err(format!("WaitForSingleObject failed: Error {}", unsafe {
                GetLastError()
            }))
        }
    }

    pub fn close_handle(handle: HANDLE) {
        if handle != 0 && handle != INVALID_HANDLE_VALUE {
            unsafe { CloseHandle(handle) };
        }
    }
}

#[cfg(test)]
#[cfg(windows)]
mod tests {
    use super::windows_pipe::*;
    use std::fs::OpenOptions;
    use std::io::{Read, Write};
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_secure_pipe_creation_and_connection() {
        let pipe_name = format!(r"\\.\pipe\studia_test_pipe_{}", std::process::id());

        let server_file =
            create_secure_pipe_server(&pipe_name).expect("Failed to create secure pipe");

        let handle = thread::spawn(move || {
            accept_connection(&server_file).expect("Failed to accept");

            // Verify OS-level client PID query
            let client_pid = get_client_pid(&server_file).expect("Failed to query client PID");
            assert_eq!(client_pid, std::process::id());

            let mut buf = [0u8; 1];
            let mut sf = server_file.try_clone().unwrap();
            sf.read_exact(&mut buf).unwrap();
            assert_eq!(buf[0], 42);

            sf.write_all(&[99]).unwrap();
            flush_and_disconnect_client(&server_file);
        });

        thread::sleep(Duration::from_millis(100));

        let mut client_file = OpenOptions::new()
            .read(true)
            .write(true)
            .open(&pipe_name)
            .expect("Failed to connect to secure pipe");

        client_file.write_all(&[42]).unwrap();
        let mut resp = [0u8; 1];
        client_file.read_exact(&mut resp).unwrap();
        assert_eq!(resp[0], 99);

        handle.join().unwrap();
    }

    #[test]
    fn test_process_handle_watchdog_monitoring() {
        // Monitor current process - should be alive
        let current_pid = std::process::id();
        let proc_handle =
            open_process_handle(current_pid).expect("Failed to open current process handle");

        // 50ms wait should timeout because current process is still running
        let exited = has_process_exited(proc_handle, 50).expect("Wait failed");
        assert_eq!(exited, false, "Current process should not report as exited");

        close_handle(proc_handle);
    }

    #[test]
    fn test_watchdog_detects_terminated_process() {
        use std::process::Command;

        // Spawn a short-lived process that exits immediately
        let child = Command::new("cmd")
            .args(["/c", "exit", "0"])
            .spawn()
            .expect("Failed to spawn dummy process");

        let child_pid = child.id();
        let proc_handle =
            open_process_handle(child_pid).expect("Failed to open child process handle");

        // Wait for child to exit
        let _ = child.wait_with_output();

        // Check if our watchdog function detects the termination
        let exited = has_process_exited(proc_handle, 1000).expect("Wait failed");
        assert_eq!(
            exited, true,
            "Watchdog must detect that the child process exited"
        );

        close_handle(proc_handle);
    }
}
