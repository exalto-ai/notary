import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  approveDeviceAuthorization,
  type getCurrentUser,
  getDeviceAuthorizationApproval,
} from '../platform-api/client';
import { sessionDate } from './format';

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
type AccountIdentity = Pick<CurrentUser, 'display_name' | 'provider_display_name'>;
type DeviceAuthorizationDetails = Awaited<ReturnType<typeof getDeviceAuthorizationApproval>>;
type DeviceCapability = DeviceAuthorizationDetails['capabilities'][number];
type AuthorizationTone = 'neutral' | 'attention' | 'success' | 'ready';
type AuthorizationFact = readonly [label: string, value: ReactNode];

function accountName(user: AccountIdentity) {
  return user.display_name || user.provider_display_name;
}

function messageFrom(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

const deviceCapabilityLabels: Record<DeviceCapability, string> = {
  hosted_notarization: 'Use hosted notarization',
  consume_credits: 'Consume account credits',
  share_notarized_traces: 'Share sealed traces',
};

function AuthorizationPage({
  title,
  description,
  action = null,
  facts,
  tone = 'neutral',
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  facts: ReadonlyArray<AuthorizationFact>;
  tone?: AuthorizationTone;
}) {
  return (
    <main className={`cli-approval-shell cli-approval-shell--${tone}`}>
      <section className="cli-approval-workspace" aria-labelledby="cli-approval-title">
        <div className="cli-approval-primary">
          <span className="eyebrow">Device connection</span>
          <h1 id="cli-approval-title">{title}</h1>
          <div className="cli-approval-description">{description}</div>
          {action && <div className="cli-approval-action">{action}</div>}
        </div>
        <aside className="cli-approval-context" aria-label="Connection details">
          <header>
            <span className="eyebrow">Connection</span>
            <div
              className="cli-approval-path"
              role="img"
              aria-label="Device connects to an Exalto account"
            >
              <span>
                <i aria-hidden="true" />
                This device
              </span>
              <b aria-hidden="true" />
              <span>
                <i aria-hidden="true" />
                Exalto account
              </span>
            </div>
          </header>
          <dl>
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>
    </main>
  );
}

export function DeviceAuthorizationApproval({
  route,
  user,
  loadApproval = getDeviceAuthorizationApproval,
  approveRequest = approveDeviceAuthorization,
}: {
  route: string;
  user: AccountIdentity | null;
  loadApproval?: typeof getDeviceAuthorizationApproval;
  approveRequest?: typeof approveDeviceAuthorization;
}) {
  const query = new URLSearchParams(route.split('?')[1] || '');
  const requestId = query.get('request_id');
  const approvalSecret = query.get('approval_secret');
  const [details, setDetails] = useState<DeviceAuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  useEffect(() => {
    if (!requestId || !approvalSecret || !user) return;
    let cancelled = false;
    loadApproval(requestId, approvalSecret)
      .then((payload) => {
        if (!cancelled) setDetails(payload);
      })
      .catch((reason) => {
        if (!cancelled) setError(messageFrom(reason, 'This authorization request is unavailable.'));
      });
    return () => {
      cancelled = true;
    };
  }, [requestId, approvalSecret, user, loadApproval]);
  const approve = async () => {
    if (!requestId || !approvalSecret) return;
    setError(null);
    try {
      await approveRequest(requestId, approvalSecret);
      setApproved(true);
    } catch (reason) {
      setError(messageFrom(reason, 'Could not connect this device.'));
    }
  };
  if (!requestId || !approvalSecret)
    return (
      <AuthorizationPage
        tone="attention"
        title="Invalid authorization link"
        description={<p>Restart the connection from Exalto Capture.</p>}
        facts={[
          ['Request', 'Invalid or incomplete'],
          ['Next step', 'Restart from Exalto Capture'],
        ]}
      />
    );
  if (!user)
    return (
      <AuthorizationPage
        title="Sign in to continue"
        description={
          <p>
            Sign in to the account you want to connect. You’ll review the device and its exact
            capabilities before anything changes.
          </p>
        }
        action={
          <a
            className="button button-dark"
            href={`/signin?return_to=${encodeURIComponent(`/${route}`)}`}
          >
            Choose sign-in method
          </a>
        }
        facts={[
          ['Next step', 'Review and connect the device'],
          ['Control', 'Revoke later from Account'],
        ]}
      />
    );
  if (approved)
    return (
      <AuthorizationPage
        tone="success"
        title="Device connected"
        description={
          <p>Exalto Capture will finish connecting to this account. You can close this page.</p>
        }
        facts={[
          ['Device', details?.device_name || 'Exalto Capture on this Mac'],
          ['Account', accountName(user)],
          ['Status', 'Connected'],
        ]}
      />
    );
  if (error)
    return (
      <AuthorizationPage
        tone="attention"
        title="Connection unavailable"
        description={<p role="alert">{error} Restart the connection from Exalto Capture.</p>}
        facts={[
          ['Request', 'Needs attention'],
          ['Account', accountName(user)],
          ['Next step', 'Restart from Exalto Capture'],
        ]}
      />
    );
  if (!details)
    return (
      <AuthorizationPage
        title="Checking this request"
        description={
          <p role="status">
            Retrieving the device and account details before you approve anything.
          </p>
        }
        facts={[
          ['Request', 'Checking'],
          ['Account', accountName(user)],
          ['Changes', 'None until you approve'],
        ]}
      />
    );
  return (
    <AuthorizationPage
      tone="ready"
      title="Connect this device?"
      description={
        <div>
          <p>This device will be able to:</p>
          <ul>
            {details.capabilities.map((capability) => (
              <li key={capability}>
                {deviceCapabilityLabels[capability] || capability.replaceAll('_', ' ')}
              </li>
            ))}
          </ul>
          <p>
            Connecting does not upload existing local traces. Future sharing remains a separate,
            explicit action, and you can revoke this device later from Account.
          </p>
        </div>
      }
      action={
        <button className="button button-dark" type="button" onClick={approve}>
          Connect device
        </button>
      }
      facts={[
        ['Device', details.device_name],
        ['Account', accountName(user)],
        ['Authorization code', details.user_code],
        ['Expires', sessionDate(details.expires_at)],
      ]}
    />
  );
}
