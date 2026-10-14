use serde::{Deserialize, Serialize};
use std::fmt;
use std::time::Duration;
use tauri::State;

pub const DEFAULT_GEMINI_MODEL: &str = "gemini-3.5-flash-lite";
pub const GEMINI_API_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta/models";
pub const DEFAULT_TIMEOUT_SECS: u64 = 65;
pub const CONNECTION_TEST_PROMPT: &str =
    "Responde únicamente con la frase: Conexión con Studia verificada.";

const ENV_GEMINI_API_KEY: &str = "GEMINI_API_KEY";
const ENV_GEMINI_MODEL: &str = "GEMINI_MODEL";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AiErrorCode {
    MissingApiKey,
    InvalidApiKey,
    ModelUnavailable,
    RateLimited,
    Timeout,
    NetworkError,
    ProviderError,
    EmptyResponse,
    MessageTooLong,
    BadRequest,
    BackendUnavailable,
    BackendNotConfigured,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiServiceError {
    pub code: AiErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub http_status: Option<u16>,
}

impl AiServiceError {
    pub fn new(code: AiErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            http_status: None,
        }
    }

    pub fn with_status(code: AiErrorCode, message: impl Into<String>, status: u16) -> Self {
        Self {
            code,
            message: message.into(),
            http_status: Some(status),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConnectionTestResult {
    pub ok: bool,
    pub model: String,
    pub reply: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendChatResponseData {
    pub reply: String,
    pub model: String,
}

#[derive(Debug, Clone, Deserialize)]
struct BackendChatEnvelope {
    pub ok: bool,
    pub data: Option<BackendChatResponseData>,
    pub error: Option<BackendErrorPayload>,
}

#[derive(Debug, Clone, Deserialize)]
struct BackendErrorPayload {
    pub code: Option<String>,
    pub message: Option<String>,
}

#[derive(Clone, PartialEq, Eq)]
pub struct GeminiConfig {
    api_key: String,
    model: String,
}

impl fmt::Debug for GeminiConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("GeminiConfig")
            .field("api_key", &"[REDACTED]")
            .field("model", &self.model)
            .finish()
    }
}

impl GeminiConfig {
    pub fn resolve_from_env() -> Result<Self, AiServiceError> {
        let raw_key = std::env::var(ENV_GEMINI_API_KEY).ok();
        let raw_model = std::env::var(ENV_GEMINI_MODEL).ok();
        Self::resolve_from_values(raw_key, raw_model)
    }

    pub fn resolve_from_values(
        raw_key: Option<String>,
        raw_model: Option<String>,
    ) -> Result<Self, AiServiceError> {
        let api_key = raw_key
            .map(|k| k.trim().to_string())
            .filter(|k| !k.is_empty())
            .ok_or_else(|| {
                AiServiceError::new(
                    AiErrorCode::MissingApiKey,
                    "Falta configurar la variable de entorno GEMINI_API_KEY.",
                )
            })?;

        let model = match raw_model.map(|m| m.trim().to_string()) {
            Some(m) if !m.is_empty() => {
                if !is_valid_model_identifier(&m) {
                    return Err(AiServiceError::new(
                        AiErrorCode::ProviderError,
                        "El identificador configurado en GEMINI_MODEL tiene un formato inválido.",
                    ));
                }
                m
            }
            _ => DEFAULT_GEMINI_MODEL.to_string(),
        };

        Ok(Self { api_key, model })
    }

    pub fn api_key(&self) -> &str {
        &self.api_key
    }

    pub fn model(&self) -> &str {
        &self.model
    }
}

fn is_valid_model_identifier(model: &str) -> bool {
    !model.is_empty()
        && model.len() <= 64
        && model
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
}

pub fn scrub_secret(text: &str, secret: &str) -> String {
    let trimmed = secret.trim();
    if trimmed.is_empty() {
        return text.to_string();
    }
    text.replace(trimmed, "[REDACTED]")
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiPart {
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiContent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    pub parts: Vec<GeminiPart>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiGenerationConfig {
    pub temperature: f32,
    pub max_output_tokens: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiGenerateRequest {
    pub contents: Vec<GeminiContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generation_config: Option<GeminiGenerationConfig>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiCandidate {
    pub content: Option<GeminiContent>,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiGenerateResponse {
    #[serde(default)]
    pub candidates: Vec<GeminiCandidate>,
}

#[derive(Debug, Clone, Deserialize)]
struct GeminiErrorEnvelope {
    error: Option<GeminiErrorDetail>,
}

#[derive(Debug, Clone, Deserialize)]
struct GeminiErrorDetail {
    status: Option<String>,
    message: Option<String>,
}

pub fn build_generate_content_url(model: &str) -> Result<String, AiServiceError> {
    if !is_valid_model_identifier(model) {
        return Err(AiServiceError::new(
            AiErrorCode::ProviderError,
            "El nombre del modelo de Gemini no es válido.",
        ));
    }
    Ok(format!("{}/{}:generateContent", GEMINI_API_BASE_URL, model))
}

pub fn build_generate_content_request(
    prompt: &str,
) -> Result<GeminiGenerateRequest, AiServiceError> {
    let trimmed = prompt.trim();
    if trimmed.is_empty() {
        return Err(AiServiceError::new(
            AiErrorCode::ProviderError,
            "El prompt enviado a Gemini no puede estar vacío.",
        ));
    }

    Ok(GeminiGenerateRequest {
        contents: vec![GeminiContent {
            role: Some("user".to_string()),
            parts: vec![GeminiPart {
                text: trimmed.to_string(),
            }],
        }],
        generation_config: Some(GeminiGenerationConfig {
            temperature: 0.2,
            max_output_tokens: 128,
        }),
    })
}

pub fn parse_gemini_http_response(
    status_code: u16,
    body: &str,
    api_key_to_scrub: &str,
) -> Result<String, AiServiceError> {
    if !(200..=299).contains(&status_code) {
        return Err(classify_http_error(status_code, body, api_key_to_scrub));
    }

    let parsed: GeminiGenerateResponse = serde_json::from_str(body).map_err(|_| {
        AiServiceError::with_status(
            AiErrorCode::ProviderError,
            "La respuesta de Gemini API no tiene un formato JSON válido.",
            status_code,
        )
    })?;

    let first_candidate = parsed.candidates.into_iter().next().ok_or_else(|| {
        AiServiceError::with_status(
            AiErrorCode::EmptyResponse,
            "Gemini API devolvió una respuesta sin candidatos.",
            status_code,
        )
    })?;

    let content = first_candidate.content.ok_or_else(|| {
        AiServiceError::with_status(
            AiErrorCode::EmptyResponse,
            "Gemini API devolvió un candidato sin bloques de contenido.",
            status_code,
        )
    })?;

    let combined_text: String = content
        .parts
        .into_iter()
        .map(|p| p.text)
        .collect::<Vec<_>>()
        .join("")
        .trim()
        .to_string();

    if combined_text.is_empty() {
        return Err(AiServiceError::with_status(
            AiErrorCode::EmptyResponse,
            "Gemini API respondió con texto vacío.",
            status_code,
        ));
    }

    Ok(scrub_secret(&combined_text, api_key_to_scrub))
}

pub fn classify_http_error(status_code: u16, body: &str, api_key_to_scrub: &str) -> AiServiceError {
    let parsed_err = serde_json::from_str::<GeminiErrorEnvelope>(body).ok();
    let provider_status = parsed_err
        .as_ref()
        .and_then(|e| e.error.as_ref())
        .and_then(|d| d.status.as_deref())
        .unwrap_or_default();
    let provider_msg_lower = parsed_err
        .as_ref()
        .and_then(|e| e.error.as_ref())
        .and_then(|d| d.message.as_deref())
        .unwrap_or_default()
        .to_lowercase();

    let is_key_rejected = status_code == 401
        || status_code == 403
        || (status_code == 400
            && (provider_status == "INVALID_ARGUMENT" || provider_status == "UNAUTHENTICATED")
            && (provider_msg_lower.contains("api key") || provider_msg_lower.contains("api_key")));

    let (code, raw_message) = if is_key_rejected {
        (
            AiErrorCode::InvalidApiKey,
            format!(
                "Gemini API rechazó la autenticación o la clave API no es válida (HTTP {}).",
                status_code
            ),
        )
    } else if status_code == 404 || provider_status == "NOT_FOUND" {
        (
            AiErrorCode::ModelUnavailable,
            "El modelo de Gemini configurado no está disponible (HTTP 404).".to_string(),
        )
    } else if status_code == 429 || provider_status == "RESOURCE_EXHAUSTED" {
        (
            AiErrorCode::RateLimited,
            "Se alcanzó el límite de solicitudes o cuota de Gemini API (HTTP 429).".to_string(),
        )
    } else if status_code == 400 {
        (
            AiErrorCode::ProviderError,
            "Gemini API rechazó el formato de la solicitud o el modelo configurado (HTTP 400)."
                .to_string(),
        )
    } else if (500..=599).contains(&status_code) {
        (
            AiErrorCode::ProviderError,
            format!(
                "El servidor de Gemini API experimentó un error interno o temporal (HTTP {}).",
                status_code
            ),
        )
    } else {
        (
            AiErrorCode::ProviderError,
            format!(
                "Gemini API devolvió un estado HTTP inesperado ({}).",
                status_code
            ),
        )
    };

    AiServiceError::with_status(
        code,
        scrub_secret(&raw_message, api_key_to_scrub),
        status_code,
    )
}

fn classify_transport_error(err: &reqwest::Error, api_key_to_scrub: &str) -> AiServiceError {
    if err.is_timeout() {
        return AiServiceError::new(
            AiErrorCode::Timeout,
            scrub_secret(
                "La solicitud superó el tiempo máximo de espera.",
                api_key_to_scrub,
            ),
        );
    }

    AiServiceError::new(
        AiErrorCode::NetworkError,
        scrub_secret(
            "No se pudo establecer conexión de red. Verifica tu conexión a Internet o que el servidor esté activo.",
            api_key_to_scrub,
        ),
    )
}

pub fn validate_and_build_backend_chat_url(base_url: &str) -> Result<String, AiServiceError> {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() || trimmed.contains("PENDIENTE-CONFIGURAR-BACKEND") {
        return Err(AiServiceError::new(
            AiErrorCode::BackendNotConfigured,
            "La URL del backend de producción aún no ha sido configurada en Studia.",
        ));
    }

    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err(AiServiceError::new(
            AiErrorCode::BackendNotConfigured,
            "La URL del backend debe comenzar con http:// o https://.",
        ));
    }

    Ok(format!("{}/api/ai/chat", trimmed))
}

fn map_backend_error_code(raw_code: Option<&str>, status_code: u16) -> AiErrorCode {
    match raw_code.unwrap_or_default() {
        "MISSING_API_KEY" => AiErrorCode::MissingApiKey,
        "INVALID_API_KEY" => AiErrorCode::InvalidApiKey,
        "MODEL_UNAVAILABLE" => AiErrorCode::ModelUnavailable,
        "RATE_LIMITED" => AiErrorCode::RateLimited,
        "TIMEOUT" => AiErrorCode::Timeout,
        "NETWORK_ERROR" => AiErrorCode::NetworkError,
        "EMPTY_RESPONSE" => AiErrorCode::EmptyResponse,
        "MESSAGE_TOO_LONG" => AiErrorCode::MessageTooLong,
        "BAD_REQUEST" => AiErrorCode::BadRequest,
        "PROVIDER_ERROR" => AiErrorCode::ProviderError,
        _ => match status_code {
            400 => AiErrorCode::BadRequest,
            413 => AiErrorCode::MessageTooLong,
            429 => AiErrorCode::RateLimited,
            503 => AiErrorCode::MissingApiKey,
            504 => AiErrorCode::Timeout,
            _ => AiErrorCode::ProviderError,
        },
    }
}

pub fn parse_backend_chat_response(
    status_code: u16,
    body: &str,
) -> Result<BackendChatResponseData, AiServiceError> {
    let parsed: BackendChatEnvelope = serde_json::from_str(body).map_err(|_| {
        AiServiceError::with_status(
            AiErrorCode::BackendUnavailable,
            format!(
                "El servidor backend devolvió una respuesta inesperada (HTTP {}).",
                status_code
            ),
            status_code,
        )
    })?;

    if (200..=299).contains(&status_code) && parsed.ok {
        let data = parsed.data.ok_or_else(|| {
            AiServiceError::with_status(
                AiErrorCode::EmptyResponse,
                "El backend respondió sin datos de conversación.",
                status_code,
            )
        })?;
        if data.reply.trim().is_empty() {
            return Err(AiServiceError::with_status(
                AiErrorCode::EmptyResponse,
                "El asistente devolvió una respuesta vacía.",
                status_code,
            ));
        }
        return Ok(BackendChatResponseData {
            reply: data.reply.trim().to_string(),
            model: data.model,
        });
    }

    let err_payload = parsed.error;
    let code = map_backend_error_code(
        err_payload.as_ref().and_then(|e| e.code.as_deref()),
        status_code,
    );
    let message = err_payload
        .and_then(|e| e.message)
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| {
            format!(
                "El servidor backend no pudo completar la solicitud (HTTP {}).",
                status_code
            )
        });

    Err(AiServiceError::with_status(code, message, status_code))
}

pub struct AiClientState {
    client: reqwest::Client,
}

impl AiClientState {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(DEFAULT_TIMEOUT_SECS))
            .build()
            .expect("Failed to initialize reusable reqwest HTTP client");
        Self { client }
    }

    pub fn client(&self) -> &reqwest::Client {
        &self.client
    }
}

impl Default for AiClientState {
    fn default() -> Self {
        Self::new()
    }
}

pub async fn execute_gemini_prompt(
    client: &reqwest::Client,
    config: &GeminiConfig,
    prompt: &str,
) -> Result<String, AiServiceError> {
    let url = build_generate_content_url(config.model())?;
    let payload = build_generate_content_request(prompt)?;

    let response = client
        .post(&url)
        .header("x-goog-api-key", config.api_key())
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| classify_transport_error(&e, config.api_key()))?;

    let status_code = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|e| classify_transport_error(&e, config.api_key()))?;

    parse_gemini_http_response(status_code, &body, config.api_key())
}

/// Ruta principal de uso de la aplicación de escritorio: envía la consulta al servidor `studia-backend`
/// sin requerir ni almacenar claves de Gemini en el cliente.
#[tauri::command]
pub async fn send_ai_chat(
    backend_url: String,
    payload: serde_json::Value,
    ai_state: State<'_, AiClientState>,
) -> Result<BackendChatResponseData, AiServiceError> {
    let endpoint = validate_and_build_backend_chat_url(&backend_url)?;

    let response = ai_state
        .client()
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                AiServiceError::new(
                    AiErrorCode::Timeout,
                    "El servidor de IA tardó demasiado en responder. Intenta de nuevo.",
                )
            } else {
                AiServiceError::new(
                    AiErrorCode::BackendUnavailable,
                    "No se pudo conectar con el servidor de Studia IA. Verifica tu conexión a Internet o que el backend esté en ejecución.",
                )
            }
        })?;

    let status_code = response.status().as_u16();
    let body = response.text().await.map_err(|_| {
        AiServiceError::new(
            AiErrorCode::NetworkError,
            "Error al recibir la respuesta desde el servidor de Studia IA.",
        )
    })?;

    parse_backend_chat_response(status_code, &body)
}

/// Herramienta de diagnóstico directo para desarrollo local (requiere GEMINI_API_KEY en el entorno local).
#[tauri::command]
pub async fn test_gemini_connection(
    ai_state: State<'_, AiClientState>,
) -> Result<AiConnectionTestResult, AiServiceError> {
    let config = GeminiConfig::resolve_from_env()?;
    let reply = execute_gemini_prompt(ai_state.client(), &config, CONNECTION_TEST_PROMPT).await?;

    Ok(AiConnectionTestResult {
        ok: true,
        model: config.model().to_string(),
        reply,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_missing_api_key_returns_controlled_error() {
        let err_none = GeminiConfig::resolve_from_values(None, None).unwrap_err();
        assert_eq!(err_none.code, AiErrorCode::MissingApiKey);
        assert_eq!(err_none.http_status, None);

        let err_blank =
            GeminiConfig::resolve_from_values(Some("   \t\n ".to_string()), None).unwrap_err();
        assert_eq!(err_blank.code, AiErrorCode::MissingApiKey);
    }

    #[test]
    fn test_default_and_custom_model_resolution() {
        let cfg_default =
            GeminiConfig::resolve_from_values(Some("test-secret-key".to_string()), None).unwrap();
        assert_eq!(cfg_default.model(), "gemini-3.5-flash-lite");

        let cfg_blank_model = GeminiConfig::resolve_from_values(
            Some("test-secret-key".to_string()),
            Some("   ".to_string()),
        )
        .unwrap();
        assert_eq!(cfg_blank_model.model(), "gemini-3.5-flash-lite");

        let cfg_custom = GeminiConfig::resolve_from_values(
            Some("test-secret-key".to_string()),
            Some("gemini-2.5-flash".to_string()),
        )
        .unwrap();
        assert_eq!(cfg_custom.model(), "gemini-2.5-flash");

        let invalid_model = GeminiConfig::resolve_from_values(
            Some("test-secret-key".to_string()),
            Some("gemini-2.5-flash?key=injected".to_string()),
        );
        assert!(invalid_model.is_err());
        assert_eq!(invalid_model.unwrap_err().code, AiErrorCode::ProviderError);
    }

    #[test]
    fn test_request_and_url_construction_do_not_expose_key() {
        let cfg = GeminiConfig::resolve_from_values(
            Some("AIzaSySuperSecretKeyValue123".to_string()),
            None,
        )
        .unwrap();

        let url = build_generate_content_url(cfg.model()).unwrap();
        assert_eq!(
            url,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent"
        );
        assert!(!url.contains(cfg.api_key()));

        let req = build_generate_content_request(CONNECTION_TEST_PROMPT).unwrap();
        let json_val = serde_json::to_value(&req).unwrap();
        assert_eq!(json_val["contents"][0]["role"], "user");
        assert_eq!(
            json_val["contents"][0]["parts"][0]["text"],
            CONNECTION_TEST_PROMPT
        );
        assert_eq!(json_val["generationConfig"]["maxOutputTokens"], 128);
    }

    #[test]
    fn test_parse_valid_gemini_response() {
        let sample_json = r#"{
            "candidates": [
                {
                    "content": {
                        "parts": [
                            { "text": "Conexión con Studia verificada." }
                        ],
                        "role": "model"
                    },
                    "finishReason": "STOP",
                    "index": 0
                }
            ],
            "modelVersion": "gemini-3.5-flash-lite"
        }"#;

        let text = parse_gemini_http_response(200, sample_json, "secret-key").unwrap();
        assert_eq!(text, "Conexión con Studia verificada.");
    }

    #[test]
    fn test_detects_empty_or_malformed_responses() {
        let empty_candidates = r#"{ "candidates": [] }"#;
        let err1 = parse_gemini_http_response(200, empty_candidates, "secret-key").unwrap_err();
        assert_eq!(err1.code, AiErrorCode::EmptyResponse);

        let whitespace_text = r#"{
            "candidates": [
                {
                    "content": {
                        "parts": [ { "text": "   \n  " } ]
                    }
                }
            ]
        }"#;
        let err2 = parse_gemini_http_response(200, whitespace_text, "secret-key").unwrap_err();
        assert_eq!(err2.code, AiErrorCode::EmptyResponse);

        let missing_content = r#"{
            "candidates": [
                { "finishReason": "SAFETY" }
            ]
        }"#;
        let err3 = parse_gemini_http_response(200, missing_content, "secret-key").unwrap_err();
        assert_eq!(err3.code, AiErrorCode::EmptyResponse);

        let malformed_json = r#"{ "candidates": [ invalid json "#;
        let err4 = parse_gemini_http_response(200, malformed_json, "secret-key").unwrap_err();
        assert_eq!(err4.code, AiErrorCode::ProviderError);
    }

    #[test]
    fn test_classifies_http_errors_accurately() {
        let key = "AIzaSyFakeSecret999";

        // 401 & 403 -> INVALID_API_KEY
        let err_401 =
            parse_gemini_http_response(401, r#"{"error":{"message":"Unauthorized"}}"#, key)
                .unwrap_err();
        assert_eq!(err_401.code, AiErrorCode::InvalidApiKey);
        assert_eq!(err_401.http_status, Some(401));

        let err_403 = parse_gemini_http_response(403, r#"{"error":{"message":"Forbidden"}}"#, key)
            .unwrap_err();
        assert_eq!(err_403.code, AiErrorCode::InvalidApiKey);

        // 404 -> MODEL_UNAVAILABLE
        let err_404 = parse_gemini_http_response(404, r#"{"error":{"status":"NOT_FOUND"}}"#, key)
            .unwrap_err();
        assert_eq!(err_404.code, AiErrorCode::ModelUnavailable);

        // 400 with API key invalid -> INVALID_API_KEY
        let body_400_key = r#"{
            "error": {
                "code": 400,
                "message": "API key not valid. Please pass a valid API key.",
                "status": "INVALID_ARGUMENT"
            }
        }"#;
        let err_400_key = parse_gemini_http_response(400, body_400_key, key).unwrap_err();
        assert_eq!(err_400_key.code, AiErrorCode::InvalidApiKey);

        // 429 -> RATE_LIMITED
        let body_429 = r#"{
            "error": {
                "code": 429,
                "message": "Resource has been exhausted (e.g. check quota).",
                "status": "RESOURCE_EXHAUSTED"
            }
        }"#;
        let err_429 = parse_gemini_http_response(429, body_429, key).unwrap_err();
        assert_eq!(err_429.code, AiErrorCode::RateLimited);
        assert_eq!(err_429.http_status, Some(429));

        // 503 -> PROVIDER_ERROR
        let err_503 = parse_gemini_http_response(503, "Service Unavailable", key).unwrap_err();
        assert_eq!(err_503.code, AiErrorCode::ProviderError);
        assert_eq!(err_503.http_status, Some(503));
    }

    #[test]
    fn test_never_leaks_api_key_in_debug_or_errors() {
        let secret = "AIzaSyTopSecretKeyDoNotLeak777";
        let cfg = GeminiConfig::resolve_from_values(Some(secret.to_string()), None).unwrap();

        let debug_str = format!("{:?}", cfg);
        assert!(!debug_str.contains(secret));
        assert!(debug_str.contains("[REDACTED]"));

        let echoed_body = format!(
            r#"{{"error":{{"code":400,"message":"Invalid API key: {}","status":"INVALID_ARGUMENT"}}}}"#,
            secret
        );
        let err = parse_gemini_http_response(400, &echoed_body, secret).unwrap_err();
        assert!(!err.message.contains(secret));
    }

    #[test]
    fn test_backend_chat_url_and_response_parsing() {
        let ok_url = validate_and_build_backend_chat_url("http://127.0.0.1:3000/").unwrap();
        assert_eq!(ok_url, "http://127.0.0.1:3000/api/ai/chat");

        let unconfigured = validate_and_build_backend_chat_url(
            "https://PENDIENTE-CONFIGURAR-BACKEND-STUDIA.onrender.com",
        )
        .unwrap_err();
        assert_eq!(unconfigured.code, AiErrorCode::BackendNotConfigured);

        let success_body =
            r#"{"ok":true,"data":{"reply":"Hola estudiante","model":"gemini-3.5-flash-lite"}}"#;
        let parsed = parse_backend_chat_response(200, success_body).unwrap();
        assert_eq!(parsed.reply, "Hola estudiante");
        assert_eq!(parsed.model, "gemini-3.5-flash-lite");

        let rate_err_body =
            r#"{"ok":false,"error":{"code":"RATE_LIMITED","message":"Demasiadas consultas"}}"#;
        let parsed_err = parse_backend_chat_response(429, rate_err_body).unwrap_err();
        assert_eq!(parsed_err.code, AiErrorCode::RateLimited);
        assert_eq!(parsed_err.http_status, Some(429));

        let timeout_err_body =
            r#"{"ok":false,"error":{"code":"TIMEOUT","message":"La solicitud al proveedor de IA superó el tiempo máximo de espera."}}"#;
        let parsed_timeout = parse_backend_chat_response(504, timeout_err_body).unwrap_err();
        assert_eq!(parsed_timeout.code, AiErrorCode::Timeout);
        assert_eq!(parsed_timeout.http_status, Some(504));

        let provider_err_body =
            r#"{"ok":false,"error":{"code":"PROVIDER_ERROR","message":"El servicio de Gemini API no está disponible temporalmente."}}"#;
        let parsed_provider = parse_backend_chat_response(502, provider_err_body).unwrap_err();
        assert_eq!(parsed_provider.code, AiErrorCode::ProviderError);
        assert_eq!(parsed_provider.http_status, Some(502));
    }

    #[test]
    fn test_serializable_error_and_result_contract() {
        let err = AiServiceError::with_status(
            AiErrorCode::RateLimited,
            "Se alcanzó el límite de solicitudes.",
            429,
        );
        let err_json = serde_json::to_value(&err).unwrap();
        assert_eq!(err_json["code"], "RATE_LIMITED");
        assert_eq!(err_json["httpStatus"], 429);

        let res = AiConnectionTestResult {
            ok: true,
            model: DEFAULT_GEMINI_MODEL.to_string(),
            reply: "Conexión con Studia verificada.".to_string(),
        };
        let res_json = serde_json::to_value(&res).unwrap();
        assert_eq!(res_json["ok"], true);
        assert_eq!(res_json["model"], "gemini-3.5-flash-lite");
        assert_eq!(res_json["reply"], "Conexión con Studia verificada.");
    }

    /// Prueba manual bajo demanda contra Gemini API real (ignorada en `cargo test` normal).
    /// Ejecutar en PowerShell con:
    ///   $env:GEMINI_API_KEY = "tu_clave"
    ///   cargo test --manifest-path src-tauri/Cargo.toml test_live_gemini_connection_manual -- --ignored --nocapture
    #[test]
    #[ignore]
    fn test_live_gemini_connection_manual() {
        tauri::async_runtime::block_on(async {
            let config = GeminiConfig::resolve_from_env()
                .expect("Debe definir $env:GEMINI_API_KEY antes de ejecutar esta prueba manual.");
            let state = AiClientState::new();
            let reply = execute_gemini_prompt(state.client(), &config, CONNECTION_TEST_PROMPT)
                .await
                .expect("La petición real a Gemini API falló");
            assert!(!reply.trim().is_empty());
            println!(
                "Respuesta real recibida desde Gemini ({}): {}",
                config.model(),
                reply
            );
        });
    }
}
