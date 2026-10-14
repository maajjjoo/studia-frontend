pub const START_MARKER: &str = "# --- STUDIA FOCUS MODE START ---";
pub const END_MARKER: &str = "# --- STUDIA FOCUS MODE END ---";
pub const WINDOWS_HOSTS_PATH: &str = r"C:\Windows\System32\drivers\etc\hosts";

pub fn normalize_and_validate_domain(input: &str) -> Result<String, String> {
    let mut domain = input.trim().to_lowercase();

    // Strip scheme unambiguously
    if domain.starts_with("http://") {
        domain = domain["http://".len()..].to_string();
    } else if domain.starts_with("https://") {
        domain = domain["https://".len()..].to_string();
    }

    // Strip path unambiguously
    if let Some(idx) = domain.find('/') {
        domain = domain[..idx].to_string();
    }

    if domain.is_empty() {
        return Err("Domain is empty".into());
    }

    // Reject ports or credentials
    if domain.contains(':') || domain.contains('@') {
        return Err("Ports and credentials are not supported".into());
    }

    // Reject localhost
    if domain == "localhost" {
        return Err("Cannot block localhost".into());
    }

    // Basic IPv4 rejection (4 blocks of digits)
    let parts: Vec<&str> = domain.split('.').collect();
    if parts.len() == 4 && parts.iter().all(|p| p.chars().all(|c| c.is_ascii_digit())) {
        return Err("IP addresses are not supported".into());
    }

    // Character validation (only a-z, 0-9, -, .)
    for c in domain.chars() {
        if !c.is_ascii_alphanumeric() && c != '-' && c != '.' {
            return Err(format!("Invalid character '{}' in domain", c));
        }
    }

    // Dot validation
    if domain.starts_with('.') || domain.ends_with('.') || domain.contains("..") {
        return Err("Malformed domain dots".into());
    }

    // Hyphen validation
    if domain.starts_with('-')
        || domain.ends_with('-')
        || domain.contains(".-")
        || domain.contains("-.")
    {
        return Err("Malformed domain hyphens".into());
    }

    if !domain.contains('.') {
        return Err("Domain must contain a TLD".into());
    }

    Ok(domain)
}

/// Documented, verifiable per-service subdomain rules.
///
/// Generic subdomains (`api.`, `web.`, `mobile.`, `static.`) are intentionally NOT added to all
/// domains because doing so could inadvertently block unrelated third-party services or CDNs.
/// Instead, only specific subdomains with verified evidence of being required for a service's
/// primary web application are listed here.
///
/// Note: Hosts-file blocking only covers DNS resolution for the exact hostnames generated
/// (root, `www.`, and any service-specific entries below); it is not a total network block.
pub const KNOWN_SERVICE_SUBDOMAINS: &[(&str, &[&str])] = &[
    // WhatsApp Web runs its browser client on web.whatsapp.com
    ("whatsapp.com", &["web.whatsapp.com"]),
    // Reddit offers alternate web interfaces on old.reddit.com and new.reddit.com
    ("reddit.com", &["old.reddit.com", "new.reddit.com"]),
    // Discord web client release channels
    ("discord.com", &["ptb.discord.com", "canary.discord.com"]),
    // X / Twitter mobile web entry points
    ("x.com", &["mobile.x.com"]),
    ("twitter.com", &["mobile.twitter.com"]),
];

/// Expands a validated domain into its canonical variants:
/// - Exact domain and `www.` variant (or root domain and `www.` variant)
/// - Any documented service-specific subdomains from `KNOWN_SERVICE_SUBDOMAINS`
pub fn expand_domain_variants(domain: &str) -> Vec<String> {
    let mut variants = Vec::new();
    let canonical_root = if let Some(stripped) = domain.strip_prefix("www.") {
        if !stripped.is_empty() && stripped.contains('.') {
            variants.push(stripped.to_string());
            stripped
        } else {
            domain
        }
    } else {
        domain
    };

    if !variants.iter().any(|v| v == domain) {
        variants.push(domain.to_string());
    }

    if !domain.starts_with("www.") {
        let www_variant = format!("www.{}", domain);
        if !variants.contains(&www_variant) {
            variants.push(www_variant);
        }
    }

    for (service_root, subdomains) in KNOWN_SERVICE_SUBDOMAINS {
        if *service_root == canonical_root {
            for sub in *subdomains {
                let sub_str = (*sub).to_string();
                if !variants.contains(&sub_str) {
                    variants.push(sub_str);
                }
            }
        }
    }

    variants
}

pub fn apply_studia_block(original_content: &str, domains: &[String]) -> Result<String, String> {
    let mut target_domains = Vec::new();
    for d in domains {
        match normalize_and_validate_domain(d) {
            Ok(nd) => {
                for variant in expand_domain_variants(&nd) {
                    if !target_domains.contains(&variant) {
                        target_domains.push(variant);
                    }
                }
            }
            Err(e) => return Err(format!("Invalid domain '{}': {}", d, e)),
        }
    }

    // Safety checks on markers
    let start_count = original_content.matches(START_MARKER).count();
    let end_count = original_content.matches(END_MARKER).count();

    if start_count > 1 || end_count > 1 {
        return Err("Multiple Studia markers found. Halting to prevent data loss.".into());
    }

    if start_count != end_count {
        return Err("Mismatched Studia markers found. Halting to prevent data loss.".into());
    }

    let has_markers = start_count == 1;
    let line_ending = if original_content.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    };
    let double_le = format!("{}{}", line_ending, line_ending);

    let mut new_block = String::new();
    if !target_domains.is_empty() {
        new_block.push_str(START_MARKER);
        new_block.push_str(line_ending);
        for d in &target_domains {
            new_block.push_str(&format!("127.0.0.1 {}{}", d, line_ending));
            new_block.push_str(&format!("::1 {}{}", d, line_ending));
        }
        new_block.push_str(END_MARKER);
    }

    if has_markers {
        let start_idx = original_content.find(START_MARKER).unwrap();
        let end_idx = original_content.find(END_MARKER).unwrap() + END_MARKER.len();

        if start_idx > end_idx {
            return Err("Markers are in reverse order. Halting to prevent data loss.".into());
        }

        let before = &original_content[..start_idx];
        let after = &original_content[end_idx..];

        let mut result = String::new();
        result.push_str(before);

        if !new_block.is_empty() {
            result.push_str(&new_block);
            result.push_str(after);
        } else {
            if result.ends_with(&double_le) {
                result.truncate(result.len() - line_ending.len());
            }
            if after == line_ending && result.ends_with(line_ending) {
                // Drop trailing newline that belonged to the removed block at EOF
            } else {
                result.push_str(after);
            }
        }

        Ok(result)
    } else {
        if new_block.is_empty() {
            return Ok(original_content.to_string());
        }

        let mut result = original_content.to_string();
        if !result.is_empty() && !result.ends_with('\n') {
            result.push_str(&double_le);
        } else if result.ends_with(line_ending)
            && !result.ends_with(&double_le)
            && !result.is_empty()
        {
            result.push_str(line_ending);
        }

        result.push_str(&new_block);
        result.push_str(line_ending);

        Ok(result)
    }
}

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::sync::Mutex;

static IN_PROCESS_MUTEX: Mutex<()> = Mutex::new(());

#[cfg(windows)]
#[derive(Debug)]
pub struct HostsLockGuard {
    handle: windows_sys::Win32::Foundation::HANDLE,
}

#[cfg(windows)]
impl Drop for HostsLockGuard {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::System::Threading::ReleaseMutex(self.handle);
            windows_sys::Win32::Foundation::CloseHandle(self.handle);
        }
    }
}

#[cfg(windows)]
pub fn acquire_named_mutex(name: &str, timeout_ms: u32) -> Result<HostsLockGuard, String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{GetLastError, WAIT_OBJECT_0, WAIT_TIMEOUT};
    use windows_sys::Win32::System::Threading::{CreateMutexW, WaitForSingleObject};

    let mut name_wide: Vec<u16> = OsStr::new(name).encode_wide().collect();
    name_wide.push(0);

    let handle = unsafe { CreateMutexW(std::ptr::null(), 0, name_wide.as_ptr()) };
    if handle == 0 {
        return Err(format!("Failed to create named mutex: {}", unsafe {
            GetLastError()
        }));
    }

    let wait_res = unsafe { WaitForSingleObject(handle, timeout_ms) };
    if wait_res == WAIT_OBJECT_0 {
        Ok(HostsLockGuard { handle })
    } else if wait_res == WAIT_TIMEOUT {
        unsafe { windows_sys::Win32::Foundation::CloseHandle(handle) };
        Err(
            "Hosts file lock contention: another process is currently modifying the hosts file"
                .into(),
        )
    } else {
        unsafe { windows_sys::Win32::Foundation::CloseHandle(handle) };
        Err(format!("Mutex wait failed: Error {}", unsafe {
            GetLastError()
        }))
    }
}

/// Transactionally updates the hosts file with exclusive locking.
/// If `custom_path` is None, targets WINDOWS_HOSTS_PATH.
/// The function strictly validates domains and markers before any file operation,
/// writes to a temporary file in the same directory, flushes it, preserves permissions,
/// and renames it over the original file atomically.
pub fn update_hosts_file(custom_path: Option<&str>, domains: &[String]) -> Result<(), String> {
    // 1. Process-level mutual exclusion
    let _process_guard = IN_PROCESS_MUTEX
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))?;

    // 2. OS-level Named Mutex to prevent cross-process concurrent modifications
    #[cfg(windows)]
    let _system_guard = {
        let mutex_name = if let Some(p) = custom_path {
            format!(
                "Local\\StudiaHosts_{}",
                p.replace(['\\', ':', '/', '.'], "_")
            )
        } else {
            "Local\\StudiaHosts_SystemProduction".to_string()
        };
        acquire_named_mutex(&mutex_name, 3000)?
    };

    let target_path = custom_path.unwrap_or(WINDOWS_HOSTS_PATH);
    let path = Path::new(target_path);

    let original_content = if path.exists() {
        match fs::read_to_string(path) {
            Ok(content) => content,
            Err(e) => return Err(format!("Failed to read hosts file: {}", e)),
        }
    } else {
        String::new()
    };

    // Strict validation before any disk operations
    let new_content = apply_studia_block(&original_content, domains)?;

    // If content is identical, do not perform redundant disk writes
    if original_content == new_content {
        return Ok(());
    }

    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    if !parent.as_os_str().is_empty() && !parent.exists() {
        let _ = fs::create_dir_all(parent);
    }

    let random_id: u32 = rand::random();
    let temp_path = parent.join(format!(
        ".studia_hosts_tmp_{}_{}",
        std::process::id(),
        random_id
    ));

    // Transactional write to temp file
    let write_result = (|| -> std::io::Result<()> {
        let mut temp_file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&temp_path)?;

        temp_file.write_all(new_content.as_bytes())?;
        temp_file.sync_all()?;
        Ok(())
    })();

    if let Err(e) = write_result {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("Failed to write to temporary hosts file: {}", e));
    }

    // Preserve original file permissions if possible
    if path.exists() {
        if let Ok(metadata) = fs::metadata(path) {
            let _ = fs::set_permissions(&temp_path, metadata.permissions());
        }
    }

    // Atomic replacement
    if let Err(e) = fs::rename(&temp_path, path) {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("Failed to replace original hosts file: {}", e));
    }

    // Flush Windows DNS resolver cache after successful hosts file update (production only)
    #[cfg(windows)]
    if custom_path.is_none() {
        if let Err(e) = flush_dns_cache() {
            eprintln!("Warning: Failed to flush DNS resolver cache: {}", e);
        }
    }

    Ok(())
}

/// Validates the Studia block markers in `content` and returns `Ok(true)` only if a valid,
/// non-empty Studia block with active redirection rules is present.
/// Returns `Err(...)` if the markers are duplicated, mismatched, or reversed.
pub fn verify_studia_block_in_content(content: &str) -> Result<bool, String> {
    let start_count = content.matches(START_MARKER).count();
    let end_count = content.matches(END_MARKER).count();

    if start_count > 1 || end_count > 1 {
        return Err(
            "Multiple Studia markers found in hosts file. State cannot be verified safely.".into(),
        );
    }

    if start_count != end_count {
        return Err(
            "Mismatched Studia markers found in hosts file. State cannot be verified safely."
                .into(),
        );
    }

    if start_count == 0 {
        return Ok(false);
    }

    let start_idx = content.find(START_MARKER).unwrap();
    let end_idx = content.find(END_MARKER).unwrap();

    if start_idx >= end_idx {
        return Err(
            "Studia markers are in reverse order in hosts file. State cannot be verified safely."
                .into(),
        );
    }

    let inner = &content[start_idx + START_MARKER.len()..end_idx];
    let has_active_entries = inner.lines().any(|line| {
        let trimmed = line.trim();
        !trimmed.is_empty()
            && !trimmed.starts_with('#')
            && (trimmed.starts_with("127.0.0.1 ") || trimmed.starts_with("::1 "))
    });

    Ok(has_active_entries)
}

/// Reads the hosts file (or `custom_path`) and verifies whether a valid Studia block is present.
/// Note: Confirming hosts entries does not prove that a browser has closed pre-existing sockets.
pub fn verify_studia_block_active(custom_path: Option<&str>) -> Result<bool, String> {
    let target_path = custom_path.unwrap_or(WINDOWS_HOSTS_PATH);
    let path = Path::new(target_path);

    if !path.exists() {
        return Ok(false);
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read hosts file to verify state: {}", e))?;

    verify_studia_block_in_content(&content)
}

/// Flushes the Windows OS DNS Client resolver cache (`Dnscache`) via `ipconfig /flushdns`.
/// Note: This only clears the OS DNS cache; it does not terminate active HTTP/2, HTTP/3 (QUIC),
/// or WebSocket connections already established in a browser.
#[cfg(windows)]
pub fn flush_dns_cache() -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let sys_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
    let ipconfig_path = std::path::Path::new(&sys_root)
        .join("System32")
        .join("ipconfig.exe");

    let status = std::process::Command::new(ipconfig_path)
        .arg("/flushdns")
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| format!("Failed to execute ipconfig /flushdns: {}", e))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "ipconfig /flushdns failed with exit code {:?}",
            status.code()
        ))
    }
}

#[cfg(not(windows))]
pub fn flush_dns_cache() -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_domain_normalization_valid() {
        assert_eq!(
            normalize_and_validate_domain("youtube.com").unwrap(),
            "youtube.com"
        );
        assert_eq!(
            normalize_and_validate_domain("  YOUTUBE.COM  ").unwrap(),
            "youtube.com"
        );
        assert_eq!(
            normalize_and_validate_domain("http://youtube.com").unwrap(),
            "youtube.com"
        );
        assert_eq!(
            normalize_and_validate_domain("https://youtube.com/watch?v=123").unwrap(),
            "youtube.com"
        );
        assert_eq!(
            normalize_and_validate_domain("sub.domain.co.uk").unwrap(),
            "sub.domain.co.uk"
        );
    }

    #[test]
    fn test_domain_normalization_invalid() {
        assert!(normalize_and_validate_domain("").is_err());
        assert!(normalize_and_validate_domain("localhost").is_err());
        assert!(normalize_and_validate_domain("192.168.1.1").is_err());
        assert!(normalize_and_validate_domain("youtube").is_err()); // No TLD
        assert!(normalize_and_validate_domain("youtube.com:443").is_err()); // Port
        assert!(normalize_and_validate_domain("user:pass@youtube.com").is_err()); // Credentials
        assert!(normalize_and_validate_domain(".youtube.com").is_err());
        assert!(normalize_and_validate_domain("youtube..com").is_err());
        assert!(normalize_and_validate_domain("-youtube.com").is_err());
        assert!(normalize_and_validate_domain("youtube-.com").is_err());
    }

    #[test]
    fn test_expand_domain_variants() {
        assert_eq!(
            expand_domain_variants("youtube.com"),
            vec!["youtube.com".to_string(), "www.youtube.com".to_string()]
        );
        assert_eq!(
            expand_domain_variants("www.youtube.com"),
            vec!["youtube.com".to_string(), "www.youtube.com".to_string()]
        );
        assert_eq!(
            expand_domain_variants("sub.domain.co.uk"),
            vec![
                "sub.domain.co.uk".to_string(),
                "www.sub.domain.co.uk".to_string()
            ]
        );
    }

    #[test]
    fn test_apply_studia_block_empty_file() {
        let content = "";
        let domains = vec!["youtube.com".to_string(), "facebook.com".to_string()];
        let expected = format!(
            "{}\n127.0.0.1 youtube.com\n::1 youtube.com\n127.0.0.1 www.youtube.com\n::1 www.youtube.com\n127.0.0.1 facebook.com\n::1 facebook.com\n127.0.0.1 www.facebook.com\n::1 www.facebook.com\n{}\n",
            START_MARKER, END_MARKER
        );
        let result = apply_studia_block(content, &domains).unwrap();
        assert_eq!(result, expected);
    }

    #[test]
    fn test_apply_studia_block_existing_file() {
        let content = "127.0.0.1 localhost\n::1 localhost";
        let domains = vec!["youtube.com".to_string()];
        let expected = format!(
            "127.0.0.1 localhost\n::1 localhost\n\n{}\n127.0.0.1 youtube.com\n::1 youtube.com\n127.0.0.1 www.youtube.com\n::1 www.youtube.com\n{}\n",
            START_MARKER, END_MARKER
        );
        let result = apply_studia_block(content, &domains).unwrap();
        assert_eq!(result, expected);
    }

    #[test]
    fn test_apply_studia_block_replace_existing() {
        let content = format!(
            "127.0.0.1 localhost\n\n{}\n127.0.0.1 old.com\n::1 old.com\n{}\n\n# EOF",
            START_MARKER, END_MARKER
        );
        let domains = vec!["youtube.com".to_string()];
        let expected = format!(
            "127.0.0.1 localhost\n\n{}\n127.0.0.1 youtube.com\n::1 youtube.com\n127.0.0.1 www.youtube.com\n::1 www.youtube.com\n{}\n\n# EOF",
            START_MARKER, END_MARKER
        );
        let result = apply_studia_block(&content, &domains).unwrap();
        assert_eq!(result, expected);
    }

    #[test]
    fn test_apply_studia_block_remove() {
        let content = format!(
            "127.0.0.1 localhost\n\n{}\n127.0.0.1 old.com\n::1 old.com\n{}\n# EOF",
            START_MARKER, END_MARKER
        );
        let domains: Vec<String> = vec![];
        let result = apply_studia_block(&content, &domains).unwrap();
        assert!(!result.contains(START_MARKER));
        assert!(!result.contains(END_MARKER));
        assert!(result.contains("127.0.0.1 localhost"));
        assert!(result.contains("# EOF"));
    }

    #[test]
    fn test_apply_studia_block_malformed_multiple() {
        let content = format!("{}\n{}\n{}", START_MARKER, START_MARKER, END_MARKER);
        let domains = vec!["youtube.com".to_string()];
        assert!(apply_studia_block(&content, &domains).is_err());
    }

    #[test]
    fn test_apply_studia_block_malformed_mismatched() {
        let content = format!("{}\n", START_MARKER);
        let domains = vec!["youtube.com".to_string()];
        assert!(apply_studia_block(&content, &domains).is_err());
    }

    #[test]
    fn test_apply_studia_block_malformed_reversed() {
        let content = format!("{}\n{}\n", END_MARKER, START_MARKER);
        let domains = vec!["youtube.com".to_string()];
        assert!(apply_studia_block(&content, &domains).is_err());
    }

    #[test]
    fn test_apply_studia_block_deduplication_and_case() {
        let content = "";
        let domains = vec![
            "YOUTUBE.COM".to_string(),
            "youtube.com".to_string(),
            "www.youtube.com".to_string(),
            "https://youtube.com/".to_string(),
        ];
        let result = apply_studia_block(content, &domains).unwrap();
        let occurrences_root = result.matches("127.0.0.1 youtube.com").count();
        let occurrences_root_v6 = result.matches("::1 youtube.com").count();
        let occurrences_www = result.matches("127.0.0.1 www.youtube.com").count();
        let occurrences_www_v6 = result.matches("::1 www.youtube.com").count();
        assert_eq!(occurrences_root, 1);
        assert_eq!(occurrences_root_v6, 1);
        assert_eq!(occurrences_www, 1);
        assert_eq!(occurrences_www_v6, 1);
    }

    #[test]
    fn test_service_specific_subdomains_and_short_domains() {
        assert_eq!(normalize_and_validate_domain("x.com").unwrap(), "x.com");
        assert_eq!(
            normalize_and_validate_domain("web.whatsapp.com").unwrap(),
            "web.whatsapp.com"
        );
        assert_eq!(
            expand_domain_variants("whatsapp.com"),
            vec![
                "whatsapp.com".to_string(),
                "www.whatsapp.com".to_string(),
                "web.whatsapp.com".to_string()
            ]
        );
        assert_eq!(
            expand_domain_variants("x.com"),
            vec![
                "x.com".to_string(),
                "www.x.com".to_string(),
                "mobile.x.com".to_string()
            ]
        );
    }

    #[test]
    fn test_apply_studia_block_preserves_windows_crlf() {
        let original = "127.0.0.1 localhost\r\n::1 localhost\r\n";
        let domains = vec!["youtube.com".to_string()];
        let with_block = apply_studia_block(original, &domains).unwrap();
        assert!(with_block.contains("\r\n"));
        assert!(!with_block.replace("\r\n", "").contains('\n'));
        assert!(verify_studia_block_in_content(&with_block).unwrap());

        let after_remove = apply_studia_block(&with_block, &[]).unwrap();
        assert_eq!(after_remove, original);
        assert!(!verify_studia_block_in_content(&after_remove).unwrap());
    }

    #[test]
    fn test_verify_studia_block_in_content_states() {
        assert_eq!(
            verify_studia_block_in_content("127.0.0.1 localhost\n").unwrap(),
            false
        );
        let empty_markers = format!("{}\n{}\n", START_MARKER, END_MARKER);
        assert_eq!(
            verify_studia_block_in_content(&empty_markers).unwrap(),
            false
        );

        let valid_block = format!(
            "{}\n127.0.0.1 instagram.com\n::1 instagram.com\n{}\n",
            START_MARKER, END_MARKER
        );
        assert_eq!(verify_studia_block_in_content(&valid_block).unwrap(), true);

        let mismatched = format!("{}\n127.0.0.1 instagram.com\n", START_MARKER);
        assert!(verify_studia_block_in_content(&mismatched).is_err());

        let reversed = format!("{}\n{}\n", END_MARKER, START_MARKER);
        assert!(verify_studia_block_in_content(&reversed).is_err());
    }
}

#[cfg(test)]
mod io_tests {
    use super::*;
    use std::env;

    #[test]
    fn test_update_hosts_file_transactional_lifecycle() {
        let mut temp_path = env::temp_dir();
        temp_path.push(format!("studia_hosts_lifecycle_{}", rand::random::<u32>()));
        let temp_str = temp_path.to_str().unwrap();

        // 1. Initial unrelated content
        let initial_data =
            "# Important system hosts\n127.0.0.1 myapp.local\n192.168.1.50 printer\n";
        fs::write(&temp_path, initial_data).unwrap();

        // 2. Add Studia block
        let domains = vec!["youtube.com".to_string(), "tiktok.com".to_string()];
        assert!(update_hosts_file(Some(temp_str), &domains).is_ok());

        let after_block = fs::read_to_string(&temp_path).unwrap();
        assert!(after_block.contains("127.0.0.1 myapp.local"));
        assert!(after_block.contains("192.168.1.50 printer"));
        assert!(after_block.contains(START_MARKER));
        assert!(after_block.contains("127.0.0.1 youtube.com"));
        assert!(after_block.contains("::1 youtube.com"));
        assert!(after_block.contains("127.0.0.1 www.youtube.com"));
        assert!(after_block.contains("::1 www.youtube.com"));
        assert!(after_block.contains("127.0.0.1 tiktok.com"));
        assert!(after_block.contains("::1 tiktok.com"));
        assert!(after_block.contains(END_MARKER));

        // 3. Replace Studia block
        let new_domains = vec!["instagram.com".to_string()];
        assert!(update_hosts_file(Some(temp_str), &new_domains).is_ok());

        let after_replace = fs::read_to_string(&temp_path).unwrap();
        assert!(after_replace.contains("127.0.0.1 myapp.local"));
        assert!(!after_replace.contains("youtube.com"));
        assert!(after_replace.contains("127.0.0.1 instagram.com"));

        // 4. Remove Studia block cleanly
        assert!(update_hosts_file(Some(temp_str), &[]).is_ok());

        let after_remove = fs::read_to_string(&temp_path).unwrap();
        assert!(after_remove.contains("127.0.0.1 myapp.local"));
        assert!(!after_remove.contains(START_MARKER));
        assert!(!after_remove.contains("instagram.com"));

        let _ = fs::remove_file(&temp_path);
    }

    #[test]
    fn test_update_hosts_file_invalid_domain_preserves_original() {
        let mut temp_path = env::temp_dir();
        temp_path.push(format!(
            "studia_hosts_invalid_dom_{}",
            rand::random::<u32>()
        ));
        let temp_str = temp_path.to_str().unwrap();

        let initial_content = "127.0.0.1 preserve-me.local\n";
        fs::write(&temp_path, initial_content).unwrap();

        // Attempting to add an invalid domain (port included)
        let invalid_domains = vec!["good.com".to_string(), "bad.com:8080".to_string()];
        let res = update_hosts_file(Some(temp_str), &invalid_domains);
        assert!(res.is_err());

        // Verify original file is completely intact
        let current_content = fs::read_to_string(&temp_path).unwrap();
        assert_eq!(current_content, initial_content);

        let _ = fs::remove_file(&temp_path);
    }

    #[test]
    fn test_update_hosts_file_corrupted_markers_preserves_original() {
        let mut temp_path = env::temp_dir();
        temp_path.push(format!("studia_hosts_corrupt_{}", rand::random::<u32>()));
        let temp_str = temp_path.to_str().unwrap();

        // Corrupted file with duplicated START_MARKER
        let corrupted_content = format!(
            "{}\n127.0.0.1 old.com\n{}\n{}\n",
            START_MARKER, START_MARKER, END_MARKER
        );
        fs::write(&temp_path, &corrupted_content).unwrap();

        let domains = vec!["youtube.com".to_string()];
        let res = update_hosts_file(Some(temp_str), &domains);
        assert!(res.is_err());

        // Verify original file was NOT overwritten
        let current_content = fs::read_to_string(&temp_path).unwrap();
        assert_eq!(current_content, corrupted_content);

        let _ = fs::remove_file(&temp_path);
    }

    #[test]
    fn test_update_hosts_file_empty_domains_on_clean_file_is_noop() {
        let mut temp_path = env::temp_dir();
        temp_path.push(format!("studia_hosts_clean_{}", rand::random::<u32>()));
        let temp_str = temp_path.to_str().unwrap();

        let initial_content = "127.0.0.1 untouched.local\n";
        fs::write(&temp_path, initial_content).unwrap();

        assert!(update_hosts_file(Some(temp_str), &[]).is_ok());

        let current_content = fs::read_to_string(&temp_path).unwrap();
        assert_eq!(current_content, initial_content);

        let _ = fs::remove_file(&temp_path);
    }

    #[test]
    #[cfg(windows)]
    fn test_update_hosts_file_named_mutex_contention() {
        use std::thread;
        use std::time::Duration;

        let mut temp_path = env::temp_dir();
        temp_path.push(format!("studia_hosts_mutex_test_{}", rand::random::<u32>()));
        let temp_str = temp_path.to_str().unwrap().to_string();

        let initial_content = "127.0.0.1 lock-test.local\n";
        fs::write(&temp_path, initial_content).unwrap();

        let mutex_name = format!(
            "Local\\StudiaHosts_{}",
            temp_str.replace(['\\', ':', '/', '.'], "_")
        );

        // Acquire lock on thread A and hold it for 800ms
        let m_name = mutex_name.clone();
        let handle_thread = thread::spawn(move || {
            let guard = acquire_named_mutex(&m_name, 1000).expect("Thread failed to acquire mutex");
            thread::sleep(Duration::from_millis(800));
            drop(guard);
        });

        // Give thread time to acquire mutex
        thread::sleep(Duration::from_millis(100));

        // Attempt to acquire with a very short timeout (50ms) -> should fail with lock contention
        let contention_result = acquire_named_mutex(&mutex_name, 50);
        assert!(contention_result.is_err());
        assert!(contention_result.unwrap_err().contains("lock contention"));

        handle_thread.join().unwrap();
        let _ = fs::remove_file(&temp_path);
    }
}
