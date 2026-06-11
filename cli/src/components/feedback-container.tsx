import React, { useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { FeedbackInputMode } from './feedback-input-mode'
import { useChatStore } from '../state/chat-store'
import { useFeedbackStore } from '../state/feedback-store'
import { showClipboardMessage } from '../utils/clipboard'
import { buildFeedbackPayload, buildMessageContext } from '../utils/feedback-helpers'
import { resolveFeedbackSubmission } from '../utils/feedback-submission'
import { logger } from '../utils/logger'

interface FeedbackContainerProps {
  inputRef: React.MutableRefObject<any>
  onExitFeedback?: () => void
  width: number
}

export const FeedbackContainer: React.FC<FeedbackContainerProps> = ({
  inputRef,
  onExitFeedback,
  width,
}) => {
  const {
    feedbackMode,
    feedbackText,
    feedbackCursor,
    feedbackCategory,
    feedbackMessageId,
    feedbackFooterMessage,
    isSubmitting,
    errors,
    setFeedbackText,
    setFeedbackCursor,
    setFeedbackCategory,
  } = useFeedbackStore(
    useShallow((state) => ({
      feedbackMode: state.feedbackMode,
      feedbackText: state.feedbackText,
      feedbackCursor: state.feedbackCursor,
      feedbackCategory: state.feedbackCategory,
      feedbackMessageId: state.feedbackMessageId,
      feedbackFooterMessage: state.feedbackFooterMessage,
      isSubmitting: state.isSubmitting,
      errors: state.errors,
      setFeedbackText: state.setFeedbackText,
      setFeedbackCursor: state.setFeedbackCursor,
      setFeedbackCategory: state.setFeedbackCategory,
    })),
  )

  const { messages, agentMode, sessionCreditsUsed } = useChatStore(
    useShallow((state) => ({
      messages: state.messages,
      agentMode: state.agentMode,
      sessionCreditsUsed: state.sessionCreditsUsed,
    })),
  )

  const handleFeedbackSubmit = useCallback(() => {
    const store = useFeedbackStore.getState()
    if (store.isSubmitting) return

    const { clientFeedbackId } = store
    if (!clientFeedbackId) return

    const text = feedbackText.trim()
    if (!text) {
      return
    }

    store.setIsSubmitting(true)

    const { target, recentMessages } = buildMessageContext(messages, feedbackMessageId)
    const payload = buildFeedbackPayload({
      text,
      feedbackCategory,
      feedbackMessageId,
      target,
      recentMessages,
      agentMode,
      sessionCreditsUsed,
      errors,
      clientFeedbackId,
    })

    const submittedMessageId = feedbackMessageId
    const submittedCategory = feedbackCategory
    const submittedClientFeedbackId = clientFeedbackId

    logger.info({ payload }, 'Feedback submitted locally')
    const feedbackStore = useFeedbackStore.getState()
    const { isCurrentSubmission, shouldSettleSubmission } = resolveFeedbackSubmission(
      feedbackStore.clientFeedbackId,
      submittedClientFeedbackId,
    )

    if (submittedMessageId) {
      feedbackStore.markMessageFeedbackSubmitted(submittedMessageId, submittedCategory)
    }

    if (isCurrentSubmission) {
      feedbackStore.resetFeedbackForm()
      feedbackStore.closeFeedback()
      feedbackStore.setIsSubmitting(false)
      if (onExitFeedback) onExitFeedback()
    } else if (shouldSettleSubmission) {
      feedbackStore.setIsSubmitting(false)
    }

    if (shouldSettleSubmission) {
      showClipboardMessage('Feedback saved locally', { durationMs: 5000 })
    }
  }, [
    feedbackText,
    feedbackMessageId,
    feedbackCategory,
    errors,
    messages,
    agentMode,
    sessionCreditsUsed,
    onExitFeedback,
  ])

  const handleFeedbackCancel = useCallback(() => {
    useFeedbackStore.getState().closeFeedback()
    if (onExitFeedback) {
      onExitFeedback()
    }
  }, [onExitFeedback])

  useEffect(() => {
    if (feedbackMode && inputRef.current) {
      inputRef.current.focus()
    }
  }, [feedbackMode, inputRef])

  if (!feedbackMode) {
    return null
  }

  return (
    <FeedbackInputMode
      value={feedbackText}
      cursor={feedbackCursor}
      onChange={setFeedbackText}
      onCursorChange={setFeedbackCursor}
      onSubmit={handleFeedbackSubmit}
      onCancel={handleFeedbackCancel}
      feedbackCategory={feedbackCategory}
      onCategoryChange={setFeedbackCategory}
      inputRef={inputRef}
      width={width}
      footerMessage={feedbackFooterMessage}
      isSubmitting={isSubmitting}
    />
  )
}
