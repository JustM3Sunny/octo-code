#!/usr/bin/env bun

import './pre-init/load-env'
import './pre-init/tree-sitter-wasm'

import fs from 'fs'
import os from 'os'
import path from 'path'

import { AnalyticsEvent } from '@siya/common/constants/analytics-events'
import { getProjectFileTree } from '@siya/common/project-file-tree'
import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from '@tanstack/react-query'
import React from 'react'

import { App } from './app'
import { loadPackageVersion, parseArgs } from './cli-args'
import { handleGatewayCommand } from './commands/gateway'
import { handlePairingCommand } from './commands/pairing'
import { initializeApp } from './init/init-app'
import { getProjectRoot, setProjectRoot } from './project-files'
import { trackEvent } from './utils/analytics'
import { resetSiyaClient, warmupMainAgent } from './utils/siya-client'
import { initializeAgentRegistry } from './utils/local-agent-registry'
import { trimOversizedChatLogs } from './utils/chat-history'
import { clearLogFile, logger } from './utils/logger'
import { shouldShowProjectPicker } from './utils/project-picker'
import { saveRecentProject } from './utils/recent-projects'
import { installProcessCleanupHandlers, TERMINAL_RESET_SEQUENCES } from './utils/renderer-cleanup'
import { startEmbeddedGatewayIfConfigured } from './utils/gateway-runtime'
import { startCliScheduler } from './utils/schedule-runtime'
import { initializeSkillRegistry } from './utils/skill-registry'
import { detectTerminalTheme } from './utils/terminal-color-detection'
import { setOscDetectedTheme } from './utils/theme-system'

import type { FileTreeNode } from '@siya/common/util/file'

focusManager.setEventListener(() => {
  return () => {}
})
focusManager.setFocused(true)

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: false,
      },
      mutations: {
        retry: 1,
      },
    },
  })
}

async function main(): Promise<void> {
  if (process.argv.includes('--smoke-tree-sitter')) {
    const wasmBinary = (
      globalThis as { __Siya_TREE_SITTER_WASM_BINARY__?: Uint8Array }
    ).__Siya_TREE_SITTER_WASM_BINARY__
    const wasmPath = (
      globalThis as { __Siya_TREE_SITTER_WASM_PATH__?: string }
    ).__Siya_TREE_SITTER_WASM_PATH__

    const fsMod = await import('fs')
    const pathMod = await import('path')
    const execDir = pathMod.dirname(process.execPath)
    const siblingPath = pathMod.join(execDir, 'tree-sitter.wasm')
    let dirListing: string[] = []
    try {
      dirListing = fsMod.readdirSync(execDir)
    } catch (err) {
      dirListing = [`<readdir failed: ${err instanceof Error ? err.message : err}>`]
    }
    console.error(
      `[smoke diag] execPath=${process.execPath}\n` +
        `[smoke diag] execDir=${execDir}\n` +
        `[smoke diag] siblingPath=${siblingPath}\n` +
        `[smoke diag] siblingExists=${fsMod.existsSync(siblingPath)}\n` +
        `[smoke diag] dir contents (${dirListing.length}): ${dirListing.slice(0, 30).join(', ')}\n` +
        `[smoke diag] globalThis wasmPath=${wasmPath ?? '<unset>'}\n` +
        `[smoke diag] globalThis wasmBinary bytes=${wasmBinary?.byteLength ?? 0}\n`,
    )

    try {
      const { Parser } = await import('web-tree-sitter')
      let effectiveBinary = wasmBinary
      let effectivePath = wasmPath
      if (!effectiveBinary && !effectivePath && fsMod.existsSync(siblingPath)) {
        effectivePath = siblingPath
        effectiveBinary = new Uint8Array(fsMod.readFileSync(siblingPath))
      }

      if (effectiveBinary) {
        await Parser.init({ wasmBinary: effectiveBinary })
        console.log(
          `tree-sitter smoke ok (wasmBinary, ${effectiveBinary.byteLength} bytes)`,
        )
      } else if (effectivePath) {
        await Parser.init({
          locateFile: (name: string) =>
            name === 'tree-sitter.wasm' ? effectivePath! : name,
        })
        console.log(`tree-sitter smoke ok (locateFile, path=${effectivePath})`)
      } else {
        console.error(
          'tree-sitter smoke FAIL: no wasm available — pre-init published ' +
            'nothing and the sibling-of-execPath fallback also missed. See ' +
            'the diag above for paths.',
        )
        process.exit(1)
      }
      process.exit(0)
    } catch (err) {
      console.error('tree-sitter smoke FAIL:', err)
      process.exit(1)
    }
  }

  if (process.stdin.isTTY && process.platform !== 'win32') {
    try {
      const oscTheme = await detectTerminalTheme()
      if (oscTheme) {
        setOscDetectedTheme(oscTheme)
      }
    } catch {
      // Silently ignore OSC detection failures
    }
  }

  const {
    initialPrompt,
    command,
    subcommand,
    commandArgs,
    agent,
    clearLogs,
    continue: continueChat,
    continueId,
    cwd,
    initialMode,
  } = parseArgs()

  if (command === 'gateway') {
    await initializeApp({ cwd })
    await initializeAgentRegistry()
    await handleGatewayCommand({ subcommand, cwd })
    return
  }

  if (command === 'pairing') {
    await initializeApp({ cwd })
    await handlePairingCommand({ subcommand, commandArgs })
    return
  }

  const hasAgentOverride = Boolean(agent?.trim())

  await initializeApp({ cwd })

  const projectRoot = getProjectRoot()
  const homeDir = os.homedir()
  const startCwd = process.cwd()
  const showProjectPicker = shouldShowProjectPicker(startCwd, homeDir)

  trackEvent(AnalyticsEvent.APP_LAUNCHED, {
    version: loadPackageVersion(),
    platform: process.platform,
    arch: process.arch,
    hasInitialPrompt: Boolean(initialPrompt),
    hasAgentOverride: hasAgentOverride,
    continueChat,
    initialMode: initialMode ?? 'DEFAULT',
  })

  if (!hasAgentOverride) {
    await initializeAgentRegistry()
  }

  await initializeSkillRegistry()

  const gatewayStarted = await startEmbeddedGatewayIfConfigured({
    cwd: projectRoot,
  })
  await startCliScheduler(agent ?? 'base2-lite')
  await warmupMainAgent()

  if (gatewayStarted) {
    logger.info(
      {},
      'Main agent ready with Telegram tools (notify_telegram, send_telegram_file)',
    )
  }

  if (clearLogs) {
    clearLogFile()
  }

  setTimeout(trimOversizedChatLogs, 0)

  const queryClient = createQueryClient()

  const AppRoot = () => {
    const [fileTree, setFileTree] = React.useState<FileTreeNode[]>([])
    const [currentProjectRoot, setCurrentProjectRoot] =
      React.useState(projectRoot)
    const [showProjectPickerScreen, setShowProjectPickerScreen] =
      React.useState(showProjectPicker)

    const loadFileTree = React.useCallback(async (root: string) => {
      try {
        if (root) {
          const tree = await getProjectFileTree({
            projectRoot: root,
            fs: fs.promises,
          })
          setFileTree(tree)
        }
      } catch {
        // fileTree is optional for @ menu
      }
    }, [])

    React.useEffect(() => {
      loadFileTree(currentProjectRoot)
    }, [currentProjectRoot, loadFileTree])

    const handleProjectChange = React.useCallback(
      async (newProjectPath: string) => {
        process.chdir(newProjectPath)

        const isGitRepo = fs.existsSync(path.join(newProjectPath, '.git'))
        const pathDepth = newProjectPath.split(path.sep).filter(Boolean).length
        trackEvent(AnalyticsEvent.CHANGE_DIRECTORY, {
          isGitRepo,
          pathDepth,
          isHomeDir: newProjectPath === os.homedir(),
        })
        setProjectRoot(newProjectPath)
        resetSiyaClient()
        saveRecentProject(newProjectPath)
        setCurrentProjectRoot(newProjectPath)
        setFileTree([])
        setShowProjectPickerScreen(false)
      },
      [],
    )

    return (
      <App
        initialPrompt={initialPrompt}
        agentId={agent}
        fileTree={fileTree}
        continueChat={continueChat}
        continueChatId={continueId ?? undefined}
        initialMode={initialMode}
        showProjectPicker={showProjectPickerScreen}
        onProjectChange={handleProjectChange}
      />
    )
  }

  const earlyFatalHandler = (error: unknown) => {
    try {
      if (process.stdin.isTTY && process.stdin.setRawMode) {
        process.stdin.setRawMode(false)
      }
    } catch {
      // stdin may be closed
    }
    try {
      if (process.stdout.isTTY) {
        process.stdout.write(TERMINAL_RESET_SEQUENCES)
      }
    } catch {
      // stdout may be closed
    }
    try {
      console.error('Fatal error during startup:', error)
    } catch {
      // stderr may be closed
    }
    process.exit(1)
  }
  process.on('uncaughtException', earlyFatalHandler)
  process.on('unhandledRejection', earlyFatalHandler)

  const renderer = await createCliRenderer({
    backgroundColor: 'transparent',
    exitOnCtrlC: false,
    screenMode: 'alternate-screen',
  })

  process.removeListener('uncaughtException', earlyFatalHandler)
  process.removeListener('unhandledRejection', earlyFatalHandler)
  installProcessCleanupHandlers(renderer)
  createRoot(renderer).render(
    <QueryClientProvider client={queryClient}>
      <AppRoot />
    </QueryClientProvider>,
  )
}

void main()
