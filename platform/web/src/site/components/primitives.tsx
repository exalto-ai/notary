import { Box, type BoxProps, Text } from '@mantine/core';
import type { ReactNode } from 'react';

export type Tone = 'sealed' | 'local' | 'alert' | 'idle';

/** A square lamp and a word. State is never carried by colour alone. */
export function Lamp({
  tone = 'idle',
  live = false,
  children,
}: {
  tone?: Tone;
  live?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="x-lamp" data-tone={tone} data-live={live || undefined}>
      {children}
    </span>
  );
}

/** Machine-produced text: digests, identifiers, byte counts, UTC times. */
export function Data({
  children,
  c = 'inherit',
  ...rest
}: { children: ReactNode; c?: string } & BoxProps) {
  return (
    <Box component="span" className="x-data" c={c} {...rest}>
      {children}
    </Box>
  );
}

/** Sealed but undisclosed content, shown at the width it occupies. */
export function Redacted({ width }: { width: number }) {
  return (
    <span
      className="x-redact"
      style={{ width: `${width}ch` }}
      role="img"
      aria-label="Sealed, not disclosed"
    />
  );
}

export type CustodyStep = {
  label: string;
  detail: string;
  reached: boolean;
  tone?: Tone;
};

/**
 * Every handoff a record has been through, in order. The same component draws
 * the strip on the landing page, in a trace row, and on a trace detail.
 */
export function Custody({ steps }: { steps: CustodyStep[] }) {
  return (
    <div className="x-custody">
      {steps.map((step) => (
        <div
          key={step.label}
          className="x-custody-node"
          data-reached={step.reached}
          data-tone={step.reached ? (step.tone ?? 'sealed') : undefined}
        >
          <Text
            fz={13}
            fw={step.reached ? 550 : 400}
            c={step.reached ? undefined : 'var(--x-faint)'}
          >
            {step.label}
          </Text>
          <Data c={step.reached ? 'var(--x-quiet)' : 'var(--x-faint)'}>{step.detail}</Data>
        </div>
      ))}
    </div>
  );
}

/** Allowance as a count of discrete units rather than a smooth bar. */
export function Meter({
  used,
  total,
  segments = 40,
  tone,
}: {
  used: number;
  total: number;
  segments?: number;
  tone?: 'alert';
}) {
  const filled = total <= 0 ? 0 : Math.min(segments, Math.round((used / total) * segments));
  return (
    <div
      className="x-meter"
      data-tone={tone}
      role="img"
      aria-label={`${Math.round(total <= 0 ? 0 : (used / total) * 100)} percent used`}
    >
      {Array.from({ length: segments }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: meter segments are fixed positional cells with no other identity.
        <i key={index} data-filled={index < filled} />
      ))}
    </div>
  );
}

/** Key and value rows. Values keep their own typeface. */
export function Facts({ children }: { children: ReactNode }) {
  return <dl className="x-facts">{children}</dl>;
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

/**
 * A heading with a rule that runs to the edge of its column. The rule marks
 * where a section starts; there is no label above the heading.
 */
export function SectionHead({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Box mb="md">
      <Box
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 16,
          justifyContent: 'space-between',
          borderTop: '1px solid var(--x-rule-firm)',
          paddingTop: 12,
        }}
      >
        <Text component="h2" fz={21} fw={600} className="x-display" m={0}>
          {title}
        </Text>
        {action}
      </Box>
      {children ? (
        <Text c="var(--x-quiet)" fz="sm" mt={6} maw="var(--x-measure)">
          {children}
        </Text>
      ) : null}
    </Box>
  );
}

/** A screen with nothing on it yet names what is absent and what to do. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Box py={40} px="md" ta="center">
      <Text fw={550} fz="md">
        {title}
      </Text>
      {children ? (
        <Box mt={8} c="var(--x-quiet)" fz="sm">
          {children}
        </Box>
      ) : null}
    </Box>
  );
}
