use std::{
    sync::{
        Mutex,
        atomic::{AtomicU64, AtomicUsize, Ordering},
    },
    time::Duration,
};

use hmac::{Hmac, Mac};
use notary_core::vault::{CHILD_INITIALIZATION_STDIN_ENV, CHILD_KEY_STDIN_ENV};
use rand::{TryRngCore, rngs::OsRng};
use serde::Deserialize;
use sha2::Sha256;
use tauri::Manager;
use tauri_plugin_shell::{ShellExt, process::CommandChild};
use zeroize::Zeroizing;

use crate::provider_credentials::load_provider_credentials;
use crate::service_client::daemon_is_healthy;
use crate::vault::{
    VaultSession, local_vault_mode, temporary_capture_recovery_pending, vault_unlock_key_for_child,
};

const DESKTOP_CONTROL_STDIN_ENV: &str = "NOTARYD_DESKTOP_CONTROL_STDIN";
const DESKTOP_FORCE_CAPTURE_DISABLED_ENV: &str = "NOTARYD_DESKTOP_FORCE_CAPTURE_DISABLED";
const DESKTOP_HEALTH_URL: &str = "http://127.0.0.1:8788/healthz/desktop";
const DESKTOP_HEALTH_DOMAIN: &[u8] = b"exalto-capture/desktop-health/v1\0";

pub(super) struct ManagedDaemon {
    child: CommandChild,
    instance_secret: Zeroizing<[u8; 32]>,
    generation: u64,
}

#[derive(Default)]
pub(super) struct DaemonProcess {
    pub(super) child: Mutex<Option<ManagedDaemon>>,
    pub(super) lifecycle: tokio::sync::Mutex<()>,
    generation: AtomicU64,
    start_blocks: AtomicUsize,
}

pub(super) struct DaemonStartBlock<'a> {
    process: &'a DaemonProcess,
}

impl Drop for DaemonStartBlock<'_> {
    fn drop(&mut self) {
        self.process.resume_starts();
    }
}

#[derive(Deserialize)]
struct DesktopHealthResponse {
    service: String,
    api_version: String,
    build_id: String,
    proof: String,
}

fn secure_random_bytes() -> Result<[u8; 32], String> {
    let mut bytes = [0_u8; 32];
    OsRng
        .try_fill_bytes(&mut bytes)
        .map_err(|_| "Secure process identity generation is unavailable.".to_string())?;
    Ok(bytes)
}

fn desktop_health_mac(secret: &[u8; 32], challenge: &[u8; 32]) -> Option<Hmac<Sha256>> {
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret).ok()?;
    mac.update(DESKTOP_HEALTH_DOMAIN);
    mac.update(challenge);
    mac.update(b"\0notaryd\0v1\0");
    mac.update(env!("NOTARY_BUILD_ID").as_bytes());
    Some(mac)
}

fn verify_desktop_health_response(
    secret: &[u8; 32],
    challenge: &[u8; 32],
    response: &DesktopHealthResponse,
) -> bool {
    if response.service != "notaryd"
        || response.api_version != "v1"
        || response.build_id != env!("NOTARY_BUILD_ID")
    {
        return false;
    }
    let proof = match hex::decode(&response.proof) {
        Ok(proof) if proof.len() == 32 => proof,
        _ => return false,
    };
    desktop_health_mac(secret, challenge).is_some_and(|mac| mac.verify_slice(&proof).is_ok())
}

impl DaemonProcess {
    pub(super) fn suspend_starts(&self) {
        self.start_blocks.fetch_add(1, Ordering::AcqRel);
    }

    pub(super) fn resume_starts(&self) {
        let resumed =
            self.start_blocks
                .fetch_update(Ordering::AcqRel, Ordering::Acquire, |blocks| {
                    blocks.checked_sub(1)
                });
        debug_assert!(resumed.is_ok(), "daemon start gate underflowed");
    }

    pub(super) fn block_starts(&self) -> DaemonStartBlock<'_> {
        self.suspend_starts();
        DaemonStartBlock { process: self }
    }

    fn ensure_starts_allowed(&self) -> Result<(), String> {
        if self.start_blocks.load(Ordering::Acquire) == 0 {
            Ok(())
        } else {
            Err(
                "Exalto Capture is preparing to quit or install an update. Try again after it finishes."
                    .into(),
            )
        }
    }
}

pub(super) fn owned_child_present(process: &DaemonProcess) -> Result<bool, String> {
    process
        .child
        .lock()
        .map(|child| child.is_some())
        .map_err(|_| "daemon process state is unavailable".into())
}

pub(super) async fn authenticated_managed_generation(process: &DaemonProcess) -> Option<u64> {
    let (secret, generation) = match process.child.lock() {
        Ok(child) => match child.as_ref() {
            Some(child) => (Zeroizing::new(*child.instance_secret), child.generation),
            None => return None,
        },
        Err(_) => return None,
    };
    let challenge = secure_random_bytes().ok()?;
    let client = match reqwest::Client::builder()
        .connect_timeout(Duration::from_millis(150))
        .timeout(Duration::from_millis(250))
        .redirect(reqwest::redirect::Policy::none())
        .build()
    {
        Ok(client) => client,
        Err(_) => return None,
    };
    let response = match client
        .get(DESKTOP_HEALTH_URL)
        .query(&[("challenge", hex::encode(challenge))])
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => response,
        _ => return None,
    };
    let mut response = response;
    let mut body = Vec::with_capacity(512);
    loop {
        let chunk = match response.chunk().await {
            Ok(chunk) => chunk,
            Err(_) => return None,
        };
        let Some(chunk) = chunk else {
            break;
        };
        if body.len().saturating_add(chunk.len()) > 4 * 1024 {
            return None;
        }
        body.extend_from_slice(&chunk);
    }
    let response = match serde_json::from_slice::<DesktopHealthResponse>(&body) {
        Ok(response) => response,
        Err(_) => return None,
    };
    if !verify_desktop_health_response(&secret, &challenge, &response) {
        return None;
    }
    process.child.lock().ok().and_then(|child| {
        child
            .as_ref()
            .filter(|child| child.generation == generation)
            .map(|_| generation)
    })
}

pub(super) async fn managed_daemon_is_healthy(process: &DaemonProcess) -> bool {
    authenticated_managed_generation(process).await.is_some()
}

pub(super) async fn same_managed_daemon_is_healthy(
    process: &DaemonProcess,
    expected_generation: u64,
) -> bool {
    authenticated_managed_generation(process).await == Some(expected_generation)
}

async fn wait_for_managed_daemon(process: &DaemonProcess) -> Result<(), String> {
    let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
    loop {
        if managed_daemon_is_healthy(process).await {
            return Ok(());
        }
        let still_running = process
            .child
            .lock()
            .map_err(|_| "daemon process state is unavailable")?
            .is_some();
        if !still_running {
            return Err("The bundled local service exited before becoming ready.".into());
        }
        if tokio::time::Instant::now() >= deadline {
            stop_managed_daemon_after_credential_failure(process)?;
            return Err(
                "The bundled local service could not prove that it owns the local listener. Another service may be using the capture ports."
                    .into(),
            );
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

async fn reject_external_listener() -> Result<(), String> {
    if daemon_is_healthy().await {
        return Err(
            "A compatible local service started outside Exalto Capture is already using the capture ports. Stop it before starting the bundled service."
                .into(),
        );
    }
    Ok(())
}

fn spawn_daemon_inner(app: &tauri::AppHandle, process: &DaemonProcess) -> Result<(), String> {
    let instance_secret = Zeroizing::new(secure_random_bytes()?);
    let mut child_initialization = daemon_initialization(app, &instance_secret)?;
    let command = app
        .shell()
        .sidecar("notaryd")
        .map_err(|error| format!("Could not locate the bundled local capture service: {error}"))?
        .env(CHILD_KEY_STDIN_ENV, "1")
        .env(CHILD_INITIALIZATION_STDIN_ENV, "1")
        .env(DESKTOP_CONTROL_STDIN_ENV, "1");
    let command = if temporary_capture_recovery_pending() {
        command.env(DESKTOP_FORCE_CAPTURE_DISABLED_ENV, "1")
    } else {
        command
    };
    let (mut events, mut child) = command
        .spawn()
        .map_err(|error| format!("Could not start the bundled local capture service: {error}"))?;

    if child.write(&child_initialization).is_err() {
        let _ = child.kill();
        return Err("Could not initialize the bundled local capture service securely.".into());
    }
    child_initialization.fill(0);

    let generation = process
        .generation
        .fetch_add(1, Ordering::AcqRel)
        .saturating_add(1);
    *process
        .child
        .lock()
        .map_err(|_| "daemon process state is unavailable")? = Some(ManagedDaemon {
        child,
        instance_secret,
        generation,
    });

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            if matches!(
                event,
                tauri_plugin_shell::process::CommandEvent::Terminated(_)
            ) {
                let process = app_handle.state::<DaemonProcess>();
                if let Ok(mut child) = process.child.lock()
                    && process.generation.load(Ordering::Acquire) == generation
                {
                    *child = None;
                }
                break;
            }
        }
    });
    Ok(())
}

pub(super) async fn spawn_daemon_locked(
    app: &tauri::AppHandle,
    process: &DaemonProcess,
) -> Result<(), String> {
    if process
        .child
        .lock()
        .map_err(|_| "daemon process state is unavailable")?
        .is_some()
    {
        return wait_for_managed_daemon(process).await;
    }
    reject_external_listener().await?;
    spawn_daemon_inner(app, process)?;
    wait_for_managed_daemon(process).await
}

fn daemon_initialization(
    app: &tauri::AppHandle,
    instance_secret: &[u8; 32],
) -> Result<Zeroizing<Vec<u8>>, String> {
    let vault_session = app.state::<VaultSession>();
    let mut initialization = vault_unlock_key_for_child(&vault_session)?;
    let credentials = load_provider_credentials()?;
    let credential_line = credentials
        .encode_child_initialization_line(instance_secret)
        .map_err(|_| "Could not prepare the private local-service initialization.".to_string())?;
    initialization.extend_from_slice(&credential_line);
    Ok(initialization)
}

pub(super) fn reload_managed_daemon_credentials(process: &DaemonProcess) -> Result<(), String> {
    let credential_line = load_provider_credentials().and_then(|credentials| {
        credentials
            .encode_initialization_line()
            .map_err(|_| "Could not prepare the private API-key update.".to_string())
    });
    let mut credential_line = match credential_line {
        Ok(credential_line) => credential_line,
        Err(error) => {
            stop_managed_daemon_after_credential_failure(process)?;
            return Err(error);
        }
    };
    let mut guard = process
        .child
        .lock()
        .map_err(|_| "daemon process state is unavailable")?;
    let write_failed = guard
        .as_mut()
        .is_some_and(|child| child.child.write(&credential_line).is_err());
    credential_line.fill(0);
    if write_failed {
        let child = guard.take();
        drop(guard);
        if let Some(child) = child {
            let _ = child.child.kill();
        }
        return Err(
            "The Keychain change was applied, but the local service could not reload it and was stopped. Start capture again to continue."
                .into(),
        );
    }
    Ok(())
}

fn stop_managed_daemon_after_credential_failure(process: &DaemonProcess) -> Result<(), String> {
    let child = process
        .child
        .lock()
        .map_err(|_| "daemon process state is unavailable")?
        .take();
    if let Some(child) = child {
        let _ = child.child.kill();
    }
    Ok(())
}

pub(super) async fn request_managed_daemon_shutdown_inner(
    process: &DaemonProcess,
) -> Result<bool, String> {
    {
        let mut guard = process
            .child
            .lock()
            .map_err(|_| "daemon process state is unavailable")?;
        let Some(child) = guard.as_mut() else {
            return Ok(false);
        };
        child
            .child
            .write(b"shutdown\n")
            .map_err(|error| format!("Could not request a safe local-service shutdown: {error}"))?;
    }
    for _ in 0..6_000 {
        let stopped = process
            .child
            .lock()
            .map_err(|_| "daemon process state is unavailable")?
            .is_none();
        if stopped {
            return Ok(true);
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    Err(
        "The local service is still draining work after ten minutes. It was left running; try again after active work finishes."
            .into(),
    )
}

pub(super) async fn request_managed_daemon_shutdown(
    process: &DaemonProcess,
) -> Result<bool, String> {
    let _lifecycle = process.lifecycle.lock().await;
    request_managed_daemon_shutdown_inner(process).await
}

#[tauri::command]
pub(super) async fn start_daemon(
    app: tauri::AppHandle,
    process: tauri::State<'_, DaemonProcess>,
) -> Result<(), String> {
    let _lifecycle = process.lifecycle.lock().await;
    process.ensure_starts_allowed()?;
    let managed_child = process
        .child
        .lock()
        .map_err(|_| "daemon process state is unavailable")?
        .is_some();
    if managed_child && managed_daemon_is_healthy(&process).await {
        return Ok(());
    }
    if !managed_child && daemon_is_healthy().await {
        return Err(
            "A compatible local service started outside Exalto Capture is already running. Stop it before starting the bundled service."
                .into(),
        );
    }
    if !local_vault_mode().0 {
        return Err("Choose how to protect private captures before starting the service.".into());
    }
    let already_starting = process
        .child
        .lock()
        .map_err(|_| "daemon process state is unavailable")?
        .is_some();
    if !already_starting {
        spawn_daemon_inner(&app, &process)?;
    }
    wait_for_managed_daemon(&process).await
}

#[tauri::command]
pub(super) async fn stop_daemon(process: tauri::State<'_, DaemonProcess>) -> Result<(), String> {
    match request_managed_daemon_shutdown(&process).await? {
        true => Ok(()),
        false if daemon_is_healthy().await => Err(
            "This service was started outside the desktop app. Stop it from the process that launched it."
                .into(),
        ),
        false => Ok(()),
    }
}

#[tauri::command]
pub(super) async fn restart_daemon(
    app: tauri::AppHandle,
    process: tauri::State<'_, DaemonProcess>,
) -> Result<(), String> {
    let _lifecycle = process.lifecycle.lock().await;
    process.ensure_starts_allowed()?;
    let stopped = request_managed_daemon_shutdown_inner(&process).await?;
    if !stopped && daemon_is_healthy().await {
        return Err(
            "This service was started outside the desktop app. Restart it from the process that launched it."
                .into(),
        );
    }
    reject_external_listener().await?;
    spawn_daemon_inner(&app, &process)?;
    wait_for_managed_daemon(&process).await
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use tokio::sync::Notify;

    use super::*;

    fn signed_response(secret: &[u8; 32], challenge: &[u8; 32]) -> DesktopHealthResponse {
        let proof = desktop_health_mac(secret, challenge)
            .expect("fixed-size HMAC key")
            .finalize()
            .into_bytes();
        DesktopHealthResponse {
            service: "notaryd".into(),
            api_version: "v1".into(),
            build_id: env!("NOTARY_BUILD_ID").into(),
            proof: hex::encode(proof),
        }
    }

    #[test]
    fn desktop_health_verifier_rejects_wrong_stale_or_malformed_proofs() {
        let secret = [7_u8; 32];
        let challenge = [9_u8; 32];
        let response = signed_response(&secret, &challenge);
        assert!(verify_desktop_health_response(
            &secret, &challenge, &response
        ));
        assert!(!verify_desktop_health_response(
            &[8_u8; 32],
            &challenge,
            &response
        ));
        assert!(!verify_desktop_health_response(
            &secret,
            &[10_u8; 32],
            &response
        ));

        for invalid in [
            DesktopHealthResponse {
                service: "replacement".into(),
                ..signed_response(&secret, &challenge)
            },
            DesktopHealthResponse {
                api_version: "v2".into(),
                ..signed_response(&secret, &challenge)
            },
            DesktopHealthResponse {
                build_id: "different-build".into(),
                ..signed_response(&secret, &challenge)
            },
            DesktopHealthResponse {
                proof: "not-hex".into(),
                ..signed_response(&secret, &challenge)
            },
            DesktopHealthResponse {
                proof: "00".repeat(31),
                ..signed_response(&secret, &challenge)
            },
        ] {
            assert!(!verify_desktop_health_response(
                &secret, &challenge, &invalid
            ));
        }
    }

    #[tokio::test]
    async fn queued_starts_recheck_the_gate_after_waiting_for_lifecycle() {
        let process = Arc::new(DaemonProcess::default());
        let lifecycle = process.lifecycle.lock().await;
        let queued = Arc::clone(&process);
        let waiting = Arc::new(Notify::new());
        let queued_waiting = Arc::clone(&waiting);
        let task = tokio::spawn(async move {
            queued_waiting.notify_one();
            let _lifecycle = queued.lifecycle.lock().await;
            queued.ensure_starts_allowed()
        });

        waiting.notified().await;
        process.suspend_starts();
        drop(lifecycle);
        assert!(task.await.unwrap().is_err());
        process.resume_starts();
        assert!(process.ensure_starts_allowed().is_ok());
    }

    #[test]
    fn overlapping_quit_and_update_blocks_do_not_reenable_starts_early() {
        let process = DaemonProcess::default();
        let update_block = process.block_starts();
        process.suspend_starts();
        drop(update_block);
        assert!(process.ensure_starts_allowed().is_err());
        process.resume_starts();
        assert!(process.ensure_starts_allowed().is_ok());
    }

    #[tokio::test]
    async fn update_start_block_outlives_the_lifecycle_lock() {
        let process = DaemonProcess::default();
        let update_block = process.block_starts();
        let lifecycle = process.lifecycle.lock().await;

        drop(lifecycle);
        assert!(process.lifecycle.try_lock().is_ok());
        assert!(process.ensure_starts_allowed().is_err());

        drop(update_block);
        assert!(process.ensure_starts_allowed().is_ok());
    }
}
