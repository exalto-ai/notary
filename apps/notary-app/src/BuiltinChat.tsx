import { Menu } from '@mantine/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { Cpu, Plus } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { type DesktopState, errorMessage, isTauri, setCaptureEnabled, startDaemon } from './bridge';
import * as bridge from './builtinBridge';
import { ChatComposer, ComposerChip } from './ChatComposer';
import { ChatTranscript, type Exchange } from './ChatTranscript';
import notaryMark from './notary-mark.svg';
import { connectionNames, ProviderConnections, readConnections } from './ProviderConnections';
import { SfSymbol } from './SfSymbol';
import './chat.css';

// A stable callback ref runs once, so re-renders never pull focus out of the dialog's fields.
const focusOnMount = (node: HTMLElement | null) => node?.focus();

export function BuiltinChat({
  state,
  refresh,
  onOpenTrace,
}: {
  state: DesktopState;
  refresh: () => Promise<void>;
  onOpenTrace: (id: string) => void;
}) {
  const [connections, setConnections] = useState<bridge.Connection[] | null>(null);
  const [preferred, setPreferred] = useState<bridge.ConnectionId>('chatgpt');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<bridge.ChatModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [modelsRevision, setModelsRevision] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [showConnections, setShowConnections] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<string | null>(null);
  const alive = useRef(true);
  const composer = useRef<HTMLTextAreaElement>(null);
  const connection = connections?.find((c) => c.id === preferred) ?? connections?.[0];
  const selected = connection?.id;
  const connectionStatus = connection?.status;
  const hasExchanges = exchanges.length > 0;
  const unfinished = exchanges.some((e) => e.result?.status !== 'complete');
  const modelName = models.find((m) => m.id === model)?.name ?? model;

  function newChat() {
    setExchanges([]);
    setPrompt('');
    setError('');
    requestAnimationFrame(() => composer.current?.focus());
  }
  useEffect(() => {
    alive.current = true;
    void readConnections()
      .then(({ connections }) => {
        if (alive.current) setConnections(connections);
      })
      .catch((e) => {
        if (alive.current) {
          setConnections([]);
          setError(errorMessage(e));
        }
      });
    return () => {
      alive.current = false;
      if (request.current) void bridge.cancelChat(request.current).catch(() => undefined);
    };
  }, []);
  // File > New Chat clears the conversation and focuses the composer.
  const newChatFromMenu = useEffectEvent(() => {
    if (request.current) return;
    setShowConnections(false);
    newChat();
  });
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: UnlistenFn | null = null;
    void listen<string>('exalto:menu', (event) => {
      if (event.payload === 'new-chat') newChatFromMenu();
    }).then((stopListening) => {
      if (disposed) stopListening();
      else unlisten = stopListening;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: modelsRevision is a reload trigger bumped to refetch models; the body does not read it.
  useEffect(() => {
    if (!selected || !connectionStatus || showConnections || hasExchanges) return;
    if (connectionStatus === 'locked') {
      setModels([]);
      setModel('');
      setModelsLoading(false);
      setModelsError('Unlock the vault in Connections to load models.');
      return;
    }
    let disposed = false;
    setModelsLoading(true);
    setModelsError('');
    setModel('');
    setModels([]);
    void bridge
      .listModels(selected)
      .then((items) => {
        if (disposed) return;
        setModels(items);
        setModel((items.find((item) => item.is_default) || items[0])?.id || '');
        if (!items.length)
          setModelsError(
            'No chat models are available for this connection. Reconnect or try another connection.',
          );
      })
      .catch((error) => {
        if (!disposed) setModelsError(errorMessage(error));
      })
      .finally(() => {
        if (!disposed) setModelsLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [selected, connectionStatus, showConnections, modelsRevision, hasExchanges]);

  const captureOn = state.capture_enabled && state.running;
  const canSend = !!connection && captureOn && !!model && !!prompt.trim() && !unfinished;
  async function send() {
    if (busy || !selected || !canSend) return;
    const id = crypto.randomUUID();
    request.current = id;
    const message = prompt.trim();
    setPrompt('');
    setBusy(true);
    setError('');
    const history: bridge.ChatMessage[] = exchanges.flatMap((e) => [
      { role: 'user' as const, content: e.prompt },
      { role: 'assistant' as const, content: e.response },
    ]);
    history.push({ role: 'user', content: message });
    setExchanges((all) => [
      ...all,
      { prompt: message, response: '', model: modelName, sentAt: Date.now() },
    ]);
    const settle = (result: bridge.ChatResult) =>
      setExchanges((all) => all.map((e, i) => (i === all.length - 1 ? { ...e, result } : e)));
    try {
      const result = await bridge.sendChat(id, selected, model, history, (text) => {
        if (alive.current && request.current === id)
          setExchanges((all) =>
            all.map((e, i) => (i === all.length - 1 ? { ...e, response: e.response + text } : e)),
          );
      });
      if (alive.current) settle(result);
    } catch (e) {
      if (alive.current) settle({ status: errorMessage(e), traces: [] });
    } finally {
      request.current = null;
      if (alive.current) {
        setBusy(false);
        await refresh();
      }
    }
  }

  const ready = connections !== null && connections.length > 0;
  const composerCard = ready && (
    <ChatComposer
      value={prompt}
      onChange={setPrompt}
      onSend={() => void send()}
      onStop={() => {
        if (request.current)
          void bridge.cancelChat(request.current).catch((e) => setError(errorMessage(e)));
      }}
      busy={busy}
      canSend={canSend}
      disabled={busy || unfinished}
      placeholder={unfinished ? 'Start a new chat to continue' : 'Ask anything'}
      inputRef={composer}
      controls={
        <>
          <ComposerChip
            label={connection ? connectionNames[connection.id] : 'Connection'}
            ariaLabel={`Connection: ${connection ? connectionNames[connection.id] : 'none'}`}
            leading={
              <span className="chat-chip-mark" data-state={connectionStatus} aria-hidden="true" />
            }
            disabled={busy}
          >
            <Menu.RadioGroup
              value={selected ?? null}
              onChange={(value) => setPreferred(value as bridge.ConnectionId)}
            >
              {connections.map((item) => (
                <Menu.RadioItem
                  key={item.id}
                  value={item.id}
                  disabled={hasExchanges}
                  closeMenuOnClick
                >
                  {connectionNames[item.id]}
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
            <Menu.Divider />
            <Menu.Item onClick={() => setShowConnections(true)}>Manage connections…</Menu.Item>
          </ComposerChip>
          <ComposerChip
            label={modelsLoading ? 'Loading models…' : modelName || 'No model'}
            ariaLabel={`Model: ${modelName || 'none'}`}
            leading={<SfSymbol name="cpu" fallback={Cpu} size={12} />}
            disabled={busy || hasExchanges || modelsLoading || models.length === 0}
          >
            <Menu.RadioGroup value={model} onChange={setModel}>
              {models.map((item) => (
                <Menu.RadioItem key={item.id} value={item.id} closeMenuOnClick>
                  {item.name}
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </ComposerChip>
        </>
      }
    />
  );
  // Facts under the composer, shown only when they change what happens next.
  const context = (
    <div className="chat-context">
      {ready && captureOn && !hasExchanges && (
        <span className="chat-context-chip">
          <span className="chat-ledger-mark is-captured" aria-hidden="true" />
          Capture on
        </span>
      )}
      {ready && !captureOn && (
        <span className="chat-context-chip is-off">
          <span className="chat-ledger-mark" aria-hidden="true" />
          {state.running ? 'Capture off' : 'Capture service off'}
          <button
            type="button"
            className="chat-context-action"
            disabled={busy}
            onClick={() => {
              setError('');
              void startDaemon()
                .then(() => setCaptureEnabled(true))
                .then(refresh)
                .catch((e) => setError(errorMessage(e)));
            }}
          >
            Turn on capture
          </button>
        </span>
      )}
      {modelsError && (
        <span className="chat-context-error" role="alert">
          {modelsError}
          {connectionStatus !== 'locked' && (
            <button
              type="button"
              className="chat-context-action"
              disabled={busy || modelsLoading}
              onClick={() => setModelsRevision((n) => n + 1)}
            >
              Retry models
            </button>
          )}
        </span>
      )}
      {error && (
        <span className="chat-context-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );

  return (
    <section className="builtin-chat">
      <header className="view-toolbar" data-tauri-drag-region="deep">
        <h1 data-tauri-drag-region>Chat</h1>
        <span className="chat-toolbar-spacer" data-tauri-drag-region />
        <button
          type="button"
          className="mac-button is-small"
          disabled={busy || !hasExchanges}
          onClick={newChat}
        >
          <SfSymbol name="plus" fallback={Plus} size={12} weight="semibold" /> New chat
        </button>
      </header>
      {hasExchanges ? (
        <>
          <ChatTranscript exchanges={exchanges} busy={busy} onOpenTrace={onOpenTrace} />
          <footer className="chat-dock">
            {composerCard}
            {context}
          </footer>
        </>
      ) : (
        <div className="chat-start">
          <img className="chat-start-mark" src={notaryMark} alt="Exalto Capture" />
          {composerCard}
          {context}
          {connections?.length === 0 && (
            <button
              type="button"
              className="mac-button is-primary is-large"
              onClick={() => setShowConnections(true)}
            >
              Add a connection
            </button>
          )}
        </div>
      )}
      {showConnections && (
        // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop click is a pointer-only shortcut; keyboard users dismiss the focused dialog with Escape or Done.
        // biome-ignore lint/a11y/useKeyWithClickEvents: Escape on the focused dialog and the Done button are the keyboard equivalents of this backdrop click.
        <div className="chat-sheet-overlay" onClick={() => setShowConnections(false)}>
          <section
            className="chat-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Connections"
            tabIndex={-1}
            ref={focusOnMount}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowConnections(false);
            }}
          >
            <div className="chat-sheet-body">
              <ProviderConnections
                disabled={busy}
                onChange={(items) => {
                  setConnections(items);
                  // A conversation stays with the connection it started on.
                  if (selected && !items.some((c) => c.id === selected)) setExchanges([]);
                }}
              />
            </div>
            <footer className="chat-sheet-footer">
              <button
                className="mac-button is-primary"
                type="button"
                onClick={() => setShowConnections(false)}
              >
                Done
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
