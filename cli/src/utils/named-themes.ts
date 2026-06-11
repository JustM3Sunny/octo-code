import type { ChatTheme } from '../types/theme-system'

export type SiyaNamedTheme = {
  id: string
  name: string
  description: string
  /** Color overrides applied on top of the dark base theme */
  overrides: Partial<ChatTheme>
}

/** Nightcode / OpenCode-inspired named palettes (dark variants). */
export const SIYA_NAMED_THEMES: SiyaNamedTheme[] = [
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Peach accent palette like opencode.ai',
    overrides: {
      primary: '#fab283',
      secondary: '#5c9cf5',
      info: '#56b6c2',
      success: '#7fd88f',
      error: '#e06c75',
      warning: '#f5a742',
      foreground: '#eeeeee',
      muted: '#808080',
      border: '#484848',
      surface: '#141414',
      surfaceHover: '#1e1e1e',
      userLine: '#484848',
      aiLine: '#3c3c3c',
      inputFg: '#eeeeee',
      inputFocusedFg: '#ffffff',
      modePlanBg: '#9d7cd8',
      modePlanText: '#9d7cd8',
      markdown: {
        codeBackground: '#1e1e1e',
        codeHeaderFg: '#808080',
        inlineCodeFg: '#7fd88f',
        codeTextFg: '#eeeeee',
        headingFg: {
          1: '#9d7cd8',
          2: '#9d7cd8',
          3: '#9d7cd8',
          4: '#9d7cd8',
          5: '#9d7cd8',
          6: '#9d7cd8',
        },
        listBulletFg: '#fab283',
        blockquoteBorderFg: '#484848',
        blockquoteTextFg: '#e5c07b',
        dividerFg: '#3c3c3c',
      },
    },
  },
  {
    id: 'siya',
    name: 'Siya Default',
    description: 'Original green accent palette',
    overrides: {},
  },
  {
    id: 'nightfox',
    name: 'Nightfox',
    description: 'Teal accents on deep navy',
    overrides: {
      primary: '#56D6C2',
      info: '#56D6C2',
      success: '#82E0AA',
      error: '#E74C5E',
      foreground: '#CDD6F4',
      muted: '#9399B2',
      border: '#4E4E66',
      surface: '#1A1A24',
      surfaceHover: '#242433',
      userLine: '#56D6C2',
      inputFg: '#CDD6F4',
      inputFocusedFg: '#FFFFFF',
      modePlanBg: '#CF8EF4',
      modePlanText: '#CF8EF4',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    description: 'Purple/pink classic terminal theme',
    overrides: {
      primary: '#BD93F9',
      info: '#8BE9FD',
      success: '#50FA7B',
      error: '#FF5555',
      foreground: '#F8F8F2',
      muted: '#6272A4',
      border: '#44475A',
      surface: '#343746',
      surfaceHover: '#44475A',
      userLine: '#BD93F9',
      inputFg: '#F8F8F2',
      modePlanBg: '#FF79C6',
      modePlanText: '#FF79C6',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    description: 'Blue-violet Japanese night city palette',
    overrides: {
      primary: '#7AA2F7',
      info: '#7DCFFF',
      success: '#9ECE6A',
      error: '#F7768E',
      foreground: '#C0CAF5',
      muted: '#565F89',
      border: '#565F89',
      surface: '#24283B',
      surfaceHover: '#2F3549',
      userLine: '#7AA2F7',
      inputFg: '#C0CAF5',
      modePlanBg: '#BB9AF7',
      modePlanText: '#BB9AF7',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    description: 'Arctic bluish calm dark theme',
    overrides: {
      primary: '#EBCB8B',
      info: '#88C0D0',
      success: '#A3BE8C',
      error: '#BF616A',
      foreground: '#ECEFF4',
      muted: '#616E88',
      border: '#4C566A',
      surface: '#3B4252',
      surfaceHover: '#434C5E',
      userLine: '#EBCB8B',
      inputFg: '#ECEFF4',
      modePlanBg: '#B48EAD',
      modePlanText: '#B48EAD',
    },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    description: 'Warm pastels on mocha background',
    overrides: {
      primary: '#E0AF68',
      info: '#7AA2F7',
      success: '#73DACA',
      error: '#F7768E',
      foreground: '#CDD6F4',
      muted: '#6C7086',
      border: '#585B70',
      surface: '#1E1E2E',
      surfaceHover: '#313244',
      userLine: '#E0AF68',
      inputFg: '#CDD6F4',
      modePlanBg: '#9D7CD8',
      modePlanText: '#9D7CD8',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    description: 'GitHub dimmed dark UI colors',
    overrides: {
      primary: '#79C0FF',
      info: '#58A6FF',
      success: '#56D364',
      error: '#F85149',
      foreground: '#C9D1D9',
      muted: '#484F58',
      border: '#30363D',
      surface: '#161B22',
      surfaceHover: '#21262D',
      userLine: '#79C0FF',
      inputFg: '#C9D1D9',
      modePlanBg: '#D2A8FF',
      modePlanText: '#D2A8FF',
    },
  },
]

const THEME_BY_ID = new Map(SIYA_NAMED_THEMES.map((t) => [t.id, t]))

export function resolveNamedTheme(id: string): SiyaNamedTheme | undefined {
  const normalized = id.trim().toLowerCase().replace(/\s+/g, '-')
  return (
    THEME_BY_ID.get(normalized) ??
    SIYA_NAMED_THEMES.find(
      (t) => t.name.toLowerCase().replace(/\s+/g, '-') === normalized,
    )
  )
}

export function getDefaultNamedThemeId(): string {
  return 'opencode'
}
