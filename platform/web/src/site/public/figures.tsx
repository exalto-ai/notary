/** The Lucide download arrow, stroke 2, square caps. */
export function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 15v5h16v-5" />
    </svg>
  );
}

/** The Proof of Thought mark: a rounded square around two quote marks. */
export function PotMark({ size = 56 }: { size?: number }) {
  const quote = (
    <>
      <circle cy="-7" r="8.2" />
      <path d="M8,-4.5 C8,4.5 3,12 -6.8,17.5 C-0.6,9.5 1.9,3 1.4,-4.5 Z" />
    </>
  );
  return (
    <svg width={size} height={size} viewBox="-46 -46 92 92" aria-hidden="true">
      <rect
        x="-42"
        y="-42"
        width="84"
        height="84"
        rx="16"
        style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 4 }}
      />
      <g style={{ fill: 'currentColor' }}>
        <g transform="translate(-13,-1) rotate(180)">{quote}</g>
        <g transform="translate(13,-1) rotate(180)">{quote}</g>
      </g>
    </svg>
  );
}

/** Fig. 2: Leonardo's design for a flying machine, inverted, with callouts. */
export function LeonardoPlate() {
  return (
    <figure className="cp-plate">
      <div className="cp-plate-frame">
        <img
          src="/art/flying-857.webp"
          alt=""
          width={857}
          height={1200}
          loading="lazy"
          decoding="async"
        />
        <svg viewBox="0 0 857 1380" aria-hidden="true">
          <g className="cp-plate-lines">
            <path d="M262 64L300 240" />
            <path d="M628 64L560 540" />
            <path d="M214 1328L320 850" />
            <path d="M604 1328L510 1165" />
          </g>
          <g className="cp-plate-squares">
            <rect x="295" y="235" width="10" height="10" />
            <rect x="555" y="535" width="10" height="10" />
            <rect x="315" y="845" width="10" height="10" />
            <rect x="505" y="1160" width="10" height="10" />
          </g>
          <g className="cp-plate-numbers">
            <text x="244" y="48">
              60
            </text>
            <text x="610" y="48">
              62
            </text>
            <text x="196" y="1366">
              64
            </text>
            <text x="586" y="1366">
              66
            </text>
          </g>
        </svg>
      </div>
      <figcaption className="cp-figcap">
        <span className="cp-figcap-num">FIG. 2</span>
        <span className="cp-figcap-key">
          <b>60</b>Instructions
        </span>
        <span className="cp-figcap-key">
          <b>62</b>Responses
        </span>
        <span className="cp-figcap-key">
          <b>64</b>Tool calls
        </span>
        <span className="cp-figcap-key">
          <b>66</b>Time
        </span>
        <span className="cp-figcap-src">Design for a flying machine, after Leonardo</span>
      </figcaption>
    </figure>
  );
}

const relayColumns = [
  { x: 1, label: '01  Start a session', num: '70', title: 'You' },
  { x: 293, label: '02  Witness, never read', num: '72', title: 'The notary' },
  { x: 585, label: '03  Answer as usual', num: '74', title: 'The AI provider' },
  { x: 877, label: '04  Verify, anywhere', num: '76', title: 'Anyone' },
] as const;

const relayLines: ReadonlyArray<readonly [string, string]> = [
  ['Exalto Capture,', 'on your machine'],
  ['Exalto Seal, or', 'one you run'],
  ['api.openai.com,', 'api.anthropic.com'],
  ['seal.exalto.ai,', 'or offline'],
];

const relayHolds = [
  'holds: key, plaintext',
  'holds: one key share',
  'serves: TLS, as usual',
  'needs: notary key',
];

/** Fig. 3: the relay. One TLS session through the notary; later, the trace to anyone. */
export function RelayFigure() {
  return (
    <figure className="cp-relay">
      <div className="cp-relay-scroll">
        <svg
          viewBox="0 0 1104 384"
          role="img"
          aria-label="You, the notary, the AI provider and anyone. One TLS session runs from your machine through the notary to the provider; later, the sealed trace goes from you to anyone."
        >
          <g className="cp-relay-steps">
            {relayColumns.map((column) => (
              <text key={column.num} x={column.x - 1} y="24">
                {column.label}
              </text>
            ))}
          </g>
          <g className="cp-relay-boxes">
            {relayColumns.map((column) => (
              <rect key={column.num} x={column.x} y="48" width="226" height="160" />
            ))}
          </g>
          <g className="cp-relay-lines">
            <path d="M228 122H292M228 132H292M520 122H584M520 132H584" />
            <path d="M0 228V236H812V228" />
            <path d="M114 208V318H990V218" />
          </g>
          <g className="cp-relay-squares">
            <rect x="985" y="210" width="10" height="10" />
            <rect x="109" y="203" width="10" height="10" />
          </g>
          <g className="cp-relay-nums">
            {relayColumns.map((column) => (
              <text key={column.num} x={column.x + 15} y="76">
                {column.num}
              </text>
            ))}
          </g>
          <g className="cp-relay-titles">
            {relayColumns.map((column) => (
              <text key={column.num} x={column.x + 15} y="112">
                {column.title}
              </text>
            ))}
          </g>
          <g className="cp-relay-mono">
            {relayColumns.map((column, index) => (
              <g key={column.num}>
                <text x={column.x + 15} y="144">
                  {relayLines[index][0]}
                </text>
                <text x={column.x + 15} y="164">
                  {relayLines[index][1]}
                </text>
              </g>
            ))}
          </g>
          <g className="cp-relay-holds">
            {relayColumns.map((column, index) => (
              <text key={column.num} x={column.x + 15} y="194">
                {relayHolds[index]}
              </text>
            ))}
          </g>
          <g className="cp-relay-notes">
            <text x="132" y="262">
              One authenticated TLS session. The notary co-signs ciphertext only.
            </text>
            <text x="132" y="346">
              Later, you hand over the sealed trace. Only what you disclose travels.
            </text>
          </g>
        </svg>
      </div>
      <figcaption className="cp-figcap">
        <span className="cp-figcap-num">FIG. 3</span>
        <span className="cp-figcap-key">
          <b>70</b>You
        </span>
        <span className="cp-figcap-key">
          <b>72</b>The notary
        </span>
        <span className="cp-figcap-key">
          <b>74</b>The AI provider
        </span>
        <span className="cp-figcap-key">
          <b>76</b>Anyone
        </span>
        <span className="cp-figcap-src">Multiparty TLS, built on TLSNotary</span>
      </figcaption>
    </figure>
  );
}
