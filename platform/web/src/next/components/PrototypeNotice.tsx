import { Box, Text } from '@mantine/core';
import { Lamp } from './primitives';

/**
 * While the port runs, some panels read the account and some still read
 * sample data. Saying which is the difference between a prototype and a
 * screen that quietly lies. This goes away with the last layer.
 */
export function PrototypeNotice({ fixtures }: { fixtures: string[] }) {
  return (
    <Box className="x-prototype-notice" role="note">
      <Lamp tone="local">Prototype</Lamp>
      <Text component="span" fz={12.5}>
        {fixtures.length
          ? `Sample data, not your account: ${fixtures.join(', ')}.`
          : 'Everything on this page reads your account.'}
      </Text>
    </Box>
  );
}
