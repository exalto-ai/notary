import { Box, Button, Group, Text } from '@mantine/core';
import { useState } from 'react';
import { Data, Fact, Facts, Lamp } from '../components/primitives';

export function Authorize() {
  const [decision, setDecision] = useState<'pending' | 'approved' | 'denied'>('pending');

  return (
    <Box className="x-centered">
      <Box className="x-record" p={32} w="100%" maw={460}>
        {decision === 'pending' ? (
          <>
            <Text component="h1" fz={24} fw={600} m={0} lh={1.15}>
              Connect this device to your account?
            </Text>
            <Text fz="sm" c="var(--x-quiet)" mt={10}>
              A connected device can seal traces against your account and spend your allowance. It
              never gains access to traces stored on other machines.
            </Text>

            <Box mt={24}>
              <Facts>
                <Fact label="Code">
                  <Data fz={15}>WQTZ-9F2C</Data>
                </Fact>
                <Fact label="Device">
                  <Data>build-runner-3</Data>
                </Fact>
                <Fact label="Software">
                  <Data>notaryd 0.1.9, Linux</Data>
                </Fact>
                <Fact label="Requested">
                  <Data>a moment ago, expires in 9 minutes</Data>
                </Fact>
              </Facts>
            </Box>

            <Text fz={12.5} c="var(--x-quiet)" mt="lg">
              Check that this code matches the one shown in your terminal. If it does not, deny the
              request.
            </Text>

            <Group mt="lg" gap={10}>
              <Button h={38} onClick={() => setDecision('approved')}>
                Connect device
              </Button>
              <Button variant="default" h={38} onClick={() => setDecision('denied')}>
                Deny
              </Button>
            </Group>
          </>
        ) : (
          <>
            <Lamp tone={decision === 'approved' ? 'sealed' : 'idle'}>
              {decision === 'approved' ? 'Connected' : 'Denied'}
            </Lamp>
            <Text component="h1" fz={24} fw={600} mt={12} lh={1.15}>
              {decision === 'approved' ? 'build-runner-3 can now seal.' : 'The request was denied.'}
            </Text>
            <Text fz="sm" c="var(--x-quiet)" mt={10}>
              {decision === 'approved'
                ? 'Return to your terminal. You can revoke this device at any time from Settings.'
                : 'Nothing was connected. If you did not start this, no further action is needed.'}
            </Text>
          </>
        )}
      </Box>
    </Box>
  );
}
