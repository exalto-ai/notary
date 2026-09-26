import mdx from '@mdx-js/rollup';
import rehypeShiki from '@shikijs/rehype';
import GithubSlugger from 'github-slugger';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

function plainDocText(source) {
  return source
    .replace(/<!--(?:.|\n)*?-->/g, ' ')
    .replace(/^export\s+const\s+[^\n]+$/gm, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[<>/{}`*_~|#[\]()=,'"\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// MDX remains the content source while the compiled module also exposes the
// heading and search index consumed by the existing docs shell. Keeping this
// build-time avoids shipping a Markdown parser to every reader.
export function docMetadata() {
  return {
    name: 'capture-doc-metadata',
    enforce: 'pre',
    transform(source, id) {
      if (!id.split('?', 1)[0].endsWith('.mdx')) return null;

      const slugger = new GithubSlugger();
      const sections = [];
      let current = null;
      let fenced = false;

      const finish = () => {
        if (!current) return;
        sections.push({
          heading: current.heading,
          id: current.id,
          level: current.level,
          text: plainDocText(current.lines.join('\n')),
        });
      };

      for (const line of source.split(/\r?\n/)) {
        if (/^\s*```/.test(line)) {
          fenced = !fenced;
          current?.lines.push(line);
          continue;
        }
        const match = fenced ? null : /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
        if (match) {
          finish();
          const heading = plainDocText(match[2]);
          current = {
            heading,
            id: slugger.slug(heading),
            level: match[1].length,
            lines: [],
          };
        } else {
          current?.lines.push(line);
        }
      }
      finish();

      return {
        code: `export const docSections = ${JSON.stringify(sections)};\n${source}`,
        map: null,
      };
    },
  };
}

export function docMdx() {
  return {
    ...mdx({
      remarkPlugins: [remarkGfm],
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'append',
            properties: { className: ['x-heading-anchor'], ariaLabel: 'Link to this section' },
            content: { type: 'text', value: '#' },
          },
        ],
        [rehypeShiki, { themes: { light: 'github-light', dark: 'github-dark' } }],
      ],
    }),
    // Vite 8's built-in transform parses MDX as JSX when React includes the
    // extension, so compilation must happen in the pre phase first.
    enforce: 'pre',
  };
}
