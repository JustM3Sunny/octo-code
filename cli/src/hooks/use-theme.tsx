/**
 * Theme Hooks
 *
 * Simple hooks for accessing theme from zustand store
 */

import { create } from 'zustand'

import { getCliEnv } from '../utils/env'
import { themeConfig, buildTheme } from '../utils/theme-config'
import {
  getDefaultNamedThemeId,
  resolveNamedTheme,
} from '../utils/named-themes'
import { loadSettings, saveSettings } from '../utils/settings'
import {
  chatThemes,
  cloneChatTheme,
  detectIDETheme,
  detectPlatformTheme,
  detectTerminalOverrides,
  getOscDetectedTheme,
  initializeThemeWatcher,
  setThemeResolver,
  setLastDetectedTheme,
  setupFileWatchers,
} from '../utils/theme-system'

import type { ChatTheme, ThemeName } from '../types/theme-system'
import type { StoreApi, UseBoundStore } from 'zustand'

type ThemeStore = {
  theme: ChatTheme
  themePresetId: string
  setThemeName: (name: ThemeName) => void
  setThemePreset: (presetId: string) => void
}

const buildResolvedTheme = (
  mode: ThemeName,
  presetId: string,
): ChatTheme => {
  const baseTheme = cloneChatTheme(chatThemes[mode])
  const preset = resolveNamedTheme(presetId)
  const presetOverrides =
    mode === 'dark' && preset ? preset.overrides : {}
  return buildTheme(
    baseTheme,
    mode,
    { ...themeConfig.customColors, ...presetOverrides },
    themeConfig.plugins,
  )
}

export let useThemeStore: UseBoundStore<StoreApi<ThemeStore>> = (() => {
  throw new Error('useThemeStore not initialized')
}) as any
let themeStoreInitialized = false

type ThemeDetector = {
  description: string
  detect: () => ThemeName | null
}

const THEME_PRIORITY: ThemeDetector[] = [
  {
    description: 'Terminal override (e.g., OPENAI_THEME)',
    detect: detectTerminalOverrides,
  },
  {
    description: 'IDE configuration (VS Code, JetBrains, Zed)',
    detect: detectIDETheme,
  },
  {
    description: 'OSC terminal colors',
    detect: () => getOscDetectedTheme(),
  },
  {
    description: 'Operating system theme',
    detect: detectPlatformTheme,
  },
]

export const detectSystemTheme = (): ThemeName => {
  const env = getCliEnv()
  const envPreference = env.OPEN_TUI_THEME ?? env.OPENTUI_THEME
  const normalizedEnv = envPreference?.toLowerCase()

  if (normalizedEnv === 'dark' || normalizedEnv === 'light') {
    return normalizedEnv
  }

  const preferredTheme = (): ThemeName => {
    for (const detector of THEME_PRIORITY) {
      const result = detector.detect()
      if (result) {
        return result
      }
    }
    return 'dark'
  }

  const resolved = preferredTheme()

  if (normalizedEnv === 'opposite') {
    return resolved === 'dark' ? 'light' : 'dark'
  }

  return resolved
}

export function initializeThemeStore() {
  if (themeStoreInitialized) {
    return
  }
  themeStoreInitialized = true

  setThemeResolver(detectSystemTheme)
  setupFileWatchers()

  const initialThemeName = detectSystemTheme()
  setLastDetectedTheme(initialThemeName)
  const initialPresetId =
    loadSettings().themePreset ?? getDefaultNamedThemeId()
  const initialTheme = buildResolvedTheme(initialThemeName, initialPresetId)

  useThemeStore = create<ThemeStore>((set, get) => ({
    theme: initialTheme,
    themePresetId: initialPresetId,

    setThemeName: (name: ThemeName) => {
      const { themePresetId } = get()
      const theme = buildResolvedTheme(name, themePresetId)
      set({ theme })
    },

    setThemePreset: (presetId: string) => {
      const resolved = resolveNamedTheme(presetId)
      if (!resolved) return

      const mode = get().theme.name
      const theme = buildResolvedTheme(mode, resolved.id)
      saveSettings({ themePreset: resolved.id })
      set({ theme, themePresetId: resolved.id })
    },
  }))

  // Set up the theme watcher for reactive updates when system theme changes
  initializeThemeWatcher((name: ThemeName) => {
    useThemeStore.getState().setThemeName(name)
  })

  // Note: OSC detection is done earlier in index.tsx before OpenTUI starts,
  // so the result is already available via getOscDetectedTheme()
}

export const useTheme = (): ChatTheme => {
  return useThemeStore((state) => state.theme)
}
