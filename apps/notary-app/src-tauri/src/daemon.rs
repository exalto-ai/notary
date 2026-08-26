use std::{sync::Mutex, time::Duration};

use notary_core::vault::{CHILD_INITIALIZATION_STDIN_ENV, CHILD_KEY_STDIN_ENV};
use tauri::Manager;
use tauri_plugin_shell::{ShellExt, process::CommandChild};
use zeroize::Zeroizing;

use crate::provider_credentials::load_provider_credentials;
use crate::service_client::daemon_is_healthy;
use crate::vault::{VaultSession, local_vault_mode, vault_unlock_key_for_child};

const DESKTOP_CONTROL_STDIN_ENV: &str = "NOTARYD_DESKTOP_CONTROL_STDIN";

#[derive(Default)]
pub(super) struct DaemonProcess(pub(super) Mutex<Option<CommandChild>>);

pub(super) fn spawn_daemon(app: &tauri::AppHandle, process: &DaemonProcess) -> Result<(), String> {
    let mut child_initialization = daemon_initialization(app)?;
    let (mut events, mut child) = app
        .shell()
        .sidecar("notaryd")
        .map_err(|error| format!("Could not locate the bundled local capture service: {error}"))?
        .env(CHILD_KEY_STDIN_ENV, "1")
        .env(CHILD_INITIALIZATION_STDIN_ENV, "1")
        .env(DESKTOP_CONTROL_STDIN_ENV, "1")
        .spawn()
        .map_err(|error| format!("Could not start the bundled local capture service: {error}"))?;

    if child.write(&child_initialization).is_err() {
        let _ = child.kill();
        return Err("Could not initialize the bundled local capture service securely.".into());
    }
    child_initialization.fill(0);

    *process
        .0
        .lock()
        .map_err(|_| "daemon process state is unavailable")? = Some(child);

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            if matches!(
                event,
                tauri_plugin_shell::process::CommandEvent::Terminated(_)
            ) {
                if let Ok(mut guard) = app_handle.state::<DaemonProcess>().0.lock() {
                    *guard = None;
                }
                break;
            }
        }
    });
    Ok(())
}

fn daemon_initialization(app: &tauri::AppHandle) -> Result<Zeroizing<Vec<u8>>, String> {
    let vault_session = app.state::<VaultSession>();
    let mut initialization = vault_unlock_key_for_child(&vault_session)?;
    let credentials = load_provider_credentials()?;
    let credential_line = credentials
        .encode_initialization_line()
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
        .0
        .lock()
        .map_err(|_| "daemon process state is unavailable")?;
    let write_failed = guard
        .as_mut()
        .is_some_and(|child| child.write(&credential_line).is_err());
    credential_line.fill(0);
    if write_failed {
        let child = guard.take();
        drop(guard);
        if let Some(child) = child {
            let _ = child.kill();
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
        .0
        .lock()
        .map_err(|_| "daemon process state is unavailable")?
        .take();
    if let Some(child) = child {
        let _ = child.kill();
    }
    Ok(())
}

pub(super) async fn request_managed_daemon_shutdown(
    process: &DaemonProcess,
) -> Result<bool, String> {
    {
        let mut guard = process
            .0
            .lock()
            .map_err(|_| "daemon process state is unavailable")?;
        let Some(child) = guard.as_mut() else {
            return Ok(false);
        };
        child
            .write(b"shutdown\n")
            .map_err(|error| format!("Could not request a safe local-service shutdown: {error}"))?;
    }
    for _ in 0..6_000 {
        let stopped = process
            .0
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

#[tauri::command]
pub(super) async fn start_daemon(
    app: tauri::AppHandle,
    process: tauri::State<'_, DaemonProcess>,
) -> Result<(), String> {
    if daemon_is_healthy().await {
        return Ok(());
    }
    if !local_vault_mode().0 {
        return Err("Choose how to protect private captures before starting the service.".into());
    }
    let already_starting = process
        .0
        .lock()
        .map_err(|_| "daemon process state is unavailable")?
        .is_some();
    if !already_starting {
        spawn_daemon(&app, &process)?;
    }
    for _ in 0..50 {
        if daemon_is_healthy().await {
            return Ok(());
        }
        let still_running = process
            .0
            .lock()
            .map_err(|_| "daemon process state is unavailable")?
            .is_some();
        if !still_running {
            return Err("The bundled local service exited before becoming ready.".into());
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    Err("The bundled local service did not become ready within five seconds.".into())
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
    let stopped = request_managed_daemon_shutdown(&process).await?;
    if !stopped && daemon_is_healthy().await {
        return Err(
            "This service was started outside the desktop app. Restart it from the process that launched it."
                .into(),
        );
    }
    spawn_daemon(&app, &process)
}
