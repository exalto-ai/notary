import { useCallback, useEffect, useMemo, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { Download, RefreshCw } from 'lucide-react';
import {
  checkForUpdates,
  errorMessage,
  getDesktopState,
  getUpdateState,
  installUpdateAndRestart,
  isTauri,
  openProductLink,
  setCaptureEnabled,
  startDaemon,
  type DesktopState,
  type DesktopUpdateState,
} from './bridge';
import { HomeView } from './HomeView';
import { LoadingWindow, VaultUnlock } from './LockedState';
import { Onboarding } from './Onboarding';
import {
  StatusDot,
  viewMeta,
  workspaceRoutes,
  type TraceConstraint,
  type View,
} from './product';
import { Sidebar, WorkspaceFrame } from './Shell';
import { SettingsView } from './SettingsView';

function updateChipLabel(update: DesktopUpdateState) {
  if (update.phase === 'checking') return 'Checking for updates';
  if (update.phase === 'downloading') {
    const percent = update.total_bytes
      ? Math.min(100, Math.round((update.downloaded_bytes / update.total_bytes) * 100))
      : 0;
    return `Downloading update${percent ? ` ${percent}%` : ''}`;
  }
  if (update.phase === 'ready') return 'Update ready';
  if (update.phase === 'installing') return 'Installing update';
  if (update.phase === 'error') return 'Update check failed';
  return null;
}

function App() {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const requestedView = query.get('view') as View | null;
  const [view, setView] = useState<View>(requestedView && requestedView in viewMeta ? requestedView : 'home');
  const [traceConstraint, setTraceConstraint] = useState<TraceConstraint | null>(null);
  const [state, setState] = useState<DesktopState | null>(null);
  const [updateState, setUpdateState] = useState<DesktopUpdateState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setState(await getDesktopState());
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: UnlistenFn | null = null;
    void listen<string>('exalto:navigate', (event) => {
      if (event.payload !== 'settings') return;
      if (!state?.onboarding_complete || setupOpen) return;
      setTraceConstraint(null);
      setView('settings');
    }).then((stopListening) => {
      if (disposed) stopListening();
      else unlisten = stopListening;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [setupOpen, state?.onboarding_complete]);

  useEffect(() => {
    const refreshUpdate = async () => {
      try {
        setUpdateState(await getUpdateState());
      } catch (error) {
        setNotice(errorMessage(error));
      }
    };
    void refreshUpdate();
    const timer = window.setInterval(() => void refreshUpdate(), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const runAction = async (name: string, action: () => Promise<void>, success: string) => {
    setBusy(name);
    setNotice(null);
    try {
      await action();
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      await refresh();
      setNotice(success);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const checkForDesktopUpdate = async () => {
    setBusy('update-check');
    setNotice(null);
    try {
      setUpdateState(await checkForUpdates());
    } catch (error) {
      setNotice(errorMessage(error));
      setUpdateState(await getUpdateState());
    } finally {
      setBusy(null);
    }
  };

  const restartToUpdate = async () => {
    setBusy('update-install');
    setNotice(null);
    try {
      await installUpdateAndRestart();
    } catch (error) {
      setNotice(errorMessage(error));
      setUpdateState(await getUpdateState());
      setBusy(null);
    }
  };

  const startCapturing = async () => {
    if (!state?.running) await startDaemon();
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      try {
        await setCaptureEnabled(true);
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
    }
    throw lastError ?? new Error('The local capture service did not become ready.');
  };

  const startLocalService = async () => {
    if (!state?.running) await startDaemon();
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      try {
        await setCaptureEnabled(false);
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
    }
    throw lastError ?? new Error('The local service did not become ready.');
  };

  if (!state) return <LoadingWindow />;
  if (state.vault_locked) {
    return <VaultUnlock refresh={refresh} />;
  }
  if (!state.onboarding_complete || setupOpen) {
    return <Onboarding
      state={state}
      refresh={refresh}
      initialStep={setupOpen ? 'client' : 'welcome'}
      onCancel={setupOpen ? () => setSetupOpen(false) : undefined}
      onFinish={(next) => {
        setSetupOpen(false);
        setView(next);
      }}
    />;
  }

  const route = workspaceRoutes[view];
  const meta = viewMeta[view];
  const navigate = (next: View) => {
    setTraceConstraint(null);
    setView(next);
  };
  const openTraces = (constraint: TraceConstraint) => {
    setTraceConstraint(constraint);
    setView('traces');
  };

  return (
    <div className="native-window">
      <Sidebar
        state={state}
        view={view}
        onNavigate={navigate}
        onOpenCatalogue={() => void openProductLink('catalogue')}
      />
      <section className="window-content">
        <header className="native-toolbar" data-tauri-drag-region="deep">
          <div className="toolbar-title" data-tauri-drag-region="deep">
            <strong>{meta.title}</strong>
            <span>{meta.subtitle}</span>
          </div>
          <div className="toolbar-spacer" data-tauri-drag-region />
          {updateState && updateChipLabel(updateState) && <button
            type="button"
            className={`update-chip is-${updateState.phase}`}
            onClick={() => setView('settings')}
          >
            {updateState.phase === 'downloading' ? <RefreshCw size={11} className="is-spinning" /> : <Download size={11} />}
            {updateChipLabel(updateState)}
          </button>}
          {view === 'providers' && <button className="mac-button is-small toolbar-setup-button" type="button" onClick={() => setSetupOpen(true)}>Connection setup</button>}
          <div className={`service-chip ${state.running && state.capture_enabled ? 'is-recording' : ''}`}>
            <StatusDot running={state.running && state.capture_enabled} />
            {state.running && state.capture_enabled ? 'REC · Capturing' : 'Capture off'}
          </div>
        </header>

        <main className={`native-content ${route ? 'has-workspace' : ''} ${(view === 'settings' || view === 'providers' || view === 'activity') ? 'has-settings-subnav' : ''}`}>
          {(view === 'settings' || view === 'providers' || view === 'activity') && (
            <nav className="settings-subnav" aria-label="Settings sections">
              <button
                type="button"
                className={view === 'settings' ? 'is-selected' : ''}
                onClick={() => navigate('settings')}
              >
                Preferences
              </button>
              <button
                type="button"
                className={view === 'providers' ? 'is-selected' : ''}
                onClick={() => navigate('providers')}
              >
                AI connections
              </button>
              <button
                type="button"
                className={view === 'activity' ? 'is-selected' : ''}
                onClick={() => navigate('activity')}
              >
                Activity log
              </button>
            </nav>
          )}
          {view === 'home' && (
            <HomeView
              state={state}
              busy={busy}
              notice={notice}
              onNavigate={navigate}
              onOpenTraces={openTraces}
              onStartCapture={() => void runAction('capture-start', startCapturing, 'Capture is on.')}
              onStopCapture={() => void runAction('capture-stop', async () => { await setCaptureEnabled(false); }, 'Capture is off.')}
              onRetryConnections={() => void refresh()}
            />
          )}
          {view === 'settings' && <SettingsView
            state={state}
            updateState={updateState}
            busy={busy}
            notice={notice}
            onCheckUpdate={() => void checkForDesktopUpdate()}
            onRestartToUpdate={() => void restartToUpdate()}
            onStartService={() => void runAction('service-start', startLocalService, 'Local service is running. Capture remains off.')}
          />}
          {route && (
            <WorkspaceFrame
              route={route}
              constraint={route === 'traces' ? traceConstraint : null}
              running={state.running}
              onStartService={() => void runAction('service-start', startLocalService, 'Local service is running. Capture remains off.')}
              serviceStarting={busy === 'service-start'}
            />
          )}
        </main>
      </section>
    </div>
  );
}

export default App;
