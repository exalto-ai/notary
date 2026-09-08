import { useEffect, useState } from 'react';

// Most authentication checks return faster than a person can perceive a change,
// so showing an indicator immediately only produces a flash. Nothing is drawn
// until the wait is long enough to be worth acknowledging.
const PLACEHOLDER_DELAY_MS = 250;

export function useSettledWait(waiting: boolean, delay = PLACEHOLDER_DELAY_MS): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!waiting) {
      setSettled(false);
      return;
    }
    const timer = window.setTimeout(() => setSettled(true), delay);
    return () => window.clearTimeout(timer);
  }, [waiting, delay]);
  return settled;
}

// The placeholders below stand in the geometry they are about to replace, so
// the page does not jump when the real content arrives.

export function AccountPlaceholder() {
  return (
    <main
      className="dashboard-shell dashboard-shell--account dashboard-shell--placeholder"
      role="status"
      aria-live="polite"
      aria-label="Loading dashboard"
    >
      <div className="dashboard-layout">
        <aside className="dashboard-sidebar" aria-hidden="true">
          <nav>
            <i className="app-skeleton app-skeleton--nav" />
            <i className="app-skeleton app-skeleton--nav" />
            <i className="app-skeleton app-skeleton--nav" />
            <i className="app-skeleton app-skeleton--nav" />
          </nav>
        </aside>
        <div className="dashboard-page">
          <header className="dashboard-page-header">
            <i className="app-skeleton app-skeleton--kicker" />
            <i className="app-skeleton app-skeleton--title" />
            <i className="app-skeleton app-skeleton--line" />
          </header>
          <div className="app-skeleton-cards">
            <i className="app-skeleton app-skeleton--card" />
            <i className="app-skeleton app-skeleton--card" />
            <i className="app-skeleton app-skeleton--card" />
          </div>
        </div>
      </div>
    </main>
  );
}
