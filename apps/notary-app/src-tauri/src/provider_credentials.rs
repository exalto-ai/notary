use std::{str::FromStr, time::Duration};

use notary_core::vault::{
    DESKTOP_LOCAL_ACCESS_TOKEN_PREFIX, DesktopCredentialProvider, DesktopProviderCredentials,
};
use rand::{TryRngCore as _, rngs::OsRng};
use reqwest::{
    StatusCode,
    header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE, HeaderMap, HeaderValue},
};
use serde::Serialize;
use serde_json::json;
use zeroize::Zeroizing;

use crate::daemon::{
    DaemonProcess, authenticated_managed_generation, managed_daemon_is_healthy,
    reload_managed_daemon_credentials, same_managed_daemon_is_healthy,
};
use crate::service_client::{
    TemporaryCaptureState, confirm_disposable_trace_id, daemon_is_healthy,
    run_while_window_generation_is_current,
};

const CREDENTIAL_SERVICE: &str = "ai.exalto.notary.provider-api-key";
const CAPTURE_ORIGIN: &str = "http://127.0.0.1:8787";
const DISPOSABLE_TRACE_MARKER_PREFIX: &str = "EXALTO-CAPTURE-TEST-";
const DISPOSABLE_TRACE_MARKER_SUFFIX_LEN: usize = 24;
const PROVIDER_TEST_MAX_RESPONSE_BYTES: usize = 256 * 1024;

type StoredProviderCredential = (Zeroizing<String>, Zeroizing<String>);

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
enum CredentialProvider {
    Openai,
    Anthropic,
    Openrouter,
}

impl CredentialProvider {
    const ALL: [Self; 3] = [Self::Openai, Self::Anthropic, Self::Openrouter];

    const fn name(self) -> &'static str {
        match self {
            Self::Openai => "openai",
            Self::Anthropic => "anthropic",
            Self::Openrouter => "openrouter",
        }
    }

    const fn label(self) -> &'static str {
        match self {
            Self::Openai => "OpenAI",
            Self::Anthropic => "Anthropic",
            Self::Openrouter => "OpenRouter",
        }
    }

    const fn validation_url(self) -> &'static str {
        match self {
            Self::Openai => "https://api.openai.com/v1/models",
            Self::Anthropic => "https://api.anthropic.com/v1/models",
            Self::Openrouter => "https://openrouter.ai/api/v1/key",
        }
    }

    const fn capture_test_path(self) -> &'static str {
        match self {
            Self::Openai => "/openai/v1/responses",
            Self::Anthropic => "/anthropic/v1/messages",
            Self::Openrouter => "/openrouter/api/v1/chat/completions",
        }
    }

    const fn daemon_provider(self) -> DesktopCredentialProvider {
        match self {
            Self::Openai => DesktopCredentialProvider::Openai,
            Self::Anthropic => DesktopCredentialProvider::Anthropic,
            Self::Openrouter => DesktopCredentialProvider::Openrouter,
        }
    }
}

impl FromStr for CredentialProvider {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "openai" => Ok(Self::Openai),
            "anthropic" => Ok(Self::Anthropic),
            "openrouter" => Ok(Self::Openrouter),
            _ => Err("Choose a supported API provider.".into()),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
enum CredentialValidation {
    NotChecked,
    Valid,
    Invalid,
    Unavailable,
}

#[derive(Debug, Serialize)]
pub(super) struct ProviderCredentialStatus {
    provider: CredentialProvider,
    label: &'static str,
    configured: bool,
    masked_suffix: Option<String>,
    validation: CredentialValidation,
}

#[derive(Serialize)]
pub(super) struct ProviderCaptureTestResult {
    provider: CredentialProvider,
    model: String,
    marker: String,
    trace_id: Option<String>,
    http_status: u16,
    successful: bool,
    captured: bool,
}

fn credential_entry(provider: CredentialProvider) -> Result<keyring::Entry, String> {
    keyring::Entry::new(CREDENTIAL_SERVICE, provider.name())
        .map_err(|_| "The system credential vault is unavailable.".to_string())
}

fn local_access_token_entry(provider: CredentialProvider) -> Result<keyring::Entry, String> {
    keyring::Entry::new(
        CREDENTIAL_SERVICE,
        &format!("{}-local-access-token", provider.name()),
    )
    .map_err(|_| "The system credential vault is unavailable.".to_string())
}

fn read_api_key(provider: CredentialProvider) -> Result<Option<Zeroizing<String>>, String> {
    let entry = credential_entry(provider)?;
    match entry.get_password() {
        Ok(api_key) => Ok(validated_api_key(api_key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("The API key could not be read from the system credential vault.".into()),
    }
}

fn validated_api_key(api_key: String) -> Option<Zeroizing<String>> {
    let api_key = Zeroizing::new(api_key);
    validate_api_key_input(&api_key).ok()?;
    Some(api_key)
}

fn store_api_key(provider: CredentialProvider, api_key: &Zeroizing<String>) -> Result<(), String> {
    credential_entry(provider)?
        .set_password(api_key)
        .map_err(|_| "The API key could not be saved in the system credential vault.".to_string())
}

fn read_local_access_token(
    provider: CredentialProvider,
) -> Result<Option<Zeroizing<String>>, String> {
    match local_access_token_entry(provider)?.get_password() {
        Ok(token) => Ok(validated_local_access_token(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("The local access token could not be read from Keychain.".into()),
    }
}

fn validated_local_access_token(token: String) -> Option<Zeroizing<String>> {
    let token = Zeroizing::new(token);
    validate_local_access_token(&token).ok()?;
    Some(token)
}

fn store_local_access_token(
    provider: CredentialProvider,
    token: &Zeroizing<String>,
) -> Result<(), String> {
    local_access_token_entry(provider)?
        .set_password(token)
        .map_err(|_| "The local access token could not be saved in Keychain.".to_string())
}

fn delete_local_access_token(provider: CredentialProvider) -> Result<(), String> {
    match local_access_token_entry(provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("The local access token could not be removed from Keychain.".into()),
    }
}

fn delete_api_key(provider: CredentialProvider) -> Result<(), String> {
    match credential_entry(provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("The API key could not be removed from the system credential vault.".into()),
    }
}

fn generate_local_access_token() -> Result<Zeroizing<String>, String> {
    let mut bytes = Zeroizing::new([0_u8; 32]);
    OsRng
        .try_fill_bytes(&mut *bytes)
        .map_err(|_| "A secure local access token could not be generated.".to_string())?;
    Ok(Zeroizing::new(format!(
        "{DESKTOP_LOCAL_ACCESS_TOKEN_PREFIX}{}",
        hex::encode(bytes.as_slice())
    )))
}

fn validate_local_access_token(token: &str) -> Result<(), String> {
    let Some(entropy) = token.strip_prefix(DESKTOP_LOCAL_ACCESS_TOKEN_PREFIX) else {
        return Err("The saved local access token is invalid. Re-import the provider key.".into());
    };
    if entropy.len() != 64 || !entropy.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("The saved local access token is invalid. Re-import the provider key.".into());
    }
    Ok(())
}

fn store_validated_provider_credential(
    provider: CredentialProvider,
    api_key: &Zeroizing<String>,
) -> Result<(), String> {
    let existing_token = read_local_access_token(provider)?;
    let (local_access_token, created_token) = match existing_token {
        Some(token) => (token, false),
        None => (generate_local_access_token()?, true),
    };
    if created_token {
        store_local_access_token(provider, &local_access_token)?;
    }
    if let Err(error) = store_api_key(provider, api_key) {
        if created_token {
            let _ = delete_local_access_token(provider);
        }
        return Err(error);
    }
    Ok(())
}

fn read_provider_credential(
    provider: CredentialProvider,
) -> Result<Option<StoredProviderCredential>, String> {
    let Some(api_key) = read_api_key(provider)? else {
        return Ok(None);
    };
    let Some(local_access_token) = read_local_access_token(provider)? else {
        return Ok(None);
    };
    Ok(Some((api_key, local_access_token)))
}

fn normalize_api_key(api_key: String) -> Result<Zeroizing<String>, String> {
    let api_key = Zeroizing::new(api_key);
    let normalized = Zeroizing::new(api_key.trim().to_owned());
    validate_api_key_input(&normalized)?;
    Ok(normalized)
}

fn validate_api_key_input(api_key: &str) -> Result<(), String> {
    if api_key.len() < 8
        || api_key.len() > 512
        || !api_key.bytes().all(|byte| byte.is_ascii_graphic())
    {
        return Err("Enter a valid API key containing no spaces or line breaks.".into());
    }
    Ok(())
}

fn masked_suffix(api_key: &str) -> String {
    api_key[api_key.len() - 4..].to_owned()
}

fn credential_status(
    provider: CredentialProvider,
    validation: CredentialValidation,
) -> Result<ProviderCredentialStatus, String> {
    let credential = read_provider_credential(provider)?;
    Ok(ProviderCredentialStatus {
        provider,
        label: provider.label(),
        configured: credential.is_some(),
        masked_suffix: credential
            .as_ref()
            .map(|(api_key, _)| masked_suffix(api_key.as_str())),
        validation,
    })
}

pub(super) fn load_provider_credentials() -> Result<DesktopProviderCredentials, String> {
    let mut credentials = DesktopProviderCredentials::default();
    for provider in CredentialProvider::ALL {
        if let Some((api_key, local_access_token)) = read_provider_credential(provider)? {
            credentials.insert(provider.daemon_provider(), api_key, local_access_token);
        }
    }
    Ok(credentials)
}

fn validation_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .https_only(true)
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(10))
        .user_agent(concat!("Exalto-Capture/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|_| "API key validation is temporarily unavailable.".to_string())
}

fn sensitive_header(value: &[u8]) -> Result<HeaderValue, String> {
    let mut value = HeaderValue::from_bytes(value)
        .map_err(|_| "Enter a valid API key containing no spaces or line breaks.".to_string())?;
    value.set_sensitive(true);
    Ok(value)
}

fn validation_request(
    client: &reqwest::Client,
    provider: CredentialProvider,
    api_key: &str,
) -> Result<reqwest::Request, String> {
    let mut request = client.get(provider.validation_url());
    match provider {
        CredentialProvider::Openai | CredentialProvider::Openrouter => {
            let authorization = Zeroizing::new(format!("Bearer {api_key}"));
            request = request.header(
                reqwest::header::AUTHORIZATION,
                sensitive_header(authorization.as_bytes())?,
            );
        }
        CredentialProvider::Anthropic => {
            request = request
                .header("x-api-key", sensitive_header(api_key.as_bytes())?)
                .header("anthropic-version", "2023-06-01");
        }
    }
    request
        .build()
        .map_err(|_| "API key validation is temporarily unavailable.".to_string())
}

fn normalize_provider_test_model(
    provider: CredentialProvider,
    model: String,
) -> Result<String, String> {
    let model = model.trim();
    validate_provider_test_model(provider, model)?;
    Ok(model.to_owned())
}

fn validate_provider_test_model(provider: CredentialProvider, model: &str) -> Result<(), String> {
    let valid_syntax = !model.is_empty()
        && model.len() <= 200
        && model.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':' | b'/')
        });
    let valid_provider_shape = match provider {
        CredentialProvider::Openai | CredentialProvider::Anthropic => !model.contains('/'),
        CredentialProvider::Openrouter => model
            .split_once('/')
            .is_some_and(|(namespace, name)| !namespace.is_empty() && !name.is_empty()),
    };
    if !valid_syntax || !valid_provider_shape {
        return Err("Enter a valid model identifier for this provider.".into());
    }
    Ok(())
}

fn validate_provider_test_marker(marker: &str) -> Result<(), String> {
    let valid = marker
        .strip_prefix(DISPOSABLE_TRACE_MARKER_PREFIX)
        .is_some_and(|suffix| {
            suffix.len() == DISPOSABLE_TRACE_MARKER_SUFFIX_LEN
                && suffix
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || matches!(byte, b'A'..=b'F'))
        });
    if !valid {
        return Err("The disposable test marker is invalid. Start a new connection test.".into());
    }
    Ok(())
}

fn provider_test_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(60))
        .user_agent(concat!("Exalto-Capture/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|_| "The local provider test could not be prepared.".to_string())
}

fn provider_test_request(
    client: &reqwest::Client,
    provider: CredentialProvider,
    model: &str,
    marker: &str,
    local_access_token: &str,
) -> Result<reqwest::Request, String> {
    validate_provider_test_model(provider, model)?;
    validate_provider_test_marker(marker)?;
    let prompt = format!("Reply with exactly: {marker}");
    let body = match provider {
        CredentialProvider::Openai => json!({
            "model": model,
            "input": prompt,
            "max_output_tokens": 64,
            "stream": false,
        }),
        CredentialProvider::Anthropic => json!({
            "model": model,
            "max_tokens": 64,
            "messages": [{ "role": "user", "content": prompt }],
            "stream": false,
        }),
        CredentialProvider::Openrouter => json!({
            "model": model,
            "max_tokens": 64,
            "messages": [{ "role": "user", "content": prompt }],
            "stream": false,
        }),
    };
    let body = serde_json::to_vec(&body)
        .map_err(|_| "The local provider test could not be prepared.".to_string())?;
    let url = format!("{CAPTURE_ORIGIN}{}", provider.capture_test_path());
    let mut request = client
        .post(url)
        .header(CONTENT_TYPE, "application/json")
        .header(ACCEPT, "application/json")
        .body(body);
    match provider {
        CredentialProvider::Openai | CredentialProvider::Openrouter => {
            let authorization = Zeroizing::new(format!("Bearer {local_access_token}"));
            request = request.header(AUTHORIZATION, sensitive_header(authorization.as_bytes())?);
        }
        CredentialProvider::Anthropic => {
            request = request
                .header(
                    "x-api-key",
                    sensitive_header(local_access_token.as_bytes())?,
                )
                .header("anthropic-version", "2023-06-01");
        }
    }
    if provider == CredentialProvider::Openrouter {
        request = request
            .header("http-referer", "https://exalto.ai")
            .header("x-title", "Exalto Capture");
    }
    request
        .build()
        .map_err(|_| "The local provider test could not be prepared.".to_string())
}

fn provider_test_trace_id(headers: &HeaderMap) -> Result<Option<String>, String> {
    let Some(value) = headers.get("x-notary-trace-id") else {
        return Ok(None);
    };
    let value = value
        .to_str()
        .map_err(|_| "The local capture service returned an invalid Trace identifier.")?;
    let valid = value.strip_prefix("trc-").is_some_and(|suffix| {
        !suffix.is_empty()
            && value.len() <= 256
            && suffix
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    });
    if !valid {
        return Err("The local capture service returned an invalid Trace identifier.".into());
    }
    Ok(Some(value.to_owned()))
}

async fn drain_provider_test_response(response: &mut reqwest::Response) -> Result<(), String> {
    let mut received = 0_usize;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "The provider test response could not be read.".to_string())?
    {
        received = received
            .checked_add(chunk.len())
            .ok_or_else(|| "The provider test response was too large.".to_string())?;
        if received > PROVIDER_TEST_MAX_RESPONSE_BYTES {
            return Err("The provider test response was too large.".into());
        }
    }
    Ok(())
}

fn validation_from_status(status: StatusCode) -> CredentialValidation {
    if status.is_success() {
        CredentialValidation::Valid
    } else if status == StatusCode::UNAUTHORIZED {
        CredentialValidation::Invalid
    } else {
        CredentialValidation::Unavailable
    }
}

async fn validate_api_key(provider: CredentialProvider, api_key: &str) -> CredentialValidation {
    let Ok(client) = validation_client() else {
        return CredentialValidation::Unavailable;
    };
    let Ok(request) = validation_request(&client, provider, api_key) else {
        return CredentialValidation::Invalid;
    };
    match client.execute(request).await {
        Ok(response) => validation_from_status(response.status()),
        Err(_) => CredentialValidation::Unavailable,
    }
}

#[tauri::command]
pub(super) fn get_provider_credential_statuses() -> Result<Vec<ProviderCredentialStatus>, String> {
    CredentialProvider::ALL
        .into_iter()
        .map(|provider| credential_status(provider, CredentialValidation::NotChecked))
        .collect()
}

#[tauri::command]
pub(super) async fn import_provider_api_key(
    provider: String,
    api_key: String,
    process: tauri::State<'_, DaemonProcess>,
) -> Result<ProviderCredentialStatus, String> {
    let api_key = normalize_api_key(api_key)?;
    let provider = CredentialProvider::from_str(&provider)?;
    guard_import_target(&process).await?;
    let validation = validate_api_key(provider, &api_key).await;
    if validation == CredentialValidation::Valid {
        let _lifecycle = process.lifecycle.lock().await;
        guard_import_target(&process).await?;
        store_validated_provider_credential(provider, &api_key)?;
        reload_managed_daemon_credentials(&process)?;
    }
    credential_status(provider, validation)
}

#[tauri::command]
pub(super) async fn run_provider_capture_test(
    provider: String,
    model: String,
    marker: String,
    baseline_trace_ids: Vec<String>,
    lease_id: String,
    process: tauri::State<'_, DaemonProcess>,
    temporary_capture: tauri::State<'_, TemporaryCaptureState>,
) -> Result<ProviderCaptureTestResult, String> {
    let mut generation_events = temporary_capture.subscribe_window_generation();
    let expected_generation = *generation_events.borrow();
    if !temporary_capture.owns_live_lease(&lease_id)? {
        return Err("The disposable capture test is no longer active.".into());
    }
    let provider = CredentialProvider::from_str(&provider)?;
    let model = normalize_provider_test_model(provider, model)?;
    validate_provider_test_marker(&marker)?;
    let _lifecycle = run_while_window_generation_is_current(
        &mut generation_events,
        expected_generation,
        "The disposable capture test is no longer active.",
        process.lifecycle.lock(),
    )
    .await?;
    let managed_generation = run_while_window_generation_is_current(
        &mut generation_events,
        expected_generation,
        "The disposable capture test is no longer active.",
        authenticated_managed_generation(&process),
    )
    .await?
    .ok_or_else(|| {
        "The secure provider test requires the local service supervised by Exalto Capture."
            .to_string()
    })?;
    if !temporary_capture.owns_live_lease(&lease_id)? {
        return Err("The disposable capture test is no longer active.".into());
    }
    validate_managed_test_target(true, true)?;
    let local_access_token = match read_provider_credential(provider)? {
        Some((api_key, local_access_token)) => {
            drop(api_key);
            local_access_token
        }
        None => {
            return Err(
                "Import and validate this provider key before running a connection test.".into(),
            );
        }
    };
    let client = provider_test_client()?;
    let request = provider_test_request(&client, provider, &model, &marker, &local_access_token)?;
    drop(local_access_token);
    // Once the scoped token has been copied into the request, every exit from
    // the dispatch path must pass through the uncancelled identity check below.
    // Window cancellation still bounds the request work immediately, while the
    // final 250 ms proof decides whether the token must be rotated.
    let outcome = async {
        let mut response = run_while_window_generation_is_current(
            &mut generation_events,
            expected_generation,
            "The disposable capture test is no longer active.",
            client.execute(request),
        )
        .await?
        .map_err(|_| {
            "The provider test could not reach the local capture service. Start Exalto Capture and try again."
                .to_string()
        })?;
        let http_status = response.status().as_u16();
        let returned_trace_id = provider_test_trace_id(response.headers())?;
        run_while_window_generation_is_current(
            &mut generation_events,
            expected_generation,
            "The disposable capture test is no longer active.",
            drain_provider_test_response(&mut response),
        )
        .await??;
        if !run_while_window_generation_is_current(
            &mut generation_events,
            expected_generation,
            "The disposable capture test is no longer active.",
            same_managed_daemon_is_healthy(&process, managed_generation),
        )
        .await?
        {
            return Err(
                "The supervised local service changed during the secure provider test. The result was discarded."
                    .into(),
            );
        }
        if !temporary_capture.owns_live_lease(&lease_id)? {
            return Err("The disposable capture test is no longer active.".into());
        }
        let successful = (200..=299).contains(&http_status);
        let trace_id = if successful {
            match returned_trace_id {
                Some(trace_id) => run_while_window_generation_is_current(
                    &mut generation_events,
                    expected_generation,
                    "The disposable capture test is no longer active.",
                    confirm_disposable_trace_id(
                        &baseline_trace_ids,
                        provider.name(),
                        &marker,
                        &trace_id,
                    ),
                )
                .await??
                .then_some(trace_id),
                None => None,
            }
        } else {
            None
        };
        if !run_while_window_generation_is_current(
            &mut generation_events,
            expected_generation,
            "The disposable capture test is no longer active.",
            same_managed_daemon_is_healthy(&process, managed_generation),
        )
        .await?
        {
            return Err(
                "The supervised local service changed while confirming the provider test. The result was discarded."
                    .into(),
            );
        }
        if !temporary_capture.owns_live_lease(&lease_id)? {
            return Err("The disposable capture test is no longer active.".into());
        }
        let captured = trace_id.is_some();
        Ok(ProviderCaptureTestResult {
            provider,
            model,
            marker,
            trace_id,
            http_status,
            successful,
            captured,
        })
    }
    .await;

    // This proof is deliberately not tied to window cancellation. It is the
    // short security postflight that prevents a scoped token from remaining
    // valid after a listener replacement, on success and on every error path.
    if !same_managed_daemon_is_healthy(&process, managed_generation).await {
        let rotation = rotate_provider_local_access_token(provider, &process);
        return Err(if rotation.is_ok() {
            "The supervised local service changed during the secure provider test. The result was discarded and the scoped local token was rotated. Copy the new token before trying again."
                .into()
        } else {
            "The supervised local service changed during the secure provider test. The result was discarded. Remove and re-import this provider key before trying again."
                .into()
        });
    }
    outcome
}

fn rotate_provider_local_access_token(
    provider: CredentialProvider,
    process: &DaemonProcess,
) -> Result<(), String> {
    let replacement = generate_local_access_token()?;
    store_local_access_token(provider, &replacement)?;
    reload_managed_daemon_credentials(process)
}

fn validate_managed_test_target(managed_child: bool, daemon_healthy: bool) -> Result<(), String> {
    if !managed_child || !daemon_healthy {
        return Err(
            "The secure provider test requires the local service supervised by Exalto Capture."
                .into(),
        );
    }
    Ok(())
}

#[tauri::command]
pub(super) async fn remove_provider_api_key(
    provider: String,
    process: tauri::State<'_, DaemonProcess>,
) -> Result<ProviderCredentialStatus, String> {
    let provider = CredentialProvider::from_str(&provider)?;
    let _lifecycle = process.lifecycle.lock().await;
    delete_api_key(provider)?;
    let token_removal = delete_local_access_token(provider);
    let daemon_reload = reload_managed_daemon_credentials(&process);
    token_removal?;
    daemon_reload?;
    credential_status(provider, CredentialValidation::NotChecked)
}

fn validate_import_target(managed_child: bool, daemon_healthy: bool) -> Result<(), String> {
    if !managed_child && daemon_healthy {
        return Err(
            "A local service started outside Exalto Capture is already running. Stop it before importing a Keychain API key."
                .into(),
        );
    }
    Ok(())
}

async fn guard_import_target(process: &DaemonProcess) -> Result<(), String> {
    let managed_child = process
        .child
        .lock()
        .map_err(|_| "daemon process state is unavailable")?
        .is_some();
    if managed_child {
        if managed_daemon_is_healthy(process).await {
            return Ok(());
        }
        return Err(
            "The bundled local service has not authenticated its listener. Wait for it to finish starting, or stop the service using the capture ports."
                .into(),
        );
    }
    validate_import_target(false, daemon_is_healthy().await)
}

#[tauri::command]
pub(super) fn copy_provider_local_access_token(provider: String) -> Result<(), String> {
    let provider = CredentialProvider::from_str(&provider)?;
    let Some((_api_key, local_access_token)) = read_provider_credential(provider)? else {
        return Err("Import and validate this provider key before copying its local token.".into());
    };
    copy_local_access_token_to_clipboard(&local_access_token)
}

#[cfg(target_os = "macos")]
fn copy_local_access_token_to_clipboard(token: &str) -> Result<(), String> {
    use std::{io::Write as _, process::Stdio};

    let mut child = std::process::Command::new("/usr/bin/pbcopy")
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| "The local access token could not be copied.".to_string())?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "The local access token could not be copied.".to_string())?;
    stdin
        .write_all(token.as_bytes())
        .map_err(|_| "The local access token could not be copied.".to_string())?;
    drop(stdin);
    let status = child
        .wait()
        .map_err(|_| "The local access token could not be copied.".to_string())?;
    if !status.success() {
        return Err("The local access token could not be copied.".into());
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn copy_local_access_token_to_clipboard(_token: &str) -> Result<(), String> {
    Err("Copying the local access token is currently available on macOS.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_MARKER: &str = "EXALTO-CAPTURE-TEST-0123456789ABCDEF01234567";

    fn request_body(request: &reqwest::Request) -> serde_json::Value {
        let bytes = request
            .body()
            .and_then(reqwest::Body::as_bytes)
            .expect("provider test body is buffered");
        serde_json::from_slice(bytes).expect("provider test body is JSON")
    }

    #[tokio::test]
    async fn window_invalidation_cancels_a_stalled_provider_test() {
        let (generation_events, mut receiver) = tokio::sync::watch::channel(7_u64);
        let lifecycle = std::sync::Arc::new(tokio::sync::Mutex::new(()));
        let task_lifecycle = std::sync::Arc::clone(&lifecycle);
        let request_started = std::sync::Arc::new(tokio::sync::Notify::new());
        let task_request_started = std::sync::Arc::clone(&request_started);
        let stalled = tokio::spawn(async move {
            let _lifecycle = run_while_window_generation_is_current(
                &mut receiver,
                7,
                "The disposable capture test is no longer active.",
                task_lifecycle.lock(),
            )
            .await?;
            task_request_started.notify_one();
            run_while_window_generation_is_current(
                &mut receiver,
                7,
                "The disposable capture test is no longer active.",
                std::future::pending::<()>(),
            )
            .await
        });
        request_started.notified().await;
        generation_events.send_replace(8);
        let _restoration_lifecycle = tokio::time::timeout(Duration::from_secs(1), lifecycle.lock())
            .await
            .expect("capture restoration should acquire the lifecycle promptly");
        let result = tokio::time::timeout(Duration::from_secs(1), stalled)
            .await
            .expect("provider test cancellation should not wait for the request timeout")
            .expect("provider test task should complete");
        assert_eq!(
            result.unwrap_err(),
            "The disposable capture test is no longer active."
        );
    }

    #[test]
    fn provider_allowlist_is_exact_and_does_not_echo_input() {
        for provider in ["openai", "anthropic", "openrouter"] {
            assert!(CredentialProvider::from_str(provider).is_ok());
        }
        let secret_shaped_provider = "sk-secret-provider-name";
        let error = CredentialProvider::from_str(secret_shaped_provider).unwrap_err();
        assert!(!error.contains(secret_shaped_provider));
    }

    #[test]
    fn keys_are_trimmed_bounded_and_masked() {
        let normalized = normalize_api_key("  sk-test-12345678\n".to_owned()).unwrap();
        assert_eq!(&*normalized, "sk-test-12345678");
        assert_eq!(masked_suffix(&normalized), "5678");

        for invalid in [
            "",
            "       ",
            "short",
            "sk-test embedded-space",
            "sk-test\nembedded-line",
        ] {
            let error = normalize_api_key(invalid.to_owned()).unwrap_err();
            if !invalid.is_empty() {
                assert!(!error.contains(invalid));
            }
        }
        assert!(normalize_api_key("x".repeat(513)).is_err());
        assert!(validated_api_key(normalized.to_string()).is_some());
        assert!(validated_api_key("short".into()).is_none());
    }

    #[test]
    fn local_access_tokens_have_a_reserved_prefix_and_256_bits_of_entropy() {
        let token = generate_local_access_token().unwrap();
        let entropy = token
            .strip_prefix(DESKTOP_LOCAL_ACCESS_TOKEN_PREFIX)
            .unwrap();
        assert_eq!(entropy.len(), 64);
        assert!(entropy.bytes().all(|byte| byte.is_ascii_hexdigit()));
        validate_local_access_token(&token).unwrap();
        assert!(validate_local_access_token("exalto_local_too-short").is_err());
        assert!(validated_local_access_token(token.to_string()).is_some());
        assert!(validated_local_access_token("exalto_local_too-short".into()).is_none());
    }

    #[test]
    fn validation_requests_use_only_official_read_only_endpoints() {
        let client = validation_client().unwrap();
        let secret = "sk-test-never-debug-this";

        let openai = validation_request(&client, CredentialProvider::Openai, secret).unwrap();
        assert_eq!(openai.url().as_str(), "https://api.openai.com/v1/models");
        assert_eq!(
            openai.headers()[reqwest::header::AUTHORIZATION],
            format!("Bearer {secret}")
        );
        assert!(!format!("{openai:?}").contains(secret));

        let anthropic = validation_request(&client, CredentialProvider::Anthropic, secret).unwrap();
        assert_eq!(
            anthropic.url().as_str(),
            "https://api.anthropic.com/v1/models"
        );
        assert_eq!(anthropic.headers()["x-api-key"], secret);
        assert_eq!(anthropic.headers()["anthropic-version"], "2023-06-01");
        assert!(!format!("{anthropic:?}").contains(secret));

        let openrouter =
            validation_request(&client, CredentialProvider::Openrouter, secret).unwrap();
        assert_eq!(
            openrouter.url().as_str(),
            "https://openrouter.ai/api/v1/key"
        );
        assert_eq!(
            openrouter.headers()[reqwest::header::AUTHORIZATION],
            format!("Bearer {secret}")
        );
        assert!(!format!("{openrouter:?}").contains(secret));
    }

    #[test]
    fn validation_statuses_do_not_accept_auth_failures() {
        assert_eq!(
            validation_from_status(StatusCode::OK),
            CredentialValidation::Valid
        );
        assert_eq!(
            validation_from_status(StatusCode::UNAUTHORIZED),
            CredentialValidation::Invalid
        );
        assert_eq!(
            validation_from_status(StatusCode::FORBIDDEN),
            CredentialValidation::Unavailable
        );
        assert_eq!(
            validation_from_status(StatusCode::TOO_MANY_REQUESTS),
            CredentialValidation::Unavailable
        );
    }

    #[test]
    fn provider_test_inputs_are_bounded_and_do_not_echo_rejected_values() {
        for (provider, model) in [
            (CredentialProvider::Openai, "gpt-4.1-mini"),
            (CredentialProvider::Anthropic, "claude-3-5-haiku-latest"),
            (CredentialProvider::Openrouter, "openai/gpt-4o-mini:free"),
            (
                CredentialProvider::Openai,
                "ft:gpt-4o-mini:example_org:example_model",
            ),
        ] {
            assert_eq!(
                normalize_provider_test_model(provider, model.into()).unwrap(),
                model
            );
        }
        assert_eq!(
            normalize_provider_test_model(CredentialProvider::Openai, "  gpt-4.1-mini  ".into())
                .unwrap(),
            "gpt-4.1-mini"
        );

        for invalid in [
            "",
            "model with spaces",
            "model?query=secret",
            "model#fragment",
            "model\nname",
        ] {
            let error = normalize_provider_test_model(CredentialProvider::Openai, invalid.into())
                .unwrap_err();
            if !invalid.is_empty() {
                assert!(!error.contains(invalid));
            }
        }
        assert!(
            normalize_provider_test_model(CredentialProvider::Openai, "m".repeat(201)).is_err()
        );
        assert!(
            normalize_provider_test_model(CredentialProvider::Openai, "openai/gpt-4o-mini".into())
                .is_err()
        );
        assert!(
            normalize_provider_test_model(CredentialProvider::Openrouter, "gpt-4o-mini".into())
                .is_err()
        );

        validate_provider_test_marker(TEST_MARKER).unwrap();
        for invalid in [
            "EXALTO-CAPTURE-TEST-0123456789abcdef01234567",
            "EXALTO-CAPTURE-TEST-01234567",
            "secret-marker",
        ] {
            let error = validate_provider_test_marker(invalid).unwrap_err();
            assert!(!error.contains(invalid));
        }
    }

    #[test]
    fn provider_test_requests_use_scoped_tokens_on_exact_loopback_routes() {
        let client = provider_test_client().unwrap();
        let local_token = format!("{DESKTOP_LOCAL_ACCESS_TOKEN_PREFIX}{}", "a".repeat(64));
        let prompt = format!("Reply with exactly: {TEST_MARKER}");

        let openai = provider_test_request(
            &client,
            CredentialProvider::Openai,
            "gpt-4.1-mini",
            TEST_MARKER,
            &local_token,
        )
        .unwrap();
        assert_eq!(openai.method(), reqwest::Method::POST);
        assert_eq!(
            openai.url().as_str(),
            "http://127.0.0.1:8787/openai/v1/responses"
        );
        assert_eq!(openai.headers()[CONTENT_TYPE], "application/json");
        assert_eq!(
            openai.headers()[AUTHORIZATION],
            format!("Bearer {local_token}")
        );
        assert!(openai.headers()[AUTHORIZATION].is_sensitive());
        assert_eq!(
            request_body(&openai),
            json!({
                "model": "gpt-4.1-mini",
                "input": prompt,
                "max_output_tokens": 64,
                "stream": false,
            })
        );
        assert!(!format!("{openai:?}").contains(&local_token));

        let anthropic = provider_test_request(
            &client,
            CredentialProvider::Anthropic,
            "claude-3-5-haiku-latest",
            TEST_MARKER,
            &local_token,
        )
        .unwrap();
        assert_eq!(
            anthropic.url().as_str(),
            "http://127.0.0.1:8787/anthropic/v1/messages"
        );
        assert_eq!(anthropic.headers()["x-api-key"], local_token);
        assert!(anthropic.headers()["x-api-key"].is_sensitive());
        assert_eq!(anthropic.headers()["anthropic-version"], "2023-06-01");
        assert!(anthropic.headers().get(AUTHORIZATION).is_none());
        assert_eq!(
            request_body(&anthropic),
            json!({
                "model": "claude-3-5-haiku-latest",
                "max_tokens": 64,
                "messages": [{ "role": "user", "content": prompt }],
                "stream": false,
            })
        );
        assert!(!format!("{anthropic:?}").contains(&local_token));

        let openrouter = provider_test_request(
            &client,
            CredentialProvider::Openrouter,
            "openai/gpt-4o-mini",
            TEST_MARKER,
            &local_token,
        )
        .unwrap();
        assert_eq!(
            openrouter.url().as_str(),
            "http://127.0.0.1:8787/openrouter/api/v1/chat/completions"
        );
        assert_eq!(
            openrouter.headers()[AUTHORIZATION],
            format!("Bearer {local_token}")
        );
        assert!(openrouter.headers()[AUTHORIZATION].is_sensitive());
        assert_eq!(openrouter.headers()["http-referer"], "https://exalto.ai");
        assert_eq!(openrouter.headers()["x-title"], "Exalto Capture");
        assert_eq!(
            request_body(&openrouter),
            json!({
                "model": "openai/gpt-4o-mini",
                "max_tokens": 64,
                "messages": [{ "role": "user", "content": prompt }],
                "stream": false,
            })
        );
        assert!(!format!("{openrouter:?}").contains(&local_token));
    }

    #[test]
    fn provider_test_request_builder_revalidates_model_and_marker() {
        let client = provider_test_client().unwrap();
        let local_token = format!("{DESKTOP_LOCAL_ACCESS_TOKEN_PREFIX}{}", "a".repeat(64));
        assert!(
            provider_test_request(
                &client,
                CredentialProvider::Openai,
                "model with spaces",
                TEST_MARKER,
                &local_token,
            )
            .is_err()
        );
        assert!(
            provider_test_request(
                &client,
                CredentialProvider::Openai,
                "gpt-4.1-mini",
                "invalid-marker",
                &local_token,
            )
            .is_err()
        );
    }

    #[test]
    fn provider_test_trace_ids_are_optional_and_path_safe() {
        let mut headers = HeaderMap::new();
        assert_eq!(provider_test_trace_id(&headers).unwrap(), None);

        headers.insert(
            "x-notary-trace-id",
            HeaderValue::from_static("trc-1234-safe_identifier"),
        );
        assert_eq!(
            provider_test_trace_id(&headers).unwrap().as_deref(),
            Some("trc-1234-safe_identifier")
        );

        for invalid in ["trace-1234", "trc-../escape", "trc-"] {
            headers.insert("x-notary-trace-id", HeaderValue::from_str(invalid).unwrap());
            let error = provider_test_trace_id(&headers).unwrap_err();
            assert!(!error.contains(invalid));
        }
    }

    #[test]
    fn provider_test_rejects_external_or_unhealthy_local_services() {
        assert!(validate_managed_test_target(true, true).is_ok());
        assert!(validate_managed_test_target(false, true).is_err());
        assert!(validate_managed_test_target(true, false).is_err());
        assert!(validate_managed_test_target(false, false).is_err());
    }

    #[test]
    fn imports_reject_a_healthy_external_daemon_before_storage() {
        assert!(validate_import_target(false, true).is_err());
        assert!(validate_import_target(false, false).is_ok());
        assert!(validate_import_target(true, true).is_ok());
        assert!(validate_import_target(true, false).is_ok());
    }
}
