import { Box, CopyButton, Text, UnstyledButton } from '@mantine/core';

/** Copyable commands only. Inline identifiers stay inline. */
export function CodeBlock({ lines }: { lines: string[] }) {
  const text = lines.join('\n');
  return (
    <Box
      style={{
        position: 'relative',
        background: 'var(--x-sunken)',
        border: '1px solid var(--x-rule)',
        borderRadius: 6,
        padding: '14px 16px',
      }}
    >
      <CopyButton value={text}>
        {({ copied, copy }) => (
          <UnstyledButton
            onClick={copy}
            style={{ position: 'absolute', top: 10, right: 12 }}
            fz={12}
            c="var(--x-quiet)"
          >
            {copied ? 'Copied' : 'Copy'}
          </UnstyledButton>
        )}
      </CopyButton>
      <Box component="pre" m={0} style={{ overflowX: 'auto' }}>
        {lines.map((line, index) => (
          <Text
            // biome-ignore lint/suspicious/noArrayIndexKey: lines of a static command block never reorder; index is their identity.
            key={index}
            component="div"
            className="x-data"
            c={line.startsWith('#') ? 'var(--x-faint)' : 'var(--x-ink)'}
            style={{ whiteSpace: 'pre' }}
          >
            {line || ' '}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
