import { Box, Text } from '@mantine/core';
import { Custody, type CustodyStep, Data, Lamp, Redacted } from './primitives';

export type Line = {
  speaker: 'you' | 'model';
  text?: string;
  /** Width in characters when the line is sealed but not disclosed. */
  sealed?: number[];
};

export type TraceRecordProps = {
  title: string;
  status: 'recording' | 'captured' | 'sealed';
  provider: string;
  model: string;
  witnessed: string;
  digest: string;
  signer?: string;
  lines: Line[];
  custody: CustodyStep[];
  compact?: boolean;
};

const statusLamp = {
  recording: { tone: 'alert', label: 'Recording', live: true },
  captured: { tone: 'local', label: 'Captured', live: false },
  sealed: { tone: 'sealed', label: 'Sealed', live: false },
} as const;

/**
 * The trace is the product's unit, so it gets one drawing used everywhere it
 * appears. Disclosed lines are readable; sealed lines keep their shape.
 */
export function TraceRecord({
  title,
  status,
  provider,
  model,
  witnessed,
  digest,
  signer = 'Seal',
  lines,
  custody,
  compact = false,
}: TraceRecordProps) {
  const lamp = statusLamp[status];
  return (
    <Box className="x-record x-stub" p={compact ? 'md' : 'lg'} pl={compact ? 22 : 30}>
      <Box
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Text component="h3" fz={compact ? 15 : 17} fw={600} m={0}>
          {title}
        </Text>
        <Lamp tone={lamp.tone} live={lamp.live}>
          {lamp.label}
        </Lamp>
      </Box>

      <Data c="var(--x-quiet)" mt={4} style={{ display: 'block' }}>
        {provider} {model}
      </Data>

      <Box
        mt="md"
        pt="md"
        style={{ borderTop: '1px solid var(--x-rule)', display: 'grid', gap: 9 }}
      >
        {lines.map((line, index) => (
          <Box
            // Lines are a fixed transcript slice; index is their identity.
            key={index}
            style={{
              display: 'grid',
              gridTemplateColumns: '52px 1fr',
              gap: 12,
              alignItems: 'start',
            }}
          >
            <Data
              c={line.speaker === 'you' ? 'var(--x-custody)' : 'var(--x-seal)'}
              style={{ paddingTop: 2 }}
            >
              {line.speaker}
            </Data>
            <Text fz={compact ? 13.5 : 14.5} lh={1.5}>
              {line.text ??
                line.sealed?.map((width, wordIndex) => (
                  <span key={wordIndex}>
                    <Redacted width={width} />
                    {wordIndex < (line.sealed?.length ?? 0) - 1 ? ' ' : null}
                  </span>
                ))}
            </Text>
          </Box>
        ))}
      </Box>

      <Box
        mt="md"
        pt="md"
        style={{
          borderTop: '1px solid var(--x-rule)',
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <Data c="var(--x-quiet)">
          witnessed {witnessed}, signed by {signer}
        </Data>
        <Data c="var(--x-quiet)">sha-256 {digest}</Data>
      </Box>

      <Box mt="md">
        <Custody steps={custody} />
      </Box>
    </Box>
  );
}
