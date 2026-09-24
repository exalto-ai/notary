import {
  Box,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Text,
  TextInput,
  useMantineColorScheme,
} from '@mantine/core';
import { useState } from 'react';
import { CodeBlock } from '../../components/CodeBlock';
import { Data, Lamp, SectionHead } from '../../components/primitives';
import { account, apiKeys, devices } from '../../data/fixtures';

export function Settings() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [newKey, setNewKey] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

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
            }}
          >
            {account.name.slice(0, 2).toUpperCase()}
          </Box>
          <Box>
            <Text fz={16} fw={570}>
              {account.name}
            </Text>
            <Data c="var(--x-quiet)">
              {account.identifier}, signed in with {account.provider}
            </Data>
          </Box>
        </Group>
      </Box>

      <Box mt={40}>
        <SectionHead title="Appearance" />
        <Group gap="md">
          <SegmentedControl
            value={colorScheme}
            onChange={(value) => setColorScheme(value as 'light' | 'dark' | 'auto')}
            data={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'auto', label: 'Match system' },
            ]}
          />
        </Group>
      </Box>

      <Box mt={40}>
        <SectionHead title="Connected devices">
          A connected device can seal against your account. Revoking one stops it immediately;
          traces it already sealed are unaffected.
        </SectionHead>
        <table className="x-table">
          <thead>
            <tr>
              <th>Device</th>
              <th>Last seen</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td>
                  <Group gap={10}>
                    <Text fz={13.5} fw={550}>
                      {device.name}
                    </Text>
                    {device.current ? <Lamp tone="local">This device</Lamp> : null}
                  </Group>
                  <Data c="var(--x-quiet)" mt={2} style={{ display: 'block' }}>
                    {device.detail}
                  </Data>
                </td>
                <td>
                  <Data c="var(--x-quiet)">{device.lastSeen}</Data>
                </td>
                <td className="x-right">
                  <Button variant="subtle" color="alert" size="xs" h={28}>
                    Revoke
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Box mt={40}>
        <SectionHead
          title="API keys"
          action={
            <Button size="xs" h={28} onClick={() => setNewKey(true)}>
              Create key
            </Button>
          }
        >
          A key lets a deployment seal without a browser. The full key is shown once, at creation,
          and cannot be read again.
        </SectionHead>
        <table className="x-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Key</th>
              <th>Created</th>
              <th>Last used</th>
              <th>State</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {apiKeys.map((key) => (
              <tr key={key.id}>
                <td>
                  <Text fz={13.5} fw={550}>
                    {key.name}
                  </Text>
                </td>
                <td>
                  <Data c="var(--x-quiet)">{key.prefix}…</Data>
                </td>
                <td>
                  <Data c="var(--x-quiet)">{key.created}</Data>
                </td>
                <td>
                  <Data c="var(--x-quiet)">{key.lastUsed}</Data>
                </td>
                <td>
                  <Lamp tone={key.state === 'Active' ? 'sealed' : 'idle'}>{key.state}</Lamp>
                </td>
                <td className="x-right">
                  {key.state === 'Active' ? (
                    <Button variant="subtle" color="alert" size="xs" h={28}>
                      Revoke
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Box mt={40}>
        <SectionHead title="Delete your account" />
        <Box
          className="x-record"
          p="lg"
          maw={640}
          style={{ borderColor: 'color-mix(in srgb, var(--x-alert) 40%, transparent)' }}
        >
          <Text fz="sm">
            Deleting your account removes the account record, queues every hosted trace it owns for
            deletion, and signs you out. Traces on your own machines are untouched.
          </Text>
          <Button color="alert" variant="outline" mt="md" h={36} onClick={() => setDeleting(true)}>
            Delete account
          </Button>
        </Box>
      </Box>

      <Modal
        opened={newKey}
        onClose={() => setNewKey(false)}
        title="Create an API key"
        centered
        size={460}
      >
        <TextInput
          label="Name"
          placeholder="CI sealing"
          description="So you can tell keys apart later."
        />
        <Text fz={13} fw={560} mt="lg">
          Copy this now
        </Text>
        <Box mt={8}>
          <CodeBlock lines={['exk_9f2c4a71d0e83b52c6194ffab27d5e08']} />
        </Box>
        <Text fz={12.5} c="var(--x-quiet)" mt={8}>
          This is the only time the full key is shown.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button h={36} onClick={() => setNewKey(false)}>
            Done
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={deleting}
        onClose={() => setDeleting(false)}
        title="Delete your account?"
        centered
        size={460}
      >
        <Text fz="sm">
          This cannot be undone. Every hosted trace you have shared stops resolving and is queued
          for deletion.
        </Text>
        <TextInput
          mt="md"
          label="Type DELETE to confirm"
          value={confirmText}
          onChange={(event) => setConfirmText(event.currentTarget.value)}
        />
        <Group justify="flex-end" mt="lg" gap={10}>
          <Button variant="default" h={36} onClick={() => setDeleting(false)}>
            Keep my account
          </Button>
          <Button color="alert" h={36} disabled={confirmText !== 'DELETE'}>
            Delete account
          </Button>
        </Group>
      </Modal>
    </>
  );
}
