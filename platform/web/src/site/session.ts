// Remember successful browser sign-in for local session state.

const SESSION_HINT = 'notary-session';

export function rememberSession(signedIn: boolean): void {
  try {
    if (signedIn) window.localStorage.setItem(SESSION_HINT, 'yes');
    else window.localStorage.removeItem(SESSION_HINT);
  } catch {
    // A browser that refuses storage still works; it just loads without the hint.
  }
}
