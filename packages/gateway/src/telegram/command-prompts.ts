export const PLAN_BASE_PROMPT =
  'Gather all the relevant context and then spawn @thinker-gpt Think about how to implement the following:'

export const REVIEW_BASE_PROMPT =
  'Please gather all relevant context and then spawn @thinker-gpt to review:'

export const INTERVIEW_BASE_PROMPT =
  'Interview me to better understand my request and then create a spec file. First, gather any relevant context (read files, do research, etc.). Then, use several rounds of the ask_user tool to ask non-obvious clarifying questions — things you cannot easily infer from the codebase or my initial message. Ask about edge cases, preferences, constraints, and design decisions. All questions should be directed through the ask_user tool -- not written out as text. Keep coming up with new questions that get at unique aspects of the request. Aim for at least **3 rounds** with multiple questions each round. When satisfied, write a [INSERT_REQUEST_SHORT_NAME]-spec.md file with all the information you have gathered about the request. Aim for as much detail as possible. You should NOT make any code changes yet. Stop after creating the spec file. End by using the suggest_followups tool with ways to flesh out the spec file. Here is my request:'

export function buildPlanPrompt(input: string): string {
  const trimmed = input.trim()
  return trimmed ? `${PLAN_BASE_PROMPT}\n\n${trimmed}` : PLAN_BASE_PROMPT
}

export function buildInterviewPrompt(input: string): string {
  const trimmed = input.trim()
  return trimmed ? `${INTERVIEW_BASE_PROMPT}\n\n${trimmed}` : INTERVIEW_BASE_PROMPT
}

export function buildReviewPromptFromArgs(input: string): string {
  const trimmed = input.trim()
  return trimmed
    ? `${REVIEW_BASE_PROMPT} ${trimmed}`
    : `${REVIEW_BASE_PROMPT} all changes made in this conversation`
}

export const INIT_AGENT_PROMPT =
  'Initialize this project for Siya: ensure knowledge.md and .agents/types stubs exist, then briefly summarize what you found in the repo and suggest next steps.'

export const GPT5_AGENT_PROMPT_PREFIX = '@GPT-5 Agent '
