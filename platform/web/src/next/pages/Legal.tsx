import { Box, Text } from '@mantine/core';
import { legalPages } from '../../content/legal';
import { Page } from '../components/Shell';

export function Legal({ pageKey }: { pageKey: 'privacy' | 'terms' }) {
  const page = legalPages[pageKey];
  return (
    <Page width={860}>
      <Box py={48}>
        <Text component="h1" fz={{ base: 30, md: 38 }} lh={1.1} fw={620} m={0}>
          {page.title}
        </Text>
        <Text fz="lg" c="var(--x-quiet)" mt="md" maw="var(--x-measure)">
          {page.intro}
        </Text>
        <Text fz={12.5} c="var(--x-faint)" mt={12}>
          Last updated August 2026
        </Text>
        {page.sections.map(([heading, copy]) => (
          <Box key={heading} mt={36}>
            <Text
              component="h2"
              fz={19}
              fw={600}
              m={0}
              className="x-display"
              style={{ borderTop: '1px solid var(--x-rule-firm)', paddingTop: 14 }}
            >
              {heading}
            </Text>
            <Text fz="md" mt={10} maw="var(--x-measure)">
              {copy}
            </Text>
          </Box>
        ))}
      </Box>
    </Page>
  );
}
