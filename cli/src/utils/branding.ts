// Siya ASCII Logo - compact version for 80-width terminals
export const LOGO = `
 ███████╗██╗██╗   ██╗ █████╗
 ██╔════╝██║╚██╗ ██╔╝██╔══██╗
 ███████╗██║ ╚████╔╝ ███████║
 ╚════██║██║  ╚██╔╝  ██╔══██║
 ███████║██║   ██║   ██║  ██║
 ╚══════╝╚═╝   ╚═╝   ╚═╝  ╚═╝
`

export const LOGO_SMALL = `
 ███████╗██╗██╗   ██╗ █████╗
 ██╔════╝██║╚██╗ ██╔╝██╔══██╗
 ███████╗██║ ╚████╔╝ ███████║
 ╚════██║██║  ╚██╔╝  ██╔══██║
 ███████║██║   ██║   ██║  ██║
 ╚══════╝╚═╝   ╚═╝   ╚═╝  ╚═╝
`

export const SHADOW_CHARS = new Set([
  '╚',
  '═',
  '╝',
  '║',
  '╔',
  '╗',
  '╠',
  '╣',
  '╦',
  '╩',
  '╬',
])

export const DEFAULT_TERMINAL_HEIGHT = 24
export const MODAL_VERTICAL_MARGIN = 2
export const MAX_MODAL_BASE_HEIGHT = 22
export const WARNING_BANNER_HEIGHT = 3

export const SHEEN_WIDTH = 5
export const SHEEN_STEP = 2
export const SHEEN_INTERVAL_MS = 150

export function getSheenColor(
  char: string,
  charIndex: number,
  sheenPosition: number,
  logoColor: string,
  shadowChars: Set<string>,
  accentColor: string = '#9EFC62',
  blockColor: string = '#ffffff',
  isReversing: boolean = false,
): string {
  if (char === '█') {
    return blockColor
  }

  if (!shadowChars.has(char)) {
    return logoColor
  }

  if (isReversing) {
    if (charIndex <= sheenPosition) {
      return logoColor
    }
    return accentColor
  }

  if (charIndex <= sheenPosition) {
    return accentColor
  }
  return logoColor
}

export function parseLogoLines(logo: string): string[] {
  return logo.split('\n').filter((line) => line.length > 0)
}
