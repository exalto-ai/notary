import { legalPages } from '../../content/legal';

export function Legal({ pageKey }: { pageKey: 'privacy' | 'terms' }) {
  const page = legalPages[pageKey];
  return (
    <main className="cp-wrap cp-docs cp-legal">
      <div className="cp-titleblock">
        <div>
          <div className="cp-label">Section</div>
          <div className="cp-titleblock-value">Legal</div>
        </div>
        <div>
          <div className="cp-label">Page</div>
          <div className="cp-titleblock-value">{page.title}</div>
        </div>
        <div>
          <div className="cp-label">Last updated</div>
          <div className="cp-titleblock-value">August 2026</div>
        </div>
      </div>
      <article className="cp-docs-article cp-legal-article">
        <h1>{page.title}</h1>
        <p className="cp-docs-lead">{page.intro}</p>
        <div className="cp-mdx">
          {page.sections.map(([heading, copy]) => (
            <section key={heading}>
              <h2>{heading}</h2>
              <p>{copy}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
