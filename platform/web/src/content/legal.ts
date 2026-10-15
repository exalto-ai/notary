// Legal page copy. Data only, so any renderer can read it. The vocabulary is
// the product's (Captured and Sealed, the Exalto Capture Protocol); legal
// review of the substance is still to come.

export const legalPages = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'October 2026',
    intro:
      'This policy explains the information handled by Exalto Capture, Exalto Seal and this website: the local capture tooling, the hosted sealing, verification and Trace-sharing service, and your account.',
    sections: [
      [
        'Local capture stays local',
        'The local proxy on your machine handles application plaintext and provider credentials. Under the Exalto Capture Protocol (ECP), the remote notary witnesses encrypted traffic and protocol metadata; it does not receive your API key, your prompts or the provider’s responses. Captured Traces stay in an encrypted archive on your machine. Sealing one sends the notary only what the protocol needs in order to sign, never the plaintext, and publishes nothing; sharing is a separate, explicit action.',
      ],
      [
        'Account information',
        'If you sign in with Google, we use your stable Google account identifier, display name, and profile image to operate your account. We check that Google reports a verified email address but do not retain the address. Google access is limited to openid, email, and profile. If configured, GitHub sign-in remains available for existing accounts and requests identity only, without repository, organization, or email access. Provider access tokens are not retained.',
      ],
      [
        'Shared Traces',
        'Sharing is an explicit action on a Sealed Trace. The service verifies and safety-scans a submitted .llmtrace package before admission, then hosts the disclosed conversation and the exact admitted package at a stable link. Header values are hidden by the package’s default disclosure policy, but request and response bodies, including prompts, responses, tool definitions and tool results, may be accessible to anyone with the link. Do not share content you are not permitted to disclose.',
      ],
      [
        'Service processing',
        'One-off verification does not retain an uploaded package. Sharing retains the exact admitted package and its normalized trace so visitors can inspect the Trace and independently verify the original bytes. Temporary intake objects are removed after admission or rejection.',
      ],
      [
        'Plan, usage, and billing',
        'We record the capture and sealing usage your account settles and the storage your shared packages occupy, so allowances and balances can be enforced. Paid plans and additional sealing are processed by Stripe as our payment processor; card details are handled by Stripe and are not stored by this service.',
      ],
      [
        'Devices and API keys',
        'Connecting a device stores a rotating device credential and the metadata needed to list and revoke it. A deployment API key is stored only as a verifier; the complete key is shown once at creation and cannot be retrieved afterwards. You can revoke either from hosted Account settings.',
      ],
      [
        'Cookies',
        'The hosted service sets host-only cookies only where they are strictly necessary. Signing in sets a session cookie, and the sign-in redirect briefly sets state and verifier cookies for that one exchange. Separately, unlocking a password-protected shared Trace sets a cookie for that Trace so you are not asked again for 24 hours; that one is set for visitors who are not signed in. We do not set advertising or cross-site tracking cookies.',
      ],
      [
        'This website',
        'capture.exalto.ai serves static pages and runs no advertising or analytics scripts. When you open a page, your browser asks the hosted service whether you are signed in, so the header can offer your account; the pages with a download button also read the current release version from our download storage. The landing page embeds one post from X, loaded from X’s servers with a do-not-track request; X may set its own cookies when that embed loads, under X’s privacy policy.',
      ],
      [
        'Deleting your account',
        'Deleting your account removes the account record, queues every hosted Trace it owns for deletion, and signs you out. Local Traces on your own devices are not touched; disconnecting or deleting does not remove evidence you hold locally.',
      ],
      [
        'Trace reports',
        'A report retains the selected reason and optional note for moderation. Reports are append-only. A keyed network-derived value rate-limits submissions separately, and the application does not store the reporter’s raw IP address in the report record.',
      ],
      [
        'Your choices',
        'You choose whether a shared Trace is Unlisted or Listed. Both start accessible to anyone with the link; Unlisted only keeps it out of public Traces. After admission, you can stop sharing, require a password, or set an expiry. Keep private captures and credentials under your control. For privacy questions or requests, contact the Exalto Seal operator through the project’s support channel.',
      ],
      [
        'Updates',
        'We may revise this policy as the service evolves. The current version will always be available on this page.',
      ],
    ],
  },
  terms: {
    title: 'Terms of Service',
    updated: 'October 2026',
    intro:
      'These terms govern your use of Exalto Capture, Exalto Seal, the local tooling, and the Trace-sharing service.',
    sections: [
      [
        'Using the service',
        'Use Exalto Capture and Exalto Seal lawfully and only with content, credentials, and provider accounts you are authorized to use. Do not interfere with the service, bypass access controls, or submit material that infringes the rights of others.',
      ],
      [
        'Your shared Traces',
        'You are responsible for every package you choose to submit. Sharing is an explicit consent boundary: once admitted, its disclosed conversation and exact package can be accessed by anyone with the link. Unlisted is not private; it only keeps the Trace out of public Traces.',
      ],
      [
        'What a Sealed Trace establishes',
        'A Sealed .llmtrace package can be checked against its cryptographic and protocol evidence: that the disclosed bytes traveled an authenticated connection with the named provider, that they have not changed since capture, and that the named notary witnessed them at the stated time. The readable conversation is derived from that package, and the download preserves its exact bytes. Neither result establishes that a model output or a person’s interpretation of it is true, complete, safe, or suitable for a particular purpose, who was at the keyboard, that a local tool ran, or that every interaction was disclosed.',
      ],
      [
        'Not a notarial act',
        'Exalto Seal is not a notary public. Sealing is not a notarial act, and a Sealed Trace or receipt is cryptographic evidence, not a legal instrument. The Exalto Capture Protocol uses “notary” as a technical role term, in the way public-key infrastructure uses “certificate authority.”',
      ],
      [
        'Other notaries',
        'The protocol is open. A Trace may be sealed by a notary you run or that a third party operates; that notary’s terms govern its service. Exalto Seal’s hosted verification checks a package against the notary keys in its own Registry; a package sealed elsewhere is verified with that notary’s public key using the local tooling.',
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
