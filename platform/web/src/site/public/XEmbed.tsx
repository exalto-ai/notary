import { useEffect, useRef, useState } from 'react';

const embedOrigin = 'https://platform.twitter.com';

/** The post identifier at the end of an x.com status address. */
function postId(url: string): string {
  return /\/status\/(\d+)/.exec(url)?.[1] ?? '';
}

/**
 * The height X's embed page reports for itself. It posts
 * `{"twttr.embed":{"method":"twttr.private.resize","params":[{"height":n}]}}`,
 * as an object or as JSON text, whenever its content is laid out.
 */
export function reportedHeight(data: unknown): number | null {
  let message = data;
  if (typeof message === 'string') {
    try {
      message = JSON.parse(message);
    } catch {
      return null;
    }
  }
  const embed = (message as { 'twttr.embed'?: { method?: string; params?: unknown[] } } | null)?.[
    'twttr.embed'
  ];
  if (embed?.method !== 'twttr.private.resize') return null;
  const height = (embed.params?.[0] as { height?: unknown } | undefined)?.height;
  return typeof height === 'number' && Number.isFinite(height) ? height : null;
}

/**
 * A live X post, rendered by X's own embed page inside a cross-origin frame.
 * Nothing from X runs on this origin: the frame can only post its height. It
 * stays at zero height until that first report, so a blocked or absent embed
 * leaves nothing but the link under it, which carries the reference anyway.
 * The frame is added on the client, after the prerendered page has hydrated:
 * its address names this page's origin, and a reader without script, or an
 * agent, gets the link.
 */
export function XEmbed({ url, author, label }: { url: string; author: string; label: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    setOrigin(window.location.origin);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== embedOrigin || event.source !== frame.current?.contentWindow) return;
      const reported = reportedHeight(event.data);
      if (reported !== null) setHeight(Math.min(2400, Math.max(120, Math.ceil(reported))));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const id = postId(url);
  // The address widgets.js itself would build for this post.
  const source =
    origin &&
    `${embedOrigin}/embed/Tweet.html?${new URLSearchParams({
      id,
      theme: 'dark',
      dnt: 'true',
      hideThread: 'true',
      lang: 'en',
      embedId: 'twitter-widget-0',
      origin,
    })}`;
  return (
    <div className="cp-embed">
      {id && source ? (
        <iframe
          ref={frame}
          src={source}
          title={`${label} ${author}`}
          style={{ height: height ?? 0 }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : null}
      <p className="cp-embed-link">
        <a href={url}>
          {label} {author} ↗
        </a>
      </p>
    </div>
  );
}
