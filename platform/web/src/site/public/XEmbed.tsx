import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    twttr?: { widgets?: { load?: (element?: Element) => void } };
  }
}

const widgetScript = 'https://platform.twitter.com/widgets.js';

/**
 * A live X post. Until the widget script runs (and wherever it cannot), the
 * blockquote is a plain link to the post, so the reference survives without
 * third-party JavaScript.
 */
export function XEmbed({ url, author, label }: { url: string; author: string; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (window.twttr?.widgets?.load) {
      window.twttr.widgets.load(element);
      return;
    }
    if (document.querySelector(`script[src="${widgetScript}"]`)) return;
    const script = document.createElement('script');
    script.src = widgetScript;
    script.async = true;
    script.charset = 'utf-8';
    document.body.appendChild(script);
  }, []);
  return (
    <div ref={host} className="cp-embed" data-live="">
      <blockquote className="twitter-tweet" data-theme="dark" data-dnt="true">
        <a href={url}>
          {label} {author}
        </a>
      </blockquote>
    </div>
  );
}
