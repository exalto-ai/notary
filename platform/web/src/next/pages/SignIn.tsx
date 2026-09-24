import { Anchor, Box, Button, Text } from '@mantine/core';
import { AuthProviderIcon } from '../../AuthProviderIcon';
import { Wordmark } from '../components/Shell';
import { href } from '../router';

export function SignIn({ returnTo }: { returnTo?: string }) {
  return (
    <Box className="x-centered">
      <Box className="x-record" p={32} w="100%" maw={420}>
        <Wordmark size={22} />
        <Text component="h1" fz={26} fw={600} mt={24} lh={1.15}>
          Sign in to manage what you share.
        </Text>
        <Text fz="sm" c="var(--x-quiet)" mt={10}>
          Capture records and seals without an account. You need one to host a trace at a link, or
          to seal with Exalto Seal instead of a notary you run yourself.
        </Text>

        <Box mt={28} style={{ display: 'grid', gap: 10 }}>
          {(['google', 'github'] as const).map((provider) => (
            <Button
              key={provider}
              component="a"
              href={href(returnTo ?? '/app/overview')}
              variant="default"
              h={44}
              justify="flex-start"
              leftSection={<AuthProviderIcon provider={provider} />}
            >
              Continue with {provider === 'google' ? 'Google' : 'GitHub'}
            </Button>
          ))}
        </Box>

        <Text fz={12.5} c="var(--x-quiet)" mt={24}>
          By continuing you agree to the{' '}
          <Anchor href={href('/terms')} fz={12.5} c="var(--x-seal)">
            Terms
          </Anchor>{' '}
          and acknowledge the{' '}
          <Anchor href={href('/privacy')} fz={12.5} c="var(--x-seal)">
            Privacy Policy
          </Anchor>
          .
        </Text>
      </Box>
    </Box>
  );
}
