import { useMemo, useState } from 'react';
import {
  clickItem,
  DISCLOSURE_DEFAULT,
  type Disclosure,
  makeItems,
  requestBody,
  verdict,
} from './replay';

function Redaction({ width }: { width: number }) {
  return <span className="cp-redact" role="img" aria-label="hidden" style={{ width }} />;
}

/** Fig. 04: fifty exchanges in the archive; disclose the one you cite. */
export function DisclosureDemo() {
  const items = useMemo(makeItems, []);
  const [state, setState] = useState<Disclosure>(DISCLOSURE_DEFAULT);
  const disclosed = new Set(state.disclosed);
  const focused = items[state.focus - 1];
  const focusedOn = disclosed.has(state.focus);
  const tampered = state.tamper && focusedOn;

  return (
    <div className="cp-disclose">
      <div className="cp-archive">
        <div className="cp-archive-head">
          <span className="cp-micro">Your archive · 50 exchanges</span>
          <span className="cp-archive-summary">
            {disclosed.size} disclosed · {50 - disclosed.size} private
          </span>
        </div>
        <div className="cp-archive-grid" role="group" aria-label="Exchanges in the archive">
          {items.map((item) => {
            const on = disclosed.has(item.n);
            return (
              <button
                key={item.n}
                type="button"
                className="cp-cell"
                aria-pressed={on}
                aria-label={`Item ${item.n}, ${on ? 'disclosed' : 'private'}`}
                data-focus={state.focus === item.n || undefined}
                onClick={() => setState((current) => clickItem(current, item.n))}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="cp-archive-legend">
          <span>
            <i data-kind="disclosed" />
            Disclosed
          </span>
          <span>
            <i data-kind="private" />
            Private
          </span>
          <span>
            <i data-kind="selected" />
            Selected
          </span>
        </div>
        <p className="cp-archive-help">
          Click an exchange to disclose and inspect it; click it again to keep it private. The
          notary saw ciphertext for all fifty. Disclosing three reveals three.
        </p>
        <div className="cp-archive-actions">
          <button
            type="button"
            className="cp-btn-mono"
            aria-pressed={state.tamper}
            onClick={() => setState((current) => ({ ...current, tamper: !current.tamper }))}
          >
            {state.tamper ? 'Undo the change' : 'Change one byte'}
          </button>
          <button
            type="button"
            className="cp-btn-mono"
            onClick={() => setState(DISCLOSURE_DEFAULT)}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="cp-exchange cp-paper" aria-live="polite">
        <div className="cp-exchange-head">
          <span className="cp-micro">Item {focused.n} · reasoning-50</span>
          <span className="cp-state-tag" data-tag={focusedOn ? 'fill-ink' : 'outline-ink'}>
            {focusedOn ? 'Disclosed' : 'Private'}
          </span>
        </div>
        <div className="cp-exchange-id">{focused.id}</div>
        {focusedOn ? (
          <div className="cp-exchange-body">
            <div>
              <div className="cp-micro">Request · request.disclosed.http</div>
              <div className="cp-http">
                <div>POST /v1/responses HTTP/1.1</div>
                <div>
                  host: <Redaction width={104} />
                </div>
                <div>
                  authorization: <Redaction width={136} />
                </div>
                <div>
                  content-type: <Redaction width={88} />
                </div>
                <div data-body="">{requestBody(focused)}</div>
              </div>
            </div>
            <div>
              <div className="cp-micro">Response · response.disclosed.http</div>
              <div className="cp-http">
                <div>HTTP/1.1 200 OK</div>
                <div>
                  content-type: <Redaction width={88} />
                </div>
                <div>transfer-encoding: chunked</div>
                <div data-body="">
                  {'{"output_text":"'}
                  <span className="cp-answer" data-tampered={tampered || undefined}>
                    {tampered ? focused.tampered : focused.a}
                  </span>
                  {'"}'}
                </div>
              </div>
            </div>
            <div className="cp-receipt-rows">
              <div className="cp-receipt-row cp-receipt-row-tight">
                <b>Provenance</b>
                <span>api.openai.com · authenticated TLS</span>
                <i>✓</i>
              </div>
              <div className="cp-receipt-row cp-receipt-row-tight">
                <b>Integrity</b>
                <span>
                  {tampered ? 'one byte changed · hashes do not match' : 'package hashes match'}
                </span>
                <i>{tampered ? '✗' : '✓'}</i>
              </div>
              <div className="cp-receipt-row cp-receipt-row-tight">
                <b>Time</b>
                <span>{focused.time} UTC · Exalto Seal</span>
                <i>✓</i>
              </div>
            </div>
            <div className="cp-verdict">{verdict(focused, tampered)}</div>
          </div>
        ) : (
          <div className="cp-private">
            <p>Private.</p>
            <p>
              This exchange stays in your archive, encrypted on your machine. Nothing you disclose
              reveals it, and the proof for what you disclose does not depend on it.
            </p>
            <button
              type="button"
              className="cp-btn-ink"
              onClick={() => setState((current) => clickItem(current, current.focus))}
            >
              Disclose it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
