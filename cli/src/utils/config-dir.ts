import os from 'os'
import path from 'path'

import { env } from '@siya/common/env'

/** Directory for CLI config and persisted state. */
export const getConfigDir = (): string => {
  return path.join(
    os.homedir(),
    '.config',
    'siya' +
      (env.NEXT_PUBLIC_CB_ENVIRONMENT !== 'prod'
        ? `-${env.NEXT_PUBLIC_CB_ENVIRONMENT}`
        : ''),
  )
}
