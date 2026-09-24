import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser, logoutBrowser } from '../../platform-api/client';
import { rememberSession } from '../../site/session';

export type Account = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export type AccountState = {
  account: Account | null;
  /** True until the first answer arrives, so a gate never guesses. */
  pending: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  /** After the account is gone there is nothing to re-read, so forget it. */
  forget: () => void;
};

export function useAccount(loadAccount = getCurrentUser): AccountState {
  const [account, setAccount] = useState<Account | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(
    async (cancelled: () => boolean = () => false) => {
      try {
        const next = await loadAccount();
        if (cancelled()) return;
        setAccount(next);
        setError(null);
        rememberSession(Boolean(next));
      } catch (reason) {
        if (cancelled()) return;
        // A failed read is not a signed-out reader. Saying so would send
        // someone to a sign-in page they do not need.
        setError(reason instanceof Error ? reason.message : 'Could not load your account.');
        setAccount(null);
      } finally {
        if (!cancelled()) setPending(false);
      }
    },
    [loadAccount],
  );

  useEffect(() => {
    let cancelled = false;
    void read(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [read]);

  return {
    account,
    pending,
    error,
    refresh: () => read(),
    signOut: async () => {
      await logoutBrowser();
      setAccount(null);
      rememberSession(false);
    },
    forget: () => {
      setAccount(null);
      rememberSession(false);
    },
  };
}

export function accountName(account: Pick<Account, 'display_name' | 'provider_display_name'>) {
  return account.display_name || account.provider_display_name;
}

export function authProviderName(account: Pick<Account, 'auth_provider'>) {
  return account.auth_provider === 'google' ? 'Google' : 'GitHub';
}
