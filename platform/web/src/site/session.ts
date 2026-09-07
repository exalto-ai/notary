// Whether this browser has ever completed sign-in. The value is a rendering
// hint, never an authorization: the API still decides every request, and a
// stale hint costs one skeleton, not access to anything.
//
// It exists so the first paint can be right. Without it the root has to wait
// for /api/account before it knows whether to show the public landing or the
// workspace, and waiting is what produced the floating page-centre spinner.

const SESSION_HINT = 'notary-session';

export function hadSession(): boolean {
  try {
    return window.localStorage.getItem(SESSION_HINT) === 'yes';
  } catch {
    return false;
  }
}

export function rememberSession(signedIn: boolean): void {
  try {
    if (signedIn) window.localStorage.setItem(SESSION_HINT, 'yes');
    else window.localStorage.removeItem(SESSION_HINT);
  } catch {
    // A browser that refuses storage still works; it just loads without the hint.
  }
}
