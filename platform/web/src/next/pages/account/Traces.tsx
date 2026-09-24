import {
  Anchor,
  Box,
  Button,
  CopyButton,
  Drawer,
  Group,
  Input,
  Modal,
  Select,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { Custody, Data, Empty, Fact, Facts, Lamp, type Tone } from '../../components/primitives';
import { type TraceRow, traces } from '../../data/fixtures';
import { bytes } from '../../format';

const stateLamp: Record<TraceRow['state'], { tone: Tone; label: string }> = {
  shared: { tone: 'sealed', label: 'Shared' },
  verifying: { tone: 'local', label: 'Verifying' },
  expired: { tone: 'idle', label: 'Expired' },
  stopped: { tone: 'idle', label: 'Not shared' },
};

export function Traces() {
  const [search, setSearch] = useState('');
  const [state, setState] = useState<string | null>(null);
  const [selected, setSelected] = useState<TraceRow | null>(null);
  const [confirmStop, setConfirmStop] = useState<TraceRow | null>(null);

  const rows = traces.filter(
    (trace) =>
      (!state || trace.state === state) &&
      (!search ||
        `${trace.title} ${trace.provider} ${trace.model} ${trace.id}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );

  return (
    <>
      <Group gap="sm" mb="md" wrap="wrap">
        <TextInput
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder="Search traces"
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
          w={150}
          h={34}
          data={[
            { value: 'shared', label: 'Shared' },
            { value: 'verifying', label: 'Verifying' },
            { value: 'expired', label: 'Expired' },
          ]}
          aria-label="Filter by state"
        />
        <Box style={{ flex: 1 }} />
        <Data c="var(--x-quiet)">
          {rows.length} of {traces.length}
        </Data>
      </Group>

      {rows.length === 0 ? (
        <Box className="x-record">
          <Empty title="No trace matches this filter">
            Clear the search to see every trace you have shared.
          </Empty>
        </Box>
      ) : (
        <Box style={{ overflowX: 'auto' }}>
          <table className="x-table">
            <thead>
              <tr>
                <th>Trace</th>
                <th>State</th>
                <th>Access</th>
                <th>Shared</th>
                <th className="x-right">Size</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((trace) => (
                <tr
                  key={trace.id}
                  data-selectable
                  data-selected={selected?.id === trace.id || undefined}
                  onClick={() => setSelected(trace)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') setSelected(trace);
                  }}
                  tabIndex={0}
                >
                  <td>
                    <Text fz={13.5} fw={550}>
                      {trace.title}
                    </Text>
                    <Data c="var(--x-quiet)" mt={2} style={{ display: 'block' }}>
                      {trace.provider} {trace.model}
                    </Data>
                  </td>
                  <td>
                    <Lamp tone={stateLamp[trace.state].tone}>{stateLamp[trace.state].label}</Lamp>
                  </td>
                  <td>{trace.access}</td>
                  <td>
                    <Data c="var(--x-quiet)">{trace.sharedAt}</Data>
                  </td>
                  <td className="x-right">
                    <Data>{bytes(trace.bytes)}</Data>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}

      <Drawer
        opened={selected !== null}
        onClose={() => setSelected(null)}
        position="right"
        size={460}
        title={selected?.title}
        padding="lg"
        styles={{
          content: { background: 'var(--x-record)' },
          header: { background: 'var(--x-record)' },
        }}
      >
        {selected ? (
          <>
            <Custody
              steps={[
                { label: 'Recorded', detail: 'on this Mac', reached: true, tone: 'local' },
                { label: 'Sealed', detail: selected.sealedAt, reached: true, tone: 'sealed' },
                {
                  label: 'Shared',
                  detail: selected.state === 'shared' ? selected.sharedAt : 'not shared',
                  reached: selected.state === 'shared',
                },
              ]}
            />

            <Box mt="xl">
              <Facts>
                <Fact label="Trace">
                  <Data>{selected.id}</Data>
                </Fact>
                <Fact label="Provider">
                  <Data>{selected.provider}</Data>
                </Fact>
                <Fact label="Model">
                  <Data>{selected.model}</Data>
                </Fact>
                <Fact label="Messages">
                  <Data>{selected.messages}</Data>
                </Fact>
                <Fact label="Package">
                  <Data>{bytes(selected.bytes)}</Data>
                </Fact>
                <Fact label="Digest">
                  <Data>{selected.digest}</Data>
                </Fact>
                <Fact label="Signer">
                  <Data>Seal</Data>
                </Fact>
              </Facts>
            </Box>

            <Box mt="xl">
              <Text fz={14} fw={570}>
                Link
              </Text>
              <Group gap={8} mt={8} wrap="nowrap">
                <Input
                  readOnly
                  value={`https://exalto.ai/s/${selected.id}`}
                  style={{ flex: 1 }}
                  styles={{
                    input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12.5 },
                  }}
                />
                <CopyButton value={`https://exalto.ai/s/${selected.id}`}>
                  {({ copied, copy }) => (
                    <Button variant="default" onClick={copy} h={36}>
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
            </Box>

            <Box mt="xl">
              <Text fz={14} fw={570} mb="sm">
                Sharing
              </Text>
              <Switch
                label="List in public traces"
                description="Unlisted is not private. Anyone with the link can still open it."
                defaultChecked={selected.access.startsWith('Listed')}
                mb="md"
              />
              <Switch
                label="Require a password"
                description="Visitors are asked once, then not again for 24 hours."
                defaultChecked={selected.access.includes('password')}
              />
            </Box>

            <Box
              mt="xl"
              pt="lg"
              style={{ borderTop: '1px solid var(--x-rule)', display: 'flex', gap: 10 }}
            >
              <Button
                component="a"
                href={`https://exalto.ai/s/${selected.id}`}
                variant="default"
                h={36}
              >
                Open public page
              </Button>
              <Button
                color="alert"
                variant="outline"
                h={36}
                onClick={() => setConfirmStop(selected)}
              >
                Stop sharing
              </Button>
            </Box>

            <Text fz={12.5} c="var(--x-quiet)" mt="lg">
              The hosted package holds the disclosed conversation exactly as it was admitted.
              Request and response bodies you disclosed are readable by anyone with the link.
            </Text>
          </>
        ) : null}
      </Drawer>

      <Modal
        opened={confirmStop !== null}
        onClose={() => setConfirmStop(null)}
        title="Stop sharing this trace?"
        centered
        size={440}
      >
        <Text fz="sm">
          <b>{confirmStop?.title}</b> stops resolving at its link and is removed from public traces.
          The sealed package on your own machine is untouched.
        </Text>
        <Group justify="flex-end" mt="lg" gap={10}>
          <Button variant="default" h={36} onClick={() => setConfirmStop(null)}>
            Keep sharing
          </Button>
          <Button color="alert" h={36} onClick={() => setConfirmStop(null)}>
            Stop sharing
          </Button>
        </Group>
      </Modal>

      <Text fz={12.5} c="var(--x-quiet)" mt="lg">
        Sharing is always an explicit action. Nothing here was published by Capture on its own.{' '}
        <Anchor href="#/docs/share" fz={12.5} c="var(--x-seal)">
          How sharing works
        </Anchor>
      </Text>
    </>
  );
}
