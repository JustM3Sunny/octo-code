import { existsSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'

import { PRIMARY_KNOWLEDGE_FILE_NAME } from '@siya/common/constants/knowledge'

const INITIAL_KNOWLEDGE_FILE = `# Project knowledge

This file gives Siya context about your project: goals, commands, conventions, and gotchas.

## Quickstart
- Setup:
- Dev:
- Test:

## Architecture
- Key directories:
- Data flow:

## Conventions
- Formatting/linting:
- Patterns to follow:
- Things to avoid:
`

export function runTelegramInitProject(projectCwd: string): string[] {
  const messages: string[] = []
  const knowledgePath = path.join(projectCwd, PRIMARY_KNOWLEDGE_FILE_NAME)

  if (existsSync(knowledgePath)) {
    messages.push(`📋 \`${PRIMARY_KNOWLEDGE_FILE_NAME}\` already exists.`)
  } else {
    writeFileSync(knowledgePath, INITIAL_KNOWLEDGE_FILE)
    messages.push(`✅ Created \`${PRIMARY_KNOWLEDGE_FILE_NAME}\``)
  }

  const agentsDir = path.join(projectCwd, '.agents')
  if (existsSync(agentsDir)) {
    messages.push('📋 `.agents/` already exists.')
  } else {
    mkdirSync(agentsDir, { recursive: true })
    messages.push('✅ Created `.agents/`')
  }

  return messages
}
