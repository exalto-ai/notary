import {
  ActionIcon,
  Anchor,
  Box,
  Button,
  Drawer,
  Modal,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconMenu2, IconSearch } from '@tabler/icons-react';
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
import { mdxDocs } from '../../content/mdxDocs';
import { CodeBlock } from '../components/CodeBlock';
import { mdxComponents } from '../components/docs/DocComponents';
import { Data, Fact, Facts } from '../components/primitives';
import { href } from '../router';

const order = docNavigation.flatMap((group) => group.pages.map(([key]) => key));
const navigationLabels = new Map(
  docNavigation.flatMap((group) => group.pages.map(([key, label]) => [key, label])),
);

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function level(pageKey: DocPageKey, block: DocBlock) {
  return docSubheadings[pageKey]?.has(block.heading) ? 3 : 2;
}

function blockText(block: DocBlock) {
  return [
    block.heading,
    block.body,
    block.note,
    block.code,
    ...(block.items ?? []),
    ...(block.steps?.flatMap((step) => [step.title, step.body]) ?? []),
    ...(block.cards?.flatMap((card) => [card.meta, card.title, card.body]) ?? []),
    ...(block.columns?.flatMap((column) => [column.title, ...column.items]) ?? []),
    ...(block.definitions?.flatMap((definition) => [definition.term, definition.description]) ??
      []),
  ]
    .filter(Boolean)
    .join(' ');
}

function docTitle(key: DocPageKey) {
  return mdxDocs[key]?.title ?? docPages[key].title;
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
      const mdx = mdxDocs[key];
      const sections = mdx
        ? mdx.sections.map((section) => ({
            heading: section.heading,
            id: section.id,
            text: section.text,
          }))
        : page.blocks.map((block) => ({
            heading: block.heading,
            id: slug(block.heading),
            text: blockText(block),
          }));
      return sections
        .filter((section) =>
          `${docTitle(key)} ${mdx?.lead ?? page.lead} ${section.heading} ${section.text}`
            .toLowerCase()
            .includes(needle),
        )
        .slice(0, 4)
        .map((section) => ({ key, page: docTitle(key), ...section }));
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
            key={`${result.key}-${result.id}`}
            component="a"
            href={href(`/docs/${result.key}?section=${result.id}`)}
            onClick={onClose}
            p="sm"
            style={{ background: 'var(--x-record)' }}
          >
            <Text fz="sm" fw={550}>
              {result.heading}
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
  const mdx = mdxDocs[key];
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  const outline = mdx
    ? mdx.sections
        .filter((item) => item.level === 2)
        .map((item) => ({ heading: item.heading, id: item.id }))
    : page.blocks
        .filter((block) => level(key, block) === 2)
        .map((block) => ({ heading: block.heading, id: slug(block.heading) }));
  const title = mdx?.title ?? page.title;
  const lead = mdx?.lead ?? page.lead;
  const navigationLabel = navigationLabels.get(key) ?? title;

  return (
    <Box className="x-docs">
      <Box component="nav" className="x-docs-nav" aria-label="Documentation">
        <Box className="x-docs-mobile-bar">
          <UnstyledButton
            className="x-docs-mobile-menu"
            aria-label="Open documentation navigation"
            aria-expanded={mobileNavOpen}
            aria-controls="documentation-navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <IconMenu2 size={17} stroke={1.7} aria-hidden="true" />
            <Text component="span" className="x-docs-mobile-root">
              Docs
            </Text>
            <Text component="span" className="x-docs-mobile-divider" aria-hidden="true">
              /
            </Text>
            <Text component="span" className="x-docs-mobile-current">
              {navigationLabel}
            </Text>
          </UnstyledButton>
          <ActionIcon
            className="x-docs-mobile-search"
            variant="subtle"
            color="gray"
            size={34}
            aria-label="Search documentation"
            onClick={() => setSearchOpen(true)}
          >
            <IconSearch size={17} stroke={1.7} />
          </ActionIcon>
        </Box>
        <Button
          className="x-docs-search"
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
        <Box className="x-docs-pages">
          {docNavigation.map((group) => (
            <Box key={group.label} className="x-docs-group" mb="md">
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
                  aria-current={pageId === key ? 'page' : undefined}
                >
                  <Text component="span" fz="sm" fw={pageId === key ? 570 : 450}>
                    {label}
                  </Text>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>

      <Drawer
        opened={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        position="left"
        size={320}
        title="Documentation"
        padding={0}
        overlayProps={{ backgroundOpacity: 0.32, blur: 2 }}
        transitionProps={{ duration: 160 }}
        closeButtonProps={{ 'aria-label': 'Close documentation navigation' }}
        classNames={{
          content: 'x-docs-drawer-content',
          header: 'x-docs-drawer-header',
          body: 'x-docs-drawer-body',
          title: 'x-docs-drawer-title',
        }}
      >
        <Box component="nav" id="documentation-navigation" aria-label="Documentation pages">
          {docNavigation.map((group) => (
            <Box key={group.label} className="x-docs-drawer-group">
              <Text className="x-docs-drawer-group-label">{group.label}</Text>
              {group.pages.map(([pageId, label]) => (
                <Box
                  key={pageId}
                  component="a"
                  href={href(`/docs/${pageId}`)}
                  className="x-docs-drawer-item"
                  data-active={pageId === key || undefined}
                  aria-current={pageId === key ? 'page' : undefined}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {label}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Drawer>

      <Box component="article" className="x-docs-body">
        <Text component="h1" fz={{ base: 30, md: 38 }} lh={1.1} fw={620} m={0} maw="20ch">
          {title}
        </Text>
        <Text fz="lg" c="var(--x-quiet)" mt="md" maw="var(--x-measure)">
          {lead}
        </Text>
        {mdx ? (
          <Box className="x-mdx-body">
            <mdx.Content components={mdxComponents} />
          </Box>
        ) : (
          page.blocks.map((block) => <Block key={block.heading} block={block} pageKey={key} />)
        )}

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
              {docTitle(previous)}
            </Anchor>
          ) : (
            <span />
          )}
          {next ? (
            <Anchor href={href(`/docs/${next}`)} fz="sm" ta="right">
              <Text fz={12.5} c="var(--x-quiet)">
                Next
              </Text>
              {docTitle(next)}
            </Anchor>
          ) : null}
        </Box>
      </Box>

      <Box component="nav" className="x-docs-outline" aria-label="On this page">
        <Text fz={12.5} c="var(--x-faint)" mb={8}>
          On this page
        </Text>
        {outline.map((item) => (
          <Anchor
            key={item.id}
            href={`#${item.id}`}
            fz={13}
            c="var(--x-quiet)"
            underline="never"
            display="block"
            py={4}
            onClick={(event) => {
              event.preventDefault();
              document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {item.heading}
          </Anchor>
        ))}
      </Box>

      <Search open={searchOpen} onClose={() => setSearchOpen(false)} />
    </Box>
  );
}
