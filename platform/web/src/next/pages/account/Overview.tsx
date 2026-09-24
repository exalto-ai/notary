import { Anchor, Box, Text } from '@mantine/core';
import { CodeBlock } from '../../components/CodeBlock';
import { Custody, Data, Lamp, Meter, SectionHead } from '../../components/primitives';
import { devices, sealingByDay, traces, usage } from '../../data/fixtures';
import { bytes, percent } from '../../format';
import { href } from '../../router';

function Readout({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'alert';
}) {
  return (
    <Box className="x-readout">
      <div className="x-readout-label">{label}</div>
      <div
        className="x-readout-value"
        style={tone === 'alert' ? { color: 'var(--x-alert)' } : undefined}
      >
        {value}
      </div>
      {note ? <div className="x-readout-note">{note}</div> : null}
    </Box>
  );
}

export function Overview() {
  const peak = Math.max(...sealingByDay);
  const recent = traces.slice(0, 3);
  return (
    <>
      <Box className="x-readouts">
        <Readout label="Plan" value={usage.plan} note={`Resets ${usage.resetsAt}`} />
        <Readout
          label="Capture this month"
          value={percent(usage.capture.used, usage.capture.total)}
          note={`${bytes(usage.capture.used)} of ${bytes(usage.capture.total)}`}
        />
        <Readout
          label="Sealing this month"
          value={percent(usage.sealing.used, usage.sealing.total)}
          note={`${bytes(usage.sealing.total - usage.sealing.used)} left`}
        />
        <Readout label="Shared traces" value="3" note={`${bytes(usage.storage.used)} stored`} />
        <Readout label="Needs attention" value="1" note="A trace is still verifying" tone="alert" />
      </Box>

      <Box mt={40}>
        <SectionHead
          title="Sealing, last 30 days"
          action={<Data c="var(--x-quiet)">MB per day, UTC</Data>}
        />
        <Box className="x-record" p="lg">
          <Box
            className="x-columns"
            role="img"
            aria-label="Daily sealing volume for the last 30 days"
          >
            {sealingByDay.map((value, index) => (
              <i
                // A fixed 30 day window; index is the day.
                key={index}
                data-empty={value === 0}
                style={{ height: value === 0 ? undefined : `${(value / peak) * 100}%` }}
              />
            ))}
          </Box>
          <Box
            mt="sm"
            pt="sm"
            style={{
              borderTop: '1px solid var(--x-rule)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <Data c="var(--x-quiet)">30 days ago</Data>
            <Data c="var(--x-quiet)">today</Data>
          </Box>
          <Box mt="md">
            <Meter used={usage.sealing.used} total={usage.sealing.total} />
            <Box mt={8} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Data c="var(--x-quiet)">
                {bytes(usage.sealing.used)} sealed of {bytes(usage.sealing.total)} included
              </Data>
              <Anchor href={href('/app/usage')} fz={12.5} c="var(--x-seal)">
                Add sealing
              </Anchor>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box mt={40}>
        <SectionHead
          title="Recently shared"
          action={
            <Anchor href={href('/app/traces')} fz={13} c="var(--x-seal)">
              All traces
            </Anchor>
          }
        />
        <Box style={{ display: 'grid', gap: 12 }}>
          {recent.map((trace) => (
            <Box key={trace.id} className="x-record x-stub" p="md" pl={22}>
              <Box
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <Box miw={0}>
                  <Text fz={15} fw={570}>
                    {trace.title}
                  </Text>
                  <Data c="var(--x-quiet)" mt={2} style={{ display: 'block' }}>
                    {trace.provider} {trace.model}
                  </Data>
                </Box>
                <Lamp
                  tone={
                    trace.state === 'shared'
                      ? 'sealed'
                      : trace.state === 'verifying'
                        ? 'local'
                        : 'idle'
                  }
                >
                  {trace.state === 'shared'
                    ? 'Shared'
                    : trace.state === 'verifying'
                      ? 'Verifying'
                      : 'Expired'}
                </Lamp>
              </Box>
              <Box mt="md">
                <Custody
                  steps={[
                    { label: 'Recorded', detail: 'on this Mac', reached: true, tone: 'local' },
                    { label: 'Sealed', detail: trace.sealedAt, reached: true, tone: 'sealed' },
                    {
                      label: 'Shared',
                      detail: trace.state === 'shared' ? trace.access : 'not shared',
                      reached: trace.state === 'shared',
                    },
                  ]}
                />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box mt={40}>
        <SectionHead
          title="Connect another device"
          action={
            <Anchor href={href('/app/settings')} fz={13} c="var(--x-seal)">
              {devices.length} connected
            </Anchor>
          }
        >
          Run this on the machine you want to seal from. It opens a browser once to confirm the
          device belongs to you.
        </SectionHead>
        <CodeBlock lines={['notaryctl auth login']} />
      </Box>
    </>
  );
}
