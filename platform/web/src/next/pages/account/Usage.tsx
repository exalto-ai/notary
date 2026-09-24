import { Box, Button, Group, Text } from '@mantine/core';
import { Data, Fact, Facts, Meter, SectionHead } from '../../components/primitives';
import { purchases, usage } from '../../data/fixtures';
import { bytes, percent } from '../../format';

function Allowance({
  label,
  used,
  total,
  note,
  tone,
}: {
  label: string;
  used: number;
  total: number;
  note: string;
  tone?: 'alert';
}) {
  return (
    <Box p="md" style={{ minWidth: 0 }}>
      <Group justify="space-between" align="baseline" gap="sm">
        <Text fz={14} fw={570}>
          {label}
        </Text>
        <Data c={tone === 'alert' ? 'var(--x-alert)' : 'var(--x-quiet)'}>
          {percent(used, total)} used
        </Data>
      </Group>
      <Box mt={12}>
        <Meter used={used} total={total} tone={tone} />
      </Box>
      <Data c="var(--x-quiet)" mt={10} style={{ display: 'block' }}>
        {bytes(total - used)} left of {bytes(total)}
      </Data>
      <Text fz={12.5} c="var(--x-faint)" mt={4}>
        {note}
      </Text>
    </Box>
  );
}

export function Usage() {
  return (
    <>
      <Box className="x-record" p="lg">
        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
          <Box>
            <Text fz={27} fw={600} className="x-display" lh={1.1}>
              {usage.plan}
            </Text>
            <Data c="var(--x-quiet)" mt={4} style={{ display: 'block' }}>
              {usage.status}, allowances reset {usage.resetsAt}
            </Data>
          </Box>
          <Group gap={10}>
            <Button variant="default" h={36}>
              1 GB, $9.99 a month
            </Button>
            <Button h={36}>10 GB, $49.99 a month</Button>
          </Group>
        </Group>
      </Box>

      <Text fz="sm" c="var(--x-quiet)" mt="md" maw="var(--x-measure)">
        Capture and sealing have separate monthly allowances. Extra sealing you buy outright adds to
        the sealing allowance only, and it does not expire.
      </Text>

      <Box
        className="x-grid"
        mt="lg"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
      >
        <Allowance
          label="Capture"
          used={usage.capture.used}
          total={usage.capture.total}
          note="Bytes recorded through the local proxy and settled against your account."
        />
        <Allowance
          label="Sealing"
          used={usage.sealing.used}
          total={usage.sealing.total}
          tone="alert"
          note="Bytes turned into signed evidence by Exalto Seal."
        />
        <Allowance
          label="Trace storage"
          used={usage.storage.used}
          total={usage.storage.total}
          note="Packages hosted at a link you can share."
        />
      </Box>

      <Box mt={40}>
        <SectionHead title="Buy more sealing">
          Sealing you buy outright is added to your balance once Stripe confirms the payment. It
          does not expire and it is used only after the monthly allowance runs out.
        </SectionHead>
        <Box className="x-record" p="md">
          <Group justify="space-between" gap="md" wrap="wrap">
            <Box>
              <Text fz={14} fw={560}>
                1 GB of sealing
              </Text>
              <Text fz={12.5} c="var(--x-quiet)" mt={2}>
                One payment, $9.99
              </Text>
            </Box>
            <Button variant="default" h={36}>
              Buy 1 GB
            </Button>
          </Group>
        </Box>
      </Box>

      <Box mt={40}>
        <SectionHead title="Purchases" />
        <table className="x-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>What</th>
              <th>State</th>
              <th className="x-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase) => (
              <tr key={purchase.id}>
                <td>
                  <Data c="var(--x-quiet)">{purchase.when}</Data>
                </td>
                <td>{purchase.what}</td>
                <td>{purchase.state}</td>
                <td className="x-right">
                  <Data>{purchase.amount}</Data>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Box mt={40}>
        <SectionHead title="How the numbers are counted" />
        <Box className="x-record" p="lg" maw={640}>
          <Facts>
            <Fact label="Capture">
              Bytes the local proxy relayed, settled when the session ends.
            </Fact>
            <Fact label="Sealing">Bytes of the capture that were turned into signed evidence.</Fact>
            <Fact label="Storage">
              Size of the packages currently hosted for your shared traces.
            </Fact>
            <Fact label="Reset">Monthly allowances reset on the same day each month.</Fact>
          </Facts>
        </Box>
      </Box>
    </>
  );
}
