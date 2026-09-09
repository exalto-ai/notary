import { createRoot } from 'react-dom/client';
import { CaptureApp } from './site/CaptureApp';
import { localPreview } from './site/preview';

const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <>
      {localPreview && (
        <aside className="local-preview-banner">
          Local preview · Sample data, no verified evidence. <a href="/app/">Open dashboard</a>
        </aside>
      )}
      <CaptureApp />
    </>,
  );
