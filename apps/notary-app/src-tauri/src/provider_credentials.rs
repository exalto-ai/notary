use std::{str::FromStr, time::Duration};

use notary_core::vault::{
    DESKTOP_LOCAL_ACCESS_TOKEN_PREFIX, DesktopCredentialProvider, DesktopProviderCredentials,
};
use rand::{TryRngCore as _, rngs::OsRng};
use reqwest::{StatusCode, header::HeaderValue};
use serde::Serialize;
use zeroize::Zeroizing;

use crate::daemon::{DaemonProcess, reload_managed_daemon_credentials};
use crate::service_client::daemon_is_healthy;

const CREDENTIAL_SERVICE: &str = "ai.exalto.notary.provider-api-key";

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
        guard_import_target(&process).await?;
        store_validated_provider_credential(provider, &api_key)?;
        reload_managed_daemon_credentials(&process)?;
    }
    credential_status(provider, validation)
}

#[tauri::command]
pub(super) fn remove_provider_api_key(
    provider: String,
    process: tauri::State<'_, DaemonProcess>,
) -> Result<ProviderCredentialStatus, String> {
    let provider = CredentialProvider::from_str(&provider)?;
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
        .0
        .lock()
        .map_err(|_| "daemon process state is unavailable")?
        .is_some();
    if managed_child {
        return Ok(());
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
    fn imports_reject_a_healthy_external_daemon_before_storage() {
        assert!(validate_import_target(false, true).is_err());
        assert!(validate_import_target(false, false).is_ok());
        assert!(validate_import_target(true, true).is_ok());
        assert!(validate_import_target(true, false).is_ok());
    }
}
