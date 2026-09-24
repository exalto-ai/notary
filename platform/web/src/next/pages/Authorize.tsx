import { Alert, Box, Button, Text } from '@mantine/core';
import { type ReactNode, useEffect, useState } from 'react';
import {
  approveDeviceAuthorization,
  getDeviceAuthorizationApproval,
} from '../../platform-api/client';
import { sessionDate } from '../../site/format';
import { Data, Fact, Facts, Lamp, type Tone } from '../components/primitives';
import { type Account, accountName } from '../data/account';
import { href } from '../router';

type Approval = Awaited<ReturnType<typeof getDeviceAuthorizationApproval>>;
type Capability = Approval['capabilities'][number];

const capabilityLabels: Record<Capability, string> = {
  hosted_notarization: 'Seal with Exalto Seal',
  consume_credits: 'Spend this account allowance',
  share_notarized_traces: 'Share sealed traces at a link',
};

function reason(value: unknown, fallback: string) {
  return value instanceof Error ? value.message : fallback;
}

function Panel({
  state,
  title,
  children,
  action,
  facts,
}: {
  state: { tone: Tone; label: string };
  title: string;
  children: ReactNode;
  action?: ReactNode;
  facts?: ReactNode;
}) {
  return (
    <Box className="x-centered">
      <Box className="x-record" p={32} w="100%" maw={480}>
        <Lamp tone={state.tone}>{state.label}</Lamp>
        <Text component="h1" fz={24} fw={600} mt={12} lh={1.15}>
          {title}
        </Text>
        <Box fz="sm" c="var(--x-quiet)" mt={10}>
          {children}
        </Box>
        {facts ? <Box mt={24}>{facts}</Box> : null}
        {action ? <Box mt={24}>{action}</Box> : null}
      </Box>
    </Box>
  );
}

export function Authorize({
  route,
  account,
  loadApproval = getDeviceAuthorizationApproval,
  approveRequest = approveDeviceAuthorization,
}: {
  route: string;
  account: Account | null;
  loadApproval?: typeof getDeviceAuthorizationApproval;
  approveRequest?: typeof approveDeviceAuthorization;
}) {
  const parameters = new URLSearchParams(route.split('?')[1] ?? '');
  const requestId = parameters.get('request_id');
  const approvalSecret = parameters.get('approval_secret');

  const [approval, setApproval] = useState<Approval | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (!requestId || !approvalSecret || !account) return;
    let cancelled = false;
    loadApproval(requestId, approvalSecret)
      .then((payload) => {
        if (!cancelled) setApproval(payload);
      })
      .catch((failure) => {
        if (!cancelled) setError(reason(failure, 'This connection request is unavailable.'));
      });
    return () => {
      cancelled = true;
    };
  }, [requestId, approvalSecret, account, loadApproval]);

  const approve = async () => {
    if (!requestId || !approvalSecret) return;
    setError(null);
    setApproving(true);
    try {
      await approveRequest(requestId, approvalSecret);
      setApproved(true);
    } catch (failure) {
      setError(reason(failure, 'Could not connect this device.'));
    } finally {
      setApproving(false);
    }
  };

  if (!requestId || !approvalSecret)
    return (
      <Panel
        state={{ tone: 'alert', label: 'Not a valid link' }}
        title="This connection link is incomplete."
        facts={
          <Facts>
            <Fact label="Next step">Start the connection again from Exalto Capture.</Fact>
          </Facts>
        }
      >
        The address is missing the request it refers to, so there is nothing to approve.
      </Panel>
    );

  if (!account)
    return (
      <Panel
        state={{ tone: 'idle', label: 'Sign in first' }}
        title="Sign in to the account you want to connect."
        action={
          <Button
            component="a"
            href={href(`/signin?return_to=${encodeURIComponent(`/${route}`)}`)}
            h={38}
          >
            Sign in
          </Button>
        }
      >
        You will see the device and exactly what it can do before anything changes.
      </Panel>
    );

  if (approved)
    return (
      <Panel
        state={{ tone: 'sealed', label: 'Connected' }}
        title="This device can now seal."
        facts={
          <Facts>
            <Fact label="Device">
              <Data>{approval?.device_name ?? 'Exalto Capture'}</Data>
            </Fact>
            <Fact label="Account">{accountName(account)}</Fact>
          </Facts>
        }
      >
        Return to your terminal. You can revoke this device at any time from Settings.
      </Panel>
    );

  if (error)
    return (
      <Panel
        state={{ tone: 'alert', label: 'Unavailable' }}
        title="This request could not be completed."
        action={
          <Alert color="alert" variant="light">
            {error}
          </Alert>
        }
        facts={
          <Facts>
            <Fact label="Account">{accountName(account)}</Fact>
            <Fact label="Next step">Start the connection again from Exalto Capture.</Fact>
          </Facts>
        }
      >
        Nothing was connected.
      </Panel>
    );

  if (!approval)
    return (
      <Panel
        state={{ tone: 'idle', label: 'Checking' }}
        title="Reading this request."
        facts={
          <Facts>
            <Fact label="Account">{accountName(account)}</Fact>
            <Fact label="Changes">None until you approve.</Fact>
          </Facts>
        }
      >
        Fetching the device and what it is asking for.
      </Panel>
    );

  return (
    <Panel
      state={{ tone: 'local', label: 'Waiting for you' }}
      title="Connect this device to your account?"
      facts={
        <Facts>
          <Fact label="Code">
            <Data fz={15}>{approval.user_code}</Data>
          </Fact>
          <Fact label="Device">
            <Data>{approval.device_name}</Data>
          </Fact>
          <Fact label="Account">{accountName(account)}</Fact>
          <Fact label="Expires">
            <Data>{sessionDate(approval.expires_at)}</Data>
          </Fact>
        </Facts>
      }
      action={
        <Button h={38} onClick={approve} loading={approving}>
          Connect device
        </Button>
      }
    >
      <Text fz="sm" c="var(--x-quiet)">
        Check that this code matches the one in your terminal. If it does not, close this page.
      </Text>
      <Box component="ul" className="x-list" mt={14} mb={14}>
        {approval.capabilities.map((capability) => (
          <li key={capability}>
            {capabilityLabels[capability] ?? capability.replaceAll('_', ' ')}
          </li>
        ))}
      </Box>
      <Text fz="sm" c="var(--x-quiet)">
        Connecting uploads nothing. Sharing stays a separate, explicit action, and you can revoke
        this device later from Settings.
      </Text>
    </Panel>
  );
}
