import { Menu } from '@mantine/core';
import { ArrowUp, Check, ChevronDown, Square } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { SfSymbol } from './SfSymbol';

/**
 * A compact pop-up button inside the composer: an optional leading mark, the
 * current value, and a chevron. Its menu renders in place so it keeps the
 * window's palette.
 */
export function ComposerChip({
  label,
  ariaLabel,
  leading,
  disabled,
  children,
}: {
  label: string;
  ariaLabel: string;
  leading?: ReactNode;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Menu
      position="top-start"
      offset={6}
      withinPortal={false}
      checkIcon={<SfSymbol name="checkmark" fallback={Check} size={11} weight="semibold" />}
      disabled={disabled}
      classNames={{ dropdown: 'chat-menu', item: 'chat-menu-item', divider: 'chat-menu-divider' }}
    >
      <Menu.Target>
        <button type="button" className="chat-chip" aria-label={ariaLabel} disabled={disabled}>
          {leading}
          <span className="chat-chip-label">{label}</span>
          {!disabled && (
            <SfSymbol name="chevron.down" fallback={ChevronDown} size={10} weight="semibold" />
          )}
        </button>
      </Menu.Target>
      <Menu.Dropdown>{children}</Menu.Dropdown>
    </Menu>
  );
}

/** The composer card: the message field on top, its controls and Send below. */
export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  canSend,
  disabled,
  placeholder,
  inputRef,
  controls,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  canSend: boolean;
  disabled: boolean;
  placeholder: string;
  inputRef: Ref<HTMLTextAreaElement>;
  controls: ReactNode;
}) {
  return (
    <form
      className="chat-composer"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <textarea
        ref={inputRef}
        aria-label="Message"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSend();
          }
        }}
        rows={1}
      />
      <div className="chat-composer-bar">
        {controls}
        {busy ? (
          <button
            className="chat-send is-stop"
            type="button"
            aria-label="Stop"
            title="Stop"
            onClick={onStop}
          >
            <SfSymbol name="stop.fill" fallback={Square} size={10} />
          </button>
        ) : (
          <button
            className="chat-send"
            type="submit"
            aria-label="Send"
            title="Send"
            disabled={!canSend}
          >
            <SfSymbol name="arrow.up" fallback={ArrowUp} size={13} weight="semibold" />
          </button>
        )}
      </div>
    </form>
  );
}
