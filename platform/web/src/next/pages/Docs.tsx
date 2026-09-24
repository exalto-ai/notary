import { Anchor, Box, Button, Modal, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import {
  type DocBlock,
  type DocPageKey,
  docAliases,
  docNavigation,
  docPages,
  docSubheadings,
  isDocPageKey,
} from '../../content/docs';
import { CodeBlock } from '../components/CodeBlock';
import { Data, Fact, Facts } from '../components/primitives';
import { href } from '../router';

const order = docNavigation.flatMap((group) => group.pages.map(([key]) => key));

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function level(pageKey: DocPageKey, block: DocBlock) {
  return docSubheadings[pageKey]?.has(block.heading) ? 3 : 2;
}

function Block({ block, pageKey }: { block: DocBlock; pageKey: DocPageKey }) {
  const deep = level(pageKey, block) === 3;
  return (
    <Box component="section" id={slug(block.heading)} mt={deep ? 32 : 44}>
      <Text
        component={deep ? 'h3' : 'h2'}
        fz={deep ? 17 : 22}
        fw={600}
        m={0}
        className="x-display"
        style={deep ? undefined : { borderTop: '1px solid var(--x-rule-firm)', paddingTop: 14 }}
      >
        {block.heading}
      </Text>

      {block.body ? (
        <Text fz="md" mt={10} maw="var(--x-measure)">
          {block.body}
        </Text>
      ) : null}

      {block.steps ? (
        <Box mt="md" className="x-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {block.steps.map((step) => (
            <Box key={step.title} p="md">
              <Text fz={14.5} fw={570}>
                {step.title}
              </Text>
              <Text fz="sm" c="var(--x-quiet)" mt={4} maw="var(--x-measure)">
                {step.body}
              </Text>
            </Box>
          ))}
        </Box>
      ) : null}

      {block.cards ? (
        <Box
          mt="md"
          className="x-grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
        >
          {block.cards.map((card) => (
            <Box key={card.title} p="md">
              <Data c="var(--x-quiet)">{card.meta}</Data>
              <Text fz={14.5} fw={570} mt={6}>
                {card.title}
              </Text>
              <Text fz="sm" c="var(--x-quiet)" mt={4}>
                {card.body}
              </Text>
            </Box>
          ))}
        </Box>
      ) : null}

      {block.columns ? (
        <Box
          mt="md"
          className="x-grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          {block.columns.map((column) => (
            <Box key={column.title} p="md">
              <Text fz={14} fw={570}>
                {column.title}
              </Text>
              <Box mt={8} style={{ display: 'grid', gap: 6 }}>
                {column.items.map((item) => (
                  <Text key={item} fz="sm" c="var(--x-quiet)">
                    {item}
                  </Text>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      ) : null}

      {block.definitions ? (
        <Box mt="md" className="x-record" p="md" maw={760}>
          <Facts>
            {block.definitions.map((definition) => (
              <Fact key={definition.term} label={definition.term}>
                <Text fz="sm">{definition.description}</Text>
              </Fact>
            ))}
          </Facts>
        </Box>
      ) : null}

      {block.items ? (
        <Box mt="md" component="ul" className="x-list" maw="var(--x-measure)">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </Box>
      ) : null}

      {block.code ? (
        <Box mt="md" maw={760}>
          <CodeBlock lines={block.code.split('\n')} />
        </Box>
      ) : null}

      {block.note ? (
        <Box
          mt="md"
          p="md"
          maw="var(--x-measure)"
          style={{ background: 'var(--x-seal-wash)', borderRadius: 6 }}
        >
          <Text fz="sm">{block.note}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function Search({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [term, setTerm] = useState('');
  const results = useMemo(() => {
    if (!term.trim()) return [];
    const needle = term.toLowerCase();
    return order.flatMap((key) => {
      const page = docPages[key];
      return page.blocks
        .filter((block) =>
          `${page.title} ${block.heading} ${block.body ?? ''}`.toLowerCase().includes(needle),
        )
        .slice(0, 4)
        .map((block) => ({ key, page: page.title, block }));
    });
  }, [term]);

  return (
    <Modal opened={open} onClose={onClose} title="Search the docs" centered size={560}>
      <TextInput
        data-autofocus
        value={term}
        onChange={(event) => setTerm(event.currentTarget.value)}
        placeholder="Type to search"
        leftSection={<IconSearch size={15} stroke={1.6} />}
      />
      <Box mt="md" style={{ display: 'grid', gap: 1, background: 'var(--x-rule)' }}>
        {results.slice(0, 10).map((result) => (
          <UnstyledButton
            key={`${result.key}-${result.block.heading}`}
            component="a"
            href={href(`/docs/${result.key}?section=${slug(result.block.heading)}`)}
            onClick={onClose}
            p="sm"
            style={{ background: 'var(--x-record)' }}
          >
            <Text fz="sm" fw={550}>
              {result.block.heading}
            </Text>
            <Text fz={12.5} c="var(--x-quiet)">
              {result.page}
            </Text>
          </UnstyledButton>
        ))}
        {term.trim() && results.length === 0 ? (
          <Text fz="sm" c="var(--x-quiet)" p="sm" style={{ background: 'var(--x-record)' }}>
            Nothing matches that. Try a command name or a file extension.
          </Text>
        ) : null}
      </Box>
    </Modal>
  );
}

export function Docs({ pageKey, section }: { pageKey: string; section?: string }) {
  const key: DocPageKey = isDocPageKey(pageKey) ? pageKey : (docAliases[pageKey] ?? 'overview');
  const page = docPages[key];
  const [searchOpen, setSearchOpen] = useState(false);
  const index = order.indexOf(key);
  const previous = index > 0 ? order[index - 1] : null;
  const next = index >= 0 && index < order.length - 1 ? order[index + 1] : null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!section) return;
    document.getElementById(section)?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, [section]);

  const outline = page.blocks.filter((block) => level(key, block) === 2);

  return (
    <Box className="x-docs">
      <Box component="nav" className="x-docs-nav" aria-label="Documentation">
        <Button
          variant="default"
          size="xs"
          h={32}
          fullWidth
          justify="flex-start"
          leftSection={<IconSearch size={14} stroke={1.6} />}
          onClick={() => setSearchOpen(true)}
          mb="md"
        >
          Search
        </Button>
        {docNavigation.map((group) => (
          <Box key={group.label} mb="md">
            <Text fz={12.5} c="var(--x-faint)" mb={4} px={10}>
              {group.label}
            </Text>
            {group.pages.map(([pageId, label]) => (
              <Box
                key={pageId}
                component="a"
                href={href(`/docs/${pageId}`)}
                className="x-rail-item"
                data-active={pageId === key || undefined}
              >
                <Text component="span" fz="sm" fw={pageId === key ? 570 : 450}>
                  {label}
                </Text>
              </Box>
            ))}
          </Box>
        ))}
      </Box>

      <Box component="article" className="x-docs-body">
        <Text component="h1" fz={{ base: 30, md: 38 }} lh={1.1} fw={620} m={0} maw="20ch">
          {page.title}
        </Text>
        <Text fz="lg" c="var(--x-quiet)" mt="md" maw="var(--x-measure)">
          {page.lead}
        </Text>
        {page.blocks.map((block) => (
          <Block key={block.heading} block={block} pageKey={key} />
        ))}

        <Box
          mt={56}
          pt="lg"
          style={{
            borderTop: '1px solid var(--x-rule-firm)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 20,
          }}
        >
          {previous ? (
            <Anchor href={href(`/docs/${previous}`)} fz="sm">
              <Text fz={12.5} c="var(--x-quiet)">
                Previous
              </Text>
              {docPages[previous].title}
            </Anchor>
          ) : (
            <span />
          )}
          {next ? (
            <Anchor href={href(`/docs/${next}`)} fz="sm" ta="right">
              <Text fz={12.5} c="var(--x-quiet)">
                Next
              </Text>
              {docPages[next].title}
            </Anchor>
          ) : null}
        </Box>
      </Box>

      <Box component="nav" className="x-docs-outline" aria-label="On this page">
        <Text fz={12.5} c="var(--x-faint)" mb={8}>
          On this page
        </Text>
        {outline.map((block) => (
          <Anchor
            key={block.heading}
            href={`#${slug(block.heading)}`}
            fz={13}
            c="var(--x-quiet)"
            underline="never"
            display="block"
            py={4}
            onClick={(event) => {
              event.preventDefault();
              document.getElementById(slug(block.heading))?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {block.heading}
          </Anchor>
        ))}
      </Box>

      <Search open={searchOpen} onClose={() => setSearchOpen(false)} />
    </Box>
  );
}
