import { Anchor, Box, Text } from '@mantine/core';
import { listingDate } from '../../../site/format';
import { CodeBlock } from '../../components/CodeBlock';
import { Custody, Data, Lamp, Meter, SectionHead } from '../../components/primitives';
import type { Account } from '../../data/account';
import { devices, sealingByDay, traces } from '../../data/fixtures';
import { bytes, percent } from '../../format';
import { planLabel } from '../../plan';
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

export function Overview({ account }: { account: Account }) {
  const { billing, usage } = account;
  const capture = usage.credits.capture;
  const sealing = usage.credits.notarization;
  const shares = usage.hosted_traces;
  const attention =
    billing.billing_status === 'review' ? 'Billing' : shares.needs_attention || 'None';
  const peak = Math.max(...sealingByDay);
  const recent = traces.slice(0, 3);
  return (
    <>
      <Box className="x-readouts">
        <Readout
          label="Plan"
          value={planLabel(billing.plan)}
          note={`Resets ${listingDate(usage.credits.reset_at)}`}
          tone={billing.billing_status === 'review' ? 'alert' : undefined}
        />
        <Readout
          label="Capture this month"
          value={percent(capture.total_used_bytes, capture.total_granted_bytes)}
          note={`${bytes(capture.total_used_bytes)} of ${bytes(capture.total_granted_bytes)}`}
        />
        <Readout
          label="Sealing this month"
          value={percent(sealing.total_used_bytes, sealing.total_granted_bytes)}
          note={`${bytes(sealing.total_remaining_bytes)} left`}
        />
        <Readout
          label="Shared traces"
          value={String(shares.shared)}
          note={`${bytes(shares.stored_bytes)} stored`}
        />
        <Readout
          label="Needs attention"
          value={String(attention)}
          note={attention === 'None' ? 'Nothing is waiting on you' : 'Open Traces to resolve it'}
          tone={attention === 'None' ? undefined : 'alert'}
        />
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
            <Meter used={sealing.total_used_bytes} total={sealing.total_granted_bytes} />
            <Box mt={8} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Data c="var(--x-quiet)">
                {bytes(sealing.total_used_bytes)} sealed of {bytes(sealing.total_granted_bytes)}{' '}
                granted
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
