import type { MantineColorScheme, MantineColorSchemeManager } from '@mantine/core';
import { type ThemePreference, themeOptions, themeStorageKey } from '../theme';

// Mantine's color scheme values and the site's own theme preference are the
// same three words, so the prototype reads and writes the key the shipped site
// already uses. A visitor who chose an appearance keeps it across the cutover.
const legacyKey = 'llm-notary-theme';

function isPreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && themeOptions.includes(value as ThemePreference);
}

export function siteColorSchemeManager(): MantineColorSchemeManager {
  let handler: ((colorScheme: MantineColorScheme) => void) | undefined;

  const onStorage = (event: StorageEvent) => {
    if (event.key === themeStorageKey && isPreference(event.newValue)) handler?.(event.newValue);
  };

  return {
    get(defaultValue) {
      if (typeof window === 'undefined') return defaultValue;
      try {
        const stored =
          window.localStorage.getItem(themeStorageKey) ?? window.localStorage.getItem(legacyKey);
        return isPreference(stored) ? stored : defaultValue;
      } catch {
        return defaultValue;
      }
    },
    set(value) {
      try {
        window.localStorage.setItem(themeStorageKey, value);
      } catch {
        // A blocked storage is not a reason to fail the appearance change.
      }
    },
    subscribe(onUpdate) {
      handler = onUpdate;
      window.addEventListener('storage', onStorage);
    },
    unsubscribe() {
      handler = undefined;
      window.removeEventListener('storage', onStorage);
    },
    clear() {
      try {
        window.localStorage.removeItem(themeStorageKey);
      } catch {
        // Nothing to clear when storage is unavailable.
      }
    },
  };
}
