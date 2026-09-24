import { Alert, Anchor, Box } from '@mantine/core';
import { useEffect, useState } from 'react';
import type { CreditHistoryEntry } from '../../../creditUtilization';
import { aggregateDailyDebits, loadRecentDebits } from '../../../creditUtilization';
import { getCreditHistory, getHostedTraces } from '../../../platform-api/client';
import { CodeBlock } from '../../components/CodeBlock';
import { Custody, Data, Empty, Lamp, Meter, SectionHead } from '../../components/primitives';
import type { Account } from '../../data/account';
import { bytes, listingDate, percent, sessionDate } from '../../format';
import { planLabel } from '../../plan';
import { href } from '../../router';
import type { HostedTrace } from './Traces';

const states = {
  shared: { tone: 'sealed', label: 'Shared' },
  verifying: { tone: 'local', label: 'Verifying' },
  stopped: { tone: 'idle', label: 'Stopped' },
  rejected: { tone: 'alert', label: 'Rejected' },
  failed: { tone: 'alert', label: 'Failed' },
} as const;

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

function SealingChart({ account }: { account: Account }) {
  const sealing = account.usage.credits.notarization;
  const [debits, setDebits] = useState<CreditHistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadRecentDebits(getCreditHistory, Date.now(), () => cancelled)
      .then((entries) => {
        if (!cancelled && entries) setDebits(entries);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const days = aggregateDailyDebits(debits, Date.now());
  const peak = Math.max(...days.map((day) => day.mb), 0);
  const total = days.reduce((sum, day) => sum + day.bytes, 0);

  return (
    <Box className="x-record" p="lg">
      {failed ? (
        <Alert color="alert" variant="light" mb="md">
          Daily sealing could not be loaded. The balance below is still current.
        </Alert>
      ) : null}

      {debits === null && !failed ? (
        <Box className="x-skeleton" h={120} />
      ) : total === 0 ? (
        <Empty title="Nothing sealed in the last 30 days">
          Sealing a trace in Exalto Capture puts it here.
        </Empty>
      ) : (
        <Box
          className="x-columns"
          role="img"
          aria-label={`Sealing per day for the last 30 days, ${bytes(total)} in total`}
        >
          {days.map((day) => (
            <i
              key={day.key}
              data-empty={day.mb === 0}
              style={{ height: day.mb === 0 ? undefined : `${(day.mb / peak) * 100}%` }}
            />
          ))}
        </Box>
      )}

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
        <Meter
          used={sealing.total_used_bytes}
          total={sealing.total_granted_bytes}
          tone={
            sealing.total_granted_bytes > 0 &&
            sealing.total_used_bytes / sealing.total_granted_bytes >= 0.9
              ? 'alert'
              : undefined
          }
        />
        <Box mt={8} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <Data c="var(--x-quiet)">
            {bytes(sealing.total_used_bytes)} sealed of {bytes(sealing.total_granted_bytes)} granted
          </Data>
          <Anchor href={href('/app/usage')} fz={12.5} c="var(--x-seal)">
            Add sealing
          </Anchor>
        </Box>
      </Box>
    </Box>
  );
}

function RecentTraces({ loadTraces = getHostedTraces }: { loadTraces?: typeof getHostedTraces }) {
  const [traces, setTraces] = useState<HostedTrace[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTraces({ limit: 3 })
      .then((page) => {
        if (!cancelled) setTraces(page.items);
      })
      .catch((reason) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : 'Could not load your traces.');
      });
    return () => {
      cancelled = true;
    };
  }, [loadTraces]);

  if (error)
    return (
      <Alert color="alert" variant="light" title="Recent traces could not be loaded">
        {error}
      </Alert>
    );

  if (traces === null)
    return (
      <Box style={{ display: 'grid', gap: 12 }}>
        {[0, 1, 2].map((row) => (
          <Box key={row} className="x-skeleton" h={118} style={{ borderRadius: 6 }} />
        ))}
      </Box>
    );

  if (traces.length === 0)
    return (
      <Box className="x-record">
        <Empty title="You have not shared a trace">
          Seal a trace in Exalto Capture, then share it to host it at a link.
        </Empty>
      </Box>
    );

  return (
    <Box style={{ display: 'grid', gap: 12 }}>
      {traces.map((trace) => (
        <Box key={trace.trace_id} className="x-record x-stub" p="md" pl={22}>
          <Box
            style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}
          >
            <Box miw={0}>
              <Data fz={14}>{trace.trace_id}</Data>
              <Data c="var(--x-quiet)" mt={2} style={{ display: 'block' }}>
                sealed from {trace.source_trace_id}
              </Data>
            </Box>
            <Lamp tone={states[trace.status].tone}>{states[trace.status].label}</Lamp>
          </Box>
          <Box mt="md">
            <Custody
              steps={[
                {
                  label: 'Sealed',
                  detail: sessionDate(trace.created_at),
                  reached: true,
                  tone: 'local',
                },
                {
                  label: 'Verified',
                  detail: trace.verification.verified_at
                    ? sessionDate(trace.verification.verified_at)
                    : (trace.verification.failure_code ?? 'in progress'),
                  reached: Boolean(trace.verification.verified_at),
                  tone: 'sealed',
                },
                {
                  label: 'Shared',
                  detail:
                    trace.status === 'shared'
                      ? trace.access.visibility === 'listed'
                        ? 'listed'
                        : 'unlisted link'
                      : 'not shared',
                  reached: trace.status === 'shared',
                },
              ]}
            />
          </Box>
        </Box>
      ))}
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
        <SealingChart account={account} />
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
        <RecentTraces />
      </Box>

      <Box mt={40}>
        <SectionHead
          title="Connect another device"
          action={
            <Anchor href={href('/app/settings')} fz={13} c="var(--x-seal)">
              Manage devices
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
