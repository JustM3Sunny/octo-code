import { createBase2 } from './base2'

const definition = {
  ...createBase2({ mode: 'plan', planOnly: true }),
  id: 'base2-plan',
  displayName: 'Siya the Plan-Only Orchestrator',
}
export default definition
