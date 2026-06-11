import { useShallow } from 'zustand/react/shallow'

import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'
import {
  getDisplayModelForMode,
  getModelDisplayName,
} from '../utils/model-settings'

import type { AgentMode } from '../utils/constants'

const MODE_SHORT_LABEL: Record<AgentMode, string> = {
  DEFAULT: 'DEFAULT',
  LITE: 'LITE',
  MAX: 'MAX',
  PLAN: 'PLAN',
}

export const PromptStatusBar = () => {
  const theme = useTheme()
  const { agentMode, selectedModel } = useChatStore(
    useShallow((state) => ({
      agentMode: state.agentMode,
      selectedModel: state.selectedModel,
    })),
  )

  const displayModel = getDisplayModelForMode(agentMode, selectedModel)
  const modelLabel = getModelDisplayName(displayModel)

  return (
    <box style={{ flexDirection: 'row', paddingLeft: 1, paddingTop: 0 }}>
      <text style={{ fg: theme.muted }}>
        {`${MODE_SHORT_LABEL[agentMode]} · ${modelLabel}`}
      </text>
    </box>
  )
}
