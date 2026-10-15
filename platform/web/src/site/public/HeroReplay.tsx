import { useRef } from 'react';
import { useReplay } from './hooks';
import { COPY, RECEIPT, receiptPhase, STEP_NAMES } from './replay';

export function HeroReplay({
  copied,
  copy,
}: {
  copied: string;
  copy: (key: string, text: string) => void;
}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const replay = useReplay(terminalRef);
  const { state, script, ends, stepsDone, done, typing } = replay;
  const shown = Math.min(state.i, script.length);
  const idle = !typing && (done || !state.playing);
  const control = state.playing ? 'Pause' : done ? 'Replay' : state.started ? 'Resume' : 'Play';
  const receipt = RECEIPT[receiptPhase(stepsDone)];
  const caret = <span className="cp-caret" aria-hidden="true" />;

  return (
    <div className="cp-replay">
      <div className="cp-term">
        <div className="cp-term-bar">
          <span>~/evals</span>
          <span>zsh</span>
          <span className="cp-term-rec">
            <span
              className="cp-rec-dot"
              data-blink={state.playing || undefined}
              aria-hidden="true"
            />
            REC
          </span>
          <button type="button" className="cp-btn-mono" onClick={replay.toggle}>
            {control}
          </button>
        </div>
        <div ref={terminalRef} className="cp-term-body" role="log" aria-label="Terminal replay">
          {script.slice(0, shown).map((line, index) => {
            const key = `${index}-${line[1]}`;
            if (line[0] === 'cmd')
              return (
                <div key={key} className="cp-term-cmd">
                  <span className="cp-prompt">$</span>
                  <span>{line[1]}</span>
                </div>
              );
            if (line[0] === 'out')
              return (
                <div key={key} className="cp-term-out">
                  {line[1]}
                </div>
              );
            if (line[0] === 'ok')
              return (
                <div key={key} className="cp-term-ok">
                  <span>✓</span>
                  <span>{line[1]}</span>
                </div>
              );
            return <div key={key} className="cp-term-gap" />;
          })}
          {typing ? (
            <div className="cp-term-cmd">
              <span className="cp-prompt">$</span>
              <span>
                {script[state.i][1].slice(0, state.c)}
                {caret}
              </span>
            </div>
          ) : null}
          {idle ? (
            <div className="cp-term-idle">
              <span className="cp-prompt">$</span>
              <span>{caret}</span>
            </div>
          ) : null}
        </div>
        <div className="cp-steps">
          {STEP_NAMES.map((name, step) => {
            const isDone = state.i >= ends[step];
            const isCurrent = !isDone && step === stepsDone && state.started;
            return (
              <button
                key={name}
                type="button"
                className="cp-step"
                data-state={isDone ? 'done' : isCurrent ? 'current' : 'pending'}
                aria-label={`Show step ${step + 1}, ${name}`}
                onClick={() => replay.goStep(step)}
              >
                <span className="cp-step-num">0{step + 1}</span>
                <span className="cp-step-label">{name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="cp-receipt cp-paper" aria-live="polite">
        <div className="cp-receipt-head">
          <span className="cp-micro">Sealed trace</span>
          <span className="cp-state-tag" data-tag={receipt.tag}>
            {receipt.state}
          </span>
        </div>
        <div>
          <div className="cp-receipt-id">{receipt.id}</div>
          <div className="cp-receipt-meta">{receipt.meta}</div>
        </div>
        <div className="cp-receipt-rows">
          {(
            [
              ['Provenance', receipt.prov],
              ['Integrity', receipt.integ],
              ['Time', receipt.time],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="cp-receipt-row">
              <b>{label}</b>
              <span data-pending={receipt.sealed ? undefined : ''}>{value}</span>
              <i>{receipt.mark}</i>
            </div>
          ))}
        </div>
        <div className="cp-receipt-keys">
          <span className="cp-micro">Disclosed</span>
          <span>Request and response bodies</span>
          <span className="cp-micro">Hidden</span>
          <span>Every header value, your API key included</span>
          <span className="cp-micro">Notary</span>
          <span>Exalto Seal · key 02a7…c41e</span>
        </div>
        <p className="cp-receipt-note">{receipt.note}</p>
        <div className="cp-receipt-field">
          <div data-pending={receipt.sealed ? undefined : ''}>{receipt.link}</div>
          <button
            type="button"
            className="cp-btn-paper"
            onClick={() => copy('receipt', COPY.receipt)}
          >
            {copied === 'receipt' ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
