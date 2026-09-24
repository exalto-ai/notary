import { legalPages } from '../content/legal';

export function Footer() {
  return (
    <footer className="app-footer">
      <a className="footer-copyright" href="https://exalto.ai">
        Exalto
      </a>
      <nav aria-label="Footer">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </nav>
    </footer>
  );
}

type LegalPageKey = keyof typeof legalPages;

export function isLegalPage(pageKey: string | undefined): pageKey is LegalPageKey {
  return pageKey !== undefined && pageKey in legalPages;
}

export function LegalPage({ pageKey }: { pageKey: LegalPageKey }) {
  const page = legalPages[pageKey];
  return (
    <main className="legal-shell">
      <span className="eyebrow">{page.eyebrow}</span>
      <h1>{page.title}</h1>
      <p className="legal-intro">{page.intro}</p>
      <p className="legal-updated">Last updated: August 2026</p>
      <div className="legal-sections">
        {page.sections.map(([heading, copy]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            <p>{copy}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
