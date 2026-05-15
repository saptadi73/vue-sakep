export type ConsolidationSection = 'balance-sheet' | 'pnl' | 'trial-balance'

export type ConsolidationLineType = 'header' | 'detail' | 'subtotal' | 'total' | 'derived'

export interface ConsolidationEntity {
  id: string
  name: string
  source: 'odoo' | 'bprs' | 'jabmart' | 'uspps' | 'manual'
  enabled: boolean
  ownershipPct?: number
}

export interface CoaMappingRule {
  entityId: string
  sourceAccount: string
  sourceDescriptionContains?: string
  consolidationKey: string
  section: ConsolidationSection
  parentKey?: string
  lineType?: ConsolidationLineType
  sign?: 1 | -1
  note?: string
}

export interface ConsolidationNode {
  key: string
  section: ConsolidationSection
  label: string
  lineType: ConsolidationLineType
  parentKey?: string
  order: number
  formula?: string
}

export interface EliminationRule {
  id: string
  name: string
  enabled: boolean
  section: ConsolidationSection
  debitKey: string
  creditKey: string
  scope: 'all' | 'entity-pair'
  entityPair?: [string, string]
  method: 'full' | 'percentage'
  percentage?: number
  note?: string
}

export interface ConsolidationConfig {
  version: string
  groupCurrency: string
  entities: ConsolidationEntity[]
  coaMappings: CoaMappingRule[]
  reportTree: ConsolidationNode[]
  eliminationRules: EliminationRule[]
}
