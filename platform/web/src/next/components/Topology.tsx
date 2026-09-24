import { Box, Text } from '@mantine/core';
import { Data } from './primitives';

/**
 * The true relay topology, on one line. The session runs from your client
 * through the notary to the provider, so the notary sits inside the TLS path
 * rather than beside it. Everything the protocol adds is drawn in the seal
 * colour; plaintext never crosses the dashed machine boundary.
 */
export function Topology() {
  return (
    <Box className="x-topology">
      <Box className="x-topology-row">
        <Box className="x-topology-machine">
          <Text className="x-topology-machine-label" fz={12} fw={550}>
            Your Mac
          </Text>
          <Party name="Your client" detail="Claude Code or an SDK" />
          <Wire label="plaintext" tone="local" inside />
          <Party name="Capture" detail="local proxy and vault" tone="local" />
        </Box>
        <Wire label="ciphertext" tone="seal" />
        <Party name="Notary" detail="witnesses and signs" tone="seal" />
        <Wire label="TLS" tone="seal" />
        <Party name="Provider" detail="api.anthropic.com" />
      </Box>
      <Text fz={12.5} c="var(--x-quiet)" mt={16} maw="var(--x-measure)">
        The receipt comes back to your machine over the same connection. Everything drawn in blue is
        what the protocol adds to a session that was going to happen anyway.
      </Text>
    </Box>
  );
}

function Party({ name, detail, tone }: { name: string; detail: string; tone?: 'seal' | 'local' }) {
  return (
    <Box className="x-topology-party" data-tone={tone}>
      <Text fz={13.5} fw={570} lh={1.25}>
        {name}
      </Text>
      <Text fz={12} c="var(--x-quiet)" lh={1.3} mt={3}>
        {detail}
      </Text>
    </Box>
  );
}

function Wire({
  label,
  tone,
  inside = false,
}: {
  label: string;
  tone: 'seal' | 'local';
  inside?: boolean;
}) {
  return (
    <Box className="x-topology-wire" data-tone={tone} data-inside={inside || undefined}>
      <Data c={tone === 'seal' ? 'var(--x-seal)' : 'var(--x-custody)'}>{label}</Data>
    </Box>
  );
}
