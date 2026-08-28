import type { DesktopState } from './bridge';

export type View = 'home' | 'traces' | 'activity' | 'providers' | 'settings';
export type WorkspaceView = Exclude<View, 'home'>;
export type TraceConstraint =
  | 'state=captured'
  | 'status=notarizing'
  | 'state=notarized'
  | 'status=needs_attention';

export const DISPLAY_NAME = 'Exalto Capture';
export const TRACE_CATALOGUE_URL = 'https://llm-notary.exalto.ai/traces';

export const viewMeta: Record<View, { title: string; subtitle: string }> = {
  home: { title: 'Capture', subtitle: 'Private traces on this Mac' },
  traces: { title: 'Traces', subtitle: 'Capture, seal, verify, and share' },
  activity: { title: 'Activity log', subtitle: 'Local capture, sealing, and sharing events' },
  providers: { title: 'AI connections', subtitle: 'Connect the tools you already use' },
  settings: { title: 'Settings', subtitle: 'Connections, privacy, and app behavior' },
};

export const workspaceRoutes: Partial<Record<View, WorkspaceView>> = {
  traces: 'traces',
  activity: 'activity',
  providers: 'providers',
};

export function vaultProtection(mode: string) {
  if (mode === 'keychain') {
    return {
      label: 'Protected by Keychain',
      detail: 'The vault key is protected by this Mac.',
    };
  }
  if (mode === 'convenience') {
    return {
      label: 'No device protection',
      detail: 'Anyone signed in to this account can open private trace evidence.',
    };
  }
  return {
    label: 'Passphrase vault',
    detail: 'The existing passphrase is required to unlock private traces.',
  };
}

export function StatusDot({ running, warning = false }: { running: boolean; warning?: boolean }) {
  return <span className={`status-dot ${running ? 'is-running' : ''} ${warning ? 'is-warning' : ''}`} />;
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function updateRestartBlockReason(state: DesktopState) {
  if (state.counts.capturing > 0) return 'Finish the active capture before restarting.';
  if (state.counts.notarizing > 0) return 'Finish the active seal before restarting.';
  if (state.running && !state.managed_by_desktop) return 'Stop or update the separately managed local service first.';
  return null;
}
