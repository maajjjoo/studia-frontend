use serde::{Deserialize, Serialize};
use std::io::{Read, Write};

pub const CURRENT_PROTOCOL_VERSION: u32 = 1;

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub enum IpcCommand {
    Block(Vec<String>),
    Unblock,
    Ping,
    Shutdown, // Orderly helper shutdown
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct IpcMessage {
    pub version: u32,
    pub token: String,
    pub command: IpcCommand,
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub enum IpcResponse {
    Ok,
    Error(String),
}

#[derive(Debug, PartialEq)]
pub enum ProcessResult {
    Continue,
    Shutdown,
}

const MAX_PAYLOAD_SIZE: usize = 65536; // 64 KB limit to prevent DOS

/// Reads a length-prefixed JSON message, validates version, and expected token.
pub fn process_client_stream<R: Read, W: Write>(
    mut reader: R,
    mut writer: W,
    expected_token: &str,
    custom_hosts_path: Option<&str>,
) -> Result<ProcessResult, String> {
    let mut len_buf = [0u8; 4];
    if let Err(e) = reader.read_exact(&mut len_buf) {
        return Err(format!("Failed to read payload length: {}", e));
    }
    let payload_len = u32::from_be_bytes(len_buf) as usize;

    if payload_len > MAX_PAYLOAD_SIZE {
        return Err(format!("Payload too large: {} bytes", payload_len));
    }
    if payload_len == 0 {
        return Err("Empty payload".into());
    }

    let mut payload = vec![0u8; payload_len];
    if let Err(e) = reader.read_exact(&mut payload) {
        return Err(format!("Failed to read payload: {}", e));
    }

    let message: IpcMessage = match serde_json::from_slice(&payload) {
        Ok(m) => m,
        Err(e) => return Err(format!("Invalid JSON format: {}", e)),
    };

    if message.version != CURRENT_PROTOCOL_VERSION {
        let response =
            IpcResponse::Error(format!("Unsupported protocol version: {}", message.version));
        send_response(&mut writer, &response)?;
        return Err("Unsupported protocol version".into());
    }

    if message.token != expected_token {
        let response = IpcResponse::Error("Unauthorized: Invalid token".into());
        send_response(&mut writer, &response)?;
        return Err("Unauthorized request attempted".into());
    }

    let (response, process_result) = match message.command {
        IpcCommand::Block(domains) => {
            match crate::hosts_manager::update_hosts_file(custom_hosts_path, &domains) {
                Ok(_) => (IpcResponse::Ok, ProcessResult::Continue),
                Err(e) => (IpcResponse::Error(e), ProcessResult::Continue),
            }
        }
        IpcCommand::Unblock => {
            match crate::hosts_manager::update_hosts_file(custom_hosts_path, &[]) {
                Ok(_) => (IpcResponse::Ok, ProcessResult::Continue),
                Err(e) => (IpcResponse::Error(e), ProcessResult::Continue),
            }
        }
        IpcCommand::Ping => (IpcResponse::Ok, ProcessResult::Continue),
        IpcCommand::Shutdown => {
            match crate::hosts_manager::update_hosts_file(custom_hosts_path, &[]) {
                Ok(_) => (IpcResponse::Ok, ProcessResult::Shutdown),
                Err(e) => (IpcResponse::Error(e), ProcessResult::Shutdown),
            }
        }
    };

    send_response(&mut writer, &response)?;
    Ok(process_result)
}

fn send_response<W: Write>(mut writer: W, response: &IpcResponse) -> Result<(), String> {
    let serialized = serde_json::to_vec(response).map_err(|e| e.to_string())?;
    let len = serialized.len() as u32;

    writer
        .write_all(&len.to_be_bytes())
        .map_err(|e| e.to_string())?;
    writer.write_all(&serialized).map_err(|e| e.to_string())?;
    writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn build_payload(msg: &IpcMessage) -> Vec<u8> {
        let serialized = serde_json::to_vec(msg).unwrap();
        let mut buf = Vec::new();
        buf.extend_from_slice(&(serialized.len() as u32).to_be_bytes());
        buf.extend_from_slice(&serialized);
        buf
    }

    #[test]
    fn test_valid_ping() {
        let msg = IpcMessage {
            version: CURRENT_PROTOCOL_VERSION,
            token: "secret123".into(),
            command: IpcCommand::Ping,
        };
        let payload = build_payload(&msg);
        let mut reader = Cursor::new(payload);
        let mut writer = Vec::new();

        assert_eq!(
            process_client_stream(&mut reader, &mut writer, "secret123", None).unwrap(),
            ProcessResult::Continue
        );

        let mut resp_reader = Cursor::new(writer);
        let mut len_buf = [0u8; 4];
        resp_reader.read_exact(&mut len_buf).unwrap();
        let len = u32::from_be_bytes(len_buf) as usize;
        let mut resp_payload = vec![0u8; len];
        resp_reader.read_exact(&mut resp_payload).unwrap();
        let resp: IpcResponse = serde_json::from_slice(&resp_payload).unwrap();

        assert_eq!(resp, IpcResponse::Ok);
    }

    #[test]
    fn test_valid_shutdown() {
        let mut temp_path = std::env::temp_dir();
        temp_path.push(format!("studia_ipc_shutdown_{}", rand::random::<u32>()));
        let temp_str = temp_path.to_str().unwrap();

        let msg = IpcMessage {
            version: CURRENT_PROTOCOL_VERSION,
            token: "secret123".into(),
            command: IpcCommand::Shutdown,
        };
        let payload = build_payload(&msg);
        let mut reader = Cursor::new(payload);
        let mut writer = Vec::new();

        assert_eq!(
            process_client_stream(&mut reader, &mut writer, "secret123", Some(temp_str)).unwrap(),
            ProcessResult::Shutdown
        );
        let _ = std::fs::remove_file(&temp_path);
    }

    #[test]
    fn test_invalid_token() {
        let msg = IpcMessage {
            version: CURRENT_PROTOCOL_VERSION,
            token: "hacker".into(),
            command: IpcCommand::Ping,
        };
        let payload = build_payload(&msg);
        let mut reader = Cursor::new(payload);
        let mut writer = Vec::new();

        let err = process_client_stream(&mut reader, &mut writer, "secret123", None).unwrap_err();
        assert_eq!(err, "Unauthorized request attempted");
    }

    #[test]
    fn test_invalid_version() {
        let msg = IpcMessage {
            version: 999,
            token: "secret123".into(),
            command: IpcCommand::Ping,
        };
        let payload = build_payload(&msg);
        let mut reader = Cursor::new(payload);
        let mut writer = Vec::new();

        let err = process_client_stream(&mut reader, &mut writer, "secret123", None).unwrap_err();
        assert_eq!(err, "Unsupported protocol version");
    }
}
