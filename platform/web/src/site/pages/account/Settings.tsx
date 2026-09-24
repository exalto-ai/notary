import {
  Alert,
  Box,
  Button,
  Checkbox,
  CopyButton,
  Group,
  Modal,
  SegmentedControl,
  Text,
  TextInput,
  useMantineColorScheme,
} from '@mantine/core';
import { type FormEvent, useCallback, useState } from 'react';
import {
  type AccountApiKey,
  createApiKey,
  deleteCurrentAccount,
  getApiKeys,
  getDevices,
  revokeApiKey,
  revokeDevice,
} from '../../../platform-api/client';
import { CodeBlock } from '../../components/CodeBlock';
import { Data, Empty, Lamp, SectionHead } from '../../components/primitives';
import { type Account, accountName, authProviderName } from '../../data/account';
import { usePagedList } from '../../data/paged';
import { sessionDate } from '../../format';

type ConnectedDevice = Awaited<ReturnType<typeof getDevices>>['items'][number];
type CreatedKey = Awaited<ReturnType<typeof createApiKey>>;

// Every scope the hosted API defines, with what it lets a key do said plainly.
const scopeOptions = [
  ['account:read', 'Read your account identity'],
  ['traces:read', 'Read traces this account owns'],
  ['traces:share', 'Create and manage shared traces'],
  ['capture:request', 'Record through hosted capture'],
  ['notarization:request', 'Seal with Exalto Seal'],
] as const;

type Scope = (typeof scopeOptions)[number][0];

function keyState(key: AccountApiKey): 'Active' | 'Revoked' | 'Expired' {
  if (key.revoked_at) return 'Revoked';
  if (key.expires_at && key.expires_at <= Math.floor(Date.now() / 1000)) return 'Expired';
  return 'Active';
}

function message(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function Appearance() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <Box mt={40}>
      <SectionHead title="Appearance">
        This choice is stored in your browser and applies everywhere Exalto Capture runs in it.
      </SectionHead>
      <SegmentedControl
        value={colorScheme}
        onChange={(value) => setColorScheme(value as 'light' | 'dark' | 'auto')}
        data={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'auto', label: 'Match system' },
        ]}
      />
    </Box>
  );
}

function Devices({
  loadDevices = getDevices,
  revoke = revokeDevice,
}: {
  loadDevices?: typeof getDevices;
  revoke?: typeof revokeDevice;
}) {
  const load = useCallback(
    (options: { limit?: number; cursor?: string }) => loadDevices(options),
    [loadDevices],
  );
  const list = usePagedList<ConnectedDevice>(load, 'Could not load connected devices.');
  const [target, setTarget] = useState<ConnectedDevice | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!target) return;
    setWorking(true);
    setError(null);
    try {
      await revoke(target.device_id);
      list.replace((item) => item.device_id === target.device_id, {
        ...target,
        revoked_at: Math.floor(Date.now() / 1000),
      });
      setTarget(null);
    } catch (reason) {
      setError(message(reason, 'Could not revoke this device.'));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Box mt={40}>
      <SectionHead title="Connected devices">
        A connected device can seal against this account and spend its allowance. Revoking one stops
        it immediately; traces it already sealed are unaffected.
      </SectionHead>

      {list.error ? (
        <Alert color="alert" variant="light" title="Devices could not be loaded">
          {list.error}
        </Alert>
      ) : list.items === null ? (
        <Box className="x-record" p="md">
          <Box className="x-skeleton" h={48} mb={1} />
          <Box className="x-skeleton" h={48} />
        </Box>
      ) : list.items.length === 0 ? (
        <Box className="x-record">
          <Empty title="No device is connected">
            Run <Data>notaryctl auth login</Data> on the machine you want to seal from.
          </Empty>
        </Box>
      ) : (
        <>
          <Box style={{ overflowX: 'auto' }}>
            <table className="x-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Last used</th>
                  <th>Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.items.map((device) => (
                  <tr key={device.device_id}>
                    <td>
                      <Text fz={13.5} fw={550}>
                        {device.device_name}
                      </Text>
                      <Data c="var(--x-quiet)" mt={2} style={{ display: 'block' }}>
                        connected {sessionDate(device.created_at)}
                      </Data>
                    </td>
                    <td>
                      <Data c="var(--x-quiet)">{sessionDate(device.last_used_at)}</Data>
                    </td>
                    <td>
                      <Data c="var(--x-quiet)">{sessionDate(device.expires_at)}</Data>
                    </td>
                    <td className="x-right">
                      {device.revoked_at ? (
                        <Lamp tone="idle">Revoked</Lamp>
                      ) : (
                        <Button
                          variant="subtle"
                          color="alert"
                          size="xs"
                          h={28}
                          onClick={() => setTarget(device)}
                        >
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
          {list.hasMore ? (
            <Group justify="center" mt="md">
              <Button variant="default" h={34} onClick={list.loadMore} loading={list.loadingMore}>
                Load more devices
              </Button>
            </Group>
          ) : null}
        </>
      )}

      <Modal
        opened={target !== null}
        onClose={() => setTarget(null)}
        title="Revoke this device?"
        centered
        size={440}
      >
        <Text fz="sm">
          <b>{target?.device_name}</b> stops being able to seal against this account right away.
          Traces it already sealed keep their evidence.
        </Text>
        {error ? (
          <Alert color="alert" variant="light" mt="md">
            {error}
          </Alert>
        ) : null}
        <Group justify="flex-end" mt="lg" gap={10}>
          <Button variant="default" h={36} onClick={() => setTarget(null)} disabled={working}>
            Keep it connected
          </Button>
          <Button color="alert" h={36} loading={working} onClick={confirm}>
            Revoke device
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}

function ApiKeys({
  loadKeys = getApiKeys,
  create = createApiKey,
  revoke = revokeApiKey,
}: {
  loadKeys?: typeof getApiKeys;
  create?: typeof createApiKey;
  revoke?: typeof revokeApiKey;
}) {
  const load = useCallback(
    (options: { limit?: number; cursor?: string }) => loadKeys(options),
    [loadKeys],
  );
  const list = usePagedList<AccountApiKey>(load, 'Could not load API keys.');

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<Scope[]>(scopeOptions.map(([scope]) => scope));
  const [expiresOn, setExpiresOn] = useState('');
  const [working, setWorking] = useState(false);
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<AccountApiKey | null>(null);

  const closeCreate = () => {
    if (working) return;
    setCreating(false);
    setCreated(null);
    setName('');
    setScopes(scopeOptions.map(([scope]) => scope));
    setExpiresOn('');
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setError(null);
    try {
      // A date input gives a day, and the key should last through it.
      const expiresAt = expiresOn
        ? Math.floor(new Date(`${expiresOn}T23:59:59`).getTime() / 1000)
        : null;
      const response = await create({ name, scopes, expires_at: expiresAt });
      setCreated(response);
      await list.reload();
    } catch (reason) {
      setError(message(reason, 'Could not create the API key.'));
    } finally {
      setWorking(false);
    }
  };

  const confirmRevoke = async () => {
    if (!target) return;
    setWorking(true);
    setError(null);
    try {
      await revoke(target.id);
      list.replace((item) => item.id === target.id, {
        ...target,
        revoked_at: target.revoked_at ?? Math.floor(Date.now() / 1000),
      });
      setTarget(null);
    } catch (reason) {
      setError(message(reason, 'Could not revoke the API key.'));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Box mt={40}>
      <SectionHead
        title="API keys"
        action={
          <Button size="xs" h={28} onClick={() => setCreating(true)}>
            Create key
          </Button>
        }
      >
        A key lets a deployment seal without a browser. The full key is shown once, at creation, and
        cannot be read again.
      </SectionHead>

      {list.error ? (
        <Alert color="alert" variant="light" title="API keys could not be loaded">
          {list.error}
        </Alert>
      ) : list.items === null ? (
        <Box className="x-record" p="md">
          <Box className="x-skeleton" h={48} mb={1} />
          <Box className="x-skeleton" h={48} />
        </Box>
      ) : list.items.length === 0 ? (
        <Box className="x-record">
          <Empty title="No API key yet">
            Create one for a deployment that seals without a person at a browser.
          </Empty>
        </Box>
      ) : (
        <>
          <Box style={{ overflowX: 'auto' }}>
            <table className="x-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Last used</th>
                  <th>Expires</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.items.map((key) => (
                  <tr key={key.id}>
                    <td>
                      <Text fz={13.5} fw={550}>
                        {key.name}
                      </Text>
                      <Data c="var(--x-quiet)" mt={2} style={{ display: 'block' }}>
                        {key.scopes.join(', ')}
                      </Data>
                    </td>
                    <td>
                      <Data c="var(--x-quiet)">{key.prefix}</Data>
                    </td>
                    <td>
                      <Data c="var(--x-quiet)">
                        {key.last_used_at ? sessionDate(key.last_used_at) : 'never'}
                      </Data>
                    </td>
                    <td>
                      <Data c="var(--x-quiet)">
                        {key.expires_at ? sessionDate(key.expires_at) : 'never'}
                      </Data>
                    </td>
                    <td>
                      <Lamp tone={keyState(key) === 'Active' ? 'sealed' : 'idle'}>
                        {keyState(key)}
                      </Lamp>
                    </td>
                    <td className="x-right">
                      {keyState(key) === 'Active' ? (
                        <Button
                          variant="subtle"
                          color="alert"
                          size="xs"
                          h={28}
                          onClick={() => setTarget(key)}
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
          {list.hasMore ? (
            <Group justify="center" mt="md">
              <Button variant="default" h={34} onClick={list.loadMore} loading={list.loadingMore}>
                Load more keys
              </Button>
            </Group>
          ) : null}
        </>
      )}

      <Modal
        opened={creating}
        onClose={closeCreate}
        title={created ? 'Copy this key now' : 'Create an API key'}
        centered
        size={520}
      >
        {created ? (
          <>
            <Text fz="sm">
              This is the only time the full key is shown. Store it where the deployment can read
              it.
            </Text>
            <Box mt="md">
              <CodeBlock lines={[created.secret]} />
            </Box>
            <Group justify="flex-end" mt="lg" gap={10}>
              <CopyButton value={created.secret}>
                {({ copied, copy }) => (
                  <Button variant="default" h={36} onClick={copy}>
                    {copied ? 'Copied' : 'Copy key'}
                  </Button>
                )}
              </CopyButton>
              <Button h={36} onClick={closeCreate}>
                Done
              </Button>
            </Group>
          </>
        ) : (
          <form onSubmit={submit}>
            <TextInput
              label="Name"
              placeholder="CI sealing"
              description="So you can tell keys apart later."
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              required
            />
            <Text fz={14} fw={570} mt="lg" mb={8}>
              What this key can do
            </Text>
            <Box style={{ display: 'grid', gap: 10 }}>
              {scopeOptions.map(([scope, label]) => (
                <Checkbox
                  key={scope}
                  label={label}
                  description={scope}
                  checked={scopes.includes(scope)}
                  onChange={(event) =>
                    setScopes((current) =>
                      event.currentTarget.checked
                        ? [...current, scope]
                        : current.filter((value) => value !== scope),
                    )
                  }
                />
              ))}
            </Box>
            <TextInput
              mt="lg"
              type="date"
              label="Expires"
              description="Leave empty for a key that does not expire."
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.currentTarget.value)}
            />
            {error ? (
              <Alert color="alert" variant="light" mt="md">
                {error}
              </Alert>
            ) : null}
            <Group justify="flex-end" mt="lg" gap={10}>
              <Button variant="default" h={36} onClick={closeCreate} disabled={working}>
                Cancel
              </Button>
              <Button
                type="submit"
                h={36}
                loading={working}
                disabled={!name.trim() || scopes.length === 0}
              >
                Create key
              </Button>
            </Group>
          </form>
        )}
      </Modal>

      <Modal
        opened={target !== null}
        onClose={() => setTarget(null)}
        title="Revoke this key?"
        centered
        size={440}
      >
        <Text fz="sm">
          <b>{target?.name}</b> stops working immediately. Anything using it will start failing to
          authenticate.
        </Text>
        {error ? (
          <Alert color="alert" variant="light" mt="md">
            {error}
          </Alert>
        ) : null}
        <Group justify="flex-end" mt="lg" gap={10}>
          <Button variant="default" h={36} onClick={() => setTarget(null)} disabled={working}>
            Keep it
          </Button>
          <Button color="alert" h={36} loading={working} onClick={confirmRevoke}>
            Revoke key
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}

function DeleteAccount({
  identifier,
  onDeleted,
  remove = deleteCurrentAccount,
}: {
  identifier: string;
  onDeleted: () => void;
  remove?: typeof deleteCurrentAccount;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (confirmation !== identifier || working) return;
    setWorking(true);
    setError(null);
    try {
      await remove();
      onDeleted();
    } catch (reason) {
      setError(message(reason, 'Could not delete the account.'));
      setWorking(false);
    }
  };

  return (
    <Box mt={40}>
      <SectionHead title="Delete your account" />
      <Box
        className="x-record"
        p="lg"
        maw={680}
        style={{ borderColor: 'color-mix(in srgb, var(--x-alert) 40%, transparent)' }}
      >
        <Text fz="sm">
          This deletes hosted traces, active share access, API keys, devices, billing and account
          data, and hosted settings according to the retention policy. Traces and settings on your
          own machines are not touched.
        </Text>
        <Button color="alert" variant="outline" mt="md" h={36} onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </Box>

      <Modal
        opened={open}
        onClose={() => {
          if (!working) {
            setOpen(false);
            setConfirmation('');
            setError(null);
          }
        }}
        title={`Delete ${identifier}?`}
        centered
        size={480}
      >
        <form onSubmit={submit}>
          <Text fz="sm">
            This cannot be undone. Every hosted trace stops resolving at its link and is queued for
            deletion.
          </Text>
          <TextInput
            mt="md"
            label={`Type ${identifier} to confirm`}
            value={confirmation}
            onChange={(event) => setConfirmation(event.currentTarget.value)}
            autoComplete="off"
            disabled={working}
          />
          {error ? (
            <Alert color="alert" variant="light" mt="md">
              {error}
            </Alert>
          ) : null}
          <Group justify="flex-end" mt="lg" gap={10}>
            <Button variant="default" h={36} onClick={() => setOpen(false)} disabled={working}>
              Keep my account
            </Button>
            <Button
              type="submit"
              color="alert"
              h={36}
              loading={working}
              disabled={confirmation !== identifier}
            >
              Delete account
            </Button>
          </Group>
        </form>
      </Modal>
    </Box>
  );
}

export function Settings({
  account,
  onAccountDeleted,
}: {
  account: Account;
  onAccountDeleted: () => void;
}) {
  const name = accountName(account);
  return (
    <>
      <Box className="x-record" p="lg">
        <Group gap="md" align="center">
          <Box
            w={40}
            h={40}
            style={{
              borderRadius: 999,
              background: 'var(--x-sunken)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 600,
              fontSize: 13,
              overflow: 'hidden',
            }}
          >
            {account.avatar_url ? (
              <img
                src={account.avatar_url}
                alt=""
                referrerPolicy="no-referrer"
                width={40}
                height={40}
                style={{ display: 'block', objectFit: 'cover' }}
              />
            ) : (
              name.slice(0, 2).toUpperCase()
            )}
          </Box>
          <Box>
            <Text fz={16} fw={570}>
              {name}
            </Text>
            <Data c="var(--x-quiet)">
              {account.provider_display_name}, signed in with {authProviderName(account)}
            </Data>
          </Box>
        </Group>
      </Box>

      <Appearance />
      <Devices />
      <ApiKeys />
      <DeleteAccount identifier={account.provider_display_name} onDeleted={onAccountDeleted} />
    </>
  );
}
