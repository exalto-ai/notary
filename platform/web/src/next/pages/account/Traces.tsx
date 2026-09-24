import {
  Alert,
  Anchor,
  Box,
  Button,
  Checkbox,
  CopyButton,
  Drawer,
  Group,
  Input,
  Modal,
  NumberInput,
  PasswordInput,
  Select,
  Text,
  TextInput,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  getHostedTraces,
  stopHostedTraceSharing,
  updateHostedTrace,
} from '../../../platform-api/client';
import { sessionDate } from '../../../site/format';
import {
  Data,
  Empty,
  Fact,
  Facts,
  Lamp,
  SectionHead,
  type Tone,
} from '../../components/primitives';
import { usePagedList } from '../../data/paged';
import { bytes } from '../../format';
import { href } from '../../router';

type HostedTracePage = Awaited<ReturnType<typeof getHostedTraces>>;
export type HostedTrace = HostedTracePage['items'][number];
type Settings = Parameters<typeof updateHostedTrace>[1];

const states: Record<HostedTrace['status'], { tone: Tone; label: string }> = {
  shared: { tone: 'sealed', label: 'Shared' },
  verifying: { tone: 'local', label: 'Verifying' },
  stopped: { tone: 'idle', label: 'Stopped' },
  rejected: { tone: 'alert', label: 'Rejected' },
  failed: { tone: 'alert', label: 'Failed' },
};

function expired(trace: HostedTrace) {
  const at = trace.access.expires_at;
  return Boolean(at && at <= Math.floor(Date.now() / 1000));
}

function accessLabel(trace: HostedTrace): string {
  if (trace.status === 'stopped') return 'Sharing stopped';
  if (expired(trace)) return 'Expired';
  const visibility = trace.access.visibility === 'listed' ? 'Listed' : 'Unlisted';
  return trace.access.password_protected ? `${visibility}, password required` : visibility;
}

function packageSize(trace: HostedTrace) {
  return trace.package.admitted_size_bytes ?? trace.package.declared_size_bytes;
}

function digest(trace: HostedTrace) {
  const value = trace.package.admitted_sha256 ?? trace.package.declared_sha256;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function message(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

/**
 * Mirrors the settings the hosted API actually accepts. Clearing the password
 * sends an empty string, because leaving the field out means "keep it".
 */
function ShareSettings({
  trace,
  open,
  saving,
  error,
  onClose,
  onSave,
}: {
  trace: HostedTrace | null;
  open: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (trace: HostedTrace, settings: Settings) => void;
}) {
  const [visibility, setVisibility] = useState<'unlisted' | 'listed'>('unlisted');
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState<'keep' | 'never' | 'after'>('keep');
  const [days, setDays] = useState<number | string>(7);

  useEffect(() => {
    if (!trace || !open) return;
    setVisibility(trace.access.visibility);
    setLocked(trace.access.password_protected);
    setPassword('');
    setExpiry('keep');
    setDays(7);
  }, [trace, open]);

  if (!trace) return null;

  const needsPassword = locked && !trace.access.password_protected;
  const passwordValid = !needsPassword || password.length >= 8;
  const daysValid = expiry !== 'after' || (Number(days) >= 1 && Number(days) <= 365);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const settings: Settings = { visibility };
    if (!locked && trace.access.password_protected) settings.password = '';
    if (locked && password) settings.password = password;
    if (expiry === 'never') settings.expires_in_days = 0;
    if (expiry === 'after') settings.expires_in_days = Number(days);
    onSave(trace, settings);
  };

  return (
    <Modal
      opened={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title={`Sharing for ${trace.trace_id.slice(0, 8)}`}
      centered
      size={460}
    >
      <form onSubmit={submit}>
        <Text fz={12.5} c="var(--x-quiet)" mb="md">
          Changes apply to the public link immediately.
        </Text>
        <Select
          label="Who can find it"
          value={visibility}
          onChange={(value) => setVisibility(value === 'listed' ? 'listed' : 'unlisted')}
          allowDeselect={false}
          data={[
            { value: 'unlisted', label: 'Unlisted, anyone with the link' },
            { value: 'listed', label: 'Listed in public traces' },
          ]}
        />
        <Checkbox
          mt="md"
          checked={locked}
          onChange={(event) => setLocked(event.currentTarget.checked)}
          label="Require a password"
          description={
            trace.access.password_protected
              ? 'Leave the field blank to keep the current password.'
              : 'Asked before any trace content loads.'
          }
        />
        {locked ? (
          <PasswordInput
            mt="sm"
            label={trace.access.password_protected ? 'New password' : 'Password'}
            placeholder={
              trace.access.password_protected ? 'Keep current password' : 'At least 8 characters'
            }
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            error={password && !passwordValid ? 'At least 8 characters.' : undefined}
          />
        ) : null}
        <Select
          mt="md"
          label="Expiry"
          value={expiry}
          onChange={(value) => setExpiry((value as 'keep' | 'never' | 'after') ?? 'keep')}
          allowDeselect={false}
          data={[
            { value: 'keep', label: 'Keep the current expiry' },
            { value: 'never', label: 'Never expires' },
            { value: 'after', label: 'Expire after a number of days' },
          ]}
        />
        {expiry === 'after' ? (
          <NumberInput
            mt="sm"
            label="Days from now"
            min={1}
            max={365}
            value={days}
            onChange={setDays}
            error={daysValid ? undefined : 'Between 1 and 365.'}
          />
        ) : null}
        {trace.access.expires_at && expiry === 'keep' ? (
          <Text fz={12.5} c="var(--x-quiet)" mt="sm">
            Currently expires {sessionDate(trace.access.expires_at)}.
          </Text>
        ) : null}
        {error ? (
          <Alert color="alert" variant="light" mt="md">
            {error}
          </Alert>
        ) : null}
        <Group justify="flex-end" mt="lg" gap={10}>
          <Button variant="default" h={36} onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" h={36} loading={saving} disabled={!passwordValid || !daysValid}>
            Save changes
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

export function Traces({
  loadTraces = getHostedTraces,
  saveTrace = updateHostedTrace,
  stopSharing = stopHostedTraceSharing,
}: {
  loadTraces?: typeof getHostedTraces;
  saveTrace?: typeof updateHostedTrace;
  stopSharing?: typeof stopHostedTraceSharing;
} = {}) {
  const load = useCallback(
    (options: { limit?: number; cursor?: string }) => loadTraces(options),
    [loadTraces],
  );
  const list = usePagedList<HostedTrace>(load, 'Could not load your shared traces.');

  const [search, setSearch] = useState('');
  const [state, setState] = useState<string | null>(null);
  const [selected, setSelected] = useState<HostedTrace | null>(null);
  const [editing, setEditing] = useState<HostedTrace | null>(null);
  const [stopping, setStopping] = useState<HostedTrace | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const traces = list.items;
  const rows = (traces ?? []).filter(
    (trace) =>
      (!state || trace.status === state) &&
      (!search ||
        `${trace.trace_id} ${trace.source_trace_id}`.toLowerCase().includes(search.toLowerCase())),
  );

  const save = async (trace: HostedTrace, settings: Settings) => {
    setSaving(true);
    setActionError(null);
    try {
      const updated = await saveTrace(trace.trace_id, settings);
      list.replace((item) => item.trace_id === trace.trace_id, updated);
      setSelected((current) => (current?.trace_id === trace.trace_id ? updated : current));
      setEditing(null);
    } catch (reason) {
      setActionError(message(reason, 'Could not update this trace.'));
    } finally {
      setSaving(false);
    }
  };

  const stop = async (trace: HostedTrace) => {
    setSaving(true);
    setActionError(null);
    try {
      await stopSharing(trace.trace_id);
      await list.reload();
      setStopping(null);
      setSelected(null);
    } catch (reason) {
      setActionError(message(reason, 'Could not stop sharing this trace.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Group gap="sm" mb="md" wrap="wrap">
        <TextInput
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder="Search by trace id"
          leftSection={<IconSearch size={15} stroke={1.6} />}
          w={260}
          h={34}
          aria-label="Search traces"
        />
        <Select
          value={state}
          onChange={setState}
          placeholder="Any state"
          clearable
          w={160}
          h={34}
          data={Object.entries(states).map(([value, entry]) => ({ value, label: entry.label }))}
          aria-label="Filter by state"
        />
        <Box style={{ flex: 1 }} />
        {traces ? (
          <Data c="var(--x-quiet)">
            {rows.length} of {traces.length}
          </Data>
        ) : null}
      </Group>

      {list.error ? (
        <Alert color="alert" variant="light" title="Your traces could not be loaded">
          {list.error}
        </Alert>
      ) : traces === null ? (
        <Box className="x-record" p="md">
          {[0, 1, 2].map((row) => (
            <Box key={row} className="x-skeleton" h={48} mb={1} />
          ))}
        </Box>
      ) : rows.length === 0 ? (
        <Box className="x-record">
          <Empty title={traces.length === 0 ? 'You have not shared a trace' : 'No trace matches'}>
            {traces.length === 0 ? (
              <>
                Seal a trace in Exalto Capture, then share it to host it at a link.{' '}
                <Anchor href={href('/docs/share')} fz="sm" c="var(--x-seal)">
                  How sharing works
                </Anchor>
              </>
            ) : (
              'Clear the search or the state filter.'
            )}
          </Empty>
        </Box>
      ) : (
        <>
          <Box style={{ overflowX: 'auto' }}>
            <table className="x-table">
              <thead>
                <tr>
                  <th>Trace</th>
                  <th>State</th>
                  <th>Access</th>
                  <th>Shared</th>
                  <th className="x-right">Package</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((trace) => (
                  <tr
                    key={trace.trace_id}
                    data-selectable
                    data-selected={selected?.trace_id === trace.trace_id || undefined}
                    onClick={() => setSelected(trace)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') setSelected(trace);
                    }}
                    tabIndex={0}
                  >
                    <td>
                      <Data fz={13}>{trace.trace_id.slice(0, 12)}</Data>
                      <Data c="var(--x-quiet)" mt={2} style={{ display: 'block' }}>
                        from {trace.source_trace_id.slice(0, 12)}
                      </Data>
                    </td>
                    <td>
                      <Lamp tone={states[trace.status].tone}>{states[trace.status].label}</Lamp>
                    </td>
                    <td>{accessLabel(trace)}</td>
                    <td>
                      <Data c="var(--x-quiet)">{sessionDate(trace.created_at)}</Data>
                    </td>
                    <td className="x-right">
                      <Data>{bytes(packageSize(trace))}</Data>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
          {list.hasMore ? (
            <Group justify="center" mt="md">
              <Button variant="default" h={34} onClick={list.loadMore} loading={list.loadingMore}>
                Load older traces
              </Button>
            </Group>
          ) : null}
        </>
      )}

      <Drawer
        opened={selected !== null}
        onClose={() => setSelected(null)}
        position="right"
        size={460}
        title={selected ? `Trace ${selected.trace_id.slice(0, 12)}` : undefined}
        padding="lg"
        styles={{
          content: { background: 'var(--x-record)' },
          header: { background: 'var(--x-record)' },
        }}
      >
        {selected ? (
          <TraceInspector
            trace={selected}
            onEdit={() => setEditing(selected)}
            onStop={() => setStopping(selected)}
          />
        ) : null}
      </Drawer>

      <ShareSettings
        trace={editing}
        open={editing !== null}
        saving={saving}
        error={actionError}
        onClose={() => {
          setEditing(null);
          setActionError(null);
        }}
        onSave={save}
      />

      <Modal
        opened={stopping !== null}
        onClose={() => setStopping(null)}
        title="Stop sharing this trace?"
        centered
        size={440}
      >
        <Text fz="sm">
          <Data>{stopping?.trace_id.slice(0, 12)}</Data> stops resolving at its link and leaves
          public traces. The sealed package on your own machine is untouched.
        </Text>
        {actionError ? (
          <Alert color="alert" variant="light" mt="md">
            {actionError}
          </Alert>
        ) : null}
        <Group justify="flex-end" mt="lg" gap={10}>
          <Button variant="default" h={36} onClick={() => setStopping(null)} disabled={saving}>
            Keep sharing
          </Button>
          <Button color="alert" h={36} loading={saving} onClick={() => stopping && stop(stopping)}>
            Stop sharing
          </Button>
        </Group>
      </Modal>

      <Text fz={12.5} c="var(--x-quiet)" mt="lg">
        Sharing is always an explicit action. Nothing here was published by Capture on its own, and
        the hosted package holds the conversation you disclosed exactly as it was admitted.
      </Text>
    </>
  );
}

function TraceInspector({
  trace,
  onEdit,
  onStop,
}: {
  trace: HostedTrace;
  onEdit: () => void;
  onStop: () => void;
}) {
  const link = trace.public_url;
  return (
    <>
      <Lamp tone={states[trace.status].tone}>{states[trace.status].label}</Lamp>

      <Box mt="lg">
        <Facts>
          <Fact label="Trace">
            <Data>{trace.trace_id}</Data>
          </Fact>
          <Fact label="Sealed from">
            <Data>{trace.source_trace_id}</Data>
          </Fact>
          <Fact label="Format">
            <Data>{trace.package.format}</Data>
          </Fact>
          <Fact label="Package">
            <Data>{bytes(packageSize(trace))}</Data>
          </Fact>
          <Fact label="Digest">
            <Data>{digest(trace)}</Data>
          </Fact>
          <Fact label="Shared">
            <Data>{sessionDate(trace.created_at)}</Data>
          </Fact>
          {trace.verification.verified_at ? (
            <Fact label="Verified">
              <Data>{sessionDate(trace.verification.verified_at)}</Data>
            </Fact>
          ) : null}
          {trace.verification.failure_code ? (
            <Fact label="Failure">
              <Data c="var(--x-alert)">{trace.verification.failure_code}</Data>
            </Fact>
          ) : null}
          <Fact label="Access">{accessLabel(trace)}</Fact>
          {trace.access.expires_at ? (
            <Fact label="Expires">
              <Data>{sessionDate(trace.access.expires_at)}</Data>
            </Fact>
          ) : null}
        </Facts>
      </Box>

      {link ? (
        <Box mt="xl">
          <Text fz={14} fw={570} mb={8}>
            Link
          </Text>
          <Group gap={8} wrap="nowrap">
            <Input
              readOnly
              value={link}
              style={{ flex: 1 }}
              styles={{
                input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12.5 },
              }}
            />
            <CopyButton value={link}>
              {({ copied, copy }) => (
                <Button variant="default" onClick={copy} h={36}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Box>
      ) : null}

      <Group mt="xl" pt="lg" gap={10} style={{ borderTop: '1px solid var(--x-rule)' }}>
        {trace.status === 'shared' ? (
          <>
            <Button variant="default" h={36} onClick={onEdit}>
              Sharing settings
            </Button>
            <Button color="alert" variant="outline" h={36} onClick={onStop}>
              Stop sharing
            </Button>
          </>
        ) : null}
        {link ? (
          <Button component="a" href={link} variant="default" h={36}>
            Open public page
          </Button>
        ) : null}
      </Group>

      <Text fz={12.5} c="var(--x-quiet)" mt="lg">
        Request and response bodies you disclosed are readable by anyone with the link.
      </Text>
    </>
  );
}
