import type { FileProcessingState } from './tool/write-file'
import type { ToolName } from '@siya/common/tools/constants'
import type {
  ClientToolCall,
  ClientToolName,
  SiyaToolCall,
  SiyaToolMessage,
  SiyaToolOutput,
} from '@siya/common/tools/list'
import type { AgentTemplate } from '@siya/common/types/agent-template'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@siya/common/types/contracts/agent-runtime'
import type { TrackEventFn } from '@siya/common/types/contracts/analytics'
import type { SendSubagentChunkFn } from '@siya/common/types/contracts/client'
import type { Logger } from '@siya/common/types/contracts/logger'
import type { PrintModeEvent } from '@siya/common/types/print-mode'
import type { AgentState, Subgoal } from '@siya/common/types/session-state'
import type { ProjectFileContext } from '@siya/common/util/file'
import type { ToolSet } from 'ai'

type PresentOrAbsent<K extends PropertyKey, V> =
  | { [P in K]: V }
  | { [P in K]: never }

export type SiyaToolHandlerFunction<T extends ToolName = ToolName> = (
  params: {
    previousToolCallFinished: Promise<void>
    toolCall: SiyaToolCall<T>

    agentContext: Record<string, Subgoal>
    agentState: AgentState
    agentStepId: string
    agentTemplate: AgentTemplate
    ancestorRunIds: string[]
    apiKey: string
    clientSessionId: string
    fetch: typeof globalThis.fetch
    fileContext: ProjectFileContext
    fileProcessingState: FileProcessingState
    fingerprintId: string
    fullResponse: string
    localAgentTemplates: Record<string, AgentTemplate>
    logger: Logger
    prompt: string | undefined
    repoId: string | undefined
    repoUrl: string | undefined
    runId: string
    sendSubagentChunk: SendSubagentChunkFn
    signal: AbortSignal
    system: string
    tools: ToolSet
    trackEvent: TrackEventFn
    userId: string | undefined
    userInputId: string
    writeToClient: (chunk: string | PrintModeEvent) => void
  } & PresentOrAbsent<
    'requestClientToolCall',
    (
      toolCall: ClientToolCall<T extends ClientToolName ? T : never>,
    ) => Promise<SiyaToolOutput<T extends ClientToolName ? T : never>>
  > &
    AgentRuntimeDeps &
    AgentRuntimeScopedDeps,
) => Promise<{
  output: SiyaToolMessage<T>['content']
  creditsUsed?: number
}>
