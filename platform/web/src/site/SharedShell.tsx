export function Footer() {
  return (
    <footer className="app-footer">
      <a className="footer-copyright" href="https://exalto.ai">
        Exalto
      </a>
      <nav aria-label="Footer">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </nav>
    </footer>
  );
}

const legalPages = {
  privacy: {
    eyebrow: 'Legal · Privacy',
    title: 'Privacy Policy',
    intro:
      'This policy explains the information handled by Exalto Seal and Exalto Capture, including the hosted Trace-sharing service and local tooling.',
    sections: [
      [
        'Local capture stays local',
        'The local proxy handles application plaintext and provider credentials. Within the protocol, the remote notary witnesses encrypted traffic and protocol metadata; it does not receive your API key, prompt, or response plaintext.',
      ],
      [
        'Account information',
        'If you sign in with Google, we use your stable Google account identifier, display name, and profile image to operate your account. We check that Google reports a verified email address but do not retain the address. Google access is limited to openid, email, and profile. If configured, GitHub sign-in remains available for existing accounts and requests identity only, without repository, organization, or email access. Provider access tokens are not retained.',
      ],
      [
        'Shared Traces',
        'Sharing is an explicit action on a notarized Trace. The service verifies and safety-scans a submitted .llmtrace package before admission, then hosts the disclosed conversation and exact admitted package at a stable link. Header values are hidden by the package’s default disclosure policy, but request and response bodies—including prompts, responses, tool definitions, and tool results—may be accessible. Do not share content you are not permitted to disclose.',
      ],
      [
        'Service processing',
        'One-off verification does not retain an uploaded package. Sharing retains the exact admitted package and its normalized trace so visitors can inspect the Trace and independently verify the original bytes. Temporary intake objects are removed after admission or rejection.',
      ],
      [
        'Plan, usage, and billing',
        'We record the capture and notarization bytes your account settles and the storage your uploaded packages occupy, so allowances and balances can be enforced. Paid plans and additional notarization are processed by Stripe as our payment processor; card details are handled by Stripe and are not stored by this service.',
      ],
      [
        'Devices and API keys',
        'Connecting a device stores a rotating device credential and the metadata needed to list and revoke it. A deployment API key is stored only as a verifier; the complete key is shown once at creation and cannot be retrieved afterwards. You can revoke either from hosted Account settings.',
      ],
      [
        'Cookies',
        'The hosted site sets host-only cookies only where they are strictly necessary. Signing in sets a session cookie, and the sign-in redirect briefly sets state and verifier cookies for that one exchange. Separately, unlocking a password-protected shared Trace sets a cookie for that Trace so you are not asked again for 24 hours; that one is set for visitors who are not signed in. We do not set advertising or cross-site tracking cookies.',
      ],
      [
        'Deleting your account',
        'Deleting your account removes the account record and queues every stored trace artifact it owns for deletion, and signs you out. Local traces on your own devices are not touched; disconnecting or deleting does not remove evidence you hold locally.',
      ],
      [
        'Trace reports',
        'A report retains the selected reason and optional note for moderation. Reports are append-only. A keyed network-derived value rate-limits submissions separately, and the application does not store the reporter’s raw IP address in the report record.',
      ],
      [
        'Your choices',
        'You choose whether a shared Trace is Unlisted or Listed. Both start accessible to anyone with the link; Unlisted only keeps it out of public Traces. After admission, you can stop sharing, require a password, or set an expiry. Keep private capture checkpoints and credentials under your control. For privacy questions or requests, contact the Exalto Seal operator through the project’s support channel.',
      ],
      [
        'Updates',
        'We may revise this policy as the service evolves. The current version will always be available on this page.',
      ],
    ],
  },
  terms: {
    eyebrow: 'Legal · Terms',
    title: 'Terms of Service',
    intro:
      'These terms govern your use of Exalto Seal, Exalto Capture, the local tooling, and the Trace-sharing service.',
    sections: [
      [
        'Using the service',
        'Use Exalto Seal and Exalto Capture lawfully and only with content, credentials, and provider accounts you are authorized to use. Do not interfere with the service, bypass access controls, or submit material that infringes the rights of others.',
      ],
      [
        'Your shared Traces',
        'You are responsible for every package you choose to submit. Sharing is an explicit consent boundary: once admitted, its disclosed conversation and exact package can be accessed by anyone with the link. Unlisted is not private; it only keeps the Trace out of public Traces.',
      ],
      [
        'What verification means',
        'The retained .llmtrace package can be checked against its cryptographic and protocol evidence. The readable conversation is derived from that admitted package, and the download preserves its exact bytes. Neither result establishes that a model output or user interpretation is true, complete, safe, or suitable for a particular purpose.',
      ],
      [
        'Availability',
        'The service is provided on an “as available” basis and may change, be suspended, or be discontinued. Preserve the local materials you need; do not rely on the service as your only record or backup.',
      ],
      [
        'Your responsibilities',
        'You are responsible for maintaining the security of your devices, local captures, API credentials, and account. Do not share confidential, personal, or otherwise protected information unless you have a clear right to do so.',
      ],
      [
        'Changes to these terms',
        'We may update these terms as the product develops. Continued use after an updated version is posted means you accept the revised terms.',
      ],
    ],
  },
} as const;

type LegalPageKey = keyof typeof legalPages;

export function isLegalPage(pageKey: string | undefined): pageKey is LegalPageKey {
  return pageKey !== undefined && pageKey in legalPages;
}

export function LegalPage({ pageKey }: { pageKey: LegalPageKey }) {
  const page = legalPages[pageKey];
  return (
    <main className="legal-shell">
      <span className="eyebrow">{page.eyebrow}</span>
      <h1>{page.title}</h1>
      <p className="legal-intro">{page.intro}</p>
      <p className="legal-updated">Last updated: August 2026</p>
      <div className="legal-sections">
        {page.sections.map(([heading, copy]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            <p>{copy}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
