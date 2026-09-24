import { Anchor, Box, Button, Text } from '@mantine/core';
import { IconArrowDown } from '@tabler/icons-react';
import { Fragment, useEffect, useState } from 'react';
import { CodeBlock } from '../components/CodeBlock';
import { Data } from '../components/primitives';
import { Page } from '../components/Shell';
import { Topology } from '../components/Topology';
import { TraceRecord } from '../components/TraceRecord';
import { heroTrace } from '../content/heroTrace';
import { websiteHref } from '../origins';
import { downloadSize, fetchLatestMacosDownload, type MacosDownload } from '../release';
import { href } from '../router';

// Capture, seal, verify is a real sequence, so these carry their order.
const STEPS = [
  {
    index: '01',
    verb: 'Capture',
    title: 'It records while you work.',
    copy: 'Point Claude Code, Codex, or your own tools at the local service. Every prompt and reply is written to your Mac as it happens, alongside the protocol evidence that fixes it in time.',
  },
  {
    index: '02',
    verb: 'Seal',
    title: 'Seal only what you need.',
    copy: 'Sealing turns a captured session into a portable trace signed by the notary that witnessed it. You choose which lines are disclosed; the rest stay sealed and unreadable.',
  },
  {
    index: '03',
    verb: 'Verify',
    title: 'Anyone can verify.',
    copy: 'A sealed trace carries its own proof. Hand someone the file or the link and they can check it offline with the verifier, without an account and without asking us.',
  },
];

// Every route here is one the daemon enables by default, and the two coding
// agents are the ones live-tested with their saved logins. Add a row only when
// the runtime actually supports it.
const CLIENTS = [
  { name: 'Claude Code', auth: 'claude.ai login', route: '/anthropic' },
  { name: 'Codex CLI', auth: 'ChatGPT login', route: '/codex' },
  { name: 'OpenAI API', auth: 'api.openai.com', route: '/openai/v1' },
  { name: 'Anthropic API', auth: 'api.anthropic.com', route: '/anthropic' },
  { name: 'DeepSeek', auth: 'api.deepseek.com', route: '/deepseek' },
  { name: 'OpenRouter', auth: 'openrouter.ai', route: '/openrouter/api/v1' },
];

const BOUNDARY = [
  {
    title: 'Plaintext and keys stay local.',
    copy: 'The local proxy is the only party that handles your prompts, replies, and provider credentials. They are encrypted at rest on your machine.',
  },
  {
    title: 'It witnesses only ciphertext.',
    copy: 'The notary you choose joins the TLS session to the provider and signs what it saw. It never receives your API key, your prompt, or the response.',
  },
  {
    title: 'One file, verifiable by anyone.',
    copy: 'A sealed .llmtrace carries the disclosed conversation, the provider identity, the digest of every sealed byte, the witnessed time, and the signature.',
  },
];

function Download({ release, size = 'md' }: { release: MacosDownload | null; size?: 'md' | 'lg' }) {
  return (
    <Button
      component="a"
      href={release?.url ?? '#'}
      size={size}
      h={size === 'lg' ? 46 : 42}
      px={20}
      leftSection={<IconArrowDown size={17} stroke={1.8} />}
    >
      Download for macOS
    </Button>
  );
}

export function Landing({ signedIn = false }: { signedIn?: boolean }) {
  const [release, setRelease] = useState<MacosDownload | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchLatestMacosDownload().then((value) => {
      if (!cancelled) setRelease(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Page>
      <Box
        pt={{ base: 44, md: 76 }}
        pb={{ base: 56, md: 84 }}
        className="x-hero"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.08fr) minmax(0, 1fr)',
          gap: 56,
          alignItems: 'center',
        }}
      >
        <Box>
          <Text component="h1" fz={{ base: 34, md: 46 }} fw={620} m={0} lh={1.06}>
            Record every session.
            <br />
            Seal what matters.
          </Text>
          <Text fz="lg" mt="lg" c="var(--x-quiet)" maw="46ch">
            Exalto Capture keeps an account of your AI work on your own Mac. When a session needs to
            be more than a memory, seal it into a trace anyone can verify. Nothing readable ever
            leaves your machine.
          </Text>
          <Box mt={32} style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Download release={release} />
            <Anchor href="#cli" fz="sm" c="var(--x-seal)">
              Prefer the command line?
            </Anchor>
          </Box>
          <Data c="var(--x-faint)" mt={14} style={{ display: 'block' }}>
            {release
              ? `${release.version}, ${downloadSize(release.sizeBytes)}, Apple silicon`
              : 'Apple silicon'}
          </Data>
          <Box
            mt={28}
            pt={20}
            style={{
              borderTop: '1px solid var(--x-rule)',
              display: 'flex',
              gap: 22,
              flexWrap: 'wrap',
            }}
          >
            <Anchor href={href('/docs')} fz="sm" c="var(--x-quiet)">
              Read the docs
            </Anchor>
            <Anchor href={websiteHref('/traces')} fz="sm" c="var(--x-quiet)">
              See sealed traces
            </Anchor>
            <Anchor href={href(signedIn ? '/app/overview' : '/signin')} fz="sm" c="var(--x-quiet)">
              {signedIn ? 'Open dashboard' : 'Sign in'}
            </Anchor>
          </Box>
        </Box>
        <Box>
          <TraceRecord {...heroTrace} />
          <Box mt={14} style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <Data c="var(--x-custody)">you, tracked locally</Data>
            <Data c="var(--x-seal)">model, sealed</Data>
            <Data c="var(--x-faint)">sealed, not disclosed</Data>
          </Box>
        </Box>
      </Box>

      <Box
        component="section"
        py={{ base: 56, md: 80 }}
        style={{ borderTop: '1px solid var(--x-rule-firm)' }}
      >
        <Text component="h2" fz={{ base: 27, md: 33 }} lh={1.12} fw={600} m={0}>
          Three verbs, one record.
        </Text>
        <Box
          mt={32}
          className="x-grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))' }}
        >
          {STEPS.map((step) => (
            <Box key={step.index} p="lg">
              <Box style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <Data c="var(--x-faint)">{step.index}</Data>
                <Data c="var(--x-seal)">{step.verb}</Data>
              </Box>
              <Text fz={17} fw={600} mt={12}>
                {step.title}
              </Text>
              <Text fz="sm" c="var(--x-quiet)" mt={8}>
                {step.copy}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        component="section"
        py={{ base: 56, md: 80 }}
        style={{ borderTop: '1px solid var(--x-rule-firm)' }}
      >
        <Text component="h2" fz={{ base: 27, md: 33 }} lh={1.12} fw={600} m={0}>
          Point your tools at it.
        </Text>
        <Text fz="md" c="var(--x-quiet)" mt="md" maw="var(--x-measure)">
          Capture runs a local proxy with a fixed URL per provider. Set that as the base URL and
          your coding agent or SDK talks to Capture instead of the provider directly. Saved logins
          keep working; nothing else about your workflow changes.
        </Text>
        <Box
          className="x-grid"
          mt={32}
          style={{
            gridTemplateColumns: 'minmax(150px, 1fr) minmax(160px, 1fr) minmax(200px, 1.4fr)',
          }}
        >
          {CLIENTS.map((client) => (
            <Fragment key={client.name}>
              <Box px="md" py={13}>
                <Text fz="sm" fw={550}>
                  {client.name}
                </Text>
              </Box>
              <Box px="md" py={13}>
                <Data c="var(--x-quiet)">{client.auth}</Data>
              </Box>
              <Box px="md" py={13}>
                <Data>127.0.0.1:8787{client.route}</Data>
              </Box>
            </Fragment>
          ))}
        </Box>
      </Box>

      <Box component="section" className="x-band" py={{ base: 56, md: 80 }}>
        <Text component="h2" fz={{ base: 27, md: 35 }} lh={1.1} fw={600} m={0} maw="20ch">
          Nothing readable ever leaves your machine.
        </Text>
        <Text fz="md" c="var(--x-quiet)" mt="md" maw="var(--x-measure)">
          The notary you seal with sits inside the TLS path rather than beside it. It witnesses the
          encrypted session and signs what it saw.
        </Text>
        <Box mt={44} maw={980}>
          <Topology />
        </Box>
        <Box
          mt={44}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 28,
          }}
        >
          {BOUNDARY.map((fact) => (
            <Box key={fact.title}>
              <Text fz={15} fw={600} m={0}>
                {fact.title}
              </Text>
              <Text fz="sm" c="var(--x-quiet)" mt={7}>
                {fact.copy}
              </Text>
            </Box>
          ))}
        </Box>
        <Text fz="sm" c="var(--x-quiet)" mt={40} fs="italic">
          A trace proves presence, never absence.
        </Text>
      </Box>

      <Box
        component="section"
        id="cli"
        py={{ base: 56, md: 80 }}
        style={{ borderTop: '1px solid var(--x-rule-firm)' }}
      >
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 48,
            alignItems: 'start',
          }}
        >
          <Box>
            <Text component="h2" fz={{ base: 27, md: 33 }} lh={1.12} fw={600} m={0} maw="16ch">
              The app is a front for a service you can run yourself.
            </Text>
            <Text fz="md" c="var(--x-quiet)" mt="md">
              The desktop app bundles a local service that also installs on its own, on macOS or
              Linux. Drive it from the command line, seal from your own pipeline, or point it at a
              notary you operate. The trace format and verifier are the contract.
            </Text>
            <Box mt="lg" style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <Anchor href={href('/docs/getting-started')} fz="sm" c="var(--x-seal)">
                Install the CLI
              </Anchor>
              <Anchor href={href('/docs/trace-packages')} fz="sm" c="var(--x-seal)">
                Trace packages
              </Anchor>
              <Anchor href="https://github.com/exalto-ai/notary-runtime" fz="sm" c="var(--x-seal)">
                Public runtime
              </Anchor>
            </Box>
          </Box>
          <CodeBlock
            lines={[
              '$ curl -fsSL https://capture.exalto.ai/install.sh | sh',
              '# installed notaryctl and notaryd',
              '',
              '$ notaryd',
              '# proxy on 127.0.0.1:8787, dashboard on 127.0.0.1:8788',
              '',
              '$ notaryctl traces notarize trc-essay-draft --wait',
              '# sealed, witnessed 14:02:11 UTC, signer Seal',
            ]}
          />
        </Box>
      </Box>

      <Box
        component="section"
        py={{ base: 64, md: 96 }}
        ta="center"
        style={{ borderTop: '1px solid var(--x-rule-firm)' }}
      >
        <Text component="h2" fz={{ base: 27, md: 33 }} lh={1.12} fw={600} m={0}>
          Start keeping the record.
        </Text>
        <Text fz="md" c="var(--x-quiet)" mt="md" mx="auto" maw="52ch">
          Capture is free to run and yours to keep. An account is only needed when you want a trace
          sealed by Exalto Seal or hosted at a link you can share.
        </Text>
        <Box mt={28}>
          <Download release={release} size="lg" />
        </Box>
        <Text fz="sm" c="var(--x-quiet)" mt={18}>
          {signedIn ? 'Signed in already? ' : 'Already have an account? '}
          <Anchor href={href(signedIn ? '/app/overview' : '/signin')} fz="sm" c="var(--x-seal)">
            {signedIn ? 'Open your dashboard' : 'Sign in'}
          </Anchor>
        </Text>
      </Box>
    </Page>
  );
}
