import { SIYA_MAX_DEFAULT_MODEL } from '@siya/common/constants/siya-models'

import { createBase2 } from './base2'

const definition = {
  ...createBase2({ mode: 'max', model: SIYA_MAX_DEFAULT_MODEL }),
  id: 'base2-max',
  displayName: 'Siya the Max Orchestrator',
}

export default definition
