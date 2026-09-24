import {
  type CSSVariablesResolver,
  createTheme,
  type MantineColorsTuple,
  type MantineThemeOverride,
} from '@mantine/core';

// Aperture: the design system for Exalto Capture.
//
// One rule governs colour: chrome is achromatic, and a hue always names a
// state or the single primary action on the screen. Three hues carry meaning.
//   seal    the attested record and the primary action
//   custody what is live and held on this machine
//   alert   recording, failure, and destruction
//
// One rule governs type: Archivo carries everything a person reads, at two
// widths, and Geist Mono carries everything a machine produced.

const seal: MantineColorsTuple = [
  '#eef1fc',
  '#dbe1f8',
  '#b5c1f0',
  '#8c9fe7',
  '#6a82df',
  '#4e68d8',
  '#2b4acb',
  '#2340b6',
  '#1b369d',
  '#122a80',
];

const custody: MantineColorsTuple = [
  '#e6f5ee',
  '#c7e9da',
  '#95d5ba',
  '#5fc098',
  '#37ac7f',
  '#1d9c6d',
  '#12875c',
  '#0b6e4f',
  '#07573e',
  '#04422f',
];

const alert: MantineColorsTuple = [
  '#fcece9',
  '#f8d5ce',
  '#f0a899',
  '#e77a65',
  '#df553b',
  '#d93f22',
  '#c2321b',
  '#a32817',
  '#851f12',
  '#66170d',
];

const gray: MantineColorsTuple = [
  '#f6f7f8',
  '#eff0f2',
  '#e3e5e8',
  '#d2d5da',
  '#b9bdc4',
  '#949aa3',
  '#737a84',
  '#5a6069',
  '#3d434b',
  '#171a1f',
];

const dark: MantineColorsTuple = [
  '#e7eaee',
  '#c9ced6',
  '#a5acb7',
  '#7e8792',
  '#5a626d',
  '#3a424c',
  '#262c33',
  '#161a1f',
  '#10141a',
  '#0d1013',
];

const interfaceStack =
  "'Archivo Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const dataStack = "'Geist Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace";

// Headings run wide rather than reaching for a second family. Archivo's width
// axis is doing the work a display face would otherwise do.
const displayWidth = "'wdth' 112";

export const theme: MantineThemeOverride = createTheme({
  colors: { seal, custody, alert, gray, dark },
  primaryColor: 'seal',
  primaryShade: { light: 6, dark: 5 },
  white: '#ffffff',
  black: '#171a1f',
  fontFamily: interfaceStack,
  fontFamilyMonospace: dataStack,
  defaultRadius: 'sm',
  focusRing: 'auto',
  respectReducedMotion: true,
  radius: { xs: '2px', sm: '4px', md: '6px', lg: '10px', xl: '16px' },
  spacing: { xs: '6px', sm: '10px', md: '16px', lg: '24px', xl: '40px' },
  fontSizes: {
    xs: '11.5px',
    sm: '13px',
    md: '14.5px',
    lg: '16.5px',
    xl: '19px',
  },
  lineHeights: { xs: '1.4', sm: '1.45', md: '1.55', lg: '1.55', xl: '1.5' },
  headings: {
    fontFamily: interfaceStack,
    fontWeight: '600',
    textWrap: 'balance',
    sizes: {
      h1: { fontSize: '44px', lineHeight: '1.06', fontWeight: '620' },
      h2: { fontSize: '29px', lineHeight: '1.14', fontWeight: '600' },
      h3: { fontSize: '21px', lineHeight: '1.22', fontWeight: '600' },
      h4: { fontSize: '17px', lineHeight: '1.3', fontWeight: '600' },
      h5: { fontSize: '14.5px', lineHeight: '1.35', fontWeight: '600' },
      h6: { fontSize: '13px', lineHeight: '1.4', fontWeight: '600' },
    },
  },
  shadows: {
    xs: 'none',
    sm: 'none',
    md: '0 1px 2px rgba(23, 26, 31, 0.08), 0 8px 24px -12px rgba(23, 26, 31, 0.22)',
    lg: '0 2px 4px rgba(23, 26, 31, 0.08), 0 20px 48px -20px rgba(23, 26, 31, 0.28)',
    xl: '0 2px 4px rgba(23, 26, 31, 0.08), 0 32px 64px -24px rgba(23, 26, 31, 0.32)',
  },
  other: { displayWidth },
});

// Semantic surfaces. Mantine's own variables stay for its components; these
// name the two surfaces and three signals the system is actually built on.
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    '--x-display-width': displayWidth,
    '--x-gutter': '24px',
    '--x-measure': '66ch',
    '--x-control': '34px',
    '--x-row': '48px',
  },
  light: {
    '--x-shell': '#eff0f2',
    '--x-record': '#ffffff',
    '--x-sunken': '#e6e8eb',
    '--x-ink': '#171a1f',
    '--x-quiet': '#5a6069',
    '--x-faint': '#868d96',
    '--x-rule': 'rgba(23, 26, 31, 0.13)',
    '--x-rule-firm': 'rgba(23, 26, 31, 0.26)',
    '--x-seal': '#2b4acb',
    '--x-seal-wash': 'rgba(43, 74, 203, 0.09)',
    '--x-custody': '#0b6e4f',
    '--x-custody-wash': 'rgba(11, 110, 79, 0.1)',
    '--x-alert': '#c2321b',
    '--x-alert-wash': 'rgba(194, 50, 27, 0.1)',
    '--x-redact': '#171a1f',
    '--mantine-color-body': '#eff0f2',
  },
  dark: {
    '--x-shell': '#0d1013',
    '--x-record': '#161a1f',
    '--x-sunken': '#10141a',
    '--x-ink': '#e7eaee',
    '--x-quiet': '#939aa4',
    '--x-faint': '#737a84',
    '--x-rule': 'rgba(231, 234, 238, 0.13)',
    '--x-rule-firm': 'rgba(231, 234, 238, 0.28)',
    '--x-seal': '#8fa3f2',
    '--x-seal-wash': 'rgba(143, 163, 242, 0.14)',
    '--x-custody': '#3fcf8e',
    '--x-custody-wash': 'rgba(63, 207, 142, 0.13)',
    '--x-alert': '#f0705a',
    '--x-alert-wash': 'rgba(240, 112, 90, 0.14)',
    '--x-redact': '#e7eaee',
    '--mantine-color-body': '#0d1013',
  },
});
