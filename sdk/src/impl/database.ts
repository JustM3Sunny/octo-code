import type {
  AddAgentStepFn,
  FetchAgentFromDatabaseFn,
  FinishAgentRunFn,
  GetUserInfoFromApiKeyInput,
  GetUserInfoFromApiKeyOutput,
  StartAgentRunFn,
  UserColumn,
} from '@siya/common/types/contracts/database'
import type { ParamsOf } from '@siya/common/types/function-params'

export async function getUserInfoFromApiKey<T extends UserColumn>(
  _params: GetUserInfoFromApiKeyInput<T>,
): GetUserInfoFromApiKeyOutput<T> {
  return { id: 'local-user', email: 'user@siya.local' } as any
}

export async function fetchAgentFromDatabase(
  _params: ParamsOf<FetchAgentFromDatabaseFn>,
): ReturnType<FetchAgentFromDatabaseFn> {
  return null
}

export async function startAgentRun(
  _params: ParamsOf<StartAgentRunFn>,
): ReturnType<StartAgentRunFn> {
  return `siya-run-${crypto.randomUUID()}`
}

export async function finishAgentRun(
  _params: ParamsOf<FinishAgentRunFn>,
): ReturnType<FinishAgentRunFn> {
  return
}

export async function addAgentStep(
  _params: ParamsOf<AddAgentStepFn>,
): ReturnType<AddAgentStepFn> {
  return null
}
